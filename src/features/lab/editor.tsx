"use client";

import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, GitCompare, ShieldAlert } from "lucide-react";
import { hasConflictMarkers, headTree, hunks } from "@/engine";
import { fileStates, StateBadge } from "./files-panel";
import { useLab } from "./store";

type Region = "plain" | "marker" | "ours" | "theirs";

function classify(lines: string[]): Region[] {
  let mode: Region = "plain";
  return lines.map((l) => {
    if (l.startsWith("<<<<<<< ")) {
      mode = "ours";
      return "marker";
    }
    if (l === "=======" && mode === "ours") {
      mode = "theirs";
      return "marker";
    }
    if (l.startsWith(">>>>>>> ") && mode === "theirs") {
      mode = "plain";
      return "marker";
    }
    return mode;
  });
}

/** Resolve every conflict block with a strategy. */
export function resolveConflicts(text: string, pick: "ours" | "theirs" | "both"): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let mode: "plain" | "ours" | "theirs" = "plain";
  for (const l of lines) {
    if (l.startsWith("<<<<<<< ")) mode = "ours";
    else if (l === "=======" && mode === "ours") mode = "theirs";
    else if (l.startsWith(">>>>>>> ") && mode === "theirs") mode = "plain";
    else if (mode === "plain" || pick === "both" || pick === mode) out.push(l);
  }
  return out.join("\n");
}

const REGION_CLS: Record<Region, string> = {
  plain: "",
  marker: "bg-bad-soft text-bad",
  ours: "bg-accent-soft",
  theirs: "bg-ok-soft",
};

export function Editor({ path, onBack }: { path: string; onBack?: () => void }) {
  const world = useLab((s) => s.world);
  const writeFile = useLab((s) => s.writeFile);
  const content = world.workdir[path] ?? "";
  const [draft, setDraft] = useState(content);
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<"edit" | "diff">("edit");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sync when the file changes underneath (git commands, explorer) unless the user is mid-edit.
  const [seen, setSeen] = useState(content);
  if (content !== seen) {
    setSeen(content);
    if (!pending) setDraft(content);
  }

  const flush = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(false);
    writeFile(path, value);
  };

  const onChange = (value: string) => {
    setDraft(value);
    setPending(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(value), 500);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const lines = draft.split("\n");
  const regions = useMemo(() => classify(lines), [lines]);
  const conflicted = hasConflictMarkers(draft);
  const state = fileStates(world).get(path) ?? "clean";
  const op = world.repo?.op;

  const indexVersion = world.repo?.index[path];
  const headVersion = world.repo ? headTree(world.repo)[path] : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        {onBack && (
          <button onClick={onBack} className="rounded-md p-1 text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Back to files">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <span className="min-w-0 truncate font-mono text-[13px]">{path}</span>
        <StateBadge state={state} compact />
        {world.repo && (
          <div className="ml-auto flex rounded-lg bg-surface-2 p-0.5 text-[11px]">
            {(["edit", "diff"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={clsx("rounded-md px-2 py-0.5", view === v ? "bg-elevated text-fg shadow-sm" : "text-fg-3 hover:text-fg")}
                aria-pressed={view === v}
              >
                {v === "edit" ? "Edit" : "Changes"}
              </button>
            ))}
          </div>
        )}
      </div>

      {conflicted && view === "edit" && (
        <div className="border-b border-line bg-bad-soft/40 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-bad">
            <ShieldAlert className="size-3.5" /> Conflict: choose what to keep
          </p>
          <p className="mt-0.5 text-[11px] text-fg-2">
            <span className="rounded bg-accent-soft px-1">highlighted</span> = current branch (HEAD) ·{" "}
            <span className="rounded bg-ok-soft px-1">green</span> = incoming{op ? ` (${op.theirsLabel})` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(
              [
                ["ours", "Accept current"],
                ["theirs", "Accept incoming"],
                ["both", "Accept both"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  const v = resolveConflicts(draft, k);
                  setDraft(v);
                  flush(v);
                }}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs hover:border-line-strong"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {!conflicted && op?.conflicts.includes(path) && (
        <div className="border-b border-line bg-ok-soft px-3 py-2 text-xs text-ok">
          Markers removed. Now mark it resolved: <code className="font-mono">git add {path}</code>
        </div>
      )}

      {view === "edit" ? (
        <div className="scrollbar-thin relative min-h-0 flex-1 overflow-auto bg-surface">
          <div className="relative flex min-h-full font-mono text-[13px] leading-6">
            <div className="sticky left-0 z-[1] shrink-0 select-none border-r border-line bg-surface py-2 pr-2 pl-3 text-right text-fg-3" aria-hidden>
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <div className="relative w-max min-w-0 flex-1">
              <pre aria-hidden className="pointer-events-none m-0 py-2 whitespace-pre text-fg">
                {lines.map((l, i) => (
                  <div key={i} className={clsx("px-3", REGION_CLS[regions[i]])}>
                    {l || " "}
                  </div>
                ))}
              </pre>
              <textarea
                value={draft}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => pending && flush(draft)}
                spellCheck={false}
                aria-label={`Edit ${path}`}
                className="absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent px-3 py-2 leading-6 whitespace-pre text-transparent caret-accent outline-none"
                wrap="off"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-auto p-3">
          <DiffBlock title="Not staged yet (working directory vs. staging area)" from={indexVersion} to={world.workdir[path]} empty="No unstaged changes." />
          <DiffBlock title="Staged (staging area vs. last commit)" from={headVersion} to={indexVersion} empty="Nothing staged for this file." />
        </div>
      )}
    </div>
  );
}

export function DiffBlock({ title, from, to, empty }: { title: string; from?: string; to?: string; empty: string }) {
  const hs = from === to ? [] : hunks(from ?? "", to ?? "");
  return (
    <section>
      {title && (
        <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-fg-3 ">
          <GitCompare className="size-3.5" /> {title}
        </h4>
      )}
      {!hs.length ? (
        <p className="text-xs text-fg-3">{empty}</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-line font-mono text-[12px] leading-5">
          {hs.map((h, i) => (
            <div key={i}>
              <div className="bg-surface-2 px-3 text-info">{h.header}</div>
              {h.lines.map((l, j) => (
                <div
                  key={j}
                  className={clsx("px-3 whitespace-pre-wrap", l.op === "add" ? "bg-ok-soft text-ok" : l.op === "del" ? "bg-bad-soft text-bad" : "text-fg-2")}
                >
                  <span className="select-none">{l.op === "add" ? "+ " : l.op === "del" ? "− " : "  "}</span>
                  {l.line}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
