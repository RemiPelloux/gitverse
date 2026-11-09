import { Ctx, fail } from "../context";
import { shortId } from "../hash";
import { addReflog, ancestors, currentBranch, headCommitId, newRepo } from "../repo";
import type { Commit, Repo, World } from "../types";
import { onBranchPushed } from "../github/hosted";
import { hookExplain, runHook } from "../hooks";
import { gitMerge, gitRebase } from "./branching";
import { requireRepo } from "./helpers";

function remoteUrl(repo: Repo, name: string): string {
  const url = repo.remotes[name];
  if (!url)
    fail(
      [`fatal: '${name}' does not appear to be a git repository`, "fatal: Could not read from remote repository."],
      `There's no remote called "${name}". Run git remote -v to see configured remotes.`,
    );
  return url;
}

function hosted(world: World, url: string) {
  const h = world.hosted[url];
  if (!h)
    fail(
      [`fatal: repository '${url}' not found`],
      "That repository doesn't exist on the simulated GitHub. Double-check the URL.",
    );
  return h;
}

/** Copy all commits reachable from `tip` from one object store to another. */
function transfer(from: Record<string, Commit>, to: Record<string, Commit>, tip: string): number {
  let n = 0;
  const stack = [tip];
  while (stack.length) {
    const id = stack.pop()!;
    if (to[id]) continue;
    const c = from[id];
    if (!c) continue;
    to[id] = structuredClone(c);
    n++;
    stack.push(...c.parents);
  }
  return n;
}

export function gitRemote(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const sub = args[0];
  if (!sub || sub === "-v" || sub === "--verbose") {
    for (const [name, url] of Object.entries(repo.remotes)) {
      if (sub) {
        ctx.out(`${name}\t${url} (fetch)`);
        ctx.out(`${name}\t${url} (push)`);
      } else ctx.out(name);
    }
    return;
  }
  if (sub === "add") {
    const [name, url] = args.slice(1);
    if (!name || !url) fail("usage: git remote add <name> <url>");
    if (repo.remotes[name]) fail(`error: remote ${name} already exists.`);
    repo.remotes[name] = url;
    if (!ctx.world.hosted[url]) {
      // creating a remote to an unknown URL: model it as a new empty GitHub repo
      const m = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(url);
      ctx.world.hosted[url] = { url, owner: m?.[1] ?? "you", name: m?.[2] ?? "project", branches: {}, defaultBranch: "main" };
    }
    return;
  }
  if (sub === "remove" || sub === "rm") {
    const name = args[1];
    if (!name) fail("usage: git remote remove <name>");
    remoteUrl(repo, name);
    delete repo.remotes[name];
    for (const r of Object.keys(repo.remoteRefs)) if (r.startsWith(name + "/")) delete repo.remoteRefs[r];
    for (const [b, up] of Object.entries(repo.upstream)) if (up.startsWith(name + "/")) delete repo.upstream[b];
    return;
  }
  if (sub === "rename") {
    const [from, to] = args.slice(1);
    if (!from || !to) fail("usage: git remote rename <old> <new>");
    const url = remoteUrl(repo, from);
    if (repo.remotes[to]) fail(`error: remote ${to} already exists.`);
    delete repo.remotes[from];
    repo.remotes[to] = url;
    for (const [r, id] of Object.entries(repo.remoteRefs))
      if (r.startsWith(from + "/")) {
        delete repo.remoteRefs[r];
        repo.remoteRefs[to + r.slice(from.length)] = id;
      }
    for (const [b, up] of Object.entries(repo.upstream)) if (up.startsWith(from + "/")) repo.upstream[b] = to + up.slice(from.length);
    return;
  }
  if (sub === "get-url") {
    const name = args[1];
    if (!name) fail("usage: git remote get-url <name>");
    ctx.out(remoteUrl(repo, name));
    return;
  }
  if (sub === "set-url") {
    const [name, url] = args.slice(1).filter((a) => !a.startsWith("-"));
    if (!name || !url) fail("usage: git remote set-url <name> <newurl>");
    remoteUrl(repo, name);
    repo.remotes[name] = url;
    if (!ctx.world.hosted[url]) {
      const m = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(url);
      ctx.world.hosted[url] = { url, owner: m?.[1] ?? "you", name: m?.[2] ?? "project", branches: {}, defaultBranch: "main" };
    }
    return;
  }
  if (sub === "show") {
    const name = args[1];
    if (!name) {
      Object.keys(repo.remotes).forEach((r) => ctx.out(r));
      return;
    }
    const url = remoteUrl(repo, name);
    const host = hosted(ctx.world, url);
    ctx.out([`* remote ${name}`, `  Fetch URL: ${url}`, `  Push  URL: ${url}`, `  HEAD branch: ${host.branches[host.defaultBranch] ? host.defaultBranch : "(unknown)"}`]);
    const remoteBranches = Object.keys(host.branches).sort();
    if (remoteBranches.length) {
      ctx.out("  Remote branches:");
      for (const b of remoteBranches) ctx.out(`    ${b.padEnd(16)} ${repo.remoteRefs[`${name}/${b}`] ? "tracked" : "new (next fetch will store in remotes/" + name + ")"}`);
    }
    const stale = Object.keys(repo.remoteRefs).filter((r) => r.startsWith(name + "/") && !(r.slice(name.length + 1) in host.branches));
    for (const r of stale) ctx.out(`    ${r.slice(name.length + 1).padEnd(16)} stale (use 'git remote prune' to remove)`);
    const tracking = Object.entries(repo.upstream).filter(([, up]) => up.startsWith(name + "/"));
    if (tracking.length) {
      ctx.out("  Local branches configured for 'git pull':");
      for (const [b, up] of tracking) ctx.out(`    ${b.padEnd(16)} merges with remote ${up.slice(name.length + 1)}`);
    }
    return;
  }
  if (sub === "prune") {
    const name = args[1];
    if (!name) fail("usage: git remote prune <name>");
    const host = hosted(ctx.world, remoteUrl(repo, name));
    for (const r of Object.keys(repo.remoteRefs))
      if (r.startsWith(name + "/") && !(r.slice(name.length + 1) in host.branches)) {
        delete repo.remoteRefs[r];
        ctx.out(` * [pruned] ${r}`);
      }
    return;
  }
  fail(`error: unknown subcommand: ${sub}`);
}

const PUSH_FLAGS = new Set(["-u", "--set-upstream", "-f", "--force", "--force-with-lease", "--tags", "-d", "--delete", "--all", "-v", "--verbose", "-q", "--quiet", "--no-verify"]);

export function gitPush(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  for (const a of args) {
    if (a.startsWith("-") && !PUSH_FLAGS.has(a) && !a.startsWith("--force-with-lease="))
      fail(`error: unknown option \`${a.replace(/^-+/, "")}'`, "That option isn't supported for git push here. Common ones: -u, --force, --delete, --tags.");
  }
  const has = (...f: string[]) => f.some((x) => args.includes(x));
  const setUpstream = has("-u", "--set-upstream");
  const hardForce = has("-f", "--force");
  const lease = !hardForce && (has("--force-with-lease") || args.some((a) => a.startsWith("--force-with-lease=")));
  const force = hardForce || lease;
  const del = has("-d", "--delete");
  const pushTags = has("--tags");
  const all = has("--all");
  const pos = args.filter((a) => !a.startsWith("-"));
  const branch = currentBranch(repo);
  let remoteName = pos[0];
  let refspecs = pos.slice(1);

  if (!remoteName) {
    if (!Object.keys(repo.remotes).length)
      fail(["fatal: No configured push destination."], "Your repository isn't connected to GitHub yet. Add a remote with git remote add origin <url>.");
    const up = branch ? repo.upstream[branch] : undefined;
    if (pushTags || all) remoteName = up?.split("/")[0] ?? (repo.remotes.origin ? "origin" : Object.keys(repo.remotes)[0]);
    else {
      if (!branch) fail(["fatal: You are not currently on a branch.", "To push the history leading to the current (detached HEAD)", "state now, use", "", "    git push origin HEAD:<name-of-remote-branch>", ""], "You're in detached HEAD, so there's no branch to push. Create one first with git switch -c <name>.");
      if (!up)
        fail(
          [`fatal: The current branch ${branch} has no upstream branch.`, "To push the current branch and set the remote as upstream, use", "", `    git push --set-upstream origin ${branch}`, ""],
          `Git doesn't know where on GitHub this branch should go yet. The first time, run git push -u origin ${branch} — after that, plain git push works.`,
        );
      remoteName = up.split("/")[0];
      refspecs = [`${branch}:${up.split("/").slice(1).join("/")}`];
    }
  }
  const url = remoteUrl(repo, remoteName);
  // pre-push hook (core.hooksPath): runs before anything is sent; --no-verify skips it.
  if (!has("--no-verify") && !runHook(ctx, "pre-push", {}, [remoteName, url])) fail([], hookExplain("pre-push", "pushing"));
  const host = hosted(ctx.world, url);
  if (!refspecs.length && !pushTags && !all) {
    if (!branch) fail("fatal: You are not currently on a branch.", "You're in detached HEAD. Create a branch first with git switch -c <name>, or push explicitly: git push origin HEAD:<branch>.");
    const up = repo.upstream[branch];
    refspecs = [up && up.startsWith(remoteName + "/") ? `${branch}:${up.slice(remoteName.length + 1)}` : branch];
  }
  if (all) refspecs = Object.keys(repo.branches);
  if (del && !refspecs.length) fail("fatal: --delete doesn't make sense without any refs");

  const lines: Array<{ text: string; kind: "success" | "out" }> = [];
  const rejected: string[] = [];
  const notes: string[] = [];
  let objects = 0;

  const protectedReject = (refLabel: string, dst: string, deleting = false) =>
    fail(
      [
        `remote: error: GH006: Protected branch update failed for refs/heads/${dst}.`,
        deleting ? "remote: error: Cannot delete this protected branch" : "remote: error: Changes must be made through a pull request.",
        `To ${url}`,
        ` ! [remote rejected] ${refLabel} (protected branch hook declined)`,
        `error: failed to push some refs to '${url}'`,
      ],
      deleting
        ? `${dst} is a protected branch on GitHub, so it can't be deleted. Protection keeps important branches like ${dst} safe from accidents.`
        : `${dst} is a protected branch on GitHub: nobody may push to it directly, every change has to arrive through a pull request. Move your commit to a new branch (git switch -c my-change), push that branch (git push -u origin my-change) and open a pull request with gh pr create. Then reset your local ${dst} to origin/${dst}.`,
    );

  const pushRef = (srcName: string, dst: string) => {
    // tags
    if (repo.tags[srcName] && !repo.branches[srcName]) {
      const id = repo.tags[srcName];
      host.tags = host.tags ?? {};
      if (host.tags[dst] === id) return;
      if (host.tags[dst] && !force) {
        rejected.push(` ! [rejected]        ${srcName} -> ${dst} (already exists)`);
        return;
      }
      objects += transfer(repo.commits, ctx.world.hostedCommits, id);
      lines.push({ text: ` * [new tag]         ${srcName} -> ${dst}`, kind: "success" });
      host.tags[dst] = id;
      const meta = repo.tagMeta?.[srcName];
      if (meta) (host.tagMeta ??= {})[dst] = { ...meta };
      else if (host.tagMeta) delete host.tagMeta[dst];
      return;
    }
    const src = srcName === "HEAD" ? headCommitId(repo) : repo.branches[srcName];
    if (!src)
      fail(
        [`error: src refspec ${srcName} does not match any`, `error: failed to push some refs to '${url}'`],
        !headCommitId(repo) ? "You can't push yet because you have no commits. Make a commit first." : `There's no local branch or tag called "${srcName}".`,
      );
    const old = host.branches[dst];
    if (old === src) {
      repo.remoteRefs[`${remoteName}/${dst}`] = src;
      return;
    }
    if (old && host.protection?.[dst]?.requirePullRequest) protectedReject(`${srcName} -> ${dst}`, dst);
    const fastForward = old ? ancestors(repo, src).has(old) : true;
    if (old && !fastForward && !force) {
      rejected.push(` ! [rejected]        ${srcName} -> ${dst} (fetch first)`);
      return;
    }
    // --force-with-lease: only overwrite what you last saw (your origin/<branch>)
    if (old && !fastForward && lease && repo.remoteRefs[`${remoteName}/${dst}`] !== old) {
      rejected.push(` ! [rejected]        ${srcName} -> ${dst} (stale info)`);
      return;
    }
    objects += transfer(repo.commits, ctx.world.hostedCommits, src);
    if (!old) lines.push({ text: ` * [new branch]      ${srcName} -> ${dst}`, kind: "success" });
    else if (!fastForward) lines.push({ text: ` + ${shortId(old)}...${shortId(src)} ${srcName} -> ${dst} (forced update)`, kind: "success" });
    else lines.push({ text: `   ${shortId(old)}..${shortId(src)}  ${srcName} -> ${dst}`, kind: "success" });
    host.branches[dst] = src;
    if (!host.branches[host.defaultBranch]) host.defaultBranch = dst;
    repo.remoteRefs[`${remoteName}/${dst}`] = src;
    notes.push(...onBranchPushed(ctx.world, host, dst, old, src));
    ctx.emit({ type: "push", remote: remoteName, branch: dst, id: src });
    if (setUpstream && srcName !== "HEAD") {
      repo.upstream[srcName] = `${remoteName}/${dst}`;
      lines.push({ text: `branch '${srcName}' set up to track '${remoteName}/${dst}'.`, kind: "out" });
    }
  };

  const deleteRef = (dst: string) => {
    if (host.tags?.[dst] && !host.branches[dst]) {
      delete host.tags[dst];
      if (host.tagMeta) delete host.tagMeta[dst];
      lines.push({ text: ` - [deleted]         ${dst}`, kind: "success" });
      return;
    }
    if (!host.branches[dst])
      fail([`error: unable to delete '${dst}': remote ref does not exist`, `error: failed to push some refs to '${url}'`], `GitHub has no branch called "${dst}". Run git branch -r to see the remote branches you know about.`);
    if (host.protection?.[dst]) protectedReject(dst, dst, true);
    if (dst === host.defaultBranch && Object.keys(host.branches).length > 1)
      fail(
        [` ! [remote rejected] ${dst} (refusing to delete the current branch: refs/heads/${dst})`, `error: failed to push some refs to '${url}'`],
        `${dst} is the default branch on GitHub, so it can't be deleted from here.`,
      );
    delete host.branches[dst];
    delete repo.remoteRefs[`${remoteName}/${dst}`];
    lines.push({ text: ` - [deleted]         ${dst}`, kind: "success" });
    ctx.emit({ type: "push", remote: remoteName, branch: dst, id: "" });
  };

  for (const spec of refspecs) {
    const forced = spec.startsWith("+");
    const clean = forced ? spec.slice(1) : spec;
    const [srcName, dstName] = clean.includes(":") ? clean.split(":") : [clean, clean];
    if (del) deleteRef(srcName);
    else if (srcName === "") deleteRef(dstName);
    else pushRef(srcName, dstName || srcName);
  }
  if (pushTags) for (const t of Object.keys(repo.tags).sort()) pushRef(t, t);

  ctx.out(`To ${url}`, "muted");
  if (objects) ctx.out(`Writing objects: 100% (${objects}/${objects}), done.`, "muted");
  for (const l of lines) ctx.out(l.text, l.kind);
  if (notes.length) ctx.out(notes, "muted");
  if (!lines.length && !rejected.length) ctx.out("Everything up-to-date");
  if (rejected.length) {
    ctx.error([...rejected, `error: failed to push some refs to '${url}'`]);
    if (rejected.some((r) => r.includes("fetch first"))) {
      ctx.out(
        [
          "hint: Updates were rejected because the remote contains work that you do not",
          "hint: have locally. This is usually caused by another repository pushing to",
          "hint: the same ref. If you want to integrate the remote changes, use",
          "hint: 'git pull' before pushing again.",
        ],
        "muted",
      );
      ctx.explain = "Someone else pushed new commits to GitHub that you don't have. Git refuses to overwrite them. Run git pull to bring them in, then push again.";
    } else if (rejected.some((r) => r.includes("stale info")))
      ctx.explain =
        "--force-with-lease refused: GitHub's branch has commits you haven't seen since your last fetch (someone else pushed). Overwriting would destroy their work. Run git fetch, look at what arrived (git log --oneline --all), keep it, then push again.";
    else ctx.explain = "A tag with that name already exists on GitHub. Tags aren't supposed to move; delete it first or pick a new name.";
  }
}

function fetchRemote(ctx: Ctx, repo: Repo, remoteName: string, prune = false): string[] {
  const url = remoteUrl(repo, remoteName);
  const host = hosted(ctx.world, url);
  const updated: string[] = [];
  const lines: string[] = [];
  for (const [b, id] of Object.entries(host.branches)) {
    const ref = `${remoteName}/${b}`;
    const old = repo.remoteRefs[ref];
    if (old === id) continue;
    transfer(ctx.world.hostedCommits, repo.commits, id);
    repo.remoteRefs[ref] = id;
    updated.push(ref);
    if (!old) lines.push(` * [new branch]      ${b.padEnd(10)} -> ${ref}`);
    else lines.push(`   ${shortId(old)}..${shortId(id)}  ${b.padEnd(10)} -> ${ref}`);
  }
  for (const ref of Object.keys(repo.remoteRefs)) {
    // Git keeps refs to branches deleted on the remote until you ask it to prune.
    if (prune && ref.startsWith(remoteName + "/") && !(ref.slice(remoteName.length + 1) in host.branches)) {
      delete repo.remoteRefs[ref];
      lines.push(` - [deleted]         (none)     -> ${ref}`);
      updated.push(ref);
    }
  }
  for (const [t, id] of Object.entries(host.tags ?? {})) {
    if (repo.tags[t]) continue;
    transfer(ctx.world.hostedCommits, repo.commits, id);
    repo.tags[t] = id;
    const meta = host.tagMeta?.[t];
    if (meta) (repo.tagMeta ??= {})[t] = { ...meta };
    lines.push(` * [new tag]         ${t.padEnd(10)} -> ${t}`);
  }
  if (lines.length) {
    ctx.out(`From ${url}`, "muted");
    ctx.out(lines, "success");
  }
  ctx.emit({ type: "fetch", remote: remoteName, updated });
  return updated;
}

export function gitFetch(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  for (const a of args)
    if (a.startsWith("-") && !["--all", "--prune", "-p", "--tags", "-v", "--verbose", "-q", "--quiet"].includes(a))
      fail(`error: unknown option \`${a.replace(/^-+/, "")}'`);
  const all = args.includes("--all");
  const prune = args.includes("--prune") || args.includes("-p");
  const pos = args.filter((a) => !a.startsWith("-"));
  if (!Object.keys(repo.remotes).length)
    fail("fatal: No remote repository specified.", "This repository isn't connected to GitHub yet. Add a remote with git remote add origin <url>.");
  const branch = currentBranch(repo);
  const upstreamRemote = branch ? repo.upstream[branch]?.split("/")[0] : undefined;
  const names = all ? Object.keys(repo.remotes) : [pos[0] ?? upstreamRemote ?? (repo.remotes.origin ? "origin" : Object.keys(repo.remotes)[0])];
  for (const n of names) fetchRemote(ctx, repo, n, prune);
}

export function gitPull(ctx: Ctx, args: string[]) {
  const repo = requireRepo(ctx);
  const rebase = args.includes("--rebase") || args.includes("-r");
  const pos = args.filter((a) => !a.startsWith("-"));
  const branch = currentBranch(repo);
  let remoteName = pos[0];
  let remoteBranch = pos[1];
  if (!remoteName) {
    const up = branch ? repo.upstream[branch] : undefined;
    if (!up) {
      if (!Object.keys(repo.remotes).length) fail("fatal: No remote repository specified.");
      fail(
        [
          "There is no tracking information for the current branch.",
          "Please specify which branch you want to merge with.",
          "",
          "    git pull <remote> <branch>",
          "",
          "If you wish to set tracking information for this branch you can do so with:",
          "",
          `    git branch --set-upstream-to=origin/<branch> ${branch}`,
        ],
        `Git doesn't know which GitHub branch to pull from. Use git pull origin ${branch ?? "main"}.`,
      );
    }
    remoteName = up.split("/")[0];
    remoteBranch = up.split("/").slice(1).join("/");
  }
  fetchRemote(ctx, repo, remoteName);
  const ref = `${remoteName}/${remoteBranch ?? branch}`;
  if (!repo.remoteRefs[ref]) fail(`fatal: couldn't find remote ref ${remoteBranch ?? branch}`);
  if (rebase) gitRebase(ctx, [ref]);
  else {
    // like real Git: "Merge branch 'main' of https://github.com/you/project"
    const from = remoteUrl(repo, remoteName).replace(/\/+$/, "").replace(/\.git$/, "");
    gitMerge(ctx, [ref], { pullFrom: `branch '${remoteBranch ?? branch}' of ${from}` });
  }
}

export function gitClone(ctx: Ctx, args: string[]) {
  const pos = args.filter((a) => !a.startsWith("-"));
  const url = pos[0];
  if (!url) fail("fatal: You must specify a repository to clone.", "Give git clone the URL of a repository, e.g. git clone https://github.com/gitverse/hello-world.git");
  const host = hosted(ctx.world, url);
  const dir = pos[1] ?? host.name;
  if (ctx.world.repo) fail(`fatal: destination path '${dir}' already exists and is not an empty directory.`, "This workspace already has a repository. Start a fresh lesson or reset the sandbox to clone again.");
  if (Object.keys(ctx.world.workdir).length && dir === ".")
    fail(`fatal: destination path '.' already exists and is not an empty directory.`);
  const repo = newRepo();
  ctx.world.repo = repo;
  repo.remotes.origin = url;
  ctx.out(`Cloning into '${dir}'...`);
  let total = 0;
  for (const [b, id] of Object.entries(host.branches)) {
    total += transfer(ctx.world.hostedCommits, repo.commits, id);
    repo.remoteRefs[`origin/${b}`] = id;
  }
  ctx.out(`Receiving objects: 100% (${total}/${total}), done.`, "muted");
  const def = host.defaultBranch;
  const tip = host.branches[def];
  repo.head = { kind: "branch", name: def };
  repo.branchOrder = [def];
  if (tip) {
    repo.branches[def] = tip;
    repo.upstream[def] = `origin/${def}`;
    repo.index = { ...repo.commits[tip].tree };
    ctx.world.workdir = { ...repo.commits[tip].tree };
    addReflog(repo, tip, `clone: from ${url}`);
  } else ctx.out("warning: You appear to have cloned an empty repository.", "warning");
  if (dir !== ".") ctx.out(`(Gitverse opened '${dir}' as your workspace.)`, "muted");
  ctx.emit({ type: "clone", url });
}
