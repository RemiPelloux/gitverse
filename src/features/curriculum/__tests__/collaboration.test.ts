import { describe, expect, it } from "vitest";
import { runScript, type World } from "@/engine";
import { TEAM_FR, TEAM_LESSONS } from "../chapters/collaboration";
import type { ChallengeStep, Lesson } from "../types";
import { play, type SolutionStep } from "./play";

const URL = "https://github.com/gitverse-team/coffee-shop.git";

export const TEAM_SOLUTIONS: Record<string, SolutionStep[]> = {
  "github-flow": [
    "git pull",
    "git switch -c feature/wifi",
    'echo "<p>Wi-Fi: coffee4all</p>" > wifi.html',
    "git add .",
    'git commit -m "Add wifi page"',
    "git push -u origin feature/wifi",
    'gh pr create --title "Add wifi page" --body "For customers"',
    "gh pr merge --merge -d",
    "git pull",
    "git fetch --prune",
  ],
  "trunk-based": ["git add flags.js", 'git commit -m "Add dark mode flag (off)"', "git pull --rebase", "git push"],
  releases: [
    "git switch -c hotfix/1.0.1 v1.0.0",
    "WRITE cart.js export const total = (price, qty) => price * qty;",
    'git commit -am "Fix cart total"',
    'git tag -a v1.0.1 -m "Fix cart total"',
    "git push origin v1.0.1",
    'gh release create v1.0.1 --notes "Fixes the cart total"',
    "git switch main",
    "git pull",
    "git merge hotfix/1.0.1",
    "git push",
  ],
};

const lesson = (id: string) => TEAM_LESSONS.find((l) => l.id === id)!;
const challenge = (l: Lesson) => l.steps.find((s) => s.kind === "challenge") as ChallengeStep;
const objective = (l: Lesson, id: string) => challenge(l).objectives.find((o) => o.id === id)!;
/** The world right before the challenge: every try step done as the learner would. */
const beforeChallenge = (l: Lesson) => {
  let w = l.setup();
  for (const s of l.steps) {
    if (s.kind !== "try") continue;
    w = s.action ? { ...w, workdir: { ...w.workdir, [s.action.path]: s.action.content } } : runScript(w, [s.command!]);
  }
  return w;
};
const run = (w: World, ...cmds: string[]) => runScript(w, cmds);

describe("chapter: team collaboration", () => {
  it("has the three lessons in order, in the collaboration chapter", () => {
    expect(TEAM_LESSONS.map((l) => l.id)).toEqual(["github-flow", "trunk-based", "releases"]);
    for (const l of TEAM_LESSONS) expect(l.chapterId).toBe("collaboration");
  });

  it("setups are deterministic", () => {
    for (const l of TEAM_LESSONS) expect(JSON.stringify(l.setup())).toBe(JSON.stringify(l.setup()));
  });

  for (const l of TEAM_LESSONS) {
    it(`"${l.id}" is completable end-to-end`, () => {
      play(l, TEAM_SOLUTIONS[l.id]);
    });
  }

  it("French text matches every lesson's shape", () => {
    for (const l of TEAM_LESSONS) {
      const t = TEAM_FR[l.id];
      expect(t, l.id).toBeDefined();
      expect(t.steps.length, l.id).toBe(l.steps.length);
      expect(t.concepts.length, l.id).toBe(l.concepts.length);
      l.steps.forEach((s, i) => {
        const st = t.steps[i];
        if (s.kind === "celebrate") expect(st).toBeNull();
        else expect(st?.title, `${l.id} step ${i}`).toBeTruthy();
        if (s.kind === "watch") expect(st?.captions?.length).toBe(s.frames.length);
        if (s.kind === "challenge") expect(st?.objectives?.length).toBe(s.objectives.length);
      });
    }
  });
});

describe("github-flow", () => {
  const l = lesson("github-flow");

  it("a merge without -d leaves branches behind, and feedback walks the cleanup", () => {
    const s = l.setup();
    let w = run(
      beforeChallenge(l),
      "git switch -c feature/wifi",
      'echo "wifi" > wifi.html',
      "git add .",
      'git commit -m "Add wifi page"',
      "git push -u origin feature/wifi",
      'gh pr create --title "Add wifi page"',
      "gh pr merge --merge",
    );
    expect(objective(l, "merged").check(w, s, [])).toBe(true);
    expect(challenge(l).feedback!(w, s)).toMatch(/still exists on GitHub/);
    w = run(w, "git push origin --delete feature/wifi");
    expect(challenge(l).feedback!(w, s)).toMatch(/doesn't have it yet/);
    w = run(w, "git switch main", "git pull");
    expect(challenge(l).feedback!(w, s)).toMatch(/local branch feature\/wifi/);
    expect(objective(l, "tidy").check(w, s, [])).toBe(false);
    w = run(w, "git branch -d feature/wifi");
    for (const o of challenge(l).objectives) expect(o.check(w, s, []), o.id).toBe(true);
  });

  it("a commit on main is caught, and the suggested fix works", () => {
    const s = l.setup();
    let w = run(beforeChallenge(l), 'echo "wifi" > wifi.html', "git add .", 'git commit -m "Add wifi page"');
    expect(challenge(l).feedback!(w, s)).toMatch(/committed on main/);
    w = run(w, "git switch -c feature/wifi", "git branch -f main origin/main");
    expect(challenge(l).feedback!(w, s)).toBeNull();
    expect(w.repo!.branches.main).toBe(w.repo!.remoteRefs["origin/main"]);
  });

  it("a squash merge completes the loop too", () => {
    const s = l.setup();
    const w = run(
      beforeChallenge(l),
      "git switch -c feature/wifi",
      'echo "wifi" > wifi.html',
      "git add .",
      'git commit -m "Add wifi page"',
      "git push -u origin feature/wifi",
      'gh pr create --title "Add wifi page"',
      "gh pr merge --squash -d",
      "git pull",
      "git fetch --prune",
    );
    for (const o of challenge(l).objectives) expect(o.check(w, s, []), o.id).toBe(true);
  });
});

describe("trunk-based", () => {
  const l = lesson("trunk-based");

  it("a plain git pull (merge) fails the linear-history objective", () => {
    const s = l.setup();
    let w = run(beforeChallenge(l), "git add flags.js", 'git commit -m "Add flag"', "git pull");
    expect(challenge(l).feedback!(w, s)).toMatch(/merged instead of rebasing/);
    const pushed = run(w, "git push");
    expect(objective(l, "everyone").check(pushed, s, [])).toBe(true);
    expect(objective(l, "linear").check(pushed, s, [])).toBe(false);
    expect(challenge(l).feedback!(pushed, s)).toMatch(/merge commit reached GitHub/);
    // the suggested undo recovers
    w = run(w, "git reset --hard HEAD~1", "git pull --rebase", "git push");
    for (const o of challenge(l).objectives) expect(o.check(w, s, []), o.id).toBe(true);
  });

  it("a force push that drops Sam's work does not pass", () => {
    const s = l.setup();
    const w = run(beforeChallenge(l), "git add flags.js", 'git commit -m "Add flag"', "git push --force");
    expect(objective(l, "everyone").check(w, s, [])).toBe(false);
    expect(challenge(l).feedback!(w, s)).toMatch(/force push/);
  });
});

describe("releases", () => {
  const l = lesson("releases");

  it("bringing the fix back with cherry-pick works too", () => {
    const s = l.setup();
    const w = run(
      beforeChallenge(l),
      "git switch -c hotfix/1.0.1 v1.0.0",
      'echo "export const total = (price, qty) => price * qty;" > cart.js',
      'git commit -am "Fix cart total"',
      'git tag -a v1.0.1 -m "Fix cart total"',
      "git push origin v1.0.1",
      "gh release create v1.0.1 --generate-notes",
      "git switch main",
      "git pull",
      "git cherry-pick hotfix/1.0.1",
      "git push",
    );
    for (const o of challenge(l).objectives) expect(o.check(w, s, []), o.id).toBe(true);
    expect(w.hosted[URL].releases!.map((r) => r.tag)).toEqual(["v1.0.0", "v1.0.1"]);
  });

  it("a hotfix made from main (shipping unreleased work) does not pass", () => {
    const s = l.setup();
    let w = run(
      beforeChallenge(l),
      "git pull",
      'echo "export const total = (price, qty) => price * qty;" > cart.js',
      'git commit -am "Fix cart total"',
      'git tag -a v1.0.1 -m "Fix cart total"',
      "git push origin v1.0.1",
      "git push",
    );
    expect(objective(l, "fix").check(w, s, [])).toBe(false);
    expect(objective(l, "tag").check(w, s, [])).toBe(false);
    expect(challenge(l).feedback!(w, s)).toMatch(/includes Maya's unfinished search page/);
    // the suggested recovery works
    w = run(w, "git tag -d v1.0.1", "git push origin --delete v1.0.1", "git switch -c hotfix/1.0.1 v1.0.0");
    expect(challenge(l).feedback!(w, s)).toBeNull();
  });

  it("feedback reminds you to bring the fix back to main", () => {
    const s = l.setup();
    const w = run(
      beforeChallenge(l),
      "git switch -c hotfix/1.0.1 v1.0.0",
      'echo "export const total = (price, qty) => price * qty;" > cart.js',
      'git commit -am "Fix cart total"',
      'git tag -a v1.0.1 -m "Fix cart total"',
      "git push origin v1.0.1",
      'gh release create v1.0.1 --notes "Fix"',
    );
    expect(objective(l, "release").check(w, s, [])).toBe(true);
    expect(objective(l, "main").check(w, s, [])).toBe(false);
    expect(challenge(l).feedback!(w, s)).toMatch(/bring the fix to main/);
  });
});
