import { objectId } from "./hash";
import { ignoreRules, isIgnoredPath } from "./ignore";
import type { Commit, FileMap, Repo, World } from "./types";

export const DEFAULT_BRANCH = "main";

export function emptyWorld(files: FileMap = {}): World {
  return {
    version: 1,
    workdir: { ...files },
    repo: null,
    hosted: {},
    hostedCommits: {},
    clock: 1_700_000_000,
    seq: 0,
    user: { name: "You", email: "you@gitverse.dev" },
  };
}

export function newRepo(): Repo {
  return {
    commits: {},
    branches: {},
    branchOrder: [DEFAULT_BRANCH],
    tags: {},
    head: { kind: "branch", name: DEFAULT_BRANCH },
    index: {},
    reflog: [],
    op: null,
    stash: [],
    remotes: {},
    remoteRefs: {},
    upstream: {},
  };
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

export function headCommitId(repo: Repo): string | null {
  return repo.head.kind === "branch" ? (repo.branches[repo.head.name] ?? null) : repo.head.commit;
}

export function headCommit(repo: Repo): Commit | null {
  const id = headCommitId(repo);
  return id ? repo.commits[id] : null;
}

export function headTree(repo: Repo): FileMap {
  return headCommit(repo)?.tree ?? {};
}

export function currentBranch(repo: Repo): string | null {
  return repo.head.kind === "branch" ? repo.head.name : null;
}

export function sameTree(a: FileMap, b: FileMap): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => k in b && a[k] === b[k]);
}

export function makeCommit(
  world: World,
  repo: Repo,
  tree: FileMap,
  parents: string[],
  message: string,
  author?: string,
): Commit {
  world.clock += 60 + (world.seq % 7) * 13;
  world.seq += 1;
  const who = author ?? world.user.name;
  const payload = JSON.stringify([tree, parents, message, who, world.clock]);
  const commit: Commit = {
    id: objectId(payload),
    tree: { ...tree },
    parents,
    message,
    author: who,
    time: world.clock,
    seq: world.seq,
  };
  repo.commits[commit.id] = commit;
  return commit;
}

/** All ancestors of `id` including itself. */
export function ancestors(repo: Repo, id: string, store: Record<string, Commit> = repo.commits): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const c = stack.pop()!;
    if (seen.has(c)) continue;
    seen.add(c);
    const commit = store[c];
    if (commit) stack.push(...commit.parents);
  }
  return seen;
}

export function isAncestor(repo: Repo, maybeAncestor: string, of: string): boolean {
  return ancestors(repo, of).has(maybeAncestor);
}

/** Best common ancestor (the most recent one by creation order). */
export function mergeBase(repo: Repo, a: string, b: string): string | null {
  const aa = ancestors(repo, a);
  const bb = ancestors(repo, b);
  let best: Commit | null = null;
  for (const id of aa) {
    if (!bb.has(id)) continue;
    const c = repo.commits[id];
    if (!best || c.seq > best.seq) best = c;
  }
  return best?.id ?? null;
}

/**
 * Resolve a revision: branch, tag, remote ref, HEAD, (abbreviated) hash,
 * with ~N and ^ suffixes.
 */
export function resolveRev(repo: Repo, rev: string): string | null {
  const m = /^(.+?)((?:[~^]\d*)*)$/.exec(rev);
  if (!m) return null;
  const [, base, suffix] = m;
  let id: string | null = null;
  if (base === "HEAD" || base === "@") id = headCommitId(repo);
  else if (base === "ORIG_HEAD") id = repo.origHead ?? null;
  else if (base === "MERGE_HEAD") id = repo.op?.kind === "merge" ? repo.op.theirs : null;
  else if (base === "CHERRY_PICK_HEAD") id = repo.op?.kind === "cherry-pick" ? repo.op.theirs : null;
  else if (base === "REVERT_HEAD") id = repo.op?.kind === "revert" ? repo.op.theirs : null;
  else if (repo.branches[base]) id = repo.branches[base];
  else if (repo.tags[base]) id = repo.tags[base];
  else if (repo.remoteRefs[base]) id = repo.remoteRefs[base];
  else if (/^[0-9a-f]{4,40}$/.test(base)) {
    const matches = Object.keys(repo.commits).filter((c) => c.startsWith(base));
    if (matches.length === 1) id = matches[0];
  } else {
    const reflog = /^HEAD@\{(\d+)\}$/.exec(base);
    if (reflog) id = repo.reflog[repo.reflog.length - 1 - Number(reflog[1])]?.commit ?? null;
  }
  if (!id) return null;
  const steps = suffix.match(/[~^]\d*/g) ?? [];
  for (const step of steps) {
    const n = step.length > 1 ? Number(step.slice(1)) : 1;
    if (step[0] === "~") {
      for (let k = 0; k < n; k++) {
        id = repo.commits[id!]?.parents[0] ?? null;
        if (!id) return null;
      }
    } else {
      id = n === 0 ? id : (repo.commits[id!]?.parents[n - 1] ?? null);
      if (!id) return null;
    }
  }
  return id;
}

export interface StatusEntry {
  path: string;
  staged: "added" | "modified" | "deleted" | null;
  unstaged: "modified" | "deleted" | null;
  untracked: boolean;
  conflicted: boolean;
  /**
   * Untracked file matched by `.gitignore`. Only reported when
   * `status(world, { ignored: true })` is asked for (like `git status --ignored`);
   * such entries have `untracked: false`.
   */
  ignored?: boolean;
}

/**
 * Working-tree status. Untracked files matched by `.gitignore` are left out
 * (they are invisible to Git), unless `opts.ignored` is set, in which case
 * they are reported with `ignored: true` and `untracked: false`.
 */
export function status(world: World, opts: { ignored?: boolean } = {}): StatusEntry[] {
  const repo = world.repo;
  if (!repo) return [];
  const head = headTree(repo);
  const rules = ignoreRules(world.workdir);
  const paths = new Set([...Object.keys(head), ...Object.keys(repo.index), ...Object.keys(world.workdir)]);
  const out: StatusEntry[] = [];
  for (const path of [...paths].sort()) {
    const inHead = path in head;
    const inIndex = path in repo.index;
    const inWork = path in world.workdir;
    const conflicted = repo.op?.conflicts.includes(path) ?? false;
    let staged: StatusEntry["staged"] = null;
    if (inIndex && !inHead) staged = "added";
    else if (!inIndex && inHead) staged = "deleted";
    else if (inIndex && inHead && repo.index[path] !== head[path]) staged = "modified";
    let unstaged: StatusEntry["unstaged"] = null;
    let untracked = inWork && !inIndex;
    if (untracked && !inHead && rules.length && isIgnoredPath(rules, path)) {
      if (opts.ignored) out.push({ path, staged: null, unstaged: null, untracked: false, conflicted: false, ignored: true });
      continue;
    }
    // deleted from the index but still on disk and ignored (after `git rm --cached`): untracked, unless ignored
    if (untracked && inHead && rules.length && isIgnoredPath(rules, path)) untracked = false;
    if (inIndex && !inWork) unstaged = "deleted";
    else if (inIndex && inWork && repo.index[path] !== world.workdir[path]) unstaged = "modified";
    if (staged || unstaged || untracked || conflicted) {
      out.push({ path, staged, unstaged, untracked, conflicted });
    }
  }
  return out;
}

export function isClean(world: World): boolean {
  return status(world).length === 0;
}

/** Remove workdir files that were tracked in `from` but not in `to`, write files of `to`. */
export function checkoutTree(world: World, from: FileMap, to: FileMap) {
  for (const p of Object.keys(from)) {
    if (!(p in to)) delete world.workdir[p];
  }
  for (const [p, c] of Object.entries(to)) world.workdir[p] = c;
}

export function addReflog(repo: Repo, commit: string, message: string) {
  repo.reflog.push({ commit, message });
}

export function relTime(world: World, t: number): string {
  const diff = Math.max(0, world.clock - t);
  if (diff < 90) return "just now";
  const min = Math.round(diff / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.round(min / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

/** Commits reachable from any ref (branches, tags, remote refs, HEAD). */
export function reachable(repo: Repo): Set<string> {
  const tips = [
    ...Object.values(repo.branches),
    ...Object.values(repo.tags),
    ...Object.values(repo.remoteRefs),
    ...repo.stash.map((s) => s.base),
  ];
  const h = headCommitId(repo);
  if (h) tips.push(h);
  if (repo.op) tips.push(repo.op.theirs);
  const all = new Set<string>();
  for (const t of tips) for (const a of ancestors(repo, t)) all.add(a);
  return all;
}

export function validBranchName(name: string): boolean {
  return (
    /^[A-Za-z0-9._/-]+$/.test(name) &&
    !name.startsWith("-") &&
    !name.startsWith("/") &&
    !name.endsWith("/") &&
    !name.endsWith(".") &&
    !name.includes("..") &&
    !name.includes("//") &&
    name !== "HEAD"
  );
}
