import { describe, expect, it } from "vitest";
import { execute, type World } from "@/engine";
import { ADV_A_FR, ADV_A_LESSONS } from "../chapters/advanced-a";
import { translateFeedback } from "../localize";
import type { ChallengeStep, Lesson } from "../types";
import { findId, play, type SolutionStep } from "./play";

export const ADV_A_SOLUTIONS: Record<string, SolutionStep[]> = {
  "cherry-pick": [(w) => `git cherry-pick ${findId(w, "Add opening hours")}`, (w) => `git cherry-pick ${findId(w, "Fix opening hours typo")}`],
  stash: [
    'git stash push -m "dark mode"',
    "git switch main",
    "WRITE hours.html <p>Open every day, 7am to 7pm</p>",
    'git commit -am "Fix opening hours typo"',
    "git switch feature/dark-mode",
    "git stash pop",
  ],
  tags: [
    (w) => `git tag -a v1.0.0 -m "First public launch" ${findId(w, "Launch website")}`,
    'git tag -a v1.1.0 -m "Blog and dark mode"',
    "git push origin v1.0.0 v1.1.0",
  ],
};

const lesson = (id: string) => ADV_A_LESSONS.find((l) => l.id === id)!;
const challenge = (l: Lesson) => l.steps.find((s) => s.kind === "challenge") as ChallengeStep;
const run = (w: World, ...cmds: string[]) => {
  for (const c of cmds) w = execute(w, c).world;
  return w;
};
/** World at the start of the challenge: every try step done. */
const atChallenge = (l: Lesson) => {
  let w = l.setup();
  for (const s of l.steps) if (s.kind === "try" && s.command) w = execute(w, s.command).world;
  return w;
};
const objectives = (l: Lesson, w: World) => Object.fromEntries(challenge(l).objectives.map((o) => [o.id, o.check(w, l.setup(), [])]));

describe("Advanced Git (part A)", () => {
  it("lessons belong to the advanced chapter, in order", () => {
    expect(ADV_A_LESSONS.map((l) => l.id)).toEqual(["cherry-pick", "stash", "tags"]);
    for (const l of ADV_A_LESSONS) expect(l.chapterId).toBe("advanced");
  });

  for (const l of ADV_A_LESSONS) {
    it(`plays "${l.id}" end to end`, () => {
      play(l, ADV_A_SOLUTIONS[l.id]);
    });
    it(`"${l.id}" setup is deterministic`, () => {
      expect(l.setup()).toEqual(l.setup());
    });
    it(`"${l.id}" French text lines up`, () => {
      const t = ADV_A_FR[l.id];
      expect(t).toBeTruthy();
      expect(t.steps.length).toBe(l.steps.length);
      expect(t.recap.length).toBe(l.recap.length);
      expect(t.concepts.length).toBe(l.concepts.length);
      l.steps.forEach((s, i) => {
        const st = t.steps[i];
        if (s.kind === "celebrate") return expect(st).toBeNull();
        if (s.kind === "discover") expect((st?.body as string[]).length, `step ${i}`).toBe(s.body.length);
        if (s.kind === "try") expect(st?.success, `step ${i}`).toBeTruthy();
        if (s.kind === "try" && s.hint) expect(st?.hint, `step ${i}`).toBeTruthy();
        if (s.kind === "challenge") expect(st?.objectives?.length).toBe(s.objectives.length);
      });
    });
  }

  describe("cherry-pick", () => {
    const l = lesson("cherry-pick");
    it("merging the whole branch does not pass", () => {
      const o = objectives(l, run(atChallenge(l), "git merge feature/checkout"));
      expect(o.rest).toBe(false);
      expect(o.hours).toBe(false); // the originals arrived, not copies
    });
    it("copying the file by hand does not pass", () => {
      const o = objectives(l, run(atChallenge(l), "git restore --source feature/checkout footer.html", 'git commit -am "hours"'));
      expect(o.hours).toBe(false);
      expect(o.typo).toBe(false);
    });
    it("wrong order conflicts, feedback suggests --abort, and abort recovers", () => {
      const w0 = atChallenge(l);
      const w = execute(w0, `git cherry-pick ${findId(w0, "Fix opening hours typo")}`).world;
      expect(w.repo?.op?.kind).toBe("cherry-pick");
      const msg = challenge(l).feedback!(w, l.setup());
      expect(msg).toMatch(/--abort/);
      expect(translateFeedback(msg, ADV_A_FR["cherry-pick"].feedback)).toMatch(/Conflit/);
      const after = run(w, "git cherry-pick --abort", `git cherry-pick ${findId(w, "Add opening hours")} ${findId(w, "Fix opening hours typo")}`);
      expect(Object.values(objectives(l, after)).every(Boolean)).toBe(true);
    });
  });

  describe("stash", () => {
    const l = lesson("stash");
    it("switching to main with edits is refused (the lesson's premise)", () => {
      const r = execute(l.setup(), "git switch main");
      expect(r.ok).toBe(false);
      expect(r.lines.map((x) => x.text).join("\n")).toMatch(/would be overwritten by checkout/);
    });
    it("committing the half-done work instead of stashing does not pass, and gets feedback", () => {
      const w = run(atChallenge(l), 'git commit -am "wip"', "git switch main");
      const fixed = run({ ...w, workdir: { ...w.workdir, "hours.html": "<p>Open every day, 7am to 7pm</p>\n" } }, 'git commit -am "fix"', "git switch feature/dark-mode");
      const o = objectives(l, fixed);
      expect(o.fix).toBe(true);
      expect(o.back).toBe(false);
      const msg = challenge(l).feedback!(fixed, l.setup());
      expect(msg).toMatch(/new commit/);
      expect(translateFeedback(msg, ADV_A_FR.stash.feedback)).toMatch(/nouveau commit/);
    });
    it("nudges to pop once main is fixed", () => {
      const w0 = run(atChallenge(l), "git stash", "git switch main");
      const w = run({ ...w0, workdir: { ...w0.workdir, "hours.html": "<p>Open every day, 7am to 7pm</p>\n" } }, 'git commit -am "fix"');
      const msg = challenge(l).feedback!(w, l.setup());
      expect(msg).toMatch(/git stash pop/);
      expect(translateFeedback(msg, ADV_A_FR.stash.feedback)).toMatch(/récupère/);
    });
  });

  describe("tags", () => {
    const l = lesson("tags");
    it("tagging HEAD as v1.0.0 does not pass, and feedback is translated", () => {
      const w = run(atChallenge(l), "git tag -a v1.0.0 -m x", "git tag -a v1.1.0 -m y", "git push --tags");
      const o = objectives(l, w);
      expect(o.v1).toBe(false);
      const msg = challenge(l).feedback!(w, l.setup());
      expect(msg).toMatch(/wrong commit on GitHub/);
      expect(translateFeedback(msg, ADV_A_FR.tags.feedback)).toMatch(/^v1\.0\.0 est sur le mauvais commit sur GitHub.*--delete v1\.0\.0/);
    });
    it("tags that are right but not pushed get a push nudge", () => {
      const w0 = atChallenge(l);
      const w = run(w0, `git tag -a v1.0.0 -m x ${findId(w0, "Launch website")}`, "git tag v1.1.0");
      const o = objectives(l, w);
      expect([o.v1, o.v11, o.pushed]).toEqual([true, true, false]);
      expect(translateFeedback(challenge(l).feedback!(w, l.setup()), ADV_A_FR.tags.feedback)).toMatch(/Pousse-les/);
    });
    it("git push --tags also publishes them", () => {
      const w0 = atChallenge(l);
      const w = run(w0, `git tag -a v1.0.0 -m x ${findId(w0, "Launch website")}`, "git tag v1.1.0", "git push --tags");
      expect(Object.values(objectives(l, w)).every(Boolean)).toBe(true);
    });
  });
});
