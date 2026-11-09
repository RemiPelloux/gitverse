import { describe, expect, it } from "vitest";
import { execute, type World } from "@/engine";
import { BAKERY_URL, NEWSLETTER_FIXED, PR_FR, PR_LESSONS } from "../chapters/pull-requests";
import { translateFeedback } from "../localize";
import type { ChallengeStep, Lesson } from "../types";
import { play, type SolutionStep } from "./play";

export const PR_SOLUTIONS: Record<string, SolutionStep[]> = {
  "create-pr": [
    "git switch main",
    "git switch -c feature/contact",
    "WRITE contact.html <h1>Contact</h1>",
    "git add contact.html",
    'git commit -m "Add contact page"',
    "git push -u origin feature/contact",
    'gh pr create --title "Add contact page" --body "Customers want to call us, so this adds our phone number."',
  ],
  "code-review": [
    // the fix is an editor change: the learner rewrites the button line
    "WRITE newsletter.html <button>Subscribe</button>",
    'git commit -am "Fix typo in subscribe button"',
    "git push",
  ],
  "merge-strategies": ["gh pr merge 2 --squash", "gh pr merge 3 --rebase", "git pull", "git log --oneline --graph"],
  "branch-protection": [
    `gh pr create --title "Say we're closed on Mondays" --body "We close on Mondays, the site said we were open."`,
    "gh pr merge --squash -d",
    "git fetch",
    "git reset --hard origin/main",
  ],
};

const lesson = (id: string) => PR_LESSONS.find((l) => l.id === id)!;
const challenge = (l: Lesson) => l.steps.find((s): s is ChallengeStep => s.kind === "challenge")!;
const run = (w: World, ...cmds: string[]) =>
  cmds.reduce((acc, cmd) => {
    const r = execute(acc, cmd);
    expect(r.ok, `${cmd}\n${r.lines.map((l) => l.text).join("\n")}`).toBe(true);
    return r.world;
  }, w);
/** Play the lesson's try steps only, returning the world at the start of the challenge. */
const atChallenge = (id: string): { w: World; start: World } => {
  const l = lesson(id);
  const start = l.setup();
  let w = start;
  for (const s of l.steps) {
    if (s.kind !== "try") continue;
    w = s.action ? { ...w, workdir: { ...w.workdir, [s.action.path]: s.action.content } } : execute(w, s.command!).world;
  }
  return { w, start };
};
const objectives = (id: string, w: World, start: World) => Object.fromEntries(challenge(lesson(id)).objectives.map((o) => [o.id, o.check(w, start, [])]));

describe("pull-requests chapter", () => {
  it("exports four lessons in order, last one is the boss", () => {
    expect(PR_LESSONS.map((l) => l.id)).toEqual(["create-pr", "code-review", "merge-strategies", "branch-protection"]);
    expect(PR_LESSONS.every((l) => l.chapterId === "pull-requests")).toBe(true);
    expect(PR_LESSONS.map((l) => !!l.boss)).toEqual([false, false, false, true]);
  });

  for (const l of PR_LESSONS) {
    it(`${l.id}: plays through`, () => {
      play(l, PR_SOLUTIONS[l.id]);
    });
    it(`${l.id}: setup is deterministic`, () => {
      expect(JSON.stringify(l.setup())).toBe(JSON.stringify(l.setup()));
    });
    it(`${l.id}: French text matches the lesson's shape`, () => {
      const fr = PR_FR[l.id];
      expect(fr.steps.length).toBe(l.steps.length);
      l.steps.forEach((s, i) => {
        if (s.kind === "celebrate") expect(fr.steps[i]).toBeNull();
        if (s.kind === "challenge") expect(fr.steps[i]?.objectives?.length).toBe(s.objectives.length);
        if (s.kind === "discover") expect((fr.steps[i]?.body as string[]).length).toBe(s.body.length);
      });
      expect(fr.concepts.length).toBe(l.concepts.length);
    });
  }

  it("code-review: committing the fix isn't enough until it's pushed", () => {
    const l = lesson("code-review");
    const { w: at, start } = atChallenge("code-review");
    expect(objectives("code-review", at, start)).toEqual({ fixed: false, pushed: false, approved: false });
    let w: World = { ...at, workdir: { ...at.workdir, "newsletter.html": NEWSLETTER_FIXED } };
    w = run(w, 'git commit -am "Fix typo in subscribe button"');
    expect(challenge(l).feedback!(w, start)).toMatch(/only on your computer/);
    w = run(w, "git push");
    expect(objectives("code-review", w, start)).toEqual({ fixed: true, pushed: true, approved: true });
  });

  it("create-pr: a branch made from feature/opening-hours doesn't count", () => {
    const { w: at, start } = atChallenge("create-pr");
    let w = run(at, "git switch -c feature/contact", "touch contact.html", "git add .", 'git commit -m "Add contact"', "git push -u origin feature/contact", 'gh pr create -t "Contact" -b "Adds a contact page."');
    expect(objectives("create-pr", w, start)).toEqual({ branch: false, pushed: false, pr: false });
    expect(challenge(lesson("create-pr")).feedback!(w, start)).toMatch(/starts from feature\/opening-hours/);
    w = run(at, "git switch main", "git switch -c feature/contact", "touch contact.html", "git add .", 'git commit -m "Add contact"', "git push -u origin feature/contact", 'gh pr create -t "Contact"');
    expect(objectives("create-pr", w, start)).toEqual({ branch: true, pushed: true, pr: false });
    expect(challenge(lesson("create-pr")).feedback!(w, start)).toMatch(/no body/);
  });

  it("merge-strategies: the wrong strategy is caught and explained (in French too)", () => {
    const { w: at, start } = atChallenge("merge-strategies");
    const w = run(at, "gh pr merge 2 --merge");
    expect(objectives("merge-strategies", w, start).squash).toBe(false);
    const msg = challenge(lesson("merge-strategies")).feedback!(w, start);
    expect(msg).toMatch(/#2 was merged with --merge, not --squash/);
    expect(translateFeedback(msg, PR_FR["merge-strategies"].feedback)).toMatch(/#2 a été fusionnée avec --merge, pas --squash/);
  });

  it("branch-protection: git push is refused, and git pull after the squash is not enough", () => {
    const start = lesson("branch-protection").setup();
    const pushed = execute(start, "git push");
    expect(pushed.ok).toBe(false);
    expect(pushed.lines.map((l) => l.text).join("\n")).toMatch(/GH006/);
    const { w: at } = atChallenge("branch-protection");
    let w = run(at, 'gh pr create -t "Closed on Mondays"', "gh pr merge --squash -d");
    expect(objectives("branch-protection", w, start)).toEqual({ pr: true, merged: true, synced: false });
    expect(challenge(lesson("branch-protection")).feedback!(w, start)).toMatch(/still carries the original commit/);
    w = run(w, "git pull");
    expect(objectives("branch-protection", w, start).synced).toBe(false);
    expect(challenge(lesson("branch-protection")).feedback!(w, start)).toMatch(/extra merge commit/);
    w = run(w, "git reset --hard origin/main");
    expect(objectives("branch-protection", w, start).synced).toBe(true);
    expect(w.hosted[BAKERY_URL].pulls![0].mergedWith).toBe("squash");
  });

  it("every feedback message has a French translation", () => {
    const l = lesson("branch-protection");
    const { w: at } = atChallenge("branch-protection");
    const w = run(at, 'gh pr create -t "x"', "gh pr merge --squash -d");
    const msg = challenge(l).feedback!(w, l.setup());
    expect(translateFeedback(msg, PR_FR[l.id].feedback)).not.toBe(msg);
  });
});
