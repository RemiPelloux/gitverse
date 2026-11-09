import { describe, expect, it } from "vitest";
import { emptyWorld, execute, runScript, type HostedRepo, type World } from "..";
import { parseYaml } from "../github/yaml";
import { parseWorkflow } from "../github/actions";

const URL = "https://github.com/you/project.git";
const run = (w: World, ...c: string[]) => runScript(w, c);
const out = (r: ReturnType<typeof execute>) => r.lines.map((l) => l.text).join("\n");
const host = (w: World): HostedRepo => w.hosted[URL];
const tip = (w: World, b: string) => w.hostedCommits[host(w).branches[b]];

function connected(files: Record<string, string> = { "app.txt": "hello\n" }, extra: Partial<HostedRepo> = {}): World {
  const w = emptyWorld(files);
  w.hosted[URL] = { url: URL, owner: "you", name: "project", branches: {}, defaultBranch: "main" };
  const r = run(w, "git init", "git add .", "git commit -m init", `git remote add origin ${URL}`, "git push -u origin main");
  Object.assign(r.hosted[URL], extra);
  return r;
}

/** Commit `file` on a new branch and push it. */
function feature(w: World, branch: string, file: string, content: string, msg = `change ${file}`): World {
  w = run(w, `git switch -c ${branch}`);
  w = { ...w, workdir: { ...w.workdir, [file]: content } };
  return run(w, "git add .", `git commit -m "${msg}"`, `git push -u origin ${branch}`);
}

function edit(w: World, file: string, content: string, msg: string): World {
  w = { ...w, workdir: { ...w.workdir, [file]: content } };
  return run(w, "git add .", `git commit -m "${msg}"`);
}

/** A teammate clones, commits on `branch` and pushes (bypassing any local state). */
function teammatePush(w: World, file: string, content: string, branch = "main", msg = "teammate"): World {
  let mate: World = { ...emptyWorld(), hosted: structuredClone(w.hosted), hostedCommits: structuredClone(w.hostedCommits), clock: w.clock + 500, seq: w.seq };
  mate.user = { name: "Maya", email: "maya@x.dev" };
  // let the teammate push even to protected branches (an admin)
  const prot = mate.hosted[URL].protection;
  delete mate.hosted[URL].protection;
  const exists = !!mate.hosted[URL].branches[branch];
  mate = run(mate, `git clone ${URL}`, ...(branch === "main" ? [] : [exists ? `git switch ${branch}` : `git switch -c ${branch}`]));
  mate.workdir[file] = content;
  mate = run(mate, "git add .", `git commit -m "${msg}"`, exists ? "git push" : `git push -u origin ${branch}`);
  if (prot) mate.hosted[URL].protection = prot;
  return { ...w, hosted: mate.hosted, hostedCommits: mate.hostedCommits, seq: mate.seq, clock: mate.clock };
}

const CI = `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check the app
        run: cat app.txt
`;

describe("gh basics", () => {
  it("help, version, auth, unknown commands with suggestions", () => {
    const w = connected();
    expect(out(execute(w, "gh"))).toMatch(/pr:.*create/);
    expect(out(execute(w, "gh auth status"))).toMatch(/Logged in to github.com account you/);
    const r = execute(w, "gh prr list");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/Did you mean this\?\n\tpr/);
    expect(out(execute(w, "gh pr mrege 1"))).toMatch(/\tmerge/);
    expect(execute(w, "gh pr create --bogus").ok).toBe(false);
  });

  it("needs a repository with a remote", () => {
    expect(out(execute(emptyWorld(), "gh pr list"))).toMatch(/not a git repository/);
    const w = run(emptyWorld({ a: "1" }), "git init");
    expect(out(execute(w, "gh pr list"))).toMatch(/no git remotes found/);
  });

  it("gh repo view", () => {
    const w = connected({ "README.md": "# Project\nHi\n" });
    const o = out(execute(w, "gh repo view"));
    expect(o).toMatch(/you\/project/);
    expect(o).toMatch(/Default branch: main/);
    expect(o).toMatch(/# Project/);
  });
});

describe("gh pr create / list / view / diff", () => {
  it("requires a pushed branch with new commits", () => {
    let w = connected();
    expect(out(execute(w, 'gh pr create --title "x"'))).toMatch(/same as base branch/);
    w = run(w, "git switch -c feat");
    w = edit(w, "app.txt", "hi\n", "local only");
    const r = execute(w, 'gh pr create --title "x"');
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/git push -u origin feat/);
    w = run(w, "git switch main", "git switch -c empty", "git push -u origin empty");
    expect(out(execute(w, 'gh pr create --title "x"'))).toMatch(/No commits between main and empty/);
  });

  it("creates a numbered PR, refuses duplicates, needs a title", () => {
    let w = feature(connected(), "feat", "app.txt", "hi\n");
    expect(out(execute(w, "gh pr create"))).toMatch(/must provide `--title`/);
    const r = execute(w, 'gh pr create --title "Say hi" --body "Because"');
    expect(r.ok).toBe(true);
    expect(out(r)).toMatch(/https:\/\/github.com\/you\/project\/pull\/1/);
    w = r.world;
    const pr = host(w).pulls![0];
    expect(pr).toMatchObject({ number: 1, title: "Say hi", head: "feat", base: "main", state: "open", author: "You" });
    expect(pr.headCommit).toBe(host(w).branches.feat);
    expect(out(execute(w, 'gh pr create -t "again"'))).toMatch(/already exists/);
    // numbers are shared with issues
    w = run(w, 'gh issue create --title "bug"');
    expect(host(w).issues![0].number).toBe(2);
  });

  it("--fill uses the last commit message", () => {
    const w = run(feature(connected(), "feat", "app.txt", "hi\n", "Greet users"), "gh pr create --fill");
    expect(host(w).pulls![0].title).toBe("Greet users");
  });

  it("auto reviewers approve new pull requests", () => {
    const w = feature(connected(undefined, { autoReviewers: ["Maya", "You"] }), "feat", "app.txt", "hi\n");
    const r = execute(w, 'gh pr create -t "x"');
    expect(out(r)).toMatch(/Maya approved these changes/);
    expect(r.world.hosted[URL].pulls![0].reviews).toEqual([expect.objectContaining({ author: "Maya", state: "approved" })]);
  });

  it("lists, views and diffs", () => {
    let w = run(feature(connected(), "feat", "app.txt", "hi\n"), 'gh pr create -t "Say hi" -b "Body text"');
    expect(out(execute(w, "gh pr list"))).toMatch(/#1\s+Say hi\s+feat\s+OPEN/);
    expect(out(execute(w, "gh pr list --state merged"))).toMatch(/no merged pull requests/);
    const v = out(execute(w, "gh pr view"));
    expect(v).toMatch(/Say hi #1/);
    expect(v).toMatch(/main <- feat/);
    expect(v).toMatch(/Body text/);
    expect(v).toMatch(/Ready to merge/);
    expect(out(execute(w, "gh pr view 1"))).toMatch(/1 commit into main/);
    const d = out(execute(w, "gh pr diff 1"));
    expect(d).toMatch(/-hello/);
    expect(d).toMatch(/\+hi/);
    w = run(w, "git switch main");
    expect(out(execute(w, "gh pr view"))).toMatch(/no pull requests found for branch "main"/);
    expect(execute(w, "gh pr view 9").ok).toBe(false);
  });
});

describe("branch protection", () => {
  const prot = { protection: { main: { requirePullRequest: true, requiredApprovals: 1, requiredChecks: [] } } };

  it("rejects direct pushes to a protected branch", () => {
    let w = connected(undefined, prot);
    w = edit(w, "app.txt", "direct\n", "direct");
    const before = host(w).branches.main;
    const r = execute(w, "git push");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/GH006: Protected branch update failed for refs\/heads\/main/);
    expect(out(r)).toMatch(/! \[remote rejected\] main -> main \(protected branch hook declined\)/);
    expect(r.explain).toMatch(/pull request/);
    expect(r.world.hosted[URL].branches.main).toBe(before);
    // pushing a branch is fine
    expect(execute(w, "git push origin main:fix").ok).toBe(true);
  });

  it("refuses to delete a protected branch", () => {
    const w = run(connected(undefined, prot), "git switch -c other", "git push origin other");
    const r = execute(w, "git push origin --delete main");
    expect(out(r)).toMatch(/Cannot delete this protected branch/);
  });

  it("blocks merging without the required approvals; teammates' PRs can be approved", () => {
    let w = run(feature(connected(undefined, prot), "feat", "app.txt", "hi\n"), 'gh pr create -t "mine"');
    const r = execute(w, "gh pr merge 1 --merge");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/Review required: 0\/1/);
    expect(r.explain).toMatch(/approving review/);
    expect(out(execute(w, "gh pr review 1 --approve"))).toMatch(/Can not approve your own pull request/);
    expect(out(execute(w, 'gh pr review 1 --request-changes -b "no"'))).toMatch(/Can not request changes on your own pull request/);

    // Maya opens a PR; we review it
    w = teammatePush(w, "maya.txt", "m\n", "maya-branch");
    w.hosted[URL].pulls!.push({ number: 2, title: "Maya's", body: "", author: "Maya", head: "maya-branch", base: "main", headCommit: w.hosted[URL].branches["maya-branch"], state: "open", reviews: [] });
    expect(out(execute(w, "gh pr review 2 --request-changes"))).toMatch(/body cannot be blank/);
    w = run(w, 'gh pr review 2 --comment -b "nice"');
    expect(execute(w, "gh pr merge 2 --squash").ok).toBe(false); // a comment is not an approval
    w = run(w, "gh pr review 2 --approve");
    expect(out(execute(w, "gh pr view 2"))).toMatch(/Ready to merge/);
    w = run(w, "gh pr merge 2 --squash");
    expect(host(w).pulls![1].state).toBe("merged");
  });
});

describe("gh pr merge strategies", () => {
  function setup() {
    let w = connected({ "app.txt": "hello\n", "b.txt": "b\n" });
    w = feature(w, "feat", "f1.txt", "1\n", "first");
    w = edit(w, "f2.txt", "2\n", "second");
    w = run(w, "git push", 'gh pr create -t "Feature" -b "body"');
    w = teammatePush(w, "b.txt", "B\n"); // base moves, no conflict
    return w;
  }

  it("requires exactly one strategy", () => {
    const w = setup();
    expect(out(execute(w, "gh pr merge 1"))).toMatch(/--merge, --rebase, or --squash required/);
    expect(out(execute(w, "gh pr merge 1 --merge --squash"))).toMatch(/only one of/);
  });

  it("--merge creates a merge commit with both parents", () => {
    const before = setup();
    const w = run(before, "gh pr merge 1 --merge");
    const m = tip(w, "main");
    expect(m.parents).toEqual([host(before).branches.main, host(before).branches.feat]);
    expect(m.message).toBe("Merge pull request #1 from you/feat\n\nFeature");
    expect(m.tree).toMatchObject({ "b.txt": "B\n", "f1.txt": "1\n", "f2.txt": "2\n" });
    expect(host(w).pulls![0]).toMatchObject({ state: "merged", mergedWith: "merge", mergeCommit: m.id });
    // the local repo doesn't know yet
    expect(w.repo!.remoteRefs["origin/main"]).not.toBe(m.id);
    const pulled = run(w, "git switch main", "git pull");
    expect(pulled.repo!.branches.main).toBe(m.id);
  });

  it("--squash creates a single commit", () => {
    const before = setup();
    const w = run(before, "gh pr merge 1 --squash");
    const s = tip(w, "main");
    expect(s.parents).toEqual([host(before).branches.main]);
    expect(s.message.split("\n")[0]).toBe("Feature (#1)");
    expect(s.tree).toMatchObject({ "b.txt": "B\n", "f1.txt": "1\n", "f2.txt": "2\n" });
  });

  it("--rebase replays each commit on top of the base", () => {
    const before = setup();
    const w = run(before, "gh pr merge 1 --rebase");
    const second = tip(w, "main");
    const first = w.hostedCommits[second.parents[0]];
    expect([first.message, second.message]).toEqual(["first", "second"]);
    expect(first.parents).toEqual([host(before).branches.main]);
    expect(second.id).not.toBe(host(before).branches.feat);
    expect(second.tree).toMatchObject({ "b.txt": "B\n", "f2.txt": "2\n" });
  });

  it("--delete-branch removes the remote and local branch and switches to base", () => {
    const r = execute(setup(), "gh pr merge 1 --squash --delete-branch");
    expect(r.ok).toBe(true);
    expect(out(r)).toMatch(/✓ Squashed and merged pull request #1 \(Feature\)/);
    expect(out(r)).toMatch(/✓ Deleted branch feat/);
    expect(r.world.hosted[URL].branches.feat).toBeUndefined();
    expect(r.world.repo!.branches.feat).toBeUndefined();
    expect(r.world.repo!.head).toEqual({ kind: "branch", name: "main" });
    expect(execute(r.world, "gh pr merge 1 --squash").ok).toBe(false); // already merged
  });

  it("blocks merging when the base conflicts, until the branch is updated", () => {
    let w = feature(connected(), "feat", "app.txt", "mine\n");
    w = run(w, 'gh pr create -t "x"');
    w = teammatePush(w, "app.txt", "theirs\n");
    const r = execute(w, "gh pr merge 1 --merge");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/not mergeable: the merge commit cannot be cleanly created/);
    expect(r.explain).toMatch(/git merge origin\/main/);
    expect(out(execute(w, "gh pr view 1"))).toMatch(/Merge conflicts/);
    // resolve locally and push: the PR updates itself
    w = run(w, "git fetch");
    const conflicted = execute(w, "git merge origin/main");
    expect(conflicted.ok).toBe(false);
    w = conflicted.world;
    w = { ...w, workdir: { ...w.workdir, "app.txt": "both\n" } };
    w = run(w, "git add .", "git commit -m resolve", "git push");
    expect(host(w).pulls![0].headCommit).toBe(host(w).branches.feat);
    w = run(w, "gh pr merge 1 --merge");
    expect(tip(w, "main").tree["app.txt"]).toBe("both\n");
  });

  it("closes issues referenced by closing keywords", () => {
    let w = run(connected(), 'gh issue create -t "Bug one"', 'gh issue create -t "Bug two"', 'gh issue create -t "Other"');
    w = feature(w, "fix", "app.txt", "fixed\n", "Fix crash, fixes #2");
    w = run(w, 'gh pr create -t "Fix things" -b "Closes #1"');
    const r = execute(w, "gh pr merge 4 --merge");
    expect(out(r)).toMatch(/Closed issue #1/);
    const issues = r.world.hosted[URL].issues!;
    expect(issues.map((i) => [i.state, i.closedBy])).toEqual([["closed", "#4"], ["closed", "#4"], ["open", undefined]]);
  });

  it("pr close / reopen", () => {
    let w = run(feature(connected(), "feat", "app.txt", "hi\n"), 'gh pr create -t "x"');
    w = run(w, "gh pr close 1");
    expect(host(w).pulls![0].state).toBe("closed");
    expect(execute(w, "gh pr merge 1 --merge").ok).toBe(false);
    expect(out(execute(w, "gh pr list --state closed"))).toMatch(/CLOSED/);
    w = run(w, "gh pr reopen 1");
    expect(host(w).pulls![0].state).toBe("open");
  });
});

describe("reviews and updates", () => {
  it("pushing to the head branch updates the PR and auto reviewers re-approve", () => {
    let w = feature(connected(undefined, { autoReviewers: ["Maya"] }), "feat", "app.txt", "hi\n");
    w = run(w, 'gh pr create -t "x"');
    // Maya changes her mind
    host(w).pulls![0].reviews.push({ author: "Maya", state: "changes_requested", body: "Please add tests" });
    host(w).protection = { main: { requirePullRequest: true, requiredApprovals: 1, requiredChecks: [] } };
    const blocked = execute(w, "gh pr merge 1 --merge");
    expect(out(blocked)).toMatch(/Changes requested by Maya/);
    w = edit(w, "test.txt", "ok\n", "add tests");
    const r = execute(w, "git push");
    expect(out(r)).toMatch(/Maya approved these changes/);
    w = r.world;
    const pr = host(w).pulls![0];
    expect(pr.headCommit).toBe(host(w).branches.feat);
    expect(pr.reviews.map((x) => x.state)).toEqual(["approved", "changes_requested", "approved"]);
    expect(execute(w, "gh pr merge 1 --merge").ok).toBe(true);
  });

  it("merging locally and pushing the base marks the PR as merged", () => {
    let w = run(feature(connected(), "feat", "app.txt", "hi\n"), 'gh pr create -t "x"');
    w = run(w, "git switch main", "git merge feat", "git push");
    expect(host(w).pulls![0].state).toBe("merged");
  });

  it("gh pr checkout fetches and tracks the PR branch", () => {
    let w = connected();
    w = teammatePush(w, "maya.txt", "m\n", "maya-branch");
    w.hosted[URL].pulls = [{ number: 1, title: "Maya's", body: "", author: "Maya", head: "maya-branch", base: "main", headCommit: w.hosted[URL].branches["maya-branch"], state: "open", reviews: [] }];
    const r = execute(w, "gh pr checkout 1");
    expect(r.ok).toBe(true);
    expect(r.world.repo!.head).toEqual({ kind: "branch", name: "maya-branch" });
    expect(r.world.repo!.upstream["maya-branch"]).toBe("origin/maya-branch");
    expect(r.world.workdir["maya.txt"]).toBe("m\n");
    // she pushes more; checking out again fast-forwards
    let w2 = teammatePush(r.world, "maya.txt", "m2\n", "maya-branch");
    w2 = run(w2, "git switch main", "gh pr checkout 1");
    expect(w2.workdir["maya.txt"]).toBe("m2\n");
  });
});

describe("issues", () => {
  it("create / list / view / close / reopen", () => {
    let w = connected();
    expect(out(execute(w, "gh issue list"))).toMatch(/no open issues/);
    const r = execute(w, 'gh issue create --title "Broken button" --body "It does nothing" --label bug,ui');
    expect(out(r)).toMatch(/\/issues\/1$/m);
    w = r.world;
    expect(host(w).issues![0].labels).toEqual(["bug", "ui"]);
    expect(out(execute(w, "gh issue list"))).toMatch(/#1\s+OPEN\s+Broken button\s+bug, ui/);
    expect(out(execute(w, "gh issue view 1"))).toMatch(/It does nothing/);
    w = run(w, "gh issue close 1");
    expect(out(execute(w, "gh issue list"))).toMatch(/no open issues/);
    expect(out(execute(w, "gh issue list --state closed"))).toMatch(/Broken button/);
    expect(execute(w, "gh issue close 1").ok).toBe(false);
    w = run(w, "gh issue reopen #1");
    expect(host(w).issues![0].state).toBe("open");
    expect(execute(w, "gh issue view 7").ok).toBe(false);
  });

  it("a push to the default branch with 'fixes #n' closes the issue", () => {
    let w = run(connected(), 'gh issue create -t "Typo"');
    w = edit(w, "app.txt", "hellO\n", "Fix typo (fixes #1)");
    w = run(w, "git push");
    const issue = host(w).issues![0];
    expect(issue.state).toBe("closed");
    expect(issue.closedBy).toBe(w.repo!.branches.main.slice(0, 7));
  });

  it("a push to another branch does not close issues", () => {
    let w = run(connected(), 'gh issue create -t "Typo"');
    w = feature(w, "fix", "app.txt", "x\n", "closes #1");
    expect(host(w).issues![0].state).toBe("open");
  });
});

describe("releases", () => {
  it("requires the tag to be pushed", () => {
    let w = run(connected(), "git tag v1.0");
    const r = execute(w, "gh release create v1.0");
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/git push origin v1.0/);
    expect(out(execute(w, "gh release create v9"))).toMatch(/doesn't exist/);
    w = run(w, "git push origin v1.0", 'gh release create v1.0 --title "First" --notes "Hello"');
    expect(host(w).releases).toEqual([{ tag: "v1.0", title: "First", notes: "Hello", author: "You" }]);
    expect(execute(w, "gh release create v1.0").ok).toBe(false);
    expect(out(execute(w, "gh release list"))).toMatch(/First\s+Latest\s+v1.0/);
    expect(out(execute(w, "gh release view v1.0"))).toMatch(/Hello/);
  });

  it("--generate-notes lists commits since the previous release", () => {
    let w = run(connected(), "git tag v1.0", "git push origin v1.0", "gh release create v1.0");
    w = edit(w, "a.txt", "a\n", "Add a");
    w = edit(w, "b.txt", "b\n", "Add b");
    w = run(w, "git push", "git tag v1.1", "git push origin v1.1", "gh release create v1.1 --generate-notes");
    const notes = host(w).releases![1].notes;
    expect(notes).toMatch(/\* Add b by @You\n\* Add a by @You/);
    expect(notes).not.toMatch(/init/);
    expect(notes).toMatch(/compare\/v1.0...v1.1/);
  });
});

describe("GitHub Actions", () => {
  it("parses the workflow YAML subset", () => {
    expect(parseYaml("a: 1\nb:\n  - x\n  - y: 2\n    z: '3'\nc: [p, q] # comment\nd: |\n  l1\n  l2\n")).toEqual({
      a: "1",
      b: ["x", { y: "2", z: "3" }],
      c: ["p", "q"],
      d: "l1\nl2\n",
    });
    const wf = parseWorkflow(".github/workflows/ci.yml", "on: [push, pull_request]\njobs:\n  build:\n    name: Build\n    steps:\n    - run: echo hi\n  deploy:\n    needs: build\n    steps:\n    - uses: x@v1\n");
    expect(wf.name).toBe("ci");
    expect(wf.on).toEqual({ push: [], pull_request: [] });
    expect(wf.jobs).toEqual([
      { id: "build", name: "Build", needs: [], steps: [{ name: undefined, uses: undefined, run: "echo hi" }] },
      { id: "deploy", name: "deploy", needs: ["build"], steps: [{ name: undefined, uses: "x@v1", run: undefined }] },
    ]);
  });

  it("runs workflows on push, honouring branch filters", () => {
    let w = connected({ "app.txt": "hello\n", ".github/workflows/ci.yml": CI });
    expect(host(w).runs).toHaveLength(1);
    expect(host(w).runs![0]).toMatchObject({ id: 1, workflow: "CI", event: "push", branch: "main", status: "success" });
    expect(host(w).runs![0].jobs[0].log).toContain("$ cat app.txt");
    expect(host(w).runs![0].jobs[0].log).toContain("hello");
    w = feature(w, "feat", "x.txt", "x\n"); // push filter is [main]: no run
    expect(host(w).runs).toHaveLength(1);
    w = run(w, 'gh pr create -t "x"'); // pull_request: runs for the PR
    expect(host(w).runs).toHaveLength(2);
    expect(host(w).runs![1]).toMatchObject({ event: "pull_request", branch: "feat", pr: 1 });
    const list = out(execute(w, "gh run list"));
    expect(list).toMatch(/✓\s+CI\s+feat\s+pull_request\s+2/);
    expect(out(execute(w, "gh run list --branch main"))).not.toMatch(/feat/);
    expect(out(execute(w, "gh run view 1"))).toMatch(/✓ test/);
    expect(out(execute(w, "gh run view 1 --log"))).toMatch(/test\t\$ cat app.txt/);
    expect(execute(w, "gh run view 99").ok).toBe(false);
  });

  it("required checks block merging until the job passes", () => {
    const failing = CI.replace("cat app.txt", "cat missing.txt");
    let w = connected({ "app.txt": "hello\n" }, { protection: { main: { requirePullRequest: true, requiredApprovals: 0, requiredChecks: ["test"] } } });
    w = feature(w, "ci", ".github/workflows/ci.yml", failing);
    w = run(w, 'gh pr create -t "Add CI"');
    const r = execute(w, "gh pr merge 1 --merge");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/Required check failing: test/);
    const view = out(execute(w, "gh run view 1"));
    expect(view).toMatch(/X test/);
    const log = out(execute(w, "gh run view 1 --log-failed"));
    expect(log).toMatch(/No such file or directory/);
    expect(log).toMatch(/exit code 1/);
    w = edit(w, ".github/workflows/ci.yml", CI, "fix ci");
    w = run(w, "git push");
    expect(host(w).runs!.at(-1)!.status).toBe("success");
    expect(execute(w, "gh pr merge 1 --merge").ok).toBe(true);
  });

  it("skips jobs whose needs failed", () => {
    const wf = "on: push\njobs:\n  build:\n    steps:\n      - run: cat nope\n  deploy:\n    needs: build\n    steps:\n      - run: echo deploy\n";
    const w = connected({ "app.txt": "x\n", ".github/workflows/d.yml": wf });
    expect(host(w).runs![0].jobs).toEqual([
      expect.objectContaining({ name: "build", ok: false }),
      { name: "deploy", ok: false, log: ["skipped"] },
    ]);
  });

  it("injects secrets and masks them in logs; rerun uses current secrets", () => {
    const wf = 'name: Deploy\non: push\njobs:\n  deploy:\n    steps:\n      - run: echo "using ${{ secrets.TOKEN }}"\n      - run: echo "token=${{ secrets.TOKEN }}" > out.txt && cat out.txt\n';
    let w = connected({ "app.txt": "x\n" });
    expect(out(execute(w, "gh secret list"))).toMatch(/no secrets/);
    const set = execute(w, 'gh secret set TOKEN --body "hunter2"');
    expect(out(set)).toMatch(/✓ Set Actions secret TOKEN/);
    expect(out(set)).not.toMatch(/hunter2/);
    w = set.world;
    expect(out(execute(w, "gh secret list"))).toMatch(/TOKEN/);
    expect(out(execute(w, "gh secret list"))).not.toMatch(/hunter2/);
    w = edit(w, ".github/workflows/deploy.yml", wf, "deploy");
    w = run(w, "git push");
    const log = host(w).runs![0].jobs[0].log;
    expect(log).toContain("$ echo \"using ***\"");
    expect(log).toContain("using ***");
    expect(log).toContain("token=***");
    expect(log.join("\n")).not.toMatch(/hunter2/);
    expect(out(execute(w, "gh run view 1 --log"))).not.toMatch(/hunter2/);
    w = run(w, "gh secret delete TOKEN");
    expect(host(w).secrets).toEqual({});
    expect(execute(w, "gh secret delete TOKEN").ok).toBe(false);
    const re = execute(w, "gh run rerun 1");
    expect(out(re)).toMatch(/New run 2/);
    expect(re.world.hosted[URL].runs![1].jobs[0].log).toContain("using ");
  });
});
