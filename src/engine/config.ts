/** `git config`: user.name / user.email live on `world.user`, everything else in `repo.config`. */
import { fail, type Ctx } from "./context";
import type { World } from "./types";

/**
 * Git config keys are case-insensitive in their section and variable name
 * (`core.hooksPath` === `core.hookspath`); a middle subsection keeps its case.
 */
export function normalizeKey(key: string): string {
  const parts = key.split(".");
  if (parts.length < 2) return key.toLowerCase();
  const first = parts[0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase();
  return [first, ...parts.slice(1, -1), last].join(".");
}

/** Read a config value (null when unset). */
export function getConfig(world: World, key: string): string | null {
  const k = normalizeKey(key);
  if (k === "user.name") return world.user.name;
  if (k === "user.email") return world.user.email;
  return world.repo?.config?.[k] ?? null;
}

export function gitConfig(ctx: Ctx, args: string[]) {
  const world = ctx.world;
  let list = false;
  let unset = false;
  let get = false;
  let global = false;
  const pos: string[] = [];
  for (const a of args) {
    if (a === "--list" || a === "-l") list = true;
    else if (a === "--unset") unset = true;
    else if (a === "--get") get = true;
    else if (a === "--global" || a === "--system") global = true;
    else if (a === "--local") continue;
    else if (a.startsWith("-") && a.length > 1) fail(`error: unknown option \`${a.replace(/^-+/, "")}'`, "Supported here: git config <key> [<value>], --list, --unset <key>, --get <key>, --global.");
    else pos.push(a);
  }
  if (list) {
    ctx.out([`user.name=${world.user.name}`, `user.email=${world.user.email}`]);
    for (const [k, v] of Object.entries(world.repo?.config ?? {})) ctx.out(`${k}=${v}`);
    return;
  }
  const [rawKey, value] = pos;
  if (!rawKey)
    fail(
      "usage: git config [--global] <key> [<value>]",
      'Give a setting name, and a value to change it. Example: git config user.name "Ada Lovelace". Use git config --list to see everything.',
    );
  if (!/^[A-Za-z][A-Za-z0-9-]*(\.[^\s]+)?\.[A-Za-z][A-Za-z0-9-]*$/.test(rawKey)) {
    if (!rawKey.includes("."))
      fail(`error: key does not contain a section: ${rawKey}`, `Config keys look like section.name, for example user.name or core.hooksPath. "${rawKey}" is missing the section part.`);
    fail(`error: invalid key: ${rawKey}`, "Config keys look like section.name, for example core.hooksPath.");
  }
  const key = normalizeKey(rawKey);
  const reading = get || (value === undefined && !unset);

  if (key === "user.name" || key === "user.email") {
    const field = key === "user.name" ? "name" : "email";
    if (reading) return ctx.out(world.user[field]);
    if (unset) return; // the simulator always keeps an identity
    world.user[field] = value;
    return;
  }

  const repo = world.repo;
  if (!repo) {
    if (reading || unset) {
      ctx.ok = false;
      return;
    }
    fail(
      global ? `error: could not lock config file ~/.gitconfig: not available in this sandbox` : "fatal: not in a git directory",
      "This setting is stored inside a repository's .git/config, and there's no repository here yet. Run git init first, then set it.",
    );
  }
  repo.config ??= {};
  if (unset) {
    if (!(key in repo.config)) {
      ctx.ok = false; // real git: exit code 5, no message
      return;
    }
    delete repo.config[key];
    return;
  }
  if (reading) {
    const v = repo.config[key];
    if (v === undefined) ctx.ok = false; // unset key: exit code 1, no output
    else ctx.out(v);
    return;
  }
  repo.config[key] = value;
}
