import { describe, expect, it } from "vitest";
import {
  ancestors,
  currentBranch,
  emptyWorld,
  execute,
  headCommit,
  headCommitId,
  layoutGraph,
  merge3,
  parse,
  resolveRev,
  runScript,
  status,
  type World,
} from "..";
import { deserializeWorld, serializeWorld } from "../serialize";

const run = (w: World, ...cmds: string[]) => runScript(w, cmds);
const text = (r: ReturnType<typeof execute>) => r.lines.map((l) => l.text).join("\n");

/** Structural invariants every reachable state must satisfy. */
function assertInvariants(w: World) {
  const repo = w.repo;
  if (!repo) return;
  for (const c of Object.values(repo.commits)) {
    for (const p of c.parents) {
      expect(repo.commits[p], `parent ${p} of ${c.id} exists`).toBeDefined();
      expect(repo.commits[p].seq).toBeLessThan(c.seq); // DAG: parents are older -> acyclic
    }
  }
  for (const [b, id] of Object.entries(repo.branches)) expect(repo.commits[id], `branch ${b}`).toBeDefined();
  for (const id of Object.values(repo.remoteRefs)) expect(repo.commits[id]).toBeDefined();
  if (repo.head.kind === "detached") expect(repo.commits[repo.head.commit]).toBeDefined();
  for (const e of repo.reflog) expect(repo.commits[e.commit]).toBeDefined();
  for (const h of Object.values(w.hosted)) for (const id of Object.values(h.branches)) expect(w.hostedCommits[id]).toBeDefined();
}

describe("parser", () => {
  it("handles quotes, redirects and chains", () => {
    expect(parse(`git commit -m "Initial commit"`)[0].argv).toEqual(["git", "commit", "-m", "Initial commit"]);
    expect(parse(`echo 'hi there' > a.txt`)[0]).toEqual({ argv: ["echo", "hi there"], redirect: { file: "a.txt", append: false } });
    expect(parse(`echo x >> a.txt && git add .`).map((c) => c.argv[0])).toEqual(["echo", "git"]);
  });
  it("reports unterminated quotes with a beginner explanation", () => {
    const r = execute(emptyWorld(), `git commit -m "oops`);
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/quote/);
  });
});

describe("first journey (spec §19)", () => {
  it("init → add → commit → branch → commit → switch → merge", () => {
    let w = emptyWorld();
    let r = execute(w, "git status");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/not a git repository/);

    w = run(w, "git init");
    expect(w.repo).not.toBeNull();
    w.workdir["README.md"] = "# Hello Git\n";
    r = execute(w, "git status");
    expect(text(r)).toMatch(/Untracked files:[\s\S]*README.md/);

    w = run(w, "git add README.md");
    expect(w.repo!.index["README.md"]).toBe("# Hello Git\n");
    r = execute(w, `git commit -m "Initial commit"`);
    expect(r.ok).toBe(true);
    expect(text(r)).toMatch(/\[main \(root-commit\) [0-9a-f]{7}\] Initial commit/);
    w = r.world;
    const first = headCommitId(w.repo!)!;
    expect(w.repo!.branches.main).toBe(first);
    expect(r.events).toContainEqual({ type: "commit", id: first, branch: "main" });

    w = run(w, "git switch -c feature/hello");
    expect(currentBranch(w.repo!)).toBe("feature/hello");
    expect(w.repo!.branches["feature/hello"]).toBe(first);

    w.workdir["hello.txt"] = "Hello, world!\n";
    w = run(w, "git add .", `git commit -m "Add greeting"`);
    const second = headCommitId(w.repo!)!;
    expect(w.repo!.commits[second].parents).toEqual([first]);
    expect(w.repo!.branches.main).toBe(first);

    w = run(w, "git switch main");
    expect(w.workdir["hello.txt"]).toBeUndefined(); // main's snapshot has no hello.txt

    r = execute(w, "git merge feature/hello");
    expect(text(r)).toMatch(/Fast-forward/);
    expect(r.events[0]).toMatchObject({ type: "merge", mode: "fast-forward" });
    w = r.world;
    expect(w.repo!.branches.main).toBe(second);
    expect(w.workdir["hello.txt"]).toBe("Hello, world!\n");
    expect(status(w)).toEqual([]);
    assertInvariants(w);
  });
});

function diverged(): World {
  let w = run(emptyWorld({ "app.txt": "line1\nline2\nline3\n" }), "git init", "git add .", `git commit -m base`);
  w = run(w, "git switch -c feature");
  w.workdir["feature.txt"] = "f\n";
  w = run(w, "git add .", `git commit -m feature-work`, "git switch main");
  w.workdir["main.txt"] = "m\n";
  return run(w, "git add .", `git commit -m main-work`);
}

describe("merging", () => {
  it("creates a merge commit with two parents when histories diverge", () => {
    const w = diverged();
    const r = execute(w, "git merge feature");
    expect(r.ok).toBe(true);
    expect(text(r)).toMatch(/Merge made by the 'ort' strategy/);
    const merge = headCommit(r.world.repo!)!;
    expect(merge.parents).toEqual([w.repo!.branches.main, w.repo!.branches.feature]);
    expect(merge.message).toBe("Merge branch 'feature'");
    expect(merge.tree).toMatchObject({ "feature.txt": "f\n", "main.txt": "m\n" });
    assertInvariants(r.world);
  });

  it("produces conflicts and resolves them", () => {
    let w = run(emptyWorld({ "a.txt": "hello\n" }), "git init", "git add .", "git commit -m base", "git switch -c other");
    w.workdir["a.txt"] = "hello from other\n";
    w = run(w, "git commit -am other", "git switch main");
    w.workdir["a.txt"] = "hello from main\n";
    w = run(w, "git commit -am main");
    const r = execute(w, "git merge other");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/CONFLICT \(content\): Merge conflict in a.txt/);
    w = r.world;
    expect(w.repo!.op?.conflicts).toEqual(["a.txt"]);
    expect(w.workdir["a.txt"]).toContain("<<<<<<< HEAD");
    expect(execute(w, "git commit -m x").ok).toBe(false);
    w.workdir["a.txt"] = "hello from both\n";
    w = run(w, "git add a.txt", "git commit --no-edit");
    expect(headCommit(w.repo!)!.parents).toHaveLength(2);
    expect(w.repo!.op).toBeNull();
    assertInvariants(w);
  });

  it("merge --abort restores the pre-merge state", () => {
    let w = run(emptyWorld({ "a.txt": "x\n" }), "git init", "git add .", "git commit -m base", "git switch -c o");
    w.workdir["a.txt"] = "o\n";
    w = run(w, "git commit -am o", "git switch main");
    w.workdir["a.txt"] = "m\n";
    w = run(w, "git commit -am m");
    w = execute(w, "git merge o").world;
    w = run(w, "git merge --abort");
    expect(w.workdir["a.txt"]).toBe("m\n");
    expect(w.repo!.op).toBeNull();
  });

  it("merge3 merges non-overlapping edits cleanly", () => {
    const r = merge3("a\nb\nc\nd\n", "A\nb\nc\nd\n", "a\nb\nc\nD\n");
    expect(r).toEqual({ clean: true, text: "A\nb\nc\nD\n" });
  });
});

describe("branch safety", () => {
  it("refuses to switch when local changes would be overwritten", () => {
    let w = run(emptyWorld({ "a.txt": "1\n" }), "git init", "git add .", "git commit -m one", "git branch other");
    w.workdir["a.txt"] = "2\n";
    w = run(w, "git commit -am two", "git switch other");
    w.workdir["a.txt"] = "dirty\n";
    const r = execute(w, "git switch main");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/would be overwritten/);
    expect(currentBranch(r.world.repo!)).toBe("other"); // atomic: nothing changed
  });

  it("refuses to delete an unmerged branch without -D", () => {
    let w = run(emptyWorld({ "a.txt": "1\n" }), "git init", "git add .", "git commit -m one", "git switch -c f");
    w.workdir["b.txt"] = "b\n";
    w = run(w, "git add .", "git commit -m b", "git switch main");
    expect(execute(w, "git branch -d f").ok).toBe(false);
    expect(execute(w, "git branch -D f").ok).toBe(true);
  });

  it("can't create a branch before the first commit", () => {
    const w = run(emptyWorld(), "git init");
    const r = execute(w, "git branch feature");
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/no commits yet/);
  });
});

describe("history & undo", () => {
  it("detached HEAD, reset and reflog recovery", () => {
    let w = run(emptyWorld({ "a.txt": "1\n" }), "git init", "git add .", "git commit -m one");
    w.workdir["a.txt"] = "2\n";
    w = run(w, "git commit -am two");
    const lost = headCommitId(w.repo!)!;
    w = run(w, "git reset --hard HEAD~1");
    expect(w.workdir["a.txt"]).toBe("1\n");
    expect(Object.values(w.repo!.branches)).not.toContain(lost);
    const reflog = text(execute(w, "git reflog"));
    expect(reflog).toContain(lost.slice(0, 7));
    w = run(w, `git reset --hard ${lost.slice(0, 7)}`);
    expect(w.workdir["a.txt"]).toBe("2\n");

    w = run(w, "git checkout HEAD~1");
    expect(w.repo!.head.kind).toBe("detached");
    w = run(w, "git switch main");
    expect(currentBranch(w.repo!)).toBe("main");
    assertInvariants(w);
  });

  it("revert creates an inverse commit", () => {
    let w = run(emptyWorld({ "a.txt": "good\n" }), "git init", "git add .", "git commit -m good");
    w.workdir["a.txt"] = "bad\n";
    w = run(w, "git commit -am bad", "git revert HEAD");
    expect(w.workdir["a.txt"]).toBe("good\n");
    expect(headCommit(w.repo!)!.message).toMatch(/^Revert "bad"/);
  });

  it("restore and restore --staged", () => {
    let w = run(emptyWorld({ "a.txt": "1\n" }), "git init", "git add .", "git commit -m one");
    w.workdir["a.txt"] = "2\n";
    w = run(w, "git add a.txt", "git restore --staged a.txt");
    expect(w.repo!.index["a.txt"]).toBe("1\n");
    expect(w.workdir["a.txt"]).toBe("2\n");
    w = run(w, "git restore a.txt");
    expect(w.workdir["a.txt"]).toBe("1\n");
  });

  it("stash and pop", () => {
    let w = run(emptyWorld({ "a.txt": "1\n" }), "git init", "git add .", "git commit -m one");
    w.workdir["a.txt"] = "wip\n";
    w = run(w, "git stash");
    expect(w.workdir["a.txt"]).toBe("1\n");
    w = run(w, "git stash pop");
    expect(w.workdir["a.txt"]).toBe("wip\n");
  });

  it("resolves revisions", () => {
    const w = diverged();
    expect(resolveRev(w.repo!, "main~1")).toBe(headCommit(w.repo!)!.parents[0]);
    expect(resolveRev(w.repo!, "nope")).toBeNull();
  });
});

describe("rebase", () => {
  it("replays commits onto the upstream with new identities", () => {
    let w = diverged();
    w = run(w, "git switch feature");
    const old = w.repo!.branches.feature;
    const r = execute(w, "git rebase main");
    expect(r.ok).toBe(true);
    w = r.world;
    const tip = w.repo!.branches.feature;
    expect(tip).not.toBe(old);
    expect(w.repo!.commits[tip].parents).toEqual([w.repo!.branches.main]);
    expect(r.events.at(-1)).toMatchObject({ type: "rebase", rewritten: [[old, tip]] });
    expect(ancestors(w.repo!, tip).has(old)).toBe(false);
    assertInvariants(w);
  });

  it("stops on conflict and continues", () => {
    let w = run(emptyWorld({ "a.txt": "x\n" }), "git init", "git add .", "git commit -m base", "git switch -c f");
    w.workdir["a.txt"] = "f\n";
    w = run(w, "git commit -am f", "git switch main");
    w.workdir["a.txt"] = "m\n";
    w = run(w, "git commit -am m", "git switch f");
    const r = execute(w, "git rebase main");
    expect(r.ok).toBe(false);
    w = r.world;
    expect(w.repo!.op?.kind).toBe("rebase");
    w.workdir["a.txt"] = "mf\n";
    w = run(w, "git add a.txt", "git rebase --continue");
    expect(currentBranch(w.repo!)).toBe("f");
    expect(w.repo!.commits[w.repo!.branches.f].parents).toEqual([w.repo!.branches.main]);
  });
});

function withRemote(): World {
  const w = emptyWorld();
  w.hosted["https://github.com/you/project.git"] = { url: "https://github.com/you/project.git", owner: "you", name: "project", branches: {}, defaultBranch: "main" };
  w.workdir["a.txt"] = "1\n";
  return run(w, "git init", "git add .", "git commit -m one", "git remote add origin https://github.com/you/project.git");
}

describe("remotes", () => {
  it("push requires upstream, then -u sets it", () => {
    let w = withRemote();
    const r = execute(w, "git push");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/has no upstream branch/);
    w = run(w, "git push -u origin main");
    expect(w.hosted["https://github.com/you/project.git"].branches.main).toBe(w.repo!.branches.main);
    expect(w.repo!.remoteRefs["origin/main"]).toBe(w.repo!.branches.main);
    expect(w.repo!.upstream.main).toBe("origin/main");
    expect(text(execute(w, "git status"))).toMatch(/up to date with 'origin\/main'/);
    assertInvariants(w);
  });

  it("rejects non-fast-forward pushes, fetch + pull integrate", () => {
    let w = run(withRemote(), "git push -u origin main");
    // a teammate pushes directly to the hosted repo: simulate via a second clone
    let mate = emptyWorld();
    mate.hosted = structuredClone(w.hosted);
    mate.hostedCommits = structuredClone(w.hostedCommits);
    mate.clock = w.clock + 1000;
    mate.seq = w.seq;
    mate = run(mate, "git clone https://github.com/you/project.git");
    mate.workdir["b.txt"] = "teammate\n";
    mate = run(mate, "git add .", "git commit -m mate", "git push");
    w.hosted = mate.hosted;
    w.hostedCommits = mate.hostedCommits;
    w.seq = mate.seq;
    w.workdir["a.txt"] = "2\n";
    w = run(w, "git commit -am mine");
    const rejected = execute(w, "git push");
    expect(rejected.ok).toBe(false);
    expect(text(rejected)).toMatch(/rejected/);

    w = run(w, "git fetch");
    expect(w.repo!.remoteRefs["origin/main"]).toBe(mate.repo!.branches.main);
    expect(w.workdir["b.txt"]).toBeUndefined(); // fetch doesn't touch files
    w = run(w, "git pull", "git push");
    expect(w.workdir["b.txt"]).toBe("teammate\n");
    expect(headCommit(w.repo!)!.parents).toHaveLength(2);
    assertInvariants(w);
  });
});

describe("errors are honest", () => {
  it("unknown, typo and unsupported commands fail", () => {
    const w = run(emptyWorld(), "git init");
    expect(text(execute(w, "git comit"))).toMatch(/most similar command is\s+commit/);
    expect(execute(w, "git bisect start").ok).toBe(false);
    expect(execute(w, "gti status").explain).toMatch(/git/);
    expect(execute(w, "rm -rf /").ok).toBe(false);
  });
  it("commit with nothing staged explains staging", () => {
    let w = run(emptyWorld(), "git init");
    w.workdir["x"] = "1\n";
    const r = execute(w, `git commit -m "x"`);
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/staging area/);
    w = r.world;
    expect(w.repo!.commits).toEqual({});
  });
  it("never mutates the input world", () => {
    const w = run(emptyWorld({ a: "1\n" }), "git init");
    const before = JSON.stringify(w);
    execute(w, "git add .");
    execute(w, "git commit -m x");
    expect(JSON.stringify(w)).toBe(before);
  });
});

describe("graph layout", () => {
  it("keeps main on lane 0 and feature on its own lane", () => {
    const w = diverged();
    const g = layoutGraph(w);
    const main = g.nodes.find((n) => n.commit.message === "main-work")!;
    const feat = g.nodes.find((n) => n.commit.message === "feature-work")!;
    expect(main.lane).toBe(0);
    expect(feat.lane).toBe(1);
    expect(new Set(g.nodes.map((n) => n.col)).size).toBe(g.nodes.length);
    expect(g.edges).toHaveLength(2);
  });
  it("is stable across a merge (nodes keep their lanes)", () => {
    const w = diverged();
    const before = layoutGraph(w);
    const after = layoutGraph(run(w, "git merge feature", "git branch -d feature"));
    for (const n of before.nodes) expect(after.nodes.find((m) => m.id === n.id)!.lane).toBe(n.lane);
  });
});

describe("serialization", () => {
  it("round-trips worlds", () => {
    const w = diverged();
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    expect(deserializeWorld("garbage")).toBeNull();
  });
});
