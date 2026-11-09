import { fail, type Ctx } from "./context";
import { shortId } from "./hash";
import { currentBranch } from "./repo";
import { closest } from "./shell";
import type { HostedRepo, Issue, PullRequest, World } from "./types";
import { gitMerge, gitSwitch } from "./git/branching";
import { mergeTrees, printTreeDiff } from "./git/helpers";
import { gitFetch } from "./git/remote";
import { executeWorkflow, parseWorkflow, triggerRuns } from "./github/actions";
import {
  autoReview,
  closeIssuesFrom,
  hostedAncestors,
  hostedCommitsBetween,
  hostedMergeBase,
  makeHostedCommit,
  nextNumber,
  reviewVerdicts,
  slug,
  webUrl,
} from "./github/hosted";

/* ------------------------------------------------------------------ flags */

interface FlagSpec {
  /** Flags taking a value: long name -> short aliases. */
  values?: Record<string, string[]>;
  /** Boolean flags: long name -> short aliases. */
  bools?: Record<string, string[]>;
}
interface Parsed {
  pos: string[];
  values: Record<string, string[]>;
  bools: Set<string>;
}

function parseFlags(cmd: string, args: string[], spec: FlagSpec): Parsed {
  const out: Parsed = { pos: [], values: {}, bools: new Set() };
  const find = (table: Record<string, string[]> | undefined, flag: string) =>
    Object.entries(table ?? {}).find(([long, shorts]) => flag === `--${long}` || shorts.includes(flag))?.[0];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-") || a === "-") {
      out.pos.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const flag = eq > 0 ? a.slice(0, eq) : a;
    const v = find(spec.values, flag);
    if (v) {
      const val = eq > 0 ? a.slice(eq + 1) : args[++i];
      if (val === undefined) fail(`flag needs an argument: ${flag}`, `${flag} expects a value, e.g. ${flag} "something".`);
      (out.values[v] ??= []).push(val);
      continue;
    }
    const b = find(spec.bools, flag);
    if (b) {
      out.bools.add(b);
      continue;
    }
    fail([`unknown flag: ${flag}`, "", `Usage: gh ${cmd} --help`], `gh ${cmd} doesn't understand ${flag}. Run gh help to see what's supported here.`);
  }
  return out;
}
const val = (p: Parsed, k: string) => p.values[k]?.[p.values[k].length - 1];

/* ------------------------------------------------------------- resolution */

function requireHost(ctx: Ctx): HostedRepo {
  const repo = ctx.world.repo;
  if (!repo)
    fail(
      "failed to run git: fatal: not a git repository (or any of the parent directories): .git",
      "gh works on the repository in the current folder, and this folder isn't a Git repository yet. Clone one or run git init first.",
    );
  const names = Object.keys(repo.remotes);
  if (!names.length)
    fail("no git remotes found", "gh needs to know which GitHub repository you mean. Connect one with git remote add origin <url>, then push.");
  const url = repo.remotes.origin ?? repo.remotes[names[0]];
  const host = ctx.world.hosted[url];
  if (!host) fail(`GraphQL: Could not resolve to a Repository with the URL '${url}'.`, "That remote doesn't point at a repository on the simulated GitHub.");
  return host;
}

function parseNumber(arg: string): number | null {
  const m = /^#?(\d+)$/.exec(arg) ?? /\/(?:pull|issues)\/(\d+)\/?$/.exec(arg);
  return m ? Number(m[1]) : null;
}

function findPr(ctx: Ctx, host: HostedRepo, arg: string | undefined): PullRequest {
  const pulls = host.pulls ?? [];
  if (arg === undefined) {
    const branch = ctx.world.repo ? currentBranch(ctx.world.repo) : null;
    const pr =
      pulls.filter((p) => p.head === branch && p.state === "open").pop() ?? pulls.filter((p) => p.head === branch).pop();
    if (!pr)
      fail(
        `no pull requests found for branch "${branch ?? "HEAD"}"`,
        "There's no pull request for the branch you're on. Give a number (gh pr view 3) or list them with gh pr list.",
      );
    return pr;
  }
  const n = parseNumber(arg);
  const pr = n !== null ? pulls.find((p) => p.number === n) : pulls.filter((p) => p.head === arg).pop();
  if (!pr)
    fail(
      `GraphQL: Could not resolve to a PullRequest with the number of ${n ?? arg}. (repository.pullRequest)`,
      "No pull request has that number. Run gh pr list --state all to see them.",
    );
  return pr;
}

function findIssue(host: HostedRepo, arg: string | undefined): Issue {
  if (!arg) fail("issue number or url required", "Tell gh which issue, e.g. gh issue view 2.");
  const n = parseNumber(arg);
  const issue = host.issues?.find((i) => i.number === n);
  if (!issue) {
    if (host.pulls?.some((p) => p.number === n))
      fail(`GraphQL: #${n} is a pull request, not an issue`, `Pull requests and issues share numbers on GitHub. Use gh pr view ${n}.`);
    fail(`GraphQL: Could not resolve to an issue or pull request with the number of ${n ?? arg}. (repository.issue)`, "No issue has that number. Run gh issue list --state all.");
  }
  return issue;
}

const STRATEGIES = ["merge", "squash", "rebase"] as const;

/* -------------------------------------------------------------- mergeable */

interface Blocker {
  message: string;
  explain: string;
}

/** Result of the 3-way merge GitHub would do for this PR. */
function githubMerge(world: World, host: HostedRepo, pr: PullRequest) {
  const baseTip = host.branches[pr.base];
  const head = host.branches[pr.head] ?? pr.headCommit;
  const mb = baseTip ? hostedMergeBase(world, baseTip, head) : null;
  const base = mb ? world.hostedCommits[mb].tree : {};
  const ours = baseTip ? world.hostedCommits[baseTip].tree : {};
  return { baseTip, head, ...mergeTrees(base, ours, world.hostedCommits[head]?.tree ?? {}, pr.base, pr.head) };
}

function checkStatus(host: HostedRepo, pr: PullRequest, job: string): "pass" | "fail" | "missing" {
  const runs = (host.runs ?? []).filter((r) => r.event === "pull_request" && r.commit === pr.headCommit && r.jobs.some((j) => j.name === job));
  const last = runs[runs.length - 1];
  if (!last) return "missing";
  return last.jobs.find((j) => j.name === job)!.ok ? "pass" : "fail";
}

function blockers(world: World, host: HostedRepo, pr: PullRequest): Blocker[] {
  const out: Blocker[] = [];
  const rule = host.protection?.[pr.base];
  const verdicts = reviewVerdicts(pr);
  const requesters = [...verdicts].filter(([, v]) => v === "changes_requested").map(([k]) => k);
  if (requesters.length)
    out.push({
      message: `Changes requested by ${requesters.join(", ")}`,
      explain: `${requesters.join(" and ")} asked for changes. Make them on the ${pr.head} branch, commit, and git push: the pull request updates itself and the reviewer looks again.`,
    });
  const approvals = [...verdicts.values()].filter((v) => v === "approved").length;
  if (rule && approvals < rule.requiredApprovals)
    out.push({
      message: `Review required: ${approvals}/${rule.requiredApprovals} approving review${rule.requiredApprovals === 1 ? "" : "s"}`,
      explain: `The ${pr.base} branch is protected: a pull request needs ${rule.requiredApprovals} approving review${rule.requiredApprovals === 1 ? "" : "s"} from someone other than its author before it can be merged.`,
    });
  for (const check of rule?.requiredChecks ?? []) {
    const s = checkStatus(host, pr, check);
    if (s !== "pass")
      out.push({
        message: s === "fail" ? `Required check failing: ${check}` : `Required check missing: ${check}`,
        explain:
          s === "fail"
            ? `The "${check}" check (a GitHub Actions job) failed on the latest commit. Read why with gh run list and gh run view <id> --log, fix it on ${pr.head}, and push.`
            : `The "${check}" check must pass before merging, but it hasn't run on the latest commit. Make sure a workflow in .github/workflows has a job named ${check} that runs on pull_request.`,
      });
  }
  if (githubMerge(world, host, pr).conflicts.length)
    out.push({
      message: "Merge conflicts: this branch has conflicts that must be resolved",
      explain: `${pr.base} changed the same lines as your branch since you started. Locally: git switch ${pr.head}, git pull, git merge origin/${pr.base}, fix the conflicts, commit, then git push. The pull request updates itself.`,
    });
  return out;
}

/* --------------------------------------------------------------------- pr */

function prCreate(ctx: Ctx, args: string[]) {
  const host = requireHost(ctx);
  const repo = ctx.world.repo!;
  const p = parseFlags("pr create", args, {
    values: { title: ["-t"], body: ["-b"], base: ["-B"], head: ["-H"] },
    bools: { fill: ["-f"], draft: ["-d"], web: ["-w"] },
  });
  const head = val(p, "head") ?? currentBranch(repo);
  if (!head) fail("could not determine the current branch: you are in detached HEAD", "Switch to the branch you want to propose, e.g. git switch my-feature.");
  const base = val(p, "base") ?? host.defaultBranch;
  if (head === base)
    fail(
      `head branch "${head}" is the same as base branch "${base}", cannot create a pull request`,
      `A pull request proposes merging one branch into another. Create a branch for your change first: git switch -c my-change, commit, push it, then run gh pr create.`,
    );
  const headId = host.branches[head];
  if (!headId)
    fail(
      [`aborted: you must first push the current branch to a remote, or use the --head flag`],
      `GitHub doesn't have the branch "${head}" yet, so there's nothing to open a pull request from. Push it first: git push -u origin ${head}`,
    );
  const baseId = host.branches[base];
  if (!baseId) fail(`GraphQL: Base ref must be a branch (createPullRequest)`, `There's no branch called "${base}" on GitHub.`);
  if (hostedAncestors(ctx.world, baseId).has(headId))
    fail(
      `pull request create failed: GraphQL: No commits between ${base} and ${head} (createPullRequest)`,
      `${head} has nothing that ${base} doesn't already have. Commit your change on ${head} and push it before opening the pull request.`,
    );
  const existing = (host.pulls ?? []).find((x) => x.head === head && x.base === base && x.state === "open");
  if (existing)
    fail(
      `a pull request for branch "${head}" into branch "${base}" already exists:\n${webUrl(host)}/pull/${existing.number}`,
      `There's already an open pull request for ${head}. New pushes to ${head} update it automatically; no need for a new one.`,
    );
  let title = val(p, "title");
  let body = val(p, "body");
  if (title === undefined && p.bools.has("fill")) {
    const [subject, ...rest] = ctx.world.hostedCommits[headId].message.split("\n");
    title = subject;
    body ??= rest.join("\n").trim();
  }
  if (!title)
    fail(
      ["must provide `--title` and `--body` (or `--fill`) when not running interactively", "", 'Usage: gh pr create --title "<title>" --body "<body>"'],
      'Give your pull request a title: gh pr create --title "Add login page" --body "What and why". Or use --fill to reuse your last commit message.',
    );
  const local = repo.branches[head];
  if (local && local !== headId && !hostedAncestors(ctx.world, headId).has(local))
    ctx.out(`Warning: ${head} has commits that aren't on GitHub yet. Run git push to include them.`, "warning");
  host.pulls = host.pulls ?? [];
  const pr: PullRequest = {
    number: nextNumber(host),
    title,
    body: body ?? "",
    author: ctx.world.user.name,
    head,
    base,
    headCommit: headId,
    state: "open",
    reviews: [],
  };
  host.pulls.push(pr);
  ctx.out(`\nCreating pull request for ${head} into ${base} in ${slug(host)}\n`, "muted");
  ctx.out(`${webUrl(host)}/pull/${pr.number}`, "success");
  const notes = autoReview(host, pr, false);
  if (notes.length) ctx.out(notes, "muted");
  triggerRuns(ctx.world, host, { event: "pull_request", branch: head, filterBranch: base, commit: headId, pr: pr.number });
}

function prList(ctx: Ctx, args: string[]) {
  const host = requireHost(ctx);
  const p = parseFlags("pr list", args, { values: { state: ["-s"], limit: ["-L"] } });
  const state = val(p, "state") ?? "open";
  if (!["open", "merged", "closed", "all"].includes(state))
    fail(`invalid argument "${state}" for "-s, --state" flag: valid values are {open|closed|merged|all}`);
  const pulls = (host.pulls ?? []).filter((x) => state === "all" || x.state === state).slice().reverse();
  if (!pulls.length) {
    ctx.out(`no ${state === "all" ? "" : state + " "}pull requests in ${slug(host)}`.replace("  ", " "));
    return;
  }
  ctx.out(`\nShowing ${pulls.length} of ${pulls.length} ${state === "all" ? "" : state + " "}pull request${pulls.length === 1 ? "" : "s"} in ${slug(host)}\n`.replace("  ", " "), "muted");
  const tw = Math.max(...pulls.map((x) => x.title.length));
  const hw = Math.max(...pulls.map((x) => x.head.length));
  for (const x of pulls) ctx.out(`#${String(x.number).padEnd(3)} ${x.title.padEnd(tw)}  ${x.head.padEnd(hw)}  ${x.state.toUpperCase()}`);
}

function prView(ctx: Ctx, args: string[]) {
  const host = requireHost(ctx);
  const p = parseFlags("pr view", args, { bools: { web: ["-w"], comments: ["-c"] } });
  const pr = findPr(ctx, host, p.pos[0]);
  const w = ctx.world;
  const base = host.branches[pr.base];
  const count = hostedCommitsBetween(w, base, pr.headCommit).length;
  const stateLabel = pr.state[0].toUpperCase() + pr.state.slice(1);
  ctx.out(`${pr.title} #${pr.number}`, "commit");
  ctx.out(
    pr.state === "merged"
      ? `${stateLabel} • ${pr.author} merged ${pr.head} into ${pr.base}${pr.mergedWith ? ` (${pr.mergedWith})` : ""}`
      : `${stateLabel} • ${pr.author} wants to merge ${count} commit${count === 1 ? "" : "s"} into ${pr.base} from ${pr.head}`,
    "muted",
  );
  ctx.out(`${pr.base} <- ${pr.head}`, "muted");
  ctx.out("");
  ctx.out(pr.body ? pr.body.split("\n").map((l) => "  " + l) : ["  No description provided"]);
  ctx.out("");
  if (pr.reviews.length) {
    ctx.out("Reviews:");
    for (const r of pr.reviews) {
      const verb = r.state === "approved" ? "approved" : r.state === "changes_requested" ? "requested changes" : "commented";
      ctx.out(`  ${r.author} ${verb}${r.body ? `: ${r.body}` : ""}`, r.state === "approved" ? "success" : r.state === "changes_requested" ? "error" : "out");
    }
  } else ctx.out("Reviews: none yet", "muted");
  const runs = (host.runs ?? []).filter((r) => r.commit === pr.headCommit && r.event === "pull_request");
  if (runs.length) {
    const jobs = runs.flatMap((r) => r.jobs);
    const failed = jobs.filter((j) => !j.ok);
    if (failed.length) ctx.out(`Checks: X ${failed.length} failing (${failed.map((j) => j.name).join(", ")}), ${jobs.length - failed.length} passing`, "error");
    else ctx.out(`Checks: ✓ ${jobs.length}/${jobs.length} passing`, "success");
  } else ctx.out("Checks: none", "muted");
  if (pr.state === "open") {
    const b = blockers(w, host, pr);
    if (!b.length) ctx.out("Merge: ✓ Ready to merge", "success");
    else for (const x of b) ctx.out(`Merge blocked: ${x.message}`, "warning");
  }
  ctx.out("");
  ctx.out(`View this pull request on GitHub: ${webUrl(host)}/pull/${pr.number}`, "muted");
}

function prDiff(ctx: Ctx, args: string[]) {
  const host = requireHost(ctx);
  const p = parseFlags("pr diff", args, { bools: { "name-only": [], color: [] } });
  const pr = findPr(ctx, host, p.pos[0]);
  const w = ctx.world;
  const baseTip = host.branches[pr.base];
  const mb = baseTip ? hostedMergeBase(w, baseTip, pr.headCommit) : null;
  const from = mb ? w.hostedCommits[mb].tree : {};
  const to = w.hostedCommits[pr.headCommit]?.tree ?? {};
  if (p.bools.has("name-only")) {
    ctx.out([...new Set([...Object.keys(from), ...Object.keys(to)])].filter((f) => from[f] !== to[f]).sort());
    return;
  }
  printTreeDiff(ctx, from, to);
}

function prCheckout(ctx: Ctx, args: string[]) {
  const host = requireHost(ctx);
  const p = parseFlags("pr checkout", args, {});
  if (!p.pos[0]) fail("argument required: pull request number", "Tell gh which pull request to check out, e.g. gh pr checkout 3.");
  const pr = findPr(ctx, host, p.pos[0]);
  const repo = ctx.world.repo!;
  if (!host.branches[pr.head])
    fail(`could not find branch "${pr.head}" on GitHub`, `The branch behind #${pr.number} was deleted on GitHub, so there's nothing to check out.`);
  const remote = Object.keys(repo.remotes).find((r) => repo.remotes[r] === host.url) ?? "origin";
  gitFetch(ctx, [remote]);
  if (repo.branches[pr.head]) {
    if (currentBranch(repo) !== pr.head) gitSwitch(ctx, [pr.head]);
    else ctx.out(`Already on '${pr.head}'`);
    if (repo.branches[pr.head] !== repo.remoteRefs[`${remote}/${pr.head}`]) gitMerge(ctx, ["--ff-only", `${remote}/${pr.head}`]);
  } else gitSwitch(ctx, [pr.head]);
}

function prReview(ctx: Ctx, args: string[]) {
  const host = requireHost(ctx);
  const p = parseFlags("pr review", args, {
    values: { body: ["-b"] },
    bools: { approve: ["-a"], "request-changes": ["-r"], comment: ["-c"] },
  });
  const pr = findPr(ctx, host, p.pos[0]);
  const kinds = (["approve", "request-changes", "comment"] as const).filter((k) => p.bools.has(k));
  if (kinds.length !== 1)
    fail(
      ["need exactly one of --approve, --request-changes, or --comment"],
      'Pick one: gh pr review 3 --approve, gh pr review 3 --request-changes -b "Please rename x", or gh pr review 3 --comment -b "Nice!".',
    );
  const kind = kinds[0];
  const body = val(p, "body") ?? "";
  if (pr.state !== "open") fail(`Pull request #${pr.number} is ${pr.state} and can't be reviewed`);
  if (kind !== "approve" && !body) fail(`body cannot be blank for ${kind} review`, `Explain what you think with -b "...". A review without words isn't much help.`);
  const me = ctx.world.user.name;
  if (pr.author === me && kind !== "comment")
    fail(
      `failed to create review: GraphQL: Review Can not ${kind === "approve" ? "approve" : "request changes on"} your own pull request (addPullRequestReview)`,
      "On GitHub you can't approve or block your own pull request: reviews exist so that someone else checks your work. You can still --comment.",
    );
  pr.reviews.push({ author: me, state: kind === "approve" ? "approved" : kind === "comment" ? "commented" : "changes_requested", body });
  if (kind === "approve") ctx.out(`✓ Approved pull request #${pr.number}`, "success");
  else if (kind === "request-changes") ctx.out(`+ Requested changes to pull request #${pr.number}`, "warning");
  else ctx.out(`- Reviewed pull request #${pr.number}`);
}

function prMerge(ctx: Ctx, args: string[]) {
  const host = requireHost(ctx);
  const w = ctx.world;
  const p = parseFlags("pr merge", args, {
    values: { subject: ["-t"], body: ["-b"] },
    bools: { merge: ["-m"], squash: ["-s"], rebase: ["-r"], "delete-branch": ["-d"] },
  });
  const strategies = STRATEGIES.filter((s) => p.bools.has(s));
  if (strategies.length !== 1)
    fail(
      [strategies.length ? "only one of --merge, --rebase, or --squash can be enabled" : "--merge, --rebase, or --squash required when not running interactively"],
      "Choose how GitHub combines the branch: --merge (keeps every commit plus a merge commit), --squash (one single commit) or --rebase (replays the commits on top, no merge commit).",
    );
  const strategy = strategies[0];
  const pr = findPr(ctx, host, p.pos[0]);
  if (pr.state !== "open")
    fail(`Pull request #${pr.number} (${pr.title}) ${pr.state === "merged" ? "was already merged" : "is closed"}`, pr.state === "merged" ? "It's already merged. Run git pull on the base branch to get the result locally." : `Reopen it first with gh pr reopen ${pr.number}.`);
  const blocked = blockers(w, host, pr);
  const conflict = blocked.find((b) => b.message.startsWith("Merge conflicts"));
  if (conflict)
    fail(
      [`X Pull request #${pr.number} is not mergeable: the merge commit cannot be cleanly created.`, "To have the pull request merged after all the requirements have been met, resolve the conflicts locally and push."],
      conflict.explain,
    );
  if (blocked.length)
    fail(
      [`X Pull request #${pr.number} is not mergeable: the base branch policy prohibits the merge.`, ...blocked.map((b) => `  - ${b.message}`)],
      blocked.map((b) => b.explain).join(" "),
    );
  const m = githubMerge(w, host, pr);
  const me = w.user.name;
  const merged = hostedCommitsBetween(w, m.baseTip, m.head);
  let tip: string;
  if (strategy === "merge") {
    const subject = val(p, "subject") ?? `Merge pull request #${pr.number} from ${host.owner}/${pr.head}`;
    const body = val(p, "body") ?? pr.title;
    tip = makeHostedCommit(w, m.tree, m.baseTip ? [m.baseTip, m.head] : [m.head], `${subject}\n\n${body}`, me).id;
  } else if (strategy === "squash") {
    const subject = val(p, "subject") ?? `${pr.title} (#${pr.number})`;
    const body = val(p, "body") ?? merged.map((c) => `* ${c.message.split("\n")[0]}`).join("\n");
    tip = makeHostedCommit(w, m.tree, m.baseTip ? [m.baseTip] : [], body ? `${subject}\n\n${body}` : subject, pr.author).id;
  } else {
    let cur = m.baseTip;
    for (const c of merged.filter((x) => x.parents.length <= 1)) {
      const parentTree = c.parents[0] ? w.hostedCommits[c.parents[0]].tree : {};
      const r = mergeTrees(parentTree, cur ? w.hostedCommits[cur].tree : {}, c.tree, pr.base, shortId(c.id));
      if (r.conflicts.length)
        fail(
          `X Pull request #${pr.number} is not mergeable: this branch can't be rebased.`,
          "Replaying these commits one by one on top of the base causes a conflict. Use --merge or --squash, or rebase locally and force-push the branch.",
        );
      cur = makeHostedCommit(w, r.tree, cur ? [cur] : [], c.message, c.author).id;
    }
    tip = cur!;
  }
  host.branches[pr.base] = tip;
  pr.state = "merged";
  pr.mergedWith = strategy;
  pr.mergeCommit = tip;
  const verb = strategy === "merge" ? "Merged" : strategy === "squash" ? "Squashed and merged" : "Rebased and merged";
  ctx.out(`✓ ${verb} pull request #${pr.number} (${pr.title})`, "success");
  const closed = new Set<number>();
  for (const text of [pr.title, pr.body, ...merged.map((c) => c.message)])
    for (const n of closeIssuesFrom(host, text, `#${pr.number}`)) closed.add(n);
  for (const n of closed) ctx.out(`✓ Closed issue #${n}`, "success");
  triggerRuns(w, host, { event: "push", branch: pr.base, filterBranch: pr.base, commit: tip });
  // other open PRs whose commits are now all on the base are merged too
  for (const other of host.pulls ?? [])
    if (other.state === "open" && other.base === pr.base && hostedAncestors(w, tip).has(other.headCommit)) {
      other.state = "merged";
      other.mergeCommit = tip;
    }
  if (p.bools.has("delete-branch")) {
    if (host.protection?.[pr.head]) ctx.out(`! Skipped deleting ${pr.head}: it is a protected branch`, "warning");
    else {
      delete host.branches[pr.head];
      const repo = w.repo!;
      if (repo.branches[pr.head]) {
        if (currentBranch(repo) === pr.head) gitSwitch(ctx, [pr.base]);
        delete repo.branches[pr.head];
        delete repo.upstream[pr.head];
        repo.branchOrder = repo.branchOrder.filter((b) => b !== pr.head);
        ctx.emit({ type: "branch-delete", name: pr.head });
      }
      ctx.out(`✓ Deleted branch ${pr.head}`, "success");
    }
  }
  ctx.out(`(Your local ${pr.base} doesn't have the merge yet: run git switch ${pr.base} && git pull)`, "muted");
}

function prClose(ctx: Ctx, args: string[], reopen: boolean) {
  const host = requireHost(ctx);
  const p = parseFlags(reopen ? "pr reopen" : "pr close", args, { values: { comment: ["-c"] }, bools: { "delete-branch": ["-d"] } });
  if (!p.pos[0]) fail("argument required: pull request number");
  const pr = findPr(ctx, host, p.pos[0]);
  if (reopen) {
    if (pr.state !== "closed") fail(`! Pull request #${pr.number} (${pr.title}) is ${pr.state === "open" ? "already open" : "merged and can't be reopened"}`);
    pr.state = "open";
    ctx.out(`✓ Reopened pull request #${pr.number} (${pr.title})`, "success");
    return;
  }
  if (pr.state !== "open") fail(`! Pull request #${pr.number} (${pr.title}) is already ${pr.state}`);
  pr.state = "closed";
  ctx.out(`✓ Closed pull request #${pr.number} (${pr.title})`, "success");
  if (p.bools.has("delete-branch") && !host.protection?.[pr.head]) {
    delete host.branches[pr.head];
    ctx.out(`✓ Deleted branch ${pr.head}`, "success");
  }
}

/* ----------------------------------------------------------------- issues */

function issueCmd(ctx: Ctx, sub: string | undefined, args: string[]) {
  const host = requireHost(ctx);
  host.issues = host.issues ?? [];
  if (sub === "create" || sub === "new") {
    const p = parseFlags("issue create", args, { values: { title: ["-t"], body: ["-b"], label: ["-l"], assignee: ["-a"] } });
    const title = val(p, "title");
    if (!title)
      fail(["must provide `--title` and `--body` when not running interactively"], 'Describe the problem: gh issue create --title "Login button is broken" --body "Steps to reproduce..."');
    const issue: Issue = {
      number: nextNumber(host),
      title,
      body: val(p, "body") ?? "",
      author: ctx.world.user.name,
      state: "open",
      labels: (p.values.label ?? []).flatMap((l) => l.split(",")).map((l) => l.trim()).filter(Boolean),
    };
    host.issues.push(issue);
    ctx.out(`\nCreating issue in ${slug(host)}\n`, "muted");
    ctx.out(`${webUrl(host)}/issues/${issue.number}`, "success");
    return;
  }
  if (sub === "list" || sub === "ls") {
    const p = parseFlags("issue list", args, { values: { state: ["-s"], label: ["-l"], limit: ["-L"] } });
    const state = val(p, "state") ?? "open";
    if (!["open", "closed", "all"].includes(state)) fail(`invalid argument "${state}" for "-s, --state" flag: valid values are {open|closed|all}`);
    const label = val(p, "label");
    const list = host.issues.filter((i) => (state === "all" || i.state === state) && (!label || i.labels.includes(label))).slice().reverse();
    const what = state === "all" ? "issues" : `${state} issues`;
    if (!list.length) {
      ctx.out(`no ${what} in ${slug(host)}`);
      return;
    }
    ctx.out(`\nShowing ${list.length} of ${list.length} ${what} in ${slug(host)}\n`, "muted");
    const tw = Math.max(...list.map((i) => i.title.length));
    for (const i of list) ctx.out(`#${String(i.number).padEnd(3)} ${i.state.toUpperCase().padEnd(6)}  ${i.title.padEnd(tw)}  ${i.labels.join(", ")}`.trimEnd());
    return;
  }
  if (sub === "view") {
    const p = parseFlags("issue view", args, { bools: { web: ["-w"], comments: ["-c"] } });
    const i = findIssue(host, p.pos[0]);
    ctx.out(`${i.title} #${i.number}`, "commit");
    ctx.out(`${i.state === "open" ? "Open" : "Closed"} • ${i.author} opened this issue${i.closedBy ? ` • closed by ${i.closedBy}` : ""}`, "muted");
    if (i.labels.length) ctx.out(`Labels: ${i.labels.join(", ")}`, "muted");
    ctx.out("");
    ctx.out(i.body ? i.body.split("\n").map((l) => "  " + l) : ["  No description provided"]);
    ctx.out("");
    ctx.out(`View this issue on GitHub: ${webUrl(host)}/issues/${i.number}`, "muted");
    return;
  }
  if (sub === "close" || sub === "reopen") {
    const p = parseFlags(`issue ${sub}`, args, { values: { comment: ["-c"], reason: ["-r"] } });
    const i = findIssue(host, p.pos[0]);
    if (sub === "close") {
      if (i.state === "closed") fail(`! Issue #${i.number} (${i.title}) is already closed`);
      i.state = "closed";
      ctx.out(`✓ Closed issue #${i.number} (${i.title})`, "success");
    } else {
      if (i.state === "open") fail(`! Issue #${i.number} (${i.title}) is already open`);
      i.state = "open";
      delete i.closedBy;
      ctx.out(`✓ Reopened issue #${i.number} (${i.title})`, "success");
    }
    return;
  }
  unknownSub("issue", sub, ["create", "list", "view", "close", "reopen"]);
}

/* --------------------------------------------------------------- releases */

function releaseCmd(ctx: Ctx, sub: string | undefined, args: string[]) {
  const host = requireHost(ctx);
  const w = ctx.world;
  host.releases = host.releases ?? [];
  if (sub === "create" || sub === "new") {
    const p = parseFlags("release create", args, {
      values: { title: ["-t"], notes: ["-n"], target: [] },
      bools: { "generate-notes": [], draft: ["-d"], prerelease: ["-p"], latest: [] },
    });
    const tag = p.pos[0];
    if (!tag) fail("could not create: no tag name provided", "Name the version to release, e.g. gh release create v1.0.0 (the tag must be pushed first).");
    if (host.releases.some((r) => r.tag === tag)) fail(`a release with the same tag name already exists: ${tag}`);
    const id = host.tags?.[tag];
    if (!id) {
      if (w.repo?.tags[tag])
        fail(
          `tag ${tag} exists locally but has not been pushed to ${slug(host)}, please push it before continuing`,
          `Your tag only exists on your computer. Publish it first: git push origin ${tag}, then create the release.`,
        );
      fail(
        `tag ${tag} doesn't exist on ${slug(host)}`,
        `A release is attached to a tag. Create and publish one first: git tag ${tag} && git push origin ${tag}`,
      );
    }
    let notes = val(p, "notes") ?? "";
    if (p.bools.has("generate-notes")) {
      const anc = hostedAncestors(w, id);
      const prev = [...host.releases].reverse().find((r) => host.tags?.[r.tag] && host.tags[r.tag] !== id && anc.has(host.tags[r.tag]));
      const commits = hostedCommitsBetween(w, prev ? host.tags![prev.tag] : undefined, id).reverse();
      const generated = [
        "## What's Changed",
        ...commits.map((c) => `* ${c.message.split("\n")[0]} by @${c.author}`),
        "",
        `**Full Changelog**: ${prev ? `${webUrl(host)}/compare/${prev.tag}...${tag}` : `${webUrl(host)}/commits/${tag}`}`,
      ].join("\n");
      notes = notes ? `${notes}\n\n${generated}` : generated;
    }
    host.releases.push({ tag, title: val(p, "title") ?? tag, notes, author: w.user.name });
    ctx.out(`${webUrl(host)}/releases/tag/${tag}`, "success");
    return;
  }
  if (sub === "list" || sub === "ls") {
    parseFlags("release list", args, { values: { limit: ["-L"] } });
    if (!host.releases.length) {
      ctx.out("no releases found");
      return;
    }
    const list = [...host.releases].reverse();
    const tw = Math.max(5, ...list.map((r) => r.title.length));
    ctx.out(`${"TITLE".padEnd(tw)}  TYPE    TAG NAME`, "muted");
    list.forEach((r, i) => ctx.out(`${r.title.padEnd(tw)}  ${(i === 0 ? "Latest" : "").padEnd(6)}  ${r.tag}`));
    return;
  }
  if (sub === "view") {
    const p = parseFlags("release view", args, { bools: { web: ["-w"] } });
    const r = p.pos[0] ? host.releases.find((x) => x.tag === p.pos[0]) : host.releases[host.releases.length - 1];
    if (!r) fail("release not found", "No release with that tag. Run gh release list.");
    ctx.out(r.title, "commit");
    ctx.out(`${r.author} released this · tag ${r.tag} (${shortId(host.tags?.[r.tag] ?? "")})`, "muted");
    ctx.out("");
    ctx.out(r.notes ? r.notes.split("\n").map((l) => "  " + l) : ["  No release notes"]);
    ctx.out("");
    ctx.out(`View on GitHub: ${webUrl(host)}/releases/tag/${r.tag}`, "muted");
    return;
  }
  unknownSub("release", sub, ["create", "list", "view"]);
}

/* ---------------------------------------------------------------- actions */

function findRun(host: HostedRepo, arg: string | undefined) {
  const runs = host.runs ?? [];
  if (!arg) {
    const last = runs[runs.length - 1];
    if (!last) fail("no runs found", "No workflow has run yet. Add a workflow file under .github/workflows/ and push.");
    return last;
  }
  const run = runs.find((r) => String(r.id) === arg);
  if (!run) fail(`could not find any workflow run with ID ${arg}`, "Run gh run list to see the run IDs.");
  return run;
}

function runCmd(ctx: Ctx, sub: string | undefined, args: string[]) {
  const host = requireHost(ctx);
  const runs = host.runs ?? [];
  if (sub === "list" || sub === "ls") {
    const p = parseFlags("run list", args, { values: { branch: ["-b"], workflow: ["-w"], limit: ["-L"], event: ["-e"] } });
    const b = val(p, "branch");
    const wf = val(p, "workflow");
    const ev = val(p, "event");
    const list = runs.filter((r) => (!b || r.branch === b) && (!wf || r.workflow === wf || r.file?.endsWith("/" + wf)) && (!ev || r.event === ev)).reverse();
    if (!list.length) {
      ctx.out("no runs found");
      return;
    }
    const ww = Math.max(8, ...list.map((r) => r.workflow.length));
    const bw = Math.max(6, ...list.map((r) => r.branch.length));
    ctx.out(`STATUS  ${"WORKFLOW".padEnd(ww)}  ${"BRANCH".padEnd(bw)}  EVENT         ID`, "muted");
    for (const r of list)
      ctx.out(`${(r.status === "success" ? "✓" : "X").padEnd(6)}  ${r.workflow.padEnd(ww)}  ${r.branch.padEnd(bw)}  ${r.event.padEnd(12)}  ${r.id}`, r.status === "success" ? "success" : "error");
    return;
  }
  if (sub === "view" || sub === "watch") {
    const p = parseFlags(`run ${sub}`, args, { bools: { log: [], "log-failed": [], verbose: ["-v"], "exit-status": [] }, values: { job: ["-j"] } });
    const run = findRun(host, p.pos[0]);
    const ok = run.status === "success";
    ctx.out(`${ok ? "✓" : "X"} ${run.branch} ${run.workflow} · ${run.id}`, ok ? "success" : "error");
    ctx.out(`Triggered via ${run.event}${run.pr ? ` (pull request #${run.pr})` : ""} · commit ${shortId(run.commit)}`, "muted");
    const showLog = p.bools.has("log") || p.bools.has("log-failed");
    if (showLog) {
      for (const j of run.jobs) {
        if (p.bools.has("log-failed") && j.ok) continue;
        for (const l of j.log) ctx.out(`${j.name}\t${l}`, j.ok ? "out" : "error");
      }
      return;
    }
    ctx.out("");
    ctx.out("JOBS");
    for (const j of run.jobs) ctx.out(`${j.ok ? "✓" : "X"} ${j.name}${j.log[0] === "skipped" ? " (skipped)" : ""}`, j.ok ? "success" : "error");
    if (!ok) {
      ctx.out("");
      ctx.out(`To see what failed, try: gh run view ${run.id} --log-failed`, "muted");
    }
    if (sub === "watch") ctx.out(`\nRun ${run.workflow} (${run.id}) completed with '${run.status}'`, "muted");
    if (p.bools.has("exit-status") && !ok) ctx.ok = false;
    return;
  }
  if (sub === "rerun") {
    const p = parseFlags("run rerun", args, { bools: { failed: [] } });
    const run = findRun(host, p.pos[0]);
    const tree = ctx.world.hostedCommits[run.commit]?.tree ?? {};
    const file = run.file && tree[run.file] !== undefined ? run.file : undefined;
    if (!file) fail(`could not rerun run ${run.id}: its workflow file is gone`);
    const wf = parseWorkflow(file, tree[file]);
    const pr = run.pr !== undefined ? host.pulls?.find((x) => x.number === run.pr) : undefined;
    const fresh = executeWorkflow(ctx.world, host, wf, {
      event: run.event,
      branch: run.branch,
      filterBranch: pr?.base ?? run.branch,
      commit: run.commit,
      pr: run.pr,
    });
    ctx.out(`✓ Requested rerun of run ${run.id}`, "success");
    ctx.out(`${fresh.status === "success" ? "✓" : "X"} New run ${fresh.id} finished: ${fresh.status}`, fresh.status === "success" ? "success" : "error");
    return;
  }
  unknownSub("run", sub, ["list", "view", "watch", "rerun"]);
}

/* ---------------------------------------------------------------- secrets */

function secretCmd(ctx: Ctx, sub: string | undefined, args: string[]) {
  const host = requireHost(ctx);
  host.secrets = host.secrets ?? {};
  if (sub === "set") {
    const p = parseFlags("secret set", args, { values: { body: ["-b"] } });
    const name = p.pos[0];
    if (!name) fail("must pass name argument", 'Usage: gh secret set NAME --body "value"');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || /^GITHUB_/i.test(name))
      fail("secret names can only contain letters, numbers, or _, must not start with a number or GITHUB_", "Use a name like API_TOKEN.");
    const body = val(p, "body");
    if (body === undefined) fail("--body required when not running interactively", `Give the value with --body: gh secret set ${name} --body "s3cr3t". It's stored encrypted and never shown again.`);
    host.secrets[name.toUpperCase()] = body;
    ctx.out(`✓ Set Actions secret ${name.toUpperCase()} for ${slug(host)}`, "success");
    return;
  }
  if (sub === "list" || sub === "ls") {
    const names = Object.keys(host.secrets).sort();
    if (!names.length) {
      ctx.out(`no secrets found for ${slug(host)}`);
      return;
    }
    const nw = Math.max(4, ...names.map((n) => n.length));
    ctx.out(`${"NAME".padEnd(nw)}  UPDATED`, "muted");
    for (const n of names) ctx.out(`${n.padEnd(nw)}  just now`);
    return;
  }
  if (sub === "delete" || sub === "remove") {
    const name = args.find((a) => !a.startsWith("-"));
    if (!name) fail("must pass name argument");
    const key = name.toUpperCase();
    if (!(key in host.secrets)) fail(`failed to delete secret ${key}: HTTP 404: Not Found`, "There's no secret with that name. Run gh secret list.");
    delete host.secrets[key];
    ctx.out(`✓ Deleted Actions secret ${key} from ${slug(host)}`, "success");
    return;
  }
  unknownSub("secret", sub, ["set", "list", "delete"]);
}

/* ------------------------------------------------------------------- misc */

function repoCmd(ctx: Ctx, sub: string | undefined) {
  if (sub !== "view") unknownSub("repo", sub, ["view"]);
  const host = requireHost(ctx);
  const tip = host.branches[host.defaultBranch];
  const openPrs = (host.pulls ?? []).filter((p) => p.state === "open").length;
  const openIssues = (host.issues ?? []).filter((i) => i.state === "open").length;
  ctx.out(slug(host), "commit");
  ctx.out(`Default branch: ${host.defaultBranch} · ${Object.keys(host.branches).length} branches · ${Object.keys(host.tags ?? {}).length} tags`, "muted");
  ctx.out(`Pull requests: ${openPrs} open · Issues: ${openIssues} open · Releases: ${(host.releases ?? []).length}`, "muted");
  const readme = tip ? ctx.world.hostedCommits[tip]?.tree["README.md"] : undefined;
  ctx.out("");
  ctx.out(readme ? readme.replace(/\n$/, "").split("\n") : ["This repository does not have a README"]);
  ctx.out("");
  ctx.out(`View this repository on GitHub: ${webUrl(host)}`, "muted");
}

function authCmd(ctx: Ctx, sub: string | undefined) {
  if (sub !== "status") unknownSub("auth", sub, ["status"]);
  const login = ctx.world.user.name.toLowerCase().replace(/\s+/g, "-");
  ctx.out("github.com");
  ctx.out(`  ✓ Logged in to github.com account ${login} (keyring)`, "success");
  ctx.out("  - Active account: true");
  ctx.out("  - Git operations protocol: https");
  ctx.out("  - Token: gho_************************************", "muted");
}

const TOP = ["pr", "issue", "release", "run", "secret", "repo", "auth", "help"];
const PR_SUBS = ["create", "list", "view", "diff", "checkout", "review", "merge", "close", "reopen"];

function unknownSub(cmd: string, sub: string | undefined, subs: string[]): never {
  if (!sub)
    fail([`Usage: gh ${cmd} <command> [flags]`, "", "Available commands:", ...subs.map((s) => `  ${s}`)], `gh ${cmd} needs a subcommand, for example gh ${cmd} ${subs[0]}.`);
  const guess = closest(sub, subs);
  fail(
    [`unknown command "${sub}" for "gh ${cmd}"`, ...(guess ? ["", "Did you mean this?", `\t${guess}`] : [])],
    guess ? `Typo? Try gh ${cmd} ${guess}.` : `gh ${cmd} supports: ${subs.join(", ")}.`,
  );
}

function help(ctx: Ctx) {
  ctx.out(
    [
      "Work seamlessly with GitHub from the command line.",
      "",
      "USAGE",
      "  gh <command> <subcommand> [flags]",
      "",
      "CORE COMMANDS",
      "  pr:          create | list | view | diff | checkout | review | merge | close | reopen",
      "  issue:       create | list | view | close | reopen",
      "  release:     create | list | view",
      "  run:         list | view | watch | rerun",
      "  secret:      set | list | delete",
      "  repo:        view",
      "  auth:        status",
      "",
      "EXAMPLES",
      '  $ gh pr create --title "Add login" --body "Adds the login page"',
      "  $ gh pr merge 1 --squash --delete-branch",
      "  $ gh run view --log-failed",
    ],
    "muted",
  );
}

/**
 * Simulated GitHub CLI (`gh`). Works against `world.hosted`, the simulated GitHub.
 */
export function runGh(ctx: Ctx, args: string[]): void {
  const [cmd, sub, ...rest] = args;
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") return help(ctx);
  if (cmd === "--version" || cmd === "version") return ctx.out("gh version 2.62.0 (gitverse simulator)");
  if (sub === "--help" || sub === "-h") return help(ctx);
  switch (cmd) {
    case "pr":
      switch (sub) {
        case "create":
        case "new":
          return prCreate(ctx, rest);
        case "list":
        case "ls":
          return prList(ctx, rest);
        case "view":
          return prView(ctx, rest);
        case "diff":
          return prDiff(ctx, rest);
        case "checkout":
        case "co":
          return prCheckout(ctx, rest);
        case "review":
          return prReview(ctx, rest);
        case "merge":
          return prMerge(ctx, rest);
        case "close":
          return prClose(ctx, rest, false);
        case "reopen":
          return prClose(ctx, rest, true);
      }
      return unknownSub("pr", sub, PR_SUBS);
    case "issue":
      return issueCmd(ctx, sub, rest);
    case "release":
      return releaseCmd(ctx, sub, rest);
    case "run":
      return runCmd(ctx, sub, rest);
    case "secret":
      return secretCmd(ctx, sub, rest);
    case "repo":
      return repoCmd(ctx, sub);
    case "auth":
      return authCmd(ctx, sub);
  }
  const guess = closest(cmd, TOP);
  fail(
    [`unknown command "${cmd}" for "gh"`, ...(guess ? ["", "Did you mean this?", `\t${guess}`] : []), "", "Run 'gh --help' for usage."],
    guess ? `Typo? Try gh ${guess}.` : "gh talks to GitHub: pull requests (gh pr), issues, releases, Actions runs (gh run) and secrets. Type gh help.",
  );
}
