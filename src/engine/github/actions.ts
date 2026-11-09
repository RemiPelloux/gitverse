/**
 * Simulated GitHub Actions. Workflows are `.github/workflows/*.yml` files in
 * the commit's tree. Each `run:` line is executed by the simulator's own shell
 * in a scratch world whose files are the commit's snapshot.
 */
import { execute } from "../shell";
import type { FileMap, HostedRepo, WorkflowRun, World } from "../types";
import { parseYaml, type Yaml } from "./yaml";

type Obj = { [key: string]: Yaml };
const isObj = (v: Yaml | undefined): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const asList = (v: Yaml | undefined): string[] =>
  v == null ? [] : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : [];

export type Event = "push" | "pull_request";

interface Step {
  name?: string;
  uses?: string;
  run?: string;
}
interface Job {
  id: string;
  name: string;
  needs: string[];
  steps: Step[];
}
export interface Workflow {
  file: string;
  name: string;
  /** Event -> branch filters (empty = all branches). */
  on: Partial<Record<Event, string[]>>;
  jobs: Job[];
}

export const isWorkflowFile = (p: string) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p);

export function parseWorkflow(file: string, src: string): Workflow {
  let doc: Yaml;
  try {
    doc = parseYaml(src);
  } catch {
    doc = null;
  }
  const root: Obj = isObj(doc) ? doc : {};
  const base = file.split("/").pop()!.replace(/\.ya?ml$/, "");
  const name = typeof root.name === "string" ? root.name : base;
  const on: Workflow["on"] = {};
  // YAML 1.1 reads a bare `on:` key as `true`; accept both spellings.
  const trigger = root.on ?? root.true;
  const events = (e: string) => e === "push" || e === "pull_request";
  if (isObj(trigger)) {
    for (const [k, v] of Object.entries(trigger)) if (events(k)) on[k as Event] = isObj(v) ? asList(v.branches) : [];
  } else for (const e of asList(trigger)) if (events(e)) on[e as Event] = [];
  const jobs: Job[] = [];
  if (isObj(root.jobs)) {
    for (const [id, j] of Object.entries(root.jobs)) {
      const job: Obj = isObj(j) ? j : {};
      const steps: Step[] = [];
      for (const s of Array.isArray(job.steps) ? job.steps : []) {
        if (!isObj(s)) continue;
        steps.push({
          name: typeof s.name === "string" ? s.name : undefined,
          uses: typeof s.uses === "string" ? s.uses : undefined,
          run: typeof s.run === "string" ? s.run : undefined,
        });
      }
      jobs.push({ id, name: typeof job.name === "string" ? job.name : id, needs: asList(job.needs), steps });
    }
  }
  return { file, name, on, jobs };
}

export function workflowsIn(tree: FileMap): Workflow[] {
  return Object.keys(tree)
    .filter(isWorkflowFile)
    .sort()
    .map((f) => parseWorkflow(f, tree[f]));
}

function globMatch(pattern: string, branch: string): boolean {
  const re = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`).test(branch);
}

function mask(text: string, secrets: Record<string, string>): string {
  let t = text;
  for (const v of Object.values(secrets)) if (v) t = t.split(v).join("***");
  return t;
}

interface RunContext {
  event: Event;
  /** Branch shown in `gh run list` (the PR's head for pull_request runs). */
  branch: string;
  /** Branch the `branches:` filter is checked against (PR base for pull_request). */
  filterBranch: string;
  commit: string;
  pr?: number;
}

function substitute(cmd: string, host: HostedRepo, rc: RunContext, actor: string): string {
  return cmd.replace(/\$\{\{\s*([\w.-]+)\s*\}\}/g, (_, expr: string) => {
    if (expr.startsWith("secrets.")) return host.secrets?.[expr.slice(8)] ?? "";
    if (expr === "github.ref_name") return rc.branch;
    if (expr === "github.sha") return rc.commit;
    if (expr === "github.event_name") return rc.event;
    if (expr === "github.actor") return actor;
    if (expr === "github.repository") return `${host.owner}/${host.name}`;
    return "";
  });
}

function runJob(world: World, host: HostedRepo, tree: FileMap, job: Job, rc: RunContext): { ok: boolean; log: string[] } {
  const secrets = host.secrets ?? {};
  const log: string[] = [];
  let scratch: World = {
    version: 1,
    workdir: { ...tree },
    repo: null,
    hosted: {},
    hostedCommits: {},
    clock: world.clock,
    seq: world.seq,
    user: { ...world.user },
  };
  for (const step of job.steps) {
    if (step.uses) {
      log.push(`Run ${step.uses}`);
      continue;
    }
    if (step.run === undefined) continue;
    if (step.name) log.push(`Run ${step.name}`);
    for (const line of step.run.split("\n")) {
      const cmd = line.trim();
      if (!cmd || cmd.startsWith("#")) continue;
      const real = substitute(cmd, host, rc, world.user.name);
      log.push(mask(`$ ${real}`, secrets));
      const r = execute(scratch, real);
      for (const l of r.lines) log.push(mask(l.text, secrets));
      if (!r.ok) {
        log.push("Error: Process completed with exit code 1.");
        return { ok: false, log };
      }
      scratch = r.world;
    }
  }
  return { ok: true, log };
}

/** Execute one workflow against a commit and record the run. */
export function executeWorkflow(world: World, host: HostedRepo, wf: Workflow, rc: RunContext): WorkflowRun {
  const tree = world.hostedCommits[rc.commit]?.tree ?? {};
  const results = new Map<string, boolean>();
  const jobs: WorkflowRun["jobs"] = [];
  // run jobs in dependency order (jobs whose `needs` are satisfied first)
  const pending = [...wf.jobs];
  while (pending.length) {
    let idx = pending.findIndex((j) => j.needs.every((n) => results.has(n) || !wf.jobs.some((x) => x.id === n)));
    if (idx < 0) idx = 0; // cycle: just run in file order
    const job = pending.splice(idx, 1)[0];
    let res: { ok: boolean; log: string[] };
    if (job.needs.some((n) => results.get(n) === false)) res = { ok: false, log: ["skipped"] };
    else res = runJob(world, host, tree, job, rc);
    results.set(job.id, res.ok);
    jobs.push({ name: job.name, ok: res.ok, log: res.log });
  }
  host.runs = host.runs ?? [];
  const run: WorkflowRun = {
    id: host.runs.reduce((m, r) => Math.max(m, r.id), 0) + 1,
    workflow: wf.name,
    event: rc.event,
    branch: rc.branch,
    commit: rc.commit,
    status: jobs.every((j) => j.ok) ? "success" : "failure",
    file: wf.file,
    jobs,
  };
  if (rc.pr !== undefined) run.pr = rc.pr;
  host.runs.push(run);
  return run;
}

/** Start every workflow in the commit's tree that listens to this event/branch. */
export function triggerRuns(world: World, host: HostedRepo, rc: RunContext): WorkflowRun[] {
  const tree = world.hostedCommits[rc.commit]?.tree;
  if (!tree) return [];
  const runs: WorkflowRun[] = [];
  for (const wf of workflowsIn(tree)) {
    const filter = wf.on[rc.event];
    if (!filter) continue;
    if (filter.length && !filter.some((p) => globMatch(p, rc.filterBranch))) continue;
    runs.push(executeWorkflow(world, host, wf, rc));
  }
  return runs;
}
