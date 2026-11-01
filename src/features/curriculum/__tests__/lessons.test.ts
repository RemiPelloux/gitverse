import { describe, expect, it } from "vitest";
import { execute, headCommitId, type World } from "@/engine";
import { ALL_LESSONS, getLesson } from "..";
import type { ChallengeStep, Lesson, TryStep } from "../types";

/**
 * Plays every lesson the way a learner would — running the suggested
 * commands / actions — and asserts each validator flips at the right time.
 */
function play(lesson: Lesson, solutions: Record<string, string[]>) {
  const start = lesson.setup();
  let w: World = start;
  let ran: string[] = [];
  lesson.steps.forEach((step, i) => {
    if (step.kind === "watch") {
      let demo = step.setup();
      for (const f of step.frames) {
        const r = execute(demo, f.command);
        expect(r.ok, `${lesson.id} watch frame "${f.command}": ${r.lines.map((l) => l.text).join("\n")}`).toBe(true);
        demo = r.world;
      }
    }
    if (step.kind === "try") {
      const t = step as TryStep;
      expect(t.check(w, start, ran), `${lesson.id} step ${i} should not be pre-satisfied`).toBe(false);
      if (t.action) w = { ...w, workdir: { ...w.workdir, [t.action.path]: t.action.content } };
      else {
        const r = execute(w, t.command!);
        // a merge conflict is an intended outcome for one step
        if (!r.ok) expect(r.world.repo?.op, `${lesson.id}: ${t.command}\n${r.lines.map((l) => l.text).join("\n")}`).toBeTruthy();
        w = r.world;
        if (r.command) ran = [...ran, r.command];
      }
      expect(t.check(w, start, ran), `${lesson.id} step ${i} (${t.title}) satisfied`).toBe(true);
      ran = [];
    }
    if (step.kind === "challenge") {
      const ch = step as ChallengeStep;
      expect(ch.objectives.every((o) => o.check(w, start, ran)), `${lesson.id} challenge pre-satisfied`).toBe(false);
      for (const cmd of solutions[lesson.id] ?? []) {
        if (cmd.startsWith("WRITE ")) {
          const [, path, ...content] = cmd.split(" ");
          w = { ...w, workdir: { ...w.workdir, [path]: content.join(" ") + "\n" } };
          continue;
        }
        const r = execute(w, cmd.replace("<pricing>", findId(w, "Add pricing page")).replace("<banner>", findId(w, "Add banner")).replace("<home>", findId(w, "Add home page")));
        expect(r.ok, `${lesson.id}: ${cmd}\n${r.lines.map((l) => l.text).join("\n")}`).toBe(true);
        w = r.world;
      }
      for (const o of ch.objectives) expect(o.check(w, start, ran), `${lesson.id} objective ${o.id}`).toBe(true);
    }
  });
}

const findId = (w: World, msg: string) => Object.values(w.repo?.commits ?? {}).find((c) => c.message === msg)?.id.slice(0, 7) ?? "missing";

const SOLUTIONS: Record<string, string[]> = {
  "first-commit": ["touch hello.txt", "git add hello.txt", 'git commit -m "Add hello"'],
  "making-changes": ["WRITE index.html <h1>Hi</h1>", "git add index.html", 'git commit -m "Add home"', "WRITE index.html <h1>Hi there</h1>", 'git commit -am "Improve home"'],
  "reading-history": ["git switch --detach <home>", "git switch main"],
  branches: ["git switch main", "git switch -c feature/login", "touch login.html", "git add .", 'git commit -m "Add login"'],
  "fast-forward": ["git branch -d feature/hello"],
  "three-way": ["git merge feature/gallery"],
  "merge-conflicts": ["WRITE style.css body { color: purple; background: #111; }", "git add style.css", "git commit --no-edit"],
  "undo-safely": ["git revert <banner>"],
  "lost-commit": ["git reset --hard <pricing>"],
  "first-push": ['echo "hi" > about.txt', "git add .", 'git commit -m "Add about"', "git push"],
  "fetch-pull": ["git pull", 'echo "# Tacos" > tacos.md', "git add .", 'git commit -m "Add tacos"', "git push"],
};

describe("curriculum", () => {
  it("every lesson setup is deterministic", () => {
    for (const l of ALL_LESSONS) expect(JSON.stringify(l.setup())).toBe(JSON.stringify(l.setup()));
  });
  for (const lesson of ALL_LESSONS) {
    it(`lesson "${lesson.id}" is completable end-to-end`, () => play(lesson, SOLUTIONS));
  }
  it("branch challenge feedback notices you're still on main", () => {
    const l = getLesson("branches")!;
    const ch = l.steps.find((s) => s.kind === "challenge") as ChallengeStep;
    let w = l.setup();
    w = execute(w, "git branch feature/login").world;
    expect(ch.feedback!(w, l.setup())).toMatch(/still on main/);
  });
  it("lost-commit setup really hides the commit", () => {
    const w = getLesson("lost-commit")!.setup();
    expect(w.workdir["pricing.html"]).toBeUndefined();
    expect(headCommitId(w.repo!)).toBeTruthy();
  });
});
