import { describe, expect, it } from "vitest";
import { execute, runScript, type World } from "@/engine";
import { CAFE_URL, WORKFLOW_FR, WORKFLOW_LESSONS } from "../chapters/workflows";
import { translateFeedback } from "../localize";
import type { ChallengeStep, Lesson } from "../types";
import { play, type SolutionStep } from "./play";

const INDEX_2026 = (w: World) => `WRITE index.html ${w.workdir["index.html"].replace("2023", "2026").trimEnd()}`;

export const WORKFLOW_SOLUTIONS: Record<string, SolutionStep[]> = {
  issues: [
    "git pull",
    "git switch -c fix-footer",
    INDEX_2026,
    'git commit -am "Update footer year"',
    "git push -u origin fix-footer",
    'gh pr create --title "Update footer year" --body "Fixes #3"',
    "gh pr merge --merge -d",
  ],
  actions: [
    "gh run view --log-failed",
    (w) => `WRITE index.html ${w.workdir["index.html"].replace("<head>\n", "<head>\n  <title>Café Gitverse</title>\n").trimEnd()}`,
    "npm test",
    'git commit -am "Restore page title"',
    "git push",
  ],
  "ci-cd": [
    (w) => `WRITE index.html ${w.workdir["index.html"].replace("</p>\n", '</p>\n  <a href="menu.html">See the menu</a>\n').trimEnd()}`,
    'git commit -am "Bring back the menu link"',
    "git push",
    "gh pr merge --merge",
    "gh run list",
  ],
  secrets: ['echo ".env" > .gitignore', 'echo "<h1>About us</h1>" > about.html', "git add .", 'git commit -m "Add about page"', "git push"],
};

const lesson = (id: string) => WORKFLOW_LESSONS.find((l) => l.id === id)!;
const challenge = (l: Lesson) => l.steps.find((s) => s.kind === "challenge") as ChallengeStep;
const objective = (l: Lesson, id: string) => challenge(l).objectives.find((o) => o.id === id)!;
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

describe("chapter: GitHub Developer Workflows", () => {
  it("setups are deterministic", () => {
    for (const l of WORKFLOW_LESSONS) expect(JSON.stringify(l.setup())).toBe(JSON.stringify(l.setup()));
  });

  for (const l of WORKFLOW_LESSONS) {
    it(`lesson "${l.id}" is completable end-to-end`, () => {
      play(l, WORKFLOW_SOLUTIONS[l.id]);
    });
  }

  it("French text covers every lesson, step and objective", () => {
    for (const l of WORKFLOW_LESSONS) {
      const fr = WORKFLOW_FR[l.id];
      expect(fr, l.id).toBeDefined();
      expect(fr.steps.length, l.id).toBe(l.steps.length);
      expect(fr.concepts.length, l.id).toBe(l.concepts.length);
      l.steps.forEach((s, i) => {
        if (s.kind === "celebrate") expect(fr.steps[i]).toBeNull();
        if (s.kind === "challenge") expect(fr.steps[i]?.objectives?.length).toBe(s.objectives.length);
        if (s.kind === "discover") expect((fr.steps[i]?.body as string[]).length).toBe(s.body.length);
      });
    }
  });

  it("issues: closing the issue by hand doesn't count", () => {
    const l = lesson("issues");
    const w = runScript(atChallenge(l), ["gh issue close 3"]);
    expect(objective(l, "closed").check(w, l.setup(), [])).toBe(false);
    expect(challenge(l).feedback!(w, l.setup())).toMatch(/closed the issue by hand/);
  });

  it("issues: a direct push with 'fixes #3' doesn't count", () => {
    const l = lesson("issues");
    let w = runScript(atChallenge(l), ["git pull"]);
    w = { ...w, workdir: { ...w.workdir, "index.html": w.workdir["index.html"].replace("2023", "2026") } };
    const r = execute(w, 'git commit -am "Footer, fixes #3" && git push');
    // main is not protected in this lesson: the push lands and closes the issue by commit
    expect(objective(l, "closed").check(r.world, l.setup(), [])).toBe(false);
    expect(challenge(l).feedback!(r.world, l.setup())).toMatch(/direct push/);
  });

  it("actions: weakening the test doesn't make main green", () => {
    const l = lesson("actions");
    let w = atChallenge(l);
    w = { ...w, workdir: { ...w.workdir, "package.json": w.workdir["package.json"].replace(/"test": ".*"/, '"test": "echo ok"') } };
    w = runScript(w, ['git commit -am "skip test"', "git push"]);
    expect(w.hosted[CAFE_URL].runs!.at(-1)!.status).toBe("success");
    expect(objective(l, "green").check(w, l.setup(), [])).toBe(false);
    expect(challenge(l).feedback!(w, l.setup())).toMatch(/changed the test/);
  });

  it("ci-cd: merging is blocked while the test fails", () => {
    const l = lesson("ci-cd");
    const r = execute(atChallenge(l), "gh pr merge --merge");
    expect(r.ok).toBe(false);
    expect(r.lines.map((x) => x.text).join("\n")).toMatch(/Required check failing: test/);
  });

  it("ci-cd: the deploy pipeline only runs on main", () => {
    const l = lesson("ci-cd");
    const w = play(l, WORKFLOW_SOLUTIONS["ci-cd"]);
    const runs = w.hosted[CAFE_URL].runs!;
    expect(runs.filter((r) => r.workflow === "Deploy").every((r) => r.branch === "main" && r.event === "push")).toBe(true);
    expect(runs.at(-1)!.jobs.map((j) => [j.name, j.ok])).toEqual([["test", true], ["build", true], ["deploy", true]]);
  });

  it("secrets: committing .env is caught", () => {
    const l = lesson("secrets");
    const w = runScript(atChallenge(l), ['echo "<h1>About</h1>" > about.html', "git add .", 'git commit -m "about"']);
    expect(challenge(l).feedback!(w, l.setup())).toMatch(/a commit contains .env/);
    const pushed = execute(w, "git push").world;
    expect(objective(l, "safe").check(pushed, l.setup(), [])).toBe(false);
    expect(challenge(l).feedback!(pushed, l.setup())).toMatch(/rotate the token/);
  });

  it("secrets: undoing the .env commit before pushing recovers", () => {
    const l = lesson("secrets");
    let w = runScript(atChallenge(l), ['echo "<h1>About</h1>" > about.html', "git add .", 'git commit -m "about"', "git reset HEAD~1"]);
    expect(challenge(l).feedback!(w, l.setup())).toBeNull();
    w = runScript(w, ['echo ".env" > .gitignore', "git add .", 'git commit -m "Add about page"', "git push"]);
    for (const o of challenge(l).objectives) expect(o.check(w, l.setup(), []), o.id).toBe(true);
  });

  it("French feedback patterns match the English messages", () => {
    const l = lesson("issues");
    const w = runScript(atChallenge(l), ["gh issue close 3"]);
    const msg = challenge(l).feedback!(w, l.setup());
    expect(translateFeedback(msg, WORKFLOW_FR.issues.feedback)).toMatch(/gh issue reopen 3 et/);
  });
});
