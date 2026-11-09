/** Shell builtins used by hooks, CI scripts and lessons: grep, test / [, npm. */
import { fail, type Ctx } from "./context";
import { execute } from "./shell";

type Handler = (ctx: Ctx, args: string[]) => void;

const isInternal = (p: string) => p === ".git" || p.startsWith(".git/");

/** Translate a POSIX basic regular expression (grep without -E) into JS syntax. */
function breToJs(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      const next = pattern[++i];
      out += "|()+?{}".includes(next) ? next : "\\" + next;
    } else if ("|()+?{}".includes(ch)) out += "\\" + ch;
    else out += ch;
  }
  return out;
}

export const grep: Handler = (ctx, args) => {
  const flags = new Set<string>();
  const patterns: string[] = [];
  const operands: string[] = [];
  let endOfOptions = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!endOfOptions && a === "--") endOfOptions = true;
    else if (!endOfOptions && a === "-e") {
      if (args[i + 1] === undefined) fail("grep: option requires an argument -- 'e'");
      patterns.push(args[++i]);
    } else if (!endOfOptions && a.startsWith("--")) {
      const long: Record<string, string> = {
        "--quiet": "q", "--silent": "q", "--ignore-case": "i", "--line-number": "n", "--recursive": "r",
        "--files-with-matches": "l", "--invert-match": "v", "--count": "c", "--extended-regexp": "E",
      };
      if (!long[a]) fail(`grep: unrecognized option '${a}'`, "Supported grep options here: -q -i -n -r -l -v -c -E -e.");
      flags.add(long[a]);
    } else if (!endOfOptions && a.startsWith("-") && a.length > 1) {
      for (const f of a.slice(1)) {
        if (!"qinrRlvcEFsw".includes(f)) fail(`grep: invalid option -- '${f}'`, "Supported grep options here: -q -i -n -r -l -v -c -E -w -F.");
        flags.add(f === "R" ? "r" : f);
      }
    } else operands.push(a);
  }
  if (!patterns.length) {
    const p = operands.shift();
    if (p === undefined)
      fail(["Usage: grep [OPTION]... PATTERNS [FILE]...", "Try 'grep --help' for more information."], 'grep needs a pattern to search for, then the files to look in. Example: grep "TODO" app.js');
    patterns.push(p);
  }
  const recursive = flags.has("r");
  const workdir = ctx.world.workdir;
  let files: string[] = [];
  const missing: string[] = [];
  if (!operands.length) {
    if (!recursive)
      fail(
        "grep: (standard input): no input in the Gitverse sandbox",
        'Tell grep which files to search, e.g. grep "TODO" app.js, or search the whole project with grep -r "TODO" .',
      );
    files = Object.keys(workdir).filter((p) => !isInternal(p)).sort();
  } else {
    for (const op of operands) {
      const clean = op.replace(/^\.\//, "").replace(/\/+$/, "");
      if (clean in workdir) files.push(clean);
      else {
        const inside = Object.keys(workdir).filter((p) => (op === "." || clean === "" || p.startsWith(clean + "/")) && (!isInternal(p) || isInternal(clean))).sort();
        if (inside.length) {
          if (recursive) files.push(...inside);
          else ctx.out(`grep: ${op}: Is a directory`, "error");
        } else missing.push(op);
      }
    }
  }
  let source = patterns
    .map((p) => (flags.has("F") ? p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : flags.has("E") ? p : breToJs(p)))
    .map((p) => `(?:${p})`)
    .join("|");
  if (flags.has("w")) source = `(?<![\\w])(?:${source})(?![\\w])`;
  let re: RegExp;
  try {
    re = new RegExp(source, flags.has("i") ? "i" : "");
  } catch {
    fail(`grep: Invalid regular expression: ${patterns.join(" ")}`, "The search pattern isn't a valid regular expression. Check unbalanced brackets or parentheses.");
  }
  const showNames = recursive || files.length + missing.length > 1;
  const invert = flags.has("v");
  let selected = 0;
  for (const f of files) {
    const lines = workdir[f].split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    let count = 0;
    lines.forEach((line, idx) => {
      if (re.test(line) === invert) return;
      count++;
      if (flags.has("q") || flags.has("l") || flags.has("c")) return;
      ctx.out(`${showNames ? f + ":" : ""}${flags.has("n") ? idx + 1 + ":" : ""}${line}`);
    });
    selected += count;
    if (flags.has("q")) continue;
    if (flags.has("l") && count) ctx.out(f);
    else if (flags.has("c")) ctx.out(`${showNames ? f + ":" : ""}${count}`);
  }
  if (missing.length && !flags.has("s")) for (const m of missing) ctx.out(`grep: ${m}: No such file or directory`, "error");
  // exit status: 0 if a line was selected, 1 otherwise (silently), 2 on errors (unless -q found a match)
  if (flags.has("q") && selected) return;
  if (!selected || missing.length) ctx.ok = false;
};

/** `test EXPR` / `[ EXPR ]`: silent, exit status only. */
export function testExpr(ctx: Ctx, args: string[]): boolean {
  const w = ctx.world.workdir;
  const clean = (p: string) => p.replace(/^\.\//, "").replace(/\/+$/, "");
  const isDir = (p: string) => p === "." || p === "" || Object.keys(w).some((k) => k.startsWith(clean(p) + "/"));
  const evalExpr = (e: string[]): boolean => {
    if (e[0] === "!" && e.length > 1) return !evalExpr(e.slice(1));
    const and = e.indexOf("-a");
    if (and > 0) return evalExpr(e.slice(0, and)) && evalExpr(e.slice(and + 1));
    const or = e.indexOf("-o");
    if (or > 0) return evalExpr(e.slice(0, or)) || evalExpr(e.slice(or + 1));
    if (e.length === 0) return false;
    if (e.length === 1) return e[0] !== "";
    if (e.length === 2) {
      const [op, v] = e;
      switch (op) {
        case "-f":
          return clean(v) in w;
        case "-e":
          return clean(v) in w || isDir(v);
        case "-d":
          return isDir(v);
        case "-s":
          return !!w[clean(v)];
        case "-r":
        case "-w":
          return clean(v) in w || isDir(v);
        case "-x":
          return clean(v) in w;
        case "-n":
          return v !== "";
        case "-z":
          return v === "";
        default:
          fail(`test: ${op}: unary operator expected`, "Supported here: -f -e -d -s -n -z, = != and -eq -ne -lt -le -gt -ge.");
      }
    }
    if (e.length === 3) {
      const [a, op, b] = e;
      const num = (x: string) => {
        if (!/^-?\d+$/.test(x.trim())) fail(`test: ${x}: integer expression expected`);
        return Number(x);
      };
      switch (op) {
        case "=":
        case "==":
          return a === b;
        case "!=":
          return a !== b;
        case "-eq":
          return num(a) === num(b);
        case "-ne":
          return num(a) !== num(b);
        case "-lt":
          return num(a) < num(b);
        case "-le":
          return num(a) <= num(b);
        case "-gt":
          return num(a) > num(b);
        case "-ge":
          return num(a) >= num(b);
        default:
          fail(`test: ${op}: binary operator expected`);
      }
    }
    fail("test: too many arguments", "Wrap values that contain spaces in quotes, e.g. test \"$a\" = \"hello world\".");
  };
  return evalExpr(args);
}

export const test: Handler = (ctx, args) => {
  if (!testExpr(ctx, args)) ctx.ok = false;
};

export const bracket: Handler = (ctx, args) => {
  if (args[args.length - 1] !== "]") fail("[: missing `]'", "The [ command needs a closing ] with a space before it: [ -f README.md ]");
  if (!testExpr(ctx, args.slice(0, -1))) ctx.ok = false;
};

let npmDepth = 0;

export const npm: Handler = (ctx, args) => {
  const [sub, ...rest] = args;
  let name: string | undefined;
  if (sub === "test" || sub === "t" || sub === "tst") name = "test";
  else if (sub === "start") name = "start";
  else if (sub === "run" || sub === "run-script") name = rest[0];
  else if (sub === "--version" || sub === "-v") return ctx.out("10.9.0");
  else if (sub === "install" || sub === "i" || sub === "ci") {
    ctx.out(["", "up to date, audited 1 package in 0.4s", "", "found 0 vulnerabilities"]);
    return;
  } else
    fail(
      sub ? [`Unknown command: "${sub}"`, "", 'To see a list of supported npm commands, run:', "  npm help"] : ["npm <command>", "", "Usage:", "", "npm test", "npm run <script>"],
      "In this sandbox npm can run the scripts from package.json: npm test, npm start or npm run <name>.",
    );
  const raw = ctx.world.workdir["package.json"];
  if (raw === undefined)
    fail(
      [
        "npm error code ENOENT",
        "npm error syscall open",
        "npm error path /home/you/project/package.json",
        "npm error errno -2",
        "npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/home/you/project/package.json'",
      ],
      "npm reads its scripts from package.json, and this project doesn't have one.",
    );
  let pkg: { name?: string; version?: string; scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(raw);
  } catch {
    fail(["npm error code EJSONPARSE", "npm error JSON.parse Invalid package.json"], "package.json isn't valid JSON (check commas and quotes), so npm can't read it.");
  }
  const scripts = pkg.scripts ?? {};
  if (!name) {
    const names = Object.keys(scripts);
    if (!names.length) return;
    ctx.out(`Scripts available in ${pkg.name ?? "project"} via \`npm run-script\`:`);
    for (const n of names) ctx.out([`  ${n}`, `    ${scripts[n]}`]);
    return;
  }
  const script = scripts[name];
  if (script === undefined)
    fail(
      [`npm error Missing script: "${name}"`, "npm error", "npm error To see a list of scripts, run:", "npm error   npm run"],
      `package.json has no "${name}" entry under "scripts", so npm doesn't know what to run.`,
    );
  if (npmDepth > 5) fail("npm error: scripts call each other too deeply", "An npm script keeps running npm again; check package.json for a loop.");
  ctx.out([`> ${pkg.name ? `${pkg.name}@${pkg.version ?? "1.0.0"} ` : ""}${name}`, `> ${script}`, ""], "muted");
  npmDepth++;
  let r;
  try {
    r = execute(ctx.world, script);
  } finally {
    npmDepth--;
  }
  ctx.world = r.world;
  for (const l of r.lines) ctx.out(l.text, l.kind);
  for (const e of r.events) ctx.emit(e);
  if (!r.ok) {
    ctx.ok = false;
    ctx.explain = r.explain ?? `The "${name}" script failed (see its output above). npm passes the failure on, so anything waiting for it (a hook, CI) fails too.`;
  }
};
