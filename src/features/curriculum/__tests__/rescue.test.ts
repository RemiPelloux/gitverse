import { describe, expect, it } from "vitest";
import { execute, runScript, type World } from "@/engine";
import { CAFE_URL } from "../chapters/workflows";
import { RESCUE_FR, RESCUE_LESSONS } from "../chapters/rescue";
import { translateFeedback } from "../localize";
import type { ChallengeStep, Lesson } from "../types";
import { findId, play, type SolutionStep } from "./play";

export const RESCUE_SOLUTIONS: Record<string, SolutionStep[]> = {
  "wrong-branch": ["git log --oneline --graph --all", "git switch feature/gift-cards", "git cherry-pick fix-menu", "git switch fix-menu", "git reset --hard HEAD~1"],
  "broke-main": ["git log --oneline", "git revert HEAD~1", "npm test", "git push", "gh run list"],
  "leaked-secret": [
    'gh secret set PAY_API_KEY --body "pk_live_9b27d3a0"',
    "git switch feature/payments",
    "git reset --soft origin/main",
    "git rm --cached .env",
    'echo ".env" >> .gitignore',
    "git add .gitignore",
    'git commit -m "Add payment page"',
    "git push --force-with-lease",
  ],
  "friday-incident": [
    "git branch feature/brunch",
    "git reset --hard origin/main",
    "git pull",
    "git switch feature/brunch",
    "git stash pop",
    'git commit -am "Add brunch prices"',
    "git push -u origin feature/brunch",
    'gh pr create --title "Weekend brunch menu" --body "Menu and prices for Saturday"',
  ],
};

const lesson = (id: string) => RESCUE_LESSONS.find((l) => l.id === id)!;
const challenge = (l: Lesson) => l.steps.find((s) => s.kind === "challenge") as ChallengeStep;
const objective = (l: Lesson, id: string) => challenge(l).objectives.find((o) => o.id === id)!;
const allPass = (l: Lesson, w: World) => challenge(l).objectives.every((o) => o.check(w, l.setup(), ["gh run"]));
const feedback = (l: Lesson, w: World) => challenge(l).feedback!(w, l.setup());
const run = (w: World, ...cmds: string[]) => runScript(w, cmds);
/** Plays the lesson's try steps (not the challenge) and returns the world at the challenge. */
function atChallenge(l: Lesson): World {
  let w = l.setup();
  for (const s of l.steps) {
    if (s.kind !== "try") continue;
    if (s.action) w = { ...w, workdir: { ...w.workdir, [s.action.path]: s.action.content } };
    else w = execute(w, s.command!).world;
  }
  return w;
}
/** Every feedback message must have a French translation. */
function expectFrench(l: Lesson, msg: string | null) {
  expect(msg).toBeTruthy();
  const fr = translateFeedback(msg, RESCUE_FR[l.id].feedback);
  expect(fr, msg!).not.toBe(msg);
}

describe("chapter: Real-World Rescue Missions", () => {
  it("has the four lessons in order, ending with the boss", () => {
    expect(RESCUE_LESSONS.map((l) => l.id)).toEqual(["wrong-branch", "broke-main", "leaked-secret", "friday-incident"]);
    expect(RESCUE_LESSONS.every((l) => l.chapterId === "scenarios")).toBe(true);
    expect(RESCUE_LESSONS.at(-1)!.boss).toBe(true);
  });

  it("setups are deterministic", () => {
    for (const l of RESCUE_LESSONS) expect(JSON.stringify(l.setup())).toBe(JSON.stringify(l.setup()));
  });

  for (const l of RESCUE_LESSONS) {
    it(`lesson "${l.id}" is completable end-to-end`, () => {
      const w = play(l, RESCUE_SOLUTIONS[l.id]);
      expect(feedback(l, w)).toBeNull();
    });
  }

  it("French text covers every lesson, step and objective", () => {
    for (const l of RESCUE_LESSONS) {
      const fr = RESCUE_FR[l.id];
      expect(fr, l.id).toBeDefined();
      expect(fr.steps.length, l.id).toBe(l.steps.length);
      expect(fr.concepts.length, l.id).toBe(l.concepts.length);
      expect(fr.recap.length, l.id).toBe(l.recap.length);
      l.steps.forEach((s, i) => {
        if (s.kind === "celebrate") expect(fr.steps[i]).toBeNull();
        if (s.kind === "challenge") expect(fr.steps[i]?.objectives?.length).toBe(s.objectives.length);
        if (s.kind === "discover") expect((fr.steps[i]?.body as string[]).length).toBe(s.body.length);
        if (s.kind === "watch") expect(fr.steps[i]?.captions?.length).toBe(s.frames.length);
      });
    }
  });

  describe("wrong-branch", () => {
    const l = lesson("wrong-branch");

    it("the try steps leave main equal to origin/main with both commits on the feature branch", () => {
      const w = atChallenge(l);
      expect(w.repo!.branches.main).toBe(w.repo!.remoteRefs["origin/main"]);
      const log = execute(w, "git log --oneline feature/opening-hours").lines.map((x) => x.text).join("\n");
      expect(log).toMatch(/Link the opening hours/);
      expect(log).toMatch(/Add opening hours page/);
    });

    it("removing before copying gets reflog feedback, and the reflog id rescues it", () => {
      let w = run(atChallenge(l), "git switch fix-menu", "git reset --hard HEAD~1");
      expect(feedback(l, w)).toMatch(/git reflog/);
      expectFrench(l, feedback(l, w));
      const reflog = execute(w, "git reflog").lines.map((x) => x.text).join("\n");
      const id = /([0-9a-f]{7}) HEAD@\{\d+\}: commit: Add gift cards page/.exec(reflog)![1];
      w = run(w, "git switch feature/gift-cards", `git cherry-pick ${id}`);
      expect(allPass(l, w)).toBe(true);
    });

    it("merging fix-menu instead of cherry-picking doesn't count", () => {
      const w = run(atChallenge(l), "git switch feature/gift-cards", 'git merge fix-menu -m "merge"', "git switch fix-menu", "git reset --hard HEAD~1");
      expect(objective(l, "copied").check(w, l.setup(), [])).toBe(false);
      expect(feedback(l, w)).toMatch(/merging fix-menu/);
      expectFrench(l, feedback(l, w));
    });

    it("reverting on fix-menu instead of dropping the commit gets advice", () => {
      const w = run(atChallenge(l), "git switch feature/gift-cards", "git cherry-pick fix-menu", "git switch fix-menu", "git revert HEAD");
      expect(objective(l, "removed").check(w, l.setup(), [])).toBe(false);
      expect(feedback(l, w)).toMatch(/You reverted/);
      expectFrench(l, feedback(l, w));
      expect(allPass(l, run(w, "git reset --hard HEAD~2"))).toBe(true);
    });
  });

  describe("broke-main", () => {
    const l = lesson("broke-main");

    it("starts with red CI on main", () => {
      const runs = l.setup().hosted[CAFE_URL].runs!;
      expect(runs.map((r) => r.status)).toEqual(["success", "success", "failure", "failure"]);
    });

    it("reset + force-push makes CI green but fails the lesson", () => {
      const w = run(atChallenge(l), "git reset --hard HEAD~2", "git push --force");
      expect(w.hosted[CAFE_URL].runs!.at(-1)!.status).toBe("success");
      expect(objective(l, "reverted").check(w, l.setup(), [])).toBe(false);
      expect(feedback(l, w)).toMatch(/You rewrote main/);
      expectFrench(l, feedback(l, w));
    });

    it("a local reset is caught before it's pushed", () => {
      const w = run(atChallenge(l), "git reset --hard HEAD~2");
      expect(feedback(l, w)).toMatch(/no longer has Sam's commit/);
      expectFrench(l, feedback(l, w));
    });

    it("a fix by hand isn't a revert; an unpushed revert is pointed out", () => {
      let w = atChallenge(l);
      w = { ...w, workdir: { ...w.workdir, "index.html": w.workdir["index.html"].replace("<head>\n", "<head>\n  <title>Café Gitverse</title>\n") } };
      const byHand = run(w, 'git commit -am "Put the title back"', "git push");
      expect(objective(l, "reverted").check(byHand, l.setup(), [])).toBe(false);
      expect(feedback(l, byHand)).toMatch(/by hand/);
      expectFrench(l, feedback(l, byHand));
      const local = run(atChallenge(l), "git revert HEAD~1");
      expect(feedback(l, local)).toMatch(/only on your computer/);
      expectFrench(l, feedback(l, local));
    });

    it("the merge demo reverts a merge with -m 1", () => {
      const watch = l.steps.find((s) => s.kind === "watch")!;
      if (watch.kind !== "watch") throw new Error();
      const w = run(watch.setup(), "git revert -m 1 HEAD");
      expect(w.workdir["index.html"]).toMatch(/menu\.html/);
      expect(w.workdir["style.css"]).toBeUndefined();
      expect(w.workdir["menu.html"]).toMatch(/Cheesecake/);
    });
  });

  describe("leaked-secret", () => {
    const l = lesson("leaked-secret");

    it("scenario (a): nothing is pushed and no commit of main has .env", () => {
      const s = l.setup();
      const w = atChallenge(l);
      expect(w.hosted[CAFE_URL].branches.main).toBe(s.hosted[CAFE_URL].branches.main);
      expect(w.workdir[".env"]).toMatch(/PAY_API_KEY/);
      const log = execute(w, "git log --oneline").lines.map((x) => x.text).join("\n");
      expect(log).toMatch(/Add newsletter signup/);
      expect(execute(w, "git show --stat HEAD").lines.map((x) => x.text).join("\n")).not.toMatch(/\.env /);
    });

    it("deleting .env in a new commit leaves it in history", () => {
      const w = run(atChallenge(l), "git switch feature/payments", "git rm --cached .env", 'echo ".env" >> .gitignore', "git add .gitignore", 'git commit -m "Remove .env"', "git push");
      expect(objective(l, "clean").check(w, l.setup(), [])).toBe(false);
      expect(objective(l, "ignored").check(w, l.setup(), [])).toBe(true);
      expect(feedback(l, w)).toMatch(/new commit/);
      expectFrench(l, feedback(l, w));
    });

    it("a clean history without rotation is called out; an unpushed rewrite too", () => {
      const steps = RESCUE_SOLUTIONS["leaked-secret"].slice(1) as string[];
      const local = run(atChallenge(l), ...steps.slice(0, -1));
      expect(feedback(l, local)).toMatch(/only on your computer/);
      expectFrench(l, feedback(l, local));
      const pushed = run(local, "git push --force-with-lease");
      expect(objective(l, "rotated").check(pushed, l.setup(), [])).toBe(false);
      expect(feedback(l, pushed)).toMatch(/Rotate it/);
      expectFrench(l, feedback(l, pushed));
    });

    it("throwing the work away with the key doesn't count", () => {
      const w = run(atChallenge(l), "git switch feature/payments", "git reset --hard origin/main", "git push --force-with-lease");
      expect(objective(l, "clean").check(w, l.setup(), [])).toBe(false);
      expect(feedback(l, w)).toMatch(/payment page or its style is missing/);
      expectFrench(l, feedback(l, w));
    });

    it("plain git push of the rewrite is rejected; --force-with-lease goes through", () => {
      const steps = RESCUE_SOLUTIONS["leaked-secret"].slice(0, -1) as string[];
      const w = run(atChallenge(l), ...steps);
      expect(execute(w, "git push").ok).toBe(false);
      expect(execute(w, "git push --force-with-lease").ok).toBe(true);
    });
  });

  describe("friday-incident", () => {
    const l = lesson("friday-incident");

    it("another valid order works: carry the stash onto a new branch from main", () => {
      const w = run(
        atChallenge(l),
        "git stash pop",
        "git switch -c feature/brunch",
        'git commit -am "Add brunch prices"',
        "git switch main",
        "git reset --hard origin/main",
        "git push -u origin feature/brunch",
        'gh pr create --head feature/brunch --title "Brunch" --body "Prices included"',
      );
      expect(allPass(l, w)).toBe(true);
      expect(feedback(l, w)).toBeNull();
    });

    it("popping the stash on main after the reset conflicts; feedback explains and the stash survives", () => {
      let w = run(atChallenge(l), "git branch feature/brunch", "git reset --hard origin/main");
      const r = execute(w, "git stash pop");
      expect(r.ok).toBe(false);
      w = r.world;
      expect(w.repo!.stash).toHaveLength(1);
      expect(feedback(l, w)).toMatch(/applied the stash on main/);
      expectFrench(l, feedback(l, w));
      w = run(w, "git reset --hard", ...(RESCUE_SOLUTIONS["friday-incident"].slice(3) as string[]));
      expect(allPass(l, w)).toBe(true);
    });

    it("resetting main before saving the commit gets reflog feedback, and recovers", () => {
      let w = run(atChallenge(l), "git reset --hard origin/main");
      expect(feedback(l, w)).toMatch(/git reflog/);
      expectFrench(l, feedback(l, w));
      w = run(w, `git branch feature/brunch ${findId(w, "Add weekend brunch menu")}`, ...(RESCUE_SOLUTIONS["friday-incident"].slice(2) as string[]));
      expect(allPass(l, w)).toBe(true);
    });

    it("pulling into main first creates a merge; feedback guides back", () => {
      const w = run(atChallenge(l), "git pull");
      expect(feedback(l, w)).toMatch(/main now has a merge/);
      expectFrench(l, feedback(l, w));
      const fixed = run(w, "git branch feature/brunch HEAD^1", "git reset --hard origin/main", ...(RESCUE_SOLUTIONS["friday-incident"].slice(3) as string[]));
      expect(allPass(l, fixed)).toBe(true);
    });

    it("pushing the brunch commit to main fails the lesson", () => {
      const w = run(atChallenge(l), "git pull", "git push");
      expect(objective(l, "main").check(w, l.setup(), [])).toBe(false);
      expect(feedback(l, w)).toMatch(/pushed straight to main/);
      expectFrench(l, feedback(l, w));
    });

    it("dropping the stash loses the prices", () => {
      const w = run(atChallenge(l), "git stash drop");
      expect(feedback(l, w)).toMatch(/prices are gone/);
      expectFrench(l, feedback(l, w));
    });

    it("guides the last steps: push, then open the PR", () => {
      const steps = RESCUE_SOLUTIONS["friday-incident"] as string[];
      let w = run(atChallenge(l), ...steps.slice(0, 6));
      expect(feedback(l, w)).toMatch(/only on your computer/);
      expectFrench(l, feedback(l, w));
      w = run(w, steps[6]);
      expect(feedback(l, w)).toMatch(/open the pull request/);
      expectFrench(l, feedback(l, w));
    });
  });
});
