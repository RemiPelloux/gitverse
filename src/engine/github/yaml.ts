/**
 * A deliberately small YAML subset, enough for GitHub Actions workflows:
 * block mappings and sequences, `- key: value` items, flow sequences
 * (`[a, b]`), quoted scalars, comments and `|` / `>` block scalars.
 */
export type Yaml = string | null | Yaml[] | { [key: string]: Yaml };

interface Line {
  indent: number;
  text: string;
  /** Raw line (for block scalars). */
  raw: string;
}

function stripComment(s: string): string {
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#" && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s.trimEnd();
}

function scalar(raw: string): Yaml {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null") return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    return inner ? inner.split(",").map((x) => scalar(x)) : [];
  }
  if (s === "{}") return {};
  return s;
}

const KEY = /^("[^"]*"|'[^']*'|[^\s"'#][^:]*?):(\s+|$)(.*)$/;

export function parseYaml(src: string): Yaml {
  const all: Line[] = src.replace(/\t/g, "  ").split("\n").map((raw) => {
    const indent = raw.length - raw.trimStart().length;
    return { indent, text: stripComment(raw.trim()), raw };
  });
  // structural lines skip blanks and comments; block scalars read `all` directly
  let i = 0;
  const skip = () => {
    while (i < all.length && !all[i].text) i++;
  };

  const isItem = (l: Line) => l.text === "-" || l.text.startsWith("- ");

  function blockScalar(parentIndent: number, folded: boolean): string {
    const lines: string[] = [];
    let indent = -1;
    while (i < all.length) {
      const l = all[i];
      if (l.raw.trim() && l.indent <= parentIndent) break;
      if (l.raw.trim() && indent < 0) indent = l.indent;
      lines.push(l.raw.trim() ? l.raw.slice(indent) : "");
      i++;
    }
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return folded ? lines.join(" ") : lines.join("\n") + "\n";
  }

  function value(rest: string, indent: number): Yaml {
    const r = rest.trim();
    if (r === "|" || r === "|-" || r === ">" || r === ">-") {
      i++;
      return blockScalar(indent, r.startsWith(">"));
    }
    i++;
    if (r) return scalar(r);
    skip();
    if (i >= all.length) return null;
    const next = all[i];
    if (next.indent > indent) return block(next.indent);
    if (next.indent === indent && isItem(next)) return sequence(indent);
    return null;
  }

  function mapping(indent: number): { [key: string]: Yaml } {
    const obj: { [key: string]: Yaml } = {};
    for (;;) {
      skip();
      if (i >= all.length) break;
      const l = all[i];
      if (l.indent !== indent || isItem(l)) break;
      const m = KEY.exec(l.text);
      if (!m) {
        i++;
        continue;
      }
      const key = String(scalar(m[1]));
      obj[key] = value(m[3], indent);
    }
    return obj;
  }

  function sequence(indent: number): Yaml[] {
    const arr: Yaml[] = [];
    for (;;) {
      skip();
      if (i >= all.length) break;
      const l = all[i];
      if (l.indent !== indent || !isItem(l)) break;
      const content = l.text.slice(1).trimStart();
      if (!content) {
        i++;
        skip();
        arr.push(i < all.length && all[i].indent > indent ? block(all[i].indent) : null);
      } else if (KEY.test(content) && !content.startsWith("[")) {
        // "- key: value" starts an inline mapping; continue it at the content's indent
        const inner = l.indent + (l.text.length - content.length);
        all[i] = { indent: inner, text: content, raw: " ".repeat(inner) + content };
        arr.push(mapping(inner));
      } else {
        i++;
        arr.push(scalar(content));
      }
    }
    return arr;
  }

  function block(indent: number): Yaml {
    skip();
    if (i >= all.length) return null;
    return isItem(all[i]) ? sequence(indent) : mapping(indent);
  }

  skip();
  if (i >= all.length) return null;
  return block(all[i].indent);
}
