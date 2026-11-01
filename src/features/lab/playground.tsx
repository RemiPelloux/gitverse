"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ArrowLeft, Check, ChevronDown, History, Link2, Maximize, Minimize, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { deserializeWorld, serializeWorld } from "@/engine";
import { useProgress } from "@/features/progress/store";
import { Logo, useHydrated } from "@/components/ui/misc";
import { GitGraph } from "./git-graph";
import { buildSandbox, SANDBOXES } from "./sandboxes";
import { createLabStore, LabProvider, useLab } from "./store";
import { Workspace } from "./workspace";

export function Playground() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="h-dvh" aria-busy="true" />;
  return <PlaygroundRuntime />;
}

function initialFromHash() {
  if (typeof window === "undefined") return null;
  const m = /[#&]s=([^&]+)/.exec(window.location.hash);
  return m ? deserializeWorld(m[1]) : null;
}

function PlaygroundRuntime() {
  const recordCommand = useProgress((s) => s.recordCommand);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const [sandboxId, setSandboxId] = useState("website");
  const [store] = useState(() =>
    createLabStore(initialFromHash() ?? buildSandbox("website"), (r) => {
      if (r.command) recordCommand(r.command, r.ok, r.events, "playground");
    }),
  );
  const [full, setFull] = useState(false);

  return (
    <LabProvider store={store}>
      <div className="flex h-dvh flex-col">
        <Toolbar
          sandboxId={sandboxId}
          onSandbox={(id) => {
            setSandboxId(id);
            store.getState().reset(buildSandbox(id), "Sandbox start");
            history.replaceState(null, "", window.location.pathname);
          }}
          full={full}
          onFull={() => setFull((f) => !f)}
        />
        <div className="min-h-0 flex-1">
          {full ? (
            <FullGraph />
          ) : (
            <Workspace
              ui={{ files: true, editor: true, stages: true, remote: true }}
              stagesDefault={false}
              terminalMode={settings.terminalMode}
              onTerminalModeChange={(m) => updateSettings({ terminalMode: m })}
            />
          )}
        </div>
      </div>
    </LabProvider>
  );
}

function FullGraph() {
  const world = useLab((s) => s.world);
  const events = useLab((s) => s.events);
  const eventKey = useLab((s) => s.eventKey);
  const ghosts = useLab((s) => s.ghosts);
  const selected = useLab((s) => s.selectedCommit);
  const select = useLab((s) => s.selectCommit);
  const [showRemote, setShowRemote] = useState(true);
  return (
    <div className="relative h-full">
      <GitGraph world={world} events={events} eventKey={eventKey} ghosts={ghosts} selected={selected} onSelect={select} showRemote={showRemote} />
      <label className="absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-line bg-surface/90 px-2.5 py-1.5 text-xs backdrop-blur">
        <input type="checkbox" checked={showRemote} onChange={(e) => setShowRemote(e.target.checked)} className="accent-[var(--violet)]" />
        Show remote branches
      </label>
    </div>
  );
}

function Toolbar({ sandboxId, onSandbox, full, onFull }: { sandboxId: string; onSandbox: (id: string) => void; full: boolean; onFull: () => void }) {
  const api = useLab((s) => s);
  const history = api.history;
  const cursor = api.cursor;
  const [copied, setCopied] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key.toLowerCase() === "z" && e.altKey) {
        e.preventDefault();
        if (e.shiftKey) api.travel(Math.min(history.length - 1, cursor + 1));
        else api.travel(Math.max(0, cursor - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, cursor, history.length]);

  const share = async () => {
    const url = `${window.location.origin}/playground#s=${serializeWorld(api.world)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* fall back to the address bar */
    }
    window.history.replaceState(null, "", url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="shrink-0 border-b border-line bg-bg/80 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3">
        <Link href="/learn" className="rounded-lg p-1.5 text-fg-2 hover:bg-surface-2 hover:text-fg" aria-label="Back to learning path">
          <ArrowLeft className="size-4" />
        </Link>
        <Link href="/" className="hidden sm:block" aria-label="Gitverse home">
          <Logo className="text-sm" />
        </Link>
        <span className="hidden text-fg-3 sm:inline">/</span>
        <span className="text-sm font-semibold">Playground</span>
        <div className="relative ml-2">
          <select
            value={sandboxId}
            onChange={(e) => onSandbox(e.target.value)}
            className="h-8 appearance-none rounded-lg border border-line bg-surface-2 pr-7 pl-2.5 text-xs outline-none hover:border-line-strong"
            aria-label="Choose a starting repository"
          >
            {SANDBOXES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-2 right-2 size-3.5 text-fg-3" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ToolBtn label="Undo (time travel back) — Ctrl+Alt+Z" onClick={() => api.travel(cursor - 1)} disabled={cursor === 0}>
            <Undo2 className="size-4" />
          </ToolBtn>
          <ToolBtn label="Redo — Ctrl+Alt+Shift+Z" onClick={() => api.travel(cursor + 1)} disabled={cursor >= history.length - 1}>
            <Redo2 className="size-4" />
          </ToolBtn>
          <ToolBtn label="Time travel" onClick={() => setShowTimeline((s) => !s)} active={showTimeline}>
            <History className="size-4" />
          </ToolBtn>
          <ToolBtn label="Reset sandbox" onClick={() => onSandbox(sandboxId)}>
            <RotateCcw className="size-4" />
          </ToolBtn>
          <ToolBtn label={copied ? "Link copied!" : "Copy a shareable link to this exact repository"} onClick={share}>
            {copied ? <Check className="size-4 text-mint" /> : <Link2 className="size-4" />}
          </ToolBtn>
          <ToolBtn label={full ? "Exit full-screen graph" : "Full-screen graph"} onClick={onFull} active={full}>
            {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </ToolBtn>
        </div>
      </div>
      {showTimeline && (
        <div className="flex items-center gap-3 border-t border-line px-4 py-2.5">
          <span className="shrink-0 text-xs text-fg-3">Time travel</span>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={cursor}
            onChange={(e) => api.travel(Number(e.target.value))}
            className="flex-1 accent-[var(--violet)]"
            aria-label="Simulation history"
            aria-valuetext={history[cursor]?.label}
          />
          <span className="w-48 shrink-0 truncate font-mono text-xs text-fg-2" title={history[cursor]?.label}>
            {cursor}/{history.length - 1} · {history[cursor]?.label}
          </span>
          <span className="hidden text-[11px] text-fg-3 lg:inline">Simulator history — real Git has no universal undo.</span>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ label, onClick, children, disabled, active }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx("grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-30", active ? "bg-violet-soft text-violet-2" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
    >
      {children}
    </button>
  );
}


