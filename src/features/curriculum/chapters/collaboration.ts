import { currentBranch, emptyWorld, isAncestor, type Commit, type World } from "@/engine";
import * as c from "../checks";
import type { LessonText } from "../localize";
import { Scenario, scenario } from "../scenario";
import type { Lesson } from "../types";

// ───────────────────────────────────────────── Chapter 9 — Team Collaboration

const SHOP_URL = "https://github.com/gitverse-team/coffee-shop.git";
const UI = { files: true, editor: true, stages: false, remote: true };

const INDEX = "<h1>Coffee Shop</h1>\n<p>Fresh coffee, every morning.</p>\n";
const MENU = "<h1>Menu</h1>\n<ul>\n  <li>Espresso: 2</li>\n  <li>Cappuccino: 3</li>\n</ul>\n";
const BUGGY_CART = "// Total price of one line in the cart\nexport const total = (price, qty) => price + qty;\n";

/** The team's repo on GitHub, pushed by Maya. `extra` lets a lesson add commits before it's published. */
function shopTeam(extra: (s: Scenario) => Scenario = (s) => s): World {
  return extra(
    scenario()
      .run("git init")
      .commit("Start coffee shop site", { "README.md": "# Coffee Shop\n", "index.html": INDEX }, "Maya")
      .commit("Add menu", { "menu.html": MENU }, "Maya"),
  )
    .host(SHOP_URL, "gitverse-team", "coffee-shop")
    .run(`git remote add origin ${SHOP_URL}`, "git push -u origin main")
    .done();
}

/** You clone the team repo, do `mine` locally; then a teammate does `theirs` from their own computer. */
function cloneThen(team: World, mine: (s: Scenario) => Scenario, theirs?: { name: string; work: (s: Scenario) => Scenario }): World {
  const you = mine(
    new Scenario({ ...emptyWorld(), hosted: team.hosted, hostedCommits: team.hostedCommits, clock: team.clock, seq: team.seq }).run(`git clone ${SHOP_URL} .`),
  ).done();
  if (!theirs) return you;
  const mate = theirs
    .work(new Scenario({ ...team, hosted: you.hosted, hostedCommits: you.hostedCommits, clock: you.clock, seq: you.seq }).run(`git config user.name "${theirs.name}"`))
    .done();
  return { ...you, hosted: mate.hosted, hostedCommits: mate.hostedCommits, clock: mate.clock, seq: mate.seq };
}

const host = (w: World) => w.hosted[SHOP_URL];

/** Every commit reachable from `id` in GitHub's object store. */
function hostedAncestors(w: World, id: string | undefined): Commit[] {
  const seen = new Map<string, Commit>();
  const stack = id ? [id] : [];
  while (stack.length) {
    const x = stack.pop()!;
    const cm = w.hostedCommits[x];
    if (!cm || seen.has(x)) continue;
    seen.set(x, cm);
    stack.push(...cm.parents);
  }
  return [...seen.values()];
}

// ───────────────────────────────────────────── GitHub Flow

/** A protected main that Maya reviews; you already have PR #1 open and approved. */
const flowTeam = () => {
  const team = shopTeam();
  team.hosted[SHOP_URL].protection = { main: { requirePullRequest: true, requiredApprovals: 1, requiredChecks: [] } };
  team.hosted[SHOP_URL].autoReviewers = ["Maya"];
  return team;
};

const flowSetup = () =>
  cloneThen(flowTeam(), (s) =>
    s
      .run("git switch -c feature/hours")
      .commit("Add opening hours", { "hours.html": "<h1>Opening hours</h1>\n<p>Every day, 7am to 6pm.</p>\n" })
      .run("git push -u origin feature/hours", 'gh pr create --title "Add opening hours" --body "Shows when the shop is open"'),
  );

/** The learner's new PR in the challenge (any PR other than #1). */
const newPull = (w: World) => (host(w)?.pulls ?? []).find((p) => p.number !== 1);
const newPullMerged = (w: World) => newPull(w)?.state === "merged";

const githubFlow: Lesson = {
  id: "github-flow",
  chapterId: "collaboration",
  title: "GitHub Flow",
  tagline: "Branch, pull request, merge, clean up: one habit",
  xp: 200,
  concepts: ["GitHub Flow", "always-deployable main", "pull request", "branch cleanup"],
  commands: ["git pull", "git switch -c", "git push -u origin <branch>", "gh pr create", "gh pr merge --merge -d", "git fetch --prune"],
  ui: UI,
  setup: flowSetup,
  recap: [
    "In GitHub Flow, main is always deployable: every change reaches it through a reviewed pull request.",
    "The loop: pull main, branch, commit small, push -u, gh pr create, review, gh pr merge.",
    "gh pr merge -d deletes the branch on GitHub and on your computer, and takes you back to main.",
    "Finish with git pull (get the merge) and git fetch --prune (drop stale origin/* labels).",
  ],
  steps: [
    {
      kind: "discover",
      title: "main is always deployable",
      body: [
        "You run the coffee shop's website with Maya. The team has one rule: main is always deployable. Whatever is on main could go live right now, so nobody commits to it directly. GitHub enforces the rule: main is protected.",
        "Every change goes around the same loop, called GitHub Flow: start from an up-to-date main, branch, commit small, push, open a pull request, get a review, merge, then come back to main and clean up.",
        "Running the loop the same way every time is what makes it fast. Watch it once from start to finish, then you'll do it yourself.",
      ],
      scene: "branch-split",
    },
    {
      kind: "watch",
      title: "Watch: the whole loop",
      body: "Here's one change, an About page, going around the loop. Step through it and watch the graph and the GitHub tab.",
      setup: () => cloneThen(flowTeam(), (s) => s),
      frames: [
        { command: "git pull", caption: "Start from an up-to-date main, so your branch begins from what's live. Here it says “Already up to date.”" },
        { command: "git switch -c feature/about", caption: "One branch per change, named after what it does." },
        {
          command: 'echo "<h1>About us</h1>" > about.html && git add . && git commit -m "Add about page"',
          caption: "A small, focused commit. Small changes are quick to review.",
        },
        { command: "git push -u origin feature/about", caption: "Publish the branch so GitHub can see it." },
        {
          command: 'gh pr create --title "Add about page" --body "A short page about the team"',
          caption: "Open the pull request. Maya reviews it and approves: “Maya approved these changes”.",
        },
        {
          command: "gh pr merge --merge -d",
          caption: "GitHub merges into main and deletes the branch, on GitHub and here. You're back on main, but your main doesn't have the merge yet.",
        },
        { command: "git pull", caption: "Bring the merge commit down. Your main now matches what's live." },
        { command: "git fetch --prune", caption: "origin/feature/about pointed at a branch that no longer exists. --prune removes it. Clean slate." },
      ],
    },
    {
      kind: "try",
      title: "Merge your pull request",
      body: "Your own change is already halfway around the loop. Pull request #1 “Add opening hours” is open, and Maya approved it (open the GitHub tab). Merge it with a merge commit. -d deletes the branch once it's merged.",
      command: "gh pr merge --merge -d",
      check: (w) => host(w)?.pulls?.[0]?.state === "merged" && !c.branchExists(w, "feature/hours"),
      success:
        "“✓ Merged pull request #1” and “✓ Deleted branch feature/hours”: the branch is gone from GitHub and from your computer, and Git moved you back to main. Read the last line, though: your local main doesn't have the merge yet.",
    },
    {
      kind: "try",
      title: "Bring main up to date",
      body: "The merge happened on GitHub. Pull it into your main.",
      command: "git pull",
      check: (w) => !!w.repo && c.onBranch(w, "main") && w.repo.branches.main === host(w)?.branches.main,
      success: "“Fast-forward”: your main now has the merge commit and hours.html. You have exactly what's live.",
    },
    {
      kind: "try",
      title: "Clean up stale labels",
      body: "Run git branch -a if you like: remotes/origin/feature/hours is still listed, although GitHub deleted that branch. Fetch with --prune to clear it.",
      command: "git fetch --prune",
      check: (w) => c.hasRepo(w) && !w.repo!.remoteRefs["origin/feature/hours"],
      success: "“- [deleted] (none) -> origin/feature/hours”: Git forgot a branch that no longer exists on GitHub. One loop done, and you're ready for the next one.",
    },
    {
      kind: "challenge",
      title: "Challenge: ship a Wi-Fi page",
      body: "Customers keep asking for the Wi-Fi password. Go around the whole loop on your own: from an up-to-date main, create a branch, commit a new wifi.html, push it, open a pull request and merge it (Maya will approve). Finish on a clean main that matches GitHub, with no branch left over anywhere.",
      objectives: [
        {
          id: "pr",
          label: "Open a pull request from a new branch",
          check: (w) => !!newPull(w),
          hints: [
            "main is protected: your change needs its own branch, pushed to GitHub, with a pull request.",
            "git switch -c, then commit, then git push -u origin <branch>, then gh pr create.",
            'git switch -c feature/wifi, echo "<p>Wi-Fi: coffee4all</p>" > wifi.html, git add ., git commit -m "Add wifi page", git push -u origin feature/wifi, gh pr create --title "Add wifi page" --body "For customers"',
          ],
        },
        {
          id: "merged",
          label: "Merge it on GitHub",
          check: newPullMerged,
          hints: ["Maya approved it, so it's ready to merge.", "gh pr merge with a strategy, and -d to delete the branch.", "Type: gh pr merge --merge -d"],
        },
        {
          id: "synced",
          label: "Back on main, clean and in sync with GitHub",
          check: (w) => newPullMerged(w) && c.onBranch(w, "main") && c.clean(w) && w.repo!.branches.main === host(w)?.branches.main,
          hints: ["The merge happened on GitHub. Your main needs it too.", "Switch to main if needed, then pull.", "Type: git switch main, then git pull"],
        },
        {
          id: "tidy",
          label: "No leftover branch: here, on GitHub, or in origin/*",
          check: (w) =>
            newPullMerged(w) &&
            Object.keys(w.repo!.branches).join() === "main" &&
            Object.keys(host(w)?.branches ?? {}).join() === "main" &&
            Object.keys(w.repo!.remoteRefs).join() === "origin/main",
          hints: [
            "Merged branches have done their job. Delete them everywhere, including Git's memory of GitHub's branches.",
            "gh pr merge -d deletes the branch on GitHub and locally; git fetch --prune clears origin/*.",
            "Type: git fetch --prune (and if a branch survived: git push origin --delete <branch>, git branch -d <branch>)",
          ],
        },
      ],
      feedback: (w) => {
        const repo = w.repo;
        if (!repo) return null;
        const main = repo.branches.main;
        const originMain = repo.remoteRefs["origin/main"];
        if (main && originMain && main !== originMain && !isAncestor(repo, main, originMain))
          return "You committed on main. main is protected, so that commit can never be pushed. Carry it to a branch with git switch -c feature/wifi, then put main back with git branch -f main origin/main.";
        const pr = newPull(w);
        if (!pr || pr.state !== "merged") return null;
        if (host(w)?.branches[pr.head]) return `Merged! But ${pr.head} still exists on GitHub. Delete it with git push origin --delete ${pr.head} (next time, add -d to gh pr merge).`;
        if (main !== host(w)?.branches.main) return "Merged on GitHub, but your main doesn't have it yet. git switch main, then git pull.";
        if (repo.branches[pr.head]) return `Your local branch ${pr.head} is still here. Delete it with git branch -d ${pr.head}.`;
        if (repo.remoteRefs[`origin/${pr.head}`]) return `GitHub deleted ${pr.head}, but your origin/${pr.head} label is still there. git fetch --prune clears it.`;
        if (currentBranch(repo) !== "main") return "Switch back to main: that's where the next loop starts.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Trunk-based development

const DARK_CSS = "body.dark {\n  background: #1d1a17;\n  color: #f3e9dc;\n}\n";
const FLAGS_JS = "// Feature flags: unfinished work ships switched off\nexport const flags = {\n  darkMode: false,\n};\n";

/** You committed locally after cloning; meanwhile `mateCommit` was pushed to main by Sam. */
const trunkSetup = (mine: string, mineFiles: Record<string, string>) => () =>
  cloneThen(shopTeam(), (s) => s.commit(mine, mineFiles), {
    name: "Sam",
    work: (s) => s.commit("Add opening hours", { "hours.html": "<h1>Opening hours</h1>\n<p>Every day, 7am to 6pm.</p>\n" }).run("git push"),
  });

const trunkLesson = trunkSetup("Add dark theme styles", { "dark.css": DARK_CSS });

const samCommit = (s: World) => host(s)?.branches.main;
const hostedMainChanged = (w: World, s: World) => host(w)?.branches.main !== host(s)?.branches.main;
const linearOnGitHub = (w: World) => hostedAncestors(w, host(w)?.branches.main).every((cm) => cm.parents.length <= 1);

const trunkBased: Lesson = {
  id: "trunk-based",
  chapterId: "collaboration",
  title: "Trunk-based development",
  tagline: "Small commits straight to main, many times a day",
  xp: 200,
  concepts: ["trunk-based development", "git pull --rebase", "linear history", "feature flags"],
  commands: ["git fetch", "git pull --rebase", "git push"],
  ui: UI,
  setup: trunkLesson,
  recap: [
    "Trunk-based teams commit small changes straight to main and integrate many times a day. No branch lives long.",
    "When main moved since your last pull, git pull --rebase replays your commits on top of it: history stays a straight line.",
    "Unfinished work hides behind a feature flag, so it can live on main without users seeing it.",
    "GitHub Flow fits review-first teams; trunk-based fits teams with strong tests that ship continuously.",
  ],
  steps: [
    {
      kind: "discover",
      title: "One trunk, many small commits",
      body: [
        "Some teams skip feature branches. Everyone commits small changes straight to main (the trunk) and pushes several times a day. No branch lives longer than a few hours, so nobody's work drifts far from anyone else's.",
        "Why so often? Merging two weeks of work is painful. Merging twenty minutes of work is easy. Integrating in small pieces means small conflicts, found early.",
        "The catch: when you push, main has usually moved. You committed “Add dark theme styles” on your main, but Sam pushed to main after you cloned. A plain git push is rejected with “fetch first”.",
      ],
      scene: "fetch-pull",
    },
    {
      kind: "watch",
      title: "Watch: rebase, then push",
      body: "Here's the trunk-based move on a small menu fix: get the news, replay your commit on top, push.",
      setup: trunkSetup("Fix menu prices", { "menu.html": MENU.replace("Cappuccino: 3", "Cappuccino: 3.50") }),
      frames: [
        { command: "git fetch", caption: "origin/main jumps to Sam's commit. Your main and origin/main now point different ways: they have diverged." },
        {
          command: "git pull --rebase",
          caption: "Git sets your commit aside, moves main up to Sam's work, then replays your commit on top. Same change, new commit id.",
        },
        { command: "git log --oneline --graph", caption: "One straight line: Sam's commit, then yours. No merge commit." },
        { command: "git push", caption: "Your main now contains GitHub's main, so the push goes through." },
      ],
    },
    {
      kind: "try",
      title: "Get the news",
      body: "Back to your own work. Fetch from GitHub and look at the graph.",
      command: "git fetch",
      check: (w, s) => !!w.repo && w.repo.remoteRefs["origin/main"] !== s.repo?.remoteRefs["origin/main"],
      success:
        "origin/main moved to Sam's “Add opening hours”. Your main and origin/main have diverged, one commit each (git status says so too). That's why a plain push would be rejected.",
    },
    {
      kind: "try",
      title: "Hide unfinished work behind a flag",
      body: "The dark theme isn't finished, but on a trunk-based team it still goes to main today. The trick is a feature flag: a switch in the code that keeps it off. In the Files panel, create flags.js with darkMode set to false (or press the button).",
      action: { label: "Create flags.js", kind: "create-file", path: "flags.js", content: FLAGS_JS },
      check: (w) => (w.workdir["flags.js"] ?? "").includes("darkMode"),
      success:
        "flags.js holds a switch. Code that would turn on the dark theme checks flags.darkMode first, and it's false, so users see nothing new. You can integrate unfinished work safely, then flip the flag when it's ready.",
    },
    {
      kind: "discover",
      title: "GitHub Flow or trunk-based?",
      body: [
        "GitHub Flow: every change gets a short branch and a reviewed pull request before it reaches main. It fits most teams, open source, and anyone who wants a review on every change.",
        "Trunk-based: tiny commits land on main directly (or through pull requests merged within hours), many times a day. It fits teams with strong automated tests and continuous deployment, where waiting is the bigger risk.",
        "Both share the same goal: main stays releasable, and nobody's work drifts far from it. Feature flags make that possible even for half-built features.",
      ],
      scene: "branch-split",
    },
    {
      kind: "challenge",
      title: "Challenge: integrate on the trunk",
      body: "Commit flags.js. Then put both of your commits (the dark theme styles and the flag) on top of Sam's work, and push them. GitHub's main must keep everyone's work, in a straight line with no merge commit.",
      objectives: [
        {
          id: "commit",
          label: "Commit flags.js",
          check: (w) => c.committedContent(w, "flags.js") !== undefined,
          hints: ["A small, complete step: stage the flag and commit it.", "git add, then git commit -m.", 'Type: git add flags.js, then git commit -m "Add dark mode flag (off)"'],
        },
        {
          id: "everyone",
          label: "GitHub's main has Sam's work and both of your commits",
          check: (w, s) => {
            const tip = host(w)?.branches.main;
            const anc = hostedAncestors(w, tip);
            return (
              anc.some((cm) => cm.id === samCommit(s)) &&
              anc.some((cm) => cm.message === "Add dark theme styles") &&
              !!tip &&
              w.hostedCommits[tip].tree["flags.js"] !== undefined
            );
          },
          hints: [
            "Your main must include Sam's commit before GitHub accepts your push.",
            "git pull --rebase, then git push.",
            "Type: git pull --rebase, then git push",
          ],
        },
        {
          id: "linear",
          label: "History stays a straight line: no merge commit on GitHub",
          check: (w, s) => hostedMainChanged(w, s) && linearOnGitHub(w),
          hints: [
            "A plain git pull would merge and add a merge commit. Rebase instead.",
            "--rebase replays your commits on top of origin/main.",
            "Type: git pull --rebase (if you already merged: git reset --hard HEAD~1 first)",
          ],
        },
      ],
      feedback: (w, s) => {
        const repo = w.repo;
        if (!repo) return null;
        if (hostedMainChanged(w, s) && !hostedAncestors(w, host(w)?.branches.main).some((cm) => cm.id === samCommit(s)))
          return "Sam's “Add opening hours” is gone from GitHub's main: a force push overwrote it. Never force-push a shared trunk. Restart the lesson and use git pull --rebase.";
        if (hostedMainChanged(w, s) && !linearOnGitHub(w))
          return "A merge commit reached GitHub's main. Trunk-based teams keep history linear: restart the lesson and use git pull --rebase instead of git pull.";
        if (c.headIsMerge(w))
          return "git pull merged instead of rebasing: see the merge commit at the top of the graph. Undo it with git reset --hard HEAD~1, then run git pull --rebase.";
        const main = repo.branches.main;
        const originMain = repo.remoteRefs["origin/main"];
        if (main && originMain && !isAncestor(repo, originMain, main) && originMain !== s.repo?.remoteRefs["origin/main"])
          return "Your main and origin/main have diverged. git pull --rebase replays your commits on top of Sam's.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Release management

const releaseTeam = () =>
  shopTeam((s) => s.commit("Add shopping cart", { "cart.js": BUGGY_CART }, "Maya"));

/** You cloned the shop at the moment it's ready to ship; then Maya pushed unreleased work to main. */
const releaseSetup = () =>
  cloneThen(releaseTeam(), (s) => s, {
    name: "Maya",
    work: (s) => s.commit("Start search page (unfinished)", { "search.html": "<h1>Search</h1>\n<p>Coming soon</p>\n" }).run("git push"),
  });

const isFixed = (cart: string | undefined) => cart !== undefined && cart !== BUGGY_CART && !cart.includes("price + qty");
const searchCommit = (s: World) => host(s)?.branches.main;

/** A proper hotfix commit: built on v1.0.0, fixes cart.js, and ships none of Maya's unreleased work. */
function isHotfix(w: World, s: World, id: string | undefined, store: "local" | "hosted") {
  const v1 = w.repo?.tags["v1.0.0"] ?? host(w)?.tags?.["v1.0.0"];
  if (!id || !v1 || id === v1) return false;
  const commits = store === "local" ? w.repo?.commits : w.hostedCommits;
  if (!commits?.[id]) return false;
  const anc = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    if (anc.has(x) || !commits[x]) continue;
    anc.add(x);
    stack.push(...commits[x].parents);
  }
  return anc.has(v1) && !anc.has(searchCommit(s) ?? "") && isFixed(commits[id].tree["cart.js"]);
}

const tagPushed = (w: World, s: World) => isHotfix(w, s, host(w)?.tags?.["v1.0.1"], "hosted");
const released = (w: World, s: World) => tagPushed(w, s) && !!host(w)?.releases?.some((r) => r.tag === "v1.0.1");
const mainHasFix = (w: World, s: World) => {
  const tip = host(w)?.branches.main;
  return (
    tagPushed(w, s) &&
    !!tip &&
    hostedAncestors(w, tip).some((cm) => cm.id === searchCommit(s)) &&
    isFixed(w.hostedCommits[tip].tree["cart.js"])
  );
};

const releases: Lesson = {
  id: "releases",
  chapterId: "collaboration",
  title: "Release management",
  tagline: "Semantic versions, tags, GitHub releases and hotfixes",
  xp: 300,
  boss: true,
  concepts: ["semantic versioning", "annotated tags", "GitHub releases", "hotfix branches"],
  commands: ["git tag -a", "git push origin <tag>", "gh release create", "git switch -c <branch> <tag>", "git merge", "git cherry-pick"],
  ui: UI,
  setup: releaseSetup,
  recap: [
    "Semantic versioning: MAJOR.MINOR.PATCH. Breaking change, new feature, bug fix.",
    "A release is a tag (git tag -a v1.0.0 -m …), pushed by name (git push origin v1.0.0), then published with gh release create.",
    "A hotfix branch starts from the released tag, not from main, so it ships the fix and nothing else.",
    "Always bring the fix back to main (merge or cherry-pick), or the next release brings the bug back.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Version numbers that mean something",
      body: [
        "When you ship, people need a name for what they got. Most projects use semantic versioning: MAJOR.MINOR.PATCH, like 1.4.2.",
        "PATCH (1.4.2 → 1.4.3): bug fixes only. MINOR (1.4.3 → 1.5.0): new features, and nothing that worked before breaks. MAJOR (1.5.0 → 2.0.0): a breaking change, so users must adapt. 1.0.0 is the first version you promise to keep stable.",
        "In Git, a version is a tag: a label on one commit that never moves, unlike a branch. The coffee shop you just cloned is ready to ship. It becomes v1.0.0.",
      ],
      scene: "history",
    },
    {
      kind: "try",
      title: "Tag the release",
      body: "Create an annotated tag on your latest commit. -a makes it annotated, and -m gives it a message.",
      command: 'git tag -a v1.0.0 -m "First public release"',
      check: (w) => !!w.repo?.tags["v1.0.0"],
      success:
        "No output, but look at the graph: tag v1.0.0 sits on “Add shopping cart”. An annotated tag also records who tagged it and when, which is why teams use them for releases.",
    },
    {
      kind: "try",
      title: "Push the tag",
      body: "A plain git push doesn't send tags. Push this one by name.",
      command: "git push origin v1.0.0",
      check: (w) => !!host(w)?.tags?.["v1.0.0"],
      success: "“* [new tag] v1.0.0 -> v1.0.0”: GitHub has the tag. (git push --tags would push all your tags at once.)",
    },
    {
      kind: "try",
      title: "Publish the release",
      body: "A GitHub release turns a tag into a page people can find, with notes about what changed. Let GitHub write the notes from the commits.",
      command: "gh release create v1.0.0 --generate-notes",
      check: (w) => !!host(w)?.releases?.some((r) => r.tag === "v1.0.0"),
      success: "Release v1.0.0 is live: open the GitHub tab. --generate-notes listed every commit since the previous release (here, all of them). Use --notes \"…\" to write your own.",
    },
    {
      kind: "discover",
      title: "A bug in production",
      body: [
        "Customers report that the cart total is wrong: 2 coffees at 3 cost 5. cart.js adds the price and the quantity instead of multiplying them.",
        "You can't ship main as it is: Maya has pushed her unfinished search page to it since your clone. Releasing main would ship half-built work.",
        "The answer is a hotfix branch that starts from the tag, not from main: git switch -c hotfix/1.0.1 v1.0.0. You get exactly what users have, fix only the bug, and release 1.0.1 (a PATCH: a fix, nothing new).",
        "Then bring the fix back to main, with git merge or git cherry-pick. Otherwise the next release brings the bug back.",
      ],
      scene: "branch-split",
    },
    {
      kind: "challenge",
      title: "Boss: ship hotfix 1.0.1",
      body: "Create hotfix/1.0.1 from v1.0.0 and fix cart.js so total multiplies price by qty. Commit, tag it v1.0.1, push the tag and publish the release on GitHub. Then bring the fix into main (with Maya's work) and push main.",
      objectives: [
        {
          id: "fix",
          label: "Commit the cart.js fix on hotfix/1.0.1, started from v1.0.0",
          check: (w, s) => isHotfix(w, s, w.repo?.branches["hotfix/1.0.1"] ?? w.repo?.tags["v1.0.1"], "local"),
          hints: [
            "Start from what users have (the tag), not from main, which holds unreleased work.",
            "git switch -c hotfix/1.0.1 v1.0.0, then edit cart.js and commit.",
            'git switch -c hotfix/1.0.1 v1.0.0, then in cart.js change “price + qty” to “price * qty”, then git commit -am "Fix cart total"',
          ],
        },
        {
          id: "tag",
          label: "Tag the fix v1.0.1 and push the tag",
          check: tagPushed,
          hints: ["1.0.0 + a bug fix = 1.0.1 (PATCH).", "git tag -a on the hotfix commit, then git push origin <tag>.", 'Type: git tag -a v1.0.1 -m "Fix cart total", then git push origin v1.0.1'],
        },
        {
          id: "release",
          label: "Publish the v1.0.1 release on GitHub",
          check: released,
          hints: ["Turn the pushed tag into a release.", "gh release create, with --notes or --generate-notes.", 'Type: gh release create v1.0.1 --notes "Fixes the cart total"'],
        },
        {
          id: "main",
          label: "GitHub's main has the fix and Maya's search page",
          check: mainHasFix,
          hints: [
            "main needs the fix too, on top of Maya's latest work.",
            "On main: pull, then git merge hotfix/1.0.1 (or git cherry-pick hotfix/1.0.1), then push.",
            "Type: git switch main, git pull, git merge hotfix/1.0.1, git push",
          ],
        },
      ],
      feedback: (w, s) => {
        const repo = w.repo;
        if (!repo) return null;
        const search = searchCommit(s) ?? "";
        const contains = (id: string | undefined) => !!id && !!repo.commits[search] && isAncestor(repo, search, id);
        if (contains(repo.tags["v1.0.1"]) || contains(host(w)?.tags?.["v1.0.1"]))
          return "Your v1.0.1 tag includes Maya's unfinished search page: it was made from main. Delete it with git tag -d v1.0.1 (and git push origin --delete v1.0.1 if you pushed it), then tag the commit on hotfix/1.0.1.";
        if (contains(repo.branches["hotfix/1.0.1"]))
          return "hotfix/1.0.1 contains Maya's unreleased search page because it started from main. Start over from the tag: git switch main, git branch -D hotfix/1.0.1, then git switch -c hotfix/1.0.1 v1.0.0.";
        if (repo.tags["v1.0.1"] && !host(w)?.tags?.["v1.0.1"]) return "v1.0.1 exists only on your computer. Push it: git push origin v1.0.1.";
        if (tagPushed(w, s) && !released(w, s)) return 'The tag is on GitHub. Now publish it: gh release create v1.0.1 --notes "Fixes the cart total".';
        if (released(w, s) && !mainHasFix(w, s))
          return isFixed(repo.branches.main ? repo.commits[repo.branches.main].tree["cart.js"] : undefined)
            ? "Your main has the fix. Push it: git push (if it's rejected, git pull first)."
            : "v1.0.1 is out! Now bring the fix to main: git switch main, git pull, git merge hotfix/1.0.1, then git push.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

export const TEAM_LESSONS: Lesson[] = [githubFlow, trunkBased, releases];

// ───────────────────────────────────────────── French

export const TEAM_FR: Record<string, LessonText> = {
  "github-flow": {
    title: "GitHub Flow",
    tagline: "Branche, pull request, merge, ménage : une seule habitude",
    concepts: ["GitHub Flow", "main toujours déployable", "pull request", "nettoyage des branches"],
    recap: [
      "Avec GitHub Flow, main est toujours déployable : chaque changement y arrive par une pull request relue.",
      "La boucle : pull de main, branche, petits commits, push -u, gh pr create, relecture, gh pr merge.",
      "gh pr merge -d supprime la branche sur GitHub et sur ton ordinateur, et te ramène sur main.",
      "Termine par git pull (récupérer le merge) et git fetch --prune (effacer les étiquettes origin/* périmées).",
    ],
    steps: [
      {
        title: "main est toujours déployable",
        body: [
          "Tu gères le site du coffee shop avec Maya. L'équipe a une seule règle : main est toujours déployable. Tout ce qui est sur main pourrait partir en ligne maintenant, donc personne ne commite directement dessus. GitHub fait respecter la règle : main est protégée.",
          "Chaque changement suit la même boucle, appelée GitHub Flow : partir d'un main à jour, créer une branche, faire de petits commits, push, ouvrir une pull request, obtenir une relecture, merger, puis revenir sur main et faire le ménage.",
          "C'est en faisant la boucle toujours de la même façon qu'elle devient rapide. Regarde-la une fois du début à la fin, puis tu la feras toi-même.",
        ],
      },
      {
        title: "Regarde : la boucle complète",
        body: "Voici un changement, une page « À propos », qui fait tout le tour de la boucle. Avance pas à pas et regarde le graphe et l'onglet GitHub.",
        captions: [
          "Pars d'un main à jour, pour que ta branche commence à partir de ce qui est en ligne. Ici : « Already up to date. » (déjà à jour).",
          "Une branche par changement, nommée d'après ce qu'elle fait.",
          "Un petit commit ciblé. Les petits changements se relisent vite.",
          "Publie la branche pour que GitHub la voie.",
          "Ouvre la pull request. Maya la relit et l'approuve : « Maya approved these changes » (Maya a approuvé ces changements).",
          "GitHub merge dans main et supprime la branche, sur GitHub et ici. Tu es revenu sur main, mais ton main n'a pas encore le merge.",
          "Récupère le commit de merge. Ton main correspond maintenant à ce qui est en ligne.",
          "origin/feature/about pointait vers une branche qui n'existe plus. --prune l'efface. Table rase.",
        ],
      },
      {
        title: "Merge ta pull request",
        body: "Ton propre changement a déjà fait la moitié de la boucle. La pull request #1 « Add opening hours » est ouverte, et Maya l'a approuvée (ouvre l'onglet GitHub). Merge-la avec un commit de merge. -d supprime la branche une fois mergée.",
        success:
          "« ✓ Merged pull request #1 » et « ✓ Deleted branch feature/hours » : la branche a disparu de GitHub et de ton ordinateur, et Git t'a ramené sur main. Lis quand même la dernière ligne : ton main local n'a pas encore le merge.",
      },
      {
        title: "Mets main à jour",
        body: "Le merge a eu lieu sur GitHub. Fais un pull pour le récupérer dans ton main.",
        success: "« Fast-forward » : ton main a maintenant le commit de merge et hours.html. Tu as exactement ce qui est en ligne.",
      },
      {
        title: "Efface les étiquettes périmées",
        body: "Lance git branch -a si tu veux : remotes/origin/feature/hours apparaît encore, alors que GitHub a supprimé cette branche. Fais un fetch avec --prune pour l'effacer.",
        success: "« - [deleted] (none) -> origin/feature/hours » : Git a oublié une branche qui n'existe plus sur GitHub. Une boucle de faite, prêt pour la suivante.",
      },
      {
        title: "Défi : publie une page Wi-Fi",
        body: "Les clients demandent sans arrêt le mot de passe du Wi-Fi. Fais toute la boucle toi-même : à partir d'un main à jour, crée une branche, commite un nouveau wifi.html, fais un push, ouvre une pull request et merge-la (Maya l'approuvera). Termine sur un main propre, identique à celui de GitHub, sans aucune branche qui traîne.",
        objectives: [
          {
            label: "Ouvre une pull request depuis une nouvelle branche",
            hints: [
              "main est protégée : ton changement a besoin de sa propre branche, poussée sur GitHub, avec une pull request.",
              "git switch -c, puis commit, puis git push -u origin <branche>, puis gh pr create.",
              'git switch -c feature/wifi, echo "<p>Wi-Fi: coffee4all</p>" > wifi.html, git add ., git commit -m "Add wifi page", git push -u origin feature/wifi, gh pr create --title "Add wifi page" --body "For customers"',
            ],
          },
          {
            label: "Merge-la sur GitHub",
            hints: ["Maya l'a approuvée, elle est prête à être mergée.", "gh pr merge avec une stratégie, et -d pour supprimer la branche.", "Tape : gh pr merge --merge -d"],
          },
          {
            label: "De retour sur main, propre et synchronisé avec GitHub",
            hints: ["Le merge a eu lieu sur GitHub. Ton main en a besoin aussi.", "Reviens sur main si besoin, puis fais un pull.", "Tape : git switch main, puis git pull"],
          },
          {
            label: "Aucune branche qui traîne : ici, sur GitHub ou dans origin/*",
            hints: [
              "Les branches mergées ont fait leur travail. Supprime-les partout, y compris dans la mémoire que Git garde des branches de GitHub.",
              "gh pr merge -d supprime la branche sur GitHub et en local ; git fetch --prune nettoie origin/*.",
              "Tape : git fetch --prune (et si une branche a survécu : git push origin --delete <branche>, git branch -d <branche>)",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "You committed on main. main is protected, so that commit can never be pushed. Carry it to a branch with git switch -c feature/wifi, then put main back with git branch -f main origin/main.",
        "Tu as commité sur main. main est protégée, donc ce commit ne pourra jamais être poussé. Emmène-le sur une branche avec git switch -c feature/wifi, puis remets main en place avec git branch -f main origin/main.",
      ],
      [
        /^Merged! But (\S+) still exists on GitHub\./,
        "Mergée ! Mais $1 existe encore sur GitHub. Supprime-la avec git push origin --delete $1 (la prochaine fois, ajoute -d à gh pr merge).",
      ],
      ["Merged on GitHub, but your main doesn't have it yet. git switch main, then git pull.", "Mergée sur GitHub, mais ton main ne l'a pas encore. git switch main, puis git pull."],
      [/^Your local branch (\S+) is still here\./, "Ta branche locale $1 est toujours là. Supprime-la avec git branch -d $1."],
      [/^GitHub deleted (\S+), but/, "GitHub a supprimé $1, mais ton étiquette origin/$1 est toujours là. git fetch --prune la nettoie."],
      ["Switch back to main: that's where the next loop starts.", "Reviens sur main : c'est là que commence la prochaine boucle."],
    ],
  },
  "trunk-based": {
    title: "Le développement trunk-based",
    tagline: "De petits commits directement sur main, plusieurs fois par jour",
    concepts: ["développement trunk-based", "git pull --rebase", "historique linéaire", "feature flags"],
    recap: [
      "Les équipes trunk-based commitent de petits changements directement sur main et intègrent plusieurs fois par jour. Aucune branche ne vit longtemps.",
      "Quand main a bougé depuis ton dernier pull, git pull --rebase rejoue tes commits par-dessus : l'historique reste une ligne droite.",
      "Le travail pas fini se cache derrière un feature flag : il peut vivre sur main sans que les utilisateurs le voient.",
      "GitHub Flow convient aux équipes qui veulent une relecture d'abord ; le trunk-based aux équipes avec de bons tests qui livrent en continu.",
    ],
    steps: [
      {
        title: "Un tronc, plein de petits commits",
        body: [
          "Certaines équipes se passent des branches de fonctionnalité. Tout le monde commite de petits changements directement sur main (le tronc, « trunk ») et fait un push plusieurs fois par jour. Aucune branche ne vit plus de quelques heures, donc le travail de chacun ne s'éloigne jamais beaucoup de celui des autres.",
          "Pourquoi si souvent ? Merger deux semaines de travail, c'est pénible. Merger vingt minutes de travail, c'est facile. Intégrer par petits morceaux, c'est de petits conflits, repérés tôt.",
          "Le piège : quand tu fais un push, main a généralement bougé. Tu as commité « Add dark theme styles » sur ton main, mais Sam a poussé sur main après ton clone. Un simple git push est refusé avec « fetch first » (fais d'abord un fetch).",
        ],
      },
      {
        title: "Regarde : rebase, puis push",
        body: "Voici le geste trunk-based sur une petite correction du menu : récupérer les nouveautés, rejouer ton commit par-dessus, faire un push.",
        captions: [
          "origin/main saute sur le commit de Sam. Ton main et origin/main partent dans deux directions : ils ont divergé.",
          "Git met ton commit de côté, avance main jusqu'au travail de Sam, puis rejoue ton commit par-dessus. Même changement, nouvel identifiant.",
          "Une seule ligne droite : le commit de Sam, puis le tien. Pas de commit de merge.",
          "Ton main contient maintenant le main de GitHub, donc le push passe.",
        ],
      },
      {
        title: "Récupère les nouveautés",
        body: "Retour à ton propre travail. Fais un fetch depuis GitHub et regarde le graphe.",
        success:
          "origin/main est passé sur « Add opening hours » de Sam. Ton main et origin/main ont divergé, un commit chacun (git status le dit aussi). Voilà pourquoi un simple push serait refusé.",
      },
      {
        title: "Cache le travail pas fini derrière un flag",
        body: "Le thème sombre n'est pas fini, mais dans une équipe trunk-based il part quand même sur main aujourd'hui. L'astuce, c'est un feature flag : un interrupteur dans le code qui le garde éteint. Dans le panneau Fichiers, crée flags.js avec darkMode à false (ou appuie sur le bouton).",
        actionLabel: "Créer flags.js",
        success:
          "flags.js contient un interrupteur. Le code qui activerait le thème sombre vérifie d'abord flags.darkMode, qui vaut false, donc les utilisateurs ne voient rien de nouveau. Tu peux intégrer du travail pas fini sans risque, puis allumer le flag quand il est prêt.",
      },
      {
        title: "GitHub Flow ou trunk-based ?",
        body: [
          "GitHub Flow : chaque changement a une courte branche et une pull request relue avant d'arriver sur main. Ça convient à la plupart des équipes, à l'open source, et à tous ceux qui veulent une relecture sur chaque changement.",
          "Trunk-based : de tout petits commits arrivent directement sur main (ou via des pull requests mergées en quelques heures), plusieurs fois par jour. Ça convient aux équipes avec de bons tests automatiques et du déploiement continu, pour qui attendre est le plus grand risque.",
          "Les deux ont le même but : main reste publiable, et le travail de chacun ne s'en éloigne jamais beaucoup. Les feature flags le rendent possible même pour des fonctionnalités à moitié construites.",
        ],
      },
      {
        title: "Défi : intègre sur le tronc",
        body: "Commite flags.js. Puis place tes deux commits (les styles du thème sombre et le flag) par-dessus le travail de Sam, et fais un push. Le main de GitHub doit garder le travail de tout le monde, en ligne droite, sans commit de merge.",
        objectives: [
          {
            label: "Commite flags.js",
            hints: ["Une petite étape complète : ajoute le flag à l'index et commite-le.", "git add, puis git commit -m.", 'Tape : git add flags.js, puis git commit -m "Add dark mode flag (off)"'],
          },
          {
            label: "Le main de GitHub a le travail de Sam et tes deux commits",
            hints: ["Ton main doit contenir le commit de Sam avant que GitHub accepte ton push.", "git pull --rebase, puis git push.", "Tape : git pull --rebase, puis git push"],
          },
          {
            label: "L'historique reste une ligne droite : pas de commit de merge sur GitHub",
            hints: [
              "Un simple git pull ferait un merge et ajouterait un commit de merge. Fais un rebase à la place.",
              "--rebase rejoue tes commits par-dessus origin/main.",
              "Tape : git pull --rebase (si tu as déjà mergé : git reset --hard HEAD~1 d'abord)",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "Sam's “Add opening hours” is gone from GitHub's main: a force push overwrote it. Never force-push a shared trunk. Restart the lesson and use git pull --rebase.",
        "« Add opening hours » de Sam a disparu du main de GitHub : un force push l'a écrasé. Ne fais jamais de force push sur un tronc partagé. Recommence la leçon et utilise git pull --rebase.",
      ],
      [
        "A merge commit reached GitHub's main. Trunk-based teams keep history linear: restart the lesson and use git pull --rebase instead of git pull.",
        "Un commit de merge est arrivé sur le main de GitHub. Les équipes trunk-based gardent un historique linéaire : recommence la leçon et utilise git pull --rebase au lieu de git pull.",
      ],
      [
        "git pull merged instead of rebasing: see the merge commit at the top of the graph. Undo it with git reset --hard HEAD~1, then run git pull --rebase.",
        "git pull a fait un merge au lieu d'un rebase : regarde le commit de merge en haut du graphe. Annule-le avec git reset --hard HEAD~1, puis lance git pull --rebase.",
      ],
      [
        "Your main and origin/main have diverged. git pull --rebase replays your commits on top of Sam's.",
        "Ton main et origin/main ont divergé. git pull --rebase rejoue tes commits par-dessus ceux de Sam.",
      ],
    ],
  },
  releases: {
    title: "Gérer les versions",
    tagline: "Versions sémantiques, tags, releases GitHub et hotfixes",
    concepts: ["versionnage sémantique", "tags annotés", "releases GitHub", "branches de hotfix"],
    recap: [
      "Versionnage sémantique : MAJEUR.MINEUR.CORRECTIF. Changement cassant, nouvelle fonctionnalité, correction de bug.",
      "Une release, c'est un tag (git tag -a v1.0.0 -m …), poussé par son nom (git push origin v1.0.0), puis publié avec gh release create.",
      "Une branche de hotfix part du tag publié, pas de main : elle livre la correction et rien d'autre.",
      "Ramène toujours la correction sur main (merge ou cherry-pick), sinon la prochaine version ramène le bug.",
    ],
    steps: [
      {
        title: "Des numéros de version qui ont un sens",
        body: [
          "Quand tu livres, les gens ont besoin d'un nom pour ce qu'ils ont reçu. La plupart des projets utilisent le versionnage sémantique : MAJEUR.MINEUR.CORRECTIF (MAJOR.MINOR.PATCH), comme 1.4.2.",
          "CORRECTIF (1.4.2 → 1.4.3) : uniquement des corrections de bugs. MINEUR (1.4.3 → 1.5.0) : de nouvelles fonctionnalités, et rien de ce qui marchait ne casse. MAJEUR (1.5.0 → 2.0.0) : un changement cassant, les utilisateurs doivent s'adapter. 1.0.0 est la première version que tu promets de garder stable.",
          "Dans Git, une version est un tag : une étiquette sur un commit qui ne bouge jamais, contrairement à une branche. Le coffee shop que tu viens de cloner est prêt à partir. Il devient la v1.0.0.",
        ],
      },
      {
        title: "Tague la version",
        body: "Crée un tag annoté sur ton dernier commit. -a le rend annoté, et -m lui donne un message.",
        success:
          "Rien ne s'affiche, mais regarde le graphe : le tag v1.0.0 est sur « Add shopping cart ». Un tag annoté enregistre aussi qui l'a créé et quand : c'est pour ça que les équipes l'utilisent pour les versions.",
      },
      {
        title: "Pousse le tag",
        body: "Un simple git push n'envoie pas les tags. Pousse celui-ci par son nom.",
        success: "« * [new tag] v1.0.0 -> v1.0.0 » (nouveau tag) : GitHub a le tag. (git push --tags pousserait tous tes tags d'un coup.)",
      },
      {
        title: "Publie la release",
        body: "Une release GitHub transforme un tag en une page facile à trouver, avec des notes sur ce qui a changé. Laisse GitHub écrire les notes à partir des commits.",
        success: "La release v1.0.0 est en ligne : ouvre l'onglet GitHub. --generate-notes a listé tous les commits depuis la release précédente (ici, tous). Utilise --notes \"…\" pour écrire les tiennes.",
      },
      {
        title: "Un bug en production",
        body: [
          "Des clients signalent que le total du panier est faux : 2 cafés à 3 coûtent 5. cart.js additionne le prix et la quantité au lieu de les multiplier.",
          "Tu ne peux pas livrer main tel quel : Maya y a poussé sa page de recherche pas finie depuis ton clone. Publier main livrerait du travail à moitié fait.",
          "La solution : une branche de hotfix qui part du tag, pas de main : git switch -c hotfix/1.0.1 v1.0.0. Tu as exactement ce qu'ont les utilisateurs, tu corriges seulement le bug, et tu publies la 1.0.1 (un CORRECTIF : une correction, rien de nouveau).",
          "Ensuite, ramène la correction sur main, avec git merge ou git cherry-pick. Sinon la prochaine version ramène le bug.",
        ],
      },
      {
        title: "Boss : livre le hotfix 1.0.1",
        body: "Crée hotfix/1.0.1 à partir de v1.0.0 et corrige cart.js pour que total multiplie price par qty. Commite, tague en v1.0.1, pousse le tag et publie la release sur GitHub. Puis ramène la correction dans main (avec le travail de Maya) et fais un push de main.",
        objectives: [
          {
            label: "Commite la correction de cart.js sur hotfix/1.0.1, partie de v1.0.0",
            hints: [
              "Pars de ce qu'ont les utilisateurs (le tag), pas de main, qui contient du travail pas encore publié.",
              "git switch -c hotfix/1.0.1 v1.0.0, puis modifie cart.js et commite.",
              'git switch -c hotfix/1.0.1 v1.0.0, puis dans cart.js remplace « price + qty » par « price * qty », puis git commit -am "Fix cart total"',
            ],
          },
          {
            label: "Tague la correction en v1.0.1 et pousse le tag",
            hints: ["1.0.0 + une correction de bug = 1.0.1 (CORRECTIF).", "git tag -a sur le commit de hotfix, puis git push origin <tag>.", 'Tape : git tag -a v1.0.1 -m "Fix cart total", puis git push origin v1.0.1'],
          },
          {
            label: "Publie la release v1.0.1 sur GitHub",
            hints: ["Transforme le tag poussé en release.", "gh release create, avec --notes ou --generate-notes.", 'Tape : gh release create v1.0.1 --notes "Fixes the cart total"'],
          },
          {
            label: "Le main de GitHub a la correction et la page de recherche de Maya",
            hints: [
              "main a besoin de la correction aussi, par-dessus le dernier travail de Maya.",
              "Sur main : pull, puis git merge hotfix/1.0.1 (ou git cherry-pick hotfix/1.0.1), puis push.",
              "Tape : git switch main, git pull, git merge hotfix/1.0.1, git push",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "Your v1.0.1 tag includes Maya's unfinished search page: it was made from main. Delete it with git tag -d v1.0.1 (and git push origin --delete v1.0.1 if you pushed it), then tag the commit on hotfix/1.0.1.",
        "Ton tag v1.0.1 contient la page de recherche pas finie de Maya : il a été créé depuis main. Supprime-le avec git tag -d v1.0.1 (et git push origin --delete v1.0.1 si tu l'as poussé), puis tague le commit de hotfix/1.0.1.",
      ],
      [
        "hotfix/1.0.1 contains Maya's unreleased search page because it started from main. Start over from the tag: git switch main, git branch -D hotfix/1.0.1, then git switch -c hotfix/1.0.1 v1.0.0.",
        "hotfix/1.0.1 contient la page de recherche pas encore publiée de Maya, parce qu'elle est partie de main. Recommence depuis le tag : git switch main, git branch -D hotfix/1.0.1, puis git switch -c hotfix/1.0.1 v1.0.0.",
      ],
      ["v1.0.1 exists only on your computer. Push it: git push origin v1.0.1.", "v1.0.1 n'existe que sur ton ordinateur. Pousse-le : git push origin v1.0.1."],
      [
        'The tag is on GitHub. Now publish it: gh release create v1.0.1 --notes "Fixes the cart total".',
        'Le tag est sur GitHub. Publie-le maintenant : gh release create v1.0.1 --notes "Fixes the cart total".',
      ],
      ["Your main has the fix. Push it: git push (if it's rejected, git pull first).", "Ton main a la correction. Fais un push : git push (s'il est refusé, fais d'abord un git pull)."],
      [
        "v1.0.1 is out! Now bring the fix to main: git switch main, git pull, git merge hotfix/1.0.1, then git push.",
        "La v1.0.1 est sortie ! Ramène maintenant la correction sur main : git switch main, git pull, git merge hotfix/1.0.1, puis git push.",
      ],
    ],
  },
};
