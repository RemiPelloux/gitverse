import { ancestors, currentBranch, emptyWorld, headCommit, type HostedRepo, type PullRequest, type World } from "@/engine";
import * as c from "../checks";
import type { LessonText } from "../localize";
import { Scenario, scenario } from "../scenario";
import type { Lesson } from "../types";

// ───────────────────────────────────────────── Chapter 8 — Pull Requests

const CHAPTER = "pull-requests";
const PR_UI = { files: true, editor: true, stages: false, remote: true };

export const BAKERY_URL = "https://github.com/gitverse-team/bakery.git";

const INDEX = "<h1>Rosie's Bakery</h1>\n<p>Fresh bread every morning.</p>\n";
const MENU = "<h1>Menu</h1>\n<ul>\n  <li>Croissant — 2.50</li>\n  <li>Baguette — 1.80</li>\n</ul>\n";
const HOURS_LINE = "<p>Open 7am–6pm, Tuesday to Sunday.</p>\n";

/** The team's bakery website on the simulated GitHub, as Maya's computer sees it. */
const bakeryTeam = () =>
  scenario()
    .run("git init")
    .commit("Start bakery website", { "README.md": "# Rosie's Bakery\n\nThe website of our neighbourhood bakery.\n", "index.html": INDEX }, "Maya")
    .commit("Add menu", { "menu.html": MENU }, "Maya")
    .host(BAKERY_URL, "gitverse-team", "bakery")
    .run(`git remote add origin ${BAKERY_URL}`, "git push -u origin main");

/** Keep `local`'s computer, but with the GitHub state (and clock) of `latest`. */
const withGitHub = (local: World, latest: World): World => ({
  ...local,
  hosted: latest.hosted,
  hostedCommits: latest.hostedCommits,
  clock: latest.clock,
  seq: latest.seq,
});

/** Your own clone of the team repository. */
const cloneOf = (team: World) => new Scenario(withGitHub(emptyWorld(), team)).run(`git clone ${BAKERY_URL} .`).done();

const patchHost = (w: World, patch: (h: HostedRepo) => Partial<HostedRepo>): World => ({
  ...w,
  hosted: { ...w.hosted, [BAKERY_URL]: { ...w.hosted[BAKERY_URL], ...patch(w.hosted[BAKERY_URL]) } },
});

const host = (w: World): HostedRepo | undefined => w.hosted[BAKERY_URL];
const pulls = (w: World): PullRequest[] => host(w)?.pulls ?? [];
const pr = (w: World, n: number) => pulls(w).find((p) => p.number === n);
const hostedMain = (w: World) => host(w)?.branches.main;
const hostedTree = (w: World) => {
  const id = hostedMain(w);
  return id ? (w.hostedCommits[id]?.tree ?? {}) : {};
};
const localSynced = (w: World) => !!w.repo && w.repo.branches.main === hostedMain(w);

// ───────────────────────────────────────────── Lesson 1 — Open a pull request

const createPrSetup = (): World => patchHost(cloneOf(bakeryTeam().done()), () => ({ autoReviewers: ["Maya"] }));

const FEATURE = "feature/opening-hours";

/** Local branches (other than main and the first feature) that hold new work on top of main. */
const newWorkBranches = (w: World, s: World) => {
  if (!w.repo) return [];
  const startMain = s.repo?.branches.main;
  return Object.entries(w.repo.branches)
    .filter(([b, tip]) => b !== "main" && b !== FEATURE && tip !== startMain && !s.repo?.commits[tip])
    .map(([b]) => b);
};
const firstPrHead = (w: World) => pulls(w).find((p) => p.head === FEATURE)?.headCommit;
const cleanBranches = (w: World, s: World) => {
  const first = firstPrHead(w);
  return newWorkBranches(w, s).filter((b) => !c.branchContains(w, b, first));
};

const FB_FROM_FEATURE = `Your new branch starts from ${FEATURE}, so its pull request would carry the opening-hours commit too. Go back with git switch main and create the branch from there.`;
const FB_NO_BODY =
  "Your pull request has no body. Close it (gh pr close <number>), then open it again with --body \"…\" explaining what changed and why.";
const FB_NOT_PUSHED = "Your branch only exists on your computer. Push it first: git push -u origin <branch>.";

const createPr: Lesson = {
  id: "create-pr",
  chapterId: CHAPTER,
  title: "Open a pull request",
  tagline: "branch, push, gh pr create",
  xp: 150,
  concepts: ["pull request", "head and base branches", "gh CLI"],
  commands: ["git switch -c", "git push -u origin <branch>", 'gh pr create --title "…" --body "…"', "gh pr view", "gh pr list"],
  ui: PR_UI,
  setup: createPrSetup,
  recap: [
    "A pull request (PR) asks the team to merge your branch into main, and gives everyone a place to discuss it first.",
    "The recipe: a branch, a commit, git push -u origin <branch>, then gh pr create.",
    "The base is where the work should go (main), the head is the branch that carries it.",
    "One change per branch, one branch per PR, and a body that explains why.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Asking before merging",
      body: [
        "You joined the team behind Rosie's Bakery website. You already cloned it: the files are on your computer.",
        "On a team, nobody merges into main on their own. You push a branch, then open a pull request: a request to merge that branch into main.",
        "A pull request is also a conversation. Teammates read your change, comment on it, and approve it before it lands. You'll do it all from the terminal with gh, GitHub's command-line tool.",
      ],
      scene: "repo-state",
    },
    {
      kind: "try",
      title: "Start a branch for your change",
      body: "Customers keep asking when the bakery opens. Make a branch for that change, so main stays untouched.",
      command: `git switch -c ${FEATURE}`,
      check: (w) => c.onBranch(w, FEATURE),
      success: "You're on feature/opening-hours. Anything you commit now stays off main until the team agrees.",
    },
    {
      kind: "try",
      title: "Add the opening hours",
      body: "In the Files panel, click index.html to open it and add a line with the opening hours, or use the button below.",
      action: { label: "Add opening hours to index.html", kind: "edit-file", path: "index.html", content: INDEX + HOURS_LINE },
      check: (w) => c.isModified(w, "index.html"),
      success: "index.html changed in your working folder. Now save it in a commit.",
    },
    {
      kind: "try",
      title: "Commit it",
      body: "-a stages every file Git already tracks, so one command is enough here.",
      command: 'git commit -am "Add opening hours"',
      check: (w) => !!w.repo && !!w.repo.branches[FEATURE] && w.repo.branches[FEATURE] !== w.repo.branches.main,
      success: "Your branch is one commit ahead of main. Only your computer knows about it so far.",
    },
    {
      kind: "try",
      title: "Publish the branch",
      body: "A pull request is made from a branch that's on GitHub. Push yours, with -u so Git remembers where it goes.",
      command: `git push -u origin ${FEATURE}`,
      check: (w) => !!w.repo && !!w.repo.branches[FEATURE] && host(w)?.branches[FEATURE] === w.repo.branches[FEATURE],
      success: "GitHub has your branch now: “* [new branch] feature/opening-hours -> feature/opening-hours”.",
    },
    {
      kind: "try",
      title: "Open the pull request",
      body: "Ask to merge your branch into main. The title says what changes, the body says why. Watch the GitHub tab while you run it.",
      command: 'gh pr create --title "Add opening hours" --body "Customers keep asking when we open."',
      check: (w) => pulls(w).some((p) => p.head === FEATURE && p.state === "open"),
      success: "Pull request #1 is open: feature/opening-hours into main. Maya was quick and already approved it. Look at the GitHub tab.",
    },
    {
      kind: "try",
      title: "Read your pull request",
      body: "gh pr view shows the pull request for the branch you're on: its title, body, reviews and whether it can be merged.",
      command: "gh pr view",
      check: (_w, _s, ran) => ran.includes("gh pr"),
      success: "“main <- feature/opening-hours”: main is the base (where the work goes), your branch is the head. Maya's approval is listed, and the PR is ready to merge.",
    },
    {
      kind: "challenge",
      title: "Challenge: a second pull request",
      body: "Rosie wants a contact page. Open a separate pull request for it: a new branch that starts from main (not from feature/opening-hours), a commit with contact.html, the branch pushed, and a PR whose body explains the change.",
      objectives: [
        {
          id: "branch",
          label: "Commit contact.html on a new branch that starts from main",
          check: (w, s) => cleanBranches(w, s).some((b) => w.repo!.commits[w.repo!.branches[b]].tree["contact.html"] !== undefined),
          hints: [
            "One change per pull request. Start the new branch from main, so it doesn't carry the opening hours.",
            "git switch main, then git switch -c with a new name. Create contact.html, add it, commit.",
            'Type: git switch main, then git switch -c feature/contact, then echo "<h1>Contact</h1>" > contact.html && git add contact.html && git commit -m "Add contact page"',
          ],
        },
        {
          id: "pushed",
          label: "Push the new branch to GitHub",
          check: (w, s) => cleanBranches(w, s).some((b) => host(w)?.branches[b] === w.repo!.branches[b]),
          hints: ["GitHub needs the branch before a PR can be made from it.", "git push -u origin <your branch>", "Type: git push -u origin feature/contact"],
        },
        {
          id: "pr",
          label: "Open a pull request with a body that explains the change",
          check: (w, s) => {
            const mine = new Set(cleanBranches(w, s));
            return pulls(w).some((p) => mine.has(p.head) && p.state === "open" && p.body.trim().length > 0);
          },
          hints: [
            "A good body tells reviewers why the change exists, not just what it is.",
            'gh pr create --title "…" --body "…"',
            'Type: gh pr create --title "Add contact page" --body "Customers want to call us, so this adds our phone number."',
          ],
        },
      ],
      feedback: (w, s) => {
        if (!w.repo) return null;
        const first = firstPrHead(w);
        if (newWorkBranches(w, s).some((b) => c.branchContains(w, b, first))) return FB_FROM_FEATURE;
        const mine = new Set(cleanBranches(w, s));
        const open = pulls(w).filter((p) => mine.has(p.head) && p.state === "open");
        if (open.length && open.every((p) => !p.body.trim())) return FB_NO_BODY;
        const b = currentBranch(w.repo);
        if (b && mine.has(b) && !host(w)?.branches[b]) return FB_NOT_PUSHED;
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Lesson 2 — Code review

const NEWSLETTER_TYPO = '<h2>Fresh news</h2>\n<form>\n  <input type="email" placeholder="Your email">\n  <button>Subcribe</button>\n</form>\n';
export const NEWSLETTER_FIXED = NEWSLETTER_TYPO.replace("Subcribe", "Subscribe");
const ORDER_PAGE = "<h1>Order online</h1>\n<p>Pick up your order the next morning.</p>\n";
const MAYA_REVIEW = "The button says “Subcribe”, there's a typo. Could you fix it before we merge? The rest looks great!";
const REVIEW_BODY = "The link goes to order.htm, but the new page is order.html, so customers would get a 404. Could you fix the link?";

const codeReviewSetup = (): World => {
  const team = bakeryTeam().done();
  // you opened a PR for the newsletter signup…
  const you = new Scenario(patchHost(cloneOf(team), () => ({ autoReviewers: ["Maya"] })))
    .run("git switch -c feature/newsletter")
    .commit("Add newsletter signup", { "newsletter.html": NEWSLETTER_TYPO })
    .run("git push -u origin feature/newsletter", 'gh pr create --title "Add newsletter signup" --body "Lets customers sign up for news about seasonal bakes."')
    .done();
  // …Maya opened one for online orders, with a broken link
  const maya = new Scenario(withGitHub(team, you))
    .run("git switch -c maya/order-page")
    .commit("Add online ordering page", { "order.html": ORDER_PAGE, "index.html": INDEX + '<a href="order.htm">Order online</a>\n' }, "Maya")
    .run("git push -u origin maya/order-page")
    .done();
  return patchHost(withGitHub(you, maya), (h) => ({
    pulls: [
      // …and Maya changed her mind about yours
      ...(h.pulls ?? []).map((p) => (p.number === 1 ? { ...p, reviews: [...p.reviews, { author: "Maya", state: "changes_requested" as const, body: MAYA_REVIEW }] } : p)),
      {
        number: 2,
        title: "Add online ordering page",
        body: "Customers can now order the day before. Linked from the homepage.",
        author: "Maya",
        head: "maya/order-page",
        base: "main",
        headCommit: h.branches["maya/order-page"],
        state: "open",
        reviews: [],
      },
    ],
    nextNumber: 3,
  }));
};

const latestReview = (p: PullRequest | undefined, author: string) =>
  [...(p?.reviews ?? [])].reverse().find((r) => r.author === author && r.state !== "commented");

const FB_NOT_PUSHED_FIX = "Your fix is committed, but only on your computer. Push it so the pull request updates: git push.";
const FB_WRONG_BRANCH = "You're not on feature/newsletter. The fix has to land on the branch of your pull request: git switch feature/newsletter.";
const FB_NEW_PR = "No need for a new pull request: pushing to feature/newsletter updates pull request #1 by itself.";

const codeReview: Lesson = {
  id: "code-review",
  chapterId: CHAPTER,
  title: "Code review",
  tagline: "read, request changes, address feedback",
  xp: 200,
  concepts: ["code review", "request changes", "approval", "updating a pull request"],
  commands: ["gh pr list", "gh pr diff <n>", "gh pr checkout <n>", 'gh pr review <n> --request-changes -b "…"', "gh pr review <n> --approve", "gh pr view <n>"],
  ui: PR_UI,
  setup: codeReviewSetup,
  recap: [
    "gh pr diff <n> shows exactly what a pull request changes; gh pr checkout <n> brings its branch to your computer.",
    "gh pr review can --approve, --request-changes or --comment. A good review is specific and kind: what's wrong, why it matters, what to do.",
    "You can't approve your own pull request. Someone else has to.",
    "To address feedback, commit on the same branch and push: the pull request updates by itself.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Four eyes see more than two",
      body: [
        "Before a pull request is merged, a teammate reviews it: they read the diff, ask questions, and either approve it or request changes.",
        "Reviews catch bugs, but they also spread knowledge: after a review, two people understand the change.",
        "Today you're on both sides. Maya opened a pull request you need to review, and she asked for changes on yours.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "What's waiting for review?",
      body: "List the open pull requests. The GitHub tab shows them too.",
      command: "gh pr list",
      check: (_w, _s, ran) => ran.includes("gh pr"),
      success: "Two open pull requests: #1 is yours, #2 is Maya's “Add online ordering page”.",
    },
    {
      kind: "try",
      title: "Read Maya's change",
      body: "gh pr diff shows what a pull request would change, line by line. Read it carefully: is anything off?",
      command: "gh pr diff 2",
      check: (_w, _s, ran) => ran.includes("gh pr"),
      success: "Spotted it? Maya's link goes to “order.htm”, but her new file is order.html. That link would be broken. (To try a branch for real, gh pr checkout 2 downloads it and switches to it.)",
    },
    {
      kind: "try",
      title: "Request changes",
      body: "Tell Maya what's wrong, why it matters, and what to do. Be specific and kind: you're reviewing the code, not the person.",
      command: `gh pr review 2 --request-changes -b "${REVIEW_BODY}"`,
      check: (w) => {
        const r = latestReview(pr(w, 2), w.user.name);
        return r?.state === "changes_requested" && r.body.trim().length > 0;
      },
      success: "“Requested changes to pull request #2”. Its merge is now blocked until Maya pushes a fix and the review is cleared. Check the GitHub tab.",
    },
    {
      kind: "try",
      title: "Now read your own reviews",
      body: "Maya reviewed your pull request too. Look at it.",
      command: "gh pr view 1",
      check: (_w, _s, ran) => ran.includes("gh pr"),
      success: "Maya first approved, then requested changes: the button says “Subcribe”. Her latest review is the one that counts, so your PR is blocked until you fix it.",
    },
    {
      kind: "challenge",
      title: "Challenge: address Maya's review",
      body: "Fix the typo in newsletter.html on your branch feature/newsletter, commit, and push. Don't open a new pull request: pushing to the same branch updates #1. Maya will take another look.",
      objectives: [
        {
          id: "fixed",
          label: "Commit the fixed button text on feature/newsletter",
          check: (w) => {
            const id = w.repo?.branches["feature/newsletter"];
            const html = id ? w.repo!.commits[id].tree["newsletter.html"] : undefined;
            return !!html && html.includes("Subscribe") && !html.includes("Subcribe");
          },
          hints: [
            "Edit the file on the branch of your pull request, then commit.",
            "In the Files panel, click newsletter.html and change Subcribe to Subscribe. Then git commit -am.",
            'Fix the button text in newsletter.html, then type: git commit -am "Fix typo in subscribe button"',
          ],
        },
        {
          id: "pushed",
          label: "Push it, so pull request #1 updates",
          check: (w, s) => {
            const tip = w.repo?.branches["feature/newsletter"];
            return !!tip && tip !== s.repo?.branches["feature/newsletter"] && pr(w, 1)?.headCommit === tip && host(w)?.branches["feature/newsletter"] === tip;
          },
          hints: ["A pull request follows its branch on GitHub.", "Your branch already has an upstream.", "Type: git push"],
        },
        {
          id: "approved",
          label: "Maya approves your pull request again",
          check: (w, s) => latestReview(pr(w, 1), "Maya")?.state === "approved" && (pr(w, 1)?.reviews.length ?? 0) > (pr(s, 1)?.reviews.length ?? 0),
          hints: ["Maya re-reviews when you push a fix.", "Push your fixed commit to feature/newsletter.", "Fix the file, git commit -am \"Fix typo\", then git push"],
        },
      ],
      feedback: (w, s) => {
        if (!w.repo) return null;
        if (pulls(w).length > pulls(s).length) return FB_NEW_PR;
        const b = currentBranch(w.repo);
        if (b !== "feature/newsletter" && w.repo.branches[b ?? ""] !== s.repo?.branches[b ?? ""]) return FB_WRONG_BRANCH;
        const tip = w.repo.branches["feature/newsletter"];
        if (tip && tip !== s.repo?.branches["feature/newsletter"] && host(w)?.branches["feature/newsletter"] !== tip) return FB_NOT_PUSHED_FIX;
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Lesson 3 — Merge strategies

const mergeStrategiesSetup = (): World => {
  const team = bakeryTeam().done();
  const you = cloneOf(team);
  const mates = new Scenario(withGitHub(team, you))
    .run("git switch -c sam/homepage")
    .commit("Add a welcome banner", { "index.html": "<div class=\"banner\">Warm bread, warm hearts</div>\n" + INDEX }, "Sam")
    .commit("Add homepage footer", { "index.html": "<div class=\"banner\">Warm bread, warm hearts</div>\n" + INDEX + "<footer>12 Baker Street</footer>\n" }, "Sam")
    .run("git push -u origin sam/homepage", "git switch main", "git switch -c maya/cakes")
    .commit("Start cakes page", { "cakes.html": "<h1>Cakes</h1>\n" }, "Maya")
    .commit("wip", { "cakes.html": "<h1>Cakes</h1>\n<li>Lemon tart</li>\n" }, "Maya")
    .commit("fix typo", { "cakes.html": "<h1>Cakes</h1>\n<ul>\n  <li>Lemon tart</li>\n</ul>\n" }, "Maya")
    .run("git push -u origin maya/cakes", "git switch main", "git switch -c sam/gallery")
    .commit("Add photo gallery", { "gallery.html": "<h1>Gallery</h1>\n<img src=\"bread.jpg\">\n" }, "Sam")
    .commit("Link gallery from the menu", { "menu.html": MENU + '<a href="gallery.html">See our bakes</a>\n' }, "Sam")
    .run("git push -u origin sam/gallery")
    .done();
  const approved = [{ author: "You", state: "approved" as const, body: "Looks good!" }];
  return patchHost(withGitHub(you, mates), (h) => ({
    pulls: [
      { number: 1, title: "Homepage banner and footer", body: "A welcoming banner, and our address in the footer.", author: "Sam", head: "sam/homepage", base: "main", headCommit: h.branches["sam/homepage"], state: "open", reviews: approved },
      { number: 2, title: "Add cakes page", body: "Our cakes deserve their own page.", author: "Maya", head: "maya/cakes", base: "main", headCommit: h.branches["maya/cakes"], state: "open", reviews: approved },
      { number: 3, title: "Add photo gallery", body: "Photos of our bakes, linked from the menu.", author: "Sam", head: "sam/gallery", base: "main", headCommit: h.branches["sam/gallery"], state: "open", reviews: approved },
    ],
    nextNumber: 4,
  }));
};

const mergedWith = (w: World, n: number, how: PullRequest["mergedWith"]) => pr(w, n)?.state === "merged" && pr(w, n)?.mergedWith === how;
const FB_WRONG_STRATEGY = /^Pull request #(\d) was merged with --(\w+), not --(\w+)\./;
const wrongStrategy = (n: number, used: string, wanted: string) =>
  `Pull request #${n} was merged with --${used}, not --${wanted}. A merge can't be undone on GitHub here: restart the lesson to try again.`;
const FB_PULL = "GitHub's main moved, but your local main didn't. Bring it home: git pull.";

const mergeStrategies: Lesson = {
  id: "merge-strategies",
  chapterId: CHAPTER,
  title: "Merge, squash or rebase",
  tagline: "three ways to land a pull request",
  xp: 200,
  concepts: ["merge commit", "squash merge", "rebase merge", "linear history"],
  commands: ["gh pr merge <n> --merge", "gh pr merge <n> --squash", "gh pr merge <n> --rebase", "git pull", "git log --oneline --graph"],
  ui: PR_UI,
  setup: mergeStrategiesSetup,
  recap: [
    "--merge keeps every commit and adds a merge commit: full history, with a visible “this came from a PR” bubble.",
    "--squash folds the whole branch into one commit on main: tidy history, ideal for messy “wip” branches.",
    "--rebase replays each commit on top of main: a straight line that keeps every commit.",
    "GitHub merges on GitHub only. git pull brings the result to your computer.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Three buttons, three histories",
      body: [
        "When a pull request is approved, someone presses Merge. GitHub offers three ways to do it, and each one leaves a different history on main.",
        "Merge commit: keeps every commit of the branch and ties it in with a merge commit. Squash: turns the whole branch into one single commit. Rebase: copies each commit, one by one, on top of main, in a straight line.",
        "You're the maintainer today. Three teammates' pull requests are approved and waiting for you.",
      ],
      scene: "three-way",
    },
    {
      kind: "try",
      title: "See what's ready",
      body: "List the open pull requests. In the GitHub tab, open each one to see its commits.",
      command: "gh pr list",
      check: (_w, _s, ran) => ran.includes("gh pr"),
      success: "Three approved pull requests, all waiting on you. In the GitHub tab: #1 and #3 have two clean commits each, #2 has three, two of them “wip” and “fix typo”.",
    },
    {
      kind: "try",
      title: "Merge #1 with a merge commit",
      body: "Sam's homepage work is a real feature with two meaningful commits. Keep them, and record that they arrived together.",
      command: "gh pr merge 1 --merge",
      check: (w) => mergedWith(w, 1, "merge"),
      success: "“✓ Merged pull request #1”. GitHub added a merge commit, “Merge pull request #1 from gitverse-team/sam/homepage”, with two parents: main and Sam's branch.",
    },
    {
      kind: "try",
      title: "Bring it home",
      body: "The merge happened on GitHub. Your computer doesn't know yet: pull it.",
      command: "git pull",
      check: (w) => localSynced(w),
      success: "Your main fast-forwarded to GitHub's main, merge commit included.",
    },
    {
      kind: "try",
      title: "Look at the shape",
      body: "Draw the history as a graph.",
      command: "git log --oneline --graph",
      check: (_w, _s, ran) => ran.includes("log"),
      success: "See the bubble? Sam's two commits sit on a side line, joined back by the merge commit at the top.",
    },
    {
      kind: "challenge",
      title: "Challenge: squash one, rebase the other",
      body: "Merge Maya's #2 with --squash (nobody needs “wip” and “fix typo” on main), then Sam's #3 with --rebase (two clean commits, kept in a straight line). Finally sync your local main and compare the graph.",
      objectives: [
        {
          id: "squash",
          label: "Squash-merge #2: the cakes page lands as one commit",
          check: (w) => mergedWith(w, 2, "squash") && hostedTree(w)["cakes.html"] !== undefined,
          hints: ["Squash turns a messy branch into one clean commit.", "gh pr merge 2 with the squash strategy.", "Type: gh pr merge 2 --squash"],
        },
        {
          id: "rebase",
          label: "Rebase-merge #3: the gallery commits are replayed on main",
          check: (w) => mergedWith(w, 3, "rebase") && hostedTree(w)["gallery.html"] !== undefined,
          hints: ["Rebase copies each commit on top of main, without a merge commit.", "gh pr merge 3 with the rebase strategy.", "Type: gh pr merge 3 --rebase"],
        },
        {
          id: "synced",
          label: "Your local main matches GitHub's main",
          check: (w) => mergedWith(w, 2, "squash") && mergedWith(w, 3, "rebase") && localSynced(w) && c.onBranch(w, "main"),
          hints: ["GitHub merged; your computer still has the old main.", "Pull on main.", "Type: git pull, then git log --oneline --graph"],
        },
      ],
      feedback: (w) => {
        for (const [n, wanted] of [[2, "squash"], [3, "rebase"]] as const) {
          const p = pr(w, n);
          if (p?.state === "merged" && p.mergedWith !== wanted) return wrongStrategy(n, p.mergedWith ?? "merge", wanted);
        }
        if (pr(w, 2)?.state === "merged" && pr(w, 3)?.state === "merged" && !localSynced(w)) return FB_PULL;
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Lesson 4 — Protected branches (boss)

const HOURS_MONDAY = "<p>Open 7am–6pm, Monday to Sunday.</p>\n";
const HOURS_CLOSED_MONDAY = "<p>Open 7am–6pm, Tuesday to Sunday. Closed on Mondays.</p>\n";
export const FIX_MSG = "Say we're closed on Mondays";
const FIX_BRANCH = "fix/closed-mondays";

const protectionSetup = (): World => {
  const team = bakeryTeam().commit("Add opening hours", { "index.html": INDEX + HOURS_MONDAY }, "Maya").run("git push").done();
  const you = new Scenario(cloneOf(team)).commit(FIX_MSG, { "index.html": INDEX + HOURS_CLOSED_MONDAY }).done();
  return patchHost(you, () => ({
    protection: { main: { requirePullRequest: true, requiredApprovals: 1, requiredChecks: [] } },
    autoReviewers: ["Maya"],
  }));
};

/** The commit you made on main in the setup. */
const fixCommit = (s: World) => s.repo?.branches.main;
const fixPr = (w: World) => pulls(w).find((p) => p.head === FIX_BRANCH) ?? pulls(w).find((p) => p.author === w.user.name);

const FB_PULLED_MERGE =
  "git pull merged your old copy of the fix with GitHub's squashed one, so your main has an extra merge commit GitHub will never have. Throw it away: git reset --hard origin/main.";
const FB_STALE_MAIN = "Your main still carries the original commit GitHub refused. GitHub already has the squashed copy: git fetch, then git reset --hard origin/main.";
const FB_NOT_SQUASH = "The pull request was merged, but not with --squash. This team squashes every PR: restart the lesson to try again.";

const branchProtection: Lesson = {
  id: "branch-protection",
  chapterId: CHAPTER,
  title: "Protected branches",
  tagline: "rescue a commit that main refuses",
  xp: 300,
  boss: true,
  concepts: ["branch protection", "required reviews", "squash merge", "reset to origin"],
  commands: ["git push", "git switch -c", "git push -u origin <branch>", "gh pr create", "gh pr merge --squash -d", "git fetch", "git reset --hard origin/main"],
  ui: PR_UI,
  setup: protectionSetup,
  recap: [
    "A protected main refuses direct pushes (GH006): every change must go through a reviewed pull request.",
    "Committed on main by mistake? git switch -c <branch> takes the commit with you onto a new branch. Push it and open a PR.",
    "After a squash merge, GitHub's main has a new copy of your work, not your commit. Your local main has diverged.",
    "git fetch, then git reset --hard origin/main makes your main exactly GitHub's again. Safe here, because your work is already on GitHub.",
  ],
  steps: [
    {
      kind: "discover",
      title: "The rule nobody can skip",
      body: [
        "Teams protect main on GitHub: direct pushes are refused, and every change must come through a pull request with at least one approval.",
        "It isn't about trust. It guarantees that two people have seen every line that reaches main, and that main always works.",
        "This morning you fixed the opening hours (the bakery is closed on Mondays) and committed straight on main. Out of habit. Let's see what GitHub thinks.",
      ],
      scene: "remote",
    },
    {
      kind: "experiment",
      title: "Try to push",
      body: "Run git push and read GitHub's answer. Then git status: your commit is still there, just not on GitHub.",
      ideas: ["git push", "git status", "git log --oneline"],
    },
    {
      kind: "try",
      title: "Move the commit onto a branch",
      body: "“GH006: Protected branch update failed”: main only accepts pull requests. Create a branch right here: it starts at your commit, so the commit comes along.",
      command: `git switch -c ${FIX_BRANCH}`,
      check: (w, s) => c.onBranch(w, FIX_BRANCH) && c.branchContains(w, FIX_BRANCH, fixCommit(s)),
      success: "You're on fix/closed-mondays, and your commit is on it. Your local main still points at it too: you'll tidy that up at the end.",
    },
    {
      kind: "try",
      title: "Push the branch",
      body: "Branches other than main aren't protected. Publish yours.",
      command: `git push -u origin ${FIX_BRANCH}`,
      check: (w) => !!w.repo?.branches[FIX_BRANCH] && host(w)?.branches[FIX_BRANCH] === w.repo.branches[FIX_BRANCH],
      success: "Accepted. Your fix is on GitHub, on its own branch.",
    },
    {
      kind: "challenge",
      title: "Boss: land the fix the proper way",
      body: "Open a pull request for fix/closed-mondays. Once Maya approves, squash-merge it and delete the branch (gh pr merge --squash -d). Then get your local main in sync. Careful: your main still has the original commit, while GitHub's main now has a squashed copy of it. They've diverged (git status says so after a fetch), so git pull would try to combine two versions of the same fix: real Git even stops and asks you to choose. Ignore gh's “git pull” tip this time. Instead, git fetch, then git reset --hard origin/main: your main becomes exactly GitHub's. Nothing is lost, your fix is already in it.",
      objectives: [
        {
          id: "pr",
          label: "Open a pull request from fix/closed-mondays",
          check: (w) => pulls(w).some((p) => p.head === FIX_BRANCH),
          hints: ["Ask to merge your branch into main.", 'gh pr create --title "…" while on your branch.', 'Type: gh pr create --title "Say we\'re closed on Mondays" --body "We close on Mondays, the site said we were open."'],
        },
        {
          id: "merged",
          label: "Squash-merge it after Maya's approval, and delete the branch",
          check: (w) => {
            const p = fixPr(w);
            return p?.state === "merged" && p.mergedWith === "squash" && !host(w)?.branches[p.head];
          },
          hints: [
            "Maya approves new pull requests right away. Check the GitHub tab, then merge.",
            "gh pr merge with --squash, and -d to delete the branch.",
            "Type: gh pr merge --squash -d",
          ],
        },
        {
          id: "synced",
          label: "Your local main is exactly GitHub's main",
          check: (w) => fixPr(w)?.state === "merged" && c.onBranch(w, "main") && localSynced(w) && c.clean(w) && hostedTree(w)["index.html"]?.includes("Closed on Mondays") === true,
          hints: [
            "Your main and GitHub's main diverged: drop your local copy and take GitHub's.",
            "git fetch updates origin/main; git reset --hard origin/main moves main there.",
            "Type: git switch main (if needed), git fetch, then git reset --hard origin/main",
          ],
        },
      ],
      feedback: (w, s) => {
        if (!w.repo) return null;
        const p = fixPr(w);
        if (!p) return null;
        if (p.state === "merged" && p.mergedWith !== "squash") return FB_NOT_SQUASH;
        if (p.state !== "merged" || localSynced(w) || !c.onBranch(w, "main")) return null;
        const main = w.repo.branches.main;
        const behind = w.repo.remoteRefs["origin/main"];
        if ((w.repo.commits[main]?.parents.length ?? 0) > 1 && behind && ancestors(w.repo, main).has(behind)) return FB_PULLED_MERGE;
        if (headCommit(w.repo)?.id === fixCommit(s)) return FB_STALE_MAIN;
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

export const PR_LESSONS: Lesson[] = [createPr, codeReview, mergeStrategies, branchProtection];

// ───────────────────────────────────────────── French


// ───────────────────────────────────────────── French

export const PR_FR: Record<string, LessonText> = {
  "create-pr": {
    title: "Ouvrir une pull request",
    tagline: "branche, push, gh pr create",
    concepts: ["pull request", "branches head et base", "la CLI gh"],
    recap: [
      "Une pull request (PR) demande à l'équipe de fusionner ta branche dans main, et donne à tout le monde un endroit pour en discuter avant.",
      "La recette : une branche, un commit, git push -u origin <branche>, puis gh pr create.",
      "La base, c'est là où le travail doit aller (main) ; la head, c'est la branche qui le porte.",
      "Un changement par branche, une branche par PR, et une description qui explique pourquoi.",
    ],
    steps: [
      {
        title: "Demander avant de fusionner",
        body: [
          "Tu viens de rejoindre l'équipe du site de la boulangerie Rosie's Bakery. Tu l'as déjà cloné : les fichiers sont sur ton ordinateur.",
          "Dans une équipe, personne ne fusionne dans main tout seul. Tu pousses une branche, puis tu ouvres une pull request : une demande de fusion de cette branche dans main.",
          "Une pull request, c'est aussi une conversation. Tes coéquipiers lisent ton changement, le commentent et l'approuvent avant qu'il n'arrive dans main. Tu vas tout faire depuis le terminal avec gh, l'outil en ligne de commande de GitHub.",
        ],
      },
      {
        title: "Crée une branche pour ton changement",
        body: "Les clients demandent sans arrêt à quelle heure la boulangerie ouvre. Crée une branche pour ce changement, pour que main reste intact.",
        success: "Tu es sur feature/opening-hours. Tout ce que tu commites maintenant reste en dehors de main tant que l'équipe n'est pas d'accord.",
      },
      {
        title: "Ajoute les horaires",
        body: "Dans le panneau Fichiers, clique sur index.html pour l'ouvrir et ajoute une ligne avec les horaires d'ouverture, ou utilise le bouton ci-dessous.",
        actionLabel: "Ajouter les horaires dans index.html",
        success: "index.html a changé dans ton dossier de travail. Enregistre-le maintenant dans un commit.",
      },
      {
        title: "Commite-le",
        body: "-a indexe tous les fichiers que Git suit déjà, donc une seule commande suffit ici.",
        success: "Ta branche a un commit d'avance sur main. Pour l'instant, seul ton ordinateur le connaît.",
      },
      {
        title: "Publie la branche",
        body: "Une pull request se crée à partir d'une branche qui est sur GitHub. Pousse la tienne, avec -u pour que Git retienne où elle va.",
        success: "GitHub a ta branche maintenant : « * [new branch] feature/opening-hours -> feature/opening-hours ».",
      },
      {
        title: "Ouvre la pull request",
        body: "Demande à fusionner ta branche dans main. Le titre dit ce qui change, la description dit pourquoi. Regarde l'onglet GitHub pendant que tu la lances.",
        success: "La pull request #1 est ouverte : feature/opening-hours vers main. Maya a été rapide et l'a déjà approuvée. Regarde l'onglet GitHub.",
      },
      {
        title: "Lis ta pull request",
        body: "gh pr view affiche la pull request de la branche où tu te trouves : son titre, sa description, ses reviews et si elle peut être fusionnée.",
        success: "« main <- feature/opening-hours » : main est la base (là où va le travail), ta branche est la head. L'approbation de Maya est listée, et la PR est prête à être fusionnée (« Ready to merge »).",
      },
      {
        title: "Défi : une deuxième pull request",
        body: "Rosie veut une page de contact. Ouvre une pull request séparée pour ça : une nouvelle branche qui part de main (pas de feature/opening-hours), un commit avec contact.html, la branche poussée, et une PR dont la description explique le changement.",
        objectives: [
          {
            label: "Commite contact.html sur une nouvelle branche qui part de main",
            hints: [
              "Un changement par pull request. Pars de main pour la nouvelle branche, pour qu'elle n'embarque pas les horaires.",
              "git switch main, puis git switch -c avec un nouveau nom. Crée contact.html, ajoute-le, commite.",
              'Tape : git switch main, puis git switch -c feature/contact, puis echo "<h1>Contact</h1>" > contact.html && git add contact.html && git commit -m "Add contact page"',
            ],
          },
          {
            label: "Pousse la nouvelle branche sur GitHub",
            hints: [
              "GitHub a besoin de la branche avant qu'on puisse en faire une PR.",
              "git push -u origin <ta branche>",
              "Tape : git push -u origin feature/contact",
            ],
          },
          {
            label: "Ouvre une pull request avec une description qui explique le changement",
            hints: [
              "Une bonne description dit aux relecteurs pourquoi le changement existe, pas seulement ce qu'il est.",
              'gh pr create --title "…" --body "…"',
              'Tape : gh pr create --title "Add contact page" --body "Customers want to call us, so this adds our phone number."',
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [FB_FROM_FEATURE, "Ta nouvelle branche part de feature/opening-hours, donc sa pull request embarquerait aussi le commit des horaires. Reviens avec git switch main et crée la branche à partir de là."],
      [FB_NO_BODY, "Ta pull request n'a pas de description. Ferme-la (gh pr close <numéro>), puis rouvre-en une avec --body \"…\" qui explique ce qui change et pourquoi."],
      [FB_NOT_PUSHED, "Ta branche n'existe que sur ton ordinateur. Pousse-la d'abord : git push -u origin <branche>."],
    ],
  },
  "code-review": {
    title: "La revue de code",
    tagline: "lire, demander des changements, y répondre",
    concepts: ["revue de code", "demander des changements", "approbation", "mettre à jour une pull request"],
    recap: [
      "gh pr diff <n> montre exactement ce que change une pull request ; gh pr checkout <n> ramène sa branche sur ton ordinateur.",
      "gh pr review peut faire --approve, --request-changes ou --comment. Une bonne review est précise et bienveillante : ce qui ne va pas, pourquoi c'est important, quoi faire.",
      "Tu ne peux pas approuver ta propre pull request. Quelqu'un d'autre doit le faire.",
      "Pour répondre à une review, commite sur la même branche et pousse : la pull request se met à jour toute seule.",
    ],
    steps: [
      {
        title: "Quatre yeux valent mieux que deux",
        body: [
          "Avant qu'une pull request soit fusionnée, un coéquipier la relit : il lit le diff, pose des questions, puis l'approuve ou demande des changements.",
          "Les reviews attrapent des bugs, mais elles partagent aussi le savoir : après une review, deux personnes comprennent le changement.",
          "Aujourd'hui, tu es des deux côtés. Maya a ouvert une pull request que tu dois relire, et elle a demandé des changements sur la tienne.",
        ],
      },
      {
        title: "Qu'est-ce qui attend une review ?",
        body: "Liste les pull requests ouvertes. L'onglet GitHub les montre aussi.",
        success: "Deux pull requests ouvertes : la #1 est la tienne, la #2 est « Add online ordering page » de Maya.",
      },
      {
        title: "Lis le changement de Maya",
        body: "gh pr diff montre ce qu'une pull request changerait, ligne par ligne. Lis attentivement : quelque chose cloche ?",
        success: "Tu l'as vu ? Le lien de Maya pointe vers « order.htm », mais son nouveau fichier s'appelle order.html. Ce lien serait cassé. (Pour essayer une branche pour de vrai, gh pr checkout 2 la télécharge et bascule dessus.)",
      },
      {
        title: "Demande des changements",
        body: "Dis à Maya ce qui ne va pas, pourquoi c'est important, et quoi faire. Sois précis et bienveillant : tu relis le code, pas la personne. (Le texte de la review est en anglais, comme souvent dans les équipes.)",
        success: "« Requested changes to pull request #2 » (changements demandés sur la pull request #2). Sa fusion est maintenant bloquée jusqu'à ce que Maya pousse une correction et que la review soit levée. Regarde l'onglet GitHub.",
      },
      {
        title: "Lis maintenant tes propres reviews",
        body: "Maya a aussi relu ta pull request. Jette un œil.",
        success: "Maya a d'abord approuvé, puis demandé des changements : le bouton dit « Subcribe ». C'est sa dernière review qui compte, donc ta PR est bloquée tant que tu ne corriges pas.",
      },
      {
        title: "Défi : réponds à la review de Maya",
        body: "Corrige la faute dans newsletter.html sur ta branche feature/newsletter, commite et pousse. N'ouvre pas de nouvelle pull request : pousser sur la même branche met à jour la #1. Maya y jettera un nouveau coup d'œil.",
        objectives: [
          {
            label: "Commite le texte corrigé du bouton sur feature/newsletter",
            hints: [
              "Modifie le fichier sur la branche de ta pull request, puis commite.",
              "Dans le panneau Fichiers, clique sur newsletter.html et remplace Subcribe par Subscribe. Puis git commit -am.",
              'Corrige le texte du bouton dans newsletter.html, puis tape : git commit -am "Fix typo in subscribe button"',
            ],
          },
          {
            label: "Pousse-le, pour que la pull request #1 se mette à jour",
            hints: ["Une pull request suit sa branche sur GitHub.", "Ta branche a déjà un upstream.", "Tape : git push"],
          },
          {
            label: "Maya approuve à nouveau ta pull request",
            hints: [
              "Maya relit quand tu pousses une correction.",
              "Pousse ton commit corrigé sur feature/newsletter.",
              'Corrige le fichier, git commit -am "Fix typo", puis git push',
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [FB_NOT_PUSHED_FIX, "Ta correction est commitée, mais seulement sur ton ordinateur. Pousse-la pour que la pull request se mette à jour : git push."],
      [FB_WRONG_BRANCH, "Tu n'es pas sur feature/newsletter. La correction doit arriver sur la branche de ta pull request : git switch feature/newsletter."],
      [FB_NEW_PR, "Pas besoin d'une nouvelle pull request : pousser sur feature/newsletter met à jour la pull request #1 toute seule."],
    ],
  },
  "merge-strategies": {
    title: "Merge, squash ou rebase",
    tagline: "trois façons de fusionner une pull request",
    concepts: ["commit de fusion", "squash merge", "rebase merge", "historique linéaire"],
    recap: [
      "--merge garde chaque commit et ajoute un commit de fusion : l'historique complet, avec une « bulle » visible qui dit « ça vient d'une PR ».",
      "--squash replie toute la branche en un seul commit sur main : un historique propre, idéal pour les branches pleines de « wip ».",
      "--rebase rejoue chaque commit au-dessus de main : une ligne droite qui garde tous les commits.",
      "GitHub fusionne sur GitHub uniquement. git pull ramène le résultat sur ton ordinateur.",
    ],
    steps: [
      {
        title: "Trois boutons, trois historiques",
        body: [
          "Quand une pull request est approuvée, quelqu'un appuie sur Merge. GitHub propose trois façons de le faire, et chacune laisse un historique différent sur main.",
          "Merge commit : garde chaque commit de la branche et la raccroche avec un commit de fusion. Squash : transforme toute la branche en un seul commit. Rebase : copie chaque commit, un par un, au-dessus de main, en ligne droite.",
          "Aujourd'hui, c'est toi la mainteneuse ou le mainteneur. Trois pull requests de tes coéquipiers sont approuvées et t'attendent.",
        ],
      },
      {
        title: "Regarde ce qui est prêt",
        body: "Liste les pull requests ouvertes. Dans l'onglet GitHub, ouvre chacune pour voir ses commits.",
        success: "Trois pull requests approuvées, qui n'attendent que toi. Dans l'onglet GitHub : la #1 et la #3 ont deux commits propres chacune, la #2 en a trois, dont « wip » et « fix typo ».",
      },
      {
        title: "Fusionne la #1 avec un commit de fusion",
        body: "Le travail de Sam sur la page d'accueil est une vraie fonctionnalité, avec deux commits qui ont du sens. Garde-les, et note qu'ils sont arrivés ensemble.",
        success: "« ✓ Merged pull request #1 » (pull request #1 fusionnée). GitHub a ajouté un commit de fusion, « Merge pull request #1 from gitverse-team/sam/homepage », avec deux parents : main et la branche de Sam.",
      },
      {
        title: "Ramène-le chez toi",
        body: "La fusion a eu lieu sur GitHub. Ton ordinateur ne le sait pas encore : fais un pull.",
        success: "Ton main a avancé en fast-forward jusqu'au main de GitHub, commit de fusion compris.",
      },
      {
        title: "Regarde la forme",
        body: "Dessine l'historique sous forme de graphe.",
        success: "Tu vois la bulle ? Les deux commits de Sam sont sur une ligne à part, rattachés par le commit de fusion tout en haut.",
      },
      {
        title: "Défi : un squash, un rebase",
        body: "Fusionne la #2 de Maya avec --squash (personne n'a besoin de « wip » et « fix typo » sur main), puis la #3 de Sam avec --rebase (deux commits propres, gardés en ligne droite). Enfin, synchronise ton main local et compare le graphe.",
        objectives: [
          {
            label: "Squash-merge la #2 : la page des gâteaux arrive en un seul commit",
            hints: ["Le squash transforme une branche brouillonne en un seul commit propre.", "gh pr merge 2 avec la stratégie squash.", "Tape : gh pr merge 2 --squash"],
          },
          {
            label: "Rebase-merge la #3 : les commits de la galerie sont rejoués sur main",
            hints: ["Le rebase copie chaque commit au-dessus de main, sans commit de fusion.", "gh pr merge 3 avec la stratégie rebase.", "Tape : gh pr merge 3 --rebase"],
          },
          {
            label: "Ton main local correspond au main de GitHub",
            hints: ["GitHub a fusionné ; ton ordinateur a encore l'ancien main.", "Fais un pull sur main.", "Tape : git pull, puis git log --oneline --graph"],
          },
        ],
      },
      null,
    ],
    feedback: [
      [FB_WRONG_STRATEGY, "La pull request #$1 a été fusionnée avec --$2, pas --$3. Une fusion ne peut pas être annulée sur GitHub ici : recommence la leçon pour réessayer."],
      [FB_PULL, "Le main de GitHub a avancé, mais pas ton main local. Ramène-le : git pull."],
    ],
  },
  "branch-protection": {
    title: "Les branches protégées",
    tagline: "sauver un commit que main refuse",
    concepts: ["protection de branche", "reviews obligatoires", "squash merge", "reset sur origin"],
    recap: [
      "Un main protégé refuse les push directs (GH006) : chaque changement doit passer par une pull request relue.",
      "Tu as commité sur main par erreur ? git switch -c <branche> emmène le commit avec toi sur une nouvelle branche. Pousse-la et ouvre une PR.",
      "Après un squash merge, le main de GitHub contient une nouvelle copie de ton travail, pas ton commit. Ton main local a divergé.",
      "git fetch, puis git reset --hard origin/main, rend ton main identique à celui de GitHub. Sans risque ici, car ton travail est déjà sur GitHub.",
    ],
    steps: [
      {
        title: "La règle que personne ne contourne",
        body: [
          "Les équipes protègent main sur GitHub : les push directs sont refusés, et chaque changement doit arriver par une pull request avec au moins une approbation.",
          "Ce n'est pas une question de confiance. Ça garantit que deux personnes ont vu chaque ligne qui arrive dans main, et que main fonctionne toujours.",
          "Ce matin, tu as corrigé les horaires (la boulangerie est fermée le lundi) et tu as commité directement sur main. Par habitude. Voyons ce qu'en pense GitHub.",
        ],
      },
      {
        title: "Essaie de pousser",
        body: "Lance git push et lis la réponse de GitHub. Puis git status : ton commit est toujours là, simplement pas sur GitHub.",
      },
      {
        title: "Déplace le commit sur une branche",
        body: "« GH006: Protected branch update failed » (échec de la mise à jour de la branche protégée) : main n'accepte que des pull requests. Crée une branche ici même : elle part de ton commit, donc le commit vient avec.",
        success: "Tu es sur fix/closed-mondays, et ton commit est dessus. Ton main local pointe encore dessus aussi : tu feras le ménage à la fin.",
      },
      {
        title: "Pousse la branche",
        body: "Les branches autres que main ne sont pas protégées. Publie la tienne.",
        success: "Accepté. Ta correction est sur GitHub, sur sa propre branche.",
      },
      {
        title: "Boss : fais passer la correction dans les règles",
        body: "Ouvre une pull request pour fix/closed-mondays. Une fois que Maya a approuvé, fusionne-la en squash et supprime la branche (gh pr merge --squash -d). Ensuite, resynchronise ton main local. Attention : ton main a encore le commit d'origine, alors que le main de GitHub en a maintenant une copie « squashée ». Ils ont divergé (git status le dit après un fetch), donc git pull essaierait de combiner deux versions de la même correction : le vrai Git s'arrête même pour te demander de choisir. Ignore le conseil « git pull » de gh cette fois. À la place : git fetch, puis git reset --hard origin/main. Ton main devient exactement celui de GitHub. Rien n'est perdu, ta correction est déjà dedans.",
        objectives: [
          {
            label: "Ouvre une pull request depuis fix/closed-mondays",
            hints: [
              "Demande à fusionner ta branche dans main.",
              'gh pr create --title "…" depuis ta branche.',
              'Tape : gh pr create --title "Say we\'re closed on Mondays" --body "We close on Mondays, the site said we were open."',
            ],
          },
          {
            label: "Fusionne-la en squash après l'approbation de Maya, et supprime la branche",
            hints: [
              "Maya approuve les nouvelles pull requests tout de suite. Vérifie l'onglet GitHub, puis fusionne.",
              "gh pr merge avec --squash, et -d pour supprimer la branche.",
              "Tape : gh pr merge --squash -d",
            ],
          },
          {
            label: "Ton main local est exactement le main de GitHub",
            hints: [
              "Ton main et celui de GitHub ont divergé : abandonne ta copie locale et prends celle de GitHub.",
              "git fetch met à jour origin/main ; git reset --hard origin/main y déplace main.",
              "Tape : git switch main (si besoin), git fetch, puis git reset --hard origin/main",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [FB_PULLED_MERGE, "git pull a fusionné ton ancienne copie de la correction avec la version squashée de GitHub : ton main a un commit de fusion en trop que GitHub n'aura jamais. Jette-le : git reset --hard origin/main."],
      [FB_STALE_MAIN, "Ton main contient encore le commit d'origine que GitHub a refusé. GitHub a déjà la copie squashée : git fetch, puis git reset --hard origin/main."],
      [FB_NOT_SQUASH, "La pull request a été fusionnée, mais pas avec --squash. Cette équipe squashe chaque PR : recommence la leçon pour réessayer."],
    ],
  },
};
