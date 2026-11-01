export type Risk = "safe" | "careful" | "destructive";

export interface CommandDoc {
  name: string;
  summary: string;
  /** Plain-language meaning for beginners. */
  plain: string;
  syntax: string[];
  flags: Array<{ flag: string; desc: string }>;
  risk: Risk;
  riskNote?: string;
  category: "Basics" | "History" | "Branches" | "Undo" | "Remote" | "Extras";
  /** Interactive before/after demo: setup commands then the demonstrated command. */
  demo: { setup: string[]; command: string };
  /** What kind of argument it takes, for autocomplete. */
  args?: "branch" | "file" | "commit" | "remote";
}

const base = ['echo "# Demo" > README.md', "git init", "git add .", 'git commit -m "First commit"'];

export const COMMAND_DOCS: CommandDoc[] = [
  {
    name: "init",
    summary: "Create a new repository",
    plain: "Turns the current folder into a Git repository by adding a hidden .git folder.",
    syntax: ["git init", "git init -b <branch>"],
    flags: [{ flag: "-b <name>", desc: "Name the first branch (default: main)" }],
    risk: "safe",
    category: "Basics",
    demo: { setup: ['echo "# Demo" > README.md'], command: "git init" },
  },
  {
    name: "status",
    summary: "Show what changed",
    plain: "Lists new, modified and staged files, and which branch you're on. Read-only — always safe.",
    syntax: ["git status", "git status -s"],
    flags: [{ flag: "-s, --short", desc: "Compact two-letter format" }],
    risk: "safe",
    category: "Basics",
    demo: { setup: [...base, 'echo "new" > notes.txt'], command: "git status" },
  },
  {
    name: "add",
    summary: "Stage changes for the next commit",
    plain: "Copies the current version of files into the staging area — the draft of your next snapshot.",
    syntax: ["git add <file>", "git add .", "git add -A"],
    flags: [
      { flag: ".", desc: "Everything in this folder" },
      { flag: "-A, --all", desc: "All changes, including deletions" },
    ],
    risk: "safe",
    category: "Basics",
    args: "file",
    demo: { setup: [...base, 'echo "hello" > hello.txt'], command: "git add hello.txt" },
  },
  {
    name: "commit",
    summary: "Save a snapshot",
    plain: "Records everything in the staging area as a new permanent snapshot with a message.",
    syntax: ['git commit -m "<message>"', 'git commit -am "<message>"', "git commit --amend"],
    flags: [
      { flag: "-m <msg>", desc: "The commit message" },
      { flag: "-a", desc: "Stage modified tracked files automatically" },
      { flag: "--amend", desc: "Replace the last commit" },
    ],
    risk: "safe",
    category: "Basics",
    demo: { setup: [...base, 'echo "hello" > hello.txt', "git add ."], command: 'git commit -m "Add hello"' },
  },
  {
    name: "log",
    summary: "Show commit history",
    plain: "Lists past commits, newest first.",
    syntax: ["git log", "git log --oneline", "git log --oneline --graph --all"],
    flags: [
      { flag: "--oneline", desc: "One commit per line" },
      { flag: "--graph", desc: "Draw branch lines" },
      { flag: "--all", desc: "Include every branch" },
      { flag: "-n <N>", desc: "Only the last N commits" },
    ],
    risk: "safe",
    category: "History",
    demo: { setup: [...base, 'echo "2" > two.txt', "git add .", 'git commit -m "Second"'], command: "git log --oneline" },
  },
  {
    name: "show",
    summary: "Inspect a commit",
    plain: "Shows a commit's message, author and exactly what it changed.",
    syntax: ["git show", "git show <commit>", "git show <commit>:<file>"],
    flags: [],
    risk: "safe",
    category: "History",
    args: "commit",
    demo: { setup: base, command: "git show" },
  },
  {
    name: "diff",
    summary: "See line-by-line changes",
    plain: "Compares versions of files: + lines were added, − lines were removed.",
    syntax: ["git diff", "git diff --staged", "git diff <a> <b>"],
    flags: [
      { flag: "--staged", desc: "Staged changes vs. last commit" },
      { flag: "--stat", desc: "Summary only" },
    ],
    risk: "safe",
    category: "History",
    args: "file",
    demo: { setup: [...base, 'echo "more" >> README.md'], command: "git diff" },
  },
  {
    name: "branch",
    summary: "List, create or delete branches",
    plain: "A branch is a movable label pointing at a commit. This command manages those labels.",
    syntax: ["git branch", "git branch <name>", "git branch -d <name>", "git branch -m <new>"],
    flags: [
      { flag: "-d", desc: "Delete a merged branch" },
      { flag: "-D", desc: "Force-delete a branch" },
      { flag: "-m", desc: "Rename a branch" },
      { flag: "-a", desc: "Include remote branches" },
    ],
    risk: "safe",
    category: "Branches",
    args: "branch",
    demo: { setup: base, command: "git branch feature" },
  },
  {
    name: "switch",
    summary: "Move to another branch",
    plain: "Moves HEAD to a branch and updates your files to match it.",
    syntax: ["git switch <branch>", "git switch -c <new-branch>", "git switch --detach <commit>"],
    flags: [
      { flag: "-c <name>", desc: "Create the branch and switch to it" },
      { flag: "--detach", desc: "Visit a commit directly" },
    ],
    risk: "safe",
    category: "Branches",
    args: "branch",
    demo: { setup: [...base, "git branch feature"], command: "git switch feature" },
  },
  {
    name: "checkout",
    summary: "Switch branches or restore files (classic)",
    plain: "The older all-in-one command. Today, switch and restore split its two jobs.",
    syntax: ["git checkout <branch>", "git checkout -b <new>", "git checkout <commit>", "git checkout -- <file>"],
    flags: [{ flag: "-b <name>", desc: "Create and switch" }],
    risk: "careful",
    riskNote: "git checkout -- <file> discards uncommitted edits to that file.",
    category: "Branches",
    args: "branch",
    demo: { setup: [...base, "git branch feature"], command: "git checkout feature" },
  },
  {
    name: "merge",
    summary: "Combine another branch into this one",
    plain: "Brings another branch's commits into the branch you're on.",
    syntax: ["git merge <branch>", "git merge --no-ff <branch>", "git merge --abort"],
    flags: [
      { flag: "--no-ff", desc: "Always create a merge commit" },
      { flag: "--abort", desc: "Cancel a conflicted merge" },
      { flag: "--squash", desc: "Combine changes without a merge commit" },
    ],
    risk: "safe",
    category: "Branches",
    args: "branch",
    demo: {
      setup: [...base, "git switch -c feature", 'echo "f" > f.txt', "git add .", 'git commit -m "Feature"', "git switch main", 'echo "m" > m.txt', "git add .", 'git commit -m "Main work"'],
      command: "git merge feature",
    },
  },
  {
    name: "rebase",
    summary: "Replay commits on top of another branch",
    plain: "Moves your branch's commits so they start from the tip of another branch, creating new copies.",
    syntax: ["git rebase <branch>", "git rebase --continue", "git rebase --abort"],
    flags: [
      { flag: "--continue", desc: "Continue after fixing a conflict" },
      { flag: "--abort", desc: "Go back to before the rebase" },
    ],
    risk: "careful",
    riskNote: "Rewrites commit IDs. Don't rebase commits others already pulled.",
    category: "Branches",
    args: "branch",
    demo: {
      setup: [...base, "git switch -c feature", 'echo "f" > f.txt', "git add .", 'git commit -m "Feature"', "git switch main", 'echo "m" > m.txt', "git add .", 'git commit -m "Main work"', "git switch feature"],
      command: "git rebase main",
    },
  },
  {
    name: "restore",
    summary: "Discard edits or unstage files",
    plain: "Brings a file back to its last saved version, or removes it from the staging area.",
    syntax: ["git restore <file>", "git restore --staged <file>", "git restore --source <commit> <file>"],
    flags: [
      { flag: "--staged", desc: "Unstage instead of discarding" },
      { flag: "--source <commit>", desc: "Restore from a specific commit" },
    ],
    risk: "destructive",
    riskNote: "git restore <file> permanently throws away uncommitted edits to that file.",
    category: "Undo",
    args: "file",
    demo: { setup: [...base, 'echo "oops" > README.md'], command: "git restore README.md" },
  },
  {
    name: "reset",
    summary: "Move the branch back (and maybe discard work)",
    plain: "Moves your current branch to another commit. --hard also overwrites your files.",
    syntax: ["git reset <file>", "git reset --soft <commit>", "git reset <commit>", "git reset --hard <commit>"],
    flags: [
      { flag: "--soft", desc: "Keep changes staged" },
      { flag: "--mixed", desc: "Keep changes unstaged (default)" },
      { flag: "--hard", desc: "Discard changes completely" },
    ],
    risk: "destructive",
    riskNote: "--hard throws away uncommitted work. Commits can usually be recovered with git reflog.",
    category: "Undo",
    args: "commit",
    demo: { setup: [...base, 'echo "2" > two.txt', "git add .", 'git commit -m "Second"'], command: "git reset --hard HEAD~1" },
  },
  {
    name: "revert",
    summary: "Undo a commit with a new commit",
    plain: "Creates a new commit that does the opposite of an old one. History is kept — safe on shared branches.",
    syntax: ["git revert <commit>", "git revert HEAD"],
    flags: [{ flag: "--abort", desc: "Cancel a conflicted revert" }],
    risk: "safe",
    category: "Undo",
    args: "commit",
    demo: { setup: [...base, 'echo "bug" > bug.txt', "git add .", 'git commit -m "Add bug"'], command: "git revert HEAD" },
  },
  {
    name: "reflog",
    summary: "Where HEAD has been",
    plain: "A diary of every commit HEAD pointed to. Your safety net for recovering “lost” commits.",
    syntax: ["git reflog"],
    flags: [],
    risk: "safe",
    category: "Undo",
    demo: { setup: [...base, 'echo "2" > two.txt', "git add .", 'git commit -m "Second"', "git reset --hard HEAD~1"], command: "git reflog" },
  },
  {
    name: "stash",
    summary: "Put work aside temporarily",
    plain: "Saves your uncommitted changes on a shelf and cleans your working directory.",
    syntax: ["git stash", "git stash pop", "git stash list"],
    flags: [
      { flag: "pop", desc: "Bring the latest stash back" },
      { flag: "-u", desc: "Include untracked files" },
    ],
    risk: "safe",
    category: "Extras",
    demo: { setup: [...base, 'echo "wip" >> README.md'], command: "git stash" },
  },
  {
    name: "cherry-pick",
    summary: "Copy a commit onto this branch",
    plain: "Applies the changes from one specific commit as a new commit on your branch.",
    syntax: ["git cherry-pick <commit>"],
    flags: [{ flag: "--abort", desc: "Cancel a conflicted cherry-pick" }],
    risk: "safe",
    category: "Extras",
    args: "commit",
    demo: {
      setup: [...base, "git switch -c fix", 'echo "fix" > fix.txt', "git add .", 'git commit -m "Fix"', "git switch main"],
      command: "git cherry-pick fix",
    },
  },
  {
    name: "tag",
    summary: "Label a commit permanently",
    plain: "Tags mark important commits, like releases (v1.0). Unlike branches, they don't move.",
    syntax: ["git tag", "git tag <name>", "git tag -d <name>"],
    flags: [{ flag: "-d", desc: "Delete a tag" }],
    risk: "safe",
    category: "Extras",
    demo: { setup: base, command: "git tag v1.0" },
  },
  {
    name: "remote",
    summary: "Manage connections to GitHub",
    plain: "A remote is a nickname for a repository hosted elsewhere (usually “origin”).",
    syntax: ["git remote -v", "git remote add <name> <url>"],
    flags: [{ flag: "-v", desc: "Show URLs" }],
    risk: "safe",
    category: "Remote",
    args: "remote",
    demo: { setup: base, command: "git remote add origin https://github.com/you/demo.git" },
  },
  {
    name: "push",
    summary: "Upload commits to GitHub",
    plain: "Sends your branch's new commits to the remote repository.",
    syntax: ["git push", "git push -u origin <branch>", "git push --force"],
    flags: [
      { flag: "-u", desc: "Remember the upstream for later" },
      { flag: "--force", desc: "Overwrite the remote branch" },
    ],
    risk: "careful",
    riskNote: "--force can erase teammates' work on the remote.",
    category: "Remote",
    args: "remote",
    demo: { setup: [...base, "git remote add origin https://github.com/you/demo.git"], command: "git push -u origin main" },
  },
  {
    name: "fetch",
    summary: "Download news from GitHub",
    plain: "Downloads new commits and updates origin/* labels. Your files and branches don't change.",
    syntax: ["git fetch", "git fetch <remote>"],
    flags: [{ flag: "--all", desc: "Every remote" }],
    risk: "safe",
    category: "Remote",
    args: "remote",
    demo: { setup: [...base, "git remote add origin https://github.com/you/demo.git", "git push -u origin main"], command: "git fetch" },
  },
  {
    name: "pull",
    summary: "Download and merge",
    plain: "git fetch + git merge in one step: brings remote commits into your branch.",
    syntax: ["git pull", "git pull --rebase"],
    flags: [{ flag: "--rebase", desc: "Rebase instead of merge" }],
    risk: "safe",
    category: "Remote",
    args: "remote",
    demo: { setup: [...base, "git remote add origin https://github.com/you/demo.git", "git push -u origin main"], command: "git pull" },
  },
  {
    name: "clone",
    summary: "Copy a repository from GitHub",
    plain: "Downloads a whole repository, with all its history, to your computer.",
    syntax: ["git clone <url>"],
    flags: [],
    risk: "safe",
    category: "Remote",
    demo: { setup: [], command: "git clone https://github.com/gitverse/hello-world.git" },
  },
];

export const docFor = (name: string) => COMMAND_DOCS.find((d) => d.name === name) ?? null;

/** Token-level explanation for the assisted terminal. */
export function explainTokens(input: string): Array<{ text: string; meaning: string; kind: "program" | "command" | "flag" | "value" | "operator" }> {
  const tokens = input.match(/"[^"]*"|'[^']*'|&&|>>|>|\S+/g) ?? [];
  const out: ReturnType<typeof explainTokens> = [];
  let sub: string | null = null;
  let prevFlag: string | null = null;
  for (const t of tokens) {
    if (t === "&&") {
      out.push({ text: t, meaning: "then run the next command", kind: "operator" });
      sub = null;
      continue;
    }
    if (t === ">" || t === ">>") {
      out.push({ text: t, meaning: t === ">" ? "write the text into a file" : "append the text to a file", kind: "operator" });
      continue;
    }
    if (t === "git") {
      out.push({ text: t, meaning: "the Git program", kind: "program" });
      sub = "git";
      continue;
    }
    if (sub === "git") {
      const d = docFor(t);
      out.push({ text: t, meaning: d ? d.summary.toLowerCase() : "git subcommand", kind: "command" });
      sub = t;
      continue;
    }
    if (["echo", "touch", "cat", "ls", "rm", "mv"].includes(t) && !sub) {
      const m: Record<string, string> = { echo: "print some text", touch: "create an empty file", cat: "show a file", ls: "list files", rm: "delete a file", mv: "rename a file" };
      out.push({ text: t, meaning: m[t], kind: "program" });
      sub = t;
      continue;
    }
    if (t.startsWith("-")) {
      const d = sub ? docFor(sub) : null;
      const f = d?.flags.find((fl) => fl.flag.split(/[ ,]/)[0] === t || fl.flag.includes(t + " ") || fl.flag.startsWith(t));
      out.push({ text: t, meaning: f?.desc ?? "an option", kind: "flag" });
      prevFlag = t;
      continue;
    }
    let meaning = "a value";
    if (/^["']/.test(t)) meaning = prevFlag === "-m" || prevFlag === "-am" ? "your commit message" : "some text";
    else if (t === ".") meaning = "everything in this folder";
    else if (/^https?:/.test(t)) meaning = "the repository's web address";
    else if (t === "origin") meaning = "the nickname of your GitHub repo";
    else if (/^HEAD/.test(t)) meaning = t === "HEAD" ? "the commit you're on" : "a commit before HEAD";
    else if (/\.\w+$/.test(t)) meaning = "a file name";
    else if (sub && ["switch", "branch", "merge", "rebase", "checkout", "push"].includes(sub)) meaning = "a branch name";
    else if (/^[0-9a-f]{7,}$/.test(t)) meaning = "a commit ID";
    out.push({ text: t, meaning, kind: "value" });
    prevFlag = null;
  }
  return out;
}
