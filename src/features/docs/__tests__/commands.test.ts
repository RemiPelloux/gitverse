import { describe, expect, it } from "vitest";
import { COMMAND_DOCS, categoryLabel, explainTokens, localizedDocs } from "../commands";
import { CATEGORY_FR, COMMAND_DOCS_FR } from "../commands.fr";

describe("French command docs", () => {
  it("covers every command with matching flags and risk notes", () => {
    for (const d of COMMAND_DOCS) {
      const fr = COMMAND_DOCS_FR[d.name];
      expect(fr, d.name).toBeDefined();
      expect(fr.flags.length, d.name).toBe(d.flags.length);
      expect(Boolean(fr.riskNote), d.name).toBe(Boolean(d.riskNote));
    }
    expect(Object.keys(COMMAND_DOCS_FR).sort()).toEqual(COMMAND_DOCS.map((d) => d.name).sort());
  });

  it("localizedDocs overlays French text and keeps structure", () => {
    expect(localizedDocs("en")).toBe(COMMAND_DOCS);
    const fr = localizedDocs("fr");
    expect(localizedDocs("fr")).toBe(fr); // memoized
    const commit = fr.find((d) => d.name === "commit")!;
    expect(commit.summary).toBe("Enregistrer un instantané");
    expect(commit.flags[0]).toEqual({ flag: "-m <msg>", desc: "Le message du commit" });
    expect(commit.category).toBe("Basics");
    expect(COMMAND_DOCS.find((d) => d.name === "commit")!.summary).toBe("Save a snapshot");
  });

  it("categoryLabel", () => {
    expect(categoryLabel("Undo", "en")).toBe("Undo");
    expect(categoryLabel("Undo", "fr")).toBe(CATEGORY_FR.Undo);
  });
});

describe("explainTokens", () => {
  it("is unchanged in English", () => {
    expect(explainTokens('git commit -m "x"')).toEqual([
      { text: "git", meaning: "the Git program", kind: "program" },
      { text: "commit", meaning: "save a snapshot", kind: "command" },
      { text: "-m", meaning: "The commit message", kind: "flag" },
      { text: '"x"', meaning: "your commit message", kind: "value" },
    ]);
    expect(explainTokens("git switch feature", "en")[2].meaning).toBe("a branch name");
  });

  it("speaks French when asked", () => {
    expect(explainTokens('git commit -m "x"', "fr")).toEqual([
      { text: "git", meaning: "le programme Git", kind: "program" },
      { text: "commit", meaning: "enregistrer un instantané", kind: "command" },
      { text: "-m", meaning: "Le message du commit", kind: "flag" },
      { text: '"x"', meaning: "ton message de commit", kind: "value" },
    ]);
    const m = explainTokens('echo "hi" > a.txt && git switch feature', "fr").map((t) => t.meaning);
    expect(m).toEqual(["afficher du texte", "du texte", "écrire le texte dans un fichier", "un nom de fichier", "puis lance la commande suivante", "le programme Git", "passer sur une autre branche", "un nom de branche"]);
  });
});
