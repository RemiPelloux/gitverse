import { CommandError, Ctx, fail } from "./context";
import { gitAdd, gitCommit, gitDiff, gitInit, gitLog, gitMv, gitReflog, gitRestore, gitRm, gitShow, gitStatus, gitTag } from "./git/basic";
import { gitBranch, gitCheckout, gitCherryPick, gitMerge, gitRebase, gitReset, gitRevert, gitStash, gitSwitch } from "./git/branching";
import { gitBisect, gitCheckIgnore } from "./git/advanced";
import { bracket, grep, npm, test } from "./builtins";
import { gitConfig } from "./config";
import { PROJECT_PATH } from "./git/helpers";
import { runGh } from "./gh";
import { gitClone, gitFetch, gitPull, gitPush, gitRemote } from "./git/remote";
import { clone } from "./repo";
import type { ExecResult, World } from "./types";

export interface ParsedCommand {
  argv: string[];
  /** stdout redirection (`>` / `>>`). */
  redirect?: { file: string; append: boolean };
  /** stderr redirection target (`2>file`), e.g. "/dev/null". */
  stderr?: string;
  /** Operator that joined this command to the previous one (absent for the first). */
  op?: "&&" | "||" | ";";
}

/** Shell-like tokenizer: quotes, escapes, `>`/`>>`/`2>` redirection, `&&` / `||` / `;` chains. */
export function parse(input: string): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  let argv: string[] = [];
  let cur = "";
  let has = false;
  let quote: '"' | "'" | null = null;
  let redirect: ParsedCommand["redirect"];
  let stderr: string | undefined;
  let pendingRedirect: { append: boolean; fd: 1 | 2 } | null = null;
  let nextOp: ParsedCommand["op"];

  const pushWord = () => {
    if (!has) return;
    if (pendingRedirect) {
      if (pendingRedirect.fd === 2) stderr = cur;
      else redirect = { file: cur, append: pendingRedirect.append };
      pendingRedirect = null;
    } else argv.push(cur);
    cur = "";
    has = false;
  };
  const pushCmd = (op?: ParsedCommand["op"]) => {
    pushWord();
    if (pendingRedirect) throw new CommandError(["bash: syntax error near unexpected token `newline'"]);
    if (argv.length) {
      const cmd: ParsedCommand = { argv, redirect };
      if (stderr !== undefined) cmd.stderr = stderr;
      if (nextOp && commands.length) cmd.op = nextOp;
      commands.push(cmd);
    } else if (op && op !== ";")
      throw new CommandError([`bash: syntax error near unexpected token \`${op}'`], `${op} joins two commands: put a command on both sides, e.g. git add . && git commit -m "msg".`);
    if (op) nextOp = op;
    argv = [];
    redirect = undefined;
    stderr = undefined;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && (input[i + 1] === '"' || input[i + 1] === "\\")) cur += input[++i];
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (ch === "\\" && i + 1 < input.length) {
      cur += input[++i];
      has = true;
    } else if (/\s/.test(ch)) pushWord();
    else if (ch === ">") {
      // "2>" / "1>": a file-descriptor prefix glued to the operator
      let fd: 1 | 2 = 1;
      if (has && (cur === "2" || cur === "1") && !/\s/.test(input[i - 1] ?? " ")) {
        fd = cur === "2" ? 2 : 1;
        cur = "";
        has = false;
      } else pushWord();
      const append = input[i + 1] === ">";
      if (append) i++;
      if (input[i + 1] === "&" && /[012]/.test(input[i + 2] ?? "")) {
        i += 2; // ">&2", "2>&1": descriptor duplication, everything ends up in the terminal
        continue;
      }
      pendingRedirect = { append, fd };
    } else if (ch === "&" && input[i + 1] === "&") {
      i++;
      pushCmd("&&");
    } else if (ch === "|" && input[i + 1] === "|") {
      i++;
      pushCmd("||");
    } else if (ch === ";") pushCmd(";");
    else {
      cur += ch;
      has = true;
    }
  }
  if (quote)
    throw new CommandError(
      ["bash: unexpected EOF while looking for matching quote"],
      `You opened a quote (${quote}) but didn't close it. Messages go inside a pair of quotes: git commit -m "My message"`,
    );
  pushCmd();
  return commands;
}

type Handler = (ctx: Ctx, args: string[]) => void;

export const GIT_COMMANDS: Record<string, Handler> = {
  init: gitInit,
  status: gitStatus,
  add: gitAdd,
  rm: gitRm,
  mv: gitMv,
  commit: gitCommit,
  log: gitLog,
  show: gitShow,
  diff: gitDiff,
  branch: gitBranch,
  switch: gitSwitch,
  checkout: gitCheckout,
  merge: gitMerge,
  rebase: gitRebase,
  reset: gitReset,
  revert: gitRevert,
  restore: gitRestore,
  "cherry-pick": gitCherryPick,
  stash: gitStash,
  bisect: gitBisect,
  "check-ignore": gitCheckIgnore,
  tag: gitTag,
  reflog: gitReflog,
  remote: gitRemote,
  push: gitPush,
  fetch: gitFetch,
  pull: gitPull,
  clone: gitClone,
  config: gitConfig,
  help: gitHelp,
};

/** Real Git commands this simulator doesn't model yet: we say so instead of pretending. */
const NOT_YET = ["worktree", "submodule", "lfs", "blame", "am", "apply", "format-patch", "gc", "notes", "sparse-checkout", "grep", "clean", "describe", "shortlog"];

const SHELL: Record<string, Handler> = {
  ls: (ctx, args) => {
    const showAll = args.some((a) => a.startsWith("-") && a.includes("a"));
    const entries = new Set<string>();
    for (const p of Object.keys(ctx.world.workdir)) {
      const [first, ...rest] = p.split("/");
      entries.add(rest.length ? first + "/" : first);
    }
    const dir = args.find((a) => !a.startsWith("-"));
    if (dir) {
      const prefix = dir.replace(/\/$/, "") + "/";
      const inside = Object.keys(ctx.world.workdir).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length).split("/")[0]);
      if (!inside.length) fail(`ls: cannot access '${dir}': No such file or directory`);
      ctx.out([...new Set(inside)].sort().join("  "));
      return;
    }
    const list = [...entries].sort();
    if (showAll && ctx.world.repo) list.unshift(".git/");
    if (list.length) ctx.out(list.join("  "));
  },
  cat: (ctx, args) => {
    if (!args.length) fail("cat: missing file operand");
    for (const f of args) {
      if ((f === ".git" || f.startsWith(".git/")) && !(f in ctx.world.workdir)) fail(`cat: ${f}: Is a directory (Gitverse keeps .git internals in the graph instead)`);
      const c = ctx.world.workdir[f];
      if (c === undefined) fail(`cat: ${f}: No such file or directory`);
      if (c) ctx.out(c.replace(/\n$/, "").split("\n"));
    }
  },
  touch: (ctx, args) => {
    if (!args.length) fail("touch: missing file operand");
    for (const f of args) if (!(f in ctx.world.workdir)) ctx.world.workdir[f] = "";
    ctx.emit({ type: "file-change", paths: args });
  },
  echo: (ctx, args) => ctx.out(args.join(" ")),
  rm: (ctx, args) => {
    const files = args.filter((a) => !a.startsWith("-"));
    if (!files.length) fail("rm: missing operand");
    for (const f of files) {
      const matches = Object.keys(ctx.world.workdir).filter((p) => p === f || p.startsWith(f.replace(/\/$/, "") + "/"));
      if (!matches.length) fail(`rm: cannot remove '${f}': No such file or directory`);
      if (matches.length > 1 || matches[0] !== f) {
        if (!args.some((a) => a.startsWith("-") && a.includes("r"))) fail(`rm: cannot remove '${f}': Is a directory`);
      }
      for (const m of matches) delete ctx.world.workdir[m];
    }
    ctx.emit({ type: "file-change", paths: files });
  },
  mv: (ctx, args) => {
    const [a, b] = args;
    if (!a || !b) fail("mv: missing destination file operand");
    if (!(a in ctx.world.workdir)) fail(`mv: cannot stat '${a}': No such file or directory`);
    ctx.world.workdir[b] = ctx.world.workdir[a];
    delete ctx.world.workdir[a];
    ctx.emit({ type: "file-change", paths: [a, b] });
  },
  mkdir: (ctx, args) => {
    void args;
    ctx.out("(Folders appear automatically when you create a file inside them, e.g. touch src/app.ts)", "muted");
  },
  pwd: (ctx) => ctx.out(PROJECT_PATH),
  whoami: (ctx) => ctx.out(ctx.world.user.name.toLowerCase()),
  clear: (ctx) => {
    ctx.clear = true;
  },
  grep,
  test,
  "[": bracket,
  true: () => {},
  false: (ctx) => {
    ctx.ok = false;
  },
  npm,
  help: (ctx) => {
    ctx.out(
      [
        "Gitverse simulated terminal — everything here runs in a safe sandbox.",
        "",
        "Git:    git init | status | add | commit | log | diff | show | branch | switch",
        "        checkout | merge | rebase | reset | restore | revert | cherry-pick",
        "        stash | tag | reflog | remote | fetch | pull | push | clone | config",
        "        bisect | check-ignore",
        "Files:  ls  cat <file>  touch <file>  echo \"text\" > <file>  rm <file>  mv <a> <b>",
        "Search: grep [-qinrlvcE] <pattern> [files]",
        "Script: test / [ ]  true  false  exit <n>  ! <cmd>  npm test  npm run <script>",
        "        a && b (b only if a worked)   a || b (b only if a failed)   a ; b (always both)",
        "Other:  clear  help  git help <command>",
      ],
      "muted",
    );
  },
};

function gitHelp(ctx: Ctx, args: string[]) {
  if (args[0]) {
    ctx.out(`Open the Command Encyclopedia in Gitverse for an interactive guide to 'git ${args[0]}'.`, "muted");
    return;
  }
  SHELL.help(ctx, []);
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function closest(word: string, options: string[]): string | null {
  let best: string | null = null;
  let score = Infinity;
  for (const o of options) {
    const d = levenshtein(word, o);
    if (d < score) {
      score = d;
      best = o;
    }
  }
  return score <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}

function runOne(ctx: Ctx, cmd: ParsedCommand): string | null {
  const [name, ...args] = cmd.argv;
  if (name === "git") {
    const [sub, ...rest] = args;
    if (!sub || sub === "--help" || sub === "-h") {
      gitHelp(ctx, []);
      return "help";
    }
    if (sub === "--version" || sub === "version") {
      ctx.out("git version 2.47.0 (gitverse simulator)");
      return "version";
    }
    if (rest.includes("--help") || rest.includes("-h")) {
      gitHelp(ctx, [sub]);
      return "help";
    }
    const handler = GIT_COMMANDS[sub];
    if (handler) {
      handler(ctx, rest);
      return sub;
    }
    if (NOT_YET.includes(sub))
      fail(
        `gitverse: 'git ${sub}' is a real Git command, but it isn't available in this simulator yet.`,
        "This command is covered in a later chapter. Everything else you try here behaves like real Git.",
      );
    const guess = closest(sub, Object.keys(GIT_COMMANDS));
    fail(
      [`git: '${sub}' is not a git command. See 'git --help'.`, ...(guess ? ["", "The most similar command is", `\t${guess}`] : [])],
      guess ? `Looks like a typo — did you mean git ${guess}?` : "That isn't a Git command. Type help to see what you can use.",
    );
  }
  if (name === "gh") {
    runGh(ctx, args);
    return args[0] ? `gh ${args[0]}` : "gh";
  }
  if (name === "echo" && cmd.redirect) {
    if (cmd.redirect.file === "/dev/null") return "echo";
    const text = args.join(" ") + "\n";
    const { file, append } = cmd.redirect;
    ctx.world.workdir[file] = append ? (ctx.world.workdir[file] ?? "") + text : text;
    ctx.emit({ type: "file-change", paths: [file] });
    return "echo";
  }
  const shell = SHELL[name];
  if (shell) {
    shell(ctx, args);
    return name;
  }
  const guess = closest(name, ["git", "gh", "exit", ...Object.keys(SHELL)]);
  fail(
    [`bash: ${name}: command not found`],
    guess ? `Did you mean ${guess}? (Watch out for typos — the terminal is picky!)` : "Only Git and a few file commands work in this sandbox. Type help to see them.",
  );
}

/** Thrown by the `exit` builtin to stop the rest of the line. */
class ExitSignal {
  constructor(public code: number) {}
}

let depth = 0;

/**
 * Execute one line of input against a world. Pure: the input world is never
 * mutated. A failing command leaves the world untouched (atomic).
 *
 * Chains follow bash: `a && b` runs b only if a succeeded, `a || b` only if
 * it failed, `a ; b` always runs both. The line's status is the status of
 * the last command that ran. `! cmd` inverts a command's status; `exit N`
 * stops the line with status N.
 */
export function execute(world: World, input: string): ExecResult {
  const trimmed = input.trim();
  const ctx = new Ctx(clone(world));
  if (!trimmed) return ctx.result(null);
  if (depth > 12) {
    ctx.out("bash: maximum nesting level exceeded (a script, hook or npm script keeps calling itself)", "error");
    ctx.ok = false;
    return ctx.result(null);
  }
  depth++;
  let lastCommand: string | null = null;
  let lastOk = true;
  let exitCode: number | undefined;
  try {
    const cmds = parse(trimmed);
    for (const cmd of cmds) {
      if (cmd.op === "&&" && !lastOk) continue;
      if (cmd.op === "||" && lastOk) continue;
      const negate = cmd.argv[0] === "!";
      const argv = negate ? cmd.argv.slice(1) : cmd.argv;
      const snapshot = clone(ctx.world);
      const mark = ctx.lines.length;
      const explainBefore = ctx.explain;
      ctx.ok = true;
      let ok: boolean;
      try {
        if (!argv.length) ok = true; // a lone "!" negates an empty (successful) command
        else if (argv[0] === "exit") {
          const arg = argv[1];
          if (arg !== undefined && !/^-?\d+$/.test(arg)) {
            ctx.out(`bash: exit: ${arg}: numeric argument required`, "error");
            throw new ExitSignal(2);
          }
          throw new ExitSignal(arg === undefined ? (lastOk ? 0 : 1) : ((Number(arg) % 256) + 256) % 256);
        } else {
          lastCommand = runOne(ctx, { ...cmd, argv });
          ok = ctx.ok;
        }
      } catch (e) {
        if (e instanceof ExitSignal) {
          exitCode = e.code;
          lastOk = e.code === 0;
          lastCommand = "exit";
          break;
        }
        if (!(e instanceof CommandError)) throw e;
        ctx.world = snapshot;
        if (!negate) {
          ctx.out(e.lines, "error");
          ctx.explain = e.explain;
        }
        ok = false;
        lastCommand = argv[0] === "git" ? (argv[1] ?? "git") : (argv[0] ?? "!");
      }
      applyRedirects(ctx, cmd, mark);
      if (negate) {
        ok = !ok;
        ctx.explain = explainBefore;
      }
      lastOk = ok;
    }
  } catch (e) {
    if (!(e instanceof CommandError)) throw e;
    ctx.out(e.lines, "error");
    lastOk = false;
    ctx.explain = e.explain;
  } finally {
    depth--;
  }
  ctx.ok = lastOk;
  const result = ctx.result(lastCommand);
  if (exitCode !== undefined) result.exit = exitCode;
  return result;
}

/** Apply `> file`, `>> file` and `2> file` to the lines a command printed (echo handles its own `>`). */
function applyRedirects(ctx: Ctx, cmd: ParsedCommand, mark: number) {
  const produced = ctx.lines.slice(mark);
  if (!produced.length) {
    if (cmd.redirect && cmd.argv[0] !== "echo" && cmd.redirect.file !== "/dev/null" && !cmd.redirect.append) {
      ctx.world.workdir[cmd.redirect.file] = "";
      ctx.emit({ type: "file-change", paths: [cmd.redirect.file] });
    }
    return;
  }
  let keep = produced;
  if (cmd.stderr !== undefined) {
    const errs = keep.filter((l) => l.kind === "error");
    keep = keep.filter((l) => l.kind !== "error");
    if (cmd.stderr !== "/dev/null" && errs.length) writeFile(ctx, cmd.stderr, errs.map((l) => l.text), false);
  }
  if (cmd.redirect && cmd.argv[0] !== "echo") {
    const outs = keep.filter((l) => l.kind !== "error");
    keep = keep.filter((l) => l.kind === "error");
    if (cmd.redirect.file !== "/dev/null") writeFile(ctx, cmd.redirect.file, outs.map((l) => l.text), cmd.redirect.append);
  }
  if (keep !== produced) ctx.lines.splice(mark, produced.length, ...keep);
}

function writeFile(ctx: Ctx, file: string, lines: string[], append: boolean) {
  const text = lines.length ? lines.join("\n") + "\n" : "";
  ctx.world.workdir[file] = append ? (ctx.world.workdir[file] ?? "") + text : text;
  ctx.emit({ type: "file-change", paths: [file] });
}

/** Run several commands in order (used for scenario setup and demos). */
export function runScript(world: World, commands: string[]): World {
  let w = world;
  for (const c of commands) {
    const r = execute(w, c);
    if (!r.ok) throw new Error(`Script failed at "${c}":\n${r.lines.map((l) => l.text).join("\n")}`);
    w = r.world;
  }
  return w;
}
