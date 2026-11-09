import { describe, expect, it } from "vitest";
import { emptyWorld, execute, headCommitId, parse, runScript, status, type World } from "..";
import { globToRegExp, matchIgnore, parseIgnore } from "../ignore";
import { runShellScript } from "../hooks";

const run = (w: World, ...cmds: string[]) => runScript(w, cmds);
const text = (r: ReturnType<typeof execute>) => r.lines.map((l) => l.text).join("\n");

function repoWith(files: Record<string, string>): World {
  const w = emptyWorld(files);
  return run(w, "git init", "git add .", `git commit -m "Initial commit"`);
}

/** 10 commits; commit 7 introduces the bug ("return a - b"). */
function buggyHistory(): { w: World; ids: string[] } {
  let w = repoWith({ "math.js": "function add(a, b) {\n  return a + b;\n}\n", "package.json": JSON.stringify({ name: "calc", version: "1.0.0", scripts: { test: "grep -q 'return a + b' math.js" } }) });
  const ids = [headCommitId(w.repo!)!];
  for (let i = 2; i <= 10; i++) {
    w.workdir[`notes${i}.txt`] = `note ${i}\n`;
    if (i === 7) w.workdir["math.js"] = "function add(a, b) {\n  return a - b;\n}\n";
    w = run(w, "git add .", `git commit -m "Commit ${i}"`);
    ids.push(headCommitId(w.repo!)!);
  }
  return { w, ids };
}

describe("shell chains and builtins", () => {
  it("parses ;, && and || operators", () => {
    expect(parse("a ; b && c || d").map((c) => c.op)).toEqual([undefined, ";", "&&", "||"]);
  });

  it("`;` keeps going after a failure, `&&` stops", () => {
    let r = execute(emptyWorld(), "cat nope.txt ; echo after");
    expect(text(r)).toMatch(/No such file[\s\S]*after/);
    expect(r.ok).toBe(true);
    r = execute(emptyWorld(), "cat nope.txt && echo after");
    expect(text(r)).not.toMatch(/after/);
    expect(r.ok).toBe(false);
    r = execute(emptyWorld(), "false || echo rescued");
    expect(text(r)).toBe("rescued");
    expect(r.ok).toBe(true);
    r = execute(emptyWorld(), "true || echo never");
    expect(text(r)).toBe("");
    // state changes before a failing command survive with `;`
    r = execute(emptyWorld(), "echo hi > a.txt ; cat missing ; echo done");
    expect(r.world.workdir["a.txt"]).toBe("hi\n");
  });

  it("true, false, exit and !", () => {
    expect(execute(emptyWorld(), "true").ok).toBe(true);
    expect(execute(emptyWorld(), "false").ok).toBe(false);
    let r = execute(emptyWorld(), "echo one && exit 3 && echo two");
    expect(r.exit).toBe(3);
    expect(r.ok).toBe(false);
    expect(text(r)).toBe("one");
    r = execute(emptyWorld(), "exit 0; echo no");
    expect(r.ok).toBe(true);
    expect(text(r)).toBe("");
    const w = emptyWorld({ "app.js": "console.log('debug')\n" });
    r = execute(w, "! grep -q console.log app.js");
    expect(r.ok).toBe(false);
    expect(text(r)).toBe("");
    r = execute(w, "! grep -q debugger app.js && echo clean");
    expect(r.ok).toBe(true);
    expect(text(r)).toBe("clean");
    r = execute(w, "! cat missing.txt");
    expect(r.ok).toBe(true);
    expect(r.explain).toBeUndefined();
  });

  it("grep: matches, exit status, flags", () => {
    const w = emptyWorld({ "a.txt": "Hello\nTODO: fix\nbye\n", "src/b.js": "// TODO later\nok\n", "c.txt": "nothing\n" });
    let r = execute(w, "grep TODO a.txt");
    expect(text(r)).toBe("TODO: fix");
    expect(r.ok).toBe(true);
    r = execute(w, "grep -n TODO a.txt");
    expect(text(r)).toBe("2:TODO: fix");
    r = execute(w, "grep -q TODO a.txt");
    expect(text(r)).toBe("");
    expect(r.ok).toBe(true);
    r = execute(w, "grep nope a.txt");
    expect(r.ok).toBe(false);
    expect(text(r)).toBe("");
    r = execute(w, "grep -i hello a.txt");
    expect(text(r)).toBe("Hello");
    r = execute(w, "grep -r TODO .");
    expect(text(r)).toBe("a.txt:TODO: fix\nsrc/b.js:// TODO later");
    r = execute(w, "grep -rl TODO");
    expect(text(r)).toBe("a.txt\nsrc/b.js");
    r = execute(w, "grep -c o a.txt c.txt");
    expect(text(r)).toBe("a.txt:1\nc.txt:1");
    r = execute(w, "grep -v TODO a.txt");
    expect(text(r)).toBe("Hello\nbye");
    r = execute(w, "grep -E 'fix|later' -r src");
    expect(text(r)).toBe("src/b.js:// TODO later");
    r = execute(w, "grep 'Hello\\|bye' a.txt");
    expect(text(r)).toBe("Hello\nbye");
    r = execute(w, "grep TODO missing.txt");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/No such file or directory/);
    r = execute(w, "grep TODO");
    expect(r.ok).toBe(false);
    expect(r.explain).toBeDefined();
  });

  it("test and [ ]", () => {
    const w = emptyWorld({ "README.md": "# hi\n", "src/a.ts": "x\n", "empty.txt": "" });
    const ok = (cmd: string) => execute(w, cmd).ok;
    expect(ok("test -f README.md")).toBe(true);
    expect(ok("test -f nope")).toBe(false);
    expect(ok("test -d src")).toBe(true);
    expect(ok("test -f src")).toBe(false);
    expect(ok("test -e src/a.ts")).toBe(true);
    expect(ok("test -s empty.txt")).toBe(false);
    expect(ok("[ -n hello ]")).toBe(true);
    expect(ok("[ -z '' ]")).toBe(true);
    expect(ok("[ a = a ]")).toBe(true);
    expect(ok("[ a != a ]")).toBe(false);
    expect(ok("[ 3 -gt 2 ]")).toBe(true);
    expect(ok("[ ! -f nope ]")).toBe(true);
    expect(text(execute(w, "test -f nope"))).toBe("");
    expect(execute(w, "[ -f README.md").ok).toBe(false);
  });

  it("redirects output of any command, and /dev/null", () => {
    const w = emptyWorld({ "a.txt": "one\ntwo\n" });
    let r = execute(w, "grep one a.txt > found.txt");
    expect(text(r)).toBe("");
    expect(r.world.workdir["found.txt"]).toBe("one\n");
    r = execute(w, "cat missing 2>/dev/null");
    expect(text(r)).toBe("");
    expect(r.ok).toBe(false);
    r = execute(w, "echo oops >&2");
    expect(text(r)).toBe("oops");
    expect(r.world.workdir["&2"]).toBeUndefined();
  });

  it("npm test / npm run", () => {
    const pkg = JSON.stringify({ name: "app", version: "1.0.0", scripts: { test: "grep -q add math.js", lint: "! grep -q console.log math.js" } });
    const w = emptyWorld({ "package.json": pkg, "math.js": "export const add = (a, b) => a + b;\nconsole.log(add(1, 2));\n" });
    let r = execute(w, "npm test");
    expect(r.ok).toBe(true);
    expect(text(r)).toMatch(/> app@1.0.0 test\n> grep -q add math.js/);
    r = execute(w, "npm run lint");
    expect(r.ok).toBe(false);
    r = execute(w, "npm run lint && echo shipped");
    expect(text(r)).not.toMatch(/shipped/);
    r = execute(w, "npm run build");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/npm error Missing script: "build"/);
    r = execute(emptyWorld(), "npm test");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/ENOENT/);
  });

  it("runs sh scripts: last status wins, exit stops, set -e", () => {
    const w = emptyWorld({ "a.txt": "hello\n" });
    expect(runShellScript(w, "#!/bin/sh\nfalse\ntrue\n").ok).toBe(true);
    expect(runShellScript(w, "true\nfalse\n").ok).toBe(false);
    const r = runShellScript(w, "echo start\nexit 1\necho unreachable\n");
    expect(r.ok).toBe(false);
    expect(r.lines.map((l) => l.text)).toEqual(["start"]);
    expect(runShellScript(w, "set -e\nfalse\ntrue\n").ok).toBe(false);
    expect(runShellScript(w, "grep -q hello \"$1\"", ["a.txt"]).ok).toBe(true);
  });
});

describe(".gitignore", () => {
  it("glob matcher", () => {
    const m = (pattern: string, path: string, isDir = false) => {
      const r = matchIgnore(parseIgnore(pattern), path, isDir);
      return !!r && !r.rule.negate;
    };
    expect(m("*.log", "debug.log")).toBe(true);
    expect(m("*.log", "logs/deep/debug.log")).toBe(true);
    expect(m("*.log", "debug.log.txt")).toBe(false);
    expect(m("debug?.log", "debug1.log")).toBe(true);
    expect(m("/todo.txt", "todo.txt")).toBe(true);
    expect(m("/todo.txt", "docs/todo.txt")).toBe(false);
    expect(m("build/", "build/out.js")).toBe(true);
    expect(m("build/", "build")).toBe(false); // a file named build is not a directory
    expect(m("build/", "src/build/x.js")).toBe(true);
    expect(m("docs/*.md", "docs/a.md")).toBe(true);
    expect(m("docs/*.md", "docs/sub/a.md")).toBe(false);
    expect(m("docs/**/*.md", "docs/sub/deep/a.md")).toBe(true);
    expect(m("**/cache", "a/b/cache/x")).toBe(true);
    expect(m("logs/**", "logs/a/b.txt")).toBe(true);
    expect(m("*.log\n!keep.log", "keep.log")).toBe(false);
    expect(m("*.log\n!keep.log", "other.log")).toBe(true);
    expect(m("# comment\n\n*.tmp", "x.tmp")).toBe(true);
    // a file inside an ignored directory can't be re-included
    expect(m("build/\n!build/keep.js", "build/keep.js")).toBe(true);
    expect(globToRegExp("a.b")).toBe("a\\.b");
  });

  const files = {
    ".gitignore": "# secrets and noise\n*.log\n!important.log\nnode_modules/\n/config.local\n",
    "app.js": "app\n",
  };

  it("hides ignored files from status, shows them with --ignored", () => {
    let w = repoWith(files);
    Object.assign(w.workdir, {
      "debug.log": "x\n",
      "important.log": "keep\n",
      "node_modules/lib/index.js": "lib\n",
      "config.local": "secret\n",
      "sub/config.local": "not anchored\n",
    });
    let r = execute(w, "git status");
    expect(text(r)).not.toMatch(/debug\.log|node_modules|\tconfig\.local/);
    expect(text(r)).toMatch(/important\.log/);
    expect(text(r)).toMatch(/\tsub\/\n/); // wholly untracked folder is collapsed, like real Git
    expect(status(w).map((e) => e.path)).toEqual(["important.log", "sub/config.local"]);
    expect(status(w, { ignored: true }).filter((e) => e.ignored).map((e) => e.path)).toEqual(["config.local", "debug.log", "node_modules/lib/index.js"]);
    r = execute(w, "git status --ignored");
    expect(text(r)).toMatch(/Ignored files:[\s\S]*\tconfig\.local\n\tdebug\.log\n\tnode_modules\//);
    r = execute(w, "git status -s --ignored");
    expect(text(r)).toMatch(/!! debug\.log/);

    w = run(w, "git add .");
    expect(Object.keys(w.repo!.index).sort()).toEqual([".gitignore", "app.js", "important.log", "sub/config.local"]);
  });

  it("refuses to add an ignored file unless -f", () => {
    const w = repoWith(files);
    w.workdir["debug.log"] = "x\n";
    w.workdir["new.js"] = "new\n";
    let r = execute(w, "git add debug.log new.js");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/The following paths are ignored by one of your \.gitignore files:\ndebug\.log\nhint: Use -f if you really want to add them\./);
    expect(r.world.repo!.index["new.js"]).toBe("new\n"); // the other path is still added
    expect(r.world.repo!.index["debug.log"]).toBeUndefined();
    r = execute(w, "git add -f debug.log");
    expect(r.ok).toBe(true);
    expect(r.world.repo!.index["debug.log"]).toBe("x\n");
    w.workdir["node_modules/a.js"] = "a\n";
    r = execute(w, "git add node_modules");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/\nnode_modules\n/);
  });

  it("does not affect tracked files until git rm --cached", () => {
    let w = repoWith({ "app.js": "app\n", "debug.log": "v1\n" });
    w.workdir[".gitignore"] = "*.log\n";
    w.workdir["debug.log"] = "v2\n";
    let r = execute(w, "git status");
    expect(text(r)).toMatch(/modified:\s+debug\.log/); // still tracked, still reported
    r = execute(w, "git check-ignore debug.log");
    expect(r.ok).toBe(false); // tracked files are never ignored
    w = run(w, "git add .", `git commit -m "Ignore logs"`);
    expect(w.repo!.index["debug.log"]).toBe("v2\n");
    r = execute(w, "git rm --cached debug.log");
    expect(r.ok).toBe(true);
    expect(text(r)).toBe("rm 'debug.log'");
    w = r.world;
    expect(w.workdir["debug.log"]).toBe("v2\n");
    r = execute(w, "git status");
    expect(text(r)).toMatch(/deleted:\s+debug\.log/);
    expect(text(r)).not.toMatch(/Untracked files/);
    w = run(w, `git commit -m "Stop tracking logs"`);
    expect(execute(w, "git status").lines.map((l) => l.text)).toContain("nothing to commit, working tree clean");
  });

  it("git check-ignore", () => {
    const w = repoWith(files);
    w.workdir["debug.log"] = "x\n";
    w.workdir["important.log"] = "y\n";
    let r = execute(w, "git check-ignore -v debug.log");
    expect(text(r)).toBe(".gitignore:2:*.log\tdebug.log");
    expect(r.ok).toBe(true);
    r = execute(w, "git check-ignore debug.log app.js");
    expect(text(r)).toBe("debug.log");
    r = execute(w, "git check-ignore app.js");
    expect(r.ok).toBe(false);
    expect(text(r)).toBe("");
    r = execute(w, "git check-ignore important.log");
    expect(r.ok).toBe(false);
    r = execute(w, "git check-ignore -v important.log");
    expect(text(r)).toBe(".gitignore:3:!important.log\timportant.log");
    r = execute(w, "git check-ignore -v node_modules/x/y.js");
    expect(text(r)).toBe(".gitignore:4:node_modules/\tnode_modules/x/y.js");
    expect(execute(w, "git check-ignore").ok).toBe(false);
  });
});

describe("git config", () => {
  it("stores, reads, lists and unsets keys", () => {
    let w = repoWith({ "a.txt": "a\n" });
    let r = execute(w, "git config core.hooksPath .githooks");
    expect(r.ok).toBe(true);
    w = r.world;
    expect(w.repo!.config).toEqual({ "core.hookspath": ".githooks" });
    expect(text(execute(w, "git config core.hookspath"))).toBe(".githooks");
    expect(text(execute(w, "git config --get CORE.HooksPath"))).toBe(".githooks");
    r = execute(w, "git config pull.rebase");
    expect(r.ok).toBe(false);
    expect(text(r)).toBe("");
    w = run(w, `git config --global user.name "Ada Lovelace"`);
    expect(text(execute(w, "git config user.name"))).toBe("Ada Lovelace");
    expect(text(execute(w, "git config --list"))).toBe("user.name=Ada Lovelace\nuser.email=you@gitverse.dev\ncore.hookspath=.githooks");
    w = run(w, "git config --unset core.hooksPath");
    expect(w.repo!.config).toEqual({});
    expect(execute(w, "git config --unset core.hooksPath").ok).toBe(false);
    r = execute(w, "git config nosection value");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/key does not contain a section/);
  });

  it("needs a repo for non-user keys", () => {
    const r = execute(emptyWorld(), "git config core.hooksPath .githooks");
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/git init/);
    expect(execute(emptyWorld(), `git config user.name "Bob"`).ok).toBe(true);
  });
});

describe("hooks", () => {
  const hooked = (hooks: Record<string, string>) =>
    run(repoWith({ "app.js": "const x = 1;\n", ...hooks }), "git config core.hooksPath .githooks");

  it("pre-commit passes and the commit is made", () => {
    let w = hooked({ ".githooks/pre-commit": "#!/bin/sh\n# no debug output allowed\necho running checks\n! grep -rq console.log src\n" });
    w.workdir["src/a.js"] = "export const a = 1;\n";
    const before = headCommitId(w.repo!);
    const r = execute(w, `git add . && git commit -m "Add a"`);
    expect(r.ok).toBe(true);
    expect(text(r)).toMatch(/running checks[\s\S]*\[main [0-9a-f]{7}\] Add a/);
    w = r.world;
    expect(headCommitId(w.repo!)).not.toBe(before);
  });

  it("pre-commit failure aborts the commit; --no-verify bypasses it", () => {
    const w = hooked({
      ".githooks/pre-commit": "#!/bin/sh\ngrep -rq console.log src && echo \"error: remove console.log before committing\" && exit 1\nexit 0\n",
    });
    w.workdir["src/a.js"] = "console.log('debug');\n";
    const staged = run(w, "git add .");
    const before = headCommitId(staged.repo!);
    let r = execute(staged, `git commit -m "Debug"`);
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/remove console\.log/);
    expect(r.explain).toMatch(/pre-commit hook[\s\S]*--no-verify/);
    expect(headCommitId(r.world.repo!)).toBe(before);
    expect(r.world.repo!.index["src/a.js"]).toBeDefined(); // still staged
    r = execute(staged, `git commit --no-verify -m "Debug"`);
    expect(r.ok).toBe(true);
    expect(text(r)).not.toMatch(/remove console\.log/);
    r = execute(staged, `git commit -n -m "Debug"`);
    expect(r.ok).toBe(true);
  });

  it("hook exit status is the last command's, failures in the middle don't stop it", () => {
    const w = hooked({ ".githooks/pre-commit": "false\necho still running\ntrue\n" });
    w.workdir["b.txt"] = "b\n";
    const r = execute(run(w, "git add ."), `git commit -m "B"`);
    expect(r.ok).toBe(true);
    expect(text(r)).toMatch(/still running/);
    const w2 = hooked({ ".githooks/pre-commit": "set -e\nfalse\necho never\n" });
    w2.workdir["b.txt"] = "b\n";
    const r2 = execute(run(w2, "git add ."), `git commit -m "B"`);
    expect(r2.ok).toBe(false);
    expect(text(r2)).not.toMatch(/never/);
  });

  it("hooks cannot modify the real world", () => {
    const w = hooked({ ".githooks/pre-commit": "echo hacked > app.js\nrm .gitignore-not-there\ntouch evil.txt\ntrue\n" });
    w.workdir["b.txt"] = "b\n";
    const r = execute(run(w, "git add ."), `git commit -m "B"`);
    expect(r.ok).toBe(true);
    expect(r.world.workdir["app.js"]).toBe("const x = 1;\n");
    expect(r.world.workdir["evil.txt"]).toBeUndefined();
    expect(r.world.workdir[".git/COMMIT_EDITMSG"]).toBeUndefined();
  });

  it("commit-msg sees the message in $1", () => {
    const w = hooked({
      ".githooks/commit-msg": '#!/bin/sh\ngrep -qE "^(feat|fix|docs): " "$1" && exit 0\necho "error: commit message must start with feat:, fix: or docs:"\ncat "$1"\nexit 1\n',
    });
    const staged = run(w, "git config core.hooksPath .githooks");
    staged.workdir["b.txt"] = "b\n";
    const s2 = run(staged, "git add .");
    let r = execute(s2, `git commit -m "stuff"`);
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/must start with feat[\s\S]*\nstuff/);
    expect(r.explain).toMatch(/commit-msg/);
    r = execute(s2, `git commit -m "feat: add b"`);
    expect(r.ok).toBe(true);
    r = execute(s2, `git commit --no-verify -m "stuff"`);
    expect(r.ok).toBe(true);
  });

  it("hooks are ignored when core.hooksPath is unset", () => {
    const w = repoWith({ ".githooks/pre-commit": "exit 1\n" });
    w.workdir["b.txt"] = "b\n";
    expect(execute(run(w, "git add ."), `git commit -m "B"`).ok).toBe(true);
  });
});

describe("git bisect", () => {
  it("finds the first bad commit in a 10-commit history", () => {
    const { w: start, ids } = buggyHistory();
    let w = start;
    let r = execute(w, "git bisect start");
    expect(text(r)).toBe("status: waiting for both good and bad commits");
    w = r.world;
    r = execute(w, "git bisect bad");
    expect(text(r)).toBe("status: waiting for good commit(s), bad commit known");
    w = r.world;
    r = execute(w, `git bisect good ${ids[0].slice(0, 7)}`);
    expect(text(r)).toBe(`Bisecting: 4 revisions left to test after this (roughly 2 steps)\n[${ids[4]}] Commit 5`);
    expect(r.events).toContainEqual({ type: "checkout", from: "main", to: ids[4], detached: true });
    w = r.world;
    expect(w.repo!.head).toEqual({ kind: "detached", commit: ids[4] });
    expect(w.workdir["math.js"]).toMatch(/a \+ b/);
    expect(w.workdir["notes6.txt"]).toBeUndefined(); // working tree follows the checkout

    r = execute(w, "git status");
    expect(text(r)).toMatch(/HEAD detached at [0-9a-f]{7}\nYou are currently bisecting, started from branch 'main'\./);

    // test at each step: does the bug exist?
    for (let step = 0; step < 6 && !w.repo!.bisect!.found; step++) {
      const good = execute(w, "npm test").ok;
      r = execute(w, `git bisect ${good ? "good" : "bad"}`);
      expect(r.ok).toBe(true);
      w = r.world;
    }
    expect(w.repo!.bisect!.found).toBe(ids[6]);
    expect(text(r)).toMatch(new RegExp(`^${ids[6]} is the first bad commit\ncommit ${ids[6]}\nAuthor: You <you@gitverse.dev>[\\s\\S]*Commit 7[\\s\\S]*math\\.js[\\s\\S]*2 files changed`));
    expect(w.repo!.head).toEqual({ kind: "detached", commit: ids[6] });

    r = execute(w, "git bisect log");
    expect(text(r)).toMatch(/^git bisect start\n# status: waiting for both good and bad commits\n# bad: \[/);
    expect(text(r)).toMatch(/# first bad commit: \[.*\] Commit 7$/);

    r = execute(w, "git bisect reset");
    expect(text(r)).toMatch(/Previous HEAD position was [0-9a-f]{7} Commit 7\nSwitched to branch 'main'/);
    w = r.world;
    expect(w.repo!.bisect).toBeNull();
    expect(w.repo!.head).toEqual({ kind: "branch", name: "main" });
    expect(w.workdir["notes10.txt"]).toBe("note 10\n");
    expect(text(execute(w, "git status"))).not.toMatch(/bisecting/);
  });

  it("matches real git's step messages", () => {
    const { w: start, ids } = buggyHistory();
    let r = execute(start, `git bisect start HEAD ${ids[0]}`);
    expect(text(r)).toMatch(/Bisecting: 4 revisions left to test after this \(roughly 2 steps\)/);
    r = execute(r.world, "git bisect good"); // commit 5 good
    expect(text(r)).toBe(`Bisecting: 2 revisions left to test after this (roughly 1 step)\n[${ids[6]}] Commit 7`);
    r = execute(r.world, "git bisect bad"); // commit 7 bad
    expect(text(r)).toBe(`Bisecting: 0 revisions left to test after this (roughly 0 steps)\n[${ids[5]}] Commit 6`);
    r = execute(r.world, "git bisect good");
    expect(text(r)).toMatch(new RegExp(`^${ids[6]} is the first bad commit`));
  });

  it("git bisect run automates the search", () => {
    const { w, ids } = buggyHistory();
    let r = execute(w, `git bisect start HEAD ${ids[0]}`);
    r = execute(r.world, "git bisect run npm test");
    expect(r.ok).toBe(true);
    expect(text(r)).toMatch(/running 'npm test'/);
    expect(text(r)).toMatch(new RegExp(`${ids[6]} is the first bad commit[\\s\\S]*bisect found first bad commit`));
    expect(r.world.repo!.bisect!.found).toBe(ids[6]);
  });

  it("skip picks another commit", () => {
    const { w, ids } = buggyHistory();
    let r = execute(w, `git bisect start HEAD ${ids[0]}`);
    expect(r.world.repo!.head).toEqual({ kind: "detached", commit: ids[4] });
    r = execute(r.world, "git bisect skip");
    expect(r.ok).toBe(true);
    expect(r.world.repo!.head.kind).toBe("detached");
    expect(r.world.repo!.head).not.toEqual({ kind: "detached", commit: ids[4] });
    expect(r.world.repo!.bisect!.skip).toEqual([ids[4]]);
  });

  it("errors a learner can hit", () => {
    const { w, ids } = buggyHistory();
    let r = execute(w, "git bisect good");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/You need to start by "git bisect start"/);
    expect(r.explain).toBeDefined();
    r = execute(w, "git bisect reset");
    expect(text(r)).toBe("We are not bisecting.");
    // swapped good and bad
    r = execute(w, `git bisect start ${ids[0]} HEAD`);
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/Some good revs are not ancestors of the bad rev/);
    r = execute(w, "git bisect start HEAD nope");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/Bad rev input: nope/);
    expect(execute(emptyWorld(), "git bisect start").ok).toBe(false);
    r = execute(run(w, "git bisect start"), "git bisect run npm test");
    expect(r.ok).toBe(false);
    expect(text(r)).toMatch(/at least one good and one bad/);
  });
});

describe("pre-push hook", () => {
  it("blocks git push when it fails, --no-verify skips it", async () => {
    const { emptyWorld, execute, runScript } = await import("..");
    const URL = "https://github.com/you/p.git";
    let w = emptyWorld({ "a.txt": "1\n", ".githooks/pre-push": "#!/bin/sh\necho running tests\nnpm test\n", "package.json": '{"scripts":{"test":"grep -q ok a.txt"}}' });
    w.hosted[URL] = { url: URL, owner: "you", name: "p", branches: {}, defaultBranch: "main" };
    w = runScript(w, ["git init", "git add .", "git commit -m one", `git remote add origin ${URL}`, "git config core.hooksPath .githooks"]);
    const blocked = execute(w, "git push -u origin main");
    expect(blocked.ok).toBe(false);
    expect(blocked.world.hosted[URL].branches.main).toBeUndefined();
    expect(execute(w, "git push -u origin main --no-verify").ok).toBe(true);
    w.workdir["a.txt"] = "ok\n";
    w = runScript(w, ["git commit -am fix"]);
    expect(execute(w, "git push -u origin main").ok).toBe(true);
  });
});
