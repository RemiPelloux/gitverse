import { CommandError, Ctx, fail } from "../context";
import { hunks, merge3, splitLines } from "../diff";
import { shortId } from "../hash";
import {
  addReflog,
  currentBranch,
  headCommitId,
  headTree,
  makeCommit,
  sameTree,
} from "../repo";
import type { Commit, FileMap, Repo, World } from "../types";

export const PROJECT_PATH = "/home/you/project";

export function requireRepo(ctx: Ctx): Repo {
  const repo = ctx.world.repo;
  if (!repo)
    fail(
      "fatal: not a git repository (or any of the parent directories): .git",
      "This folder isn't a Git repository yet, so Git has nowhere to record history. Run `git init` first to create one.",
    );
  return repo;
}

/** Match pathspecs ("." / dir / exact / *.ext) against candidate paths. */
export function matchPaths(spec: string, candidates: Iterable<string>): string[] {
  const all = [...new Set(candidates)];
  const clean = spec.replace(/^\.\//, "").replace(/\/$/, "");
  if (spec === "." || spec === "*" || spec === ":/") return all.sort();
  if (clean.includes("*")) {
    const re = new RegExp(
      "^" + clean.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$",
    );
    return all.filter((p) => re.test(p) || re.test(p.split("/").pop()!)).sort();
  }
  return all.filter((p) => p === clean || p.startsWith(clean + "/")).sort();
}

export function oneLine(c: Commit) {
  return c.message.split("\n")[0];
}

export function describeCommit(c: Commit) {
  return `${shortId(c.id)} ${oneLine(c)}`;
}

export function countLines(oldText: string | undefined, newText: string | undefined) {
  let ins = 0;
  let del = 0;
  for (const h of hunks(oldText ?? "", newText ?? "", 0)) {
    for (const l of h.lines) {
      if (l.op === "add") ins++;
      else if (l.op === "del") del++;
    }
  }
  return { ins, del };
}

/** Git-style diffstat between two trees. */
export function diffStat(from: FileMap, to: FileMap, withModes = false): string[] {
  const paths = [...new Set([...Object.keys(from), ...Object.keys(to)])]
    .filter((p) => from[p] !== to[p])
    .sort();
  if (!paths.length) return [];
  const width = Math.max(...paths.map((p) => p.length));
  let ti = 0;
  let td = 0;
  const lines = paths.map((p) => {
    const { ins, del } = countLines(from[p], to[p]);
    ti += ins;
    td += del;
    return ` ${p.padEnd(width)} | ${String(ins + del).padStart(2)} ${"+".repeat(Math.min(ins, 20))}${"-".repeat(Math.min(del, 20))}`;
  });
  const parts = [`${paths.length} file${paths.length === 1 ? "" : "s"} changed`];
  if (ti) parts.push(`${ti} insertion${ti === 1 ? "" : "s"}(+)`);
  if (td) parts.push(`${td} deletion${td === 1 ? "" : "s"}(-)`);
  if (!ti && !td) parts.push("0 insertions(+), 0 deletions(-)");
  lines.push(" " + parts.join(", "));
  if (withModes) {
    for (const p of paths) {
      if (!(p in from)) lines.push(` create mode 100644 ${p}`);
      else if (!(p in to)) lines.push(` delete mode 100644 ${p}`);
    }
  }
  return lines;
}

/** Print a unified diff between two trees into ctx. */
export function printTreeDiff(ctx: Ctx, from: FileMap, to: FileMap, paths?: string[]) {
  const all = paths ?? [...new Set([...Object.keys(from), ...Object.keys(to)])].sort();
  for (const p of all) {
    const a = from[p];
    const b = to[p];
    if (a === b) continue;
    ctx.out(`diff --git a/${p} b/${p}`, "hunk");
    if (a === undefined) ctx.out("new file mode 100644", "muted");
    if (b === undefined) ctx.out("deleted file mode 100644", "muted");
    ctx.out(a === undefined ? "--- /dev/null" : `--- a/${p}`, "muted");
    ctx.out(b === undefined ? "+++ /dev/null" : `+++ b/${p}`, "muted");
    for (const h of hunks(a ?? "", b ?? "")) {
      ctx.out(h.header, "hunk");
      for (const l of h.lines) {
        if (l.op === "add") ctx.out("+" + l.line, "added");
        else if (l.op === "del") ctx.out("-" + l.line, "removed");
        else ctx.out(" " + l.line, "out");
      }
    }
  }
}

export interface TreeMergeResult {
  tree: FileMap;
  /** Workdir content (conflicting files contain markers). */
  work: FileMap;
  conflicts: string[];
  messages: string[];
}

/** Three-way merge of whole snapshots. */
export function mergeTrees(
  base: FileMap,
  ours: FileMap,
  theirs: FileMap,
  oursLabel: string,
  theirsLabel: string,
): TreeMergeResult {
  const tree: FileMap = {};
  const work: FileMap = {};
  const conflicts: string[] = [];
  const messages: string[] = [];
  const paths = [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])].sort();
  for (const p of paths) {
    const b = base[p];
    const o = ours[p];
    const t = theirs[p];
    let result: string | undefined;
    if (o === t) result = o;
    else if (b === o) result = t;
    else if (b === t) result = o;
    else if (o !== undefined && t !== undefined) {
      messages.push(`Auto-merging ${p}`);
      const m = merge3(b ?? "", o, t, oursLabel, theirsLabel);
      if (m.clean) result = m.text;
      else {
        conflicts.push(p);
        messages.push(`CONFLICT (${b === undefined ? "add/add" : "content"}): Merge conflict in ${p}`);
        tree[p] = o; // index keeps "our" side until resolved
        work[p] = m.text;
        continue;
      }
    } else {
      // modify/delete
      conflicts.push(p);
      const deletedIn = o === undefined ? oursLabel : theirsLabel;
      const modifiedIn = o === undefined ? theirsLabel : oursLabel;
      messages.push(
        `CONFLICT (modify/delete): ${p} deleted in ${deletedIn} and modified in ${modifiedIn}. Version ${modifiedIn} of ${p} left in tree.`,
      );
      const kept = (o ?? t)!;
      tree[p] = kept;
      work[p] = kept;
      continue;
    }
    if (result !== undefined) {
      tree[p] = result;
      work[p] = result;
    }
  }
  return { tree, work, conflicts, messages };
}

/** Paths with local (uncommitted) changes to tracked files. */
export function dirtyTrackedPaths(world: World, repo: Repo): string[] {
  const head = headTree(repo);
  const paths = new Set([...Object.keys(head), ...Object.keys(repo.index)]);
  return [...paths].filter((p) => head[p] !== repo.index[p] || repo.index[p] !== world.workdir[p]).sort();
}

/**
 * Move HEAD's working tree + index to `target` the way `git switch` does:
 * local modifications are carried over unless they would be overwritten.
 */
export function switchTrees(ctx: Ctx, repo: Repo, target: FileMap) {
  const world = ctx.world;
  const head = headTree(repo);
  const changed = [...new Set([...Object.keys(head), ...Object.keys(target)])].filter(
    (p) => head[p] !== target[p],
  );
  const blocked = changed.filter(
    (p) => repo.index[p] !== head[p] || (p in head && world.workdir[p] !== head[p]),
  );
  if (blocked.length)
    fail(
      [
        "error: Your local changes to the following files would be overwritten by checkout:",
        ...blocked.map((p) => `\t${p}`),
        "Please commit your changes or stash them before you switch branches.",
        "Aborting",
      ],
      "You have uncommitted edits to files that are different on the other branch. Switching would erase them, so Git stops. Commit your work (git add + git commit) or put it aside with git stash, then switch.",
    );
  const untracked = changed.filter(
    (p) => !(p in head) && !(p in repo.index) && p in world.workdir && world.workdir[p] !== target[p],
  );
  if (untracked.length)
    fail(
      [
        "error: The following untracked working tree files would be overwritten by checkout:",
        ...untracked.map((p) => `\t${p}`),
        "Please move or remove them before you switch branches.",
        "Aborting",
      ],
      "A file you never added to Git has the same name as a file on the other branch. Git won't overwrite it. Rename, delete, or commit it first.",
    );
  for (const p of changed) {
    if (p in target) {
      repo.index[p] = target[p];
      world.workdir[p] = target[p];
    } else {
      delete repo.index[p];
      delete world.workdir[p];
    }
  }
}

/** Reset index and tracked working files to exactly `tree` (like --hard). */
export function hardReset(world: World, repo: Repo, tree: FileMap) {
  const head = headTree(repo);
  for (const p of new Set([...Object.keys(head), ...Object.keys(repo.index)])) {
    if (!(p in tree)) delete world.workdir[p];
  }
  repo.index = { ...tree };
  for (const [p, c] of Object.entries(tree)) world.workdir[p] = c;
}

/** Point HEAD (branch or detached) at a commit, and log it. */
export function moveHead(repo: Repo, id: string, reflogMsg: string) {
  if (repo.head.kind === "branch") repo.branches[repo.head.name] = id;
  else repo.head = { kind: "detached", commit: id };
  addReflog(repo, id, reflogMsg);
}

export function commitWith(
  ctx: Ctx,
  repo: Repo,
  tree: FileMap,
  parents: string[],
  message: string,
  author?: string,
): Commit {
  const c = makeCommit(ctx.world, repo, tree, parents, message, author);
  return c;
}

export function branchLabel(repo: Repo): string {
  const b = currentBranch(repo);
  if (b) return b;
  const id = headCommitId(repo);
  return id ? `HEAD detached at ${shortId(id)}` : "HEAD";
}

export function isStagedEmpty(repo: Repo) {
  return sameTree(repo.index, headTree(repo));
}

export function splitTrailing<T>(arr: T[], pred: (v: T) => boolean): [T[], T[]] {
  const i = arr.findIndex(pred);
  return i === -1 ? [arr, []] : [arr.slice(0, i), arr.slice(i + 1)];
}

export { CommandError, splitLines };
