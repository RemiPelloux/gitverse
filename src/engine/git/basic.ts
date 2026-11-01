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
} from "../repo";
import type { Commit, FileMap, Repo } from "../types";
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
  const entries = status(ctx.world);
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
    return;
  }
  const head = headCommit(repo);
  if (repo.head.kind === "branch") ctx.out(`On branch ${repo.head.name}`);
  else ctx.out(`HEAD detached at ${shortId(repo.head.commit)}`, "warning");
  ctx.out(upstreamInfo(repo));
  if (repo.op?.kind === "rebase") {
    ctx.out([`interactive rebase in progress; onto ${shortId(repo.op.rebase!.upstream)}`]);
    ctx.out(`  (fix conflicts and then run "git rebase --continue")`, "muted");
    ctx.out(`  (use "git rebase --abort" to check out the original branch)`, "muted");
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
  if (!staged.length && !conflicted.length) {
    if (unstaged.length) ctx.out(`no changes added to commit (use "git add" and/or "git commit -a")`);
    else if (untracked.length)
      ctx.out(`nothing added to commit but untracked files present (use "git add" to track)`);
    else if (!head) ctx.out(`nothing to commit (create/copy files and use "git add" to track)`);
    else ctx.out("nothing to commit, working tree clean");
  }
}

export function gitAdd(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const world = ctx.world;
  const all = args.includes("-A") || args.includes("--all");
  const specs = args.filter((a) => !a.startsWith("-"));
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
    matched.forEach((p) => targets.add(p));
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
  finishCommit(ctx, repo, message, { amend, allowEmpty });
}

function formatDate(t: number) {
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
  if (allRefs) {
    starts.push(...Object.values(repo.branches), ...Object.values(repo.remoteRefs), ...Object.values(repo.tags));
    const h = headCommitId(repo);
    if (h) starts.push(h);
  } else if (revs.length) {
    for (const r of revs) {
      const id = resolveRev(repo, r);
      if (!id)
        fail([`fatal: ambiguous argument '${r}': unknown revision or path not in the working tree.`]);
      starts.push(id);
    }
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

export function gitTag(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const del = args.includes("-d") || args.includes("--delete");
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-m") {
      i++;
      continue;
    }
    if (!args[i].startsWith("-")) positional.push(args[i]);
  }
  if (!positional.length) {
    Object.keys(repo.tags).sort().forEach((t) => ctx.out(t));
    return;
  }
  const [name, rev] = positional;
  if (del) {
    if (!repo.tags[name]) fail(`error: tag '${name}' not found.`);
    ctx.out(`Deleted tag '${name}' (was ${shortId(repo.tags[name])})`);
    delete repo.tags[name];
    return;
  }
  if (repo.tags[name]) fail(`fatal: tag '${name}' already exists`);
  const id = resolveRev(repo, rev ?? "HEAD");
  if (!id) fail(`fatal: Failed to resolve '${rev ?? "HEAD"}' as a valid ref.`, "You need at least one commit before you can tag it.");
  repo.tags[name] = id;
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
