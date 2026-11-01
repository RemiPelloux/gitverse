import { GIT_COMMANDS, type World } from "@/engine";
import { COMMAND_DOCS, docFor } from "@/features/docs/commands";

export interface Completion {
  /** Full replacement for the input line. */
  value: string;
  label: string;
  detail?: string;
}

const SHELL_CMDS = ["git", "ls", "cat", "touch", "echo", "rm", "mv", "clear", "help", "pwd"];

const FLAGS: Record<string, string[]> = {
  commit: ["-m", "-am", "--amend", "--no-edit"],
  log: ["--oneline", "--graph", "--all"],
  switch: ["-c", "--detach"],
  checkout: ["-b"],
  branch: ["-d", "-D", "-m", "-a", "-v"],
  merge: ["--abort", "--no-ff", "--squash", "--continue"],
  rebase: ["--continue", "--abort"],
  reset: ["--soft", "--mixed", "--hard"],
  restore: ["--staged", "--source"],
  diff: ["--staged", "--stat"],
  push: ["-u", "--force"],
  status: ["-s"],
  stash: ["pop", "list", "apply", "drop", "-u"],
  remote: ["-v", "add", "remove"],
  add: [".", "-A"],
};

/** Context-aware completions for the current input line. */
export function complete(input: string, world: World): Completion[] {
  const endsWithSpace = /\s$/.test(input);
  const parts = input.trimStart().split(/\s+/);
  const current = endsWithSpace ? "" : (parts.pop() ?? "");
  const before = parts;
  const prefix = input.slice(0, input.length - current.length);
  const mk = (word: string, detail?: string, trailing = " "): Completion => ({ value: prefix + word + trailing, label: word, detail });

  if (before.length === 0) {
    return SHELL_CMDS.filter((c) => c.startsWith(current) && c !== current).map((c) => mk(c));
  }
  if (before[0] === "git" && before.length === 1) {
    return Object.keys(GIT_COMMANDS)
      .filter((c) => c.startsWith(current) && c !== current)
      .sort((a, b) => popularity(a) - popularity(b))
      .map((c) => mk(c, docFor(c)?.summary));
  }
  const repo = world.repo;
  const branches = repo ? Object.keys(repo.branches) : [];
  const remoteRefs = repo ? Object.keys(repo.remoteRefs) : [];
  const files = Object.keys(world.workdir);
  const tracked = repo ? Object.keys(repo.index) : [];
  const sub = before[0] === "git" ? before[1] : before[0];
  const out: Completion[] = [];
  const push = (word: string, detail?: string) => {
    if (word.startsWith(current) && word !== current && !out.some((o) => o.label === word)) out.push(mk(word, detail));
  };
  if (current.startsWith("-")) {
    for (const f of FLAGS[sub] ?? []) if (f.startsWith("-")) push(f, docFor(sub)?.flags.find((x) => x.flag.startsWith(f))?.desc);
    return out;
  }
  if (before[0] !== "git") {
    if (["cat", "rm", "mv"].includes(sub)) files.forEach((f) => push(f));
    return out;
  }
  const doc = docFor(sub);
  switch (doc?.args ?? (sub === "stash" ? "stash" : null)) {
    case "branch":
      branches.forEach((b) => push(b, "branch"));
      if (sub === "merge" || sub === "rebase") remoteRefs.forEach((r) => push(r, "remote branch"));
      if (sub === "switch" || sub === "checkout")
        remoteRefs.map((r) => r.split("/").slice(1).join("/")).forEach((b) => push(b, "from remote"));
      break;
    case "file": {
      const changed = files.filter((f) => repo?.index[f] !== world.workdir[f]);
      const deleted = tracked.filter((f) => !(f in world.workdir));
      [...changed, ...deleted].forEach((f) => push(f, "changed"));
      if (sub === "add") push(".", "everything");
      files.forEach((f) => push(f));
      break;
    }
    case "commit":
      push("HEAD", "current commit");
      push("HEAD~1", "previous commit");
      branches.forEach((b) => push(b, "branch"));
      break;
    case "remote":
      if (sub === "remote" && before.length === 2) push("add");
      if (repo) Object.keys(repo.remotes).forEach((r) => push(r, "remote"));
      if (sub === "push" || sub === "pull") branches.forEach((b) => push(b, "branch"));
      break;
  }
  for (const f of FLAGS[sub] ?? []) if (!f.startsWith("-")) push(f);
  return out;
}

const ORDER = ["status", "add", "commit", "log", "switch", "branch", "merge", "diff", "push", "pull", "init"];
const popularity = (c: string) => {
  const i = ORDER.indexOf(c);
  return i === -1 ? 100 + COMMAND_DOCS.findIndex((d) => d.name === c) : i;
};

/** Split input into highlighted tokens. */
export function highlight(input: string): Array<{ text: string; cls: string }> {
  const out: Array<{ text: string; cls: string }> = [];
  const re = /("[^"]*"?|'[^']*'?|\s+|&&|>>|>|[^\s"']+)/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  let pos = 0;
  while ((m = re.exec(input))) {
    const t = m[0];
    pos += t.length;
    if (/^\s+$/.test(t)) {
      out.push({ text: t, cls: "" });
      continue;
    }
    let cls = "text-[var(--t-text)]";
    if (t === "&&" || t === ">" || t === ">>") {
      cls = "text-[#7c83a8]";
      idx = -1;
    } else if (idx === 0) cls = t === "git" ? "text-[#c4b5fd] font-semibold" : "text-[#93c5fd]";
    else if (idx === 1 && out.some((o) => o.text === "git")) cls = "text-[#6ee7b7] font-medium";
    else if (t.startsWith("-")) cls = "text-[#fcd34d]";
    else if (/^["']/.test(t)) cls = "text-[#f9a8d4]";
    out.push({ text: t, cls });
    idx++;
  }
  void pos;
  return out;
}
