import { expect } from "vitest";
import { execute, type World } from "@/engine";
import type { ChallengeStep, Lesson, TryStep } from "../types";

/**
 * A challenge solution step: a command line, `WRITE <path> <content…>` to
 * write a file (as a learner would in the editor), or a function that builds
 * the command from the current world (e.g. to look up a commit id).
 */
export type SolutionStep = string | ((w: World) => string);

/**
 * Plays a lesson the way a learner would — running the suggested commands /
 * actions and the challenge solution — and asserts each validator flips at
 * the right time. Returns the final world.
 */
export function play(lesson: Lesson, solution: SolutionStep[] = []): World {
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
        // a merge conflict (or other intended stop) is allowed for a step
        if (!r.ok) expect(r.world.repo?.op ?? r.world.repo?.bisect, `${lesson.id}: ${t.command}\n${r.lines.map((l) => l.text).join("\n")}`).toBeTruthy();
        w = r.world;
        if (r.command) ran = [...ran, r.command];
      }
      expect(t.check(w, start, ran), `${lesson.id} step ${i} (${t.title}) satisfied`).toBe(true);
      ran = [];
    }
    if (step.kind === "challenge") {
      const ch = step as ChallengeStep;
      expect(ch.objectives.every((o) => o.check(w, start, ran)), `${lesson.id} challenge pre-satisfied`).toBe(false);
      for (const s of solution) {
        const cmd = typeof s === "function" ? s(w) : s;
        if (cmd.startsWith("WRITE ")) {
          const [, path, ...content] = cmd.split(" ");
          w = { ...w, workdir: { ...w.workdir, [path]: content.join(" ") + "\n" } };
          continue;
        }
        const r = execute(w, cmd);
        expect(r.ok, `${lesson.id}: ${cmd}\n${r.lines.map((l) => l.text).join("\n")}`).toBe(true);
        w = r.world;
        if (r.command) ran = [...ran, r.command];
      }
      for (const o of ch.objectives) expect(o.check(w, start, ran), `${lesson.id} objective ${o.id}`).toBe(true);
    }
  });
  return w;
}

export const findId = (w: World, msg: string) => Object.values(w.repo?.commits ?? {}).find((c) => c.message === msg)?.id.slice(0, 7) ?? "missing";
