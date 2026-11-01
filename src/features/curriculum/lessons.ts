import { currentBranch, emptyWorld, headCommit, headCommitId, isAncestor, type World } from "@/engine";
import * as c from "./checks";
import { INDEX_HTML, README, Scenario, scenario, STYLE_CSS } from "./scenario";
import type { Lesson } from "./types";

const BEGINNER_UI = { files: true, editor: false, stages: true, remote: false };
const INTERMEDIATE_UI = { files: true, editor: true, stages: false, remote: false };

const REMOTE_URL = "https://github.com/you/my-website.git";
const TEAM_URL = "https://github.com/gitverse-team/recipes.git";

/** Shared base: a small website with a couple of commits. */
const websiteWithHistory = () =>
  scenario()
    .run("git init")
    .commit("Add README", { "README.md": README })
    .commit("Add home page", { "index.html": INDEX_HTML })
    .commit("Add styles", { "style.css": STYLE_CSS })
    .commit("Add contact page", { "contact.html": "<h1>Contact</h1>\n<p>hello@example.com</p>\n" })
    .done();

// ───────────────────────────────────────────── Chapter 1 — Foundations

const whatIsGit: Lesson = {
  id: "what-is-git",
  chapterId: "foundations",
  title: "What is Git?",
  tagline: "A time machine for your project",
  xp: 50,
  concepts: ["version control", "repository", "snapshots"],
  commands: ["git init"],
  ui: { files: true, editor: false, stages: false, remote: false },
  setup: () => scenario({ "index.html": INDEX_HTML }).done(),
  recap: [
    "Git saves snapshots of your project so you can always go back in time.",
    "A repository is your project folder plus a hidden .git folder where Git keeps its history.",
    "git init turns any folder into a repository.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Ever saved “final_v2_REAL_final.html”?",
      body: [
        "When you work on a project, you change things constantly. Sometimes you break something and wish you could go back.",
        "Git is a tool that takes snapshots of your project whenever you ask. Each snapshot remembers exactly what every file looked like.",
        "Press the button to take a few snapshots and watch a timeline grow.",
      ],
      scene: "snapshots",
    },
    {
      kind: "discover",
      title: "Your project, plus a memory",
      body: [
        "A repository (or “repo”) is just your project folder with a hidden .git folder inside it.",
        "That .git folder is Git's memory: every snapshot you'll ever take lives there. Your files stay exactly where they are.",
      ],
      scene: "repository",
    },
    {
      kind: "try",
      title: "Turn your folder into a repository",
      body: "Your project already has an index.html file, but Git isn't watching it yet. Type the command below in the terminal (or press Run) to create a repository.",
      command: "git init",
      check: (w) => c.hasRepo(w),
      success: "Your folder is now a Git repository! The graph area is ready to show your history.",
      hint: "Type git init exactly — 'git' is the program, 'init' is short for initialize.",
    },
    {
      kind: "experiment",
      title: "Look around",
      body: "Nothing in your files changed — Git only added its hidden .git folder. Try these commands to peek around. You can't break anything here.",
      ideas: ["ls -a", "git status", "cat index.html"],
    },
    { kind: "celebrate" },
  ],
};

const firstCommit: Lesson = {
  id: "first-commit",
  chapterId: "foundations",
  title: "Your first commit",
  tagline: "Working folder → staging area → snapshot",
  xp: 80,
  concepts: ["working directory", "staging area", "commit"],
  commands: ["git status", "git add", "git commit"],
  ui: BEGINNER_UI,
  setup: () => scenario().run("git init").done(),
  recap: [
    "Your working directory is the files you edit.",
    "git add copies a file's current version into the staging area: the “next snapshot” you're preparing.",
    "git commit saves the staging area as a permanent snapshot with a message.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Three places your work lives",
      body: [
        "Git thinks about your files in three places. Your working directory is where you edit files.",
        "The staging area is like a photo frame: you choose what goes into the next snapshot.",
        "The repository stores every snapshot (called a commit) forever. Try moving the file through each step.",
      ],
      scene: "three-areas",
    },
    {
      kind: "try",
      title: "Create a file",
      body: "A project needs at least one file. Create README.md — a file that describes your project. Use the button, the Files panel, or type touch README.md.",
      action: { label: "Create README.md", kind: "create-file", path: "README.md", content: README },
      check: (w) => c.fileExists(w, "README.md"),
      success: "README.md now exists in your working directory. Git sees it, but isn't tracking it yet.",
    },
    {
      kind: "try",
      title: "Ask Git what it sees",
      body: "git status is your best friend. It tells you what changed and what Git will do next. Run it any time you're unsure.",
      command: "git status",
      check: (_w, _s, ran) => ran.includes("status"),
      success: "See “Untracked files”? Git noticed README.md but isn't saving it yet. Untracked means Git has never stored this file.",
    },
    {
      kind: "try",
      title: "Stage the file",
      body: "Put README.md into the staging area — the “photo frame” for your next snapshot.",
      command: "git add README.md",
      check: (w) => c.staged(w, "README.md"),
      success: "README.md is staged. Look at the stages panel: the file moved into the staging area.",
      hint: "git add takes the name of the file you want to stage.",
    },
    {
      kind: "try",
      title: "Take the snapshot",
      body: "Now commit: save the staging area as a snapshot. The -m part attaches a short message describing what you did. The quotes keep the message together.",
      command: 'git commit -m "Initial commit"',
      check: (w) => c.commitCount(w) >= 1,
      success: "Your first commit! The circle in the graph IS your snapshot. “main” is the branch label and HEAD means “you are here”.",
      hint: 'Don\'t forget the quotes around the message: git commit -m "Initial commit"',
    },
    {
      kind: "challenge",
      title: "Challenge: commit a second file",
      body: "On your own now: create a file called hello.txt, stage it and commit it. Use git status whenever you want to check your progress.",
      objectives: [
        {
          id: "create",
          label: "Create hello.txt",
          check: (w) => c.fileExists(w, "hello.txt"),
          hints: [
            "Files live in your working directory. You can create one from the Files panel.",
            "Click “New file” in the Files panel, or type touch hello.txt",
            "Type: touch hello.txt — then press Enter.",
          ],
        },
        {
          id: "commit",
          label: "Save hello.txt in a commit",
          check: (w) => c.inHead(w, "hello.txt"),
          hints: [
            "A file gets into a commit in two moves: stage it, then commit the staging area.",
            "Use git add, then git commit -m with a message.",
            'Type: git add hello.txt — then: git commit -m "Add hello.txt"',
          ],
        },
        {
          id: "count",
          label: "Have 2 commits in your history",
          check: (w) => c.reachableCount(w) >= 2,
          hints: [
            "Each commit appears as a circle in the graph.",
            "Make one more commit after your initial commit.",
            'Stage your file and run git commit -m "Add hello.txt"',
          ],
        },
      ],
      feedback: (w) => {
        if (!c.fileExists(w, "hello.txt")) return null;
        if (c.staged(w, "hello.txt")) return "hello.txt is staged — now turn the staging area into a commit.";
        if (!c.inHead(w, "hello.txt") && w.repo?.index["hello.txt"] === undefined)
          return "hello.txt exists but is untracked. Stage it with git add first.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

const makingChanges: Lesson = {
  id: "making-changes",
  chapterId: "foundations",
  title: "Changing files",
  tagline: "Modify, inspect, commit again",
  xp: 80,
  concepts: ["modified files", "diff", "history grows"],
  commands: ["git diff", "git add", "git commit -a"],
  ui: { files: true, editor: true, stages: true, remote: false },
  setup: () => scenario().run("git init").commit("Initial commit", { "README.md": README }).done(),
  recap: [
    "When you edit a tracked file, Git marks it as modified.",
    "git diff shows exactly which lines changed (+ added, − removed).",
    "Every commit adds a new circle to your timeline.",
  ],
  steps: [
    {
      kind: "try",
      title: "Edit README.md",
      body: "Open README.md in the editor and change something — add a line about yourself. (Or press the button to make an edit for you.)",
      action: { label: "Add a line to README.md", kind: "edit-file", path: "README.md", content: README + "\nMade with ❤ while learning Git.\n" },
      check: (w) => c.isModified(w, "README.md"),
      success: "README.md is now modified: it's different from the last snapshot.",
    },
    {
      kind: "try",
      title: "See what changed",
      body: "git diff compares your working files with what's staged. Green + lines were added, red − lines were removed.",
      command: "git diff",
      check: (_w, _s, ran) => ran.includes("diff"),
      success: "That's a diff — the exact change Git would record.",
    },
    {
      kind: "try",
      title: "Stage and commit it",
      body: "Stage README.md and commit it. Tip: you can run both at once by joining them with &&.",
      command: 'git add README.md && git commit -m "Update README"',
      check: (w, s) => c.newCommitsSince(w, s) >= 1 && c.clean(w),
      success: "A second circle! Your history is growing.",
    },
    {
      kind: "challenge",
      title: "Challenge: build a tiny website",
      body: "Create index.html with any content, commit it, then change it and commit again. You'll end with two new commits and a clean working directory.",
      objectives: [
        {
          id: "two",
          label: "Make 2 new commits",
          check: (w, s) => c.newCommitsSince(w, s) >= 3,
          hints: [
            "Each time you commit, a new snapshot appears. You need two more after the README update.",
            "Create index.html, git add it, git commit. Then edit it and repeat.",
            'touch index.html → git add index.html → git commit -m "Add home page" → edit it → git commit -am "Improve home page"',
          ],
        },
        {
          id: "index",
          label: "index.html is in your latest commit",
          check: (w) => c.inHead(w, "index.html"),
          hints: ["Committed files are part of the snapshot.", "Stage index.html, then commit.", 'git add index.html && git commit -m "Add home page"'],
        },
        {
          id: "clean",
          label: "Working directory is clean",
          check: (w) => c.clean(w),
          hints: [
            "“Clean” means every change has been committed.",
            "Run git status — anything listed still needs to be added and committed.",
            'git add . && git commit -m "Save my work"',
          ],
        },
      ],
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Chapter 2 — History

const readingHistory: Lesson = {
  id: "reading-history",
  chapterId: "history",
  title: "Travel through history",
  tagline: "log, commit IDs and HEAD",
  xp: 100,
  concepts: ["git log", "commit hash", "HEAD", "detached HEAD"],
  commands: ["git log --oneline", "git show", "git switch --detach"],
  ui: INTERMEDIATE_UI,
  setup: websiteWithHistory,
  recap: [
    "Every commit has a unique ID (hash). The first 7 characters are usually enough.",
    "Each commit points back to its parent, forming a chain of history.",
    "HEAD marks where you are. Visiting an old commit puts you in “detached HEAD” — look around, then switch back.",
  ],
  steps: [
    {
      kind: "discover",
      title: "A chain of snapshots",
      body: [
        "Each commit remembers its parent — the commit that came right before it. Together they form a chain.",
        "Every commit gets a unique ID like a3f9c21 (a “hash”). HEAD is a pointer meaning “you are here”. Click circles to move HEAD.",
      ],
      scene: "history",
    },
    {
      kind: "try",
      title: "Read the history",
      body: "This project already has 4 commits. List them, one per line.",
      command: "git log --oneline",
      check: (_w, _s, ran) => ran.includes("log"),
      success: "Newest first. The short code at the start of each line is the commit ID.",
    },
    {
      kind: "try",
      title: "Inspect a commit",
      body: "git show displays a commit's details and its changes. Without an ID it shows the commit HEAD points to. You can also click a circle in the graph.",
      command: "git show",
      check: (_w, _s, ran) => ran.includes("show"),
      success: "That's the “Add contact page” commit: who, when, and exactly what changed.",
    },
    {
      kind: "challenge",
      title: "Challenge: visit the past",
      body: "Travel back to the commit “Add home page” to see the project as it was then (notice style.css disappears!). Then come back to main.",
      objectives: [
        {
          id: "visit",
          label: "Check out the “Add home page” commit",
          check: (w) => c.visitedInReflog(w, c.findCommit(w, "Add home page")),
          hints: [
            "You can move HEAD to any commit using its ID. Find the ID with git log --oneline.",
            "Use git switch --detach <id> (or git checkout <id>).",
            "Run git log --oneline, copy the ID next to “Add home page”, then: git switch --detach <that-id>",
          ],
        },
        {
          id: "back",
          label: "Return to the main branch",
          check: (w) => c.onBranch(w, "main"),
          hints: ["HEAD should be attached to a branch again.", "Use git switch with the branch name.", "Type: git switch main"],
        },
      ],
      feedback: (w) =>
        w.repo?.head.kind === "detached"
          ? "You're in detached HEAD: looking at an old snapshot, not on any branch. Look at the files, then git switch main to come back."
          : null,
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Chapter 3 — Branching

const branches: Lesson = {
  id: "branches",
  chapterId: "branching",
  title: "Branches are timelines",
  tagline: "Work on ideas without breaking main",
  xp: 120,
  concepts: ["branch", "switch", "parallel work"],
  commands: ["git branch", "git switch", "git switch -c"],
  ui: INTERMEDIATE_UI,
  setup: () =>
    scenario()
      .run("git init")
      .commit("Add README", { "README.md": README })
      .commit("Add home page", { "index.html": INDEX_HTML })
      .done(),
  recap: [
    "A branch is a movable label pointing at a commit. Creating one is instant and cheap.",
    "git switch moves HEAD to another branch and updates your files to match.",
    "New commits only move the branch you're on — main stays safe.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Two timelines",
      body: [
        "Imagine you want to build a login page without risking the working version of your site.",
        "A branch is a separate timeline. You can experiment on it freely; main stays untouched. Try splitting the timeline.",
      ],
      scene: "branch-split",
    },
    {
      kind: "watch",
      title: "Watch: branch, switch, commit",
      body: "Step through these commands and watch the labels move.",
      setup: () => scenario().run("git init").commit("Add README", { "README.md": README }).done(),
      frames: [
        { command: "git branch idea", caption: "A new label “idea” appears on the same commit. Nothing else changes — HEAD is still on main." },
        { command: "git switch idea", caption: "HEAD moves to idea. New commits will now go on this branch." },
        { command: "echo 'new idea' > idea.txt && git add . && git commit -m \"Try an idea\"", caption: "The commit moves only the idea label forward. main stays behind, safe." },
        { command: "git switch main", caption: "Back on main: idea.txt disappears from your files, because main's snapshot doesn't have it." },
      ],
    },
    {
      kind: "try",
      title: "Create a branch",
      body: "Create a branch called feature/hello.",
      command: "git branch feature/hello",
      check: (w) => c.branchExists(w, "feature/hello"),
      success: "New label! Both main and feature/hello point at the same commit.",
    },
    {
      kind: "try",
      title: "Switch to it",
      body: "Move HEAD onto your new branch.",
      command: "git switch feature/hello",
      check: (w) => c.onBranch(w, "feature/hello"),
      success: "HEAD jumped to feature/hello. Your next commit will grow this timeline.",
    },
    {
      kind: "try",
      title: "Commit on the branch",
      body: "Create hello.txt and commit it on feature/hello.",
      command: "echo 'Hello from my branch!' > hello.txt && git add hello.txt && git commit -m \"Add greeting\"",
      check: (w) => c.onBranch(w, "feature/hello") && c.inHead(w, "hello.txt"),
      success: "feature/hello moved ahead; main stayed put. That's divergence in action.",
    },
    {
      kind: "challenge",
      title: "Challenge: build the login page",
      body: "Create a branch called feature/login, switch to it, create login.html and commit it there. main must not contain login.html.",
      objectives: [
        {
          id: "branch",
          label: "Branch feature/login exists",
          check: (w) => c.branchExists(w, "feature/login"),
          hints: ["Branches are created from where HEAD is.", "Use git branch <name> or git switch -c <name>.", "Type: git switch -c feature/login"],
        },
        {
          id: "on",
          label: "You're on feature/login",
          check: (w) => c.onBranch(w, "feature/login"),
          hints: ["HEAD should point at your new branch.", "Use git switch.", "Type: git switch feature/login"],
        },
        {
          id: "commit",
          label: "login.html is committed on feature/login",
          check: (w) => {
            const id = w.repo?.branches["feature/login"];
            return !!id && w.repo!.commits[id].tree["login.html"] !== undefined;
          },
          hints: [
            "Create the file, stage it, commit it — all while on feature/login.",
            "touch login.html, git add, git commit -m",
            'touch login.html && git add login.html && git commit -m "Add login page"',
          ],
        },
        {
          id: "main",
          label: "main doesn't have login.html",
          check: (w) => {
            const id = w.repo?.branches.main;
            return !!id && w.repo!.commits[id].tree["login.html"] === undefined;
          },
          hints: [
            "Commits only move the branch HEAD is on.",
            "If you committed on main by mistake, see the Undo chapter — or restart this lesson.",
            "Restart the lesson and make sure you switch to feature/login before committing.",
          ],
        },
      ],
      feedback: (w) => {
        if (c.branchExists(w, "feature/login") && w.repo && currentBranch(w.repo) !== "feature/login")
          return `You created the branch correctly, but you're still on ${currentBranch(w.repo) ?? "a detached HEAD"}. Use git switch to move to your feature branch.`;
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Chapter 4 — Merging

const featureReady = () =>
  scenario()
    .run("git init")
    .commit("Add README", { "README.md": README })
    .commit("Add home page", { "index.html": INDEX_HTML })
    .run("git switch -c feature/hello")
    .commit("Add greeting", { "hello.txt": "Hello, world!\n" })
    .commit("Make greeting friendlier", { "hello.txt": "Hello, world! 👋\n" })
    .done();

const fastForward: Lesson = {
  id: "fast-forward",
  chapterId: "merging",
  title: "Your first merge",
  tagline: "Bring a finished branch back into main",
  xp: 120,
  concepts: ["merge", "fast-forward"],
  commands: ["git switch", "git merge", "git branch -d"],
  ui: INTERMEDIATE_UI,
  setup: featureReady,
  recap: [
    "Merging brings the commits from another branch into the one you're on.",
    "If main hasn't moved since the branch split, Git just slides main forward — a fast-forward.",
    "After merging, a feature branch can be deleted safely: its commits live on in main.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Bringing work home",
      body: [
        "Your feature is finished on feature/hello. Now you want it in main.",
        "Because main hasn't changed since you branched, Git can simply slide main's label forward. This is called a fast-forward merge.",
      ],
      scene: "fast-forward",
    },
    {
      kind: "try",
      title: "Go to the receiving branch",
      body: "You always merge INTO the branch you're on. Switch to main — and watch hello.txt disappear from your files.",
      command: "git switch main",
      check: (w) => c.onBranch(w, "main"),
      success: "On main. hello.txt is gone because main's snapshot doesn't include it… yet.",
    },
    {
      kind: "try",
      title: "Merge the feature",
      body: "Bring feature/hello's commits into main.",
      command: "git merge feature/hello",
      check: (w) => c.branchContains(w, "main", w.repo?.branches["feature/hello"]),
      success: "Fast-forward! main slid ahead to the feature's latest commit, and hello.txt is back.",
    },
    {
      kind: "challenge",
      title: "Challenge: tidy up",
      body: "The feature branch has done its job. Delete it — its commits are safely part of main now.",
      objectives: [
        {
          id: "merged",
          label: "main contains the greeting",
          check: (w) => c.committedContent(w, "hello.txt") !== undefined && c.onBranch(w, "main"),
          hints: ["Merge into main.", "Switch to main, then git merge feature/hello.", "git switch main && git merge feature/hello"],
        },
        {
          id: "deleted",
          label: "feature/hello is deleted",
          check: (w) => !c.branchExists(w, "feature/hello") && c.reachableCount(w) >= 4,
          hints: ["Deleting a branch only removes the label, not the commits.", "Use git branch -d <name>.", "Type: git branch -d feature/hello"],
        },
      ],
    },
    { kind: "celebrate" },
  ],
};

const threeWay: Lesson = {
  id: "three-way",
  chapterId: "merging",
  title: "When timelines diverge",
  tagline: "Merge commits join two histories",
  xp: 140,
  concepts: ["divergence", "merge base", "merge commit"],
  commands: ["git merge", "git log --graph"],
  ui: INTERMEDIATE_UI,
  setup: () =>
    scenario()
      .run("git init")
      .commit("Add README", { "README.md": README })
      .commit("Add home page", { "index.html": INDEX_HTML })
      .run("git switch -c feature/footer")
      .commit("Add footer", { "footer.html": "<footer>© 2026 Me</footer>\n" })
      .run("git switch main")
      .commit("Add about page", { "about.html": "<h1>About me</h1>\n" }, "Maya")
      .run("git switch -c feature/gallery")
      .commit("Add gallery", { "gallery.html": "<h1>Gallery</h1>\n" })
      .run("git switch main")
      .done(),
  recap: [
    "When both branches have new commits, they've diverged — a fast-forward isn't possible.",
    "Git finds the merge base (the last shared commit) and combines both sets of changes.",
    "The result is a merge commit: a commit with two parents.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Both sides moved",
      body: [
        "While you built a footer on feature/footer, your teammate Maya added an about page to main. The timelines have diverged.",
        "Git can't just slide main forward. Instead it creates a merge commit — a snapshot with TWO parents that combines both sides.",
      ],
      scene: "three-way",
    },
    {
      kind: "try",
      title: "Merge the footer",
      body: "You're on main. Merge feature/footer and watch a merge commit appear where the two paths meet.",
      command: "git merge feature/footer",
      check: (w) => c.headIsMerge(w),
      success: "A merge commit with two parents. Both the about page and the footer are now in main.",
    },
    {
      kind: "try",
      title: "See the shape of history",
      body: "Git can draw history as text too.",
      command: "git log --oneline --graph --all",
      check: (_w, _s, ran) => ran.includes("log"),
      success: "Same story as the graph above, drawn with characters.",
    },
    {
      kind: "challenge",
      title: "Challenge: merge the gallery",
      body: "feature/gallery is also ready. Merge it into main as well.",
      objectives: [
        {
          id: "gallery",
          label: "main contains gallery.html",
          check: (w) => !!w.repo?.branches.main && w.repo.commits[w.repo.branches.main].tree["gallery.html"] !== undefined,
          hints: ["Merge into main from main.", "git merge feature/gallery", "Make sure you're on main (git switch main), then: git merge feature/gallery"],
        },
        {
          id: "footer",
          label: "main still contains footer.html",
          check: (w) => !!w.repo?.branches.main && w.repo.commits[w.repo.branches.main].tree["footer.html"] !== undefined,
          hints: ["Both features should end up in main.", "Merge feature/footer too if you haven't.", "git switch main && git merge feature/footer"],
        },
      ],
    },
    { kind: "celebrate" },
  ],
};

const conflictSetup = () =>
  scenario()
    .run("git init")
    .commit("Add styles", { "style.css": STYLE_CSS, "index.html": INDEX_HTML })
    .run("git switch -c feature/dark-mode")
    .commit("Dark text color", { "style.css": "body {\n  font-family: sans-serif;\n  color: white;\n  background: #111;\n}\n" })
    .run("git switch main")
    .commit("Brand color", { "style.css": "body {\n  font-family: sans-serif;\n  color: purple;\n}\n" }, "Maya")
    .done();

const conflicts: Lesson = {
  id: "merge-conflicts",
  chapterId: "merging",
  title: "Boss: the merge conflict",
  tagline: "Two people changed the same line",
  xp: 200,
  boss: true,
  concepts: ["merge conflict", "conflict markers", "resolution"],
  commands: ["git merge", "git add", "git commit", "git merge --abort"],
  ui: { files: true, editor: true, stages: false, remote: false },
  setup: conflictSetup,
  recap: [
    "A conflict happens when both branches changed the same lines. Git can't guess which you want.",
    "Git marks the spot with <<<<<<< (yours), ======= and >>>>>>> (theirs).",
    "You decide the final content, remove the markers, git add the file, then git commit.",
    "Changed your mind? git merge --abort puts everything back.",
  ],
  steps: [
    {
      kind: "discover",
      title: "When Git needs your help",
      body: [
        "You changed the text color to white on feature/dark-mode. Maya changed the same line to purple on main.",
        "Git can merge different lines automatically, but the same line? Only a human can decide. That's a merge conflict — totally normal, and not scary.",
      ],
      scene: "conflict",
    },
    {
      kind: "try",
      title: "Start the merge",
      body: "On main, merge feature/dark-mode. It will stop with a conflict — that's expected!",
      command: "git merge feature/dark-mode",
      check: (w) => !!w.repo?.op && w.repo.op.conflicts.includes("style.css"),
      success: "Conflict! style.css now contains both versions between markers. Open it in the editor.",
    },
    {
      kind: "challenge",
      title: "Resolve it",
      body: "Open style.css. Choose a version (or combine both — maybe dark background with purple text?), make sure no <<<<<<< ======= >>>>>>> markers remain, then stage the file and commit to finish the merge.",
      objectives: [
        {
          id: "edit",
          label: "Remove the conflict markers from style.css",
          check: (w) => (c.fileExists(w, "style.css") && !/^(<<<<<<<|=======|>>>>>>>)/m.test(w.workdir["style.css"])) || c.headIsMerge(w),
          hints: [
            "The part between <<<<<<< and ======= is main's version; between ======= and >>>>>>> is the feature's.",
            "In the editor, use “Accept current”, “Accept incoming” or “Accept both”, or edit the text by hand.",
            "Open style.css in the Files panel → click “Accept both” → then fix the color line so there's only one color.",
          ],
        },
        {
          id: "stage",
          label: "Mark it resolved with git add",
          check: (w) => (!!w.repo?.op && w.repo.op.conflicts.length === 0) || c.headIsMerge(w),
          hints: ["Staging a conflicted file tells Git you've resolved it.", "git add style.css", "Type: git add style.css"],
        },
        {
          id: "commit",
          label: "Finish the merge with a commit",
          check: (w) => c.headIsMerge(w) && c.onBranch(w, "main") && c.noConflictMarkers(w),
          hints: ["A merge isn't done until you commit it.", "git commit (the message is pre-filled for merges).", 'Type: git commit -m "Merge dark mode"'],
        },
      ],
      feedback: (w) => {
        if (w.repo?.op && w.repo.op.conflicts.length && !/^<<<<<<< /m.test(w.workdir["style.css"] ?? ""))
          return "Markers are gone — now run git add style.css to tell Git it's resolved.";
        if (!w.repo?.op && !c.headIsMerge(w) && headCommit(w.repo!)?.message === "Brand color")
          return "No merge in progress. Run git merge feature/dark-mode to start it again.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Chapter 6 — Undo

const lostCommit: Lesson = {
  id: "lost-commit",
  chapterId: "undo",
  title: "Boss: recover the lost commit",
  tagline: "reset, reflog and the safety net",
  xp: 220,
  boss: true,
  concepts: ["reset --hard", "reflog", "recovery"],
  commands: ["git reflog", "git reset --hard", "git branch"],
  ui: INTERMEDIATE_UI,
  setup: () => {
    const s = scenario()
      .run("git init")
      .commit("Add README", { "README.md": README })
      .commit("Add home page", { "index.html": INDEX_HTML })
      .commit("Add pricing page", { "pricing.html": "<h1>Pricing</h1>\n<p>Free forever.</p>\n" });
    return s.run("git reset --hard HEAD~1").done();
  },
  recap: [
    "git reset --hard moves your branch back and throws away later commits from view.",
    "But Git rarely deletes anything right away: git reflog lists everywhere HEAD has been.",
    "Point a branch (or reset) at the old commit ID to bring the work back.",
  ],
  steps: [
    {
      kind: "discover",
      title: "“I deleted my work!”",
      body: [
        "Oh no. A teammate ran git reset --hard HEAD~1 and the “Add pricing page” commit vanished from main.",
        "Good news: Git keeps a diary of everywhere HEAD has been — the reflog. Commits that seem lost are usually still there, just unlabeled.",
      ],
      scene: "undo",
    },
    {
      kind: "try",
      title: "Read the diary",
      body: "Show the reflog.",
      command: "git reflog",
      check: (_w, _s, ran) => ran.includes("reflog"),
      success: "See the line “commit: Add pricing page”? That ID is your lost commit.",
    },
    {
      kind: "challenge",
      title: "Bring it back",
      body: "Get the “Add pricing page” commit back onto main, so pricing.html is in your files again.",
      objectives: [
        {
          id: "back",
          label: "main includes “Add pricing page”",
          check: (w) => c.branchContains(w, "main", c.findCommit(w, "Add pricing page")),
          hints: [
            "Move main back to the lost commit's ID.",
            "git reset --hard <id> moves the current branch to any commit.",
            "Copy the ID next to “commit: Add pricing page” in git reflog, then: git reset --hard <id>",
          ],
        },
        {
          id: "file",
          label: "pricing.html is back in your files",
          check: (w) => c.fileExists(w, "pricing.html") && c.onBranch(w, "main"),
          hints: ["A hard reset also updates your files.", "Make sure you're on main.", "git switch main && git reset --hard <id>"],
        },
      ],
    },
    { kind: "celebrate" },
  ],
};

const revertLesson: Lesson = {
  id: "undo-safely",
  chapterId: "undo",
  title: "Undo without rewriting",
  tagline: "restore and revert",
  xp: 140,
  concepts: ["restore", "revert", "safe vs destructive"],
  commands: ["git restore", "git revert"],
  ui: INTERMEDIATE_UI,
  setup: () =>
    scenario()
      .run("git init")
      .commit("Add home page", { "index.html": INDEX_HTML, "README.md": README })
      .commit("Add banner", { "index.html": "<h1>Welcome!</h1>\n<marquee>BUY NOW!!! 🚨</marquee>\n<p>This is my site.</p>\n" }, "Maya")
      .commit("Add contact page", { "contact.html": "<h1>Contact</h1>\n" })
      .files({ "README.md": "oops I deleted everything\n" })
      .done(),
  recap: [
    "git restore <file> throws away uncommitted edits, bringing back the last committed version.",
    "git revert <commit> creates a NEW commit that undoes an old one — history stays intact, safe for shared branches.",
  ],
  steps: [
    {
      kind: "try",
      title: "Discard an accidental edit",
      body: "README.md got mangled but the change was never committed. Restore it.",
      command: "git restore README.md",
      check: (w) => w.workdir["README.md"] === README,
      success: "README.md is back to its committed version.",
    },
    {
      kind: "challenge",
      title: "Undo the ugly banner",
      body: "Maya's “Add banner” commit is already shared with the team, so don't rewrite history. Create a commit that undoes it, keeping the contact page.",
      objectives: [
        {
          id: "revert",
          label: "The banner is gone from index.html",
          check: (w) => !(c.committedContent(w, "index.html") ?? "marquee").includes("marquee"),
          hints: ["git revert makes a new commit that does the opposite of an old one.", "Find the ID of “Add banner” with git log --oneline.", "git revert <id-of-Add-banner>"],
        },
        {
          id: "kept",
          label: "History was not rewritten",
          check: (w) => c.branchContains(w, "main", c.findCommit(w, "Add banner")) && c.inHead(w, "contact.html"),
          hints: ["Don't reset — revert adds, it doesn't remove.", "Use git revert.", "git revert <id-of-Add-banner>"],
        },
      ],
    },
    { kind: "celebrate" },
  ],
};

// ───────────────────────────────────────────── Chapter 7 — GitHub

const firstPush: Lesson = {
  id: "first-push",
  chapterId: "github",
  title: "Send it to GitHub",
  tagline: "Remotes, origin and git push",
  xp: 150,
  concepts: ["remote", "origin", "push", "upstream"],
  commands: ["git remote add", "git push -u", "git push"],
  ui: { files: true, editor: true, stages: true, remote: true },
  setup: () =>
    scenario()
      .run("git init")
      .commit("Add README", { "README.md": README })
      .commit("Add home page", { "index.html": INDEX_HTML })
      .host(REMOTE_URL, "you", "my-website")
      .done(),
  recap: [
    "Git is the tool on your computer. GitHub is a website that hosts copies of repositories.",
    "A remote is a named link to a hosted repo; by convention the main one is called origin.",
    "git push uploads your commits. The first time, -u remembers where to push.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Your computer ↔ GitHub",
      body: [
        "So far everything lived on your computer. GitHub hosts a copy of your repository online so you can back it up and collaborate.",
        "Note: Git and GitHub are different things. Git is the tool; GitHub is a service. Gitverse simulates GitHub safely — nothing leaves your browser.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "Connect to GitHub",
      body: "We've created an empty repo for you on the (simulated) GitHub. Link it and name the link origin.",
      command: `git remote add origin ${REMOTE_URL}`,
      check: (w) => !!w.repo?.remotes.origin,
      success: "origin now points at your GitHub repo. It's empty so far — check the Remote tab.",
    },
    {
      kind: "try",
      title: "Push your commits",
      body: "Upload main to origin. -u (upstream) tells Git to remember this, so next time plain git push is enough.",
      command: "git push -u origin main",
      check: (w) => !!w.hosted[REMOTE_URL]?.branches.main,
      success: "Your commits flew to GitHub! See the origin/main label: it's Git's memory of where GitHub's main is.",
    },
    {
      kind: "challenge",
      title: "Challenge: publish an update",
      body: "Make a new commit (any change) and push it so GitHub is up to date.",
      objectives: [
        {
          id: "commit",
          label: "Make a new commit",
          check: (w, s) => c.newCommitsSince(w, s) >= 1,
          hints: ["Change or add a file, then commit.", "Stage + commit.", 'echo "Hi" > about.txt && git add . && git commit -m "Add about"'],
        },
        {
          id: "pushed",
          label: "GitHub has your latest commit",
          check: (w, s) => c.newCommitsSince(w, s) >= 1 && !!w.repo && w.hosted[REMOTE_URL]?.branches.main === headCommitId(w.repo),
          hints: ["Uploading is a push.", "Your branch already has an upstream.", "Type: git push"],
        },
      ],
      feedback: (w) => {
        if (w.repo?.upstream.main && w.repo.branches.main !== w.repo.remoteRefs["origin/main"])
          return "Your main is ahead of origin/main — GitHub doesn't have your latest commit yet.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

const teamSetup = (): World => {
  const team = scenario()
    .run("git init")
    .commit("Start recipe book", { "README.md": "# Team Recipes\n" }, "Maya")
    .commit("Add pancakes", { "pancakes.md": "# Pancakes\n- flour\n- milk\n- eggs\n" }, "Maya")
    .host(TEAM_URL, "gitverse-team", "recipes")
    .run(`git remote add origin ${TEAM_URL}`, "git push -u origin main")
    .done();
  // you clone the project…
  const you = new Scenario({ ...emptyWorld(), hosted: team.hosted, hostedCommits: team.hostedCommits, clock: team.clock, seq: team.seq })
    .run(`git clone ${TEAM_URL} .`)
    .done();
  // …then Maya pushes more work from her computer
  const maya = new Scenario({ ...team, hosted: you.hosted, hostedCommits: you.hostedCommits, clock: you.clock, seq: you.seq })
    .commit("Add pasta", { "pasta.md": "# Pasta\n- spaghetti\n- tomatoes\n" }, "Maya")
    .run("git push")
    .done();
  return { ...you, hosted: maya.hosted, hostedCommits: maya.hostedCommits, clock: maya.clock, seq: maya.seq };
};

const SITE_URL = "https://github.com/gitverse-team/website.git";

/** A team repository on the simulated GitHub, with an open feature branch. Nothing local yet. */
const teamWebsite = (): World => {
  const team = scenario()
    .run("git init")
    .commit("Start website", { "README.md": "# Team Website\n", "index.html": INDEX_HTML }, "Maya")
    .commit("Add styles", { "style.css": STYLE_CSS }, "Maya")
    .run("git switch -c feature/blog")
    .commit("Draft blog page", { "blog.html": "<h1>Blog</h1>\n" }, "Sam")
    .run("git switch main")
    .host(SITE_URL, "gitverse-team", "website")
    .run(`git remote add origin ${SITE_URL}`, "git push -u origin main", "git push origin feature/blog")
    .done();
  return { ...emptyWorld(), hosted: team.hosted, hostedCommits: team.hostedCommits, clock: team.clock, seq: team.seq };
};

const cloneContribute: Lesson = {
  id: "clone-contribute",
  chapterId: "github",
  title: "Clone & contribute",
  tagline: "clone, remote branches, push a feature branch",
  xp: 150,
  concepts: ["clone", "origin", "remote-tracking branches", "upstream"],
  commands: ["git clone", "git branch -a", "git switch -c", "git push -u origin <branch>"],
  ui: { files: true, editor: true, stages: false, remote: true },
  setup: teamWebsite,
  recap: [
    "git clone downloads a whole repository — every commit — and remembers where it came from as origin.",
    "origin/main and origin/feature/blog are remote-tracking branches: Git's memory of what's on GitHub.",
    "Work on your own branch, then git push -u origin <branch> publishes it and sets it as the upstream.",
    "That pushed branch is what a pull request on GitHub is made from.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Joining a project that already exists",
      body: [
        "Most of the time you don't start a repository — you join one. Your team's website already lives on GitHub.",
        "git clone copies the entire project, with its whole history, onto your computer. Git also remembers the address as origin, so you can push back later.",
      ],
      scene: "remote",
    },
    {
      kind: "try",
      title: "Clone the team's repository",
      body: "Download the team website into this folder. The dot at the end means “clone right here”.",
      command: `git clone ${SITE_URL} .`,
      check: (w) => !!w.repo?.remotes.origin,
      success: "You have the whole project: every file and every commit. Notice origin/main in the graph — that's where GitHub's main is.",
    },
    {
      kind: "try",
      title: "See every branch, including GitHub's",
      body: "A plain git branch only lists your local branches. Add -a to also see the ones on GitHub.",
      command: "git branch -a",
      check: (_w, _s, ran) => ran.includes("branch"),
      success: "remotes/origin/feature/blog is Sam's branch on GitHub. You have its commits, but no local branch for it — and you don't need one to start your own work.",
    },
    {
      kind: "challenge",
      title: "Challenge: contribute a footer",
      body: "Create a branch called feature/footer, add footer.html in a commit, and publish your branch to GitHub so it tracks origin/feature/footer. Don't touch main.",
      objectives: [
        {
          id: "branch",
          label: "Work on a branch called feature/footer",
          check: (w) => c.branchExists(w, "feature/footer"),
          hints: ["Never commit straight to a shared main — make your own branch.", "git switch -c creates a branch and moves onto it.", "Type: git switch -c feature/footer"],
        },
        {
          id: "commit",
          label: "Commit footer.html on feature/footer",
          check: (w) => {
            const id = w.repo?.branches["feature/footer"];
            return !!id && w.repo!.commits[id].tree["footer.html"] !== undefined;
          },
          hints: ["Create the file, stage it, commit it — while on feature/footer.", "touch footer.html, git add, git commit -m", 'echo "<footer>© Team</footer>" > footer.html && git add . && git commit -m "Add footer"'],
        },
        {
          id: "pushed",
          label: "GitHub has your branch, and it tracks origin/feature/footer",
          check: (w) =>
            !!w.repo &&
            w.repo.upstream["feature/footer"] === "origin/feature/footer" &&
            w.hosted[SITE_URL]?.branches["feature/footer"] === w.repo.branches["feature/footer"],
          hints: [
            "Publishing a new branch is a push. The first time, tell Git where it goes.",
            "Use -u so Git remembers the upstream.",
            "Type: git push -u origin feature/footer",
          ],
        },
        {
          id: "main",
          label: "main is unchanged on GitHub",
          check: (w, s) => w.hosted[SITE_URL]?.branches.main === s.hosted[SITE_URL]?.branches.main && c.hasRepo(w),
          hints: ["Your work belongs on your branch, not main.", "If you pushed to main by accident, restart the lesson.", "Restart and make sure you switch to feature/footer before committing."],
        },
      ],
      feedback: (w) => {
        if (!w.repo) return null;
        const b = currentBranch(w.repo);
        if (b === "main" && w.repo.branches.main !== w.repo.remoteRefs["origin/main"])
          return "You committed on main. Contributions go on their own branch — restart the lesson and create feature/footer first.";
        if (b === "feature/footer" && w.repo.branches["feature/footer"] && !w.repo.upstream["feature/footer"] && w.hosted[SITE_URL]?.branches["feature/footer"])
          return "Your branch is on GitHub, but it doesn't track it yet. Push with -u so plain git push and git status know where it goes.";
        return null;
      },
    },
    { kind: "celebrate" },
  ],
};

const fetchPull: Lesson = {
  id: "fetch-pull",
  chapterId: "github",
  title: "Stay in sync",
  tagline: "fetch, pull and teammates",
  xp: 150,
  concepts: ["fetch", "pull", "remote-tracking branch"],
  commands: ["git fetch", "git status", "git pull"],
  ui: { files: true, editor: true, stages: false, remote: true },
  setup: teamSetup,
  recap: [
    "git fetch downloads new commits from GitHub and moves origin/* labels — your files don't change.",
    "git pull = fetch + merge: it brings those commits into your branch.",
    "Pull before you push to avoid rejected pushes.",
  ],
  steps: [
    {
      kind: "discover",
      title: "Your teammate pushed",
      body: [
        "You cloned the team's recipe book. Since then, Maya pushed a new recipe to GitHub. Your computer doesn't know yet!",
        "git fetch downloads the news without touching your files. git pull downloads AND merges it into your branch.",
      ],
      scene: "fetch-pull",
    },
    {
      kind: "try",
      title: "Download the news",
      body: "Fetch from origin and watch origin/main move ahead of your main.",
      command: "git fetch",
      check: (w) => !!w.repo && w.repo.remoteRefs["origin/main"] !== w.repo.branches.main,
      success: "origin/main moved to Maya's commit. Your main and your files didn't change.",
    },
    {
      kind: "try",
      title: "Check where you stand",
      body: "Ask Git how your branch compares to GitHub's.",
      command: "git status",
      check: (_w, _s, ran) => ran.includes("status"),
      success: "“Your branch is behind 'origin/main' by 1 commit” — time to pull.",
    },
    {
      kind: "challenge",
      title: "Challenge: contribute a recipe",
      body: "Bring in Maya's work, add your own recipe file, commit, and push it to the team repo.",
      objectives: [
        {
          id: "pulled",
          label: "Your main includes Maya's “Add pasta”",
          check: (w) => c.branchContains(w, "main", c.findCommit(w, "Add pasta")),
          hints: ["Integrate the remote commits into your branch.", "git pull (or git merge origin/main).", "Type: git pull"],
        },
        {
          id: "recipe",
          label: "Commit a new recipe file",
          check: (w, s) => c.newCommitsSince(w, s) >= 1,
          hints: ["Any new .md file will do.", "Create, add, commit.", 'echo "# Tacos" > tacos.md && git add . && git commit -m "Add tacos"'],
        },
        {
          id: "pushed",
          label: "GitHub has your commit",
          check: (w, s) =>
            c.newCommitsSince(w, s) >= 1 && !!w.repo && !!w.hosted[TEAM_URL] && isAncestor(w.repo, headCommitId(w.repo)!, w.hosted[TEAM_URL].branches.main ?? "") ,
          hints: ["Upload your work.", "git push", "Type: git push (pull first if it's rejected)"],
        },
      ],
    },
    { kind: "celebrate" },
  ],
};

export const LESSONS = {
  whatIsGit,
  firstCommit,
  makingChanges,
  readingHistory,
  branches,
  fastForward,
  threeWay,
  conflicts,
  revertLesson,
  lostCommit,
  firstPush,
  cloneContribute,
  fetchPull,
};

export { REMOTE_URL, SITE_URL, TEAM_URL };
