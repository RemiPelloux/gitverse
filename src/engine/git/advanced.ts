import { Ctx, fail } from "../context";
import { shortId } from "../hash";
import { ignoreRules, matchIgnore } from "../ignore";
import { addReflog, ancestors, currentBranch, headCommitId, resolveRev } from "../repo";
import { execute } from "../shell";
import type { BisectState, Repo } from "../types";
import { formatDate } from "./basic";
import { diffStat, oneLine, requireRepo, switchTrees } from "./helpers";

// ---------------------------------------------------------------------------
// git bisect
// ---------------------------------------------------------------------------

const NOT_BISECTING_EXPLAIN =
  'Bisect is a guided search for the commit that introduced a bug. Start it with git bisect start, then mark a commit where the bug exists (git bisect bad) and one where it didn\'t yet (git bisect good <commit>).';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Git's estimate of the remaining steps (estimate_bisect_steps in bisect.c). */
function estimateSteps(all: number): number {
  if (all < 3) return 0;
  const n = Math.floor(Math.log2(all));
  const e = 2 ** n;
  const x = all - e;
  return e < 3 * x ? n : n - 1;
}

function requireBisect(ctx: Ctx, repo: Repo): BisectState {
  if (!repo.bisect)
    fail(['You need to start by "git bisect start"', ""], NOT_BISECTING_EXPLAIN);
  return repo.bisect;
}

function resolveOrFail(repo: Repo, rev: string): string {
  const id = resolveRev(repo, rev);
  if (!id)
    fail(`fatal: Bad rev input: ${rev}`, `Git can't find a commit called "${rev}". Use a commit id from git log --oneline, a branch, a tag, or HEAD~N.`);
  return id;
}

function describe(repo: Repo, id: string) {
  return `[${id}] ${oneLine(repo.commits[id])}`;
}

/** Detached checkout used by bisect (like `git switch --detach <id>`, without the long note). */
function detachAt(ctx: Ctx, repo: Repo, id: string) {
  if (repo.head.kind === "detached" && repo.head.commit === id) return;
  const from = currentBranch(repo) ?? headCommitId(repo);
  switchTrees(ctx, repo, repo.commits[id].tree);
  const fromLabel = currentBranch(repo) ?? shortId(headCommitId(repo) ?? "");
  repo.head = { kind: "detached", commit: id };
  addReflog(repo, id, `checkout: moving from ${fromLabel} to ${id}`);
  ctx.emit({ type: "checkout", from, to: id, detached: true });
}

function logLine(st: BisectState, ...lines: string[]) {
  (st.log ??= []).push(...lines);
}

function mark(repo: Repo, st: BisectState, kind: "bad" | "good" | "skip", id: string) {
  logLine(st, `# ${kind}: ${describe(repo, id)}`, `git bisect ${kind} ${id}`);
  if (kind === "bad") st.bad = id;
  else if (kind === "good") {
    if (!st.good.includes(id)) st.good.push(id);
  } else {
    st.skip ??= [];
    if (!st.skip.includes(id)) st.skip.push(id);
  }
}

function printFound(ctx: Ctx, repo: Repo, st: BisectState, id: string) {
  const c = repo.commits[id];
  st.found = id;
  logLine(st, `# first bad commit: ${describe(repo, id)}`);
  detachAt(ctx, repo, id);
  ctx.out(`${id} is the first bad commit`, "success");
  ctx.out(`commit ${id}`, "commit");
  ctx.out(`Author: ${c.author} <${c.author.toLowerCase().replace(/\s+/g, ".")}@gitverse.dev>`);
  ctx.out(`Date:   ${formatDate(c.time)}`, "muted");
  ctx.out("");
  for (const l of c.message.split("\n")) ctx.out(`    ${l}`);
  ctx.out("");
  ctx.out(diffStat(c.parents[0] ? repo.commits[c.parents[0]].tree : {}, c.tree));
}

/**
 * Decide what to do after a mark: wait for more marks, check out the next
 * commit to test, or announce the first bad commit. Returns true once found.
 */
function bisectNext(ctx: Ctx, repo: Repo, st: BisectState): boolean {
  if (!st.bad || !st.good.length) {
    const msg = !st.bad && !st.good.length
      ? "status: waiting for both good and bad commits"
      : st.bad
        ? "status: waiting for good commit(s), bad commit known"
        : `status: waiting for bad commit, ${st.good.length} good ${plural(st.good.length, "commit", "commits")} known`;
    ctx.out(msg, "muted");
    logLine(st, `# ${msg}`);
    return false;
  }
  const bad = st.bad;
  if (st.good.includes(bad))
    fail(`${bad} was both good and bad`, "You marked the same commit as both good and bad. Each commit either has the bug or doesn't.");
  const badAnc = ancestors(repo, bad);
  if (st.good.some((g) => !badAnc.has(g)))
    fail(
      ["Some good revs are not ancestors of the bad rev.", "git bisect cannot work properly in this case.", "Maybe you mistook good and bad revs?"],
      "A 'good' commit must be older than the 'bad' one (an ancestor of it). Check that you didn't swap them: bad = has the bug (usually the newest), good = an older commit without it.",
    );
  const excluded = new Set<string>();
  for (const g of st.good) for (const a of ancestors(repo, g)) excluded.add(a);
  const candidates = [...badAnc].filter((c) => !excluded.has(c));
  const all = candidates.length;
  if (all === 1) {
    printFound(ctx, repo, st, bad);
    return true;
  }
  const candSet = new Set(candidates);
  const skip = new Set(st.skip ?? []);
  const testable = candidates.filter((c) => c !== bad && !skip.has(c));
  if (!testable.length) {
    ctx.error(
      [
        "There are only 'skip'ped commits left to test.",
        "The first bad commit could be any of:",
        ...candidates.filter((c) => c !== bad).sort((a, b) => repo.commits[a].seq - repo.commits[b].seq).map((c) => c),
        bad,
        "We cannot bisect more!",
      ],
      "Every commit left to check was skipped, so Git can't narrow it down further. The culprit is one of the commits listed.",
    );
    return false;
  }
  let best = testable[0];
  let bestScore = -1;
  let bestReach = 0;
  for (const c of testable) {
    let reaches = 0;
    for (const a of ancestors(repo, c)) if (candSet.has(a)) reaches++;
    const score = Math.min(reaches, all - reaches);
    if (score > bestScore || (score === bestScore && repo.commits[c].seq < repo.commits[best].seq)) {
      best = c;
      bestScore = score;
      bestReach = reaches;
    }
  }
  const left = all - bestReach - 1;
  const steps = estimateSteps(all);
  detachAt(ctx, repo, best);
  ctx.out(
    `Bisecting: ${left} ${plural(left, "revision", "revisions")} left to test after this (roughly ${steps} ${plural(steps, "step", "steps")})`,
  );
  ctx.out(describe(repo, best), "commit");
  return false;
}

function bisectReset(ctx: Ctx, repo: Repo, target?: string) {
  const st = repo.bisect;
  if (!st) {
    ctx.out("We are not bisecting.");
    return;
  }
  const dest = target ?? st.orig;
  const wasDetached = repo.head.kind === "detached" ? repo.head.commit : null;
  if (repo.branches[dest] !== undefined) {
    if (currentBranch(repo) !== dest) {
      const from = currentBranch(repo) ?? headCommitId(repo);
      const fromLabel = currentBranch(repo) ?? shortId(headCommitId(repo) ?? "");
      switchTrees(ctx, repo, repo.commits[repo.branches[dest]].tree);
      repo.head = { kind: "branch", name: dest };
      addReflog(repo, repo.branches[dest], `checkout: moving from ${fromLabel} to ${dest}`);
      if (wasDetached) ctx.out(`Previous HEAD position was ${shortId(wasDetached)} ${oneLine(repo.commits[wasDetached])}`);
      ctx.out(`Switched to branch '${dest}'`, "success");
      ctx.emit({ type: "checkout", from, to: dest, detached: false });
    }
  } else {
    const id = resolveRev(repo, dest);
    if (!id) fail(`error: could not check out original HEAD '${dest}'. Try 'git bisect reset <commit>'.`);
    if (headCommitId(repo) !== id || repo.head.kind !== "detached") {
      detachAt(ctx, repo, id);
      if (wasDetached && wasDetached !== id) ctx.out(`Previous HEAD position was ${shortId(wasDetached)} ${oneLine(repo.commits[wasDetached])}`);
      ctx.out(`HEAD is now at ${shortId(id)} ${oneLine(repo.commits[id])}`);
    }
  }
  repo.bisect = null;
}

/** Quote an argument for re-parsing by the simulator's shell. */
function shellQuote(a: string) {
  return /^[\w./:=@%+-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;
}

function bisectRun(ctx: Ctx, repo: Repo, st: BisectState, cmd: string[]) {
  if (!cmd.length) fail("error: bisect run failed: no command provided.", "Give the command that tests a commit, e.g. git bisect run npm test. Exit status 0 means good, anything else means bad.");
  if (!st.bad || !st.good.length)
    fail(
      ["You need to give me at least one good and one bad revision.", '(You can use "git bisect bad" and "git bisect good" for that.)'],
      "git bisect run needs a starting range: mark one commit with the bug (git bisect bad) and one without it (git bisect good <commit>) first.",
    );
  const line = cmd.map(shellQuote).join(" ");
  for (let guard = 0; guard < 64; guard++) {
    if (st.found) break;
    ctx.out(`running '${line}'`, "muted");
    const r = execute(ctx.world, line);
    for (const l of r.lines) ctx.out(l.text, l.kind);
    const head = headCommitId(repo)!;
    mark(repo, st, r.ok ? "good" : "bad", head);
    if (bisectNext(ctx, repo, st)) {
      ctx.out("bisect found first bad commit", "success");
      return;
    }
    if (!ctx.ok) return;
  }
}

/** `git bisect`: binary search through history for the commit that introduced a bug. */
export function gitBisect(ctx: Ctx, args: string[]): void {
  const repo = requireRepo(ctx);
  const [sub, ...rest] = args;
  const revs = rest.filter((a) => !a.startsWith("-"));
  switch (sub) {
    case "start": {
      const head = headCommitId(repo);
      if (!head) fail("fatal: bad HEAD - I need a HEAD", "There are no commits yet, so there is no history to search. Make some commits first.");
      if (repo.op) fail(`error: You are in the middle of a ${repo.op.kind}.`, `Finish or abort the ${repo.op.kind} before starting a bisect.`);
      if (repo.bisect) bisectReset(new Ctx(ctx.world), repo); // restarting: quietly go back first
      const dash = rest.indexOf("--");
      const positional = (dash === -1 ? rest : rest.slice(0, dash)).filter((a) => !a.startsWith("-"));
      const ids = positional.map((r) => resolveOrFail(repo, r));
      const st: BisectState = { orig: currentBranch(repo) ?? headCommitId(repo)!, bad: null, good: [], skip: [], log: ["git bisect start"] };
      repo.bisect = st;
      if (ids[0]) mark(repo, st, "bad", ids[0]);
      for (const g of ids.slice(1)) mark(repo, st, "good", g);
      bisectNext(ctx, repo, st);
      return;
    }
    case "bad":
    case "new":
    case "good":
    case "old":
    case "skip": {
      const st = requireBisect(ctx, repo);
      const kind = sub === "new" ? "bad" : sub === "old" ? "good" : sub;
      if (kind === "bad" && revs.length > 1) fail("error: 'git bisect bad' can take only one argument.");
      const ids = (revs.length ? revs : ["HEAD"]).map((r) => resolveOrFail(repo, r));
      for (const id of ids) mark(repo, st, kind, id);
      bisectNext(ctx, repo, st);
      return;
    }
    case "reset":
      bisectReset(ctx, repo, revs[0]);
      return;
    case "log": {
      if (!repo.bisect) fail(["We are not bisecting."], NOT_BISECTING_EXPLAIN);
      ctx.out(repo.bisect.log ?? []);
      return;
    }
    case "run": {
      const st = requireBisect(ctx, repo);
      bisectRun(ctx, repo, st, rest);
      return;
    }
    case undefined:
    case "help":
      ctx.out(
        [
          "usage: git bisect [help|start|bad|good|new|old|skip|reset|log|run]",
          "",
          "git bisect start [<bad> [<good>...]]   reset bisect state and start bisection",
          "git bisect (bad|new) [<rev>]           mark <rev> as bad (has the bug)",
          "git bisect (good|old) [<rev>...]       mark <rev>... as good (no bug yet)",
          "git bisect skip [<rev>...]             can't test this one, pick another",
          "git bisect reset [<commit>]            finish bisecting, go back to where you started",
          "git bisect log                         show what you marked so far",
          "git bisect run <cmd>...                let a command decide good/bad automatically",
        ],
        sub ? "out" : "muted",
      );
      if (!sub) ctx.ok = false;
      return;
    default:
      fail(
        [`error: unknown command: '${sub}'`, "usage: git bisect [help|start|bad|good|new|old|skip|reset|log|run]"],
        "git bisect works in steps: start, then mark commits good or bad until Git finds the culprit, then reset.",
      );
  }
}

// ---------------------------------------------------------------------------
// git check-ignore
// ---------------------------------------------------------------------------

/** `git check-ignore [-v] [-q] [-n] [--no-index] <path>...` */
export function gitCheckIgnore(ctx: Ctx, args: string[]): void {
  const repo = requireRepo(ctx);
  let verbose = false;
  let quiet = false;
  let nonMatching = false;
  let noIndex = false;
  const paths: string[] = [];
  for (const a of args) {
    if (a === "-v" || a === "--verbose") verbose = true;
    else if (a === "-q" || a === "--quiet") quiet = true;
    else if (a === "-n" || a === "--non-matching") nonMatching = true;
    else if (a === "--no-index") noIndex = true;
    else if (a.startsWith("-")) fail(`error: unknown option \`${a.replace(/^-+/, "")}'`);
    else paths.push(a);
  }
  if (!paths.length)
    fail("fatal: no path specified", "Name the file to check, e.g. git check-ignore -v debug.log. Git tells you which .gitignore line ignores it.");
  const rules = ignoreRules(ctx.world.workdir);
  const workdir = ctx.world.workdir;
  let ignored = 0;
  for (const raw of paths) {
    const p = raw.replace(/^\.\//, "").replace(/\/+$/, "");
    const isDir = raw.endsWith("/") || (!(p in workdir) && Object.keys(workdir).some((k) => k.startsWith(p + "/")));
    const tracked = !noIndex && p in repo.index;
    let m = tracked ? null : matchIgnore(rules, p, isDir);
    if (m && m.rule.negate && !verbose) m = null;
    if (m) {
      ignored++;
      if (!quiet) ctx.out(verbose ? `.gitignore:${m.rule.line}:${m.rule.source}\t${raw}` : raw);
    } else if (nonMatching && verbose && !quiet) ctx.out(`::\t${raw}`);
  }
  if (!ignored) ctx.ok = false;
}
