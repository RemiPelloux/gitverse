import { Ctx, fail } from "../context";
import { shortId } from "../hash";
import {
  addReflog,
  ancestors,
  currentBranch,
  DEFAULT_BRANCH,
  headCommit,
  headCommitId,
  headTree,
  isAncestor,
  makeCommit,
  newRepo,
  relTime,
  resolveRev,
  sameTree,
  status,
  validBranchName,
} from "../repo";
import type { Commit, FileMap, Repo } from "../types";
import type { StatusEntry } from "../repo";
import { COMMIT_MSG_FILE, hookExplain, runHook, runHookDetailed } from "../hooks";
import { ignoreRules, isIgnoredPath, matchIgnore } from "../ignore";
import {
  branchLabel,
  describeCommit,
  diffStat,
  matchPaths,
  oneLine,
  PROJECT_PATH,
  printTreeDiff,
  requireRepo,
} from "./helpers";

export function gitInit(ctx: Ctx, args: string[]) {
  const branchFlag = args.findIndex((a) => a === "-b" || a === "--initial-branch");
  const initial = branchFlag >= 0 ? args[branchFlag + 1] : DEFAULT_BRANCH;
  if (ctx.world.repo) {
    ctx.out(`Reinitialized existing Git repository in ${PROJECT_PATH}/.git/`);
    return;
  }
  const repo = newRepo();
  if (initial && initial !== DEFAULT_BRANCH) {
    repo.head = { kind: "branch", name: initial };
    repo.branchOrder = [initial];
  }
  ctx.world.repo = repo;
  ctx.out(`Initialized empty Git repository in ${PROJECT_PATH}/.git/`, "success");
  ctx.emit({ type: "init" });
}

function upstreamInfo(repo: Repo): string[] {
  const b = currentBranch(repo);
  if (!b) return [];
  const up = repo.upstream[b];
  if (!up) return [];
  const local = repo.branches[b];
  const remote = repo.remoteRefs[up];
  if (!remote) return [`Your branch is based on '${up}', but the upstream is gone.`, ""];
  if (!local) return [];
  const la = ancestors(repo, local);
  const ra = ancestors(repo, remote);
  const ahead = [...la].filter((c) => !ra.has(c)).length;
  const behind = [...ra].filter((c) => !la.has(c)).length;
  const s = (n: number) => `${n} commit${n === 1 ? "" : "s"}`;
  if (!ahead && !behind) return [`Your branch is up to date with '${up}'.`, ""];
  if (ahead && !behind)
    return [`Your branch is ahead of '${up}' by ${s(ahead)}.`, `  (use "git push" to publish your local commits)`, ""];
  if (!ahead && behind)
    return [
      `Your branch is behind '${up}' by ${s(behind)}, and can be fast-forwarded.`,
      `  (use "git pull" to update your local branch)`,
      "",
    ];
  return [
    `Your branch and '${up}' have diverged,`,
    `and have ${ahead} and ${behind} different commits each, respectively.`,
    `  (use "git pull" if you want to integrate the remote branch with yours)`,
    "",
  ];
}

export function gitStatus(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const showIgnored = args.includes("--ignored");
  const all = status(ctx.world, { ignored: showIgnored });
  const uMode = untrackedMode(args);
  const entries = collapseUntracked(
    repo,
    all.filter((e) => !e.ignored && !(uMode === "no" && e.untracked && !e.staged && !e.conflicted)),
    uMode === "all",
  );
  const ignored = ignoredDisplay(ctx, all.filter((e) => e.ignored).map((e) => e.path));
  if (args.includes("-s") || args.includes("--short")) {
    for (const e of entries) {
      if (e.conflicted) ctx.out(`UU ${e.path}`, "error");
      else if (e.untracked && !e.staged) ctx.out(`?? ${e.path}`, "error");
      else {
        const x = e.staged === "added" ? "A" : e.staged === "modified" ? "M" : e.staged === "deleted" ? "D" : " ";
        const y = e.unstaged === "modified" ? "M" : e.unstaged === "deleted" ? "D" : " ";
        ctx.out(`${x}${y} ${e.path}`, e.staged ? "success" : "error");
      }
    }
    for (const p of ignored) ctx.out(`!! ${p}`, "muted");
    return;
  }
  const head = headCommit(repo);
  if (repo.head.kind === "branch") ctx.out(`On branch ${repo.head.name}`);
  else ctx.out(`HEAD detached at ${shortId(repo.head.commit)}`, "warning");
  ctx.out(upstreamInfo(repo));
  if (repo.bisect) {
    const orig = repo.bisect.orig;
    ctx.out(repo.branches[orig] !== undefined ? `You are currently bisecting, started from branch '${orig}'.` : "You are currently bisecting.");
    ctx.out(`  (use "git bisect reset" to get back to the original branch)`, "muted");
    ctx.out("");
  }
  if (repo.op?.kind === "rebase") {
    ctx.out([`interactive rebase in progress; onto ${shortId(repo.op.rebase!.upstream)}`]);
    ctx.out(`  (fix conflicts and then run "git rebase --continue")`, "muted");
    ctx.out(`  (use "git rebase --abort" to check out the original branch)`, "muted");
    ctx.out("");
  } else if (repo.op && repo.op.kind !== "merge") {
    const k = repo.op.kind;
    const ing = k === "revert" ? "reverting" : "cherry-picking";
    ctx.out(`You are currently ${ing} commit ${shortId(repo.op.theirs)}.`);
    if (repo.op.conflicts.length) ctx.out(`  (fix conflicts and run "git ${k} --continue")`, "muted");
    else ctx.out(`  (all conflicts fixed: run "git ${k} --continue")`, "muted");
    ctx.out(`  (use "git ${k} --skip" to skip this patch)`, "muted");
    ctx.out(`  (use "git ${k} --abort" to cancel the ${k} operation)`, "muted");
    ctx.out("");
  } else if (repo.op) {
    if (repo.op.conflicts.length) {
      ctx.out("You have unmerged paths.");
      ctx.out(`  (fix conflicts and run "git commit")`, "muted");
      ctx.out(`  (use "git ${repo.op.kind} --abort" to abort the ${repo.op.kind})`, "muted");
    } else {
      ctx.out("All conflicts fixed but you are still merging.");
      ctx.out(`  (use "git commit" to conclude ${repo.op.kind})`, "muted");
    }
    ctx.out("");
  }
  if (!head) ctx.out(["No commits yet", ""]);

  const staged = entries.filter((e) => e.staged && !e.conflicted);
  const conflicted = entries.filter((e) => e.conflicted);
  const unstaged = entries.filter((e) => e.unstaged && !e.conflicted);
  const untracked = entries.filter((e) => e.untracked && !e.staged && !e.conflicted);
  const label = { added: "new file:", modified: "modified:", deleted: "deleted:" } as const;

  if (staged.length) {
    ctx.out("Changes to be committed:");
    ctx.out(
      head ? `  (use "git restore --staged <file>..." to unstage)` : `  (use "git rm --cached <file>..." to unstage)`,
      "muted",
    );
    for (const e of staged) ctx.out(`\t${label[e.staged!].padEnd(12)}${e.path}`, "success");
    ctx.out("");
  }
  if (conflicted.length) {
    ctx.out("Unmerged paths:");
    ctx.out(`  (use "git add <file>..." to mark resolution)`, "muted");
    for (const e of conflicted) ctx.out(`\tboth modified:   ${e.path}`, "error");
    ctx.out("");
  }
  if (unstaged.length) {
    ctx.out("Changes not staged for commit:");
    ctx.out(`  (use "git add <file>..." to update what will be committed)`, "muted");
    ctx.out(`  (use "git restore <file>..." to discard changes in working directory)`, "muted");
    for (const e of unstaged) ctx.out(`\t${label[e.unstaged!].padEnd(12)}${e.path}`, "error");
    ctx.out("");
  }
  if (untracked.length) {
    ctx.out("Untracked files:");
    ctx.out(`  (use "git add <file>..." to include in what will be committed)`, "muted");
    for (const e of untracked) ctx.out(`\t${e.path}`, "error");
    ctx.out("");
  }
  if (ignored.length) {
    ctx.out("Ignored files:");
    ctx.out(`  (use "git add -f <file>..." to include in what will be committed)`, "muted");
    for (const p of ignored) ctx.out(`\t${p}`, "muted");
    ctx.out("");
  }
  if (!staged.length && !conflicted.length) {
    if (unstaged.length) ctx.out(`no changes added to commit (use "git add" and/or "git commit -a")`);
    else if (untracked.length)
      ctx.out(`nothing added to commit but untracked files present (use "git add" to track)`);
    else if (!head) ctx.out(`nothing to commit (create/copy files and use "git add" to track)`);
    else ctx.out("nothing to commit, working tree clean");
  }
}

/** `-u[<mode>]` / `--untracked-files[=<mode>]`: "normal" (default), "all" or "no". A bare -u means all. */
function untrackedMode(args: string[]): "normal" | "all" | "no" {
  let mode: "normal" | "all" | "no" = "normal";
  for (const a of args) {
    const m = /^(?:-u|--untracked-files)(?:=?(\w+))?$/.exec(a);
    if (!m) continue;
    const v = m[1] ?? "all";
    if (v === "all" || v === "no" || v === "normal") mode = v;
    else fail(`fatal: Invalid untracked files mode '${v}'`, "Use -uall (list every file), -unormal (the default: folders shown once) or -uno (hide untracked files).");
  }
  return mode;
}

/**
 * Printed `git status` only (the Files panel uses status() per file): like real Git, a directory
 * holding no tracked file at all is shown once as `dir/` instead of listing every file inside it.
 */
function collapseUntracked(repo: Repo, entries: StatusEntry[], showAll: boolean): StatusEntry[] {
  if (showAll) return entries;
  const tracked = [...new Set([...Object.keys(repo.index), ...Object.keys(headTree(repo))])];
  const hasTracked = (dir: string) => tracked.some((p) => p.startsWith(dir));
  const out: StatusEntry[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e.untracked || e.staged || e.conflicted) {
      out.push(e);
      continue;
    }
    const parts = e.path.split("/");
    let path = e.path;
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join("/") + "/";
      if (!hasTracked(dir)) {
        path = dir;
        break;
      }
    }
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path === e.path ? e : { ...e, path });
  }
  return out;
}

/** Ignored paths as `git status --ignored` lists them: a fully ignored directory is shown once as `dir/`. */
function ignoredDisplay(ctx: Ctx, paths: string[]): string[] {
  if (!paths.length) return [];
  const rules = ignoreRules(ctx.world.workdir);
  const out = new Set<string>();
  for (const p of paths) {
    const m = matchIgnore(rules, p);
    out.add(m && m.isDir ? m.path + "/" : p);
  }
  return [...out].sort();
}

export function gitAdd(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const world = ctx.world;
  const all = args.includes("-A") || args.includes("--all");
  const force = args.includes("-f") || args.includes("--force");
  const specs = args.filter((a) => !a.startsWith("-"));
  const rules = force ? [] : ignoreRules(world.workdir);
  /** Untracked + ignored: `git add` leaves these alone unless forced. */
  const isIgnored = (p: string) => rules.length > 0 && !(p in repo.index) && p in world.workdir && isIgnoredPath(rules, p);
  const refused: string[] = [];
  const isIgnoredDir = (dir: string) => {
    const m = matchIgnore(rules, dir, true);
    return !!m && !m.rule.negate;
  };
  if (!specs.length && !all)
    fail(
      ["Nothing specified, nothing added.", "hint: Maybe you wanted to say 'git add .'?"],
      "`git add` needs to know which files to stage. Name a file (git add README.md) or use a dot to stage everything in this folder (git add .).",
    );
  const candidates = new Set([...Object.keys(world.workdir), ...Object.keys(repo.index)]);
  const targets = new Set<string>();
  for (const spec of all ? ["."] : specs) {
    const matched = matchPaths(spec, candidates);
    if (!matched.length)
      fail(
        `fatal: pathspec '${spec}' did not match any files`,
        `There's no file called "${spec}" in your project. Check the spelling, or look at the Files panel / run ls to see what exists.`,
      );
    // "." / a directory silently skips ignored files; naming an ignored file (or glob) explicitly is refused
    const clean = spec.replace(/^\.\//, "").replace(/\/$/, "");
    const broad = all || spec === "." || spec === ":/" || (!clean.includes("*") && !(clean in world.workdir) && !(clean in repo.index));
    for (const p of matched) {
      if (!isIgnored(p)) targets.add(p);
      else if (!broad) refused.push(p);
      else if (p === clean || isIgnoredDir(clean)) refused.push(clean);
    }
  }
  const staged: string[] = [];
  for (const p of targets) {
    if (p in world.workdir) {
      if (repo.index[p] !== world.workdir[p]) staged.push(p);
      repo.index[p] = world.workdir[p];
    } else if (p in repo.index) {
      delete repo.index[p];
      staged.push(p);
    }
    if (repo.op?.conflicts.includes(p)) {
      repo.op.conflicts = repo.op.conflicts.filter((c) => c !== p);
      if (!staged.includes(p)) staged.push(p);
    }
  }
  if (staged.length) ctx.emit({ type: "stage", paths: staged });
  if (refused.length)
    ctx.error(
      [
        "The following paths are ignored by one of your .gitignore files:",
        ...[...new Set(refused)].sort(),
        "hint: Use -f if you really want to add them.",
        'hint: Disable this message with "git config set advice.addIgnoredFile false"',
      ],
      "Your .gitignore says Git should not track these files (things like secrets, logs or build output usually shouldn't be committed). Git refused to stage them. If you really want this file in the repository, use git add -f <file>.",
    );
}

export function gitRm(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const cached = args.includes("--cached");
  const specs = args.filter((a) => !a.startsWith("-"));
  if (!specs.length) fail("usage: git rm [--cached] <file>...");
  const removed: string[] = [];
  for (const spec of specs) {
    const matched = matchPaths(spec, Object.keys(repo.index));
    if (!matched.length) fail(`fatal: pathspec '${spec}' did not match any files`);
    for (const p of matched) {
      delete repo.index[p];
      if (!cached) delete ctx.world.workdir[p];
      ctx.out(`rm '${p}'`);
      removed.push(p);
    }
  }
  ctx.emit({ type: "stage", paths: removed });
}

export function gitMv(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const [from, to] = args.filter((a) => !a.startsWith("-"));
  if (!from || !to) fail("usage: git mv <source> <destination>");
  if (!(from in repo.index)) fail(`fatal: not under version control, source=${from}, destination=${to}`);
  if (to in ctx.world.workdir) fail(`fatal: destination exists, source=${from}, destination=${to}`);
  ctx.world.workdir[to] = ctx.world.workdir[from] ?? repo.index[from];
  delete ctx.world.workdir[from];
  repo.index[to] = repo.index[from];
  delete repo.index[from];
  ctx.emit({ type: "stage", paths: [from, to] });
}

export function finishCommit(ctx: Ctx, repo: Repo, message: string, opts: { amend?: boolean; allowEmpty?: boolean } = {}) {
  const parentId = headCommitId(repo);
  const parent = parentId ? repo.commits[parentId] : null;
  let parents = parentId ? [parentId] : [];
  if (opts.amend) {
    if (!parent) fail("fatal: You have nothing to amend.");
    parents = parent.parents;
  }
  const op = repo.op;
  if (op && op.kind === "merge") parents = [...parents, op.theirs];
  if (!opts.allowEmpty && !opts.amend && !op && parent && sameTree(repo.index, parent.tree)) {
    return false;
  }
  const c: Commit = makeCommit(ctx.world, repo, repo.index, parents, message, op?.author);
  const branch = currentBranch(repo);
  const isRoot = parents.length === 0;
  const kind = opts.amend ? " (amend)" : op?.kind === "merge" ? " (merge)" : isRoot ? " (initial)" : "";
  if (repo.head.kind === "branch") repo.branches[repo.head.name] = c.id;
  else repo.head = { kind: "detached", commit: c.id };
  addReflog(repo, c.id, `commit${kind}: ${oneLine(c)}`);
  const where = branch ?? "detached HEAD";
  ctx.out(`[${where}${isRoot ? " (root-commit)" : ""} ${shortId(c.id)}] ${oneLine(c)}`, "success");
  ctx.out(diffStat(parent && !opts.amend ? parent.tree : opts.amend && parents[0] ? repo.commits[parents[0]].tree : {}, c.tree, true));
  repo.op = null;
  ctx.emit({ type: "commit", id: c.id, branch });
  return true;
}

export function gitCommit(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const messages: string[] = [];
  let all = false;
  let amend = false;
  let allowEmpty = false;
  let noEdit = false;
  let noVerify = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-m" || a === "--message") {
      if (args[i + 1] === undefined) fail("error: switch `m' requires a value");
      messages.push(args[++i]);
    } else if (a.startsWith("--message=")) messages.push(a.slice(10));
    else if (a === "-a" || a === "--all") all = true;
    else if (a === "-am") {
      all = true;
      if (args[i + 1] === undefined) fail("error: switch `m' requires a value");
      messages.push(args[++i]);
    } else if (a === "--amend") amend = true;
    else if (a === "--allow-empty") allowEmpty = true;
    else if (a === "--no-edit") noEdit = true;
    else if (a === "--no-verify" || a === "-n") noVerify = true;
    else if (a.startsWith("-")) fail(`error: unknown option \`${a.replace(/^-+/, "")}'`);
    else fail(`error: pathspec '${a}' did not match any file(s) known to git`, 'Did you forget quotes around your message? Use: git commit -m "your message"');
  }
  if (repo.op?.kind === "rebase")
    fail(
      ["error: you are in the middle of a rebase.", 'hint: use "git rebase --continue" after resolving conflicts'],
      "During a rebase, Git makes the commits for you. After fixing conflicts and running git add, use git rebase --continue.",
    );
  if (repo.op && repo.op.conflicts.length)
    fail(
      [
        "error: Committing is not possible because you have unmerged files.",
        "hint: Fix them up in the work tree, and then use 'git add/rm <file>'",
        "hint: as appropriate to mark resolution and make a commit.",
        "fatal: Exiting because of an unresolved conflict.",
      ],
      "Some files still have conflicts. Open them, choose the final content (remove the <<<<<<< ======= >>>>>>> markers), then run git add on each file.",
    );
  if (all) {
    for (const p of Object.keys(repo.index)) {
      if (p in ctx.world.workdir) repo.index[p] = ctx.world.workdir[p];
      else delete repo.index[p];
    }
  }
  if (!noVerify && !runHook(ctx, "pre-commit"))
    fail([], hookExplain("pre-commit", "creating the commit (nothing was committed)"));
  let message = messages.join("\n\n");
  if (!message && repo.op) message = repo.op.message;
  if (!message && amend && noEdit) message = headCommit(repo)?.message ?? "";
  if (!message && amend) message = headCommit(repo)?.message ?? "";
  if (!message)
    fail(
      [
        "Aborting commit due to empty commit message.",
        'hint: Gitverse has no text editor for commit messages — use git commit -m "your message"',
      ],
      'Every commit needs a short message describing the change. Add one with -m, for example: git commit -m "Add README"',
    );
  const head = headCommit(repo);
  if (!repo.op && !amend && !allowEmpty && sameTree(repo.index, head?.tree ?? {})) {
    const entries = status(ctx.world);
    ctx.ok = false;
    if (!head && !entries.length) {
      ctx.out(["On branch " + branchLabel(repo), "", "Initial commit", "", `nothing to commit (create/copy files and use "git add" to track)`]);
      ctx.explain = "There are no files to save yet. Create a file first, then stage it with git add.";
    } else if (entries.length) {
      ctx.out(`On branch ${branchLabel(repo)}`);
      const untracked = entries.filter((e) => e.untracked);
      if (untracked.length) {
        ctx.out(["Untracked files:", ...untracked.map((e) => `\t${e.path}`), ""], "error");
      }
      const modified = entries.filter((e) => e.unstaged);
      if (modified.length) ctx.out(["Changes not staged for commit:", ...modified.map((e) => `\tmodified:   ${e.path}`), ""], "error");
      ctx.out(
        modified.length
          ? `no changes added to commit (use "git add" and/or "git commit -a")`
          : `nothing added to commit but untracked files present (use "git add" to track)`,
      );
      ctx.explain =
        "A commit saves what is in the staging area, and the staging area has nothing new. Stage your changes first with git add <file> (or git add .), then commit.";
    } else {
      ctx.out([`On branch ${branchLabel(repo)}`, "nothing to commit, working tree clean"]);
      ctx.explain = "Everything is already saved in a commit. Change a file first, then stage and commit it.";
    }
    return;
  }
  if (!noVerify) {
    const hook = runHookDetailed(ctx, "commit-msg", { [COMMIT_MSG_FILE]: message + "\n" }, [COMMIT_MSG_FILE]);
    if (hook && !hook.ok) fail([], hookExplain("commit-msg", "creating the commit, because of the commit message (nothing was committed)"));
    // like real Git, the hook may rewrite the message file
    const edited = hook?.world.workdir[COMMIT_MSG_FILE]?.replace(/\n+$/, "");
    if (edited) message = edited;
  }
  finishCommit(ctx, repo, message, { amend, allowEmpty });
}

export function formatDate(t: number) {
  return new Date(t * 1000).toUTCString().replace("GMT", "+0000");
}

export function decorations(repo: Repo, id: string, color = true): string {
  void color;
  const refs: string[] = [];
  const headId = headCommitId(repo);
  const branches = Object.entries(repo.branches).filter(([, v]) => v === id).map(([k]) => k);
  if (repo.head.kind === "branch" && branches.includes(repo.head.name)) {
    refs.push(`HEAD -> ${repo.head.name}`);
    branches.splice(branches.indexOf(repo.head.name), 1);
  } else if (repo.head.kind === "detached" && headId === id) refs.push("HEAD");
  refs.push(...branches.sort());
  refs.push(...Object.entries(repo.remoteRefs).filter(([, v]) => v === id).map(([k]) => k).sort());
  refs.push(...Object.entries(repo.tags).filter(([, v]) => v === id).map(([k]) => `tag: ${k}`).sort());
  return refs.length ? ` (${refs.join(", ")})` : "";
}

export function gitLog(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const oneline = args.includes("--oneline");
  const graph = args.includes("--graph");
  const allRefs = args.includes("--all");
  let limit = Infinity;
  const revs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-n") limit = Number(args[++i]);
    else if (/^-\d+$/.test(a)) limit = Number(a.slice(1));
    else if (a.startsWith("--max-count=")) limit = Number(a.split("=")[1]);
    else if (["--oneline", "--graph", "--all", "--decorate"].includes(a)) continue;
    else if (a.startsWith("-")) fail(`fatal: unrecognized argument: ${a}`);
    else revs.push(a);
  }
  const starts: string[] = [];
  const excludes: string[] = [];
  if (allRefs) {
    starts.push(...Object.values(repo.branches), ...Object.values(repo.remoteRefs), ...Object.values(repo.tags));
    const h = headCommitId(repo);
    if (h) starts.push(h);
  } else if (revs.length) {
    const resolve = (r: string) => {
      const id = resolveRev(repo, r || "HEAD");
      if (!id) fail([`fatal: ambiguous argument '${r}': unknown revision or path not in the working tree.`]);
      return id;
    };
    for (const r of revs) {
      const range = /^(.*?)\.\.(.*)$/.exec(r);
      if (range) {
        // A..B = commits reachable from B but not from A (e.g. main..origin/main = what GitHub has that you don't)
        excludes.push(resolve(range[1]));
        starts.push(resolve(range[2]));
      } else if (r.startsWith("^")) excludes.push(resolve(r.slice(1)));
      else starts.push(resolve(r));
    }
    if (!starts.length) starts.push(resolve("HEAD"));
  } else {
    const h = headCommitId(repo);
    if (!h)
      fail(
        `fatal: your current branch '${branchLabel(repo)}' does not have any commits yet`,
        "There's no history yet because you haven't made a commit. Stage a file and run git commit first.",
      );
    starts.push(h);
  }
  const set = new Set<string>();
  for (const s of starts) for (const a of ancestors(repo, s)) set.add(a);
  for (const x of excludes) for (const a of ancestors(repo, x)) set.delete(a);
  const commits = [...set].map((id) => repo.commits[id]).filter(Boolean).sort((a, b) => b.seq - a.seq).slice(0, limit);

  const columns: string[] = [];
  for (const c of commits) {
    let prefix = "";
    let after: string[] = [];
    if (graph) {
      let col = columns.indexOf(c.id);
      if (col === -1) {
        columns.push(c.id);
        col = columns.length - 1;
      }
      prefix = columns.map((_, i) => (i === col ? "*" : "|")).join(" ") + " ";
      const [first, ...rest] = c.parents;
      // collapse duplicates of this commit in other columns
      const dupes = columns.map((v, i) => (v === c.id && i !== col ? i : -1)).filter((i) => i >= 0);
      if (first) columns[col] = first;
      else columns.splice(col, 1);
      for (const d of dupes.reverse()) columns.splice(d, 1);
      for (const p of rest) {
        if (!columns.includes(p)) {
          columns.splice(col + 1, 0, p);
          after = [columns.map((_, i) => (i === col + 1 ? "\\" : "|")).join(" ")];
        }
      }
      if (first && columns.filter((v) => v === first).length > 1) {
        const idx = columns.lastIndexOf(first);
        columns.splice(idx, 1);
        after = [columns.map(() => "|").join(" ") + "/"];
      }
    }
    if (oneline) {
      ctx.out(`${prefix}${shortId(c.id)}${decorations(repo, c.id)} ${oneLine(c)}`, "commit");
      after.forEach((l) => ctx.out(l, "muted"));
    } else {
      const pad = graph ? columns.map(() => "|").join(" ") + " " : "";
      ctx.out(`${prefix}commit ${c.id}${decorations(repo, c.id)}`, "commit");
      if (c.parents.length > 1) ctx.out(`${pad}Merge: ${c.parents.map(shortId).join(" ")}`);
      ctx.out(`${pad}Author: ${c.author} <${c.author.toLowerCase().replace(/\s+/g, ".")}@gitverse.dev>`);
      ctx.out(`${pad}Date:   ${formatDate(c.time)}  (${relTime(ctx.world, c.time)})`, "muted");
      ctx.out(pad);
      for (const l of c.message.split("\n")) ctx.out(`${pad}    ${l}`);
      ctx.out(pad);
      after.forEach((l) => ctx.out(l, "muted"));
    }
  }
}

export function gitShow(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const target = args.find((a) => !a.startsWith("-")) ?? "HEAD";
  const fileRef = /^([^:]+):(.+)$/.exec(target);
  if (fileRef) {
    const id = resolveRev(repo, fileRef[1]);
    if (!id) fail(`fatal: invalid object name '${fileRef[1]}'.`);
    const content = repo.commits[id].tree[fileRef[2]];
    if (content === undefined) fail(`fatal: path '${fileRef[2]}' does not exist in '${fileRef[1]}'`);
    ctx.out(content.replace(/\n$/, "").split("\n"));
    return;
  }
  const id = resolveRev(repo, target);
  if (!id)
    fail(
      target === "HEAD"
        ? `fatal: your current branch '${branchLabel(repo)}' does not have any commits yet`
        : `fatal: ambiguous argument '${target}': unknown revision or path not in the working tree.`,
    );
  const c = repo.commits[id];
  const tag = repo.tags[target] === id ? repo.tagMeta?.[target] : undefined;
  if (tag) {
    ctx.out(`tag ${target}`, "commit");
    ctx.out(`Tagger: ${tag.tagger}`);
    ctx.out(`Date:   ${formatDate(tag.time)}`, "muted");
    ctx.out("");
    ctx.out(tag.message.split("\n"));
    ctx.out("");
  }
  ctx.out(`commit ${c.id}${decorations(repo, c.id)}`, "commit");
  if (c.parents.length > 1) ctx.out(`Merge: ${c.parents.map(shortId).join(" ")}`);
  ctx.out(`Author: ${c.author}`);
  ctx.out(`Date:   ${formatDate(c.time)}`, "muted");
  ctx.out("");
  for (const l of c.message.split("\n")) ctx.out(`    ${l}`);
  ctx.out("");
  if (c.parents.length <= 1) printTreeDiff(ctx, c.parents[0] ? repo.commits[c.parents[0]].tree : {}, c.tree);
}

export function gitDiff(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const staged = args.includes("--staged") || args.includes("--cached");
  const stat = args.includes("--stat");
  const [before, after] = (() => {
    const dash = args.indexOf("--");
    return dash === -1 ? [args, [] as string[]] : [args.slice(0, dash), args.slice(dash + 1)];
  })();
  const positional = before.filter((a) => !a.startsWith("-"));
  const revs: string[] = [];
  const paths: string[] = [...after];
  for (const p of positional) {
    const range = /^(.+?)\.\.(.+)$/.exec(p);
    if (range) {
      revs.push(range[1], range[2]);
      continue;
    }
    if (resolveRev(repo, p)) revs.push(p);
    else if (p in ctx.world.workdir || p in repo.index || matchPaths(p, Object.keys(ctx.world.workdir)).length) paths.push(p);
    else fail(`fatal: ambiguous argument '${p}': unknown revision or path not in the working tree.`);
  }
  let from: FileMap;
  let to: FileMap;
  if (revs.length >= 2) {
    from = repo.commits[resolveRev(repo, revs[0])!].tree;
    to = repo.commits[resolveRev(repo, revs[1])!].tree;
  } else if (revs.length === 1) {
    from = repo.commits[resolveRev(repo, revs[0])!].tree;
    to = staged ? repo.index : workTracked(ctx, repo);
  } else if (staged) {
    from = headTree(repo);
    to = repo.index;
  } else {
    from = repo.index;
    to = workTracked(ctx, repo);
  }
  let filter: string[] | undefined;
  if (paths.length) {
    const cands = new Set([...Object.keys(from), ...Object.keys(to)]);
    filter = paths.flatMap((p) => matchPaths(p, cands));
  }
  if (stat) {
    const f = filter ? Object.fromEntries(Object.entries(from).filter(([k]) => filter!.includes(k))) : from;
    const t = filter ? Object.fromEntries(Object.entries(to).filter(([k]) => filter!.includes(k))) : to;
    ctx.out(diffStat(f, t));
    return;
  }
  printTreeDiff(ctx, from, to, filter);
}

/** Working directory restricted to tracked files (git diff ignores untracked). */
function workTracked(ctx: Ctx, repo: Repo): FileMap {
  const out: FileMap = {};
  for (const p of Object.keys(repo.index)) if (p in ctx.world.workdir) out[p] = ctx.world.workdir[p];
  return out;
}

export function gitReflog(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  void args;
  if (!repo.reflog.length) fail(`fatal: your current branch '${branchLabel(repo)}' does not have any commits yet`);
  const entries = [...repo.reflog].reverse();
  entries.forEach((e, i) => {
    const deco = i === 0 ? decorations(repo, e.commit) : "";
    ctx.out(`${shortId(e.commit)}${deco} HEAD@{${i}}: ${e.message}`, i === 0 ? "commit" : "out");
  });
}

/** fnmatch-style glob used by `git tag -l` / `git branch --list` (`*` also matches `/`). */
export function refGlob(pattern: string): RegExp {
  let re = "";
  for (const ch of pattern) {
    if (ch === "*") re += ".*";
    else if (ch === "?") re += ".";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function gitTag(ctx: Ctx, rawArgs: string[]) {
  const repo = requireRepo(ctx);
  // split bundled short flags: -am "msg" -> -a -m "msg"
  const args = rawArgs.flatMap((a) => (/^-[adfl]+m?$/.test(a) && a.length > 2 ? [...a.slice(1)].map((f) => `-${f}`) : [a]));
  let del = false;
  let list = false;
  let annotate = false;
  let force = false;
  let lines: number | null = null;
  let contains: string | null = null;
  const messages: string[] = [];
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-d" || a === "--delete") del = true;
    else if (a === "-l" || a === "--list") list = true;
    else if (a === "-a" || a === "--annotate") annotate = true;
    else if (a === "-f" || a === "--force") force = true;
    else if (a === "-m" || a === "--message") {
      if (i + 1 >= args.length) fail("error: switch `m' requires a value", 'Put the tag message right after -m, in quotes: git tag -a v1.0 -m "Release 1.0"');
      messages.push(args[++i]);
    } else if (a.startsWith("--message=")) messages.push(a.slice("--message=".length));
    else if (/^-m./.test(a)) messages.push(a.slice(2));
    else if (/^-n\d*$/.test(a)) lines = a.length > 2 ? Number(a.slice(2)) : 1;
    else if (a === "--contains") {
      // optional argument: defaults to HEAD
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("-") && resolveRev(repo, next)) contains = args[++i];
      else contains = "HEAD";
    } else if (a.startsWith("--contains=")) contains = a.slice("--contains=".length);
    else if (a.startsWith("-"))
      fail(`error: unknown option \`${a.replace(/^-+/, "")}'`, "Common git tag options: -a (annotated) with -m \"message\", -l to list, -d to delete, -n to show messages.");
    else positional.push(a);
  }
  const meta = (repo.tagMeta ??= {});
  const listing = list || lines !== null || contains !== null || (!positional.length && !del && !messages.length && !annotate);
  if (listing && !del) {
    if (messages.length || annotate)
      fail("fatal: options '-l' and '-a' cannot be used together", "-l only lists tags. To create an annotated tag, drop -l: git tag -a v1.0 -m \"Release 1.0\"");
    const patterns = positional.map(refGlob);
    let names = Object.keys(repo.tags).sort();
    if (patterns.length) names = names.filter((t) => patterns.some((re) => re.test(t)));
    if (contains !== null) {
      const id = resolveRev(repo, contains);
      if (!id) fail(`error: malformed object name ${contains}`, `There's no commit called "${contains}". Use a branch name, tag or commit id from git log --oneline.`);
      names = names.filter((t) => ancestors(repo, repo.tags[t]).has(id));
    }
    for (const t of names) {
      if (lines === null) {
        ctx.out(t);
        continue;
      }
      const text = meta[t]?.message ?? repo.commits[repo.tags[t]]?.message ?? "";
      const msgLines = text.split("\n").slice(0, Math.max(1, lines));
      ctx.out(`${t.padEnd(15)} ${msgLines[0]}`);
      for (const l of msgLines.slice(1)) ctx.out(`    ${l}`);
    }
    return;
  }
  if (del) {
    if (!positional.length) fail("usage: git tag -d <tagname>...", "Name the tag to delete, e.g. git tag -d v1.0. Run git tag to list them.");
    for (const name of positional) {
      if (!repo.tags[name]) {
        ctx.error(`error: tag '${name}' not found.`, "There's no tag with that name. Run git tag to see the existing tags.");
        continue;
      }
      ctx.out(`Deleted tag '${name}' (was ${shortId(repo.tags[name])})`);
      delete repo.tags[name];
      delete meta[name];
    }
    return;
  }
  const [name, rev] = positional;
  if (!name) fail("usage: git tag [-a] [-m <msg>] <tagname> [<commit>]", 'Give the tag a name, e.g. git tag -a v1.0 -m "Release 1.0".');
  if (!validBranchName(name)) fail(`fatal: '${name}' is not a valid tag name.`, "Tag names look like v1.0.0: letters, numbers, dots, dashes and slashes, no spaces.");
  if (repo.tags[name] && !force)
    fail(`fatal: tag '${name}' already exists`, `A tag called ${name} already exists, and tags aren't supposed to move. Pick a new name, or delete it first with git tag -d ${name}.`);
  const message = messages.join("\n\n");
  if (annotate && !messages.length)
    fail(
      "fatal: no tag message given (there is no editor here: use -m)",
      `An annotated tag needs a message. Real Git would open a text editor; here, give it with -m: git tag -a ${name} -m "Release ${name.replace(/^v/, "")}"`,
    );
  const id = resolveRev(repo, rev ?? "HEAD");
  if (!id) fail(`fatal: Failed to resolve '${rev ?? "HEAD"}' as a valid ref.`, "You need at least one commit before you can tag it.");
  const old = repo.tags[name];
  repo.tags[name] = id;
  if (messages.length) {
    ctx.world.clock += 30;
    meta[name] = { message, tagger: `${ctx.world.user.name} <${ctx.world.user.email}>`, time: ctx.world.clock };
  } else delete meta[name];
  if (old && old !== id) ctx.out(`Updated tag '${name}' (was ${shortId(old)})`);
  ctx.emit({ type: "tag", name, at: id });
}

export function gitRestore(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const staged = args.includes("--staged") || args.includes("-S");
  const worktree = args.includes("--worktree") || args.includes("-W") || !staged;
  let source: string | null = null;
  const specs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--source" || a === "-s") source = args[++i];
    else if (a.startsWith("--source=")) source = a.slice(9);
    else if (!a.startsWith("-")) specs.push(a);
  }
  if (!specs.length) fail("fatal: you must specify path(s) to restore");
  let srcTree: FileMap | null = null;
  if (source) {
    const id = resolveRev(repo, source);
    if (!id) fail(`fatal: could not resolve ${source}`);
    srcTree = repo.commits[id].tree;
  }
  const head = headTree(repo);
  const changed: string[] = [];
  for (const spec of specs) {
    const cands = new Set([...Object.keys(head), ...Object.keys(repo.index), ...Object.keys(ctx.world.workdir)]);
    const matched = matchPaths(spec, cands);
    if (!matched.length) fail(`error: pathspec '${spec}' did not match any file(s) known to git`);
    for (const p of matched) {
      if (staged) {
        const from = srcTree ?? head;
        if (p in from) repo.index[p] = from[p];
        else delete repo.index[p];
      }
      if (worktree) {
        const from = srcTree ?? (staged ? head : repo.index);
        if (!(p in from) && !(p in repo.index) && !staged) {
          // untracked file: git restore refuses
          fail(`error: pathspec '${p}' did not match any file(s) known to git`, "git restore only works on files Git already tracks. This file has never been added.");
        }
        if (p in from) ctx.world.workdir[p] = from[p];
        else delete ctx.world.workdir[p];
      }
      if (repo.op?.conflicts.includes(p) && worktree) repo.op.conflicts = repo.op.conflicts.filter((c) => c !== p);
      changed.push(p);
    }
  }
  ctx.emit(staged ? { type: "unstage", paths: changed } : { type: "file-change", paths: changed });
}

export function describeHead(repo: Repo) {
  const c = headCommit(repo);
  return c ? describeCommit(c) : "";
}

export { isAncestor };
