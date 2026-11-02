import { describe, expect, it } from "vitest";
import { emptyWorld, execute, runScript, type World } from "@/engine";
import { translateExplain } from "../engine-fr";

const URL = "https://github.com/you/project.git";
const run = (w: World, ...c: string[]) => runScript(w, c);

function connected(): World {
  const w = emptyWorld({ "a.txt": "1\n" });
  w.hosted[URL] = { url: URL, owner: "you", name: "project", branches: {}, defaultBranch: "main" };
  return run(w, "git init", "git add .", "git commit -m one", `git remote add origin ${URL}`, "git push -u origin main");
}

function teammatePush(w: World, file: string, content: string): World {
  let mate = { ...emptyWorld(), hosted: structuredClone(w.hosted), hostedCommits: structuredClone(w.hostedCommits), clock: w.clock + 500, seq: w.seq };
  mate = run(mate, `git clone ${URL}`);
  mate.workdir[file] = content;
  mate = run(mate, "git add .", "git commit -m teammate", "git push");
  return { ...w, hosted: mate.hosted, hostedCommits: mate.hostedCommits, seq: mate.seq, clock: mate.clock };
}

function conflicted(): World {
  return run(
    emptyWorld({ "a.txt": "base\n" }),
    "git init", "git add .", 'git commit -m "base"',
    "git switch -c feature", 'echo "feature" > a.txt', 'git commit -am "f"',
    "git switch main", 'echo "main" > a.txt', 'git commit -am "m"',
  );
}

/** [label, world, command] — each must fail with a plain-language explanation. */
const cases: Array<[string, () => World, string]> = [
  ["commit with nothing at all", () => run(emptyWorld(), "git init"), "git commit -m x"],
  ["commit with nothing staged", () => run(emptyWorld({ "a.txt": "1\n" }), "git init"), "git commit -m x"],
  ["commit on a clean tree", () => connected(), "git commit -m x"],
  ["not a repository", () => emptyWorld(), "git status"],
  ["add a missing file", () => run(emptyWorld(), "git init"), "git add nope.txt"],
  ["switch to a missing branch", () => connected(), "git switch nope"],
  ["create an existing branch", () => connected(), "git branch main"],
  ["typo in a git command", () => connected(), "git comit"],
  ["unknown program", () => connected(), "gti status"],
  ["push without a remote", () => run(emptyWorld({ "a.txt": "1\n" }), "git init", "git add .", "git commit -m one"), "git push"],
  ["merge conflict", conflicted, "git merge feature"],
  [
    "push rejected",
    () => {
      const w = teammatePush(connected(), "b.txt", "b\n");
      w.workdir["a.txt"] = "2\n";
      return run(w, "git commit -am mine");
    },
    "git push",
  ],
];

describe("translateExplain", () => {
  it("leaves English and unknown strings untouched", () => {
    expect(translateExplain("Anything at all.", "en")).toBe("Anything at all.");
    expect(translateExplain("Not a known explanation.", "fr")).toBe("Not a known explanation.");
    expect(translateExplain(undefined, "fr")).toBeUndefined();
  });

  for (const [label, setup, cmd] of cases) {
    it(`translates: ${label}`, () => {
      const r = execute(setup(), cmd);
      expect(r.ok).toBe(false);
      expect(r.explain, `no explanation for ${cmd}`).toBeTruthy();
      expect(translateExplain(r.explain, "en")).toBe(r.explain);
      const fr = translateExplain(r.explain, "fr");
      expect(fr, `untranslated: ${r.explain}`).not.toBe(r.explain);
    });
  }

  it("keeps names verbatim in interpolated explanations", () => {
    const r = execute(connected(), "git switch my-feature");
    const fr = translateExplain(r.explain, "fr")!;
    expect(fr).toContain('"my-feature"');
    expect(fr).toContain("git switch -c my-feature");
    expect(translateExplain(execute(connected(), "git branch main").explain, "fr")).toContain("git switch main");
  });
});
