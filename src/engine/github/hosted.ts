/**
 * Server-side behaviour of the simulated GitHub: commits created by GitHub
 * itself (merge buttons), pull request bookkeeping, closing keywords and the
 * hooks that run when a branch moves on GitHub.
 */
import { objectId, shortId } from "../hash";
import type { Commit, FileMap, HostedRepo, PullRequest, World } from "../types";
import { triggerRuns } from "./actions";

export const webUrl = (host: HostedRepo) => `https://github.com/${host.owner}/${host.name}`;
export const slug = (host: HostedRepo) => `${host.owner}/${host.name}`;

/** All ancestors of `id` (inclusive) in the hosted object store. */
export function hostedAncestors(world: World, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const c = stack.pop()!;
    if (seen.has(c)) continue;
    seen.add(c);
    const commit = world.hostedCommits[c];
    if (commit) stack.push(...commit.parents);
  }
  return seen;
}

export function hostedMergeBase(world: World, a: string, b: string): string | null {
  const aa = hostedAncestors(world, a);
  let best: Commit | null = null;
  for (const id of hostedAncestors(world, b)) {
    if (!aa.has(id)) continue;
    const c = world.hostedCommits[id];
    if (c && (!best || c.seq > best.seq)) best = c;
  }
  return best?.id ?? null;
}

/** Commits reachable from `tip` but not from `exclude`, oldest first. */
export function hostedCommitsBetween(world: World, exclude: string | undefined, tip: string): Commit[] {
  const skip = exclude ? hostedAncestors(world, exclude) : new Set<string>();
  return [...hostedAncestors(world, tip)]
    .filter((id) => !skip.has(id) && world.hostedCommits[id])
    .map((id) => world.hostedCommits[id])
    .sort((x, y) => x.seq - y.seq);
}

/** A commit created on GitHub's side (merge button). Mirrors repo.makeCommit. */
export function makeHostedCommit(world: World, tree: FileMap, parents: string[], message: string, author: string): Commit {
  world.clock += 60 + (world.seq % 7) * 13;
  world.seq += 1;
  const commit: Commit = {
    id: objectId(JSON.stringify([tree, parents, message, author, world.clock])),
    tree: { ...tree },
    parents,
    message,
    author,
    time: world.clock,
    seq: world.seq,
  };
  world.hostedCommits[commit.id] = commit;
  return commit;
}

/** Issue numbers referenced by closing keywords ("fixes #3", "Closes #12"). */
export function closingRefs(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi)) {
    const n = Number(m[1]);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Close the open issues referenced in `text`. Returns the closed numbers. */
export function closeIssuesFrom(host: HostedRepo, text: string, closedBy: string): number[] {
  const closed: number[] = [];
  for (const n of closingRefs(text)) {
    const issue = host.issues?.find((i) => i.number === n);
    if (issue && issue.state === "open") {
      issue.state = "closed";
      issue.closedBy = closedBy;
      closed.push(n);
    }
  }
  return closed;
}

export function nextNumber(host: HostedRepo): number {
  const used = [...(host.pulls ?? []), ...(host.issues ?? [])].map((x) => x.number);
  const n = Math.max(host.nextNumber ?? 1, used.length ? Math.max(...used) + 1 : 1);
  host.nextNumber = n + 1;
  return n;
}

/** Latest decisive review (approve / request changes) per reviewer, excluding the author. */
export function reviewVerdicts(pr: PullRequest): Map<string, "approved" | "changes_requested"> {
  const m = new Map<string, "approved" | "changes_requested">();
  for (const r of pr.reviews) {
    if (r.author === pr.author || r.state === "commented") continue;
    m.set(r.author, r.state);
  }
  return m;
}

const APPROVAL_BODIES = ["Looks good to me!", "Nice work, ship it.", "LGTM 👍"];

/** Simulated teammates approve (or re-approve after changes). Returns muted notes. */
export function autoReview(host: HostedRepo, pr: PullRequest, onlyIfChangesRequested: boolean): string[] {
  const notes: string[] = [];
  const verdicts = reviewVerdicts(pr);
  (host.autoReviewers ?? []).forEach((name, i) => {
    if (name === pr.author) return;
    if (onlyIfChangesRequested && verdicts.get(name) !== "changes_requested") return;
    pr.reviews.push({ author: name, state: "approved", body: APPROVAL_BODIES[(pr.number + i) % APPROVAL_BODIES.length] });
    notes.push(`${name} approved these changes`);
  });
  return notes;
}

/**
 * Hook: a branch on GitHub moved (by a push). Runs workflows, keeps pull
 * requests in sync, applies closing keywords. Returns muted notes for the terminal.
 */
export function onBranchPushed(world: World, host: HostedRepo, branch: string, oldId: string | undefined, newId: string): string[] {
  const notes: string[] = [];
  triggerRuns(world, host, { event: "push", branch, filterBranch: branch, commit: newId });
  if (branch === host.defaultBranch) {
    for (const c of hostedCommitsBetween(world, oldId, newId))
      for (const n of closeIssuesFrom(host, c.message, shortId(c.id))) notes.push(`remote: Closed issue #${n} (via ${shortId(c.id)})`);
  }
  for (const pr of host.pulls ?? []) {
    if (pr.state !== "open") continue;
    if (pr.head === branch && pr.headCommit !== newId) {
      pr.headCommit = newId;
      for (const n of autoReview(host, pr, true)) notes.push(`remote: ${n} (pull request #${pr.number})`);
      triggerRuns(world, host, { event: "pull_request", branch: pr.head, filterBranch: pr.base, commit: newId, pr: pr.number });
    } else if (pr.base === branch && hostedAncestors(world, newId).has(pr.headCommit)) {
      // The PR's commits landed on its base through a plain push: GitHub marks it merged.
      pr.state = "merged";
      pr.mergeCommit = newId;
      notes.push(`remote: Pull request #${pr.number} was merged by this push`);
    }
  }
  return notes;
}
