import { ancestors, emptyWorld, type FileMap, type HostedRepo, type World, type WorkflowRun } from "@/engine";
import * as c from "../checks";
import type { LessonText } from "../localize";
import { Scenario, scenario } from "../scenario";
import type { Lesson } from "../types";
import { CAFE_URL, CI_YML } from "./workflows";

// ───────────────────────────────────────────── Chapter 12 — Real-World Rescue Missions

const UI = { files: true, editor: true, stages: false, remote: true };

const URL = CAFE_URL;

const README = "# Café Gitverse\n\nThe website of our little neighbourhood café.\n";
const INDEX = `<html>
<head>
  <title>Café Gitverse</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Café Gitverse</h1>
  <p>Fresh coffee and cake, every day.</p>
  <p>Open every day, 8:00 to 18:00.</p>
  <a href="menu.html">See the menu</a>
</body>
</html>
`;
const MENU = "<h1>Menu</h1>\n<ul>\n  <li>Expresso — 2.00</li>\n  <li>Cappuccino — 3.00</li>\n  <li>Carrot cake — 4.00</li>\n</ul>\n";
const STYLE = "body {\n  font-family: Georgia, serif;\n  background: #fdf6ec;\n}\n";
const TEST_SCRIPT = 'grep -q "<title>" index.html && grep -q menu.html index.html';
const PACKAGE = JSON.stringify({ name: "cafe", version: "1.0.0", scripts: { test: TEST_SCRIPT } }, null, 2) + "\n";

/** The team's café repository on the simulated GitHub, as Maya first pushed it (Maya's own clone). */
function cafeTeam(files: FileMap = {}): Scenario {
  return scenario()
    .run("git init")
    .commit("Start the café website", { "README.md": README, "index.html": INDEX, "menu.html": MENU, "style.css": STYLE, ...files }, "Maya")
    .host(URL, "gitverse-team", "cafe")
    .run(`git remote add origin ${URL}`, "git config user.name Maya", "git push -u origin main");
}

/** Your own clone of whatever the team pushed so far. */
const yourClone = (team: World) =>
  new Scenario({ ...emptyWorld(), hosted: team.hosted, hostedCommits: team.hostedCommits, clock: team.clock, seq: team.seq }).run(`git clone ${URL} .`);

/** A teammate clones, commits on main and pushes, while you keep working: only GitHub changes. */
function teammatePush(w: World, author: string, message: string, edit: (files: FileMap) => FileMap): World {
  const mate = new Scenario({ ...emptyWorld(), hosted: structuredClone(w.hosted), hostedCommits: structuredClone(w.hostedCommits), clock: w.clock, seq: w.seq })
    .run(`git clone ${URL} .`);
  mate.commit(message, edit(mate.world.workdir), author).run("git push");
  return { ...w, hosted: mate.world.hosted, hostedCommits: mate.world.hostedCommits, clock: mate.world.clock, seq: mate.world.seq };
}

// ── helpers over local and GitHub state

const host = (w: World): HostedRepo | undefined => w.hosted[URL];
const me = (w: World) => w.user.name;

/** Commits reachable from a local branch. */
const localHistory = (w: World, branch: string) => {
  const tip = w.repo?.branches[branch];
  return tip ? [...ancestors(w.repo!, tip)].map((id) => w.repo!.commits[id]) : [];
};
const localTree = (w: World, branch: string): FileMap => {
  const tip = w.repo?.branches[branch];
  return tip ? w.repo!.commits[tip].tree : {};
};

/** Commits reachable from a branch on GitHub. */
function hostedHistory(w: World, branch: string) {
  const seen = new Set<string>();
  const todo = [host(w)?.branches[branch]].filter((x): x is string => !!x);
  while (todo.length) {
    const id = todo.pop()!;
    if (seen.has(id) || !w.hostedCommits[id]) continue;
    seen.add(id);
    todo.push(...w.hostedCommits[id].parents);
  }
  return [...seen].map((id) => w.hostedCommits[id]);
}
const hostedTree = (w: World, branch: string): FileMap => {
  const tip = host(w)?.branches[branch];
  return tip ? (w.hostedCommits[tip]?.tree ?? {}) : {};
};

const runs = (w: World): WorkflowRun[] => host(w)?.runs ?? [];
/** The newest push run of CI on main, if it ran on main's current tip. */
const tipRun = (w: World) => {
  const r = runs(w).filter((x) => x.workflow === "CI" && x.event === "push" && x.branch === "main").at(-1);
  return r && r.commit === host(w)?.branches.main ? r : undefined;
};

/** Local main is exactly GitHub's main, and your origin/main knows it. */
const mainInSync = (w: World) =>
  !!w.repo && !!host(w)?.branches.main && w.repo.branches.main === host(w)!.branches.main && w.repo.remoteRefs["origin/main"] === host(w)!.branches.main;

// ───────────────────────────────────────────── 1. Committed to the wrong branch

const HOURS_HTML = "<h1>Opening hours</h1>\n<p>Monday to Friday: 8:00 to 18:00</p>\n<p>Weekends: 9:00 to 17:00</p>\n";
const INDEX_HOURS = INDEX.replace('  <a href="menu.html">See the menu</a>\n', '  <a href="menu.html">See the menu</a>\n  <a href="hours.html">Opening hours</a>\n');
const MENU_FIXED = MENU.replace("Expresso", "Espresso");
const GIFT_HTML = "<h1>Gift cards</h1>\n<p>Give the gift of coffee: 10, 20 or 50.</p>\n";
const GIFT_CSS = ".gift-card {\n  border: 2px dashed #8b5a2b;\n}\n";

const HOURS_MSG = "Add opening hours page";
const LINK_MSG = "Link the opening hours";
const TYPO_MSG = "Fix espresso typo";
const GIFT_MSG = "Add gift cards page";
const GIFT_START_MSG = "Start the gift cards feature";
const HOURS_BRANCH = "feature/opening-hours";
const GIFT_BRANCH = "feature/gift-cards";

const wrongBranchSetup = (): World =>
  yourClone(cafeTeam().done())
    // yesterday: a typo fix, and (by mistake) the gift cards page on the same branch
    .run("git switch -c fix-menu")
    .commit(TYPO_MSG, { "menu.html": MENU_FIXED })
    .commit(GIFT_MSG, { "giftcards.html": GIFT_HTML })
    .run("git switch main", `git switch -c ${GIFT_BRANCH}`)
    .commit(GIFT_START_MSG, { "giftcards.css": GIFT_CSS })
    // this morning: two commits straight on main
    .run("git switch main")
    .commit(HOURS_MSG, { "hours.html": HOURS_HTML })
    .commit(LINK_MSG, { "index.html": INDEX_HOURS })
    .done();

/** Both opening-hours commits are reachable from the feature branch. */
const hoursSaved = (w: World, s: World) => c.branchContains(w, HOURS_BRANCH, c.findCommit(s, LINK_MSG));
const mainRestored = (w: World) => !!w.repo && w.repo.branches.main === w.repo.remoteRefs["origin/main"];
const giftOnAnyBranch = (w: World) => Object.keys(w.repo?.branches ?? {}).some((b) => localTree(w, b)["giftcards.html"] === GIFT_HTML);

const wrongBranch: Lesson = {
  id: "wrong-branch",
  chapterId: "scenarios",
  title: "Committed to the wrong branch",
  tagline: "Move commits where they belong, lose nothing",
  xp: 200,
  concepts: ["branches are labels", "reset --hard", "cherry-pick", "reflog", "look before you act"],
  commands: ["git status", "git log --oneline --graph", "git branch <name>", "git reset --hard origin/main", "git switch <branch>", "git cherry-pick <commit>", "git reflog"],
  ui: UI,
  setup: wrongBranchSetup,
  recap: [
    "Before fixing anything, look: git status and git log --oneline --graph tell you where you are and what's on which branch.",
    "Commits on the wrong branch: put a new label on them (git branch), move the wrong label back (git reset --hard), switch.",
    "Wrong feature branch: copy first (git cherry-pick), remove second (git reset --hard HEAD~1). Never the other way round.",
    "If something seems lost, it isn't: git reflog remembers every commit HEAD visited.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Monday, 9:40 am",
      body: [
        "Coffee in hand, you've just made two commits for the café's new opening hours page. You type git status out of habit and read: On branch main. Your branch is ahead of 'origin/main' by 2 commits.",
        "Main? The team never commits straight to main: every change goes on a feature branch and through a pull request. Your stomach tightens.",
        "Breathe. Nothing is pushed, so nobody else has these commits. And remember what a branch is: a label pointing at a commit. The commits themselves are fine; only the labels are in the wrong place. The rescue is moving labels.",
        "Rule number one of every rescue: look before you touch. Never type a fix you don't understand into a repository you haven't inspected.",
      ],
      scene: "repo-state",
    },
    {
      kind: "try",
      title: "Where am I?",
      body: "Start every rescue the same way.",
      command: "git status",
      check: (_w, _s, ran) => ran.includes("status"),
      success: "“Your branch is ahead of 'origin/main' by 2 commits”: two commits exist only on your computer, on main. Since they were never pushed, you can still move them quietly.",
    },
    {
      kind: "try",
      title: "What happened?",
      body: "Draw the history to see exactly which commits are on main.",
      command: "git log --oneline --graph",
      check: (_w, _s, ran) => ran.includes("log"),
      success: `Your two commits (“${HOURS_MSG}”, “${LINK_MSG}”) sit on top of the commit marked origin/main, which is where GitHub's main is. Those two are what must move.`,
    },
    {
      kind: "try",
      title: "Save the work with a new label",
      body: `Create the branch they should have been on, right here. Use git branch, not git switch -c: you want a label on these commits while you stay on main to clean it.`,
      command: `git branch ${HOURS_BRANCH}`,
      check: (w, s) => hoursSaved(w, s),
      success: `Nothing printed, but ${HOURS_BRANCH} now points at your latest commit. Both commits are safe on it, whatever happens to main next.`,
    },
    {
      kind: "try",
      title: "Put main back",
      body: "Move main back to where GitHub has it. origin/main is your copy of GitHub's main; --hard moves the branch and resets your files to match. (git reset --hard HEAD~2, two commits back, would do the same here.)",
      command: "git reset --hard origin/main",
      check: (w, s) => mainRestored(w) && hoursSaved(w, s),
      success: `“HEAD is now at … Start the café website”. main is exactly GitHub's main again. Your commits didn't vanish: ${HOURS_BRANCH} still points at them.`,
    },
    {
      kind: "try",
      title: "Go where the work is",
      body: "Switch to the feature branch and carry on as if nothing happened.",
      command: `git switch ${HOURS_BRANCH}`,
      check: (w, s) => c.onBranch(w, HOURS_BRANCH) && mainRestored(w) && hoursSaved(w, s),
      success: `You're on ${HOURS_BRANCH} with both commits; git log --oneline shows them. Rescue done in three commands. Next time, git switch -c before your first commit.`,
    },
    {
      kind: "discover",
      title: "The other classic: the wrong feature branch",
      body: [
        `Sometimes the work landed on another feature branch. Yesterday, for instance, you fixed the espresso typo on fix-menu… and then committed the gift cards page there too. It belongs on ${GIFT_BRANCH}.`,
        "This time you can't just move a label: fix-menu must keep its first commit. So you copy the one commit with git cherry-pick, then remove it from the wrong branch with git reset --hard HEAD~1.",
        "Order matters: copy first, remove second. And if you ever get it backwards, git reflog lists every commit HEAD has visited, removed ones included. Nothing you committed is lost for weeks.",
      ],
      scene: "repo-state",
    },
    {
      kind: "challenge",
      title: "Challenge: untangle yesterday",
      body: `Move “${GIFT_MSG}” from fix-menu to ${GIFT_BRANCH}. fix-menu must end with only the typo fix, and ${GIFT_BRANCH} must not get the typo fix. Don't touch main or ${HOURS_BRANCH}. Start with a look: git log --oneline --graph --all.`,
      objectives: [
        {
          id: "copied",
          label: `The gift cards page is on ${GIFT_BRANCH}, without the typo fix`,
          check: (w, s) => {
            const tree = localTree(w, GIFT_BRANCH);
            return (
              tree["giftcards.html"] === GIFT_HTML &&
              c.branchContains(w, GIFT_BRANCH, c.findCommit(s, GIFT_START_MSG)) &&
              !c.branchContains(w, GIFT_BRANCH, c.findCommit(s, TYPO_MSG)) &&
              tree["menu.html"] === MENU &&
              mainRestored(w) &&
              hoursSaved(w, s)
            );
          },
          hints: [
            "Copy the one commit onto the branch where it belongs. Be on the destination branch when you copy.",
            `git switch ${GIFT_BRANCH}, then git cherry-pick with the commit: fix-menu's latest commit is the one you want, so the branch name works as its id.`,
            `git switch ${GIFT_BRANCH} && git cherry-pick fix-menu`,
          ],
        },
        {
          id: "removed",
          label: `fix-menu ends with “${TYPO_MSG}”`,
          check: (w, s) => w.repo?.branches["fix-menu"] === c.findCommit(s, TYPO_MSG) && giftOnAnyBranch(w) && mainRestored(w) && hoursSaved(w, s),
          hints: [
            "Once the commit is copied, move fix-menu's label back by one commit.",
            "git switch fix-menu, then git reset --hard HEAD~1.",
            `git switch fix-menu && git reset --hard HEAD~1, then git log --oneline: “${TYPO_MSG}” is on top.`,
          ],
        },
      ],
      feedback: (w, s) => {
        if (!w.repo) return null;
        if (!giftOnAnyBranch(w))
          return `“${GIFT_MSG}” isn't on any branch anymore: it was removed before being copied. It's not lost! git reflog lists every commit HEAD visited: find its id there, then git switch ${GIFT_BRANCH} && git cherry-pick <id>.`;
        if (c.branchContains(w, GIFT_BRANCH, c.findCommit(s, TYPO_MSG)))
          return `${GIFT_BRANCH} now contains “${TYPO_MSG}” too: merging fix-menu brings all of its commits, not just the one you want. On ${GIFT_BRANCH}, undo with git reset --hard ORIG_HEAD, then cherry-pick only the gift cards commit.`;
        if (!mainRestored(w) || "giftcards.html" in localTree(w, "main"))
          return "main changed. It should stay exactly like GitHub's main: git switch main && git reset --hard origin/main.";
        if (!hoursSaved(w, s))
          return `${HOURS_BRANCH} lost its commits. Find “${LINK_MSG}” in git reflog, then put the label back: git branch -f ${HOURS_BRANCH} <id> (from another branch).`;
        const fix = w.repo.branches["fix-menu"];
        if (fix && fix !== c.findCommit(s, TYPO_MSG) && !("giftcards.html" in localTree(w, "fix-menu")) && localHistory(w, "fix-menu").some((x) => x.message === GIFT_MSG))
          return "You reverted the commit on fix-menu. That's the right tool for pushed branches, but fix-menu has never left your computer: you can simply drop the commit. On fix-menu, git reset --hard HEAD~2 removes both the commit and its revert.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── 2. Broke main

const NO_TITLE_INDEX = INDEX.replace("  <title>Café Gitverse</title>\n", "");
const MENU_CAKE = MENU.replace("  <li>Carrot cake — 4.00</li>\n", "  <li>Carrot cake — 4.00</li>\n  <li>Cheesecake — 4.50</li>\n");
const BAD_MSG = "Tidy up the page head";

const brokeMainSetup = (): World => {
  const team = cafeTeam({ "package.json": PACKAGE, ".github/workflows/ci.yml": CI_YML })
    .commit(HOURS_MSG, { "hours.html": HOURS_HTML }, "Maya")
    .run("git push")
    .commit(BAD_MSG, { "index.html": NO_TITLE_INDEX }, "Sam")
    .run("git push")
    .commit("Add cheesecake to the menu", { "menu.html": MENU_CAKE }, "Maya")
    .run("git push")
    .done();
  return yourClone(team).done();
};

/** A small repo where a merged pull request broke the page, for the "revert a merge" demo. */
const mergeDemoSetup = (): World =>
  scenario()
    .run("git init")
    .commit("Start the café website", { "index.html": INDEX, "menu.html": MENU }, "Maya")
    .run("git switch -c new-layout")
    .commit("New homepage layout", { "index.html": INDEX.replace('  <a href="menu.html">See the menu</a>\n', "") }, "Sam")
    .commit("Bigger headings", { "style.css": "h1 {\n  font-size: 3em;\n}\n" }, "Sam")
    .run("git switch main")
    .commit("Add cheesecake to the menu", { "menu.html": MENU_CAKE }, "Maya")
    .run('git merge new-layout -m "Merge pull request #7 from gitverse-team/new-layout"')
    .done();

const startMain = (s: World) => host(s)?.branches.main;
const revertOnGitHub = (w: World) => hostedHistory(w, "main").some((x) => x.message.startsWith(`Revert "${BAD_MSG}"`));
const testUntouched = (w: World, s: World) =>
  hostedTree(w, "main")["package.json"] === hostedTree(s, "main")["package.json"] &&
  hostedTree(w, "main")[".github/workflows/ci.yml"] === hostedTree(s, "main")[".github/workflows/ci.yml"];

const brokeMain: Lesson = {
  id: "broke-main",
  chapterId: "scenarios",
  title: "Broke main",
  tagline: "Undo a pushed mistake without rewriting history",
  xp: 225,
  concepts: ["shared history", "git revert", "git bisect", "no force-push on main", "revert -m 1"],
  commands: ["gh run list", "git log --oneline --graph", "git bisect start <bad> <good>", "git bisect run npm test", "git bisect reset", "git revert <commit>", "git revert -m 1 <merge>"],
  ui: UI,
  setup: brokeMainSetup,
  recap: [
    "When main breaks, investigate first: gh run list shows when it went red, git log and git bisect show which commit did it.",
    "On a shared branch, undo with git revert: a new commit that does the opposite. History stays true and teammates just pull.",
    "Never reset + force-push a branch others have pulled: it rewrites the ground under their feet, and can throw away their work.",
    "A bad merge is reverted with git revert -m 1 <merge>: -m 1 keeps main's side and removes what the merge brought in.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Tuesday, 10:12 am",
      body: [
        "A message from Maya: “main has been red since last night and the site can't deploy. Can you have a look?” Sam pushed a tidy-up yesterday evening, Maya pushed on top of it this morning, and everyone has already pulled.",
        "When a shared branch breaks, the reflex is to make the bad commit disappear. Resist it. First find out what broke and when. Then fix it in a way that respects everyone else's copy.",
        "Watch the GitHub tab: the Actions runs tell the story.",
      ],
      scene: "repo-state",
    },
    {
      kind: "try",
      title: "When did it turn red?",
      body: "List the CI runs on main.",
      command: "gh run list",
      check: (_w, _s, ran) => ran.includes("gh run"),
      success: "Runs 1 and 2 are green, 3 and 4 are red. So the commit pushed for run 3 broke the test, and run 4 is still red because nobody fixed it.",
    },
    {
      kind: "try",
      title: "Look at the history",
      body: "Every rescue starts with the graph.",
      command: "git log --oneline --graph",
      check: (_w, _s, ran) => ran.includes("log"),
      success: `Four commits, one per run. The suspect is the third one: Sam's “${BAD_MSG}”. Let's prove it instead of guessing.`,
    },
    {
      kind: "try",
      title: "Start a bisect",
      body: "git bisect finds the first bad commit for you. Give it a bad commit (HEAD, today) and a good one (HEAD~3, the very first commit, which was green).",
      command: "git bisect start HEAD HEAD~3",
      check: (w) => !!w.repo?.bisect,
      success: "Git checked out a commit halfway between good and bad. Now it needs to know: is this one good or bad?",
    },
    {
      kind: "try",
      title: "Let the test decide",
      body: "Instead of answering by hand, let Git run the project's test on each commit it picks.",
      command: "git bisect run npm test",
      check: (w) => !!w.repo?.bisect?.found,
      success: `“… is the first bad commit”: “${BAD_MSG}”, which deleted the <title> line the test checks. Proof, not a guess.`,
    },
    {
      kind: "try",
      title: "Back to main",
      body: "End the bisect: Git puts you back where you started.",
      command: "git bisect reset",
      check: (w) => !!w.repo && !w.repo.bisect && c.onBranch(w, "main"),
      success: "“Switched to branch 'main'”. You know exactly which commit to undo.",
    },
    {
      kind: "discover",
      title: "Undo, don't erase",
      body: [
        "Tempting: git reset --hard to before Sam's commit, then git push --force. Don't. Maya and Sam already have those commits. Rewriting main pulls the ground from under them: their next pull gets tangled, their next push can bring the bad commit right back. And Maya's cheesecake commit, made after Sam's, would be thrown away with it.",
        "That's why most teams protect main against force-pushes. On a shared branch, you undo with git revert: it creates a new commit that does the exact opposite of the bad one.",
        "History stays true: the mistake and its fix are both visible, nobody's copy breaks, and everyone simply pulls.",
      ],
      scene: "repo-state",
    },
    {
      kind: "watch",
      title: "When the culprit is a merge",
      body: "Sometimes the bad commit is a merged pull request. A merge commit has two parents, so Git needs to know which side to keep.",
      setup: mergeDemoSetup,
      frames: [
        { command: "git log --oneline --graph", caption: "Sam's pull request #7 was merged into main, and it removed the menu link." },
        { command: "git revert -m 1 HEAD", caption: "-m 1 means: keep parent 1, main's side, and undo everything the merge brought in. Both of Sam's commits are undone in one revert." },
        { command: "git log --oneline --graph", caption: "Main is fixed with one new commit. When Sam's layout is ready again, it comes back through a new pull request." },
      ],
    },
    {
      kind: "challenge",
      title: "Challenge: fix main the safe way",
      body: `Undo “${BAD_MSG}” with git revert, check the test passes on your computer, and push so CI turns green again. Don't rewrite main, and fix the page, not the test.`,
      objectives: [
        {
          id: "reverted",
          label: `GitHub's main keeps Sam's commit and has its revert on top`,
          check: (w, s) =>
            !!startMain(s) && hostedHistory(w, "main").some((x) => x.id === startMain(s)) && revertOnGitHub(w) && hostedTree(w, "main")["index.html"]?.includes("<title>") === true,
          hints: [
            "git revert <commit> makes a new commit that undoes the one you name. Then push it like any commit.",
            `Find the id of “${BAD_MSG}” in git log --oneline (it's HEAD~1), revert it, then git push.`,
            "git revert HEAD~1, then git push",
          ],
        },
        {
          id: "green",
          label: "The latest CI run on main is green",
          check: (w, s) => tipRun(w)?.status === "success" && testUntouched(w, s),
          hints: [
            "Every push to main starts a new CI run, green when npm test passes on GitHub.",
            "Run npm test on your computer first: if it passes there, it will pass on GitHub.",
            "npm test && git push, then gh run list: the newest run starts with ✓.",
          ],
        },
        {
          id: "synced",
          label: "Your main is in sync with GitHub",
          check: (w) => mainInSync(w) && c.clean(w),
          hints: [
            "When you're done, your main and GitHub's main point at the same commit.",
            "git status should say “Your branch is up to date with 'origin/main'”.",
            "If git push was rejected, someone pushed meanwhile: git pull, then git push.",
          ],
        },
      ],
      feedback: (w, s) => {
        if (!w.repo) return null;
        if (startMain(s) && !hostedHistory(w, "main").some((x) => x.id === startMain(s)))
          return "You rewrote main on GitHub: commits your teammates already have are gone from it. In a real team that breaks everyone's copy. Restart the lesson and use git revert, which only adds a commit.";
        if (!testUntouched(w, s))
          return "You changed the test or the workflow. A test you weaken stops protecting you: restart the lesson and fix the page with git revert.";
        const bad = c.findCommit(s, BAD_MSG);
        if (!c.branchContains(w, "main", bad))
          return "Your local main no longer has Sam's commit: you moved it back in time. Don't push that. Come back with git reset --hard origin/main, then use git revert.";
        if (hostedTree(w, "main")["index.html"]?.includes("<title>") && !revertOnGitHub(w))
          return `You put the title back by hand. It works, but git revert records exactly what was undone and links it to “${BAD_MSG}”. Restart the lesson and let git revert write the fix.`;
        if (localHistory(w, "main").some((x) => x.message.startsWith(`Revert "${BAD_MSG}"`)) && !revertOnGitHub(w))
          return "Your revert is only on your computer. CI runs on what you push: git push.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── 3. Committed a secret

const OLD_KEY = "pk_live_51f0c4e7";
const NEW_KEY = "pk_live_9b27d3a0";
const ENV = `PAY_API_KEY=${OLD_KEY}\n`;
const NEWSLETTER_HTML = '<h1>Newsletter</h1>\n<form>\n  <input type="email" placeholder="you@example.com">\n  <button>Sign up</button>\n</form>\n';
const PAY_HTML = "<h1>Pay online</h1>\n<p>Order your cake ahead and pay by card.</p>\n";
const PAY_STYLE = STYLE + ".pay {\n  color: darkgreen;\n}\n";
const PAY_BRANCH = "feature/payments";

const leakedSecretSetup = (): World => {
  const team = cafeTeam().done();
  team.hosted[URL].secrets = { PAY_API_KEY: OLD_KEY };
  return (
    yourClone(team)
      // yesterday: pushed with .env inside
      .run(`git switch -c ${PAY_BRANCH}`)
      .commit("Add payment page", { "pay.html": PAY_HTML, ".env": ENV })
      .commit("Style the payment page", { "style.css": PAY_STYLE })
      .run(`git push -u origin ${PAY_BRANCH}`, "git switch main")
      // just now: did it again, not pushed
      .commit("Add newsletter signup", { "newsletter.html": NEWSLETTER_HTML, ".env": ENV })
      .done()
  );
};

const ignoresEnv = (gitignore: string | undefined) => /^\/?\.env\s*$/m.test(gitignore ?? "");
const mainHasEnv = (w: World) => localHistory(w, "main").some((x) => ".env" in x.tree);
const hostedBranchHasEnv = (w: World, branch: string) => hostedHistory(w, branch).some((x) => ".env" in x.tree);
const paymentWorkKept = (w: World) => hostedTree(w, PAY_BRANCH)["pay.html"] === PAY_HTML && hostedTree(w, PAY_BRANCH)["style.css"] === PAY_STYLE;

const leakedSecret: Lesson = {
  id: "leaked-secret",
  chapterId: "scenarios",
  title: "Committed a secret",
  tagline: "Rotate first, then clean history",
  xp: 225,
  concepts: ["rm --cached", "commit --amend", "rotate the key", "rewrite your own branch", "--force-with-lease"],
  commands: ["git show --stat <commit>", "git rm --cached .env", 'echo ".env" >> .gitignore', "git commit --amend --no-edit", "git reset --soft <commit>", 'gh secret set NAME --body "…"', "git push --force-with-lease"],
  ui: UI,
  setup: leakedSecretSetup,
  recap: [
    "Not pushed yet: git rm --cached the file, ignore it, then git commit --amend (or git reset --soft HEAD~1 and commit again). It never existed.",
    "Pushed: the key is compromised. Rotate it first (revoke it, make a new one, update where it's used); cleaning history comes second.",
    "On your own branch: rewrite it (reset --soft, recommit without the file), then git push --force-with-lease, which refuses if someone else pushed meanwhile.",
    "On main or in old history: git filter-repo or BFG, plus GitHub support for cached copies. Rotation is what actually protects you.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Wednesday, 4:55 pm",
      body: [
        "You commit the newsletter signup form and glance at Git's output: create mode 100644 .env. The file that holds the café's payment key just went into a commit.",
        "First question, always: was it pushed? A commit on your computer is private. You can rewrite it as if it never happened. A pushed commit is a different story.",
        "Look before you act.",
      ],
      scene: "repo-state",
    },
    {
      kind: "try",
      title: "Pushed or not?",
      body: "Ask Git where main stands compared to GitHub.",
      command: "git status",
      check: (_w, _s, ran) => ran.includes("status"),
      success: "“ahead of 'origin/main' by 1 commit”: the commit with .env never left your computer. Phew. You can fix it privately.",
    },
    {
      kind: "try",
      title: "What's in that commit?",
      body: "List the files the last commit changed. --stat gives a summary instead of every line.",
      command: "git show --stat HEAD",
      check: (_w, _s, ran) => ran.includes("show"),
      success: "Two files: newsletter.html, which you wanted, and .env, which you didn't.",
    },
    {
      kind: "try",
      title: "Stop tracking .env",
      body: "Remove .env from the staging area, but keep it on your disk: your app still needs the key locally.",
      command: "git rm --cached .env",
      check: (w) => !!w.repo && w.repo.index[".env"] === undefined && c.fileExists(w, ".env"),
      success: "“rm '.env'”. --cached means: only from Git's staging area. The file is still in your folder, now untracked.",
    },
    {
      kind: "try",
      title: "Never again",
      body: "Add .env to .gitignore so that git add . can't pick it up next time. >> appends a line to the file (and creates it if needed).",
      command: 'echo ".env" >> .gitignore',
      check: (w) => ignoresEnv(w.workdir[".gitignore"]),
      success: "Git now ignores .env: git status won't even list it anymore.",
    },
    {
      kind: "try",
      title: "Rewrite the commit",
      body: "Stage .gitignore and amend the last commit. --amend replaces it with a new commit made from the staging area; --no-edit keeps its message.",
      command: "git add .gitignore && git commit --amend --no-edit",
      check: (w, s) => !mainHasEnv(w) && c.inHead(w, "newsletter.html") && c.inHead(w, ".gitignore") && host(w)?.branches.main === startMain(s),
      success: "A brand new commit replaced the old one: newsletter.html and .gitignore, no .env. The old commit isn't on any branch anymore. (git reset --soft HEAD~1, then committing again, gets the same result.)",
    },
    {
      kind: "discover",
      title: "Once it's pushed, it's compromised",
      body: [
        `Then your stomach drops. Yesterday you pushed ${PAY_BRANCH}… and its first commit, “Add payment page”, contains .env too. That one is on GitHub.`,
        "A pushed secret is a stolen secret. Bots scan GitHub for keys around the clock and find new ones within minutes. Cleaning the history afterwards doesn't un-steal it. So step 1 is always: rotate the key. Revoke it at the provider, create a new one, and update everywhere it's used, like the PAY_API_KEY secret on GitHub.",
        `Step 2 is cleanup. ${PAY_BRANCH} is your own branch, so you may rewrite it: rebuild it without .env, then git push --force-with-lease. Unlike --force, it refuses if someone pushed to the branch since you last fetched, so you can't erase a teammate's work by accident.`,
        "If a secret reaches main or old history, rewriting is a bigger job: git filter-repo or the BFG tool, every teammate re-clones, and GitHub support purges cached views. That's why rotation comes first: it's what actually protects you.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "Confirm the leak",
      body: `Look at the first commit of ${PAY_BRANCH} as GitHub has it.`,
      command: `git show --stat origin/${PAY_BRANCH}~1`,
      check: (_w, _s, ran) => ran.includes("show"),
      success: "“Add payment page”: pay.html and .env. The key is public. Time for the real rescue.",
    },
    {
      kind: "challenge",
      title: "Challenge: contain the leak",
      body: `The payment provider gave you a new key: ${NEW_KEY} (pretend you already revoked the old one in their dashboard). Rotate it on GitHub first, then rebuild ${PAY_BRANCH} so no commit on it contains .env, with .env ignored, and replace GitHub's version safely. Keep the payment page and its style.`,
      objectives: [
        {
          id: "rotated",
          label: "The PAY_API_KEY secret on GitHub holds the new key",
          check: (w) => host(w)?.secrets?.PAY_API_KEY === NEW_KEY,
          hints: [
            "Rotation comes first: the workflows must use the new key, the old one is dead.",
            "gh secret set replaces a secret's value.",
            `gh secret set PAY_API_KEY --body "${NEW_KEY}"`,
          ],
        },
        {
          id: "clean",
          label: `No commit of ${PAY_BRANCH} on GitHub contains .env, and the payment work is still there`,
          check: (w) => !!host(w)?.branches[PAY_BRANCH] && !hostedBranchHasEnv(w, PAY_BRANCH) && paymentWorkKept(w),
          hints: [
            "Deleting .env in a new commit isn't enough: the old commit would still have it. Rebuild the branch's commits without it, then replace GitHub's copy.",
            `git switch ${PAY_BRANCH}, git reset --soft origin/main (all the branch's changes stay staged), git rm --cached .env, commit again, then git push --force-with-lease.`,
            `git switch ${PAY_BRANCH} && git reset --soft origin/main && git rm --cached .env, then (with .gitignore, see the next objective) git commit -m "Add payment page" && git push --force-with-lease`,
          ],
        },
        {
          id: "ignored",
          label: `.gitignore on GitHub's ${PAY_BRANCH} lists .env`,
          check: (w) => ignoresEnv(hostedTree(w, PAY_BRANCH)[".gitignore"]),
          hints: [
            "This branch doesn't have the .gitignore you made on main. Add one here too, in the rebuilt commit.",
            'echo ".env" >> .gitignore, then git add .gitignore before committing.',
            'After git rm --cached .env: echo ".env" >> .gitignore && git add .gitignore, then commit and push.',
          ],
        },
      ],
      feedback: (w) => {
        if (!w.repo) return null;
        if (hostedBranchHasEnv(w, "main"))
          return "You pushed .env to main! In real life: rotate now, then it's a filter-repo job. Restart the lesson to try again.";
        if (host(w)?.branches[PAY_BRANCH] && !paymentWorkKept(w))
          return `The payment page or its style is missing from ${PAY_BRANCH} on GitHub: the work went away with the key. Your old commits are still in git reflog; restart the lesson if you're unsure.`;
        const hostedEnv = hostedBranchHasEnv(w, PAY_BRANCH);
        if (hostedEnv && !(".env" in hostedTree(w, PAY_BRANCH)))
          return `You deleted .env in a new commit. The latest version is clean, but “Add payment page” still contains the key: anyone can read it in the history. Rebuild instead: git reset --soft origin/main puts all the branch's changes back in the staging area, then git rm --cached .env and commit once.`;
        if (hostedEnv && localHistory(w, PAY_BRANCH).length && !localHistory(w, PAY_BRANCH).some((x) => ".env" in x.tree))
          return "Your clean branch is only on your computer. Replace GitHub's copy: git push --force-with-lease.";
        if (!hostedEnv && host(w)?.secrets?.PAY_API_KEY !== NEW_KEY)
          return `History is clean, but the old key still works for anyone who copied it. Rotate it: gh secret set PAY_API_KEY --body "${NEW_KEY}".`;
        if (c.onBranch(w, PAY_BRANCH) && w.repo.index[".env"] !== undefined && !(".env" in localTree(w, PAY_BRANCH)))
          return ".env is staged again. Unstage it with git rm --cached .env before you commit.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── 4. The Friday incident

const BRUNCH_HTML = "<h1>Weekend brunch</h1>\n<ul>\n  <li>Pancakes with maple syrup</li>\n  <li>Avocado toast</li>\n  <li>Fresh orange juice</li>\n</ul>\n";
const PRICES = ["7.50", "8.00", "3.50"];
const BRUNCH_PRICED = "<h1>Weekend brunch</h1>\n<ul>\n  <li>Pancakes with maple syrup — 7.50</li>\n  <li>Avocado toast — 8.00</li>\n  <li>Fresh orange juice — 3.50</li>\n</ul>\n";
const BRUNCH_MSG = "Add weekend brunch menu";
const MAYA_MSG = "Fix weekend opening hours";
const INDEX_MAYA = INDEX.replace("Open every day, 8:00 to 18:00.", "Open 8:00 to 18:00, weekends from 9:00.");

const fridaySetup = (): World => {
  let w = yourClone(cafeTeam().done())
    .commit(BRUNCH_MSG, { "brunch.html": BRUNCH_HTML })
    .files({ "brunch.html": BRUNCH_PRICED })
    .run("git stash")
    .done();
  w = teammatePush(w, "Maya", MAYA_MSG, () => ({ "index.html": INDEX_MAYA }));
  w.hosted[URL].autoReviewers = ["Maya"];
  return w;
};

const priced = (html: string | undefined) => !!html && PRICES.every((p) => html.includes(p));
/** Local branches other than main whose history has the brunch commit. */
const brunchBranches = (w: World) =>
  Object.keys(w.repo?.branches ?? {}).filter((b) => b !== "main" && localHistory(w, b).some((x) => x.message === BRUNCH_MSG));
const brunchReachable = (w: World) => Object.keys(w.repo?.branches ?? {}).some((b) => localHistory(w, b).some((x) => x.message === BRUNCH_MSG));
const myBrunchPr = (w: World) =>
  host(w)?.pulls?.find((p) => p.state === "open" && p.author === me(w) && p.base === "main" && priced(w.hostedCommits[p.headCommit]?.tree["brunch.html"]));

const friday: Lesson = {
  id: "friday-incident",
  chapterId: "scenarios",
  title: "The Friday incident",
  tagline: "Three problems, one calm rescue",
  xp: 400,
  boss: true,
  concepts: ["triage", "git stash list", "git fetch", "branch + reset", "stash pop on the right branch", "pull request"],
  commands: ["git status", "git stash list", "git fetch", "git log --oneline --graph --all", "git branch <name>", "git reset --hard origin/main", "git stash pop", "gh pr create"],
  ui: UI,
  setup: fridaySetup,
  recap: [
    "You can now read any messy repository before touching it: git status, git stash list, git fetch, git log --oneline --graph --all.",
    "You can move commits to the right branch, undo pushed mistakes with git revert, and rewrite only what's yours, with --force-with-lease.",
    "You know a pushed secret is a stolen secret: rotate first, clean up second. And that git reflog means nothing you commit is truly lost.",
    "That's the whole journey, from your first git init to rescuing a team's Friday evening. You're ready for real projects. Welcome to the team!",
  ],
  steps: [
    {
      kind: "discover",
      title: "Friday, 5:07 pm",
      body: [
        "The café launches its weekend brunch tomorrow at 9. Maya is waiting for your brunch menu as a pull request so she can review it before she leaves. Should be two minutes.",
        "Except your repository is a mess. You made the brunch commit on main by mistake. Yesterday you typed the prices, got interrupted, stashed them… and forgot. And Maya has pushed to main since.",
        "Three problems tangled together. The rescue is calm and in order: look at everything first, then fix one thing at a time. Each step you've learned in this course is about to pay off.",
      ],
      scene: "repo-state",
    },
    {
      kind: "try",
      title: "Look: your files",
      body: "Start where you always start.",
      command: "git status",
      check: (_w, _s, ran) => ran.includes("status"),
      success: "On main, ahead of origin/main by 1 commit (the brunch menu, on the wrong branch), and “nothing to commit”. So where are yesterday's prices?",
    },
    {
      kind: "try",
      title: "Look: your stash",
      body: "Work you put aside doesn't show in git status. Check the stash.",
      command: "git stash list",
      check: (_w, _s, ran) => ran.includes("stash"),
      success: `“stash@{0}: WIP on main: … ${BRUNCH_MSG}”. There are the prices, stashed on top of the brunch commit. Remember that: they belong with it.`,
    },
    {
      kind: "try",
      title: "Look: GitHub",
      body: "Find out what the team did meanwhile. fetch downloads without touching your files.",
      command: "git fetch",
      check: (w) => !!w.repo && w.repo.remoteRefs["origin/main"] === host(w)?.branches.main,
      success: "origin/main moved: Maya pushed while you were busy. Nothing in your folder changed. fetch is always safe.",
    },
    {
      kind: "try",
      title: "The whole picture",
      body: "Draw every branch at once.",
      command: "git log --oneline --graph --all",
      check: (_w, _s, ran) => ran.includes("log"),
      success: `Two lines split from the same commit: your “${BRUNCH_MSG}” on main, and Maya's “${MAYA_MSG}” on origin/main. Now you know everything. Time to fix it.`,
    },
    {
      kind: "challenge",
      title: "Boss challenge: save Friday",
      body: "Fix it all: put the brunch commit on its own branch (call it feature/brunch), make main match GitHub with Maya's fix, bring the stashed prices back on the brunch branch and commit them, then push the branch and open a pull request for Maya. Don't push anything to main.",
      objectives: [
        {
          id: "saved",
          label: "The brunch commit is on its own branch",
          check: (w) => brunchBranches(w).length > 0,
          hints: [
            "Before moving main, put a new label on the brunch commit so it's safe.",
            "While on main: git branch feature/brunch.",
            "git branch feature/brunch, then git log --oneline --all: the new label sits on your brunch commit.",
          ],
        },
        {
          id: "main",
          label: "Your main matches GitHub's, with Maya's fix",
          check: (w) =>
            mainInSync(w) && hostedHistory(w, "main").some((x) => x.message === MAYA_MSG) && !("brunch.html" in hostedTree(w, "main")) && !localHistory(w, "main").some((x) => x.message === BRUNCH_MSG),
          hints: [
            "main should be exactly GitHub's main: Maya's work, and no brunch commit.",
            "Once the brunch commit is safe on its branch: git reset --hard origin/main (after git fetch, that already includes Maya's commit). git pull also works once main is reset.",
            "git switch main && git reset --hard origin/main && git pull",
          ],
        },
        {
          id: "stash",
          label: "The stashed prices are committed on the brunch branch",
          check: (w) => brunchBranches(w).some((b) => priced(localTree(w, b)["brunch.html"])),
          hints: [
            "The stash was made on top of the brunch commit. Apply it where that commit is.",
            "git switch feature/brunch, git stash pop, then commit the change.",
            'git switch feature/brunch && git stash pop && git commit -am "Add brunch prices"',
          ],
        },
        {
          id: "pr",
          label: "A pull request proposes the priced brunch menu",
          check: (w) => !!myBrunchPr(w) && !("brunch.html" in hostedTree(w, "main")),
          hints: [
            "A pull request needs the branch on GitHub first.",
            "git push -u origin feature/brunch, then gh pr create.",
            'git push -u origin feature/brunch && gh pr create --title "Weekend brunch menu" --body "Menu and prices for Saturday"',
          ],
        },
      ],
      feedback: (w) => {
        if (!w.repo) return null;
        if ("brunch.html" in hostedTree(w, "main"))
          return "The brunch menu was pushed straight to main, skipping Maya's review. Now it's shared: don't force-push. Restart the lesson for the clean rescue (in real life, you'd git revert it on main).";
        if (!brunchReachable(w))
          return `Your brunch commit isn't on any branch anymore: main was reset before the commit was saved. It's not lost! git reflog shows “commit: ${BRUNCH_MSG}” with its id: git branch feature/brunch <id>.`;
        const stashed = w.repo.stash.length > 0;
        const anyPriced = Object.keys(w.repo.branches).some((b) => priced(localTree(w, b)["brunch.html"])) || priced(w.workdir["brunch.html"]);
        if (!stashed && !anyPriced)
          return "The prices are gone: the stash was dropped without being applied. Restart the lesson, and use git stash pop on the brunch branch.";
        if (c.onBranch(w, "main") && priced(w.workdir["brunch.html"]) && !("brunch.html" in localTree(w, "main")))
          return "You applied the stash on main, where brunch.html doesn't exist (Git reported a conflict and kept the stash). Undo with git reset --hard, then git switch feature/brunch and git stash pop there.";
        const mainHistory = localHistory(w, "main");
        if (mainHistory.some((x) => x.message === BRUNCH_MSG) && mainHistory.some((x) => x.parents.length > 1))
          return "You pulled into main before moving the brunch commit, so main now has a merge. No harm done: make sure feature/brunch exists (git branch feature/brunch), then git reset --hard origin/main.";
        if (mainHistory.some((x) => priced(x.tree["brunch.html"])))
          return "The prices were committed on main. Put a branch on that commit (git branch feature/brunch), then git reset --hard origin/main on main.";
        const ready = brunchBranches(w).find((b) => priced(localTree(w, b)["brunch.html"]));
        if (ready && !host(w)?.branches[ready])
          return `${ready} is ready but only on your computer. Push it: git push -u origin ${ready}.`;
        if (ready && host(w)?.branches[ready] !== w.repo.branches[ready])
          return `GitHub's ${ready} is behind your latest commit. git push, then open the pull request.`;
        if (ready && !myBrunchPr(w)) return "Last step: open the pull request with gh pr create.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

export const RESCUE_LESSONS: Lesson[] = [wrongBranch, brokeMain, leakedSecret, friday];

// ───────────────────────────────────────────── French

export const RESCUE_FR: Record<string, LessonText> = {
  "wrong-branch": {
    title: "Commité sur la mauvaise branche",
    tagline: "Remettre les commits à leur place, sans rien perdre",
    concepts: ["les branches sont des étiquettes", "reset --hard", "cherry-pick", "reflog", "regarder avant d'agir"],
    recap: [
      "Avant de réparer quoi que ce soit, regarde : git status et git log --oneline --graph te disent où tu es et ce qu'il y a sur chaque branche.",
      "Des commits sur la mauvaise branche : mets-leur une nouvelle étiquette (git branch), recule la mauvaise étiquette (git reset --hard), change de branche.",
      "Mauvaise branche de fonctionnalité : copie d'abord (git cherry-pick), retire ensuite (git reset --hard HEAD~1). Jamais dans l'autre sens.",
      "Si quelque chose semble perdu, ce n'est pas le cas : git reflog se souvient de chaque commit visité par HEAD.",
    ],
    steps: [
      {
        title: "Lundi, 9 h 40",
        body: [
          "Café à la main, tu viens de faire deux commits pour la nouvelle page des horaires du café. Tu tapes git status par réflexe et tu lis : On branch main. Your branch is ahead of 'origin/main' by 2 commits. (Sur la branche main. Ta branche a 2 commits d'avance sur origin/main.)",
          "main ? L'équipe ne commite jamais directement sur main : chaque changement va sur une branche de fonctionnalité et passe par une pull request. Ton estomac se noue.",
          "Respire. Rien n'est poussé, donc personne d'autre n'a ces commits. Et souviens-toi de ce qu'est une branche : une étiquette qui pointe vers un commit. Les commits vont très bien ; ce sont juste les étiquettes qui sont au mauvais endroit. Le sauvetage consiste à déplacer des étiquettes.",
          "Règle numéro un de tout sauvetage : regarde avant de toucher. Ne tape jamais une réparation que tu ne comprends pas dans un dépôt que tu n'as pas inspecté.",
        ],
      },
      {
        title: "Où suis-je ?",
        body: "Commence chaque sauvetage de la même façon.",
        success: "« Your branch is ahead of 'origin/main' by 2 commits » (2 commits d'avance) : deux commits n'existent que sur ton ordinateur, sur main. Comme ils n'ont jamais été poussés, tu peux encore les déplacer discrètement.",
      },
      {
        title: "Qu'est-ce qui s'est passé ?",
        body: "Dessine l'historique pour voir exactement quels commits sont sur main.",
        success: `Tes deux commits (« ${HOURS_MSG} », « ${LINK_MSG} ») sont posés sur le commit marqué origin/main, là où se trouve le main de GitHub. Ce sont eux qu'il faut déplacer.`,
      },
      {
        title: "Mets le travail à l'abri avec une nouvelle étiquette",
        body: "Crée ici même la branche sur laquelle ils auraient dû être. Utilise git branch, pas git switch -c : tu veux une étiquette sur ces commits tout en restant sur main pour le nettoyer.",
        success: `Rien ne s'affiche, mais ${HOURS_BRANCH} pointe maintenant vers ton dernier commit. Les deux commits sont à l'abri dessus, quoi qu'il arrive ensuite à main.`,
      },
      {
        title: "Remets main en place",
        body: "Ramène main là où GitHub l'a. origin/main est ta copie du main de GitHub ; --hard déplace la branche et remet tes fichiers en accord. (git reset --hard HEAD~2, deux commits en arrière, ferait la même chose ici.)",
        success: `« HEAD is now at … Start the café website » (HEAD est maintenant sur …). main est de nouveau exactement le main de GitHub. Tes commits n'ont pas disparu : ${HOURS_BRANCH} pointe toujours vers eux.`,
      },
      {
        title: "Va là où se trouve le travail",
        body: "Passe sur la branche de fonctionnalité et continue comme si de rien n'était.",
        success: `Tu es sur ${HOURS_BRANCH} avec tes deux commits ; git log --oneline les affiche. Sauvetage terminé en trois commandes. La prochaine fois, git switch -c avant ton premier commit.`,
      },
      {
        title: "L'autre classique : la mauvaise branche de fonctionnalité",
        body: [
          `Parfois, le travail a atterri sur une autre branche de fonctionnalité. Hier par exemple, tu as corrigé la faute « Expresso » sur fix-menu… puis tu y as aussi commité la page des cartes cadeaux. Elle a sa place sur ${GIFT_BRANCH}.`,
          "Cette fois, déplacer une étiquette ne suffit pas : fix-menu doit garder son premier commit. Alors tu copies ce seul commit avec git cherry-pick, puis tu le retires de la mauvaise branche avec git reset --hard HEAD~1.",
          "L'ordre compte : copier d'abord, retirer ensuite. Et si un jour tu le fais à l'envers, git reflog liste chaque commit visité par HEAD, y compris ceux qu'on a retirés. Rien de ce que tu as commité n'est perdu avant des semaines.",
        ],
      },
      {
        title: "Défi : démêle la journée d'hier",
        body: `Déplace « ${GIFT_MSG} » de fix-menu vers ${GIFT_BRANCH}. fix-menu doit finir avec seulement la correction de la faute, et ${GIFT_BRANCH} ne doit pas récupérer cette correction. Ne touche ni à main ni à ${HOURS_BRANCH}. Commence par regarder : git log --oneline --graph --all.`,
        objectives: [
          {
            label: `La page des cartes cadeaux est sur ${GIFT_BRANCH}, sans la correction de la faute`,
            hints: [
              "Copie ce seul commit sur la branche où il a sa place. Sois sur la branche de destination au moment de copier.",
              `git switch ${GIFT_BRANCH}, puis git cherry-pick avec le commit : le dernier commit de fix-menu est celui que tu veux, donc le nom de la branche sert d'identifiant.`,
              `git switch ${GIFT_BRANCH} && git cherry-pick fix-menu`,
            ],
          },
          {
            label: `fix-menu se termine par « ${TYPO_MSG} »`,
            hints: [
              "Une fois le commit copié, recule l'étiquette fix-menu d'un commit.",
              "git switch fix-menu, puis git reset --hard HEAD~1.",
              `git switch fix-menu && git reset --hard HEAD~1, puis git log --oneline : « ${TYPO_MSG} » est en haut.`,
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        `“${GIFT_MSG}” isn't on any branch anymore: it was removed before being copied. It's not lost! git reflog lists every commit HEAD visited: find its id there, then git switch ${GIFT_BRANCH} && git cherry-pick <id>.`,
        `« ${GIFT_MSG} » n'est plus sur aucune branche : il a été retiré avant d'être copié. Il n'est pas perdu ! git reflog liste chaque commit visité par HEAD : trouves-y son identifiant, puis git switch ${GIFT_BRANCH} && git cherry-pick <id>.`,
      ],
      [
        `${GIFT_BRANCH} now contains “${TYPO_MSG}” too: merging fix-menu brings all of its commits, not just the one you want. On ${GIFT_BRANCH}, undo with git reset --hard ORIG_HEAD, then cherry-pick only the gift cards commit.`,
        `${GIFT_BRANCH} contient maintenant aussi « ${TYPO_MSG} » : fusionner fix-menu apporte tous ses commits, pas seulement celui que tu veux. Sur ${GIFT_BRANCH}, annule avec git reset --hard ORIG_HEAD, puis fais un cherry-pick du seul commit des cartes cadeaux.`,
      ],
      [
        "main changed. It should stay exactly like GitHub's main: git switch main && git reset --hard origin/main.",
        "main a changé. Elle doit rester exactement comme le main de GitHub : git switch main && git reset --hard origin/main.",
      ],
      [
        `${HOURS_BRANCH} lost its commits. Find “${LINK_MSG}” in git reflog, then put the label back: git branch -f ${HOURS_BRANCH} <id> (from another branch).`,
        `${HOURS_BRANCH} a perdu ses commits. Trouve « ${LINK_MSG} » dans git reflog, puis remets l'étiquette : git branch -f ${HOURS_BRANCH} <id> (depuis une autre branche).`,
      ],
      [
        "You reverted the commit on fix-menu. That's the right tool for pushed branches, but fix-menu has never left your computer: you can simply drop the commit. On fix-menu, git reset --hard HEAD~2 removes both the commit and its revert.",
        "Tu as fait un revert du commit sur fix-menu. C'est le bon outil pour les branches poussées, mais fix-menu n'a jamais quitté ton ordinateur : tu peux simplement retirer le commit. Sur fix-menu, git reset --hard HEAD~2 enlève le commit et son revert.",
      ],
    ],
  },
  "broke-main": {
    title: "main est cassée",
    tagline: "Annuler une erreur poussée sans réécrire l'historique",
    concepts: ["historique partagé", "git revert", "git bisect", "pas de force-push sur main", "revert -m 1"],
    recap: [
      "Quand main casse, enquête d'abord : gh run list montre quand il est passé au rouge, git log et git bisect montrent quel commit l'a cassé.",
      "Sur une branche partagée, on annule avec git revert : un nouveau commit qui fait l'inverse. L'historique reste vrai et les coéquipiers n'ont qu'à faire un pull.",
      "Ne fais jamais reset + force-push sur une branche que d'autres ont récupérée : ça réécrit le sol sous leurs pieds, et ça peut jeter leur travail.",
      "Une mauvaise fusion s'annule avec git revert -m 1 <fusion> : -m 1 garde le côté de main et retire ce que la fusion a apporté.",
    ],
    steps: [
      {
        title: "Mardi, 10 h 12",
        body: [
          "Un message de Maya : « main est rouge depuis hier soir et le site ne peut plus être déployé. Tu peux regarder ? » Sam a poussé un petit ménage hier soir, Maya a poussé par-dessus ce matin, et tout le monde a déjà fait un pull.",
          "Quand une branche partagée casse, le réflexe est de faire disparaître le mauvais commit. Résiste. Trouve d'abord ce qui a cassé, et quand. Ensuite, répare d'une façon qui respecte la copie de tous les autres.",
          "Regarde l'onglet GitHub : les exécutions d'Actions racontent l'histoire.",
        ],
      },
      {
        title: "Quand est-ce passé au rouge ?",
        body: "Liste les exécutions de CI sur main.",
        success: "Les exécutions 1 et 2 sont vertes, 3 et 4 rouges. Donc le commit poussé pour l'exécution 3 a cassé le test, et la 4 est toujours rouge parce que personne ne l'a corrigé.",
      },
      {
        title: "Regarde l'historique",
        body: "Tout sauvetage commence par le graphe.",
        success: `Quatre commits, un par exécution. Le suspect est le troisième : « ${BAD_MSG} » de Sam. Prouvons-le au lieu de deviner.`,
      },
      {
        title: "Lance un bisect",
        body: "git bisect trouve le premier mauvais commit pour toi. Donne-lui un commit mauvais (HEAD, aujourd'hui) et un bon (HEAD~3, le tout premier commit, qui était vert).",
        success: "Git a extrait un commit à mi-chemin entre le bon et le mauvais. Maintenant il doit savoir : celui-ci est-il bon ou mauvais ?",
      },
      {
        title: "Laisse le test décider",
        body: "Au lieu de répondre à la main, laisse Git lancer le test du projet sur chaque commit qu'il choisit.",
        success: `« … is the first bad commit » (… est le premier mauvais commit) : « ${BAD_MSG} », qui a supprimé la ligne <title> vérifiée par le test. Une preuve, pas une supposition.`,
      },
      {
        title: "Retour sur main",
        body: "Termine le bisect : Git te ramène là où tu as commencé.",
        success: "« Switched to branch 'main' » (passé sur la branche main). Tu sais exactement quel commit annuler.",
      },
      {
        title: "Annuler, pas effacer",
        body: [
          "Tentant : git reset --hard avant le commit de Sam, puis git push --force. Ne le fais pas. Maya et Sam ont déjà ces commits. Réécrire main leur retire le sol sous les pieds : leur prochain pull s'emmêle, leur prochain push peut ramener le mauvais commit. Et le commit du cheesecake de Maya, fait après celui de Sam, serait jeté avec.",
          "C'est pour ça que la plupart des équipes protègent main contre les force-push. Sur une branche partagée, on annule avec git revert : il crée un nouveau commit qui fait exactement l'inverse du mauvais.",
          "L'historique reste vrai : l'erreur et sa correction sont visibles toutes les deux, la copie de personne ne casse, et chacun fait simplement un pull.",
        ],
      },
      {
        title: "Quand le coupable est une fusion",
        body: "Parfois, le mauvais commit est une pull request fusionnée. Un commit de fusion a deux parents, donc Git doit savoir quel côté garder.",
        captions: [
          "La pull request #7 de Sam a été fusionnée dans main, et elle a supprimé le lien vers le menu.",
          "-m 1 veut dire : garde le parent 1, le côté de main, et annule tout ce que la fusion a apporté. Les deux commits de Sam sont annulés en un seul revert.",
          "main est réparée avec un seul nouveau commit. Quand la mise en page de Sam sera prête, elle reviendra par une nouvelle pull request.",
        ],
      },
      {
        title: "Défi : répare main proprement",
        body: `Annule « ${BAD_MSG} » avec git revert, vérifie que le test passe sur ton ordinateur, et pousse pour que la CI repasse au vert. Ne réécris pas main, et corrige la page, pas le test.`,
        objectives: [
          {
            label: "Le main de GitHub garde le commit de Sam et a son revert par-dessus",
            hints: [
              "git revert <commit> crée un nouveau commit qui annule celui que tu nommes. Ensuite, pousse-le comme n'importe quel commit.",
              `Trouve l'identifiant de « ${BAD_MSG} » dans git log --oneline (c'est HEAD~1), fais-en le revert, puis git push.`,
              "git revert HEAD~1, puis git push",
            ],
          },
          {
            label: "La dernière exécution de CI sur main est verte",
            hints: [
              "Chaque push sur main lance une nouvelle exécution de CI, verte quand npm test réussit sur GitHub.",
              "Lance d'abord npm test sur ton ordinateur : s'il passe ici, il passera sur GitHub.",
              "npm test && git push, puis gh run list : l'exécution la plus récente commence par ✓.",
            ],
          },
          {
            label: "Ton main est synchronisé avec GitHub",
            hints: [
              "Quand tu as fini, ton main et celui de GitHub pointent vers le même commit.",
              "git status doit dire « Your branch is up to date with 'origin/main' » (ta branche est à jour).",
              "Si git push a été refusé, quelqu'un a poussé entre-temps : git pull, puis git push.",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "You rewrote main on GitHub: commits your teammates already have are gone from it. In a real team that breaks everyone's copy. Restart the lesson and use git revert, which only adds a commit.",
        "Tu as réécrit main sur GitHub : des commits que tes coéquipiers ont déjà en ont disparu. Dans une vraie équipe, ça casse la copie de tout le monde. Recommence la leçon et utilise git revert, qui ne fait qu'ajouter un commit.",
      ],
      [
        "You changed the test or the workflow. A test you weaken stops protecting you: restart the lesson and fix the page with git revert.",
        "Tu as modifié le test ou le workflow. Un test qu'on affaiblit ne protège plus rien : recommence la leçon et répare la page avec git revert.",
      ],
      [
        "Your local main no longer has Sam's commit: you moved it back in time. Don't push that. Come back with git reset --hard origin/main, then use git revert.",
        "Ton main local n'a plus le commit de Sam : tu l'as ramené en arrière. Ne pousse pas ça. Reviens avec git reset --hard origin/main, puis utilise git revert.",
      ],
      [
        `You put the title back by hand. It works, but git revert records exactly what was undone and links it to “${BAD_MSG}”. Restart the lesson and let git revert write the fix.`,
        `Tu as remis le titre à la main. Ça marche, mais git revert enregistre exactement ce qui a été annulé et le relie à « ${BAD_MSG} ». Recommence la leçon et laisse git revert écrire la correction.`,
      ],
      [
        "Your revert is only on your computer. CI runs on what you push: git push.",
        "Ton revert n'est que sur ton ordinateur. La CI tourne sur ce que tu pousses : git push.",
      ],
    ],
  },
  "leaked-secret": {
    title: "Un secret commité",
    tagline: "D'abord changer la clé, ensuite nettoyer l'historique",
    concepts: ["rm --cached", "commit --amend", "changer la clé (rotation)", "réécrire sa propre branche", "--force-with-lease"],
    recap: [
      "Pas encore poussé : git rm --cached le fichier, ignore-le, puis git commit --amend (ou git reset --soft HEAD~1 et recommite). Il n'a jamais existé.",
      "Poussé : la clé est compromise. Change-la d'abord (révoque-la, crées-en une nouvelle, mets-la à jour partout où elle sert) ; nettoyer l'historique vient ensuite.",
      "Sur ta propre branche : réécris-la (reset --soft, recommite sans le fichier), puis git push --force-with-lease, qui refuse si quelqu'un d'autre a poussé entre-temps.",
      "Sur main ou dans un vieil historique : git filter-repo ou BFG, plus le support de GitHub pour les copies en cache. C'est le changement de clé qui te protège vraiment.",
    ],
    steps: [
      {
        title: "Mercredi, 16 h 55",
        body: [
          "Tu commites le formulaire d'inscription à la newsletter et tu jettes un œil à la sortie de Git : create mode 100644 .env. Le fichier qui contient la clé de paiement du café vient d'entrer dans un commit.",
          "Première question, toujours : est-ce que c'est poussé ? Un commit sur ton ordinateur est privé. Tu peux le réécrire comme s'il n'avait jamais existé. Un commit poussé, c'est une autre histoire.",
          "Regarde avant d'agir.",
        ],
      },
      {
        title: "Poussé ou pas ?",
        body: "Demande à Git où en est main par rapport à GitHub.",
        success: "« ahead of 'origin/main' by 1 commit » (1 commit d'avance) : le commit avec .env n'a jamais quitté ton ordinateur. Ouf. Tu peux le réparer en privé.",
      },
      {
        title: "Qu'y a-t-il dans ce commit ?",
        body: "Liste les fichiers modifiés par le dernier commit. --stat donne un résumé au lieu de chaque ligne.",
        success: "Deux fichiers : newsletter.html, que tu voulais, et .env, que tu ne voulais pas.",
      },
      {
        title: "Arrête de suivre .env",
        body: "Retire .env de la zone de staging, mais garde-le sur ton disque : ton application a toujours besoin de la clé en local.",
        success: "« rm '.env' ». --cached veut dire : seulement dans la zone de staging de Git. Le fichier est toujours dans ton dossier, désormais non suivi.",
      },
      {
        title: "Plus jamais",
        body: "Ajoute .env à .gitignore pour que git add . ne puisse plus le ramasser. >> ajoute une ligne à la fin du fichier (et le crée si besoin).",
        success: "Git ignore maintenant .env : git status ne le liste même plus.",
      },
      {
        title: "Réécris le commit",
        body: "Ajoute .gitignore à la zone de staging et corrige le dernier commit. --amend le remplace par un nouveau commit fait à partir de la zone de staging ; --no-edit garde son message.",
        success: "Un tout nouveau commit a remplacé l'ancien : newsletter.html et .gitignore, pas de .env. L'ancien commit n'est plus sur aucune branche. (git reset --soft HEAD~1, puis un nouveau commit, donne le même résultat.)",
      },
      {
        title: "Une fois poussé, c'est compromis",
        body: [
          `Puis ton estomac se serre. Hier, tu as poussé ${PAY_BRANCH}… et son premier commit, « Add payment page », contient aussi .env. Celui-là est sur GitHub.`,
          "Un secret poussé est un secret volé. Des robots scannent GitHub en permanence à la recherche de clés et trouvent les nouvelles en quelques minutes. Nettoyer l'historique après coup ne la « dé-vole » pas. Donc l'étape 1 est toujours : changer la clé. Révoque-la chez le fournisseur, crées-en une nouvelle, et mets-la à jour partout où elle sert, comme le secret PAY_API_KEY sur GitHub.",
          `L'étape 2, c'est le nettoyage. ${PAY_BRANCH} est ta propre branche, donc tu as le droit de la réécrire : reconstruis-la sans .env, puis git push --force-with-lease. Contrairement à --force, il refuse si quelqu'un a poussé sur la branche depuis ton dernier fetch : tu ne peux pas effacer le travail d'un coéquipier par accident.`,
          "Si un secret atteint main ou un vieil historique, la réécriture est un plus gros chantier : git filter-repo ou l'outil BFG, chaque coéquipier reclone, et le support de GitHub purge les vues en cache. C'est pour ça que le changement de clé passe en premier : c'est lui qui te protège vraiment.",
        ],
      },
      {
        title: "Confirme la fuite",
        body: `Regarde le premier commit de ${PAY_BRANCH} tel que GitHub l'a.`,
        success: "« Add payment page » : pay.html et .env. La clé est publique. Place au vrai sauvetage.",
      },
      {
        title: "Défi : contiens la fuite",
        body: `Le fournisseur de paiement t'a donné une nouvelle clé : ${NEW_KEY} (fais comme si tu avais déjà révoqué l'ancienne dans son tableau de bord). Change-la d'abord sur GitHub, puis reconstruis ${PAY_BRANCH} pour qu'aucun de ses commits ne contienne .env, avec .env ignoré, et remplace la version de GitHub en sécurité. Garde la page de paiement et son style.`,
        objectives: [
          {
            label: "Le secret PAY_API_KEY sur GitHub contient la nouvelle clé",
            hints: [
              "Le changement de clé passe en premier : les workflows doivent utiliser la nouvelle clé, l'ancienne est morte.",
              "gh secret set remplace la valeur d'un secret.",
              `gh secret set PAY_API_KEY --body "${NEW_KEY}"`,
            ],
          },
          {
            label: `Aucun commit de ${PAY_BRANCH} sur GitHub ne contient .env, et le travail sur le paiement est toujours là`,
            hints: [
              "Supprimer .env dans un nouveau commit ne suffit pas : l'ancien commit l'aurait toujours. Reconstruis les commits de la branche sans lui, puis remplace la copie de GitHub.",
              `git switch ${PAY_BRANCH}, git reset --soft origin/main (tous les changements de la branche restent dans la zone de staging), git rm --cached .env, recommite, puis git push --force-with-lease.`,
              `git switch ${PAY_BRANCH} && git reset --soft origin/main && git rm --cached .env, puis (avec .gitignore, voir l'objectif suivant) git commit -m "Add payment page" && git push --force-with-lease`,
            ],
          },
          {
            label: `.gitignore sur le ${PAY_BRANCH} de GitHub liste .env`,
            hints: [
              "Cette branche n'a pas le .gitignore que tu as créé sur main. Ajoute-en un ici aussi, dans le commit reconstruit.",
              'echo ".env" >> .gitignore, puis git add .gitignore avant de commiter.',
              'Après git rm --cached .env : echo ".env" >> .gitignore && git add .gitignore, puis commite et pousse.',
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "You pushed .env to main! In real life: rotate now, then it's a filter-repo job. Restart the lesson to try again.",
        "Tu as poussé .env sur main ! En vrai : change la clé tout de suite, puis c'est un travail pour filter-repo. Recommence la leçon pour réessayer.",
      ],
      [
        `The payment page or its style is missing from ${PAY_BRANCH} on GitHub: the work went away with the key. Your old commits are still in git reflog; restart the lesson if you're unsure.`,
        `La page de paiement ou son style manque sur le ${PAY_BRANCH} de GitHub : le travail est parti avec la clé. Tes anciens commits sont toujours dans git reflog ; recommence la leçon si tu n'es pas sûr de toi.`,
      ],
      [
        "You deleted .env in a new commit. The latest version is clean, but “Add payment page” still contains the key: anyone can read it in the history. Rebuild instead: git reset --soft origin/main puts all the branch's changes back in the staging area, then git rm --cached .env and commit once.",
        "Tu as supprimé .env dans un nouveau commit. La dernière version est propre, mais « Add payment page » contient toujours la clé : n'importe qui peut la lire dans l'historique. Reconstruis plutôt : git reset --soft origin/main remet tous les changements de la branche dans la zone de staging, puis git rm --cached .env et un seul commit.",
      ],
      [
        "Your clean branch is only on your computer. Replace GitHub's copy: git push --force-with-lease.",
        "Ta branche propre n'est que sur ton ordinateur. Remplace la copie de GitHub : git push --force-with-lease.",
      ],
      [
        `History is clean, but the old key still works for anyone who copied it. Rotate it: gh secret set PAY_API_KEY --body "${NEW_KEY}".`,
        `L'historique est propre, mais l'ancienne clé fonctionne toujours pour quiconque l'a copiée. Change-la : gh secret set PAY_API_KEY --body "${NEW_KEY}".`,
      ],
      [
        ".env is staged again. Unstage it with git rm --cached .env before you commit.",
        ".env est de nouveau dans la zone de staging. Retire-le avec git rm --cached .env avant de commiter.",
      ],
    ],
  },
  "friday-incident": {
    title: "L'incident du vendredi",
    tagline: "Trois problèmes, un sauvetage dans le calme",
    concepts: ["faire le tri", "git stash list", "git fetch", "branch + reset", "stash pop sur la bonne branche", "pull request"],
    recap: [
      "Tu sais maintenant lire n'importe quel dépôt en désordre avant d'y toucher : git status, git stash list, git fetch, git log --oneline --graph --all.",
      "Tu sais déplacer des commits vers la bonne branche, annuler une erreur poussée avec git revert, et ne réécrire que ce qui t'appartient, avec --force-with-lease.",
      "Tu sais qu'un secret poussé est un secret volé : d'abord changer la clé, ensuite nettoyer. Et que grâce à git reflog, rien de ce que tu commites n'est vraiment perdu.",
      "Voilà tout le voyage, de ton premier git init au sauvetage du vendredi soir de toute une équipe. Tu es prêt pour de vrais projets. Bienvenue dans l'équipe !",
    ],
    steps: [
      {
        title: "Vendredi, 17 h 07",
        body: [
          "Le café lance son brunch du week-end demain à 9 h. Maya attend ton menu du brunch sous forme de pull request pour le relire avant de partir. Deux minutes, normalement.",
          "Sauf que ton dépôt est en désordre. Tu as fait le commit du brunch sur main par erreur. Hier, tu as tapé les prix, tu as été interrompu, tu les as mis dans le stash… et tu as oublié. Et Maya a poussé sur main entre-temps.",
          "Trois problèmes emmêlés. Le sauvetage se fait dans le calme et dans l'ordre : d'abord tout regarder, puis réparer une chose à la fois. Chaque étape apprise dans ce cours va payer.",
        ],
      },
      {
        title: "Regarde : tes fichiers",
        body: "Commence là où tu commences toujours.",
        success: "Sur main, 1 commit d'avance sur origin/main (le menu du brunch, sur la mauvaise branche), et « nothing to commit » (rien à commiter). Alors, où sont les prix d'hier ?",
      },
      {
        title: "Regarde : ton stash",
        body: "Le travail mis de côté n'apparaît pas dans git status. Vérifie le stash.",
        success: `« stash@{0}: WIP on main: … ${BRUNCH_MSG} ». Voilà les prix, mis de côté par-dessus le commit du brunch. Retiens-le : ils vont avec lui.`,
      },
      {
        title: "Regarde : GitHub",
        body: "Découvre ce que l'équipe a fait entre-temps. fetch télécharge sans toucher à tes fichiers.",
        success: "origin/main a bougé : Maya a poussé pendant que tu étais occupé. Rien n'a changé dans ton dossier. fetch est toujours sans risque.",
      },
      {
        title: "Toute la situation",
        body: "Dessine toutes les branches d'un coup.",
        success: `Deux lignes partent du même commit : ton « ${BRUNCH_MSG} » sur main, et « ${MAYA_MSG} » de Maya sur origin/main. Tu sais tout, maintenant. Place à la réparation.`,
      },
      {
        title: "Défi final : sauve le vendredi",
        body: "Répare tout : mets le commit du brunch sur sa propre branche (appelle-la feature/brunch), fais correspondre main à celui de GitHub avec la correction de Maya, ramène les prix du stash sur la branche du brunch et commite-les, puis pousse la branche et ouvre une pull request pour Maya. Ne pousse rien sur main.",
        objectives: [
          {
            label: "Le commit du brunch est sur sa propre branche",
            hints: [
              "Avant de déplacer main, mets une nouvelle étiquette sur le commit du brunch pour le mettre à l'abri.",
              "Depuis main : git branch feature/brunch.",
              "git branch feature/brunch, puis git log --oneline --all : la nouvelle étiquette est sur ton commit du brunch.",
            ],
          },
          {
            label: "Ton main correspond à celui de GitHub, avec la correction de Maya",
            hints: [
              "main doit être exactement le main de GitHub : le travail de Maya, et pas de commit du brunch.",
              "Une fois le commit du brunch à l'abri sur sa branche : git reset --hard origin/main (après git fetch, il contient déjà le commit de Maya). git pull marche aussi une fois main remis en place.",
              "git switch main && git reset --hard origin/main && git pull",
            ],
          },
          {
            label: "Les prix du stash sont commités sur la branche du brunch",
            hints: [
              "Le stash a été créé par-dessus le commit du brunch. Applique-le là où se trouve ce commit.",
              "git switch feature/brunch, git stash pop, puis commite le changement.",
              'git switch feature/brunch && git stash pop && git commit -am "Add brunch prices"',
            ],
          },
          {
            label: "Une pull request propose le menu du brunch avec ses prix",
            hints: [
              "Une pull request a d'abord besoin que la branche soit sur GitHub.",
              "git push -u origin feature/brunch, puis gh pr create.",
              'git push -u origin feature/brunch && gh pr create --title "Weekend brunch menu" --body "Menu and prices for Saturday"',
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "The brunch menu was pushed straight to main, skipping Maya's review. Now it's shared: don't force-push. Restart the lesson for the clean rescue (in real life, you'd git revert it on main).",
        "Le menu du brunch a été poussé directement sur main, sans la relecture de Maya. Maintenant il est partagé : pas de force-push. Recommence la leçon pour le sauvetage propre (en vrai, tu ferais un git revert sur main).",
      ],
      [
        `Your brunch commit isn't on any branch anymore: main was reset before the commit was saved. It's not lost! git reflog shows “commit: ${BRUNCH_MSG}” with its id: git branch feature/brunch <id>.`,
        `Ton commit du brunch n'est plus sur aucune branche : main a été réinitialisé avant que le commit soit mis à l'abri. Il n'est pas perdu ! git reflog affiche « commit: ${BRUNCH_MSG} » avec son identifiant : git branch feature/brunch <id>.`,
      ],
      [
        "The prices are gone: the stash was dropped without being applied. Restart the lesson, and use git stash pop on the brunch branch.",
        "Les prix ont disparu : le stash a été supprimé sans être appliqué. Recommence la leçon, et utilise git stash pop sur la branche du brunch.",
      ],
      [
        "You applied the stash on main, where brunch.html doesn't exist (Git reported a conflict and kept the stash). Undo with git reset --hard, then git switch feature/brunch and git stash pop there.",
        "Tu as appliqué le stash sur main, où brunch.html n'existe pas (Git a signalé un conflit et gardé le stash). Annule avec git reset --hard, puis git switch feature/brunch et git stash pop là-bas.",
      ],
      [
        "You pulled into main before moving the brunch commit, so main now has a merge. No harm done: make sure feature/brunch exists (git branch feature/brunch), then git reset --hard origin/main.",
        "Tu as fait un pull dans main avant de déplacer le commit du brunch, donc main contient maintenant une fusion. Pas de mal : vérifie que feature/brunch existe (git branch feature/brunch), puis git reset --hard origin/main.",
      ],
      [
        "The prices were committed on main. Put a branch on that commit (git branch feature/brunch), then git reset --hard origin/main on main.",
        "Les prix ont été commités sur main. Mets une branche sur ce commit (git branch feature/brunch), puis git reset --hard origin/main sur main.",
      ],
      [/^(\S+) is ready but only on your computer\. Push it: git push -u origin \1\.$/, "$1 est prête, mais seulement sur ton ordinateur. Pousse-la : git push -u origin $1."],
      [/^GitHub's (\S+) is behind your latest commit\. git push, then open the pull request\.$/, "La branche $1 de GitHub est en retard sur ton dernier commit. git push, puis ouvre la pull request."],
      ["Last step: open the pull request with gh pr create.", "Dernière étape : ouvre la pull request avec gh pr create."],
    ],
  },
};
