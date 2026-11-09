import { ancestors, currentBranch, headCommitId, type World } from "@/engine";
import * as c from "../checks";
import type { LessonText } from "../localize";
import { scenario } from "../scenario";
import type { Lesson } from "../types";

// Chapter 10 — Advanced Git, part A: cherry-pick, stash, tags.

const LOCAL_UI = { files: true, editor: true, stages: false, remote: false };

const short = (id: string | undefined) => (id ?? "").slice(0, 7);
const tipTree = (w: World, branch: string) => {
  const id = w.repo?.branches[branch];
  return id ? w.repo!.commits[id].tree : undefined;
};

// ───────────────────────────────────────────── Cherry-pick

const PRICES = "export const price = (cents) => (cents / 100).toFixed(1);\n";
const PRICES_FIXED = "export const price = (cents) => (cents / 100).toFixed(2);\n";
const FOOTER = "<footer>\n  <p>Sunny Bakery · 12 Bread Street</p>\n</footer>\n";
const FOOTER_HOURS = "<footer>\n  <p>Sunny Bakery · 12 Bread Street</p>\n  <p>Opne every day, 7am to 7pm</p>\n</footer>\n";
const FOOTER_FIXED = "<footer>\n  <p>Sunny Bakery · 12 Bread Street</p>\n  <p>Open every day, 7am to 7pm</p>\n</footer>\n";

/** main = the live shop; feature/checkout = Sam's unfinished branch with five commits. */
const bakeryCheckout = (): World =>
  scenario()
    .run("git init")
    .commit("Start shop", { "index.html": "<h1>Sunny Bakery</h1>\n", "prices.js": PRICES, "footer.html": FOOTER }, "Maya")
    .run("git switch -c feature/checkout")
    .commit("Add cart page", { "cart.html": "<h1>Your cart</h1>\n" }, "Sam")
    .commit("Fix price rounding", { "prices.js": PRICES_FIXED }, "Sam")
    .commit("Add opening hours", { "footer.html": FOOTER_HOURS }, "Sam")
    .commit("Add checkout form", { "checkout.html": "<form>\n  <button>Pay</button>\n</form>\n" }, "Sam")
    .commit("Fix opening hours typo", { "footer.html": FOOTER_FIXED }, "Sam")
    .run("git switch main")
    .done();

const CP = (() => {
  const w = bakeryCheckout();
  return {
    rounding: short(c.findCommit(w, "Fix price rounding")),
    hours: short(c.findCommit(w, "Add opening hours")),
    typo: short(c.findCommit(w, "Fix opening hours typo")),
  };
})();

/** A copy of `message` is on main: same message, different id from the original on feature/checkout. */
const copyOnMain = (w: World, start: World, message: string) => {
  const original = c.findCommit(start, message);
  if (!w.repo?.branches.main || !original) return undefined;
  return Object.values(w.repo.commits).find((k) => k.message === message && k.id !== original && c.branchContains(w, "main", k.id))?.id;
};

const cherryPick: Lesson = {
  id: "cherry-pick",
  chapterId: "advanced",
  title: "Cherry-pick",
  tagline: "Copy one commit, not the whole branch",
  xp: 180,
  concepts: ["cherry-pick", "commit copies", "new commit ids"],
  commands: ["git log --oneline <branch>", "git cherry-pick <id>", "git cherry-pick --abort"],
  ui: LOCAL_UI,
  setup: bakeryCheckout,
  recap: [
    "git cherry-pick <id> copies one commit's change onto the branch you're on.",
    "The copy is a NEW commit with a new id: same change and message, different parent.",
    "Pick several commits in the order they were made, oldest first, or later ones may not apply.",
    "If a pick goes wrong mid-way, git cherry-pick --abort puts everything back.",
  ],
  steps: [
    {
      kind: "discover",
      title: "One commit, not the whole branch",
      body: [
        "Sam is building a checkout for the bakery's website on feature/checkout. It has five commits and it's not finished.",
        "Hidden in the middle is “Fix price rounding”: prices show as €3.5 instead of €3.50. Customers see that today, so main needs the fix now. Merging would bring the half-built checkout along with it.",
        "git cherry-pick copies just one commit's change onto the branch you're on. You pick it by its id.",
      ],
      scene: "branch-split",
    },
    {
      kind: "try",
      title: "Find the commit",
      body: "You're on main. List the commits of Sam's branch, one line each. Give git log a branch name to see that branch's history instead of yours.",
      command: "git log --oneline feature/checkout",
      check: (_w, _s, ran) => ran.includes("log"),
      success: `Newest first. “Fix price rounding” is ${CP.rounding}. The last line is “Start shop”, where Sam's branch split from main.`,
    },
    {
      kind: "try",
      title: "Copy it onto main",
      body: `Copy “Fix price rounding” onto main: git cherry-pick followed by its id, ${CP.rounding}.`,
      command: `git cherry-pick ${CP.rounding}`,
      check: (w) => c.onBranch(w, "main") && tipTree(w, "main")?.["prices.js"] === PRICES_FIXED,
      success: `The fix is on main, and only the fix: no cart page, no checkout. Look at the id in brackets: it isn't ${CP.rounding}. A commit's id depends on its parent too, and the copy sits on a different parent, so it's a NEW commit with the same change. Sam's original hasn't moved.`,
      hint: `Copy the id from the log: git cherry-pick ${CP.rounding}`,
    },
    {
      kind: "experiment",
      title: "Two commits, same change",
      body: "Look at the graph: “Fix price rounding” now appears twice, once on each branch. Try main..feature/checkout, which lists what feature/checkout has that main doesn't. The fix is still there, because to Git the copy is a different commit.",
      ideas: ["git log --oneline --graph --all", "git log --oneline main..feature/checkout", "git show HEAD"],
    },
    {
      kind: "challenge",
      title: "Challenge: the opening hours",
      body: "The bakery wants its opening hours on the site today too. On Sam's branch they took two commits: “Add opening hours” and then “Fix opening hours typo”. Copy both onto main, oldest first. Leave the cart and the checkout behind, and don't change feature/checkout.",
      objectives: [
        {
          id: "hours",
          label: "main has a copy of “Add opening hours”",
          check: (w, s) => !!copyOnMain(w, s, "Add opening hours"),
          hints: [
            "Cherry-pick copies a commit onto the branch you're on, so stay on main.",
            "Find the id with git log --oneline feature/checkout, then git cherry-pick <id>.",
            `Type: git cherry-pick ${CP.hours}`,
          ],
        },
        {
          id: "typo",
          label: "…followed by a copy of “Fix opening hours typo”",
          check: (w, s) => {
            const hours = copyOnMain(w, s, "Add opening hours");
            const typo = copyOnMain(w, s, "Fix opening hours typo");
            return !!hours && !!typo && ancestors(w.repo!, typo).has(hours) && tipTree(w, "main")?.["footer.html"] === FOOTER_FIXED;
          },
          hints: [
            "The typo fix changes a line that “Add opening hours” created, so it can only be copied after it.",
            "Cherry-pick the typo fix once the hours are on main. You can also give both ids at once, oldest first.",
            `Type: git cherry-pick ${CP.typo}  (or both at once: git cherry-pick ${CP.hours} ${CP.typo})`,
          ],
        },
        {
          id: "rest",
          label: "No cart or checkout on main, and feature/checkout untouched",
          check: (w, s) => {
            const tree = tipTree(w, "main");
            return !!tree && !("cart.html" in tree) && !("checkout.html" in tree) && w.repo!.branches["feature/checkout"] === s.repo!.branches["feature/checkout"];
          },
          hints: [
            "Merging would bring all five commits. You only want two of them.",
            "Use git cherry-pick only, from main. Don't merge and don't commit on feature/checkout.",
            "If cart.html reached main, restart the lesson and cherry-pick the two commits one by one.",
          ],
        },
      ],
      feedback: (w) => {
        if (!w.repo) return null;
        if (w.repo.op?.kind === "cherry-pick")
          return "Conflict: the copy doesn't fit. You probably picked the typo fix before the commit that adds the hours. Run git cherry-pick --abort to undo this pick, then copy “Add opening hours” first.";
        if (currentBranch(w.repo) !== "main") return "You're not on main. Cherry-pick copies commits onto the branch you're on: git switch main first.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Stash

const STYLE = "body {\n  background: white;\n  color: black;\n}\n";
const STYLE_DARK = "body {\n  background: white;\n  color: black;\n}\n\n.dark {\n  background: #111;\n}\n";
const STYLE_WIP = "body {\n  background: white;\n  color: black;\n}\n\n.dark {\n  background: #111;\n  color: #eee;\n}\n";
const INDEX = "<h1>Sunny Bakery</h1>\n";
const INDEX_DARK = "<h1>Sunny Bakery</h1>\n<button>Dark mode</button>\n";
const INDEX_WIP = '<h1>Sunny Bakery</h1>\n<button onclick="toggleDark()">Dark mode</button>\n';
const NOTICE = "<p>Opne every day, 7am to 7pm</p>\n";
const NOTICE_FIXED = "<p>Open every day, 7am to 7pm</p>\n";

/** You're halfway through dark mode on feature/dark-mode: two files edited, nothing committed. */
const midEdit = (): World =>
  scenario()
    .run("git init")
    .commit("Start website", { "index.html": INDEX, "style.css": STYLE, "hours.html": NOTICE }, "Maya")
    .run("git switch -c feature/dark-mode")
    .commit("Add dark mode button", { "index.html": INDEX_DARK, "style.css": STYLE_DARK })
    .files({ "index.html": INDEX_WIP, "style.css": STYLE_WIP })
    .done();

const workRestored = (w: World, s: World) =>
  c.onBranch(w, "feature/dark-mode") &&
  w.workdir["style.css"] === STYLE_WIP &&
  w.workdir["index.html"] === INDEX_WIP &&
  w.repo!.branches["feature/dark-mode"] === s.repo!.branches["feature/dark-mode"];

const mainFixed = (w: World, s: World) => {
  const tree = tipTree(w, "main");
  const before = tipTree(s, "main");
  return !!tree && !!before && tree["hours.html"] === NOTICE_FIXED && tree["style.css"] === before["style.css"] && tree["index.html"] === before["index.html"];
};

const stash: Lesson = {
  id: "stash",
  chapterId: "advanced",
  title: "Stash",
  tagline: "Put half-done work aside, then get it back",
  xp: 180,
  concepts: ["stash", "interruptions", "uncommitted work"],
  commands: ["git stash", "git stash push -m", "git stash list", "git stash pop"],
  ui: LOCAL_UI,
  setup: midEdit,
  recap: [
    "Git won't switch branches if that would overwrite edits you haven't committed.",
    "git stash puts your uncommitted edits aside and leaves your files clean. git stash push -m \"…\" gives them a label.",
    "git stash list shows what's put aside; stash@{0} is the most recent.",
    "git stash pop brings the latest stash back into your files and removes it from the list.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Interrupted mid-edit",
      body: [
        "You're halfway through dark mode on feature/dark-mode. You've edited index.html and style.css, and none of it works yet.",
        "Then Maya messages you: the live site says “Opne every day”. Can you fix it on main right now?",
        "You don't want to commit half-done work just to switch branches. git stash puts your edits aside, gives you clean files, and gives them back when you're ready.",
      ],
      scene: "three-areas",
    },
    {
      kind: "experiment",
      title: "Try to leave",
      body: "Try git switch main. Git refuses: “Your local changes to the following files would be overwritten by checkout”. Both files are different on main, so switching would erase your edits, and Git won't do that. git status shows what's at stake.",
      ideas: ["git switch main", "git status", "git diff"],
    },
    {
      kind: "try",
      title: "Put your work aside",
      body: "Stash your edits.",
      command: "git stash",
      check: (w) => !!w.repo && w.repo.stash.length === 1 && c.clean(w),
      success: "“Saved working directory and index state WIP on feature/dark-mode…”. Your two edits are tucked away and your files are back to the last commit. Open style.css: the unfinished lines are gone, for now.",
    },
    {
      kind: "try",
      title: "See what's put aside",
      body: "List your stashes.",
      command: "git stash list",
      check: (_w, _s, ran) => ran.includes("stash"),
      success: "stash@{0} is your work, labelled “WIP on feature/dark-mode” with the commit it started from. Stashes pile up like a stack: the newest is always stash@{0}.",
    },
    {
      kind: "try",
      title: "Get it back",
      body: "Before trusting the stash with real work, check that it gives everything back. Pop it.",
      command: "git stash pop",
      check: (w) => !!w.repo && w.repo.stash.length === 0 && w.workdir["style.css"] === STYLE_WIP && w.workdir["index.html"] === INDEX_WIP,
      success: "“Dropped refs/stash@{0}”: both edits are back exactly as they were, and git stash list is empty again. pop = apply the latest stash, then drop it from the list. Now use it for real.",
    },
    {
      kind: "challenge",
      title: "Challenge: fix main without losing your work",
      body: "Stash your dark-mode edits with a label (git stash push -m \"dark mode\"), switch to main, fix “Opne” → “Open” in hours.html and commit it. Then come back to feature/dark-mode and restore your edits, so that nothing is lost and the stash list ends up empty.",
      objectives: [
        {
          id: "fix",
          label: "main has the typo fix, and nothing else",
          check: (w, s) => mainFixed(w, s),
          hints: [
            "Your edits have to go somewhere safe before Git lets you switch.",
            "git stash push -m \"dark mode\", then git switch main. Fix hours.html in the editor and commit it.",
            "git stash push -m \"dark mode\" → git switch main → in the Files panel, click hours.html and change Opne to Open → git commit -am \"Fix opening hours typo\"",
          ],
        },
        {
          id: "back",
          label: "Your dark-mode edits are back on feature/dark-mode",
          check: (w, s) => mainFixed(w, s) && workRestored(w, s),
          hints: [
            "Go back to your branch, then bring the stash back.",
            "git switch feature/dark-mode, then git stash pop.",
            "Type: git switch feature/dark-mode — then: git stash pop",
          ],
        },
        {
          id: "empty",
          label: "The stash list is empty",
          check: (w, s) => mainFixed(w, s) && !!w.repo && w.repo.stash.length === 0 && workRestored(w, s),
          hints: [
            "pop removes the stash after applying it; apply keeps it.",
            "Check with git stash list.",
            "On feature/dark-mode, type: git stash pop",
          ],
        },
      ],
      feedback: (w, s) => {
        if (!w.repo) return null;
        if (w.repo.branches["feature/dark-mode"] !== s.repo!.branches["feature/dark-mode"])
          return "feature/dark-mode got a new commit. The point is to keep half-done work out of history: run git reset HEAD~1 on that branch (your edits stay in your files), then stash them.";
        const branch = currentBranch(w.repo);
        if (branch === "main" && w.workdir["hours.html"] === NOTICE_FIXED && !mainFixed(w, s))
          return "hours.html is fixed in your files, but not committed yet: git commit -am \"Fix opening hours typo\".";
        if (mainFixed(w, s) && w.repo.stash.length && branch === "main")
          return "main is fixed. Now go back to feature/dark-mode and bring your work back with git stash pop.";
        if (mainFixed(w, s) && w.repo.stash.length && branch === "feature/dark-mode")
          return "Your dark-mode edits are still in the stash. Run git stash pop.";
        if (mainFixed(w, s) && !w.repo.stash.length && branch === "feature/dark-mode" && !workRestored(w, s))
          return "The stash is empty but your edits aren't back. If you dropped it, restart the lesson and use pop, not drop.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Tags

const SITE_URL = "https://github.com/gitverse-team/website.git";

/** The team website on GitHub, plus a v1.0.0 you put on the wrong commit last night (not pushed). */
const siteToTag = (): World =>
  scenario()
    .run("git init")
    .commit("Start website", { "README.md": "# Team Website\n", "index.html": "<h1>Welcome!</h1>\n" }, "Maya")
    .commit("Add styles", { "style.css": STYLE })
    .commit("Add contact page", { "contact.html": "<h1>Contact</h1>\n" }, "Sam")
    .commit("Launch website", { "index.html": "<h1>Welcome!</h1>\n<p>We're live!</p>\n" }, "Maya")
    .commit("Add blog page", { "blog.html": "<h1>Blog</h1>\n" }, "Sam")
    .commit("Add dark mode", { "style.css": STYLE_DARK })
    .host(SITE_URL, "gitverse-team", "website")
    .run(`git remote add origin ${SITE_URL}`, "git push -u origin main", "git tag v1.0.0")
    .done();

const TG = (() => {
  const w = siteToTag();
  return {
    contact: short(c.findCommit(w, "Add contact page")),
    launch: short(c.findCommit(w, "Launch website")),
    head: short(headCommitId(w.repo!) ?? undefined),
  };
})();

const tagAt = (w: World, tag: string, message: string) => !!w.repo?.tags[tag] && w.repo.tags[tag] === c.findCommit(w, message);
const onGitHub = (w: World, tag: string) => !!w.repo?.tags[tag] && w.hosted[SITE_URL]?.tags?.[tag] === w.repo.tags[tag];

const tags: Lesson = {
  id: "tags",
  chapterId: "advanced",
  title: "Tags",
  tagline: "Name the commits that matter",
  xp: 200,
  concepts: ["tag", "lightweight vs annotated", "versions", "pushing tags"],
  commands: ["git tag <name> [<id>]", "git tag -a <name> -m", "git tag -d", "git show <tag>", "git push origin <tag>", "git push --tags"],
  ui: { files: true, editor: false, stages: false, remote: true },
  setup: siteToTag,
  recap: [
    "A tag is a name stuck on one commit. Unlike a branch, it never moves.",
    "git tag v1.1.0 tags HEAD; add a commit id to tag an older commit. Use -a -m for releases: annotated tags record who, when and why.",
    "Tags stay on your computer until you push them: git push origin <tag>, or git push --tags for all of them.",
    "git tag -d removes a misplaced tag. Only the label goes; the commit stays.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Bookmarks that never move",
      body: [
        "The team website went live last month from the commit “Launch website”. Since then you've added a blog and dark mode, and today that ships as version 1.1.0. But nobody wrote down which commit was which version.",
        "A tag is a name stuck on one commit, like v1.0.0. A branch label moves forward every time you commit. A tag stays where you put it, so v1.0.0 means the same snapshot forever.",
        "There are two kinds. A lightweight tag (git tag v0.9) is just the name. An annotated tag (git tag -a v1.0.0 -m \"First launch\") also stores who made it, when, and a message. Use annotated tags for releases.",
      ],
      scene: "history",
    },
    {
      kind: "try",
      title: "Remove a misplaced tag",
      body: "Last night you started tagging and put v1.0.0 on your newest commit: see its label next to “Add dark mode” in the graph. That's not what launched. A tag shouldn't move, so delete it and start again. You never pushed it, so nobody else has it.",
      command: "git tag -d v1.0.0",
      check: (w) => !!w.repo && !w.repo.tags["v1.0.0"],
      success: `“Deleted tag 'v1.0.0' (was ${TG.head})”. Only the label is gone: “Add dark mode” is still there. Deleting a tag never deletes commits.`,
    },
    {
      kind: "try",
      title: "Tag an older commit",
      body: `Before the launch, you shared a beta with friends from “Add contact page” (${TG.contact}). Give that commit a lightweight tag: put its id after the tag name. Without an id, git tag tags HEAD.`,
      command: `git tag v0.9 ${TG.contact}`,
      check: (w) => tagAt(w, "v0.9", "Add contact page"),
      success: "No output means it worked. In the graph, v0.9 now sits on “Add contact page”, three commits back. The commit didn't change; it just has a name now.",
      hint: `The commit id goes last: git tag v0.9 ${TG.contact}`,
    },
    {
      kind: "try",
      title: "Publish the tag",
      body: "Tags stay on your computer until you push them, and a plain git push doesn't send them. Push this one by name, then look at the GitHub panel.",
      command: "git push origin v0.9",
      check: (w) => onGitHub(w, "v0.9"),
      success: "“* [new tag] v0.9 -> v0.9”: GitHub has the tag now. Anyone who fetches gets it too, so the whole team can find the beta by its name.",
    },
    {
      kind: "experiment",
      title: "Look around",
      body: "git tag lists your tags. git show v0.9 shows the commit a tag points to and what it changed. In git log, tags appear as “tag: v0.9” next to their commit.",
      ideas: ["git tag", "git show v0.9", "git log --oneline"],
    },
    {
      kind: "challenge",
      title: "Challenge: tag the real releases",
      body: "Tag “Launch website” as v1.0.0 with an annotated tag, tag your newest commit as v1.1.0, and publish both tags to GitHub.",
      objectives: [
        {
          id: "v1",
          label: "v1.0.0 marks “Launch website”",
          check: (w) => tagAt(w, "v1.0.0", "Launch website"),
          hints: [
            "To tag an older commit, put its id after the tag name. For a release, make it annotated.",
            "git tag -a <name> -m \"<message>\" <id>. Find the id with git log --oneline.",
            `Type: git tag -a v1.0.0 -m "First public launch" ${TG.launch}`,
          ],
        },
        {
          id: "v11",
          label: "v1.1.0 marks your newest commit",
          check: (w) => tagAt(w, "v1.1.0", "Add dark mode"),
          hints: [
            "Without an id, git tag tags HEAD, your newest commit.",
            "git tag -a v1.1.0 -m \"<message>\"",
            'Type: git tag -a v1.1.0 -m "Blog and dark mode"',
          ],
        },
        {
          id: "pushed",
          label: "GitHub has both tags",
          check: (w) => tagAt(w, "v1.0.0", "Launch website") && tagAt(w, "v1.1.0", "Add dark mode") && onGitHub(w, "v1.0.0") && onGitHub(w, "v1.1.0"),
          hints: [
            "A plain git push doesn't send tags.",
            "Push them by name, or push all your tags at once.",
            "Type: git push origin v1.0.0 v1.1.0  (or: git push --tags)",
          ],
        },
      ],
      feedback: (w) => {
        if (!w.repo) return null;
        const hosted = w.hosted[SITE_URL]?.tags ?? {};
        for (const [tag, msg] of [["v1.0.0", "Launch website"], ["v1.1.0", "Add dark mode"]] as const) {
          const right = c.findCommit(w, msg);
          if (hosted[tag] && hosted[tag] !== right)
            return `${tag} is on the wrong commit on GitHub. Delete it there with git push origin --delete ${tag}, fix it locally (git tag -d ${tag}, then tag the right commit), and push it again.`;
          if (w.repo.tags[tag] && w.repo.tags[tag] !== right)
            return `${tag} is on the wrong commit: it should mark “${msg}”. Delete it with git tag -d ${tag} and tag the right commit.`;
        }
        if (tagAt(w, "v1.0.0", "Launch website") && tagAt(w, "v1.1.0", "Add dark mode") && !(onGitHub(w, "v1.0.0") && onGitHub(w, "v1.1.0")))
          return "Both tags are right, but they only exist on your computer. Push them: git push origin v1.0.0 v1.1.0 (or git push --tags).";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

export const ADV_A_LESSONS: Lesson[] = [cherryPick, stash, tags];

// ───────────────────────────────────────────── French

export const ADV_A_FR: Record<string, LessonText> = {
  "cherry-pick": {
    title: "Cherry-pick",
    tagline: "Copier un commit, pas toute la branche",
    concepts: ["cherry-pick", "copies de commits", "nouveaux identifiants"],
    recap: [
      "git cherry-pick <id> copie la modification d'un commit sur la branche où tu te trouves.",
      "La copie est un NOUVEAU commit avec un nouvel identifiant : même modification, même message, mais un parent différent.",
      "Pour plusieurs commits, prends-les dans l'ordre où ils ont été faits, du plus ancien au plus récent, sinon les suivants risquent de ne pas s'appliquer.",
      "Si une copie tourne mal en cours de route, git cherry-pick --abort remet tout comme avant.",
    ],
    steps: [
      {
        title: "Un commit, pas toute la branche",
        body: [
          "Sam construit un système de paiement pour le site de la boulangerie, sur feature/checkout. La branche a cinq commits et elle n'est pas finie.",
          "Au milieu se cache « Fix price rounding » : les prix s'affichent 3.5 € au lieu de 3.50 €. Les clients le voient aujourd'hui, donc main a besoin de la correction tout de suite. Un merge amènerait aussi le paiement à moitié construit.",
          "git cherry-pick copie la modification d'un seul commit sur la branche où tu te trouves. Tu le désignes par son identifiant.",
        ],
      },
      {
        title: "Trouve le commit",
        body: "Tu es sur main. Liste les commits de la branche de Sam, un par ligne. Donne un nom de branche à git log pour voir l'historique de cette branche au lieu du tien.",
        success: `Le plus récent en premier. « Fix price rounding » est ${CP.rounding}. La dernière ligne est « Start shop », là où la branche de Sam s'est séparée de main.`,
      },
      {
        title: "Copie-le sur main",
        body: `Copie « Fix price rounding » sur main : git cherry-pick suivi de son identifiant, ${CP.rounding}.`,
        success: `La correction est sur main, et seulement elle : pas de page panier, pas de paiement. Regarde l'identifiant entre crochets : ce n'est pas ${CP.rounding}. L'identifiant d'un commit dépend aussi de son parent, et la copie a un autre parent : c'est donc un NOUVEAU commit avec la même modification. L'original de Sam n'a pas bougé.`,
        hint: `Copie l'identifiant depuis le log : git cherry-pick ${CP.rounding}`,
      },
      {
        title: "Deux commits, une même modification",
        body: "Regarde le graphe : « Fix price rounding » apparaît maintenant deux fois, une sur chaque branche. Essaie main..feature/checkout, qui liste ce que feature/checkout a et que main n'a pas. La correction y est toujours, car pour Git la copie est un autre commit.",
      },
      {
        title: "Défi : les horaires d'ouverture",
        body: "La boulangerie veut aussi ses horaires d'ouverture sur le site dès aujourd'hui. Sur la branche de Sam, ils ont pris deux commits : « Add opening hours » puis « Fix opening hours typo ». Copie les deux sur main, du plus ancien au plus récent. Laisse le panier et le paiement de côté, et ne modifie pas feature/checkout.",
        objectives: [
          {
            label: "main a une copie de « Add opening hours »",
            hints: [
              "Cherry-pick copie un commit sur la branche où tu te trouves : reste sur main.",
              "Trouve l'identifiant avec git log --oneline feature/checkout, puis git cherry-pick <id>.",
              `Tape : git cherry-pick ${CP.hours}`,
            ],
          },
          {
            label: "…suivie d'une copie de « Fix opening hours typo »",
            hints: [
              "La correction de la faute modifie une ligne créée par « Add opening hours » : elle ne peut être copiée qu'après.",
              "Fais le cherry-pick de la correction une fois les horaires sur main. Tu peux aussi donner les deux identifiants d'un coup, le plus ancien en premier.",
              `Tape : git cherry-pick ${CP.typo}  (ou les deux d'un coup : git cherry-pick ${CP.hours} ${CP.typo})`,
            ],
          },
          {
            label: "Ni panier ni paiement sur main, et feature/checkout intacte",
            hints: [
              "Un merge amènerait les cinq commits. Tu n'en veux que deux.",
              "Utilise uniquement git cherry-pick, depuis main. Pas de merge, et pas de commit sur feature/checkout.",
              "Si cart.html est arrivé sur main, recommence la leçon et copie les deux commits un par un.",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "Conflict: the copy doesn't fit. You probably picked the typo fix before the commit that adds the hours. Run git cherry-pick --abort to undo this pick, then copy “Add opening hours” first.",
        "Conflit : la copie ne s'applique pas. Tu as sûrement pris la correction de la faute avant le commit qui ajoute les horaires. Lance git cherry-pick --abort pour annuler cette copie, puis copie d'abord « Add opening hours ».",
      ],
      [
        "You're not on main. Cherry-pick copies commits onto the branch you're on: git switch main first.",
        "Tu n'es pas sur main. Cherry-pick copie les commits sur la branche où tu te trouves : fais d'abord git switch main.",
      ],
    ],
  },
  stash: {
    title: "Stash",
    tagline: "Mettre de côté un travail en cours, puis le récupérer",
    concepts: ["stash", "interruptions", "travail non commité"],
    recap: [
      "Git refuse de changer de branche si ça écraserait des modifications que tu n'as pas commitées.",
      "git stash met tes modifications non commitées de côté et te rend des fichiers propres. git stash push -m \"…\" leur donne une étiquette.",
      "git stash list montre ce qui est mis de côté ; stash@{0} est le plus récent.",
      "git stash pop remet le dernier stash dans tes fichiers et le retire de la liste.",
    ],
    steps: [
      {
        title: "Interrompu en plein travail",
        body: [
          "Tu es en plein mode sombre sur feature/dark-mode. Tu as modifié index.html et style.css, et rien ne marche encore.",
          "Et là, Maya t'écrit : le site en ligne affiche « Opne every day ». Tu peux corriger ça sur main tout de suite ?",
          "Tu n'as pas envie de commiter un travail à moitié fait juste pour changer de branche. git stash met tes modifications de côté, te rend des fichiers propres, et te les redonne quand tu es prêt.",
        ],
      },
      {
        title: "Essaie de partir",
        body: "Essaie git switch main. Git refuse : « Your local changes to the following files would be overwritten by checkout » (tes modifications locales seraient écrasées). Les deux fichiers sont différents sur main : changer de branche effacerait tes modifications, et Git ne le fera pas. git status montre ce qui est en jeu.",
      },
      {
        title: "Mets ton travail de côté",
        body: "Mets tes modifications dans le stash.",
        success: "« Saved working directory and index state WIP on feature/dark-mode… » (état du répertoire de travail sauvegardé). Tes deux modifications sont rangées et tes fichiers sont revenus au dernier commit. Ouvre style.css : les lignes inachevées ont disparu, pour l'instant.",
      },
      {
        title: "Vois ce qui est de côté",
        body: "Liste tes stashs.",
        success: "stash@{0}, c'est ton travail, étiqueté « WIP on feature/dark-mode » avec le commit d'où il part. Les stashs s'empilent : le plus récent est toujours stash@{0}.",
      },
      {
        title: "Récupère-le",
        body: "Avant de confier du vrai travail au stash, vérifie qu'il rend tout. Fais un pop.",
        success: "« Dropped refs/stash@{0} » (stash supprimé de la liste) : tes deux modifications sont revenues exactement comme avant, et git stash list est de nouveau vide. pop = appliquer le dernier stash, puis le retirer de la liste. Maintenant, sers-t'en pour de vrai.",
      },
      {
        title: "Défi : réparer main sans perdre ton travail",
        body: "Mets tes modifications du mode sombre dans le stash avec une étiquette (git stash push -m \"dark mode\"), passe sur main, corrige « Opne » en « Open » dans hours.html et commite. Puis reviens sur feature/dark-mode et récupère tes modifications : rien ne doit être perdu, et la liste des stashs doit finir vide.",
        objectives: [
          {
            label: "main a la correction de la faute, et rien d'autre",
            hints: [
              "Tes modifications doivent être en sécurité avant que Git te laisse changer de branche.",
              "git stash push -m \"dark mode\", puis git switch main. Corrige hours.html dans l'éditeur et commite.",
              "git stash push -m \"dark mode\" → git switch main → dans le panneau Fichiers, clique sur hours.html et remplace Opne par Open → git commit -am \"Fix opening hours typo\"",
            ],
          },
          {
            label: "Tes modifications du mode sombre sont revenues sur feature/dark-mode",
            hints: [
              "Retourne sur ta branche, puis récupère le stash.",
              "git switch feature/dark-mode, puis git stash pop.",
              "Tape : git switch feature/dark-mode — puis : git stash pop",
            ],
          },
          {
            label: "La liste des stashs est vide",
            hints: [
              "pop retire le stash après l'avoir appliqué ; apply le garde.",
              "Vérifie avec git stash list.",
              "Sur feature/dark-mode, tape : git stash pop",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        "feature/dark-mode got a new commit. The point is to keep half-done work out of history: run git reset HEAD~1 on that branch (your edits stay in your files), then stash them.",
        "feature/dark-mode a reçu un nouveau commit. Le but est de garder le travail à moitié fait hors de l'historique : lance git reset HEAD~1 sur cette branche (tes modifications restent dans tes fichiers), puis mets-les dans le stash.",
      ],
      [
        "hours.html is fixed in your files, but not committed yet: git commit -am \"Fix opening hours typo\".",
        "hours.html est corrigé dans tes fichiers, mais pas encore commité : git commit -am \"Fix opening hours typo\".",
      ],
      [
        "main is fixed. Now go back to feature/dark-mode and bring your work back with git stash pop.",
        "main est corrigé. Retourne maintenant sur feature/dark-mode et récupère ton travail avec git stash pop.",
      ],
      ["Your dark-mode edits are still in the stash. Run git stash pop.", "Tes modifications du mode sombre sont encore dans le stash. Lance git stash pop."],
      [
        "The stash is empty but your edits aren't back. If you dropped it, restart the lesson and use pop, not drop.",
        "Le stash est vide mais tes modifications ne sont pas revenues. Si tu l'as supprimé avec drop, recommence la leçon et utilise pop, pas drop.",
      ],
    ],
  },
  tags: {
    title: "Tags",
    tagline: "Nommer les commits qui comptent",
    concepts: ["tag", "léger ou annoté", "versions", "push des tags"],
    recap: [
      "Un tag est un nom collé sur un commit. Contrairement à une branche, il ne bouge jamais.",
      "git tag v1.1.0 pose un tag sur HEAD ; ajoute un identifiant de commit pour viser un commit plus ancien. Pour une version publiée, utilise -a -m : un tag annoté enregistre qui, quand et pourquoi.",
      "Les tags restent sur ton ordinateur tant que tu ne les pousses pas : git push origin <tag>, ou git push --tags pour tous.",
      "git tag -d supprime un tag mal placé. Seule l'étiquette disparaît ; le commit reste.",
    ],
    steps: [
      {
        title: "Des marque-pages qui ne bougent jamais",
        body: [
          "Le site de l'équipe est en ligne depuis le mois dernier, à partir du commit « Launch website ». Depuis, tu as ajouté un blog et un mode sombre, et aujourd'hui tout ça sort en version 1.1.0. Mais personne n'a noté quel commit correspond à quelle version.",
          "Un tag est un nom collé sur un commit, comme v1.0.0. L'étiquette d'une branche avance à chaque commit. Un tag reste là où tu l'as mis : v1.0.0 désigne le même instantané pour toujours.",
          "Il en existe deux sortes. Un tag léger (git tag v0.9) n'est qu'un nom. Un tag annoté (git tag -a v1.0.0 -m \"First launch\") enregistre aussi qui l'a créé, quand, et un message. Utilise des tags annotés pour les versions publiées.",
        ],
      },
      {
        title: "Supprime un tag mal placé",
        body: "Hier soir, tu as commencé à poser des tags et tu as mis v1.0.0 sur ton commit le plus récent : regarde son étiquette à côté de « Add dark mode » dans le graphe. Ce n'est pas ce qui a été mis en ligne. Un tag ne doit pas bouger : supprime-le et recommence. Tu ne l'as jamais poussé, donc personne d'autre ne l'a.",
        success: `« Deleted tag 'v1.0.0' (was ${TG.head}) » (tag supprimé). Seule l'étiquette a disparu : « Add dark mode » est toujours là. Supprimer un tag ne supprime jamais de commit.`,
      },
      {
        title: "Tague un commit plus ancien",
        body: `Avant la mise en ligne, tu as partagé une bêta avec des amis à partir de « Add contact page » (${TG.contact}). Pose un tag léger sur ce commit : mets son identifiant après le nom du tag. Sans identifiant, git tag vise HEAD.`,
        success: "Pas de message, c'est que ça a marché. Dans le graphe, v0.9 est maintenant sur « Add contact page », trois commits en arrière. Le commit n'a pas changé ; il a juste un nom maintenant.",
        hint: `L'identifiant du commit va à la fin : git tag v0.9 ${TG.contact}`,
      },
      {
        title: "Publie le tag",
        body: "Les tags restent sur ton ordinateur tant que tu ne les pousses pas, et un simple git push ne les envoie pas. Pousse celui-ci par son nom, puis regarde le panneau GitHub.",
        success: "« * [new tag] v0.9 -> v0.9 » : GitHub a maintenant le tag. Tous ceux qui font un fetch le récupèrent aussi : toute l'équipe peut retrouver la bêta par son nom.",
      },
      {
        title: "Fais le tour",
        body: "git tag liste tes tags. git show v0.9 montre le commit visé par un tag et ce qu'il a modifié. Dans git log, les tags apparaissent sous la forme « tag: v0.9 » à côté de leur commit.",
      },
      {
        title: "Défi : tague les vraies versions",
        body: "Pose un tag annoté v1.0.0 sur « Launch website », un tag v1.1.0 sur ton commit le plus récent, et publie les deux sur GitHub.",
        objectives: [
          {
            label: "v1.0.0 marque « Launch website »",
            hints: [
              "Pour taguer un commit plus ancien, mets son identifiant après le nom du tag. Pour une version publiée, fais-en un tag annoté.",
              "git tag -a <nom> -m \"<message>\" <id>. Trouve l'identifiant avec git log --oneline.",
              `Tape : git tag -a v1.0.0 -m "First public launch" ${TG.launch}`,
            ],
          },
          {
            label: "v1.1.0 marque ton commit le plus récent",
            hints: [
              "Sans identifiant, git tag vise HEAD, ton commit le plus récent.",
              "git tag -a v1.1.0 -m \"<message>\"",
              'Tape : git tag -a v1.1.0 -m "Blog and dark mode"',
            ],
          },
          {
            label: "GitHub a les deux tags",
            hints: [
              "Un simple git push n'envoie pas les tags.",
              "Pousse-les par leur nom, ou pousse tous tes tags d'un coup.",
              "Tape : git push origin v1.0.0 v1.1.0  (ou : git push --tags)",
            ],
          },
        ],
      },
      null,
    ],
    feedback: [
      [
        /^(v[\d.]+) is on the wrong commit on GitHub\./,
        "$1 est sur le mauvais commit sur GitHub. Supprime-le là-bas avec git push origin --delete $1, corrige-le en local (git tag -d $1, puis tague le bon commit) et pousse-le de nouveau.",
      ],
      [
        /^(v[\d.]+) is on the wrong commit: it should mark “(.+)”\./,
        "$1 est sur le mauvais commit : il doit marquer « $2 ». Supprime-le avec git tag -d $1 et tague le bon commit.",
      ],
      [
        "Both tags are right, but they only exist on your computer. Push them: git push origin v1.0.0 v1.1.0 (or git push --tags).",
        "Les deux tags sont bons, mais ils n'existent que sur ton ordinateur. Pousse-les : git push origin v1.0.0 v1.1.0 (ou git push --tags).",
      ],
    ],
  },
};
