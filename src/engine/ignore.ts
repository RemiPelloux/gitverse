/**
 * `.gitignore` support: a small, dependency-free implementation of Git's
 * ignore rules (root `.gitignore` only).
 *
 * Supported: blank lines and `#` comments, `*`, `?`, `[abc]`, `**`,
 * trailing `/` (directories only), leading `/` (anchored to the root),
 * `!` negation, and slash-less patterns matching at any depth.
 */
import type { FileMap } from "./types";

export const IGNORE_FILE = ".gitignore";

export interface IgnoreRule {
  /** The pattern exactly as written in the file (used by `check-ignore -v`). */
  source: string;
  /** 1-based line number in the ignore file. */
  line: number;
  negate: boolean;
  dirOnly: boolean;
  /** Pattern contains a slash (other than a trailing one): matched against the full path. */
  anchored: boolean;
  re: RegExp;
}

export interface IgnoreMatch {
  rule: IgnoreRule;
  /** The path (file, or one of its parent directories) the rule matched. */
  path: string;
  isDir: boolean;
}

/** Convert a gitignore glob into a regular expression source (no anchors). */
export function globToRegExp(glob: string): string {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        const atStart = i === 0 || glob[i - 1] === "/";
        const atEnd = i + 2 === glob.length;
        if (atStart && glob[i + 2] === "/") {
          // "**/" — zero or more directories
          re += "(?:.*/)?";
          i += 2;
          continue;
        }
        if (atStart && atEnd) {
          // trailing "/**" (or a bare "**") — everything inside
          re += ".*";
          i += 1;
          continue;
        }
        re += "[^/]*";
        i += 1;
        continue;
      }
      re += "[^/]*";
    } else if (ch === "?") re += "[^/]";
    else if (ch === "[") {
      const end = glob.indexOf("]", i + 2);
      if (end === -1) re += "\\[";
      else {
        let cls = glob.slice(i + 1, end);
        if (cls.startsWith("!")) cls = "^" + cls.slice(1);
        re += "[" + cls.replace(/\\/g, "\\\\") + "]";
        i = end;
      }
    } else if (ch === "\\" && i + 1 < glob.length) {
      re += glob[++i].replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    } else re += ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  return re;
}

export function parseIgnore(text: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  text.split("\n").forEach((raw, idx) => {
    const source = raw.replace(/\r$/, "");
    let p = source.replace(/(?<!\\)\s+$/, "");
    if (!p || p.startsWith("#")) return;
    let negate = false;
    if (p.startsWith("!")) {
      negate = true;
      p = p.slice(1);
    } else if (p.startsWith("\\!") || p.startsWith("\\#")) p = p.slice(1);
    let dirOnly = false;
    if (p.endsWith("/")) {
      dirOnly = true;
      p = p.replace(/\/+$/, "");
    }
    if (!p) return;
    const anchored = p.includes("/");
    if (p.startsWith("/")) p = p.slice(1);
    rules.push({ source, line: idx + 1, negate, dirOnly, anchored, re: new RegExp("^" + globToRegExp(p) + "$") });
  });
  return rules;
}

function ruleMatches(rule: IgnoreRule, path: string, isDir: boolean): boolean {
  if (rule.dirOnly && !isDir) return false;
  if (rule.anchored) return rule.re.test(path);
  return rule.re.test(path.slice(path.lastIndexOf("/") + 1));
}

/** Last rule matching exactly this path (Git: the last matching pattern wins). */
function lastMatch(rules: IgnoreRule[], path: string, isDir: boolean): IgnoreRule | null {
  for (let i = rules.length - 1; i >= 0; i--) if (ruleMatches(rules[i], path, isDir)) return rules[i];
  return null;
}

/**
 * Decide whether `path` (a file) is ignored. A file inside an ignored
 * directory is always ignored: like Git, a `!pattern` cannot re-include a
 * file whose parent directory is excluded.
 *
 * Returns the deciding match (which may be a negation, meaning "not
 * ignored"), or null when no pattern applies.
 */
export function matchIgnore(rules: IgnoreRule[], path: string, isDir = false): IgnoreMatch | null {
  if (!rules.length) return null;
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    const dir = parts.slice(0, i).join("/");
    const m = lastMatch(rules, dir, true);
    if (m && !m.negate) return { rule: m, path: dir, isDir: true };
  }
  const m = lastMatch(rules, path, isDir);
  return m ? { rule: m, path, isDir } : null;
}

/** Rules from the working tree's root `.gitignore`. */
export function ignoreRules(workdir: FileMap): IgnoreRule[] {
  const text = workdir[IGNORE_FILE];
  return text ? parseIgnore(text) : [];
}

/** Is this path ignored by the root `.gitignore`? (Does not look at tracking.) */
export function isIgnoredPath(rules: IgnoreRule[], path: string): boolean {
  const m = matchIgnore(rules, path);
  return !!m && !m.rule.negate;
}
