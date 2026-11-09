import type { HostedRepo, PullRequest, World, WorkflowRun } from "@/engine";

/** The hosted repository the current repo pushes to: origin first, then any other remote. */
export function hostedFor(world: World): { remote: string; host: HostedRepo } | null {
  const remotes = world.repo?.remotes ?? {};
  const names = Object.keys(remotes).sort((a, b) => (a === "origin" ? -1 : b === "origin" ? 1 : a.localeCompare(b)));
  for (const name of names) {
    const host = world.hosted[remotes[name]];
    if (host) return { remote: name, host };
  }
  return null;
}

/** True when the hosted repo carries any GitHub-only data (PRs, issues, runs, releases…). */
export function hasGitHubData(host: HostedRepo | undefined | null): boolean {
  if (!host) return false;
  return !!(
    host.pulls?.length ||
    host.issues?.length ||
    host.runs?.length ||
    host.releases?.length ||
    Object.keys(host.secrets ?? {}).length ||
    Object.keys(host.protection ?? {}).length
  );
}

export type ChecksState = "none" | "success" | "failure";

/** The most recent workflow run on a commit (runs are appended in order). */
export function latestRunFor(host: HostedRepo, commit: string): WorkflowRun | undefined {
  const runs = host.runs ?? [];
  for (let i = runs.length - 1; i >= 0; i--) if (runs[i].commit === commit) return runs[i];
  return undefined;
}

export function checksState(host: HostedRepo, pr: PullRequest): ChecksState {
  return latestRunFor(host, pr.headCommit)?.status ?? "none";
}

export interface ReviewSummary {
  approvedBy: string[];
  changesRequestedBy: string[];
  commentedBy: string[];
}

/** Each reviewer's latest verdict counts (a later approval replaces an earlier "changes requested"). */
export function reviewSummary(pr: PullRequest): ReviewSummary {
  const latest = new Map<string, PullRequest["reviews"][number]["state"]>();
  for (const r of pr.reviews) {
    if (r.author === pr.author) continue;
    const prev = latest.get(r.author);
    // A plain comment does not cancel an earlier approval or change request.
    if (r.state === "commented" && prev && prev !== "commented") continue;
    latest.set(r.author, r.state);
  }
  const by = (s: string) => [...latest].filter(([, v]) => v === s).map(([a]) => a);
  return { approvedBy: by("approved"), changesRequestedBy: by("changes_requested"), commentedBy: by("commented") };
}

export type MergeBlocker =
  | { kind: "approvals"; have: number; need: number }
  | { kind: "changesRequested"; by: string[] }
  | { kind: "checksFailing"; checks: string[] }
  | { kind: "checksPending"; checks: string[] };

/** Status of one required check: the latest pull_request run on the PR's head commit that ran that job. */
export function checkStatus(host: HostedRepo, pr: PullRequest, job: string): "pass" | "fail" | "missing" {
  const runs = (host.runs ?? []).filter((r) => r.event === "pull_request" && r.commit === pr.headCommit && r.jobs.some((j) => j.name === job));
  const last = runs[runs.length - 1];
  if (!last) return "missing";
  return last.jobs.find((j) => j.name === job)!.ok ? "pass" : "fail";
}

/**
 * What stops an open PR from being merged (mirrors `gh pr merge` in the engine). Empty = mergeable.
 * A change request always blocks; approvals and checks only count when the base branch is protected.
 */
export function mergeBlockers(host: HostedRepo, pr: PullRequest): MergeBlocker[] {
  if (pr.state !== "open") return [];
  const rule = host.protection?.[pr.base];
  const out: MergeBlocker[] = [];
  const reviews = reviewSummary(pr);
  if (reviews.changesRequestedBy.length) out.push({ kind: "changesRequested", by: reviews.changesRequestedBy });
  if (!rule) return out;
  if (reviews.approvedBy.length < rule.requiredApprovals) out.push({ kind: "approvals", have: reviews.approvedBy.length, need: rule.requiredApprovals });
  const status = rule.requiredChecks.map((c) => [c, checkStatus(host, pr, c)] as const);
  const failing = status.filter(([, s]) => s === "fail").map(([c]) => c);
  const pending = status.filter(([, s]) => s === "missing").map(([c]) => c);
  if (failing.length) out.push({ kind: "checksFailing", checks: failing });
  if (pending.length) out.push({ kind: "checksPending", checks: pending });
  return out;
}

/** Open PRs first (newest first), then merged/closed (newest first). */
export function sortPulls(pulls: PullRequest[]): { open: PullRequest[]; done: PullRequest[] } {
  const byNewest = (a: PullRequest, b: PullRequest) => b.number - a.number;
  return {
    open: pulls.filter((p) => p.state === "open").sort(byNewest),
    done: pulls.filter((p) => p.state !== "open").sort(byNewest),
  };
}

/** Newest runs first, at most `max`. */
export function recentRuns(host: HostedRepo, max = 5): WorkflowRun[] {
  return [...(host.runs ?? [])].sort((a, b) => b.id - a.id).slice(0, max);
}
