import type { ExecResult, GitEvent, LineKind, OutLine, World } from "./types";

/** Thrown to stop a command with a Git-style fatal/error message. */
export class CommandError extends Error {
  constructor(
    public lines: string[],
    public explain?: string,
  ) {
    super(lines.join("\n"));
  }
}

export function fail(message: string | string[], explain?: string): never {
  throw new CommandError(Array.isArray(message) ? message : [message], explain);
}

/** Mutable execution context for a single command over a cloned world. */
export class Ctx {
  lines: OutLine[] = [];
  events: GitEvent[] = [];
  explain?: string;
  clear = false;
  ok = true;

  constructor(public world: World) {}

  out(text: string | string[], kind: LineKind = "out") {
    const all = Array.isArray(text) ? text : text.split("\n");
    for (const t of all) this.lines.push({ text: t, kind });
  }

  emit(e: GitEvent) {
    this.events.push(e);
  }

  /** Non-fatal failure (exit code 1) that still keeps state changes. */
  error(text: string | string[], explain?: string) {
    this.out(text, "error");
    this.ok = false;
    if (explain) this.explain = explain;
  }

  result(command: string | null): ExecResult {
    return {
      world: this.world,
      lines: this.lines,
      events: this.events,
      ok: this.ok,
      command,
      explain: this.explain,
      clear: this.clear,
    };
  }
}
