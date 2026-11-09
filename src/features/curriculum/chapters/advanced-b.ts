import { emptyWorld, shortId, status, type Commit, type World } from "@/engine";
import * as c from "../checks";
import type { LessonText } from "../localize";
import { Scenario, scenario } from "../scenario";
import type { Lesson } from "../types";

// Chapter 10 — Advanced Git, second half: bisect, .gitignore, hooks.
// All three lessons live in the same small shop, Pixel Plants.

const UI = { files: true, editor: true, stages: false, remote: false };

// ───────────────────────────────────────────── bisect

const PRICE_OK = "// Every price on the site includes 10% VAT\nexport function withTax(price) {\n  return price * 1.1;\n}\n";
const PRICE_BROKEN = "// Every price on the site includes 10% VAT\nexport const withTax = (price) => price * 0.1;\n";
const HOME = "<h1>Pixel Plants</h1>\n<button>Checkout</button>\n";
const CULPRIT = "Tidy up price helper";

/**
 * Twelve commits on main; v1.0 is tagged on the third. With bug "price", Sam's
 * innocent-looking “Tidy up price helper” turns `* 1.1` into `* 0.1`. With bug
 * "checkout" (the watch demo), “Add newsletter form” drops the checkout button.
 */
const shopHistory = (bug: "price" | "checkout"): World => {
  const home = (extra: string) => (bug === "checkout" ? "<h1>Pixel Plants</h1>\n" : HOME) + extra;
  return scenario()
    .run("git init")
    .commit(
      "Create shop homepage",
      {
        "index.html": HOME,
        "price.js": PRICE_OK,
        "package.json": JSON.stringify({ name: "pixel-plants", version: "1.0.0", scripts: { test: 'grep -q "1.1" price.js' } }, null, 2) + "\n",
      },
      "Maya",
    )
    .commit("Add plant catalog", { "products.js": "export const products = [\n  { name: 'Monstera', price: 20 },\n];\n" }, "Maya")
    .commit("Add cart page", { "cart.html": "<h1>Your cart</h1>\n" }, "Sam")
    .run("git tag v1.0")
    .commit("Add cactus to catalog", { "products.js": "export const products = [\n  { name: 'Monstera', price: 20 },\n  { name: 'Cactus', price: 8 },\n];\n" }, "Maya")
    .commit("Style the cart", { "style.css": "body {\n  font-family: sans-serif;\n}\n" }, "Sam")
    .commit("Add delivery info page", { "delivery.html": "<h1>Delivery</h1>\n<p>2 to 3 days.</p>\n" }, "Maya")
    .commit("Fix typo in cart title", { "cart.html": "<h1>Your basket</h1>\n" }, "Sam")
    .commit(CULPRIT, { "price.js": bug === "price" ? PRICE_BROKEN : "// Every price on the site includes 10% VAT\nexport const withTax = (price) => price * 1.1;\n" }, "Sam")
    .commit("Add newsletter form", { "index.html": home("<form>Get plant tips by email</form>\n") }, "Maya")
    .commit(
      "Add fern to catalog",
      { "products.js": "export const products = [\n  { name: 'Monstera', price: 20 },\n  { name: 'Cactus', price: 8 },\n  { name: 'Fern', price: 12 },\n];\n" },
      "Maya",
    )
    .commit("Update footer", { "index.html": home("<form>Get plant tips by email</form>\n<footer>© Pixel Plants</footer>\n") }, "Sam")
    .commit("Add gift cards page", { "gifts.html": "<h1>Gift cards</h1>\n" }, "Maya")
    .done();
};

/**
 * Git named the culprit. While bisecting that's BisectState.found; after
 * `git bisect reset` the state is gone, so we look for its footprint in the
 * reflog: HEAD went from the culprit straight back to main.
 */
const foundCulprit = (w: World) => {
  const id = c.findCommit(w, CULPRIT);
  if (!w.repo || !id) return false;
  if (w.repo.bisect) return w.repo.bisect.found === id;
  return c.visitedInReflog(w, id) && w.repo.reflog.some((e) => e.message === `checkout: moving from ${shortId(id)} to main`);
};

const bisect: Lesson = {
  id: "bisect",
  chapterId: "advanced",
  title: "Find a bug with bisect",
  tagline: "Binary search through your history",
  xp: 200,
  concepts: ["bisect", "good and bad commits", "binary search", "automated bisect"],
  commands: ["git bisect start", "git bisect bad", "git bisect good", "git bisect reset", "git bisect run"],
  ui: UI,
  setup: () => shopHistory("price"),
  recap: [
    "git bisect finds the commit that introduced a bug by halving the suspects at every step: 9 commits take 3 or 4 checks, 1,000 take about 10.",
    "Start with git bisect start, mark a commit with the bug (git bisect bad) and one without it (git bisect good v1.0).",
    "At each stop, test the code and answer git bisect good or git bisect bad. Git checks out the next commit for you.",
    "git bisect run <command> does the testing for you (exit 0 = good). Always finish with git bisect reset.",
  ],
  steps: [
    {
      kind: "discover",
      title: "“It worked last month!”",
      body: [
        "A customer writes in: a €20 Monstera costs €2 at checkout. Your shop is giving plants away. Version 1.0 was fine, and since then the team made 9 commits.",
        "You could check them one by one. Or you could play “higher or lower”: test the commit in the middle. If it's broken, the bug is in the older half; if it's fine, it's in the newer half. Every check cuts the suspects in half.",
        "That's what git bisect does. You tell it one bad commit and one good commit, and it walks you to the culprit in about 3 checks instead of 9.",
      ],
      scene: "history",
    },
    {
      kind: "try",
      title: "Start the search",
      body: "Run git log --oneline first if you'd like to see the 12 commits. Then tell Git you're starting a bisect.",
      command: "git bisect start",
      check: (w) => !!w.repo?.bisect,
      success: "“status: waiting for both good and bad commits”. Git is ready. It needs one commit that has the bug and one that doesn't.",
    },
    {
      kind: "try",
      title: "Mark today's code as bad",
      body: "The bug is on main right now, so the commit you're on is bad. With no commit named, git bisect bad means “HEAD”.",
      command: "git bisect bad",
      check: (w) => !!w.repo?.bisect?.bad,
      success: "“waiting for good commit(s), bad commit known”. One end of the search is pinned. Now the other end.",
    },
    {
      kind: "try",
      title: "Mark v1.0 as good",
      body: "Prices were right in version 1.0, and it has a tag, so you don't even need its ID. Mark it good.",
      command: "git bisect good v1.0",
      check: (w) => !!w.repo?.bisect?.bad && (w.repo.bisect.good.length ?? 0) > 0 && w.repo.head.kind === "detached",
      success:
        "“Bisecting: 4 revisions left to test after this (roughly 2 steps)”. Git jumped to “Fix typo in cart title”, halfway between the two. HEAD is detached there and your files now look exactly like that commit.",
      hint: "v1.0 is a tag. Type git bisect good v1.0",
    },
    {
      kind: "try",
      title: "Test this commit",
      body: "Is the price bug here? Look at price.js: in the Files panel, or with cat. A good version multiplies by 1.1 (adding 10% VAT).",
      command: "cat price.js",
      check: (_w, _s, ran) => ran.includes("cat"),
      success: "price * 1.1: prices are right in this commit, so it's good. The bug came later. You'll tell Git that in the challenge.",
    },
    {
      kind: "watch",
      title: "Let a script do the checking",
      body: "Checking by hand is fine for a few steps. When a command can tell good from bad, Git can run it for you. Here's the same shop with another bug: the Checkout button vanished from index.html.",
      setup: () => shopHistory("checkout"),
      frames: [
        { command: "git bisect start HEAD v1.0", caption: "Shortcut: give the bad commit and the good one right in the start command." },
        {
          command: "git bisect run grep -q Checkout index.html",
          caption: "At every stop, Git runs grep. It exits 0 when it finds “Checkout” (good) and 1 when it doesn't (bad). Git found “Add newsletter form” without a single question.",
        },
        { command: "git bisect reset", caption: "Done: reset puts you back on main. With a test suite, you'd write git bisect run npm test." },
      ],
    },
    {
      kind: "challenge",
      title: "Challenge: catch the culprit",
      body: "Finish the hunt you started. At each stop, check price.js and answer git bisect good or git bisect bad, until Git prints “is the first bad commit”. (git bisect run works too.) Then end the search and get back on main.",
      objectives: [
        {
          id: "found",
          label: "Git names the first bad commit",
          check: foundCulprit,
          hints: [
            "At each stop: price * 1.1 means good, anything else means bad. Git keeps halving until one commit is left.",
            "Run cat price.js, then git bisect good or git bisect bad, and repeat.",
            "You're on “Fix typo in cart title” and it's good: git bisect good. Then cat price.js on each new stop and answer. Or let Git do it: git bisect run npm test",
          ],
        },
        {
          id: "reset",
          label: "End the bisect and get back on main",
          check: (w) => foundCulprit(w) && !w.repo?.bisect && c.onBranch(w, "main"),
          hints: [
            "During a bisect, HEAD is detached on old commits. Git won't leave bisect mode until you tell it.",
            "One command ends the search and switches back to the branch you started from.",
            "Type: git bisect reset",
          ],
        },
      ],
      feedback: (w) => {
        const st = w.repo?.bisect;
        const culprit = c.findCommit(w, CULPRIT);
        if (st?.found && st.found !== culprit)
          return `Git blamed “${w.repo!.commits[st.found].message}”, but that commit isn't the one that broke price.js: one answer along the way was wrong. Start over with git bisect start, git bisect bad, git bisect good v1.0.`;
        if (st?.found) {
          if (c.onBranch(w, "main")) return "You're back on main, but Git is still in bisect mode. End it with git bisect reset.";
          return "Got it! Now end the search with git bisect reset.";
        }
        if (st && c.onBranch(w, "main") && st.bad && st.good.length)
          return "You switched to main in the middle of the search. Keep answering git bisect good / bad, or run git bisect reset and start over.";
        if (!st && !foundCulprit(w))
          return "The bisect is over, but Git hasn't named the culprit yet. Start again: git bisect start, git bisect bad, git bisect good v1.0.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── .gitignore

const SECRET_ENV = "# Real keys. Never commit this file!\nSTRIPE_SECRET_KEY=sk_test_FAKE_51Hx9PixelPlantsDemoKey\n";
const IGNORE_V1 =
  "# dependencies: npm install brings them back\nnode_modules/\n\n# build output: generated from src/\nbuild/\n\n# logs\n*.log\n\n# secrets: .env, .env.local, .env.production…\n.env*\n";
const IGNORE_V2 = IGNORE_V1 + "!.env.example\n";

const ignored = (w: World, path: string) => status(w, { ignored: true }).some((e) => e.path === path && e.ignored);
const NOISE = [".env", "node_modules/express/index.js", "build/app.min.js", "debug.log"];
const isNoise = (p: string) => p === ".env" || /^(node_modules|build)\//.test(p) || p.endsWith(".log");
/** Every commit in main's history. */
const commitsFromHead = (w: World): Commit[] => Object.values(w.repo?.commits ?? {}).filter((cm) => c.branchContains(w, "main", cm.id));

const gitignore: Lesson = {
  id: "gitignore",
  chapterId: "advanced",
  title: ".gitignore",
  tagline: "Teach Git what to look away from",
  xp: 180,
  concepts: [".gitignore patterns", "negation", "check-ignore", "tracked files are never ignored"],
  commands: ["git status", "git check-ignore -v", "git rm --cached", "git status --ignored"],
  ui: UI,
  setup: () =>
    scenario()
      .run("git init")
      .commit(
        "Start the shop",
        {
          "README.md": "# Pixel Plants\n\nRun npm install, then copy .env.example to .env and add your keys.\n",
          "src/app.js": "import { withTax } from './price.js';\n\nexport const total = (items) => items.reduce((sum, p) => sum + withTax(p), 0);\n",
          "src/price.js": "export const withTax = (price) => price * 1.1;\n",
          "package.json": JSON.stringify({ name: "pixel-plants", version: "1.2.0", scripts: { build: "bundle src -o build" } }, null, 2) + "\n",
          "config.local.json": '{\n  "apiUrl": "http://localhost:3000"\n}\n',
        },
        "Sam",
      )
      .files({
        "config.local.json": '{\n  "apiUrl": "http://localhost:3000",\n  "debug": true\n}\n',
        ".env": SECRET_ENV,
        ".env.example": "# Copy me to .env and fill in your own keys\nSTRIPE_SECRET_KEY=\n",
        "node_modules/express/index.js": "module.exports = require('./lib/express');\n",
        "node_modules/express/package.json": '{ "name": "express" }\n',
        "build/app.min.js": "const total=a=>a.reduce((s,p)=>s+p*1.1,0);\n",
        "debug.log": "[debug] cart total: 22\n",
        "npm-debug.log": "npm ERR! missing script: start\n",
      })
      .done(),
  recap: [
    ".gitignore lists patterns for files Git should pretend not to see: dependencies, build output, logs, secrets.",
    "Patterns: *.log matches by name anywhere, build/ matches a folder, and a later !pattern brings a file back.",
    "git check-ignore -v <file> tells you which line of .gitignore matches a file.",
    ".gitignore never affects files Git already tracks. git rm --cached <file> stops tracking it but keeps it on your disk.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Not everything belongs in Git",
      body: [
        "Your project folder holds more than your code: downloaded libraries (node_modules), generated files (build), logs, and a .env file with a secret API key.",
        "None of it belongs in history. Libraries come back with npm install, build files come back with a build, and a secret in a commit stays readable forever by anyone with a copy.",
        "A file called .gitignore lists patterns. Git then pretends those files don't exist: status stops mentioning them and git add . skips them.",
      ],
      scene: "three-areas",
    },
    {
      kind: "try",
      title: "See the noise",
      body: "Ask Git what it sees.",
      command: "git status",
      check: (_w, _s, ran) => ran.includes("status"),
      success:
        "Every library file, the build, two logs and .env are “Untracked”. One careless git add . and your secret key is in a commit. Also note “modified: config.local.json”: you'll come back to it.",
    },
    {
      kind: "try",
      title: "Write a .gitignore",
      body: "Create .gitignore at the root of the project, with the button or from the Files panel (click it to edit). One pattern per line, # starts a comment. node_modules/ with a slash means “that folder”, *.log means “any name ending in .log”, and .env* means “anything starting with .env”.",
      action: { label: "Create .gitignore", kind: "create-file", path: ".gitignore", content: IGNORE_V1 },
      check: (w) => NOISE.every((p) => ignored(w, p)) && ignored(w, ".env.example"),
      success: "Saved. From now on, Git skips everything that matches those lines: in the Files panel, those files now carry an “ignored” badge.",
      hint: "Make sure the file is named exactly .gitignore (with the dot) and has the line .env* with the star.",
    },
    {
      kind: "try",
      title: "Enjoy the quiet",
      body: "Run status again.",
      command: "git status",
      check: (_w, _s, ran) => ran.includes("status"),
      success:
        "Only .gitignore is left under “Untracked files” (commit it, so the whole team shares it). But wait: .env.example disappeared too. That's the template teammates copy to make their own .env. It has no secret and it must be committed.",
    },
    {
      kind: "try",
      title: "Ask Git why",
      body: "When a file is ignored and you don't know why, check-ignore -v names the guilty line.",
      command: "git check-ignore -v .env.example",
      check: (_w, _s, ran) => ran.includes("check-ignore"),
      success: "“.gitignore:11:.env*”: line 11 of .gitignore, the .env* pattern, swallows .env.example too.",
    },
    {
      kind: "try",
      title: "Make an exception",
      body: "A line starting with ! brings a file back. It must come after the pattern it overrides, since the last matching line wins. In the Files panel, click .gitignore to open it and add !.env.example as the last line.",
      action: { label: "Add !.env.example", kind: "edit-file", path: ".gitignore", content: IGNORE_V2 },
      check: (w) => !ignored(w, ".env.example") && ignored(w, ".env") && ".env.example" in w.workdir,
      success: ".env.example is visible again, and .env (the real secret) is still ignored. git status lists both .gitignore and .env.example as untracked.",
      hint: "Put !.env.example on its own line, below .env*",
    },
    {
      kind: "challenge",
      title: "Challenge: the file that won't go away",
      body: "Sam committed config.local.json, his personal settings, by mistake. Add it to .gitignore and watch: git status still says it's modified. .gitignore only hides untracked files, and this one is already tracked. Stop tracking it without deleting it from your disk, then commit your .gitignore and .env.example and finish with a clean working tree. .env must never reach a commit.",
      objectives: [
        {
          id: "untracked",
          label: "config.local.json is ignored, untracked, and still on your disk",
          check: (w) => c.fileExists(w, "config.local.json") && w.repo?.index["config.local.json"] === undefined && !c.inHead(w, "config.local.json") && ignored(w, "config.local.json"),
          hints: [
            "Two moves: list it in .gitignore, and remove it from Git's index (the staging area) while leaving the file alone.",
            "Add a line config.local.json to .gitignore, then git rm --cached config.local.json and commit.",
            'Type: echo config.local.json >> .gitignore — then git rm --cached config.local.json — then git add . and git commit -m "Ignore local files"',
          ],
        },
        {
          id: "shared",
          label: "Commit .gitignore and .env.example",
          check: (w) => c.inHead(w, ".gitignore") && c.inHead(w, ".env.example") && (c.committedContent(w, ".gitignore") ?? "").includes("config.local.json"),
          hints: [
            "Your teammates need the same rules and the template. Both belong in a commit.",
            "Stage everything with git add . (ignored files are skipped) and commit.",
            'Type: git add . — then: git commit -m "Ignore local files"',
          ],
        },
        {
          id: "clean",
          label: "No secret or junk in any commit, and a clean working tree",
          check: (w) => c.clean(w) && commitsFromHead(w).every((cm) => !Object.keys(cm.tree).some(isNoise)) && c.inHead(w, ".gitignore"),
          hints: [
            "git status should say “nothing to commit, working tree clean”, and none of .env, node_modules/, build/ or .log files may be in a commit.",
            "Never use git add -f on an ignored file. Commit everything that git add . picks up.",
            'Type: git add . && git commit -m "Ignore local files" — then git status',
          ],
        },
      ],
      feedback: (w) => {
        if (!w.repo) return null;
        if (!c.fileExists(w, "config.local.json"))
          return "config.local.json is gone from your disk! Plain git rm deletes the file too. Bring it back with git restore --staged config.local.json and then git restore config.local.json, and use git rm --cached.";
        const head = c.committedContent(w, ".env");
        if (head !== undefined || commitsFromHead(w).some((cm) => ".env" in cm.tree))
          return "A commit contains .env, your secret key! Take it out of the last commit: git rm --cached .env, then git commit --amend --no-edit. In real life, a pushed secret counts as leaked: rotate the key.";
        if (w.repo.index[".env"] !== undefined) return ".env is staged! Unstage it with git rm --cached .env before you commit.";
        if (w.repo.index["config.local.json"] !== undefined && (w.workdir[".gitignore"] ?? "").includes("config.local.json"))
          return "config.local.json is in .gitignore, but Git still tracks it: .gitignore only hides untracked files. Stop tracking it with git rm --cached config.local.json.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── hooks

export const HOOKS_URL = "https://github.com/pixel-plants/shop.git";

const PRE_COMMIT = `#!/bin/sh
# pre-commit: no console.log in our JavaScript
echo "pre-commit: looking for console.log..."
grep -rn console.log src && echo "Remove console.log before committing." && exit 1
exit 0
`;
const COMMIT_MSG = `#!/bin/sh
# commit-msg: $1 is the file holding your message
grep -qE "^(feat|fix|docs): " "$1" && exit 0
echo "Commit message must start with feat:, fix: or docs:"
echo "Example: feat: add wishlist"
exit 1
`;
const PRE_PUSH = `#!/bin/sh
# pre-push: run the tests before anything leaves your computer
echo "pre-push: running tests..."
npm test
`;
const APP_CLEAN = "export function showBanner() {\n  return 'Spring sale: -20% on cacti!';\n}\n";
const APP_DEBUG = "export function showBanner() {\n  console.log('banner shown');\n  return 'Spring sale: -20% on cacti!';\n}\n";
const MSG_RULE = /^(feat|fix|docs): /;

/** The team's repo on GitHub (hooks included), cloned; you've been coding the sale banner. */
const hookedShop = (): World => {
  const team = scenario()
    .run("git init")
    .commit(
      "Start the shop",
      {
        "README.md": "# Pixel Plants\n\nAfter cloning, turn on our hooks:\n\n    git config core.hooksPath .githooks\n",
        "src/app.js": "export function showBanner() {\n  return '';\n}\n",
        "src/price.js": "export const withTax = (price) => price * 1.1;\n",
        "package.json": JSON.stringify({ name: "pixel-plants", version: "1.2.0", scripts: { test: 'grep -q "1.1" src/price.js' } }, null, 2) + "\n",
      },
      "Maya",
    )
    .commit("docs: share our git hooks", { ".githooks/pre-commit": PRE_COMMIT, ".githooks/commit-msg": COMMIT_MSG, ".githooks/pre-push": PRE_PUSH }, "Maya")
    .host(HOOKS_URL, "pixel-plants", "shop")
    .run(`git remote add origin ${HOOKS_URL}`, "git push -u origin main")
    .done();
  return new Scenario({ ...emptyWorld(), hosted: team.hosted, hostedCommits: team.hostedCommits, clock: team.clock, seq: team.seq })
    .run(`git clone ${HOOKS_URL} .`)
    .files({ "src/app.js": APP_DEBUG })
    .done();
};

const hooksOn = (w: World) => w.repo?.config?.["core.hookspath"]?.replace(/\/+$/, "") === ".githooks";
/** Your commits on main since the lesson started. */
const yourCommits = (w: World, s: World) => {
  const before = new Set(Object.keys(s.repo?.commits ?? {}));
  return commitsFromHead(w).filter((cm) => !before.has(cm.id) && cm.author !== "Maya");
};
const passesHooks = (cm: Commit) => MSG_RULE.test(cm.message) && !Object.entries(cm.tree).some(([p, t]) => p.startsWith("src/") && t.includes("console.log"));
const wishlistCommitted = (w: World, s: World) => {
  const mine = yourCommits(w, s);
  return mine.some((cm) => "src/wishlist.js" in cm.tree) && mine.every(passesHooks);
};

const hooks: Lesson = {
  id: "hooks",
  chapterId: "advanced",
  title: "Git hooks",
  tagline: "Scripts that guard your commits and pushes",
  xp: 220,
  concepts: ["hooks", "core.hooksPath", "pre-commit", "commit-msg", "pre-push", "--no-verify"],
  commands: ["git config core.hooksPath", "git commit", "git push", "git commit --no-verify"],
  ui: { files: true, editor: true, stages: false, remote: true },
  setup: hookedShop,
  recap: [
    "Hooks are scripts Git runs at key moments: pre-commit before a commit, commit-msg to check the message, pre-push before a push. A non-zero exit stops Git.",
    "Cloning never turns hooks on: running code from a repo you just downloaded would be dangerous. Teams keep them in a folder and opt in with git config core.hooksPath .githooks (or a tool like husky).",
    "When a hook blocks you, read its message, fix the problem, and try again.",
    "--no-verify skips hooks. It's an emergency exit for a broken hook, not a habit: CI on GitHub runs the same checks anyway.",
  ],
  steps: [
    {
      kind: "discover",
      title: "A robot that checks your work",
      body: [
        "Your team agreed on two rules: no console.log left in the code, and every commit message starts with feat:, fix: or docs:. People forget rules. Scripts don't.",
        "A hook is a script Git runs at a key moment: pre-commit runs before a commit is made, commit-msg checks the message, pre-push runs before anything is sent to GitHub. If the script fails, Git stops.",
        "Maya put the team's hooks in the .githooks folder of the repo you cloned. They're not switched on yet: Git never runs code from a repository just because you cloned it. Imagine cloning a stranger's project and having it run a script on your machine!",
      ],
      scene: "repository",
    },
    {
      kind: "try",
      title: "Switch the hooks on",
      body: "Open .githooks/pre-commit in the Files panel to read it first: a good habit before running anyone's script. Then tell Git where your team's hooks live. This setting stays on your computer and is never pushed.",
      command: "git config core.hooksPath .githooks",
      check: hooksOn,
      success: "Hooks are on for this repo. Projects using husky do the same thing for you during npm install.",
    },
    {
      kind: "experiment",
      title: "Get caught",
      body: "src/app.js still has a console.log from when you were debugging the sale banner. Stage it and try to commit with a valid message. You'll see “pre-commit: looking for console.log...”, the guilty line, and “Remove console.log before committing.” Nothing gets committed.",
      ideas: ["git add .", 'git commit -m "feat: add sale banner"', "cat .githooks/pre-commit"],
    },
    {
      kind: "try",
      title: "Fix the code",
      body: "In the Files panel, click src/app.js to open it, and delete the console.log line.",
      action: { label: "Remove the console.log", kind: "edit-file", path: "src/app.js", content: APP_CLEAN },
      check: (w) => !(w.workdir["src/app.js"] ?? "console.log").includes("console.log") && (w.workdir["src/app.js"] ?? "").includes("showBanner"),
      success: "Clean. The pre-commit hook has nothing left to complain about.",
    },
    {
      kind: "experiment",
      title: "A message nobody can sort",
      body: "Now commit with a lazy message, like git commit -am \"banner\". The pre-commit hook passes, then commit-msg reads your message (Git hands it the message file as $1) and refuses: “Commit message must start with feat:, fix: or docs:”.",
      ideas: ['git commit -am "banner"', "cat .githooks/commit-msg"],
    },
    {
      kind: "try",
      title: "Commit it properly",
      body: "A new feature gets feat:. -a stages your fixed app.js, so the version without console.log is the one committed.",
      command: 'git commit -am "feat: add sale banner"',
      check: (w, s) => yourCommits(w, s).length >= 1 && MSG_RULE.test(w.repo?.commits[w.repo.branches.main]?.message ?? "") && !(c.committedContent(w, "src/app.js") ?? "").includes("console.log"),
      success: "“pre-commit: looking for console.log...” and then “[main …] feat: add sale banner”. Both hooks said yes.",
      hint: 'Type: git commit -am "feat: add sale banner"',
    },
    {
      kind: "challenge",
      title: "Challenge: ship the wishlist",
      body: "Add a wishlist: create src/wishlist.js, commit it with a message the hooks accept, and push to GitHub. The pre-push hook runs npm test before anything leaves your computer: watch for it in the terminal, then check the GitHub tab. (git commit --no-verify would skip the hooks. Don't: this challenge checks what you actually commit.)",
      objectives: [
        {
          id: "commit",
          label: "Commit src/wishlist.js, passing both hooks",
          check: wishlistCommitted,
          hints: [
            "Create the file, stage it, commit it with a feat: message. No console.log in it.",
            'Make the file from the Files panel or with echo, then git add . and git commit -m "feat: …"',
            'Type: echo "export const wishlist = [];" > src/wishlist.js — then: git add . — then: git commit -m "feat: add wishlist"',
          ],
        },
        {
          id: "pushed",
          label: "Push to GitHub with the hooks still on",
          check: (w, s) => wishlistCommitted(w, s) && hooksOn(w) && !!w.repo && w.hosted[HOOKS_URL]?.branches.main === w.repo.branches.main,
          hints: [
            "Your branch already tracks origin/main. The pre-push hook runs the tests first.",
            "git push. Don't add --no-verify.",
            "Type: git push",
          ],
        },
      ],
      feedback: (w, s) => {
        if (!w.repo) return null;
        if (!hooksOn(w)) return "Your hooks are switched off. Turn them back on with git config core.hooksPath .githooks";
        const bad = yourCommits(w, s).find((cm) => !passesHooks(cm));
        if (bad)
          return `The commit “${bad.message}” would never pass the hooks (skipped with --no-verify?). Undo it with git reset HEAD~1, fix it, and commit again.`;
        if (wishlistCommitted(w, s) && w.hosted[HOOKS_URL]?.branches.main !== w.repo.branches.main)
          return "Committed! Now git push, and watch the pre-push hook run the tests.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

export const ADV_B_LESSONS: Lesson[] = [bisect, gitignore, hooks];

// ───────────────────────────────────────────── French

export const ADV_B_FR: Record<string, LessonText> = {
  bisect: {
    title: "Trouver un bug avec bisect",
    tagline: "Une recherche dichotomique dans ton historique",
    concepts: ["bisect", "commits bons et mauvais", "recherche dichotomique", "bisect automatique"],
    recap: [
      "git bisect trouve le commit qui a introduit un bug en coupant les suspects en deux à chaque étape : 9 commits demandent 3 ou 4 vérifications, 1 000 environ 10.",
      "Démarre avec git bisect start, marque un commit qui a le bug (git bisect bad) et un qui ne l'a pas (git bisect good v1.0).",
      "À chaque arrêt, teste le code et réponds git bisect good ou git bisect bad. Git te place lui-même sur le commit suivant.",
      "git bisect run <commande> fait les tests à ta place (code de sortie 0 = bon). Termine toujours avec git bisect reset.",
    ],
    steps: [
      {
        title: "« Ça marchait le mois dernier ! »",
        body: [
          "Une cliente écrit : un Monstera à 20 € coûte 2 € au moment de payer. Ta boutique brade ses plantes. La version 1.0 était correcte, et depuis, l'équipe a fait 9 commits.",
          "Tu pourrais les vérifier un par un. Ou jouer à « plus ou moins » : teste le commit du milieu. S'il est cassé, le bug est dans la moitié la plus ancienne ; s'il marche, il est dans la plus récente. Chaque vérification coupe les suspects en deux.",
          "C'est exactement ce que fait git bisect. Tu lui donnes un commit mauvais et un commit bon, et il te mène au coupable en environ 3 vérifications au lieu de 9.",
        ],
      },
      {
        title: "Lance la recherche",
        body: "Lance d'abord git log --oneline si tu veux voir les 12 commits. Puis dis à Git que tu commences un bisect.",
        success: "« status: waiting for both good and bad commits » (en attente d'un commit bon et d'un mauvais). Git est prêt : il lui faut un commit qui a le bug et un qui ne l'a pas.",
      },
      {
        title: "Marque le code actuel comme mauvais",
        body: "Le bug est sur main en ce moment, donc le commit où tu es est mauvais. Sans commit précisé, git bisect bad veut dire « HEAD ».",
        success: "« waiting for good commit(s), bad commit known » (commit mauvais connu, en attente d'un bon). Une extrémité de la recherche est fixée. Maintenant, l'autre.",
      },
      {
        title: "Marque v1.0 comme bon",
        body: "Les prix étaient justes dans la version 1.0, et elle a un tag : pas besoin de son identifiant. Marque-la comme bonne.",
        success:
          "« Bisecting: 4 revisions left to test after this (roughly 2 steps) » (encore 4 révisions à tester, environ 2 étapes). Git a sauté sur « Fix typo in cart title », à mi-chemin entre les deux. HEAD y est détachée et tes fichiers sont exactement ceux de ce commit.",
        hint: "v1.0 est un tag. Tape git bisect good v1.0",
      },
      {
        title: "Teste ce commit",
        body: "Le bug des prix est-il là ? Regarde price.js : dans le panneau Fichiers, ou avec cat. Une version correcte multiplie par 1.1 (elle ajoute 10 % de TVA).",
        success: "price * 1.1 : les prix sont justes dans ce commit, il est donc bon. Le bug est arrivé plus tard. Tu le diras à Git dans le défi.",
      },
      {
        title: "Laisse un script vérifier",
        body: "Vérifier à la main, ça va pour quelques étapes. Quand une commande sait distinguer le bon du mauvais, Git peut la lancer pour toi. Voici la même boutique avec un autre bug : le bouton Checkout a disparu de index.html.",
        captions: [
          "Raccourci : donne le commit mauvais et le bon directement dans la commande start.",
          "À chaque arrêt, Git lance grep. Il renvoie 0 quand il trouve « Checkout » (bon) et 1 sinon (mauvais). Git a trouvé « Add newsletter form » sans te poser une seule question.",
          "Terminé : reset te ramène sur main. Avec une suite de tests, tu écrirais git bisect run npm test.",
        ],
      },
      {
        title: "Défi : attrape le coupable",
        body: "Termine la chasse que tu as commencée. À chaque arrêt, vérifie price.js et réponds git bisect good ou git bisect bad, jusqu'à ce que Git affiche « is the first bad commit » (c'est le premier mauvais commit). (git bisect run marche aussi.) Ensuite, termine la recherche et reviens sur main.",
        objectives: [
          {
            label: "Git désigne le premier mauvais commit",
            hints: [
              "À chaque arrêt : price * 1.1 veut dire bon, tout le reste veut dire mauvais. Git coupe en deux jusqu'à ce qu'il ne reste qu'un commit.",
              "Lance cat price.js, puis git bisect good ou git bisect bad, et recommence.",
              "Tu es sur « Fix typo in cart title » et il est bon : git bisect good. Puis cat price.js à chaque nouvel arrêt, et réponds. Ou laisse Git faire : git bisect run npm test",
            ],
          },
          {
            label: "Termine le bisect et reviens sur main",
            hints: [
              "Pendant un bisect, HEAD est détachée sur d'anciens commits. Git ne quitte le mode bisect que quand tu le lui dis.",
              "Une seule commande termine la recherche et te ramène sur la branche de départ.",
              "Tape : git bisect reset",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        /^Git blamed “(.+)”, but/,
        "Git accuse « $1 », mais ce n'est pas le commit qui a cassé price.js : une de tes réponses était fausse. Recommence avec git bisect start, git bisect bad, git bisect good v1.0.",
      ],
      ["You're back on main, but Git is still in bisect mode. End it with git bisect reset.", "Tu es revenu sur main, mais Git est toujours en mode bisect. Termine-le avec git bisect reset."],
      ["Got it! Now end the search with git bisect reset.", "Trouvé ! Termine maintenant la recherche avec git bisect reset."],
      [
        "You switched to main in the middle of the search. Keep answering git bisect good / bad, or run git bisect reset and start over.",
        "Tu es passé sur main en pleine recherche. Continue à répondre git bisect good / bad, ou lance git bisect reset et recommence.",
      ],
      [
        "The bisect is over, but Git hasn't named the culprit yet. Start again: git bisect start, git bisect bad, git bisect good v1.0.",
        "Le bisect est terminé, mais Git n'a pas encore désigné le coupable. Recommence : git bisect start, git bisect bad, git bisect good v1.0.",
      ],
    ],
  },

  gitignore: {
    title: ".gitignore",
    tagline: "Apprends à Git ce qu'il doit ignorer",
    concepts: ["motifs .gitignore", "négation", "check-ignore", "un fichier suivi n'est jamais ignoré"],
    recap: [
      ".gitignore liste des motifs de fichiers que Git doit faire semblant de ne pas voir : dépendances, fichiers générés, logs, secrets.",
      "Les motifs : *.log correspond au nom partout, build/ à un dossier, et une ligne !motif plus bas fait revenir un fichier.",
      "git check-ignore -v <fichier> te dit quelle ligne du .gitignore correspond à un fichier.",
      ".gitignore n'a aucun effet sur les fichiers que Git suit déjà. git rm --cached <fichier> arrête de le suivre mais le garde sur ton disque.",
    ],
    steps: [
      {
        title: "Tout n'a pas sa place dans Git",
        body: [
          "Ton dossier de projet contient plus que ton code : des bibliothèques téléchargées (node_modules), des fichiers générés (build), des logs, et un fichier .env avec une clé d'API secrète.",
          "Rien de tout ça n'a sa place dans l'historique. Les bibliothèques reviennent avec npm install, les fichiers générés avec un build, et un secret dans un commit reste lisible pour toujours par quiconque a une copie.",
          "Un fichier nommé .gitignore liste des motifs. Git fait alors comme si ces fichiers n'existaient pas : status ne les mentionne plus et git add . les saute.",
        ],
      },
      {
        title: "Constate le bruit",
        body: "Demande à Git ce qu'il voit.",
        success:
          "Chaque fichier de bibliothèque, le build, deux logs et .env sont « Untracked » (non suivis). Un git add . distrait, et ta clé secrète finit dans un commit. Remarque aussi « modified: config.local.json » : on y reviendra.",
      },
      {
        title: "Écris un .gitignore",
        body: "Crée .gitignore à la racine du projet, avec le bouton ou depuis le panneau Fichiers (clique dessus pour le modifier). Un motif par ligne, # commence un commentaire. node_modules/ avec une barre veut dire « ce dossier », *.log veut dire « tout nom qui finit par .log », et .env* veut dire « tout ce qui commence par .env ».",
        success: "Enregistré. Désormais, Git saute tout ce qui correspond à ces lignes : dans le panneau Fichiers, ces fichiers portent maintenant un badge « ignoré ».",
        hint: "Vérifie que le fichier s'appelle exactement .gitignore (avec le point) et contient la ligne .env* avec l'étoile.",
        actionLabel: "Créer .gitignore",
      },
      {
        title: "Profite du calme",
        body: "Relance status.",
        success:
          "Seul .gitignore reste sous « Untracked files » (commite-le, pour que toute l'équipe le partage). Mais attends : .env.example a disparu aussi. C'est le modèle que tes coéquipiers copient pour créer leur propre .env. Il ne contient aucun secret et doit être commité.",
      },
      {
        title: "Demande à Git pourquoi",
        body: "Quand un fichier est ignoré et que tu ne sais pas pourquoi, check-ignore -v désigne la ligne coupable.",
        success: "« .gitignore:11:.env* » : la ligne 11 du .gitignore, le motif .env*, avale aussi .env.example.",
      },
      {
        title: "Fais une exception",
        body: "Une ligne qui commence par ! fait revenir un fichier. Elle doit venir après le motif qu'elle contredit, car c'est la dernière ligne qui correspond qui l'emporte. Dans le panneau Fichiers, clique sur .gitignore pour l'ouvrir et ajoute !.env.example en dernière ligne.",
        success: ".env.example est de nouveau visible, et .env (le vrai secret) est toujours ignoré. git status liste .gitignore et .env.example comme non suivis.",
        hint: "Mets !.env.example sur sa propre ligne, sous .env*",
        actionLabel: "Ajouter !.env.example",
      },
      {
        title: "Défi : le fichier qui ne veut pas partir",
        body: "Sam a commité config.local.json, ses réglages perso, par erreur. Ajoute-le au .gitignore et regarde : git status dit toujours qu'il est modifié. .gitignore ne cache que les fichiers non suivis, et celui-ci est déjà suivi. Arrête de le suivre sans le supprimer de ton disque, puis commite ton .gitignore et .env.example, et termine avec un répertoire de travail propre. .env ne doit jamais entrer dans un commit.",
        objectives: [
          {
            label: "config.local.json est ignoré, non suivi, et toujours sur ton disque",
            hints: [
              "Deux gestes : l'ajouter au .gitignore, et le retirer de l'index de Git (la zone de staging) sans toucher au fichier.",
              "Ajoute une ligne config.local.json au .gitignore, puis git rm --cached config.local.json et commite.",
              'Tape : echo config.local.json >> .gitignore — puis git rm --cached config.local.json — puis git add . et git commit -m "Ignore local files"',
            ],
          },
          {
            label: "Commite .gitignore et .env.example",
            hints: [
              "Tes coéquipiers ont besoin des mêmes règles et du modèle. Les deux vont dans un commit.",
              "Ajoute tout avec git add . (les fichiers ignorés sont sautés) et commite.",
              'Tape : git add . — puis : git commit -m "Ignore local files"',
            ],
          },
          {
            label: "Aucun secret ni déchet dans un commit, et un répertoire de travail propre",
            hints: [
              "git status doit dire « nothing to commit, working tree clean » (rien à commiter, tout est propre), et ni .env, ni node_modules/, ni build/, ni les fichiers .log ne doivent être dans un commit.",
              "N'utilise jamais git add -f sur un fichier ignoré. Commite tout ce que git add . prend.",
              'Tape : git add . && git commit -m "Ignore local files" — puis git status',
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "config.local.json is gone from your disk! Plain git rm deletes the file too. Bring it back with git restore --staged config.local.json and then git restore config.local.json, and use git rm --cached.",
        "config.local.json a disparu de ton disque ! git rm tout court supprime aussi le fichier. Récupère-le avec git restore --staged config.local.json puis git restore config.local.json, et utilise git rm --cached.",
      ],
      [
        "A commit contains .env, your secret key! Take it out of the last commit: git rm --cached .env, then git commit --amend --no-edit. In real life, a pushed secret counts as leaked: rotate the key.",
        "Un commit contient .env, ta clé secrète ! Retire-le du dernier commit : git rm --cached .env, puis git commit --amend --no-edit. Dans la vraie vie, un secret poussé est considéré comme fuité : change la clé.",
      ],
      [".env is staged! Unstage it with git rm --cached .env before you commit.", ".env est dans la zone de staging ! Retire-le avec git rm --cached .env avant de commiter."],
      [
        "config.local.json is in .gitignore, but Git still tracks it: .gitignore only hides untracked files. Stop tracking it with git rm --cached config.local.json.",
        "config.local.json est dans le .gitignore, mais Git le suit toujours : .gitignore ne cache que les fichiers non suivis. Arrête de le suivre avec git rm --cached config.local.json.",
      ],
    ],
  },

  hooks: {
    title: "Les hooks Git",
    tagline: "Des scripts qui surveillent tes commits et tes push",
    concepts: ["hooks", "core.hooksPath", "pre-commit", "commit-msg", "pre-push", "--no-verify"],
    recap: [
      "Les hooks sont des scripts que Git lance à des moments clés : pre-commit avant un commit, commit-msg pour vérifier le message, pre-push avant un push. Un code de sortie non nul arrête Git.",
      "Cloner n'active jamais les hooks : lancer du code venu d'un dépôt que tu viens de télécharger serait dangereux. Les équipes les rangent dans un dossier et les activent avec git config core.hooksPath .githooks (ou un outil comme husky).",
      "Quand un hook te bloque, lis son message, corrige le problème, et réessaie.",
      "--no-verify saute les hooks. C'est une sortie de secours pour un hook cassé, pas une habitude : la CI sur GitHub refait de toute façon les mêmes vérifications.",
    ],
    steps: [
      {
        title: "Un robot qui vérifie ton travail",
        body: [
          "Ton équipe s'est mise d'accord sur deux règles : aucun console.log oublié dans le code, et chaque message de commit commence par feat:, fix: ou docs:. Les gens oublient les règles. Les scripts, non.",
          "Un hook est un script que Git lance à un moment clé : pre-commit avant qu'un commit soit créé, commit-msg pour vérifier le message, pre-push avant que quoi que ce soit parte sur GitHub. Si le script échoue, Git s'arrête.",
          "Maya a mis les hooks de l'équipe dans le dossier .githooks du dépôt que tu as cloné. Ils ne sont pas encore activés : Git ne lance jamais du code d'un dépôt juste parce que tu l'as cloné. Imagine cloner le projet d'un inconnu et qu'il lance un script sur ta machine !",
        ],
      },
      {
        title: "Active les hooks",
        body: "Ouvre d'abord .githooks/pre-commit dans le panneau Fichiers pour le lire : une bonne habitude avant de lancer le script de quelqu'un. Puis indique à Git où vivent les hooks de ton équipe. Ce réglage reste sur ton ordinateur et n'est jamais poussé.",
        success: "Les hooks sont actifs pour ce dépôt. Les projets qui utilisent husky font la même chose pour toi pendant npm install.",
      },
      {
        title: "Fais-toi prendre",
        body: "src/app.js contient encore un console.log de quand tu déboguais la bannière des soldes. Ajoute-le à la zone de staging et essaie de commiter avec un message valide. Tu verras « pre-commit: looking for console.log... », la ligne coupable, et « Remove console.log before committing. » (retire console.log avant de commiter). Rien n'est commité.",
      },
      {
        title: "Corrige le code",
        body: "Dans le panneau Fichiers, clique sur src/app.js pour l'ouvrir, et supprime la ligne console.log.",
        success: "Propre. Le hook pre-commit n'a plus rien à redire.",
        actionLabel: "Retirer le console.log",
      },
      {
        title: "Un message que personne ne peut trier",
        body: "Commite maintenant avec un message paresseux, comme git commit -am \"banner\". Le hook pre-commit passe, puis commit-msg lit ton message (Git lui donne le fichier du message en $1) et refuse : « Commit message must start with feat:, fix: or docs: » (le message doit commencer par feat:, fix: ou docs:).",
      },
      {
        title: "Commite proprement",
        body: "Une nouvelle fonctionnalité prend feat:. -a ajoute ton app.js corrigé à la zone de staging, donc c'est bien la version sans console.log qui est commitée.",
        success: "« pre-commit: looking for console.log... » puis « [main …] feat: add sale banner ». Les deux hooks ont dit oui.",
        hint: 'Tape : git commit -am "feat: add sale banner"',
      },
      {
        title: "Défi : livre la liste d'envies",
        body: "Ajoute une liste d'envies : crée src/wishlist.js, commite-le avec un message que les hooks acceptent, et pousse sur GitHub. Le hook pre-push lance npm test avant que quoi que ce soit quitte ton ordinateur : guette-le dans le terminal, puis regarde l'onglet GitHub. (git commit --no-verify sauterait les hooks. Ne le fais pas : ce défi vérifie ce que tu commites vraiment.)",
        objectives: [
          {
            label: "Commite src/wishlist.js en passant les deux hooks",
            hints: [
              "Crée le fichier, ajoute-le à la zone de staging, commite-le avec un message feat:. Pas de console.log dedans.",
              'Crée le fichier depuis le panneau Fichiers ou avec echo, puis git add . et git commit -m "feat: …"',
              'Tape : echo "export const wishlist = [];" > src/wishlist.js — puis : git add . — puis : git commit -m "feat: add wishlist"',
            ],
          },
          {
            label: "Pousse sur GitHub avec les hooks toujours actifs",
            hints: [
              "Ta branche suit déjà origin/main. Le hook pre-push lance d'abord les tests.",
              "git push. N'ajoute pas --no-verify.",
              "Tape : git push",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      ["Your hooks are switched off. Turn them back on with git config core.hooksPath .githooks", "Tes hooks sont désactivés. Réactive-les avec git config core.hooksPath .githooks"],
      [
        /^The commit “(.+)” would never pass the hooks/,
        "Le commit « $1 » ne passerait jamais les hooks (sauté avec --no-verify ?). Annule-le avec git reset HEAD~1, corrige-le, et commite à nouveau.",
      ],
      ["Committed! Now git push, and watch the pre-push hook run the tests.", "Commité ! Maintenant git push, et regarde le hook pre-push lancer les tests."],
    ],
  },
};
