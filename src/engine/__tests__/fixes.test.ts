import { describe, expect, it } from "vitest";
import { emptyWorld, execute, headCommit, headCommitId, resolveRev, runScript, status, type World } from "..";
import { deserializeWorld, serializeWorld } from "../serialize";

const URL = "https://github.com/you/project.git";
const run = (w: World, ...cmds: string[]) => runScript(w, cmds);
const out = (r: ReturnType<typeof execute>) => r.lines.map((l) => l.text).join("\n");
const write = (w: World, files: Record<string, string>): World => ({ ...w, workdir: { ...w.workdir, ...files } });

function repoWith(files: Record<string, string> = { "a.txt": "one\n" }): World {
  return run(emptyWorld(files), "git init", "git add .", 'git commit -m "Initial commit"');
}

function commit(w: World, files: Record<string, string>, msg: string): World {
  return run(write(w, files), "git add .", `git commit -m "${msg}"`);
}

function connected(files: Record<string, string> = { "app.txt": "hello\n" }): World {
  const w = emptyWorld(files);
  w.hosted[URL] = { url: URL, owner: "you", name: "project", branches: {}, defaultBranch: "main" };
  return run(w, "git init", "git add .", "git commit -m init", `git remote add origin ${URL}`, "git push -u origin main");
}

/** A teammate pushes a commit to `main` on GitHub. */
function teammatePush(w: World, file: string, content: string, msg = "teammate"): World {
  let mate: World = { ...emptyWorld(), hosted: structuredClone(w.hosted), hostedCommits: structuredClone(w.hostedCommits), clock: w.clock + 500, seq: w.seq };
  mate.user = { name: "Maya", email: "maya@x.dev" };
  mate = run(mate, `git clone ${URL}`);
  mate = commit(mate, { [file]: content }, msg);
  mate = run(mate, "git push");
  return { ...w, hosted: mate.hosted, hostedCommits: mate.hostedCommits, seq: mate.seq, clock: mate.clock };
}

describe("annotated tags", () => {
  it("-a -m stores message, tagger and date; git show prints the tag header", () => {
    const w = run(repoWith(), 'git tag -a v1.0 -m "First release"');
    expect(w.repo!.tags["v1.0"]).toBe(headCommitId(w.repo!));
    expect(w.repo!.tagMeta?.["v1.0"]).toMatchObject({ message: "First release", tagger: "You <you@gitverse.dev>" });
    const lines = out(execute(w, "git show v1.0")).split("\n");
    expect(lines[0]).toBe("tag v1.0");
    expect(lines[1]).toBe("Tagger: You <you@gitverse.dev>");
    expect(lines[2]).toMatch(/^Date: {3}/);
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("First release");
    expect(lines[5]).toBe("");
    expect(lines[6]).toMatch(/^commit [0-9a-f]{40} \(HEAD -> main, tag: v1.0\)$/);
  });

  it("-m alone implies -a; lightweight tags show only the commit", () => {
    const w = run(repoWith(), 'git tag -m "msg" v1.0', "git tag v0.9");
    expect(w.repo!.tagMeta?.["v1.0"]?.message).toBe("msg");
    expect(w.repo!.tagMeta?.["v0.9"]).toBeUndefined();
    expect(out(execute(w, "git show v0.9"))).toMatch(/^commit /);
  });

  it("-am bundles work", () => {
    const w = run(repoWith(), 'git tag -am "bundled" v2');
    expect(w.repo!.tagMeta?.v2?.message).toBe("bundled");
  });

  it("-a without -m fails with an explanation (no editor)", () => {
    const r = execute(repoWith(), "git tag -a v1.0");
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/-m/);
    expect(r.world.repo!.tags["v1.0"]).toBeUndefined();
  });

  it("git tag -n lists the first message line (commit subject for lightweight tags)", () => {
    let w = run(repoWith(), 'git tag -a v1.0 -m "Release one"', "git tag light");
    expect(out(execute(w, "git tag -n"))).toBe(`${"light".padEnd(15)} Initial commit\n${"v1.0".padEnd(15)} Release one`);
    w = run(w, "git tag -d v1.0");
    expect(w.repo!.tagMeta?.["v1.0"]).toBeUndefined();
  });

  it("push keeps the metadata on GitHub and fetch brings it back", () => {
    let w = run(connected(), 'git tag -a v1.0 -m "Shipped"', "git push origin v1.0");
    expect(w.hosted[URL].tagMeta?.["v1.0"]?.message).toBe("Shipped");
    w = run(w, 'git tag -a v1.1 -m "Again"', "git tag v1.2", "git push --tags");
    expect(w.hosted[URL].tagMeta?.["v1.1"]?.message).toBe("Again");
    expect(w.hosted[URL].tagMeta?.["v1.2"]).toBeUndefined();
    // a teammate's clone + fetch sees the annotated tag
    let mate: World = { ...emptyWorld(), hosted: w.hosted, hostedCommits: w.hostedCommits };
    mate = run(mate, `git clone ${URL}`, "git fetch");
    expect(mate.repo!.tagMeta?.["v1.0"]?.message).toBe("Shipped");
    // gh release create --generate-notes still works
    const r = execute(w, "gh release create v1.0 --generate-notes");
    expect(r.ok).toBe(true);
    expect(r.world.hosted[URL].releases?.[0].notes).toMatch(/What's Changed/);
  });

  it("old worlds without tagMeta still load and tag", () => {
    const w = repoWith();
    delete w.repo!.tagMeta;
    const back = deserializeWorld(serializeWorld(w))!;
    expect(run(back, 'git tag -a v1 -m "x"').repo!.tagMeta?.v1?.message).toBe("x");
  });
});

describe("git tag -l / --contains", () => {
  it("lists tags matching a glob and never creates a tag called -l", () => {
    let w = run(repoWith(), "git tag v1.0", "git tag v1.1", "git tag v2.0");
    expect(out(execute(w, 'git tag -l "v1.*"'))).toBe("v1.0\nv1.1");
    expect(out(execute(w, "git tag --list v2*"))).toBe("v2.0");
    expect(out(execute(w, "git tag -l"))).toBe("v1.0\nv1.1\nv2.0");
    w = run(w, "git tag -l nothing*");
    expect(Object.keys(w.repo!.tags)).toEqual(["v1.0", "v1.1", "v2.0"]);
  });

  it("--contains lists tags whose commit includes the given one", () => {
    let w = run(repoWith(), "git tag old");
    const first = headCommitId(w.repo!)!;
    w = commit(w, { "b.txt": "b\n" }, "second");
    w = run(w, "git tag new");
    expect(out(execute(w, `git tag --contains ${first}`))).toBe("new\nold");
    expect(out(execute(w, "git tag --contains HEAD"))).toBe("new");
    expect(out(execute(w, "git tag --contains"))).toBe("new");
  });
});

describe("git stash show / refs / list", () => {
  function twoStashes() {
    let w = repoWith({ "a.txt": "one\n", "b.txt": "bee\n" });
    w = run(write(w, { "a.txt": "one\ntwo\n" }), "git stash");
    w = run(write(w, { "b.txt": "BEE\n" }), 'git stash push -m "b work"');
    return w;
  }

  it("list matches real Git", () => {
    const w = twoStashes();
    const id = headCommitId(w.repo!)!.slice(0, 7);
    expect(out(execute(w, "git stash list"))).toBe(`stash@{0}: On main: b work\nstash@{1}: WIP on main: ${id} Initial commit`);
  });

  it("show prints a diffstat, -p a patch", () => {
    const w = twoStashes();
    expect(out(execute(w, "git stash show"))).toBe(" b.txt |  2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)");
    expect(out(execute(w, "git stash show stash@{1}"))).toMatch(/a\.txt \| {2}1 \+/);
    const p = out(execute(w, "git stash show -p stash@{1}"));
    expect(p).toMatch(/diff --git a\/a.txt b\/a.txt/);
    expect(p).toMatch(/\+two/);
  });

  it("pop/apply/drop honour stash@{n}", () => {
    let w = twoStashes();
    let r = execute(w, "git stash pop stash@{1}");
    expect(r.ok).toBe(true);
    expect(r.world.workdir["a.txt"]).toBe("one\ntwo\n");
    expect(r.world.workdir["b.txt"]).toBe("bee\n");
    expect(out(r)).toMatch(/Dropped stash@\{1\}/);
    expect(r.world.repo!.stash.map((s) => s.message)).toEqual(["On main: b work"]);
    w = twoStashes();
    w = run(w, "git stash drop stash@{0}");
    expect(w.repo!.stash).toHaveLength(1);
    expect(w.repo!.stash[0].message).toMatch(/^WIP/);
    r = execute(w, "git stash apply stash@{3}");
    expect(r.ok).toBe(false);
    expect(out(r)).toBe("error: stash@{3} is not a valid reference");
    expect(r.explain).toBeTruthy();
  });

  it("pop keeps newly added files staged", () => {
    let w = repoWith();
    w = run(write(w, { "new.txt": "fresh\n" }), "git add new.txt", "git stash", "git stash pop");
    expect(w.repo!.index["new.txt"]).toBe("fresh\n");
  });
});

describe("cherry-pick / revert --continue / --skip", () => {
  /** main and feature both edit a.txt; feature has a second, clean commit. */
  function conflicting() {
    let w = repoWith({ "a.txt": "one\n" });
    w = run(w, "git switch -c feature");
    w = { ...w, user: { name: "Maya", email: "maya@x.dev" } };
    w = commit(w, { "a.txt": "feature\n" }, "Feature edit");
    w = commit(w, { "c.txt": "c\n" }, "Add c");
    w = { ...w, user: { name: "You", email: "you@gitverse.dev" } };
    w = run(w, "git switch main");
    w = commit(w, { "a.txt": "main\n" }, "Main edit");
    return w;
  }

  it("--continue finishes the pick with the original author and message, then the rest", () => {
    let w = conflicting();
    let r = execute(w, "git cherry-pick feature~1 feature");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/error: could not apply [0-9a-f]{7}\.\.\. Feature edit/);
    expect(out(r)).toMatch(/git cherry-pick --continue/);
    expect(r.explain).toMatch(/--continue/);
    w = r.world;
    expect(out(execute(w, "git status"))).toMatch(/You are currently cherry-picking commit/);
    r = execute(w, "git cherry-pick --continue");
    expect(r.ok).toBe(false); // still unmerged
    expect(r.explain).toMatch(/a\.txt/);
    w = run(write(w, { "a.txt": "resolved\n" }), "git add a.txt", "git cherry-pick --continue");
    expect(w.repo!.op).toBeNull();
    const tip = headCommit(w.repo!)!;
    expect(tip.message).toBe("Add c");
    expect(tip.author).toBe("Maya");
    const picked = w.repo!.commits[tip.parents[0]];
    expect(picked.message).toBe("Feature edit");
    expect(picked.author).toBe("Maya");
    expect(picked.tree["a.txt"]).toBe("resolved\n");
  });

  it("--skip drops the conflicting commit and goes on", () => {
    const w = run(conflicting(), "git cherry-pick feature~1 feature || true", "git cherry-pick --skip");
    expect(w.repo!.op).toBeNull();
    expect(headCommit(w.repo!)!.message).toBe("Add c");
    expect(w.workdir["a.txt"]).toBe("main\n");
  });

  it("--abort goes back to where the sequence started", () => {
    let w = conflicting();
    const start = headCommitId(w.repo!);
    w = run(w, "git cherry-pick feature feature~1 || true");
    expect(w.repo!.op).not.toBeNull();
    w = run(w, "git cherry-pick --abort");
    expect(headCommitId(w.repo!)).toBe(start);
    expect(w.repo!.op).toBeNull();
    expect(w.workdir["a.txt"]).toBe("main\n");
    expect(w.workdir["c.txt"]).toBeUndefined();
  });

  it("--continue without a cherry-pick in progress explains", () => {
    const r = execute(repoWith(), "git cherry-pick --continue");
    expect(r.ok).toBe(false);
    expect(out(r)).toBe("error: no cherry-pick in progress");
    expect(r.explain).toBeTruthy();
  });

  it("revert --continue", () => {
    let w = repoWith({ "a.txt": "one\n" });
    w = commit(w, { "a.txt": "two\n" }, "Two");
    w = commit(w, { "a.txt": "three\n" }, "Three");
    const r = execute(w, "git revert HEAD~1");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/error: could not revert [0-9a-f]{7}\.\.\. Two/);
    w = run(write(r.world, { "a.txt": "one and three\n" }), "git add a.txt", "git revert --continue");
    expect(headCommit(w.repo!)!.message).toMatch(/^Revert "Two"/);
    expect(w.repo!.op).toBeNull();
  });

  it("plain git commit still concludes a cherry-pick", () => {
    let w = conflicting();
    w = run(w, "git cherry-pick feature~1 || true");
    w = run(write(w, { "a.txt": "x\n" }), "git add a.txt", "git commit -m done");
    expect(w.repo!.op).toBeNull();
  });
});

describe("ORIG_HEAD", () => {
  it("git reset --hard ORIG_HEAD undoes a reset", () => {
    let w = repoWith();
    w = commit(w, { "b.txt": "b\n" }, "second");
    const tip = headCommitId(w.repo!);
    w = run(w, "git reset --hard HEAD~1");
    expect(w.repo!.origHead).toBe(tip);
    w = run(w, "git reset --hard ORIG_HEAD");
    expect(headCommitId(w.repo!)).toBe(tip);
    expect(w.workdir["b.txt"]).toBe("b\n");
  });

  it("is set by merge and rebase, and resolvable by log/show", () => {
    let w = repoWith();
    w = run(w, "git switch -c feature");
    w = commit(w, { "f.txt": "f\n" }, "feat");
    w = run(w, "git switch main");
    w = commit(w, { "m.txt": "m\n" }, "main work");
    const before = headCommitId(w.repo!);
    w = run(w, "git merge feature");
    expect(resolveRev(w.repo!, "ORIG_HEAD")).toBe(before);
    expect(execute(w, "git log --oneline ORIG_HEAD").ok).toBe(true);
    expect(execute(w, "git show ORIG_HEAD").ok).toBe(true);
    w = run(w, "git reset --hard ORIG_HEAD");
    expect(headCommitId(w.repo!)).toBe(before);
    w = run(w, "git switch feature");
    const featTip = headCommitId(w.repo!);
    w = run(w, "git rebase main");
    expect(w.repo!.origHead).toBe(featTip);
  });

  it("unset ORIG_HEAD fails like Git", () => {
    const r = execute(repoWith(), "git reset --hard ORIG_HEAD");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/ambiguous argument 'ORIG_HEAD'/);
  });
});

describe("merge messages", () => {
  it("git pull that merges writes Merge branch 'main' of <url>", () => {
    let w = teammatePush(connected(), "mate.txt", "hi\n");
    w = commit(w, { "mine.txt": "me\n" }, "mine");
    const before = headCommitId(w.repo!);
    w = run(w, "git pull");
    expect(headCommit(w.repo!)!.message).toBe("Merge branch 'main' of https://github.com/you/project");
    expect(w.repo!.origHead).toBe(before);
  });

  it("merging a remote-tracking ref says so", () => {
    let w = teammatePush(connected(), "mate.txt", "hi\n");
    w = commit(w, { "mine.txt": "me\n" }, "mine");
    w = run(w, "git fetch", "git merge origin/main");
    expect(headCommit(w.repo!)!.message).toBe("Merge remote-tracking branch 'origin/main'");
  });
});

describe("gh pr merge local-base advice", () => {
  it("suggests pull when local main is just behind", () => {
    let w = connected();
    w = run(w, "git switch -c feat");
    w = commit(w, { "f.txt": "f\n" }, "feat");
    w = run(w, "git push -u origin feat", 'gh pr create --title "Feat" --body ""');
    const r = execute(w, "gh pr merge 1 --squash");
    expect(out(r)).toMatch(/git switch main && git pull\)$/);
  });

  it("suggests fetch + reset when local main has the old, unsquashed commit", () => {
    let w = connected();
    w = commit(w, { "oops.txt": "on main by mistake\n" }, "Work on main");
    w = run(w, "git switch -c feat", "git push -u origin feat", 'gh pr create --title "Feat" --body ""');
    const r = execute(w, "gh pr merge 1 --squash");
    expect(r.ok).toBe(true);
    const text = out(r);
    expect(text).toMatch(/old, unsquashed commit/);
    expect(text).toMatch(/git switch main && git fetch && git reset --hard origin\/main/);
  });

  it("keeps pull advice when local main has unrelated unpushed work", () => {
    let w = connected();
    w = run(w, "git switch -c feat");
    w = commit(w, { "f.txt": "f\n" }, "feat");
    w = run(w, "git push -u origin feat", 'gh pr create --title "Feat" --body ""', "git switch main");
    w = commit(w, { "local.txt": "mine\n" }, "Local only");
    const text = out(execute(w, "gh pr merge 1 --squash"));
    expect(text).not.toMatch(/reset --hard/);
    expect(text).toMatch(/git pull\)$/);
  });
});

describe("git status collapses untracked directories", () => {
  const files = { "node_modules/express/index.js": "x\n", "node_modules/express/package.json": "{}\n", "node_modules/left-pad/index.js": "y\n", "notes.txt": "n\n" };

  it("long and short formats show dir/ once; status() is untouched", () => {
    const w = write(repoWith(), files);
    const long = out(execute(w, "git status"));
    expect(long).toMatch(/Untracked files:[\s\S]*\tnode_modules\/\n\tnotes\.txt/);
    expect(long).not.toMatch(/express/);
    expect(out(execute(w, "git status -s"))).toBe("?? node_modules/\n?? notes.txt");
    expect(status(w).filter((e) => e.untracked).map((e) => e.path)).toContain("node_modules/express/index.js");
  });

  it("-uall / --untracked-files=all list every file, -uno hides them", () => {
    const w = write(repoWith(), files);
    expect(out(execute(w, "git status -s -uall"))).toMatch(/\?\? node_modules\/express\/index\.js/);
    expect(out(execute(w, "git status --untracked-files=all"))).toMatch(/node_modules\/left-pad\/index\.js/);
    expect(out(execute(w, "git status -s -uno"))).toBe("");
  });

  it("a directory with a tracked file lists its untracked files individually (deepest untracked dir collapsed)", () => {
    let w = write(repoWith(), { "src/app.js": "a\n" });
    w = run(w, "git add src/app.js", 'git commit -m "app"');
    w = write(w, { "src/new.js": "n\n", "src/lib/a.js": "a\n", "src/lib/b.js": "b\n" });
    expect(out(execute(w, "git status -s"))).toBe("?? src/lib/\n?? src/new.js");
  });
});
