import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { emptyWorld, execute, runScript, type World } from "@/engine";
import { hookExplain } from "@/engine/hooks";
import { translateExplain } from "../engine-fr";

const ENGINE = path.resolve(import.meta.dirname, "../../engine");

/** Placeholder values tried for each `${...}` in a templated explanation. */
const SAMPLES = ["feature/x", "1"];

/**
 * Every learner-facing explanation written in the engine source: the 2nd argument of
 * fail() / ctx.error(), `x.explain = ...` and `explain: ...` properties. Templates are
 * expanded with sample values; ternaries yield both branches.
 */
function engineExplains(): Array<{ where: string; variants: string[] }> {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) {
        if (f !== "__tests__") walk(p);
      } else if (p.endsWith(".ts")) files.push(p);
    }
  };
  walk(ENGINE);
  const found: Array<{ where: string; variants: string[] }> = [];
  for (const file of files) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const consts = new Map<string, ts.Expression>();
    const collect = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) consts.set(n.name.text, n.initializer);
      ts.forEachChild(n, collect);
    };
    collect(sf);
    /** All strings an expression can produce (one per sample for templates); null = not statically known. */
    const values = (e: ts.Expression): string[][] | null => {
      if (ts.isParenthesizedExpression(e)) return values(e.expression);
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [SAMPLES.map(() => e.text)];
      if (ts.isTemplateExpression(e))
        return [SAMPLES.map((s) => e.head.text + e.templateSpans.map((sp) => s + sp.literal.text).join(""))];
      if (ts.isConditionalExpression(e)) return [...(values(e.whenTrue) ?? []), ...(values(e.whenFalse) ?? [])];
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return values(e.right);
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const l = values(e.left);
        const r = values(e.right);
        if (l?.length !== 1 || r?.length !== 1) return null;
        return [SAMPLES.map((_, i) => l[0][i] + r[0][i])];
      }
      if (ts.isIdentifier(e) && consts.has(e.text)) return values(consts.get(e.text)!);
      if (ts.isCallExpression(e) && e.expression.getText() === "hookExplain") {
        const args = e.arguments.map((a) => (ts.isStringLiteral(a) ? a.text : null));
        if (args.every((a) => a !== null)) return [SAMPLES.map(() => hookExplain(args[0]!, args[1]!))];
      }
      return null; // forwarded value (e.explain, a variable): its source is checked where it is written
    };
    const take = (e: ts.Expression) => {
      const where = `${path.relative(ENGINE, file)}:${sf.getLineAndCharacterOfPosition(e.getStart()).line + 1}`;
      for (const variants of values(e) ?? []) found.push({ where, variants });
    };
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const name = n.expression.getText();
        if ((name === "fail" || name.endsWith(".error")) && n.arguments[1]) take(n.arguments[1]);
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText().endsWith(".explain")) take(n.right);
      if (ts.isPropertyAssignment(n) && n.name.getText() === "explain") take(n.initializer);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return found;
}

const URL = "https://github.com/you/project.git";
const run = (w: World, ...c: string[]) => runScript(w, c);

function connected(): World {
  const w = emptyWorld({ "a.txt": "1\n" });
  w.hosted[URL] = { url: URL, owner: "you", name: "project", branches: {}, defaultBranch: "main" };
  return run(w, "git init", "git add .", "git commit -m one", `git remote add origin ${URL}`, "git push -u origin main");
}

function teammatePush(w: World, file: string, content: string): World {
  let mate = { ...emptyWorld(), hosted: structuredClone(w.hosted), hostedCommits: structuredClone(w.hostedCommits), clock: w.clock + 500, seq: w.seq };
  mate = run(mate, `git clone ${URL}`);
  mate.workdir[file] = content;
  mate = run(mate, "git add .", "git commit -m teammate", "git push");
  return { ...w, hosted: mate.hosted, hostedCommits: mate.hostedCommits, seq: mate.seq, clock: mate.clock };
}

function conflicted(): World {
  return run(
    emptyWorld({ "a.txt": "base\n" }),
    "git init", "git add .", 'git commit -m "base"',
    "git switch -c feature", 'echo "feature" > a.txt', 'git commit -am "f"',
    "git switch main", 'echo "main" > a.txt', 'git commit -am "m"',
  );
}

/** [label, world, command] — each must fail with a plain-language explanation. */
const cases: Array<[string, () => World, string]> = [
  ["commit with nothing at all", () => run(emptyWorld(), "git init"), "git commit -m x"],
  ["commit with nothing staged", () => run(emptyWorld({ "a.txt": "1\n" }), "git init"), "git commit -m x"],
  ["commit on a clean tree", () => connected(), "git commit -m x"],
  ["not a repository", () => emptyWorld(), "git status"],
  ["add a missing file", () => run(emptyWorld(), "git init"), "git add nope.txt"],
  ["switch to a missing branch", () => connected(), "git switch nope"],
  ["create an existing branch", () => connected(), "git branch main"],
  ["typo in a git command", () => connected(), "git comit"],
  ["unknown program", () => connected(), "gti status"],
  ["push without a remote", () => run(emptyWorld({ "a.txt": "1\n" }), "git init", "git add .", "git commit -m one"), "git push"],
  ["merge conflict", conflicted, "git merge feature"],
  [
    "push rejected",
    () => {
      const w = teammatePush(connected(), "b.txt", "b\n");
      w.workdir["a.txt"] = "2\n";
      return run(w, "git commit -am mine");
    },
    "git push",
  ],
];

describe("translateExplain", () => {
  it("leaves English and unknown strings untouched", () => {
    expect(translateExplain("Anything at all.", "en")).toBe("Anything at all.");
    expect(translateExplain("Not a known explanation.", "fr")).toBe("Not a known explanation.");
    expect(translateExplain(undefined, "fr")).toBeUndefined();
  });

  for (const [label, setup, cmd] of cases) {
    it(`translates: ${label}`, () => {
      const r = execute(setup(), cmd);
      expect(r.ok).toBe(false);
      expect(r.explain, `no explanation for ${cmd}`).toBeTruthy();
      expect(translateExplain(r.explain, "en")).toBe(r.explain);
      const fr = translateExplain(r.explain, "fr");
      expect(fr, `untranslated: ${r.explain}`).not.toBe(r.explain);
    });
  }

  it("has a French version of every explanation in the engine source", () => {
    const all = engineExplains();
    expect(all.length).toBeGreaterThan(100);
    const missing = all
      .filter(({ variants }) => variants.every((v) => translateExplain(v, "fr") === v))
      .map(({ where, variants }) => `${where}: ${variants[0]}`);
    expect(missing, `untranslated explanations:\n${missing.join("\n")}`).toEqual([]);
  });

  it("translates multi-line explanations line by line", () => {
    const a = "That isn't a Git command. Type help to see what you can use.";
    const b = "Only Git and a few file commands work in this sandbox. Type help to see them.";
    expect(translateExplain(`${a}\n${b}`, "fr")).toBe(`${translateExplain(a, "fr")}\n${translateExplain(b, "fr")}`);
  });

  it("keeps names verbatim in interpolated explanations", () => {
    const r = execute(connected(), "git switch my-feature");
    const fr = translateExplain(r.explain, "fr")!;
    expect(fr).toContain('"my-feature"');
    expect(fr).toContain("git switch -c my-feature");
    expect(translateExplain(execute(connected(), "git branch main").explain, "fr")).toContain("git switch main");
  });
});
