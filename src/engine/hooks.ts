/**
 * Git hooks and a tiny `sh` script runner.
 *
 * Hooks live in the working tree under `core.hooksPath` (e.g. `.githooks`),
 * so lessons can ship them as ordinary files. A hook runs on a scratch copy
 * of the world: it can read the project but can never change the real state.
 */
import type { Ctx } from "./context";
import { getConfig } from "./config";
import { clone } from "./repo";
import { execute } from "./shell";
import type { FileMap, OutLine, World } from "./types";

/** Pseudo path where `commit-msg` hooks find the message (`$1`). */
export const COMMIT_MSG_FILE = ".git/COMMIT_EDITMSG";

export interface ScriptResult {
  ok: boolean;
  /** Exit code: the `exit N` value, otherwise 0/1 from the last command. */
  code: number;
  lines: OutLine[];
  /** The world after the script ran (scratch: callers decide what to keep). */
  world: World;
}

/** Expand positional parameters: $1..$9, ${1}, $@, $*. */
function expandArgs(line: string, args: string[]): string {
  return line
    .replace(/\$\{(\d)\}|\$(\d)/g, (_, a: string | undefined, b: string | undefined) => {
      const n = Number(a ?? b);
      return n === 0 ? "sh" : (args[n - 1] ?? "");
    })
    .replace(/\$[@*]/g, args.join(" "));
}

/**
 * Run a shell script line by line with the simulator's own `execute()`.
 * `sh` semantics: the exit status is that of the last command run, unless
 * `exit N` stops the script first. A failing line does not stop the script,
 * except after `set -e`.
 */
export function runShellScript(world: World, script: string, args: string[] = []): ScriptResult {
  const logical: string[] = [];
  let buf = "";
  for (const raw of script.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.endsWith("\\")) {
      buf += line.slice(0, -1) + " ";
      continue;
    }
    logical.push(buf + line);
    buf = "";
  }
  if (buf) logical.push(buf);

  let w = world;
  let ok = true;
  let errexit = false;
  const lines: OutLine[] = [];
  for (const l of logical) {
    const t = l.trim();
    if (!t || t.startsWith("#")) continue;
    const set = /^set\s+(.*)$/.exec(t);
    if (set) {
      for (const flag of set[1].split(/\s+/)) {
        if (/^-[a-z]*e/.test(flag)) errexit = true;
        else if (/^\+[a-z]*e/.test(flag)) errexit = false;
      }
      continue;
    }
    const r = execute(w, expandArgs(t, args));
    w = r.world;
    lines.push(...r.lines);
    if (r.exit !== undefined) return { ok: r.exit === 0, code: r.exit, lines, world: w };
    ok = r.ok;
    if (errexit && !ok) break;
  }
  return { ok, code: ok ? 0 : 1, lines, world: w };
}

/** Working-tree path of a hook, or null when hooks aren't configured / the hook doesn't exist. */
export function hookPath(world: World, name: string): string | null {
  const dir = getConfig(world, "core.hooksPath");
  if (!dir) return null;
  const clean = dir.replace(/^\.\//, "").replace(/\/+$/, "");
  const path = clean ? `${clean}/${name}` : name;
  return path in world.workdir ? path : null;
}

/**
 * Run a hook and return its full result (null when there is no such hook).
 * Output lines are printed into `ctx`. The real world is never modified.
 */
export function runHookDetailed(ctx: Ctx, name: string, extraFiles: FileMap = {}, args: string[] = []): ScriptResult | null {
  const path = hookPath(ctx.world, name);
  if (!path) return null;
  const scratch = clone(ctx.world);
  Object.assign(scratch.workdir, extraFiles);
  const result = runShellScript(scratch, ctx.world.workdir[path], args);
  for (const l of result.lines) ctx.out(l.text, l.kind);
  return result;
}

/**
 * Run the hook `name` (e.g. "pre-commit", "commit-msg", "pre-push") if
 * `core.hooksPath` is set and `<hooksPath>/<name>` exists in the working tree.
 * `extraFiles` are added to the hook's scratch working tree; `args` become $1, $2…
 * Returns true when the hook is missing or exits 0, false when it rejects.
 */
export function runHook(ctx: Ctx, name: string, extraFiles?: FileMap, args?: string[]): boolean {
  return runHookDetailed(ctx, name, extraFiles, args)?.ok ?? true;
}

/** Plain-language explanation for a rejected hook. */
export function hookExplain(name: string, action: string): string {
  return (
    `The ${name} hook (a script in your project, set up with core.hooksPath) checked your work and said no, so Git stopped before ${action}. ` +
    `Read its message above, fix the problem, and try again. You could skip hooks with --no-verify, but that's usually a bad idea: ` +
    `the hook exists to catch mistakes before they reach your history or your team.`
  );
}
