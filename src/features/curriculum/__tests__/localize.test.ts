import { describe, expect, it } from "vitest";
import { ALL_LESSONS, CHAPTERS } from "..";
import { CURRICULUM_FR } from "../fr";
import { localizeLesson, localizedChapters } from "../localize";

/** The French overlay must line up exactly with the English lessons. */
describe("French curriculum", () => {
  it("translates every chapter", () => {
    for (const c of CHAPTERS) {
      const t = CURRICULUM_FR.chapters[c.id];
      expect(t, c.id).toBeTruthy();
      expect(t.upcoming.length, `${c.id} upcoming`).toBe(c.upcoming.length);
    }
  });
  for (const lesson of ALL_LESSONS) {
    it(`lines up with lesson "${lesson.id}"`, () => {
      const t = CURRICULUM_FR.lessons[lesson.id];
      expect(t, "missing translation").toBeTruthy();
      expect(t.steps.length, "step count").toBe(lesson.steps.length);
      expect(t.recap.length, "recap").toBe(lesson.recap.length);
      expect(t.concepts.length, "concepts").toBe(lesson.concepts.length);
      lesson.steps.forEach((s, i) => {
        const st = t.steps[i];
        if (s.kind === "celebrate") return expect(st, `step ${i}`).toBeNull();
        expect(st?.title, `step ${i} title`).toBeTruthy();
        if (s.kind === "discover") expect(Array.isArray(st?.body) && st.body.length, `step ${i} body`).toBe(s.body.length);
        else expect(typeof st?.body, `step ${i} body`).toBe("string");
        if (s.kind === "watch") expect(st?.captions?.length, `step ${i} captions`).toBe(s.frames.length);
        if (s.kind === "try") {
          expect(st?.success, `step ${i} success`).toBeTruthy();
          if (s.hint) expect(st?.hint, `step ${i} hint`).toBeTruthy();
          if (s.action) expect(st?.actionLabel, `step ${i} actionLabel`).toBeTruthy();
        }
        if (s.kind === "challenge") {
          expect(st?.objectives?.length, `step ${i} objectives`).toBe(s.objectives.length);
          st!.objectives!.forEach((o) => expect(o.hints.length).toBe(3));
        }
      });
      const fr = localizeLesson(lesson, "fr");
      expect(fr.title).toBe(t.title);
      expect(fr.setup).toBe(lesson.setup);
    });
  }
  it("translates every challenge feedback message", async () => {
    const { execute } = await import("@/engine");
    const branches = ALL_LESSONS.find((l) => l.id === "branches")!;
    const ch = localizeLesson(branches, "fr").steps.find((s) => s.kind === "challenge")!;
    const w = execute(branches.setup(), "git branch feature/login").world;
    const msg = ch.kind === "challenge" ? ch.feedback!(w, branches.setup()) : null;
    expect(msg).toBeTruthy();
    expect(msg).not.toMatch(/still on/);
    expect(msg).toMatch(/main/);
  });
  it("keeps chapter structure", () => {
    const fr = localizedChapters("fr");
    expect(fr.map((c) => c.lessons.length)).toEqual(CHAPTERS.map((c) => c.lessons.length));
  });
});
