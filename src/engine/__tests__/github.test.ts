import { describe, expect, it } from "vitest";
import { emptyWorld, execute, headCommit, runScript, type World } from "..";

const URL = "https://github.com/you/project.git";
const run = (w: World, ...c: string[]) => runScript(w, c);
const out = (r: ReturnType<typeof execute>) => r.lines.map((l) => l.text).join("\n");

function connected(): World {
  const w = emptyWorld({ "a.txt": "1\n" });
  w.hosted[URL] = { url: URL, owner: "you", name: "project", branches: {}, defaultBranch: "main" };
  return run(w, "git init", "git add .", "git commit -m one", `git remote add origin ${URL}`, "git push -u origin main");
}

/** A teammate clones the hosted repo, commits, and pushes. */
function teammatePush(w: World, file: string, content: string, branch = "main"): World {
  let mate = { ...emptyWorld(), hosted: structuredClone(w.hosted), hostedCommits: structuredClone(w.hostedCommits), clock: w.clock + 500, seq: w.seq };
  mate = run(mate, `git clone ${URL}`, ...(branch === "main" ? [] : [`git switch -c ${branch}`]));
  mate.workdir[file] = content;
  mate = run(mate, "git add .", "git commit -m teammate", branch === "main" ? "git push" : `git push -u origin ${branch}`);
  return { ...w, hosted: mate.hosted, hostedCommits: mate.hostedCommits, seq: mate.seq, clock: mate.clock };
}

describe("tracking branches", () => {
  it("git branch -u / --set-upstream-to / --unset-upstream", () => {
    let w = connected();
    w = run(w, "git branch --unset-upstream");
    expect(w.repo!.upstream.main).toBeUndefined();
    w = run(w, "git branch -u origin/main");
    expect(w.repo!.upstream.main).toBe("origin/main");
    expect(Object.keys(w.repo!.branches)).toEqual(["main"]); // no bogus local "origin/main" branch
    w = run(w, "git branch --unset-upstream", "git branch --set-upstream-to=origin/main main");
    expect(w.repo!.upstream.main).toBe("origin/main");
    expect(execute(w, "git branch -u origin/nope").ok).toBe(false);
  });

  it("git branch -vv shows ahead/behind", () => {
    let w = teammatePush(connected(), "b.txt", "b\n");
    w.workdir["a.txt"] = "2\n";
    w = run(w, "git commit -am mine", "git fetch");
    expect(out(execute(w, "git branch -vv"))).toMatch(/\[origin\/main: ahead 1, behind 1\]/);
  });

  it("log ranges show what GitHub has that you don't", () => {
    const w = run(teammatePush(connected(), "b.txt", "b\n"), "git fetch");
    const r = execute(w, "git log --oneline main..origin/main");
    expect(r.lines).toHaveLength(1);
    expect(out(r)).toMatch(/teammate/);
    expect(execute(w, "git log --oneline origin/main..main").lines).toHaveLength(0);
  });
});

describe("push", () => {
  it("deletes remote branches with --delete and :branch", () => {
    let w = run(connected(), "git switch -c feature", "git push -u origin feature", "git switch main");
    w = run(w, "git push origin --delete feature");
    expect(w.hosted[URL].branches.feature).toBeUndefined();
    expect(w.repo!.remoteRefs["origin/feature"]).toBeUndefined();
    w = run(w, "git push origin feature", "git push origin :feature");
    expect(w.hosted[URL].branches.feature).toBeUndefined();
    expect(execute(w, "git push origin --delete feature").ok).toBe(false); // doesn't exist any more
  });

  it("refuses to delete GitHub's default branch", () => {
    const w = run(connected(), "git switch -c other", "git push origin other");
    const r = execute(w, "git push origin --delete main");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/refusing to delete the current branch/);
  });

  it("publishes tags, and fetch brings them to teammates", () => {
    let w = run(connected(), "git tag v1.0");
    w = run(w, "git push origin v1.0");
    expect(w.hosted[URL].tags?.["v1.0"]).toBe(w.repo!.tags["v1.0"]);
    w = run(w, "git tag v1.1", "git push --tags");
    expect(Object.keys(w.hosted[URL].tags!)).toEqual(["v1.0", "v1.1"]);
    let mate = { ...emptyWorld(), hosted: w.hosted, hostedCommits: w.hostedCommits };
    mate = run(mate, `git clone ${URL}`, "git fetch");
    expect(Object.keys(mate.repo!.tags).sort()).toEqual(["v1.0", "v1.1"]);
  });

  it("rejects unknown options instead of ignoring them", () => {
    expect(execute(connected(), "git push --frobnicate").ok).toBe(false);
  });

  it("force-push overwrites a diverged remote branch", () => {
    let w = teammatePush(connected(), "b.txt", "b\n");
    w.workdir["a.txt"] = "mine\n";
    w = run(w, "git commit -am mine");
    expect(execute(w, "git push").ok).toBe(false);
    const r = execute(w, "git push --force");
    expect(r.ok).toBe(true);
    expect(out(r)).toMatch(/forced update/);
    expect(r.world.hosted[URL].branches.main).toBe(r.world.repo!.branches.main);
  });
});

describe("fetch & pull", () => {
  it("--prune removes refs to branches deleted on GitHub", () => {
    let w = teammatePush(connected(), "f.txt", "f\n", "feature");
    w = run(w, "git fetch");
    expect(w.repo!.remoteRefs["origin/feature"]).toBeDefined();
    delete w.hosted[URL].branches.feature; // deleted on GitHub (e.g. after a PR merge)
    w = run(w, "git fetch");
    expect(w.repo!.remoteRefs["origin/feature"]).toBeDefined(); // git keeps stale refs…
    w = run(w, "git fetch --prune");
    expect(w.repo!.remoteRefs["origin/feature"]).toBeUndefined(); // …until you prune
  });

  it("switching to a branch that only exists on GitHub creates a tracking branch", () => {
    const w = run(teammatePush(connected(), "f.txt", "f\n", "feature"), "git fetch", "git switch feature");
    expect(w.repo!.upstream.feature).toBe("origin/feature");
    expect(w.workdir["f.txt"]).toBe("f\n");
  });

  it("pull with conflicting changes stops for resolution, then push works", () => {
    let w = teammatePush(connected(), "a.txt", "theirs\n");
    w.workdir["a.txt"] = "mine\n";
    w = run(w, "git commit -am mine");
    const r = execute(w, "git pull");
    expect(r.ok).toBe(false);
    expect(r.world.repo!.op?.conflicts).toEqual(["a.txt"]);
    w = r.world;
    w.workdir["a.txt"] = "both\n";
    w = run(w, "git add a.txt", "git commit --no-edit", "git push");
    expect(headCommit(w.repo!)!.parents).toHaveLength(2);
    expect(w.hosted[URL].branches.main).toBe(w.repo!.branches.main);
  });

  it("pull --rebase replays local work on top of GitHub's", () => {
    let w = teammatePush(connected(), "b.txt", "b\n");
    w.workdir["a.txt"] = "mine\n";
    w = run(w, "git commit -am mine", "git pull --rebase", "git push");
    const head = headCommit(w.repo!)!;
    expect(head.parents).toHaveLength(1);
    expect(w.repo!.commits[head.parents[0]].message).toBe("teammate"); // linear: my commit sits on top of theirs
    expect(w.workdir["b.txt"]).toBe("b\n");
    expect(w.hosted[URL].branches.main).toBe(head.id);
  });
});

describe("remote management", () => {
  it("rename, get-url, set-url, show", () => {
    let w = run(connected(), "git remote rename origin upstream");
    expect(w.repo!.remotes.upstream).toBe(URL);
    expect(w.repo!.remoteRefs["upstream/main"]).toBeDefined();
    expect(w.repo!.upstream.main).toBe("upstream/main");
    expect(out(execute(w, "git remote get-url upstream"))).toBe(URL);
    w = run(w, "git remote set-url upstream https://github.com/you/renamed.git");
    expect(w.repo!.remotes.upstream).toBe("https://github.com/you/renamed.git");
    expect(out(execute(connected(), "git remote show origin"))).toMatch(/HEAD branch: main[\s\S]*main\s+merges with remote main/);
  });
});
