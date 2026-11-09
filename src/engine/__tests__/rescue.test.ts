import { describe, expect, it } from "vitest";
import { emptyWorld, execute, headCommit, headCommitId, runScript, type World } from "..";

const URL = "https://github.com/you/project.git";
const run = (w: World, ...cmds: string[]) => runScript(w, cmds);
const out = (r: ReturnType<typeof execute>) => r.lines.map((l) => l.text).join("\n");
const write = (w: World, files: Record<string, string>): World => ({ ...w, workdir: { ...w.workdir, ...files } });
const commit = (w: World, files: Record<string, string>, msg: string) => run(write(w, files), "git add .", `git commit -m "${msg}"`);

/** main: a.txt; a feature branch adds f.txt and edits b.txt, merged with a merge commit. */
function merged(): World {
  let w = run(emptyWorld({ "a.txt": "one\n", "b.txt": "bee\n" }), "git init", "git add .", 'git commit -m "Initial commit"', "git switch -c feature");
  w = commit(w, { "f.txt": "feature\n", "b.txt": "BEE\n" }, "Feature work");
  w = run(w, "git switch main");
  w = commit(w, { "a.txt": "one\ntwo\n" }, "Main work");
  return run(w, 'git merge feature -m "Merge branch feature"');
}

describe("revert / cherry-pick -m", () => {
  it("revert -m 1 undoes everything the merge brought in, keeps main's side", () => {
    const w0 = merged();
    const merge = headCommitId(w0.repo!)!;
    const r = execute(w0, "git revert -m 1 HEAD");
    expect(r.ok).toBe(true);
    const tip = headCommit(r.world.repo!)!;
    expect(tip.parents).toEqual([merge]);
    expect(tip.message).toBe(`Revert "Merge branch feature"\n\nThis reverts commit ${merge}, reversing\nchanges made to ${r.world.repo!.commits[merge].parents[0]}.`);
    expect(tip.tree["f.txt"]).toBeUndefined();
    expect(tip.tree["b.txt"]).toBe("bee\n");
    expect(tip.tree["a.txt"]).toBe("one\ntwo\n");
  });

  it("-m 2 compares against the second parent; --mainline and -m1 spellings work", () => {
    const w0 = merged();
    const t2 = headCommit(run(w0, "git revert -m 2 HEAD").repo!)!.tree;
    expect(t2["a.txt"]).toBe("one\n");
    expect(t2["f.txt"]).toBe("feature\n");
    expect(headCommit(run(w0, "git revert --mainline 1 HEAD").repo!)!.tree["f.txt"]).toBeUndefined();
    expect(headCommit(run(w0, "git revert --mainline=1 HEAD").repo!)!.tree["f.txt"]).toBeUndefined();
    expect(headCommit(run(w0, "git revert -m1 HEAD").repo!)!.tree["f.txt"]).toBeUndefined();
  });

  it("a merge without -m fails and suggests -m 1", () => {
    const r = execute(merged(), "git revert HEAD");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/is a merge but no -m option was given\.\nfatal: revert failed/);
    expect(r.explain).toMatch(/git revert -m 1 HEAD/);
  });

  it("bad mainline values fail", () => {
    const w = merged();
    let r = execute(w, "git revert -m 3 HEAD");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/does not have parent 3/);
    r = execute(w, "git revert -m 2 HEAD~1");
    expect(out(r)).toMatch(/mainline was specified but commit [0-9a-f]+ is not a merge/);
    r = execute(w, "git revert -m x HEAD");
    expect(out(r)).toMatch(/mainline' expects a number/);
    // -m 1 on a normal commit is accepted, like modern Git
    expect(execute(w, "git revert -m 1 HEAD~1").ok).toBe(true);
  });

  it("cherry-pick -m 1 copies a merge's changes as one commit", () => {
    let w = merged();
    const merge = headCommitId(w.repo!)!;
    w = run(w, "git switch -c other HEAD~1~1", `git cherry-pick -m 1 ${merge}`);
    const tip = headCommit(w.repo!)!;
    expect(tip.parents).toHaveLength(1);
    expect(tip.tree["f.txt"]).toBe("feature\n");
    expect(tip.tree["b.txt"]).toBe("BEE\n");
  });

  it("revert -m with a conflict resumes with --continue", () => {
    let w = merged();
    w = commit(w, { "b.txt": "BEE!\n" }, "Edit b again");
    let r = execute(w, "git revert -m 1 HEAD~1");
    expect(r.ok).toBe(false);
    expect(r.world.repo!.op?.mainline).toBe(1);
    w = run(write(r.world, { "b.txt": "bee\n" }), "git add b.txt");
    r = execute(w, "git revert --continue");
    expect(r.ok).toBe(true);
    expect(headCommit(r.world.repo!)!.message).toMatch(/reversing\nchanges made to/);
    expect(r.world.workdir["f.txt"]).toBeUndefined();
  });
});

describe("git push --force-with-lease", () => {
  function pushed(): World {
    const w = emptyWorld({ "a.txt": "a\n" });
    w.hosted[URL] = { url: URL, owner: "you", name: "project", branches: {}, defaultBranch: "main" };
    let r = run(w, "git init", "git add .", "git commit -m init", `git remote add origin ${URL}`, "git push -u origin main", "git switch -c feat");
    r = commit(r, { "b.txt": "b\n" }, "one");
    r = commit(r, { "c.txt": "c\n" }, "two");
    return run(r, "git push -u origin feat");
  }

  it("overwrites the branch when nobody else pushed", () => {
    const w = run(pushed(), "git reset --hard HEAD~1");
    const r = execute(w, "git push --force-with-lease");
    expect(r.ok).toBe(true);
    expect(out(r)).toMatch(/\(forced update\)/);
    expect(r.world.hosted[URL].branches.feat).toBe(headCommitId(r.world.repo!));
  });

  it("refuses when GitHub has commits you haven't fetched; --force doesn't care", () => {
    let w = pushed();
    // a teammate pushes to feat
    let mate: World = { ...emptyWorld(), hosted: structuredClone(w.hosted), hostedCommits: structuredClone(w.hostedCommits), clock: w.clock + 100, seq: w.seq };
    mate.user = { name: "Maya", email: "maya@x.dev" };
    mate = run(mate, `git clone ${URL}`, "git switch feat");
    mate = run(commit(mate, { "m.txt": "m\n" }, "maya"), "git push");
    w = { ...w, hosted: mate.hosted, hostedCommits: mate.hostedCommits };
    w = run(w, "git reset --hard HEAD~1");
    const r = execute(w, "git push --force-with-lease");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/! \[rejected\] +feat -> feat \(stale info\)/);
    expect(r.explain).toMatch(/git fetch/);
    expect(r.world.hosted[URL].branches.feat).toBe(mate.hosted[URL].branches.feat);
    // after a fetch, the lease matches what you saw: the push goes through
    expect(execute(run(w, "git fetch"), "git push --force-with-lease").ok).toBe(true);
    expect(execute(w, "git push --force").ok).toBe(true);
  });
});

describe("git stash apply/pop merge", () => {
  function stashedOnFeature(): World {
    let w = run(emptyWorld({ "a.txt": "one\n" }), "git init", "git add .", 'git commit -m "Initial commit"', "git switch -c feature");
    w = commit(w, { "menu.txt": "pancakes\n" }, "Add menu");
    return run(write(w, { "menu.txt": "pancakes 7.50\n" }), "git stash");
  }

  it("popping onto a commit where the file doesn't exist is a modify/delete conflict and keeps the stash", () => {
    const w = run(stashedOnFeature(), "git switch main");
    const r = execute(w, "git stash pop");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/CONFLICT \(modify\/delete\): menu.txt deleted in Updated upstream and modified in Stashed changes/);
    expect(out(r)).toMatch(/The stash entry is kept in case you need it again\./);
    expect(r.world.repo!.stash).toHaveLength(1);
    expect(r.world.workdir["menu.txt"]).toBe("pancakes 7.50\n");
    // reset --hard cleans it up; the stash then pops cleanly where it belongs
    const back = run(r.world, "git reset --hard", "git switch feature", "git stash pop");
    expect(back.workdir["menu.txt"]).toBe("pancakes 7.50\n");
    expect(back.repo!.stash).toHaveLength(0);
  });

  it("merges with commits made since the stash", () => {
    let w = run(emptyWorld({ "a.txt": "1\n2\n3\n4\n5\n" }), "git init", "git add .", 'git commit -m "Initial commit"');
    w = run(write(w, { "a.txt": "1\n2\n3\n4\nFIVE\n" }), "git stash");
    w = commit(w, { "a.txt": "ONE\n2\n3\n4\n5\n" }, "Edit line one");
    const r = execute(w, "git stash pop");
    expect(r.ok).toBe(true);
    expect(r.world.workdir["a.txt"]).toBe("ONE\n2\n3\n4\nFIVE\n");
    expect(r.world.repo!.stash).toHaveLength(0);
  });

  it("a content conflict leaves markers and keeps the stash", () => {
    let w = run(emptyWorld({ "a.txt": "one\n" }), "git init", "git add .", 'git commit -m "Initial commit"');
    w = run(write(w, { "a.txt": "stashed\n" }), "git stash");
    w = commit(w, { "a.txt": "committed\n" }, "Edit");
    const r = execute(w, "git stash pop");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/CONFLICT \(content\): Merge conflict in a.txt/);
    expect(r.world.workdir["a.txt"]).toMatch(/<<<<<<< Updated upstream\ncommitted\n=======\nstashed\n>>>>>>> Stashed changes/);
    expect(r.world.repo!.stash).toHaveLength(1);
  });

  it("still refuses to overwrite uncommitted edits", () => {
    let w = run(emptyWorld({ "a.txt": "one\n" }), "git init", "git add .", 'git commit -m "Initial commit"');
    w = run(write(w, { "a.txt": "stashed\n" }), "git stash");
    const r = execute(write(w, { "a.txt": "local edit\n" }), "git stash pop");
    expect(r.ok).toBe(false);
    expect(out(r)).toMatch(/would be overwritten by merge/);
    expect(r.world.repo!.stash).toHaveLength(1);
  });
});

describe("git show --stat / --name-only", () => {
  it("summarise the commit instead of printing the patch", () => {
    let w = run(emptyWorld({ "a.txt": "one\n" }), "git init", "git add .", 'git commit -m "Initial commit"');
    w = commit(w, { "a.txt": "one\ntwo\n", ".env": "KEY=1\n" }, "Add things");
    const stat = out(execute(w, "git show --stat HEAD"));
    expect(stat).toMatch(/ \.env +\| +1 \+\n a\.txt +\| +1 \+\n 2 files changed, 2 insertions\(\+\)$/);
    expect(stat).not.toMatch(/diff --git/);
    expect(out(execute(w, "git show --name-only"))).toMatch(/Add things\n\n\.env\na\.txt$/);
  });
});
