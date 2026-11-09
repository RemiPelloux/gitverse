import { describe, expect, it } from "vitest";
import { execute, runScript, serializeWorld, type World } from "@/engine";
import { ADV_B_FR, ADV_B_LESSONS, HOOKS_URL } from "../chapters/advanced-b";
import type { ChallengeStep, Lesson } from "../types";
import { findId, play, type SolutionStep } from "./play";

export const ADV_B_SOLUTIONS: Record<string, SolutionStep[]> = {
  // first stop “Fix typo in cart title” is good, then “Add newsletter form” and “Tidy up price helper” are bad
  bisect: ["git bisect good", "cat price.js", "git bisect bad", "git bisect bad", "git bisect reset"],
  gitignore: ["echo config.local.json >> .gitignore", "git rm --cached config.local.json", "git add .", 'git commit -m "Ignore local files"'],
  hooks: ['echo "export const wishlist = [];" > src/wishlist.js', "git add .", 'git commit -m "feat: add wishlist"', "git push"],
};

const lesson = (id: string) => ADV_B_LESSONS.find((l) => l.id === id)!;
const challenge = (l: Lesson) => l.steps.find((s) => s.kind === "challenge") as ChallengeStep;
const objectives = (l: Lesson, w: World, start: World) => challenge(l).objectives.map((o) => o.check(w, start, []));
/** Plays the lesson up to (not including) its challenge. */
const beforeChallenge = (l: Lesson) => {
  const start = l.setup();
  let w = start;
  for (const s of l.steps) {
    if (s.kind === "challenge") break;
    if (s.kind !== "try") continue;
    w = s.action ? { ...w, workdir: { ...w.workdir, [s.action.path]: s.action.content } } : execute(w, s.command!).world;
  }
  return { start, w };
};

describe("advanced (part 2) lessons", () => {
  for (const l of ADV_B_LESSONS) {
    it(`${l.id}: plays through`, () => {
      play(l, ADV_B_SOLUTIONS[l.id]);
    });
    it(`${l.id}: setup is deterministic`, () => {
      expect(serializeWorld(l.setup())).toBe(serializeWorld(l.setup()));
    });
    it(`${l.id}: French text matches the lesson's shape`, () => {
      const fr = ADV_B_FR[l.id];
      expect(fr.steps).toHaveLength(l.steps.length);
      expect(fr.recap).toHaveLength(l.recap.length);
      expect(fr.concepts).toHaveLength(l.concepts.length);
      l.steps.forEach((s, i) => {
        const t = fr.steps[i];
        if (s.kind === "celebrate") expect(t).toBeNull();
        else expect(t, `${l.id} step ${i}`).toBeTruthy();
        if (s.kind === "challenge") expect(t?.objectives).toHaveLength(s.objectives.length);
        if (s.kind === "watch") expect(t?.captions).toHaveLength(s.frames.length);
        if (s.kind === "try" && s.action) expect(t?.actionLabel).toBeTruthy();
      });
    });
  }
});

describe("bisect", () => {
  const l = lesson("bisect");

  it("the culprit is found in 3 checks, and git bisect run finds the same one", () => {
    const { w } = beforeChallenge(l);
    const r = execute(w, "git bisect run npm test");
    expect(r.ok).toBe(true);
    expect(r.world.repo!.bisect!.found).toBe(Object.values(w.repo!.commits).find((cm) => cm.message === "Tidy up price helper")!.id);
    expect(r.lines.filter((x) => x.text.startsWith("running ")).length).toBe(3);
  });

  it("the objective survives git bisect reset, but not resetting early", () => {
    const { start, w } = beforeChallenge(l);
    const early = execute(w, "git bisect reset").world;
    expect(objectives(l, early, start)).toEqual([false, false]);
    expect(challenge(l).feedback!(early, start)).toMatch(/hasn't named the culprit/);
    const found = runScript(w, ["git bisect good", "git bisect bad", "git bisect bad"]);
    expect(objectives(l, found, start)).toEqual([true, false]);
    expect(challenge(l).feedback!(found, start)).toBe("Got it! Now end the search with git bisect reset.");
    // switching to main by hand leaves bisect mode on
    const switched = execute(found, "git switch main").world;
    expect(objectives(l, switched, start)).toEqual([true, false]);
    expect(challenge(l).feedback!(switched, start)).toMatch(/still in bisect mode/);
    expect(objectives(l, execute(switched, "git bisect reset").world, start)).toEqual([true, true]);
  });

  it("a wrong answer blames the wrong commit and says so", () => {
    const { start, w } = beforeChallenge(l);
    const wrong = runScript(w, ["git bisect bad", "git bisect good", "git bisect good"]);
    expect(wrong.repo!.bisect!.found).toBeTruthy();
    expect(objectives(l, wrong, start)[0]).toBe(false);
    expect(challenge(l).feedback!(wrong, start)).toMatch(/^Git blamed “Fix typo in cart title”/);
  });

  it("just checking out the culprit doesn't count", () => {
    const start = l.setup();
    const w = runScript(start, [`git switch --detach ${findId(start, "Tidy up price helper")}`]);
    expect(objectives(l, w, start)[0]).toBe(false);
  });
});

describe("gitignore", () => {
  const l = lesson("gitignore");

  it("git check-ignore names line 11", () => {
    const { w } = beforeChallenge(l);
    const v1 = { ...w, workdir: { ...w.workdir, ".gitignore": (l.steps[2] as { action: { content: string } }).action.content } };
    expect(execute(v1, "git check-ignore -v .env.example").lines.map((x) => x.text)).toEqual([".gitignore:11:.env*\t.env.example"]);
  });

  it("plain git rm deletes the local file: objective fails, feedback explains", () => {
    const { start, w } = beforeChallenge(l);
    const r = runScript(w, ["echo config.local.json >> .gitignore", "git rm config.local.json", "git add .", 'git commit -m "Ignore"']);
    expect(objectives(l, r, start)[0]).toBe(false);
    expect(challenge(l).feedback!(r, start)).toMatch(/gone from your disk/);
  });

  it("ignoring without git rm --cached isn't enough", () => {
    const { start, w } = beforeChallenge(l);
    const r = runScript(w, ["echo config.local.json >> .gitignore", "git add .", 'git commit -m "Ignore"']);
    expect(objectives(l, r, start)[0]).toBe(false);
    expect(challenge(l).feedback!(r, start)).toMatch(/still tracks it/);
  });

  it("force-adding .env fails the challenge", () => {
    const { start, w } = beforeChallenge(l);
    const r = runScript(w, ["echo config.local.json >> .gitignore", "git rm --cached config.local.json", "git add .", "git add -f .env", 'git commit -m "Ignore"']);
    expect(objectives(l, r, start)[2]).toBe(false);
    expect(challenge(l).feedback!(r, start)).toMatch(/A commit contains \.env/);
    const fixed = runScript(r, ["git rm --cached .env", "git commit --amend --no-edit"]);
    expect(objectives(l, fixed, start)).toEqual([true, true, true]);
  });
});

describe("hooks", () => {
  const l = lesson("hooks");

  it("hooks are off after the clone and block once switched on", () => {
    const start = l.setup();
    expect(execute(start, 'git commit -am "stuff"').ok).toBe(true); // no hooks yet
    const on = execute(start, "git config core.hooksPath .githooks").world;
    let r = execute(on, 'git commit -am "feat: add sale banner"');
    expect(r.ok).toBe(false);
    expect(r.lines.map((x) => x.text)).toEqual(["pre-commit: looking for console.log...", "src/app.js:2:  console.log('banner shown');", "Remove console.log before committing."]);
    const fixed = { ...on, workdir: { ...on.workdir, "src/app.js": on.workdir["src/app.js"].replace("  console.log('banner shown');\n", "") } };
    r = execute(fixed, 'git commit -am "banner"');
    expect(r.ok).toBe(false);
    expect(r.lines.map((x) => x.text)).toContain("Commit message must start with feat:, fix: or docs:");
  });

  it("--no-verify shortcuts don't pass", () => {
    const { start, w } = beforeChallenge(l);
    const r = runScript(w, ['echo "console.log(1)" > src/wishlist.js', "git add .", 'git commit --no-verify -m "wishlist"', "git push"]);
    expect(r.hosted[HOOKS_URL].branches.main).toBe(r.repo!.branches.main);
    expect(objectives(l, r, start)).toEqual([false, false]);
    expect(challenge(l).feedback!(r, start)).toMatch(/^The commit “wishlist” would never pass the hooks/);
  });

  it("turning the hooks off to push doesn't pass", () => {
    const { start, w } = beforeChallenge(l);
    const r = runScript(w, ['echo "export const wishlist = [];" > src/wishlist.js', "git add .", 'git commit -m "feat: add wishlist"', "git config --unset core.hooksPath", "git push"]);
    expect(objectives(l, r, start)).toEqual([true, false]);
    expect(challenge(l).feedback!(r, start)).toMatch(/switched off/);
  });

  it("the push runs the tests", () => {
    const { w } = beforeChallenge(l);
    const r = execute(runScript(w, ['echo "export const wishlist = [];" > src/wishlist.js', "git add .", 'git commit -m "feat: add wishlist"']), "git push");
    expect(r.lines.map((x) => x.text).slice(0, 3)).toEqual(["pre-push: running tests...", "> pixel-plants@1.2.0 test", '> grep -q "1.1" src/price.js']);
  });
});
