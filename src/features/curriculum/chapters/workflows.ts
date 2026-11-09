import { ancestors, currentBranch, emptyWorld, headCommitId, type HostedRepo, type World, type WorkflowRun } from "@/engine";
import * as c from "../checks";
import type { LessonText } from "../localize";
import { Scenario, scenario } from "../scenario";
import type { Lesson } from "../types";

// ───────────────────────────────────────────── Chapter 11 — GitHub Developer Workflows

const UI = { files: true, editor: true, stages: false, remote: true };

export const CAFE_URL = "https://github.com/gitverse-team/cafe.git";

const CAFE_README = "# Café Gitverse\n\nThe website of our little neighbourhood café.\n";
const CAFE_INDEX = `<html>
<head>
  <title>Café Gitverse</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Café Gitverse</h1>
  <p>Fresh coffee and cake, every day.</p>
  <a href="menu.html">See the menu</a>
  <footer>© 2023 Café Gitverse</footer>
</body>
</html>
`;
const CAFE_MENU = "<h1>Menu</h1>\n<ul>\n  <li>Expresso — 2.00</li>\n  <li>Cappuccino — 3.00</li>\n  <li>Carrot cake — 4.00</li>\n</ul>\n";
const CAFE_STYLE = "body {\n  font-family: Georgia, serif;\n  background: #fdf6ec;\n}\n";

const pkg = (scripts: Record<string, string>) => JSON.stringify({ name: "cafe", version: "1.0.0", scripts }, null, 2) + "\n";

/**
 * Maya's café website on the simulated GitHub, already cloned on your
 * computer. `files` are added to Maya's first commit (before the push).
 */
function cafe(files: Record<string, string> = {}, patch: Partial<HostedRepo> = {}): World {
  const team = scenario()
    .run("git init")
    .commit("Start the café website", { "README.md": CAFE_README, "index.html": CAFE_INDEX, "menu.html": CAFE_MENU, "style.css": CAFE_STYLE, ...files }, "Maya")
    .host(CAFE_URL, "gitverse-team", "cafe")
    .run(`git remote add origin ${CAFE_URL}`, "git config user.name Maya", "git push -u origin main")
    .done();
  const you = new Scenario({ ...emptyWorld(), hosted: team.hosted, hostedCommits: team.hostedCommits, clock: team.clock, seq: team.seq })
    .run(`git clone ${CAFE_URL} .`)
    .done();
  Object.assign(you.hosted[CAFE_URL], patch);
  return you;
}

const host = (w: World): HostedRepo | undefined => w.hosted[CAFE_URL];
/** A file as it is on GitHub's main. */
const onGitHub = (w: World, path: string) => {
  const tip = host(w)?.branches.main;
  return tip ? w.hostedCommits[tip]?.tree[path] : undefined;
};
const runs = (w: World): WorkflowRun[] => host(w)?.runs ?? [];
const maxRunId = (w: World) => runs(w).reduce((m, r) => Math.max(m, r.id), 0);
/** The newest push run of `workflow` on main, if it ran on main's current tip. */
const tipRun = (w: World, workflow: string) => {
  const r = runs(w).filter((x) => x.workflow === workflow && x.event === "push" && x.branch === "main").at(-1);
  return r && r.commit === host(w)?.branches.main ? r : undefined;
};
const me = (w: World) => w.user.name;

// ───────────────────────────────────────────── Issues

const ISSUE_KEYWORD = (n: number) => new RegExp(`\\b(close[sd]?|fix(e[sd])?|resolve[sd]?) #${n}\\b`, "i");

const issuesSetup = (): World => {
  let w = cafe();
  w = new Scenario(w)
    .run("git switch -c fix-menu")
    .commit("Fix espresso typo", { "menu.html": CAFE_MENU.replace("Expresso", "Espresso") })
    .run("git push -u origin fix-menu")
    .done();
  host(w)!.issues = [
    { number: 1, title: "Menu says “Expresso”", body: "Customers keep pointing at it. It's spelled Espresso!", author: "Maya", state: "open", labels: ["bug"] },
    { number: 2, title: "Show opening hours on the homepage", body: "People ask us every day when we open.", author: "Sam", state: "open", labels: ["enhancement"] },
  ];
  host(w)!.nextNumber = 3;
  return w;
};

/** Issues you filed during the lesson. */
const myIssues = (w: World, start: World) => {
  const before = new Set((host(start)?.issues ?? []).map((i) => i.number));
  return (host(w)?.issues ?? []).filter((i) => !before.has(i.number) && i.author === me(w));
};
const closedByMergedPr = (w: World, closedBy: string | undefined) => {
  const n = /^#(\d+)$/.exec(closedBy ?? "")?.[1];
  return !!n && !!host(w)?.pulls?.some((p) => p.number === Number(n) && p.state === "merged");
};

const issues: Lesson = {
  id: "issues",
  chapterId: "workflows",
  title: "Issues",
  tagline: "Track work, then close it with a pull request",
  xp: 175,
  concepts: ["issue", "labels", "closing keywords", "Fixes #N"],
  commands: ["gh issue list", "gh issue view <n>", "gh issue create --title … --label bug", 'gh pr create --body "Fixes #N"', "gh pr merge --merge -d"],
  ui: UI,
  setup: issuesSetup,
  recap: [
    "An issue is a numbered note on GitHub: a bug, an idea, a task. It's the team's shared to-do list.",
    "Labels like bug or enhancement sort issues so everyone sees what kind of work it is.",
    "Write “Fixes #N” in a pull request and GitHub closes issue #N by itself the moment the PR is merged.",
    "That link stays forever: anyone opening the issue sees exactly which change fixed it.",
  ],
  steps: [
    {
      kind: "discover",
      title: "The team's to-do list",
      body: [
        "Maya, Sam and you run the website of a small café. Things come up all the time: a typo on the menu, an idea for the homepage. If those live in chat messages, they get lost.",
        "GitHub keeps them as issues. Each issue gets a number (#1, #2…), a title, a description and labels such as bug or enhancement. Anyone on the team can read them, comment and pick one up.",
        "The best part: a pull request can say “Fixes #1”. When it's merged, GitHub closes issue #1 for you and links the two forever.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "What needs doing?",
      body: "List the open issues of the café repository. gh is GitHub's command-line tool: it talks to GitHub for you.",
      command: "gh issue list",
      check: (_w, _s, ran) => ran.includes("gh issue"),
      success: "Two open issues: #1 is a bug (the menu typo), #2 is an enhancement (opening hours). You'll find the same list in the GitHub tab.",
    },
    {
      kind: "try",
      title: "Read an issue",
      body: "Open issue #1 to see who reported it and why.",
      command: "gh issue view 1",
      check: (_w, _s, ran) => ran.includes("gh issue"),
      success: "Maya opened it, it's labelled bug, and the description says what's wrong. A good issue answers “what's broken?” so anyone can fix it.",
    },
    {
      kind: "try",
      title: "File a bug",
      body: "While reading the homepage you notice the footer still says © 2023. Don't keep it in your head: file an issue with the bug label.",
      command: 'gh issue create --title "Footer still says 2023" --label bug',
      check: (w, s) => myIssues(w, s).some((i) => i.labels.includes("bug")),
      success: "GitHub printed the new issue's link: it's #3. Now the whole team knows about it, even if you don't fix it today.",
    },
    {
      kind: "try",
      title: "Propose the fix for #1",
      body: "Good news: you already fixed the Expresso typo on your branch fix-menu and pushed it. Open a pull request and write “Fixes #1” in its description. That sentence is what links the two.",
      command: 'gh pr create --title "Fix espresso typo" --body "Fixes #1"',
      check: (w) => !!host(w)?.pulls?.some((p) => p.state === "open" && ISSUE_KEYWORD(1).test(`${p.title}\n${p.body}`)),
      success: "Pull request #4 is open. Issues and pull requests share the same numbers, which is why it's #4 and not #1.",
    },
    {
      kind: "try",
      title: "Merge it and watch #1 close",
      body: "Merge your pull request. -d deletes the fix-menu branch afterwards and brings you back to main. Keep an eye on the issues in the GitHub tab.",
      command: "gh pr merge --merge -d",
      check: (w) => host(w)?.issues?.find((i) => i.number === 1)?.state === "closed",
      success: "“✓ Closed issue #1”: you never typed gh issue close. GitHub read “Fixes #1”, closed the issue, and noted it was closed by #4.",
    },
    {
      kind: "challenge",
      title: "Challenge: close your own issue",
      body: "Now fix the bug you filed. Update the footer of index.html to the current year on a new branch, open a pull request that closes your footer issue, and merge it. Let the pull request close the issue: don't close it by hand.",
      objectives: [
        {
          id: "footer",
          label: "The footer on GitHub's main no longer says 2023",
          check: (w) => {
            const page = onGitHub(w, "index.html");
            return !!page && page.includes("<footer>") && !page.includes("2023");
          },
          hints: [
            "Make the change on a new branch, then get it into main through a pull request (main is shared: changes go through PRs).",
            "git pull, git switch -c fix-footer, change the year in index.html, commit, git push -u origin fix-footer.",
            'git pull && git switch -c fix-footer, then edit the footer line of index.html (2023 → 2026), git commit -am "Update footer year", git push -u origin fix-footer',
          ],
        },
        {
          id: "closed",
          label: "Your footer issue was closed by a merged pull request",
          check: (w, s) => myIssues(w, s).some((i) => i.state === "closed" && closedByMergedPr(w, i.closedBy)),
          hints: [
            "Put a closing keyword and the issue's number in the pull request's description, then merge it.",
            'gh issue list shows your issue\'s number (#3). Then: gh pr create --title "…" --body "Fixes #3"',
            'gh pr create --title "Update footer year" --body "Fixes #3", then gh pr merge --merge -d',
          ],
        },
      ],
      feedback: (w, s) => {
        const mine = myIssues(w, s);
        const byHand = mine.find((i) => i.state === "closed" && !i.closedBy);
        if (byHand)
          return `You closed the issue by hand. It works, but nobody can see which change fixed it. Reopen it with gh issue reopen ${byHand.number} and let your pull request close it.`;
        if (mine.some((i) => i.state === "closed" && i.closedBy && !i.closedBy.startsWith("#")))
          return "The issue was closed by a direct push to main, not by a pull request. Restart the lesson and send the fix through a PR.";
        if (w.repo && currentBranch(w.repo) === "main" && w.repo.branches.main !== w.repo.remoteRefs["origin/main"] && c.newCommitsSince(w, s) > 0)
          return "You committed on main. Fixes go on their own branch: create one with git switch -c fix-footer, then open a pull request from it.";
        const open = host(w)?.pulls?.find((p) => p.state === "open" && p.author === me(w));
        const target = mine.find((i) => i.state === "open");
        if (open && target && !ISSUE_KEYWORD(target.number).test(`${open.title}\n${open.body}\n${w.hostedCommits[open.headCommit]?.message ?? ""}`))
          return `Your pull request #${open.number} doesn't mention issue #${target.number}. Close it (gh pr close ${open.number}) and open a new one with --body "Fixes #${target.number}".`;
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── GitHub Actions

const TEST_SCRIPT = 'grep -q "<title>" index.html && test -f style.css';

export const CI_YML = `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run the tests
        run: npm test
`;

const NO_TITLE_INDEX = CAFE_INDEX.replace("  <title>Café Gitverse</title>\n", "");

const actionsSetup = () => cafe({ "package.json": pkg({ test: TEST_SCRIPT }) });

const actions: Lesson = {
  id: "actions",
  chapterId: "workflows",
  title: "GitHub Actions",
  tagline: "Code that runs on GitHub's computers",
  xp: 200,
  concepts: ["GitHub Actions", "workflow", "job", "step", "run"],
  commands: ["npm test", "gh run list", "gh run view <id> --log", "gh run view --log-failed"],
  ui: UI,
  setup: actionsSetup,
  recap: [
    "A workflow is a YAML file in .github/workflows/. GitHub reads it on every push and runs it on its own computers.",
    "on: says when it runs, jobs: groups the work, steps: are the commands, one after the other.",
    "Each push gets a run: green ✓ when every step succeeded, red X when one failed. gh run list and gh run view --log show them.",
    "A red run is a gift: GitHub caught the mistake before your customers did.",
  ],
  steps: [
    {
      kind: "discover",
      title: "A robot that checks every push",
      body: [
        "The café website has a test: npm test checks that the homepage has a <title> and that style.css exists. Simple, but it has caught real mistakes.",
        "The problem: people forget to run it. GitHub Actions fixes that. You describe the work in a workflow file, commit it, and GitHub runs it on its own computers every time someone pushes.",
        "A workflow file is code like any other: it lives in the repository, in .github/workflows/, and it goes through commits and reviews.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "Run the test yourself",
      body: "First, run the project's test on your computer. npm test runs the “test” script written in package.json.",
      command: "npm test",
      check: (_w, _s, ran) => ran.includes("npm"),
      success: "npm printed the script it ran: grep -q looks for <title> in index.html, test -f checks style.css exists. No error message means it passed.",
    },
    {
      kind: "try",
      title: "Write the workflow",
      body: "Create .github/workflows/ci.yml. We prefilled it — read it line by line: name: is what the GitHub tab shows. on: is when it runs (every push to main, and every pull request). jobs: holds the work; this one has a job called test. runs-on: ubuntu-latest asks GitHub for a fresh Linux machine. steps: run in order: uses: actions/checkout@v4 downloads your code onto that machine, then run: npm test runs your test, exactly like you just did.",
      action: { label: "Create .github/workflows/ci.yml", kind: "create-file", path: ".github/workflows/ci.yml", content: CI_YML },
      check: (w) => c.fileExists(w, ".github/workflows/ci.yml"),
      success: "The workflow exists, but only on your computer. GitHub only knows what you push.",
    },
    {
      kind: "try",
      title: "Commit it",
      body: "Stage the new file and commit it, like any other code.",
      command: 'git add . && git commit -m "Add CI workflow"',
      check: (w) => c.inHead(w, ".github/workflows/ci.yml"),
      success: "Committed. The workflow is now part of the project's history.",
    },
    {
      kind: "try",
      title: "Push, and GitHub gets to work",
      body: "Push main. This time, watch the Actions section of the GitHub tab.",
      command: "git push",
      check: (w) => runs(w).length > 0,
      success: "The push landed, GitHub found ci.yml in it and started a run. It's green: the test passed on GitHub's machine.",
    },
    {
      kind: "try",
      title: "List the runs",
      body: "See every run from the terminal.",
      command: "gh run list",
      check: (_w, _s, ran) => ran.includes("gh run"),
      success: "One line per run: ✓ (passed), the workflow name CI, the branch main, the event push that started it, and the run ID: 1.",
    },
    {
      kind: "try",
      title: "Read the log",
      body: "Open run 1 with its full log: what did GitHub's machine actually do?",
      command: "gh run view 1 --log",
      check: (_w, _s, ran) => ran.includes("gh run"),
      success: "Each line starts with the job name (test), then you see the checkout, “$ npm test” and the script it ran. The same output as on your computer, on a machine you never touched.",
    },
    {
      kind: "try",
      title: "Tidy up the page",
      body: "Sam asks you to tidy the <head> of the homepage. In the Files panel, click index.html to open it. We prefilled the tidied version: look closely, the <title> line went missing in the cleanup. Save it anyway — that's the kind of slip CI is for.",
      action: { label: "Save the tidied index.html", kind: "edit-file", path: "index.html", content: NO_TITLE_INDEX },
      check: (w) => !(w.workdir["index.html"] ?? "<title>").includes("<title>"),
      success: "Saved. Nothing warned you: the page still looks fine in a browser. Let's see what CI thinks.",
    },
    {
      kind: "try",
      title: "Push the cleanup",
      body: "Commit the change and push it in one go.",
      command: 'git commit -am "Tidy up the page head" && git push',
      check: (w) => runs(w).at(-1)?.status === "failure",
      success: "The push worked, but the new run is a red X in the GitHub tab. GitHub caught the missing title for you.",
    },
    {
      kind: "challenge",
      title: "Challenge: make main green again",
      body: "Main is red. Find out why from the run's log, fix the homepage, and push so that the latest CI run on main passes. Fix the page, not the test.",
      objectives: [
        {
          id: "why",
          label: "Read the failing run's log",
          check: (_w, _s, ran) => ran.includes("gh run"),
          hints: [
            "The log says which command failed and how.",
            "gh run list shows the red run's ID; gh run view <id> --log-failed shows only the failing job.",
            "Type: gh run view --log-failed (no ID means the latest run)",
          ],
        },
        {
          id: "title",
          label: "index.html on GitHub has its <title> back",
          check: (w) => (onGitHub(w, "index.html") ?? "").includes("<title>"),
          hints: [
            "npm test failed on grep -q \"<title>\" index.html: the title line is missing.",
            "Put <title>Café Gitverse</title> back inside <head>, commit, push.",
            "Click index.html, add the line <title>Café Gitverse</title> right after <head>, save, then: git commit -am \"Restore page title\" && git push",
          ],
        },
        {
          id: "green",
          label: "The latest CI run on main is green",
          check: (w, s) => {
            const run = tipRun(w, "CI");
            return (
              !!run && run.status === "success" && runs(w).some((r) => r.status === "failure" && r.id < run.id) &&
              onGitHub(w, "package.json") === onGitHub(s, "package.json") && (onGitHub(w, ".github/workflows/ci.yml") ?? "").includes("npm test")
            );
          },
          hints: [
            "Every push to main starts a new run. It's green when npm test passes on GitHub.",
            "Run npm test locally first: if it passes, push.",
            "npm test, then git push, then gh run list: the newest line should start with ✓.",
          ],
        },
      ],
      feedback: (w, s) => {
        if (onGitHub(w, "package.json") !== onGitHub(s, "package.json") || !(onGitHub(w, ".github/workflows/ci.yml") ?? "npm test").includes("npm test"))
          return "You changed the test or the workflow instead of the page. A test you weaken stops protecting you: restart the lesson and fix index.html.";
        const local = w.workdir["index.html"] ?? "";
        if (local.includes("<title>") && !(onGitHub(w, "index.html") ?? "").includes("<title>"))
          return "Your fix is on your computer only. CI runs on what you push: commit and git push.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── CI/CD

const CICD_SCRIPTS = { test: 'grep -q "<title>" index.html && grep -q menu.html index.html', build: "test -f index.html && echo Built the café site" };

export const CICD_CI_YML = `name: CI

on: pull_request

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`;

export const DEPLOY_YML = `name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Publish the site
        run: echo "Deployed to https://cafe.gitverse.dev"
`;

const REDESIGN_INDEX = `<html>
<head>
  <title>Café Gitverse</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>☕ Café Gitverse</h1>
  <p>Fresh coffee and cake, every day. Come say hi!</p>
  <footer>© 2023 Café Gitverse</footer>
</body>
</html>
`;

const cicdSetup = (): World => {
  const w = new Scenario(
    cafe(
      { "package.json": pkg(CICD_SCRIPTS), ".github/workflows/ci.yml": CICD_CI_YML, ".github/workflows/deploy.yml": DEPLOY_YML },
      {
        protection: { main: { requirePullRequest: true, requiredApprovals: 1, requiredChecks: ["test"] } },
        autoReviewers: ["Maya"],
      },
    ),
  )
    .run("git switch -c new-homepage")
    .commit("Redesign the homepage", { "index.html": REDESIGN_INDEX })
    .run("git push -u origin new-homepage")
    .done();
  return w;
};

const myPr = (w: World) => host(w)?.pulls?.find((p) => p.head === "new-homepage");

const cicd: Lesson = {
  id: "ci-cd",
  chapterId: "workflows",
  title: "CI/CD",
  tagline: "Test, build, deploy: all automatic",
  xp: 250,
  boss: true,
  concepts: ["continuous integration", "required checks", "continuous delivery", "pipeline", "needs"],
  commands: ["gh pr create", "gh pr view", "gh run view --log-failed", "gh pr merge --merge", "gh run list"],
  ui: UI,
  setup: cicdSetup,
  recap: [
    "Continuous integration: every pull request is tested automatically, and a required check blocks the merge until it's green.",
    "Fix a failing check on the PR's own branch and push: the pull request updates and the check runs again.",
    "Continuous delivery: once main changes, a pipeline tests, builds and deploys it with no one touching a server.",
    "needs: chains jobs into that pipeline: if test fails, build and deploy never start.",
  ],
  steps: [
    {
      kind: "discover",
      title: "From a push to a live website",
      body: [
        "At the café, nobody uploads the website by hand anymore. The team set up a pipeline: test → build → deploy. It runs by itself.",
        "Continuous integration (CI): every pull request is tested. Main is protected: a PR needs Maya's approval AND a green “test” check before anyone can merge it. Broken code can't sneak in.",
        "Continuous delivery (CD): every time main changes, the Deploy workflow tests the code again, builds the site and publishes it. Merging is shipping.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "Read the pipeline",
      body: "Look at the Deploy workflow. Notice on: push with branches: [main] (it only runs for main), and needs:, which chains the jobs.",
      command: "cat .github/workflows/deploy.yml",
      check: (_w, _s, ran) => ran.includes("cat"),
      success: "Three jobs: test, then build (needs: test), then deploy (needs: build). If one fails, the next ones are skipped: nothing broken gets deployed.",
    },
    {
      kind: "try",
      title: "Open your pull request",
      body: "You redesigned the homepage on the branch new-homepage, already pushed. Open a pull request, then watch the GitHub tab: Maya reviews, and CI runs the test on your branch.",
      command: 'gh pr create --title "Redesign the homepage" --body "A fresher look for the café"',
      check: (w) => !!myPr(w),
      success: "Maya approved right away. But the CI run on your branch is a red X: the test failed.",
    },
    {
      kind: "try",
      title: "Can you merge?",
      body: "Ask GitHub for the pull request's status.",
      command: "gh pr view",
      check: (_w, _s, ran) => ran.includes("gh pr"),
      success: "“Merge blocked: Required check failing: test”. Maya's approval isn't enough: main only accepts pull requests whose test check is green. gh pr merge would refuse.",
    },
    {
      kind: "try",
      title: "Why did it fail?",
      body: "Show only the failing part of the latest run's log.",
      command: "gh run view --log-failed",
      check: (_w, _s, ran) => ran.includes("gh run"),
      success: "npm test exited with code 1. The script checks two things: the page has a <title>, and it links to menu.html. Your redesign kept the title but dropped the menu link — and the test exists precisely so customers can always find the menu.",
    },
    {
      kind: "challenge",
      title: "Boss challenge: ship it",
      body: "Fix your pull request so the test passes, merge it, and check that the pipeline deployed the new homepage. Put a menu link back in index.html (e.g. <a href=\"menu.html\">See the menu</a>) on new-homepage, push, then merge. Don't touch the test or the workflows.",
      objectives: [
        {
          id: "green",
          label: "The test check passes on your pull request",
          check: (w) => {
            const pr = myPr(w);
            const run = pr && runs(w).filter((r) => r.event === "pull_request" && r.pr === pr.number && r.commit === pr.headCommit).at(-1);
            return !!run && run.status === "success" && !!pr && (w.hostedCommits[pr.headCommit]?.tree["index.html"] ?? "").includes("menu.html");
          },
          hints: [
            "A pull request shows the latest commit of its branch. Fix the page on new-homepage and push: CI runs again.",
            "Edit index.html to add a link to menu.html, commit, git push.",
            'Click index.html, add <a href="menu.html">See the menu</a> inside <body>, save, then: git commit -am "Bring back the menu link" && git push',
          ],
        },
        {
          id: "merged",
          label: "Your pull request is merged into main",
          check: (w, s) =>
            myPr(w)?.state === "merged" &&
            onGitHub(w, "package.json") === onGitHub(s, "package.json") &&
            onGitHub(w, ".github/workflows/ci.yml") === onGitHub(s, ".github/workflows/ci.yml") &&
            onGitHub(w, ".github/workflows/deploy.yml") === onGitHub(s, ".github/workflows/deploy.yml"),
          hints: [
            "Once the check is green and Maya has approved, the merge button unlocks.",
            "gh pr view should say “Ready to merge”. Then gh pr merge with a strategy.",
            "Type: gh pr merge --merge",
          ],
        },
        {
          id: "deployed",
          label: "The Deploy pipeline ran on main and you checked it with gh run list",
          check: (w, s, ran) => {
            const run = tipRun(w, "Deploy");
            return !!run && run.id > maxRunId(s) && run.status === "success" && ran.includes("gh run");
          },
          hints: [
            "Merging changed main, and the Deploy workflow listens to pushes on main.",
            "List the runs: the newest ones are on main, triggered by push.",
            "Type: gh run list (then gh run view <id> to see test, build and deploy)",
          ],
        },
      ],
      feedback: (w, s) => {
        if (onGitHub(w, "package.json") !== onGitHub(s, "package.json") || (myPr(w) && w.hostedCommits[myPr(w)!.headCommit]?.tree["package.json"] !== onGitHub(s, "package.json")))
          return "You changed the test. A check you can edit away protects nobody: restart the lesson and fix index.html instead.";
        if (w.repo && currentBranch(w.repo) === "main" && w.repo.branches.main !== w.repo.remoteRefs["origin/main"])
          return "You committed on main, but main is protected: the fix belongs on new-homepage. Switch back with git switch new-homepage.";
        const pr = myPr(w);
        if (pr?.state === "open" && (w.workdir["index.html"] ?? "").includes("menu.html") && !(w.hostedCommits[pr.headCommit]?.tree["index.html"] ?? "").includes("menu.html"))
          return "Your fix is only on your computer. Commit it on new-homepage and git push: the pull request updates and CI runs again.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Secrets

const TOKEN = "tok_live_4f7a9c2e";

export const SECRET_DEPLOY_YML = `name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check the deploy token
        run: test -n "\${{ secrets.DEPLOY_TOKEN }}"
      - name: Publish the site
        run: echo "Deploying with token \${{ secrets.DEPLOY_TOKEN }} to https://cafe.gitverse.dev"
`;

const secretsSetup = (): World => {
  const w = cafe({ ".github/workflows/deploy.yml": SECRET_DEPLOY_YML });
  return { ...w, workdir: { ...w.workdir, ".env": `DEPLOY_TOKEN=${TOKEN}\n` } };
};

const envLeaked = (w: World) => Object.values(w.hostedCommits).some((cm) => ".env" in cm.tree);

const secrets: Lesson = {
  id: "secrets",
  chapterId: "workflows",
  title: "Secrets & security",
  tagline: "Tokens for your workflows, never in your code",
  xp: 200,
  concepts: ["secrets", "masking", ".env", "rotation", "least privilege"],
  commands: ['gh secret set NAME --body "…"', "gh secret list", "gh run rerun", "gh run view --log", ".gitignore"],
  ui: UI,
  setup: secretsSetup,
  recap: [
    "A secret is stored encrypted on GitHub and handed to workflows as ${{ secrets.NAME }}. Logs show it as ***.",
    "gh secret set saves one, gh secret list shows the names, never the values.",
    "Keep tokens in .env on your computer, and .env in .gitignore so it never reaches a commit.",
    "If a secret is ever pushed, rotate it immediately: Git history keeps every version of every file.",
  ],
  steps: [
    {
      kind: "discover",
      title: "A deploy needs a key",
      body: [
        "To publish the café website, the Deploy workflow logs in to the hosting company with an API token: a long password made for programs.",
        "That token must never be written in the code. The repository is shared with the whole team, cloned on laptops, maybe public one day. Anyone who reads it could deploy anything in your name.",
        "So GitHub keeps secrets: values stored encrypted, which workflows can use as ${{ secrets.DEPLOY_TOKEN }}. Right now, the latest Deploy run failed. Let's find out why.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "Read the failure",
      body: "Show the failing part of the latest run.",
      command: "gh run view --log-failed",
      check: (_w, _s, ran) => ran.includes("gh run"),
      success: "Look at “$ test -n \"\"”: test -n checks that a value isn't empty, and it is. GitHub has no secret called DEPLOY_TOKEN, so ${{ secrets.DEPLOY_TOKEN }} became nothing.",
    },
    {
      kind: "try",
      title: "Give GitHub the token",
      body: `Maya gave you the token; it's in the .env file on your computer (click it in the Files panel). Store it on GitHub as a secret.`,
      command: `gh secret set DEPLOY_TOKEN --body "${TOKEN}"`,
      check: (w) => !!host(w)?.secrets?.DEPLOY_TOKEN,
      success: "“✓ Set Actions secret DEPLOY_TOKEN”. GitHub stored it encrypted. Only collaborators with write access to the repository can manage secrets.",
    },
    {
      kind: "try",
      title: "List the secrets",
      body: "Check what GitHub has.",
      command: "gh secret list",
      check: (_w, _s, ran) => ran.includes("gh secret"),
      success: "You see the name and when it was updated, never the value. Not even you can read it back: you can only replace it.",
    },
    {
      kind: "try",
      title: "Run it again",
      body: "Nothing changed in the code, so there's nothing to push. Ask GitHub to run the failed workflow again: it picks up the new secret.",
      command: "gh run rerun",
      check: (w) => runs(w).at(-1)?.status === "success",
      success: "“New run 2 finished: success”. The GitHub tab shows it green.",
    },
    {
      kind: "try",
      title: "Is the token in the log?",
      body: "Logs are visible to everyone who can see the repository. Read this one.",
      command: "gh run view --log",
      check: (_w, _s, ran) => ran.includes("gh run"),
      success: "“Deploying with token *** to …”: GitHub hides every secret value in logs, even when a step prints it.",
    },
    {
      kind: "discover",
      title: "Never commit a secret",
      body: [
        "The real token sits in .env on your computer. git status lists it as untracked: one careless git add . and it would be in a commit. The fix is one line: put .env in .gitignore.",
        "If a secret is ever pushed, deleting the file isn't enough: history keeps every version of every file, and clones may already have it. Rotate it right away: revoke the token, make a new one, update the secret. (Erasing it from history is a Rescue topic, coming soon.)",
        "Give each token only the rights it needs, least privilege: a deploy token shouldn't be able to delete the repository.",
      ],
      scene: "history",
    },
    {
      kind: "challenge",
      title: "Challenge: ship the about page safely",
      body: "Maya wants an about page. Create about.html, commit it and push it so the Deploy run on main is green. But first, make sure .env can never be committed: list it in a .gitignore that you commit too.",
      objectives: [
        {
          id: "ignored",
          label: ".gitignore lists .env, on GitHub",
          check: (w) => /^\/?\.env\s*$/m.test(onGitHub(w, ".gitignore") ?? ""),
          hints: [
            "A .gitignore file tells Git which files to never track. Commit it so the whole team is protected.",
            'Create .gitignore with the line .env: echo ".env" > .gitignore',
            'echo ".env" > .gitignore, then git status: .env is gone from the untracked files.',
          ],
        },
        {
          id: "deployed",
          label: "about.html is deployed by a green run on main",
          check: (w) => !!onGitHub(w, "about.html") && tipRun(w, "Deploy")?.status === "success",
          hints: [
            "Every push to main runs Deploy, now with the secret.",
            "Create about.html, git add, git commit, git push.",
            'echo "<h1>About us</h1>" > about.html && git add . && git commit -m "Add about page" && git push',
          ],
        },
        {
          id: "safe",
          label: ".env never reached GitHub",
          check: (w) => !envLeaked(w) && !!onGitHub(w, "about.html"),
          hints: [
            "git status before git add: .env must not be listed.",
            "Ignore it first, then git add . is safe.",
            "If .env is already staged: git rm --cached .env, add it to .gitignore, then commit.",
          ],
        },
      ],
      feedback: (w) => {
        if (envLeaked(w))
          return "Your .env was pushed to GitHub. In real life: rotate the token now — history keeps it even if you delete the file. Restart the lesson to try again.";
        if (w.repo && headCommitId(w.repo) && [...ancestors(w.repo, headCommitId(w.repo)!)].some((id) => ".env" in w.repo!.commits[id].tree))
          return "Stop before pushing: a commit contains .env. Undo it with git reset HEAD~1 (your files stay), add .env to .gitignore, then commit again.";
        if (w.repo && w.repo.index[".env"] !== undefined)
          return ".env is staged! Unstage it with git rm --cached .env and list it in .gitignore before committing.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

export const WORKFLOW_LESSONS: Lesson[] = [issues, actions, cicd, secrets];

/** French text, same step / objective order as the lessons above. */
export const WORKFLOW_FR: Record<string, LessonText> = {
  issues: {
    title: "Les issues",
    tagline: "Suivre le travail, puis le clore avec une pull request",
    concepts: ["issue", "labels", "mots-clés de clôture", "Fixes #N"],
    recap: [
      "Une issue est une note numérotée sur GitHub : un bug, une idée, une tâche. C'est la liste de choses à faire de toute l'équipe.",
      "Les labels comme bug ou enhancement trient les issues pour que chacun voie de quel genre de travail il s'agit.",
      "Écris « Fixes #N » dans une pull request et GitHub ferme l'issue #N tout seul au moment où la PR est fusionnée.",
      "Ce lien reste pour toujours : quiconque ouvre l'issue voit exactement quel changement l'a corrigée.",
    ],
    steps: [
      {
        title: "La liste de tâches de l'équipe",
        body: [
          "Maya, Sam et toi gérez le site web d'un petit café. Il se passe toujours quelque chose : une faute dans le menu, une idée pour la page d'accueil. Si tout ça reste dans des messages de chat, ça se perd.",
          "GitHub les garde sous forme d'issues. Chaque issue a un numéro (#1, #2…), un titre, une description et des labels comme bug ou enhancement. Toute l'équipe peut les lire, les commenter et en prendre une.",
          "Le meilleur : une pull request peut dire « Fixes #1 ». Quand elle est fusionnée, GitHub ferme l'issue #1 pour toi et relie les deux pour toujours.",
        ],
      },
      {
        title: "Qu'est-ce qu'il reste à faire ?",
        body: "Liste les issues ouvertes du dépôt du café. gh est l'outil en ligne de commande de GitHub : il parle à GitHub pour toi.",
        success: "Deux issues ouvertes : #1 est un bug (la faute dans le menu), #2 une amélioration (les horaires d'ouverture). Tu retrouves la même liste dans l'onglet GitHub.",
      },
      {
        title: "Lis une issue",
        body: "Ouvre l'issue #1 pour voir qui l'a signalée et pourquoi.",
        success: "C'est Maya qui l'a ouverte, elle porte le label bug et la description dit ce qui ne va pas. Une bonne issue répond à « qu'est-ce qui est cassé ? » pour que n'importe qui puisse la corriger.",
      },
      {
        title: "Signale un bug",
        body: "En lisant la page d'accueil, tu remarques que le pied de page affiche encore © 2023. Ne le garde pas en tête : crée une issue avec le label bug.",
        success: "GitHub a affiché le lien de la nouvelle issue : c'est la #3. Toute l'équipe est au courant, même si tu ne la corriges pas aujourd'hui.",
      },
      {
        title: "Propose la correction de #1",
        body: "Bonne nouvelle : tu as déjà corrigé la faute « Expresso » sur ta branche fix-menu et tu l'as poussée. Ouvre une pull request et écris « Fixes #1 » dans sa description. C'est cette phrase qui relie les deux.",
        success: "La pull request #4 est ouverte. Les issues et les pull requests partagent les mêmes numéros, c'est pour ça qu'elle porte le #4 et pas le #1.",
      },
      {
        title: "Fusionne-la et regarde #1 se fermer",
        body: "Fusionne ta pull request. -d supprime ensuite la branche fix-menu et te ramène sur main. Garde un œil sur les issues dans l'onglet GitHub.",
        success: "« ✓ Closed issue #1 » (issue #1 fermée) : tu n'as jamais tapé gh issue close. GitHub a lu « Fixes #1 », fermé l'issue et noté qu'elle a été fermée par #4.",
      },
      {
        title: "Défi : ferme ta propre issue",
        body: "Corrige maintenant le bug que tu as signalé. Mets le pied de page de index.html à l'année en cours sur une nouvelle branche, ouvre une pull request qui ferme ton issue, et fusionne-la. Laisse la pull request fermer l'issue : ne la ferme pas à la main.",
        objectives: [
          {
            label: "Le pied de page sur le main de GitHub n'affiche plus 2023",
            hints: [
              "Fais le changement sur une nouvelle branche, puis fais-le entrer dans main par une pull request (main est partagé : les changements passent par des PR).",
              "git pull, git switch -c fix-footer, change l'année dans index.html, commite, git push -u origin fix-footer.",
              'git pull && git switch -c fix-footer, puis modifie la ligne du pied de page dans index.html (2023 → 2026), git commit -am "Update footer year", git push -u origin fix-footer',
            ],
          },
          {
            label: "Ton issue du pied de page a été fermée par une pull request fusionnée",
            hints: [
              "Mets un mot-clé de clôture et le numéro de l'issue dans la description de la pull request, puis fusionne-la.",
              'gh issue list affiche le numéro de ton issue (#3). Ensuite : gh pr create --title "…" --body "Fixes #3"',
              'gh pr create --title "Update footer year" --body "Fixes #3", puis gh pr merge --merge -d',
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        /^You closed the issue by hand\..*gh issue reopen (\d+) /,
        "Tu as fermé l'issue à la main. Ça marche, mais personne ne peut voir quel changement l'a corrigée. Rouvre-la avec gh issue reopen $1 et laisse ta pull request la fermer.",
      ],
      [
        "The issue was closed by a direct push to main, not by a pull request. Restart the lesson and send the fix through a PR.",
        "L'issue a été fermée par un push direct sur main, pas par une pull request. Recommence la leçon et fais passer la correction par une PR.",
      ],
      [
        "You committed on main. Fixes go on their own branch: create one with git switch -c fix-footer, then open a pull request from it.",
        "Tu as commité sur main. Les corrections vont sur leur propre branche : crées-en une avec git switch -c fix-footer, puis ouvre une pull request depuis celle-ci.",
      ],
      [
        /^Your pull request #(\d+) doesn't mention issue #(\d+)\./,
        "Ta pull request #$1 ne mentionne pas l'issue #$2. Ferme-la (gh pr close $1) et ouvre-en une nouvelle avec --body \"Fixes #$2\".",
      ],
    ],
  },
  actions: {
    title: "GitHub Actions",
    tagline: "Du code qui tourne sur les ordinateurs de GitHub",
    concepts: ["GitHub Actions", "workflow", "job", "étape (step)", "exécution (run)"],
    recap: [
      "Un workflow est un fichier YAML dans .github/workflows/. GitHub le lit à chaque push et l'exécute sur ses propres ordinateurs.",
      "on: dit quand il tourne, jobs: regroupe le travail, steps: sont les commandes, l'une après l'autre.",
      "Chaque push déclenche une exécution : ✓ verte quand toutes les étapes ont réussi, X rouge quand l'une a échoué. gh run list et gh run view --log les affichent.",
      "Une exécution rouge est un cadeau : GitHub a repéré l'erreur avant tes clients.",
    ],
    steps: [
      {
        title: "Un robot qui vérifie chaque push",
        body: [
          "Le site du café a un test : npm test vérifie que la page d'accueil a un <title> et que style.css existe. Simple, mais il a déjà attrapé de vraies erreurs.",
          "Le problème : on oublie de le lancer. GitHub Actions règle ça. Tu décris le travail dans un fichier de workflow, tu le commites, et GitHub l'exécute sur ses propres ordinateurs à chaque push.",
          "Un fichier de workflow est du code comme un autre : il vit dans le dépôt, dans .github/workflows/, et il passe par des commits et des revues.",
        ],
      },
      {
        title: "Lance le test toi-même",
        body: "D'abord, lance le test du projet sur ton ordinateur. npm test exécute le script « test » écrit dans package.json.",
        success: "npm a affiché le script qu'il a lancé : grep -q cherche <title> dans index.html, test -f vérifie que style.css existe. Pas de message d'erreur : il a réussi.",
      },
      {
        title: "Écris le workflow",
        body: "Crée .github/workflows/ci.yml. On l'a prérempli — lis-le ligne par ligne : name: est ce qu'affiche l'onglet GitHub. on: dit quand il tourne (à chaque push sur main, et à chaque pull request). jobs: contient le travail ; celui-ci a un job appelé test. runs-on: ubuntu-latest demande à GitHub une machine Linux toute neuve. steps: s'exécutent dans l'ordre : uses: actions/checkout@v4 télécharge ton code sur cette machine, puis run: npm test lance ton test, exactement comme tu viens de le faire.",
        actionLabel: "Créer .github/workflows/ci.yml",
        success: "Le workflow existe, mais seulement sur ton ordinateur. GitHub ne connaît que ce que tu pousses.",
      },
      {
        title: "Commite-le",
        body: "Indexe le nouveau fichier et commite-le, comme n'importe quel autre code.",
        success: "C'est commité. Le workflow fait maintenant partie de l'historique du projet.",
      },
      {
        title: "Pousse, et GitHub se met au travail",
        body: "Pousse main. Cette fois, regarde la partie Actions de l'onglet GitHub.",
        success: "Le push est arrivé, GitHub a trouvé ci.yml dedans et a lancé une exécution. Elle est verte : le test a réussi sur la machine de GitHub.",
      },
      {
        title: "Liste les exécutions",
        body: "Affiche toutes les exécutions depuis le terminal.",
        success: "Une ligne par exécution : ✓ (réussie), le nom du workflow CI, la branche main, l'événement push qui l'a déclenchée, et l'identifiant de l'exécution : 1.",
      },
      {
        title: "Lis le journal",
        body: "Ouvre l'exécution 1 avec son journal complet : qu'a vraiment fait la machine de GitHub ?",
        success: "Chaque ligne commence par le nom du job (test), puis tu vois le checkout, « $ npm test » et le script lancé. La même sortie que sur ton ordinateur, sur une machine que tu n'as jamais touchée.",
      },
      {
        title: "Range la page",
        body: "Sam te demande de ranger le <head> de la page d'accueil. Dans le panneau Fichiers, clique sur index.html pour l'ouvrir. On a prérempli la version rangée : regarde bien, la ligne <title> a disparu pendant le ménage. Enregistre quand même — c'est exactement le genre de bévue pour lequel la CI existe.",
        actionLabel: "Enregistrer le index.html rangé",
        success: "Enregistré. Rien ne t'a prévenu : la page a toujours l'air bien dans un navigateur. Voyons ce qu'en pense la CI.",
      },
      {
        title: "Pousse le ménage",
        body: "Commite le changement et pousse-le d'un seul coup.",
        success: "Le push a marché, mais la nouvelle exécution est un X rouge dans l'onglet GitHub. GitHub a repéré le titre manquant pour toi.",
      },
      {
        title: "Défi : remets main au vert",
        body: "main est rouge. Trouve pourquoi dans le journal de l'exécution, corrige la page d'accueil, et pousse pour que la dernière exécution de CI sur main réussisse. Corrige la page, pas le test.",
        objectives: [
          {
            label: "Lis le journal de l'exécution qui a échoué",
            hints: [
              "Le journal dit quelle commande a échoué et comment.",
              "gh run list affiche l'identifiant de l'exécution rouge ; gh run view <id> --log-failed n'affiche que le job en échec.",
              "Tape : gh run view --log-failed (sans identifiant, c'est la dernière exécution)",
            ],
          },
          {
            label: "index.html sur GitHub a retrouvé son <title>",
            hints: [
              'npm test a échoué sur grep -q "<title>" index.html : la ligne du titre manque.',
              "Remets <title>Café Gitverse</title> dans le <head>, commite, pousse.",
              'Clique sur index.html, ajoute la ligne <title>Café Gitverse</title> juste après <head>, enregistre, puis : git commit -am "Restore page title" && git push',
            ],
          },
          {
            label: "La dernière exécution de CI sur main est verte",
            hints: [
              "Chaque push sur main lance une nouvelle exécution. Elle est verte quand npm test réussit sur GitHub.",
              "Lance d'abord npm test en local : s'il réussit, pousse.",
              "npm test, puis git push, puis gh run list : la ligne la plus récente doit commencer par ✓.",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "You changed the test or the workflow instead of the page. A test you weaken stops protecting you: restart the lesson and fix index.html.",
        "Tu as modifié le test ou le workflow au lieu de la page. Un test qu'on affaiblit ne protège plus rien : recommence la leçon et corrige index.html.",
      ],
      [
        "Your fix is on your computer only. CI runs on what you push: commit and git push.",
        "Ta correction n'est que sur ton ordinateur. La CI tourne sur ce que tu pousses : commite et fais git push.",
      ],
    ],
  },
  "ci-cd": {
    title: "CI/CD",
    tagline: "Tester, construire, déployer : tout est automatique",
    concepts: ["intégration continue", "checks obligatoires", "livraison continue", "pipeline", "needs"],
    recap: [
      "Intégration continue : chaque pull request est testée automatiquement, et un check obligatoire bloque la fusion tant qu'il n'est pas vert.",
      "Corrige un check en échec sur la branche de la PR et pousse : la pull request se met à jour et le check repart.",
      "Livraison continue : dès que main change, un pipeline teste, construit et déploie, sans que personne ne touche à un serveur.",
      "needs: enchaîne les jobs dans ce pipeline : si test échoue, build et deploy ne démarrent jamais.",
    ],
    steps: [
      {
        title: "D'un push à un site en ligne",
        body: [
          "Au café, plus personne ne met le site en ligne à la main. L'équipe a monté un pipeline : test → build → deploy. Il tourne tout seul.",
          "Intégration continue (CI) : chaque pull request est testée. main est protégée : une PR a besoin de l'approbation de Maya ET d'un check « test » vert avant que quiconque puisse la fusionner. Du code cassé ne peut pas se glisser dedans.",
          "Livraison continue (CD) : chaque fois que main change, le workflow Deploy reteste le code, construit le site et le publie. Fusionner, c'est livrer.",
        ],
      },
      {
        title: "Lis le pipeline",
        body: "Regarde le workflow Deploy. Remarque on: push avec branches: [main] (il ne tourne que pour main), et needs:, qui enchaîne les jobs.",
        success: "Trois jobs : test, puis build (needs: test), puis deploy (needs: build). Si l'un échoue, les suivants sont sautés : rien de cassé n'est déployé.",
      },
      {
        title: "Ouvre ta pull request",
        body: "Tu as refait la page d'accueil sur la branche new-homepage, déjà poussée. Ouvre une pull request, puis regarde l'onglet GitHub : Maya relit, et la CI lance le test sur ta branche.",
        success: "Maya a approuvé tout de suite. Mais l'exécution de CI sur ta branche est un X rouge : le test a échoué.",
      },
      {
        title: "Peux-tu fusionner ?",
        body: "Demande à GitHub l'état de la pull request.",
        success: "« Merge blocked: Required check failing: test » (fusion bloquée : le check obligatoire test échoue). L'approbation de Maya ne suffit pas : main n'accepte que les pull requests dont le check test est vert. gh pr merge refuserait.",
      },
      {
        title: "Pourquoi ça a échoué ?",
        body: "Affiche seulement la partie en échec du journal de la dernière exécution.",
        success: "npm test s'est terminé avec le code 1. Le script vérifie deux choses : la page a un <title>, et elle a un lien vers menu.html. Ta refonte a gardé le titre mais perdu le lien vers le menu — et le test existe justement pour que les clients trouvent toujours le menu.",
      },
      {
        title: "Défi final : livre-la",
        body: "Corrige ta pull request pour que le test passe, fusionne-la, et vérifie que le pipeline a déployé la nouvelle page d'accueil. Remets un lien vers le menu dans index.html (par ex. <a href=\"menu.html\">See the menu</a>) sur new-homepage, pousse, puis fusionne. Ne touche ni au test ni aux workflows.",
        objectives: [
          {
            label: "Le check test passe sur ta pull request",
            hints: [
              "Une pull request montre le dernier commit de sa branche. Corrige la page sur new-homepage et pousse : la CI repart.",
              "Modifie index.html pour ajouter un lien vers menu.html, commite, git push.",
              'Clique sur index.html, ajoute <a href="menu.html">See the menu</a> dans le <body>, enregistre, puis : git commit -am "Bring back the menu link" && git push',
            ],
          },
          {
            label: "Ta pull request est fusionnée dans main",
            hints: [
              "Une fois le check vert et l'approbation de Maya obtenue, la fusion se débloque.",
              "gh pr view doit dire « Ready to merge » (prête à fusionner). Ensuite gh pr merge avec une stratégie.",
              "Tape : gh pr merge --merge",
            ],
          },
          {
            label: "Le pipeline Deploy a tourné sur main et tu l'as vérifié avec gh run list",
            hints: [
              "La fusion a changé main, et le workflow Deploy écoute les push sur main.",
              "Liste les exécutions : les plus récentes sont sur main, déclenchées par push.",
              "Tape : gh run list (puis gh run view <id> pour voir test, build et deploy)",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "You changed the test. A check you can edit away protects nobody: restart the lesson and fix index.html instead.",
        "Tu as modifié le test. Un check qu'on peut supprimer d'un coup d'édition ne protège personne : recommence la leçon et corrige plutôt index.html.",
      ],
      [
        "You committed on main, but main is protected: the fix belongs on new-homepage. Switch back with git switch new-homepage.",
        "Tu as commité sur main, mais main est protégée : la correction va sur new-homepage. Reviens-y avec git switch new-homepage.",
      ],
      [
        "Your fix is only on your computer. Commit it on new-homepage and git push: the pull request updates and CI runs again.",
        "Ta correction n'est que sur ton ordinateur. Commite-la sur new-homepage et fais git push : la pull request se met à jour et la CI repart.",
      ],
    ],
  },
  secrets: {
    title: "Secrets et sécurité",
    tagline: "Des jetons pour tes workflows, jamais dans ton code",
    concepts: ["secrets", "masquage", ".env", "rotation", "moindre privilège"],
    recap: [
      "Un secret est stocké chiffré sur GitHub et transmis aux workflows sous la forme ${{ secrets.NOM }}. Les journaux l'affichent comme ***.",
      "gh secret set en enregistre un, gh secret list montre les noms, jamais les valeurs.",
      "Garde tes jetons dans .env sur ton ordinateur, et .env dans .gitignore pour qu'il n'arrive jamais dans un commit.",
      "Si un secret est poussé un jour, change-le immédiatement : l'historique Git garde chaque version de chaque fichier.",
    ],
    steps: [
      {
        title: "Un déploiement a besoin d'une clé",
        body: [
          "Pour publier le site du café, le workflow Deploy se connecte à l'hébergeur avec un jeton d'API : un long mot de passe fait pour les programmes.",
          "Ce jeton ne doit jamais être écrit dans le code. Le dépôt est partagé avec toute l'équipe, cloné sur des portables, peut-être public un jour. Quiconque le lit pourrait déployer n'importe quoi en ton nom.",
          "Alors GitHub garde des secrets : des valeurs stockées chiffrées, que les workflows utilisent sous la forme ${{ secrets.DEPLOY_TOKEN }}. Là, la dernière exécution de Deploy a échoué. Voyons pourquoi.",
        ],
      },
      {
        title: "Lis l'échec",
        body: "Affiche la partie en échec de la dernière exécution.",
        success: "Regarde « $ test -n \"\" » : test -n vérifie qu'une valeur n'est pas vide, et elle l'est. GitHub n'a pas de secret appelé DEPLOY_TOKEN, donc ${{ secrets.DEPLOY_TOKEN }} est devenu du vide.",
      },
      {
        title: "Donne le jeton à GitHub",
        body: "Maya t'a donné le jeton ; il est dans le fichier .env sur ton ordinateur (clique dessus dans le panneau Fichiers). Enregistre-le sur GitHub comme secret.",
        success: "« ✓ Set Actions secret DEPLOY_TOKEN » (secret enregistré). GitHub l'a stocké chiffré. Seuls les collaborateurs avec un accès en écriture au dépôt peuvent gérer les secrets.",
      },
      {
        title: "Liste les secrets",
        body: "Vérifie ce que GitHub a.",
        success: "Tu vois le nom et la date de mise à jour, jamais la valeur. Même toi, tu ne peux pas la relire : tu peux seulement la remplacer.",
      },
      {
        title: "Relance-le",
        body: "Rien n'a changé dans le code, donc il n'y a rien à pousser. Demande à GitHub de relancer le workflow en échec : il prendra le nouveau secret.",
        success: "« New run 2 finished: success » (la nouvelle exécution 2 a réussi). L'onglet GitHub l'affiche en vert.",
      },
      {
        title: "Le jeton est-il dans le journal ?",
        body: "Les journaux sont visibles par tous ceux qui voient le dépôt. Lis celui-ci.",
        success: "« Deploying with token *** to … » : GitHub masque la valeur de chaque secret dans les journaux, même quand une étape l'affiche.",
      },
      {
        title: "Ne commite jamais un secret",
        body: [
          "Le vrai jeton est dans .env sur ton ordinateur. git status le liste comme non suivi : un git add . distrait et il serait dans un commit. La parade tient en une ligne : mets .env dans .gitignore.",
          "Si un secret est poussé un jour, supprimer le fichier ne suffit pas : l'historique garde chaque version de chaque fichier, et des clones l'ont peut-être déjà. Change-le tout de suite : révoque le jeton, crées-en un nouveau, mets à jour le secret. (L'effacer de l'historique, c'est un sujet du chapitre Sauvetage, bientôt disponible.)",
          "Donne à chaque jeton seulement les droits dont il a besoin, c'est le moindre privilège : un jeton de déploiement ne devrait pas pouvoir supprimer le dépôt.",
        ],
      },
      {
        title: "Défi : publie la page « À propos » en sécurité",
        body: "Maya veut une page « À propos ». Crée about.html, commite-la et pousse-la pour que l'exécution de Deploy sur main soit verte. Mais d'abord, fais en sorte que .env ne puisse jamais être commité : liste-le dans un .gitignore que tu commites aussi.",
        objectives: [
          {
            label: ".gitignore liste .env, sur GitHub",
            hints: [
              "Un fichier .gitignore dit à Git quels fichiers ne jamais suivre. Commite-le pour que toute l'équipe soit protégée.",
              'Crée .gitignore avec la ligne .env : echo ".env" > .gitignore',
              'echo ".env" > .gitignore, puis git status : .env a disparu des fichiers non suivis.',
            ],
          },
          {
            label: "about.html est déployée par une exécution verte sur main",
            hints: [
              "Chaque push sur main lance Deploy, maintenant avec le secret.",
              "Crée about.html, git add, git commit, git push.",
              'echo "<h1>About us</h1>" > about.html && git add . && git commit -m "Add about page" && git push',
            ],
          },
          {
            label: ".env n'est jamais arrivé sur GitHub",
            hints: [
              "git status avant git add : .env ne doit pas apparaître.",
              "Ignore-le d'abord, ensuite git add . ne risque rien.",
              "Si .env est déjà indexé : git rm --cached .env, ajoute-le à .gitignore, puis commite.",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "Your .env was pushed to GitHub. In real life: rotate the token now — history keeps it even if you delete the file. Restart the lesson to try again.",
        "Ton .env a été poussé sur GitHub. En vrai : change le jeton tout de suite — l'historique le garde même si tu supprimes le fichier. Recommence la leçon pour réessayer.",
      ],
      [
        "Stop before pushing: a commit contains .env. Undo it with git reset HEAD~1 (your files stay), add .env to .gitignore, then commit again.",
        "Stop, ne pousse pas : un commit contient .env. Annule-le avec git reset HEAD~1 (tes fichiers restent), ajoute .env à .gitignore, puis commite à nouveau.",
      ],
      [
        ".env is staged! Unstage it with git rm --cached .env and list it in .gitignore before committing.",
        ".env est indexé ! Retire-le de l'index avec git rm --cached .env et liste-le dans .gitignore avant de commiter.",
      ],
    ],
  },
};
