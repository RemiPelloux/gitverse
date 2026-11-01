import { Ctx, fail } from "../context";
import { shortId } from "../hash";
import {
  addReflog,
  ancestors,
  currentBranch,
  headCommit,
  headCommitId,
  headTree,
  isAncestor,
  makeCommit,
  mergeBase,
  resolveRev,
  sameTree,
  validBranchName,
} from "../repo";
import type { Repo } from "../types";
import { finishCommit } from "./basic";
import {
  describeCommit,
  diffStat,
  dirtyTrackedPaths,
  hardReset,
  matchPaths,
  mergeTrees,
  oneLine,
  requireRepo,
  switchTrees,
} from "./helpers";

function createBranch(ctx: Ctx, repo: Repo, name: string, start?: string, force = false) {
  if (!validBranchName(name))
    fail(`fatal: '${name}' is not a valid branch name`, "Branch names can use letters, numbers, dashes, dots and slashes (like feature/login), but no spaces.");
  if (repo.branches[name] && !force)
    fail(`fatal: a branch named '${name}' already exists`, `There's already a branch called ${name}. Switch to it with git switch ${name}, or pick another name.`);
  const id = resolveRev(repo, start ?? "HEAD");
  if (!id) {
    if (!start || start === "HEAD")
      fail(
        `fatal: not a valid object name: '${currentBranch(repo) ?? "HEAD"}'`,
        "A branch is a label that points at a commit — and there are no commits yet. Make your first commit, then create the branch.",
      );
    fail(`fatal: not a valid object name: '${start}'`);
  }
  repo.branches[name] = id;
  if (!repo.branchOrder.includes(name)) repo.branchOrder.push(name);
  ctx.emit({ type: "branch-create", name, at: id });
  return id;
}

export function gitBranch(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const flags = new Set(args.filter((a) => a.startsWith("-")));
  const pos = args.filter((a) => !a.startsWith("-"));
  const showAll = flags.has("-a") || flags.has("--all");
  const remoteOnly = flags.has("-r") || flags.has("--remotes");
  const verbose = flags.has("-v") || flags.has("-vv");

  // tracking: git branch -u <upstream> [branch] / --set-upstream-to=<upstream> / --unset-upstream
  const setTo = args.find((x) => x.startsWith("--set-upstream-to="));
  if (flags.has("-u") || flags.has("--set-upstream-to") || setTo) {
    const upstream = setTo ? setTo.split("=")[1] : pos[0];
    const target = (setTo ? pos[0] : pos[1]) ?? currentBranch(repo);
    if (!upstream) fail("fatal: option '--set-upstream-to' requires a value");
    if (!target) fail("fatal: could not set upstream of HEAD when it does not point to any branch.");
    if (!repo.branches[target]) fail(`fatal: branch '${target}' does not exist`);
    if (!repo.remoteRefs[upstream])
      fail(
        [`fatal: the requested upstream branch '${upstream}' does not exist`, "hint: If you are planning on basing your work on an upstream", "hint: branch that already exists at the remote, you may need to", "hint: run \"git fetch\" to retrieve it."],
        `Git doesn't know a remote branch called ${upstream}. Run git fetch first, or git branch -r to list remote branches.`,
      );
    repo.upstream[target] = upstream;
    ctx.out(`branch '${target}' set up to track '${upstream}'.`);
    return;
  }
  if (flags.has("--unset-upstream")) {
    const target = pos[0] ?? currentBranch(repo);
    if (!target || !repo.upstream[target]) fail(`fatal: branch '${target ?? "HEAD"}' has no upstream information`);
    delete repo.upstream[target];
    return;
  }
  if (flags.has("-d") || flags.has("-D") || flags.has("--delete")) {
    if (!pos.length) fail("fatal: branch name required");
    for (const name of pos) {
      if (!repo.branches[name]) fail(`error: branch '${name}' not found.`);
      if (currentBranch(repo) === name)
        fail(
          `error: cannot delete branch '${name}' used by worktree at '/home/you/project'`,
          "You can't delete the branch you're standing on. Switch to another branch first (e.g. git switch main).",
        );
      const head = headCommitId(repo);
      if (!flags.has("-D") && head && !isAncestor(repo, repo.branches[name], head)) {
        const up = repo.upstream[name];
        if (!(up && repo.remoteRefs[up] && isAncestor(repo, repo.branches[name], repo.remoteRefs[up])))
          fail(
            [`error: the branch '${name}' is not fully merged.`, `hint: If you are sure you want to delete it, run 'git branch -D ${name}'`],
            "This branch has commits that exist nowhere else. Deleting it would hide that work. Merge it first, or use -D if you really want to throw it away (you could still find it in git reflog).",
          );
      }
      ctx.out(`Deleted branch ${name} (was ${shortId(repo.branches[name])}).`);
      delete repo.branches[name];
      delete repo.upstream[name];
      repo.branchOrder = repo.branchOrder.filter((b) => b !== name);
      ctx.emit({ type: "branch-delete", name });
    }
    return;
  }
  if (flags.has("-m") || flags.has("-M") || flags.has("--move")) {
    const [a, b] = pos.length === 1 ? [currentBranch(repo), pos[0]] : pos;
    if (!a || !b) fail("fatal: branch name required");
    if (!validBranchName(b)) fail(`fatal: '${b}' is not a valid branch name`);
    if (repo.branches[b] && !flags.has("-M")) fail(`fatal: a branch named '${b}' already exists`);
    const isCurrent = currentBranch(repo) === a;
    if (!repo.branches[a] && !isCurrent) fail(`error: refname refs/heads/${a} not found`);
    if (repo.branches[a]) repo.branches[b] = repo.branches[a];
    delete repo.branches[a];
    repo.branchOrder = repo.branchOrder.map((x) => (x === a ? b : x));
    if (repo.upstream[a]) {
      repo.upstream[b] = repo.upstream[a];
      delete repo.upstream[a];
    }
    if (isCurrent) repo.head = { kind: "branch", name: b };
    ctx.emit({ type: "branch-create", name: b, at: repo.branches[b] ?? "" });
    return;
  }
  if (pos.length) {
    createBranch(ctx, repo, pos[0], pos[1], flags.has("-f"));
    return;
  }
  const lines: string[] = [];
  if (!remoteOnly) {
    if (repo.head.kind === "detached") lines.push(`* (HEAD detached at ${shortId(repo.head.commit)})`);
    for (const b of Object.keys(repo.branches).sort()) {
      const cur = currentBranch(repo) === b;
      let line = `${cur ? "*" : " "} ${b}`;
      if (verbose) {
        line += ` ${shortId(repo.branches[b])}`;
        const up = repo.upstream[b];
        if (up && flags.has("-vv")) line += ` [${trackingSummary(repo, b, up)}]`;
        line += ` ${oneLine(repo.commits[repo.branches[b]])}`;
      }
      lines.push(line);
    }
  }
  if (showAll || remoteOnly) for (const r of Object.keys(repo.remoteRefs).sort()) lines.push(`  ${showAll ? "remotes/" : ""}${r}`);
  for (const l of lines) ctx.out(l, l.startsWith("*") ? "success" : "out");
}

/** "origin/main: ahead 1, behind 2" style summary used by `git branch -vv`. */
function trackingSummary(repo: Repo, branch: string, up: string): string {
  const remote = repo.remoteRefs[up];
  if (!remote) return `${up}: gone`;
  const la = ancestors(repo, repo.branches[branch]);
  const ra = ancestors(repo, remote);
  const ahead = [...la].filter((c) => !ra.has(c)).length;
  const behind = [...ra].filter((c) => !la.has(c)).length;
  const parts = [ahead && `ahead ${ahead}`, behind && `behind ${behind}`].filter(Boolean);
  return parts.length ? `${up}: ${parts.join(", ")}` : up;
}

function switchToBranch(ctx: Ctx, repo: Repo, name: string) {
  const from = currentBranch(repo) ?? headCommitId(repo);
  if (currentBranch(repo) === name) {
    ctx.out(`Already on '${name}'`);
    return;
  }
  const target = repo.branches[name];
  switchTrees(ctx, repo, repo.commits[target]?.tree ?? {});
  const fromLabel = currentBranch(repo) ?? shortId(headCommitId(repo) ?? "");
  repo.head = { kind: "branch", name };
  addReflog(repo, target, `checkout: moving from ${fromLabel} to ${name}`);
  ctx.out(`Switched to branch '${name}'`, "success");
  const up = repo.upstream[name];
  if (up && repo.remoteRefs[up]) {
    if (repo.remoteRefs[up] === target) ctx.out(`Your branch is up to date with '${up}'.`);
  }
  ctx.emit({ type: "checkout", from, to: name, detached: false });
}

function detachTo(ctx: Ctx, repo: Repo, id: string, label: string, verbose: boolean) {
  const from = currentBranch(repo) ?? headCommitId(repo);
  switchTrees(ctx, repo, repo.commits[id].tree);
  const fromLabel = currentBranch(repo) ?? shortId(headCommitId(repo) ?? "");
  repo.head = { kind: "detached", commit: id };
  addReflog(repo, id, `checkout: moving from ${fromLabel} to ${label}`);
  if (verbose) {
    ctx.out(
      [
        `Note: switching to '${label}'.`,
        "",
        "You are in 'detached HEAD' state. You can look around, make experimental",
        "changes and commit them, and you can discard any commits you make in this",
        "state without impacting any branches by switching back to a branch.",
        "",
        "If you want to create a new branch to retain commits you create, you may",
        "do so (now or later) by using -c with the switch command. Example:",
        "",
        "  git switch -c <new-branch-name>",
        "",
      ],
      "warning",
    );
  }
  ctx.out(`HEAD is now at ${describeCommit(repo.commits[id])}`);
  ctx.emit({ type: "checkout", from, to: id, detached: true });
}

/** `git switch <branch>` when only origin/<branch> exists: create a tracking branch. */
function dwimRemote(ctx: Ctx, repo: Repo, name: string): boolean {
  const matches = Object.keys(repo.remoteRefs).filter((r) => r.split("/").slice(1).join("/") === name);
  if (matches.length !== 1) return false;
  const remote = matches[0];
  repo.branches[name] = repo.remoteRefs[remote];
  repo.branchOrder.push(name);
  repo.upstream[name] = remote;
  ctx.emit({ type: "branch-create", name, at: repo.branches[name] });
  const from = currentBranch(repo) ?? headCommitId(repo);
  switchTrees(ctx, repo, repo.commits[repo.branches[name]].tree);
  repo.head = { kind: "branch", name };
  addReflog(repo, repo.branches[name], `checkout: moving from ${from} to ${name}`);
  ctx.out(`branch '${name}' set up to track '${remote}'.`);
  ctx.out(`Switched to a new branch '${name}'`, "success");
  ctx.emit({ type: "checkout", from, to: name, detached: false });
  return true;
}

function newBranchAndSwitch(ctx: Ctx, repo: Repo, name: string, start: string | undefined) {
  if (repo.branches[name])
    fail(`fatal: a branch named '${name}' already exists`, `${name} already exists. To move onto it, run git switch ${name} (without -c).`);
  if (!headCommitId(repo) && !start) {
    // unborn branch: just rename HEAD
    if (!validBranchName(name)) fail(`fatal: '${name}' is not a valid branch name`);
    const old = currentBranch(repo);
    repo.head = { kind: "branch", name };
    repo.branchOrder = repo.branchOrder.map((b) => (b === old ? name : b));
    if (!repo.branchOrder.includes(name)) repo.branchOrder.push(name);
    ctx.out(`Switched to a new branch '${name}'`, "success");
    return;
  }
  const startId = resolveRev(repo, start ?? "HEAD");
  if (!startId) fail(`fatal: invalid reference: ${start}`);
  // validate the switch first so a failed checkout doesn't leave a branch behind
  const snapshot = structuredClone({ index: repo.index, work: ctx.world.workdir });
  switchTrees(ctx, repo, repo.commits[startId].tree);
  void snapshot;
  createBranch(ctx, repo, name, startId);
  const from = currentBranch(repo) ?? headCommitId(repo);
  repo.head = { kind: "branch", name };
  addReflog(repo, startId, `checkout: moving from ${from} to ${name}`);
  ctx.out(`Switched to a new branch '${name}'`, "success");
  ctx.emit({ type: "checkout", from, to: name, detached: false });
}

export function gitSwitch(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const create = args.find((a) => a === "-c" || a === "--create" || a === "-C");
  const detach = args.includes("--detach") || args.includes("-d");
  const pos = args.filter((a) => !a.startsWith("-") || a === "-");
  if (create) {
    if (!pos[0]) fail(`error: switch \`c' requires a value`);
    newBranchAndSwitch(ctx, repo, pos[0], pos[1]);
    return;
  }
  const target = pos[0];
  if (!target)
    fail("fatal: missing branch or commit argument", "Tell git switch where to go, e.g. git switch main. To create a new branch use git switch -c <name>.");
  if (target === "-") {
    const prev = [...repo.reflog].reverse().find((e) => e.message.startsWith("checkout: moving from "));
    const name = prev?.message.replace(/^checkout: moving from (\S+) to .*$/, "$1");
    if (!name || !repo.branches[name]) fail("fatal: invalid reference: @{-1}");
    switchToBranch(ctx, repo, name);
    return;
  }
  if (detach) {
    const id = resolveRev(repo, target);
    if (!id) fail(`fatal: invalid reference: ${target}`);
    detachTo(ctx, repo, id, target, false);
    return;
  }
  if (repo.branches[target] || (currentBranch(repo) === target && !headCommitId(repo))) {
    if (!repo.branches[target]) {
      ctx.out(`Already on '${target}'`);
      return;
    }
    switchToBranch(ctx, repo, target);
    return;
  }
  if (dwimRemote(ctx, repo, target)) return;
  const id = resolveRev(repo, target);
  if (id)
    fail(
      [`fatal: a branch is expected, got commit '${target}'`, "hint: If you want to detach HEAD at the commit, try again with the --detach option."],
      "git switch moves between branches. To visit an old commit directly, use git switch --detach <commit> (or git checkout <commit>).",
    );
  fail(
    `fatal: invalid reference: ${target}`,
    `There's no branch called "${target}". Run git branch to list branches, or create it with git switch -c ${target}.`,
  );
}

export function gitCheckout(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const dash = args.indexOf("--");
  if (dash !== -1) {
    const before = args.slice(0, dash).filter((a) => !a.startsWith("-"));
    const paths = args.slice(dash + 1);
    restorePaths(ctx, repo, paths, before[0]);
    return;
  }
  const bIdx = args.findIndex((a) => a === "-b" || a === "-B");
  const pos = args.filter((a) => !a.startsWith("-") || a === "-");
  if (bIdx !== -1) {
    const name = args[bIdx + 1];
    if (!name) fail(`error: switch \`b' requires a value`);
    const start = pos.filter((p) => p !== name)[0];
    newBranchAndSwitch(ctx, repo, name, start);
    return;
  }
  const target = pos[0];
  if (!target) fail("error: you must specify a branch, commit or file to check out");
  if (target === "-") return gitSwitch(ctx, ["-"]);
  if (repo.branches[target]) return switchToBranch(ctx, repo, target);
  if (dwimRemote(ctx, repo, target)) return;
  const id = resolveRev(repo, target);
  if (id) {
    if (pos.length > 1) return restorePaths(ctx, repo, pos.slice(1), target);
    return detachTo(ctx, repo, id, target, true);
  }
  // treat as path(s)
  restorePaths(ctx, repo, pos);
}

function restorePaths(ctx: Ctx, repo: Repo, specs: string[], rev?: string) {
  let src = repo.index;
  if (rev) {
    const id = resolveRev(repo, rev);
    if (!id) fail(`fatal: invalid reference: ${rev}`);
    src = repo.commits[id].tree;
  }
  let n = 0;
  for (const spec of specs) {
    const matched = matchPaths(spec, Object.keys(src));
    if (!matched.length)
      fail(
        `error: pathspec '${spec}' did not match any file(s) known to git`,
        `Git doesn't know a branch, commit, or tracked file called "${spec}".`,
      );
    for (const p of matched) {
      ctx.world.workdir[p] = src[p];
      if (rev) repo.index[p] = src[p];
      n++;
    }
  }
  ctx.out(`Updated ${n} path${n === 1 ? "" : "s"} from ${rev ? "the tree" : "the index"}`);
  ctx.emit({ type: "file-change", paths: specs });
}

// ---------------------------------------------------------------- merge

export function gitMerge(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  if (args.includes("--abort")) {
    if (!repo.op || repo.op.kind !== "merge")
      fail("fatal: There is no merge to abort (MERGE_HEAD missing).");
    hardReset(ctx.world, repo, headTree(repo));
    repo.op = null;
    ctx.out("Merge aborted. Your files are back to how they were before the merge.", "muted");
    ctx.emit({ type: "reset", mode: "merge-abort", to: headCommitId(repo)! });
    return;
  }
  if (args.includes("--continue")) {
    if (!repo.op || repo.op.kind !== "merge") fail("fatal: There is no merge in progress (MERGE_HEAD missing).");
    if (repo.op.conflicts.length) fail("error: Committing is not possible because you have unmerged files.");
    finishCommit(ctx, repo, repo.op.message);
    return;
  }
  if (repo.op)
    fail(
      repo.op.conflicts.length
        ? ["error: Merging is not possible because you have unmerged files.", "hint: Fix them up in the work tree, and then use 'git add/rm <file>'"]
        : ["fatal: You have not concluded your merge (MERGE_HEAD exists).", "Please, commit your changes before you merge."],
      "You're in the middle of a merge already. Finish it (resolve, git add, git commit) or cancel it with git merge --abort.",
    );
  let message: string | null = null;
  const noFf = args.includes("--no-ff");
  const ffOnly = args.includes("--ff-only");
  const squash = args.includes("--squash");
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-m") message = args[++i];
    else if (!args[i].startsWith("-")) pos.push(args[i]);
  }
  const name = pos[0] ?? (currentBranch(repo) ? repo.upstream[currentBranch(repo)!] : undefined);
  if (!name) fail("fatal: No remote for the current branch.", "Tell git merge which branch to bring in, e.g. git merge feature/hello.");
  const theirs = resolveRev(repo, name);
  if (!theirs)
    fail(
      `merge: ${name} - not something we can merge`,
      `There's no branch or commit called "${name}". Run git branch to see your branches.`,
    );
  const ours = headCommitId(repo);
  const into = currentBranch(repo);
  if (!ours) {
    switchTrees(ctx, repo, repo.commits[theirs].tree);
    moveHead(repo, theirs, `merge ${name}: Fast-forward`);
    ctx.emit({ type: "merge", mode: "fast-forward", into, from: name, id: theirs });
    return;
  }
  if (isAncestor(repo, theirs, ours)) {
    ctx.out("Already up to date.");
    ctx.emit({ type: "merge", mode: "up-to-date", into, from: name });
    return;
  }
  const oursTree = repo.commits[ours].tree;
  if (isAncestor(repo, ours, theirs) && !noFf && !squash) {
    switchTrees(ctx, repo, repo.commits[theirs].tree);
    moveHead(repo, theirs, `merge ${name}: Fast-forward`);
    ctx.out(`Updating ${shortId(ours)}..${shortId(theirs)}`);
    ctx.out("Fast-forward", "success");
    ctx.out(diffStat(oursTree, repo.commits[theirs].tree, true));
    ctx.emit({ type: "merge", mode: "fast-forward", into, from: name, id: theirs });
    return;
  }
  if (ffOnly)
    fail(["hint: Diverging branches can't be fast-forwarded, you need to either:", "hint:   git merge --no-ff", "fatal: Not possible to fast-forward, aborting."]);
  const base = mergeBase(repo, ours, theirs);
  const baseTree = base ? repo.commits[base].tree : {};
  const result = mergeTrees(baseTree, oursTree, repo.commits[theirs].tree, "HEAD", name);
  const touched = Object.keys({ ...oursTree, ...result.tree }).filter((p) => oursTree[p] !== result.work[p]);
  const dirty = dirtyTrackedPaths(ctx.world, repo).filter((p) => touched.includes(p) || repo.index[p] !== oursTree[p]);
  if (dirty.length)
    fail(
      ["error: Your local changes to the following files would be overwritten by merge:", ...dirty.map((p) => `\t${p}`), "Please commit your changes or stash them before you merge.", "Aborting"],
      "Commit or stash your uncommitted work before merging, so Git can't overwrite it.",
    );
  ctx.out(result.messages, "muted");
  const defaultMsg = `Merge ${repo.branches[name] ? "branch" : "commit"} '${name}'${into && into !== "main" && into !== "master" ? ` into ${into}` : ""}`;
  // apply result to index + workdir
  for (const p of Object.keys(oursTree)) if (!(p in result.work)) delete ctx.world.workdir[p];
  repo.index = { ...result.tree };
  Object.assign(ctx.world.workdir, result.work);
  if (squash) {
    ctx.out("Squash commit -- not updating HEAD");
    ctx.out("Automatic merge went well; stopped before committing as requested", "muted");
    ctx.emit({ type: "stage", paths: Object.keys(result.tree) });
    return;
  }
  if (result.conflicts.length) {
    repo.op = { kind: "merge", theirs, theirsLabel: name, conflicts: result.conflicts, message: message ?? defaultMsg };
    ctx.error("Automatic merge failed; fix conflicts and then commit the result.");
    ctx.explain =
      "Both branches changed the same lines, so Git can't decide which version to keep. Open each conflicted file, pick the final content, remove the conflict markers, then run git add <file> and git commit.";
    ctx.emit({ type: "conflict", paths: result.conflicts });
    return;
  }
  const c = makeCommit(ctx.world, repo, result.tree, [ours, theirs], message ?? defaultMsg);
  moveHead(repo, c.id, `merge ${name}: Merge made by the 'ort' strategy.`);
  ctx.out("Merge made by the 'ort' strategy.", "success");
  ctx.out(diffStat(oursTree, c.tree, true));
  ctx.emit({ type: "merge", mode: "merge-commit", into, from: name, id: c.id });
}

function moveHead(repo: Repo, id: string, msg: string) {
  if (repo.head.kind === "branch") repo.branches[repo.head.name] = id;
  else repo.head = { kind: "detached", commit: id };
  addReflog(repo, id, msg);
}

// ---------------------------------------------------------------- reset / revert / cherry-pick

export function gitReset(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const mode = args.includes("--hard") ? "hard" : args.includes("--soft") ? "soft" : "mixed";
  const pos = args.filter((a) => !a.startsWith("-"));
  const head = headCommitId(repo);
  // path form: git reset <file> == unstage
  const maybeRev = pos[0];
  if (maybeRev && !resolveRev(repo, maybeRev)) {
    const ht = headTree(repo);
    for (const spec of pos) {
      const matched = matchPaths(spec, new Set([...Object.keys(repo.index), ...Object.keys(ht)]));
      if (!matched.length) fail(`fatal: ambiguous argument '${spec}': unknown revision or path not in the working tree.`);
      for (const p of matched) {
        if (p in ht) repo.index[p] = ht[p];
        else delete repo.index[p];
      }
    }
    ctx.emit({ type: "unstage", paths: pos });
    return;
  }
  if (!head) {
    repo.index = {};
    ctx.emit({ type: "unstage", paths: [] });
    return;
  }
  const target = resolveRev(repo, maybeRev ?? "HEAD")!;
  const tree = repo.commits[target].tree;
  if (mode === "hard") hardReset(ctx.world, repo, tree);
  else if (mode === "mixed") repo.index = { ...tree };
  moveHead(repo, target, `reset: moving to ${maybeRev ?? "HEAD"}`);
  if (repo.op && mode !== "soft") repo.op = null;
  if (mode === "hard") ctx.out(`HEAD is now at ${describeCommit(repo.commits[target])}`);
  else if (mode === "mixed") {
    const changed = Object.keys({ ...tree, ...ctx.world.workdir }).filter((p) => p in tree && tree[p] !== ctx.world.workdir[p]);
    if (changed.length) ctx.out(["Unstaged changes after reset:", ...changed.map((p) => `M\t${p}`)]);
  }
  ctx.emit({ type: "reset", mode, to: target });
}

function applyCommit(
  ctx: Ctx,
  repo: Repo,
  kind: "revert" | "cherry-pick",
  rev: string,
) {
  const id = resolveRev(repo, rev);
  if (!id) fail(`fatal: bad revision '${rev}'`);
  const c = repo.commits[id];
  const head = headCommitId(repo);
  if (!head) fail("fatal: your current branch does not have any commits yet");
  if (c.parents.length > 1)
    fail(`error: commit ${shortId(id)} is a merge but no -m option was given.`, "Reverting or cherry-picking a merge commit needs extra options that this simulator doesn't support yet.");
  if (dirtyTrackedPaths(ctx.world, repo).length)
    fail(
      [`error: your local changes would be overwritten by ${kind}.`, "hint: commit your changes or stash them to proceed."],
      `Save or stash your current edits before running git ${kind}.`,
    );
  const parentTree = c.parents[0] ? repo.commits[c.parents[0]].tree : {};
  const headTreeNow = repo.commits[head].tree;
  const [base, theirs] = kind === "revert" ? [c.tree, parentTree] : [parentTree, c.tree];
  const label = `${shortId(id)} (${oneLine(c)})`;
  const result = mergeTrees(base, headTreeNow, theirs, "HEAD", (kind === "revert" ? "parent of " : "") + label);
  const message = kind === "revert" ? `Revert "${oneLine(c)}"\n\nThis reverts commit ${c.id}.` : c.message;
  for (const p of Object.keys(headTreeNow)) if (!(p in result.work)) delete ctx.world.workdir[p];
  repo.index = { ...result.tree };
  Object.assign(ctx.world.workdir, result.work);
  if (result.conflicts.length) {
    ctx.out(result.messages, "muted");
    repo.op = { kind, theirs: id, theirsLabel: label, conflicts: result.conflicts, message, author: kind === "cherry-pick" ? c.author : undefined };
    ctx.error([`error: could not ${kind} ${label}`, `hint: After resolving the conflicts, mark them with "git add <file>" and run "git commit".`]);
    ctx.emit({ type: "conflict", paths: result.conflicts });
    return;
  }
  if (sameTree(result.tree, headTreeNow)) {
    ctx.error(["The previous cherry-pick is now empty, possibly due to conflict resolution."], "These changes are already in your branch, so there is nothing new to apply.");
    return;
  }
  finishCommit(ctx, repo, message);
  if (kind === "cherry-pick") {
    const newId = headCommitId(repo)!;
    repo.commits[newId].author = c.author;
  }
}

export function gitRevert(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  if (args.includes("--abort")) return abortOp(ctx, repo, "revert");
  const rev = args.find((a) => !a.startsWith("-"));
  if (!rev) fail("usage: git revert <commit>", "Name the commit to undo, e.g. git revert HEAD or git revert a1b2c3d.");
  applyCommit(ctx, repo, "revert", rev);
}

export function gitCherryPick(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  if (args.includes("--abort")) return abortOp(ctx, repo, "cherry-pick");
  const revs = args.filter((a) => !a.startsWith("-"));
  if (!revs.length) fail("usage: git cherry-pick <commit>...", "Name the commit to copy onto this branch, e.g. git cherry-pick a1b2c3d.");
  for (const r of revs) {
    applyCommit(ctx, repo, "cherry-pick", r);
    if (repo.op) break;
  }
}

function abortOp(ctx: Ctx, repo: Repo, kind: string) {
  if (!repo.op || repo.op.kind !== kind) fail(`error: no ${kind} in progress`);
  if (repo.op.rebase) {
    const { origHead, branch } = repo.op.rebase;
    hardReset(ctx.world, repo, repo.commits[origHead].tree);
    if (branch) {
      repo.branches[branch] = origHead;
      repo.head = { kind: "branch", name: branch };
    } else repo.head = { kind: "detached", commit: origHead };
    addReflog(repo, origHead, `rebase (abort): returning to ${branch ?? shortId(origHead)}`);
  } else hardReset(ctx.world, repo, headTree(repo));
  repo.op = null;
  ctx.out(`${kind} aborted.`, "muted");
  ctx.emit({ type: "reset", mode: "abort", to: headCommitId(repo)! });
}

// ---------------------------------------------------------------- rebase

export function gitRebase(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  if (args.includes("--abort")) return abortOp(ctx, repo, "rebase");
  if (args.includes("--continue")) {
    const op = repo.op;
    if (!op || op.kind !== "rebase") fail("fatal: No rebase in progress?");
    if (op.conflicts.length)
      fail(
        ["error: you must edit all merge conflicts and then", "mark them as resolved using git add"],
        "Some files still have conflicts. Fix them and run git add <file> before continuing.",
      );
    const head = headCommitId(repo)!;
    const c = makeCommit(ctx.world, repo, repo.index, [head], op.message, op.author);
    repo.head = { kind: "detached", commit: c.id };
    addReflog(repo, c.id, `rebase (continue): ${oneLine(c)}`);
    op.rebase!.rewritten.push([op.theirs, c.id]);
    repo.op = null;
    return continueRebase(ctx, repo, op.rebase!);
  }
  if (args.includes("-i") || args.includes("--interactive"))
    fail(
      "gitverse: interactive rebase (-i) needs an editor and isn't available in the simulator yet.",
      "Interactive rebase lets you squash, reorder and reword commits. It's coming in the Rebase chapter. For now, try a regular git rebase <branch>.",
    );
  if (repo.op) fail("fatal: It seems that there is already an operation in progress. Finish or abort it first.");
  const upstreamName = args.find((a) => !a.startsWith("-")) ?? (currentBranch(repo) ? repo.upstream[currentBranch(repo)!] : undefined);
  if (!upstreamName) fail("fatal: There is no tracking information for the current branch.", "Tell git rebase which branch to replay your work onto, e.g. git rebase main.");
  const upstream = resolveRev(repo, upstreamName);
  if (!upstream) fail(`fatal: invalid upstream '${upstreamName}'`, `There's no branch called "${upstreamName}".`);
  const head = headCommitId(repo);
  if (!head) fail("fatal: no commits to rebase");
  if (dirtyTrackedPaths(ctx.world, repo).length)
    fail(["error: cannot rebase: You have unstaged changes.", "error: Please commit or stash them."], "Rebase rewrites your branch, so it needs a clean working tree. Commit or stash your edits first.");
  const branch = currentBranch(repo);
  if (isAncestor(repo, upstream, head)) {
    ctx.out(`Current branch ${branch ?? "HEAD"} is up to date.`);
    return;
  }
  const upAnc = ancestors(repo, upstream);
  const todo = [...ancestors(repo, head)]
    .filter((id) => !upAnc.has(id))
    .map((id) => repo.commits[id])
    .filter((c) => c.parents.length <= 1)
    .sort((a, b) => a.seq - b.seq)
    .map((c) => c.id);
  // detach at upstream
  switchTrees(ctx, repo, repo.commits[upstream].tree);
  repo.head = { kind: "detached", commit: upstream };
  addReflog(repo, upstream, `rebase (start): checkout ${upstreamName}`);
  continueRebase(ctx, repo, { branch, upstream, origHead: head, todo, rewritten: [] });
}

function continueRebase(ctx: Ctx, repo: Repo, state: NonNullable<NonNullable<Repo["op"]>["rebase"]>) {
  while (state.todo.length) {
    const id = state.todo.shift()!;
    const c = repo.commits[id];
    const head = headCommitId(repo)!;
    const parentTree = c.parents[0] ? repo.commits[c.parents[0]].tree : {};
    const headTreeNow = repo.commits[head].tree;
    const result = mergeTrees(parentTree, headTreeNow, c.tree, "HEAD", `${shortId(id)} (${oneLine(c)})`);
    for (const p of Object.keys(headTreeNow)) if (!(p in result.work)) delete ctx.world.workdir[p];
    repo.index = { ...result.tree };
    Object.assign(ctx.world.workdir, result.work);
    if (result.conflicts.length) {
      ctx.out(result.messages, "muted");
      repo.op = { kind: "rebase", theirs: id, theirsLabel: oneLine(c), conflicts: result.conflicts, message: c.message, author: c.author, rebase: state };
      ctx.error([
        `error: could not apply ${shortId(id)}... ${oneLine(c)}`,
        `hint: Resolve all conflicts manually, mark them as resolved with`,
        `hint: "git add <conflicted_files>", then run "git rebase --continue".`,
        `hint: To abort and get back to the state before "git rebase", run "git rebase --abort".`,
      ]);
      ctx.explain = "While replaying one of your commits, Git hit a conflict. Fix the file, git add it, then run git rebase --continue.";
      ctx.emit({ type: "conflict", paths: result.conflicts });
      return;
    }
    if (sameTree(result.tree, headTreeNow)) continue; // already applied upstream
    const n = makeCommit(ctx.world, repo, result.tree, [head], c.message, c.author);
    repo.head = { kind: "detached", commit: n.id };
    addReflog(repo, n.id, `rebase (pick): ${oneLine(c)}`);
    state.rewritten.push([id, n.id]);
  }
  const tip = headCommitId(repo)!;
  if (state.branch) {
    repo.branches[state.branch] = tip;
    repo.head = { kind: "branch", name: state.branch };
    addReflog(repo, tip, `rebase (finish): returning to refs/heads/${state.branch}`);
  }
  ctx.out(`Successfully rebased and updated ${state.branch ? `refs/heads/${state.branch}` : "detached HEAD"}.`, "success");
  ctx.emit({ type: "rebase", onto: state.upstream, rewritten: state.rewritten });
}

// ---------------------------------------------------------------- stash

export function gitStash(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const sub = args[0] && !args[0].startsWith("-") ? args[0] : "push";
  const rest = sub === args[0] ? args.slice(1) : args;
  const head = headCommit(repo);
  if (sub === "push" || sub === "save") {
    if (!head) fail("You do not have the initial commit yet");
    const includeUntracked = rest.includes("-u") || rest.includes("--include-untracked");
    const mIdx = rest.indexOf("-m");
    const dirty = dirtyTrackedPaths(ctx.world, repo);
    const untracked = Object.keys(ctx.world.workdir).filter((p) => !(p in repo.index));
    if (!dirty.length && !(includeUntracked && untracked.length)) {
      ctx.out("No local changes to save");
      return;
    }
    const work: Record<string, string> = {};
    for (const p of new Set([...Object.keys(repo.index), ...Object.keys(head.tree)])) if (p in ctx.world.workdir) work[p] = ctx.world.workdir[p];
    if (includeUntracked) for (const p of untracked) work[p] = ctx.world.workdir[p];
    const where = currentBranch(repo) ?? "(no branch)";
    const msg = mIdx >= 0 ? `On ${where}: ${rest[mIdx + 1]}` : `WIP on ${where}: ${describeCommit(head)}`;
    repo.stash.unshift({ base: head.id, index: { ...repo.index }, workdir: work, message: msg });
    hardReset(ctx.world, repo, head.tree);
    if (includeUntracked) for (const p of untracked) delete ctx.world.workdir[p];
    ctx.out(`Saved working directory and index state ${msg}`);
    ctx.emit({ type: "stash", action: "push" });
    return;
  }
  if (sub === "list") {
    repo.stash.forEach((s, i) => ctx.out(`stash@{${i}}: ${s.message}`));
    return;
  }
  if (sub === "pop" || sub === "apply" || sub === "drop") {
    if (!repo.stash.length) fail("No stash entries found.");
    const s = repo.stash[0];
    if (sub !== "drop") {
      const baseTree = repo.commits[s.base].tree;
      const current = { ...ctx.world.workdir };
      const conflicts: string[] = [];
      for (const [p, content] of Object.entries(s.workdir)) {
        const b = baseTree[p];
        const o = current[p];
        if (o === b || o === undefined) ctx.world.workdir[p] = content;
        else if (o !== content) {
          conflicts.push(p);
        }
      }
      for (const p of Object.keys(baseTree)) if (!(p in s.workdir) && ctx.world.workdir[p] === baseTree[p]) delete ctx.world.workdir[p];
      if (conflicts.length)
        fail(
          ["error: Your local changes to the following files would be overwritten by merge:", ...conflicts.map((p) => `\t${p}`), "Please commit your changes or stash them before you merge.", "Aborting"],
          "The stashed changes touch files you've edited since. Commit or discard those edits, then try again.",
        );
    }
    if (sub !== "apply") {
      repo.stash.shift();
      ctx.out(`Dropped refs/stash@{0} (${shortId(s.base)})`, "muted");
    }
    ctx.emit({ type: "stash", action: "pop" });
    return;
  }
  if (sub === "clear") {
    repo.stash = [];
    return;
  }
  fail(`error: unknown subcommand: ${sub}`);
}
