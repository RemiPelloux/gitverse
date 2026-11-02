"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ArrowLeft, Check, ChevronDown, HardDrive, History, Link2, Maximize, Minimize, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { deserializeWorld, serializeWorld } from "@/engine";
import { useProgress } from "@/features/progress/store";
import { Logo, useHydrated } from "@/components/ui/misc";
import { GitGraph } from "./git-graph";
import { autosavePlayground, loadPlayground } from "./persistence";
import { useT } from "@/i18n";
import { buildSandbox, SANDBOXES, sandboxText } from "./sandboxes";
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
  // A shared link wins; otherwise resume the playground saved in this browser.
  const [boot] = useState(() => {
    const shared = initialFromHash();
    if (shared) return { world: shared, sandboxId: "website", terminal: undefined, resumed: false };
    const saved = loadPlayground();
    if (saved) return { world: saved.world, sandboxId: saved.sandboxId, terminal: saved, resumed: true };
    return { world: buildSandbox("website"), sandboxId: "website", terminal: undefined, resumed: false };
  });
  const [sandboxId, setSandboxId] = useState(boot.sandboxId);
  const sandboxRef = useRef(boot.sandboxId);
  const [store] = useState(() =>
    createLabStore(
      boot.world,
      (r) => {
        if (r.command) recordCommand(r.command, r.ok, r.events, "playground");
      },
      boot.terminal,
    ),
  );
  const [full, setFull] = useState(false);
  const t = useT();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">(boot.resumed ? "saved" : "idle");

  useEffect(() => autosavePlayground(store, () => sandboxRef.current, (ok) => setSaveState(ok ? "saved" : "failed")), [store]);

  // A shared link (#s=…) can arrive after the first render (client-side navigation) or change while
  // the page is open: load it whenever it appears.
  useEffect(() => {
    let lastHash = "";
    const apply = () => {
      if (window.location.hash === lastHash) return;
      lastHash = window.location.hash;
      const shared = initialFromHash();
      if (shared && JSON.stringify(shared) !== JSON.stringify(store.getState().world)) store.getState().reset(shared, t("lab.playground.sharedLink"));
    };
    apply();
    const id = window.setTimeout(apply, 0);
    window.addEventListener("hashchange", apply);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("hashchange", apply);
    };
  }, [store, t]);

  return (
    <LabProvider store={store}>
      <div className="flex h-dvh flex-col">
        <Toolbar
          sandboxId={sandboxId}
          onSandbox={(id) => {
            setSandboxId(id);
            sandboxRef.current = id;
            store.getState().reset(buildSandbox(id), t("lab.playground.sandboxStart"));
            history.replaceState(null, "", window.location.pathname);
          }}
          full={full}
          onFull={() => setFull((f) => !f)}
          saveState={saveState}
          resumed={boot.resumed}
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
  const t = useT();
  return (
    <div className="relative h-full">
      <GitGraph world={world} events={events} eventKey={eventKey} ghosts={ghosts} selected={selected} onSelect={select} showRemote={showRemote} />
      <label className="absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs">
        <input type="checkbox" checked={showRemote} onChange={(e) => setShowRemote(e.target.checked)} className="accent-[var(--accent)]" />
        {t("lab.playground.showRemote")}
      </label>
    </div>
  );
}

function Toolbar({
  sandboxId,
  onSandbox,
  full,
  onFull,
  saveState,
  resumed,
}: {
  sandboxId: string;
  onSandbox: (id: string) => void;
  full: boolean;
  onFull: () => void;
  saveState: "idle" | "saved" | "failed";
  resumed: boolean;
}) {
  const api = useLab((s) => s);
  const history = api.history;
  const cursor = api.cursor;
  const [copied, setCopied] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const t = useT();

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
    // origin + current path keeps any deploy base path (e.g. GitHub Pages /gitverse/playground/)
    const url = `${window.location.origin}${window.location.pathname}#s=${serializeWorld(api.world)}`;
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
    <div className="shrink-0 border-b border-line bg-bg">
      <div className="flex h-14 items-center gap-2 px-3">
        <Link href="/learn" className="rounded-lg p-1.5 text-fg-2 hover:bg-surface-2 hover:text-fg" aria-label={t("lab.playground.backToLearn")}>
          <ArrowLeft className="size-4" />
        </Link>
        <Link href="/" className="hidden sm:block" aria-label={t("lab.playground.home")}>
          <Logo className="text-sm" />
        </Link>
        <span className="hidden text-fg-3 sm:inline">/</span>
        <span className="hidden text-sm font-semibold sm:inline">{t("lab.playground.title")}</span>
        <div className="relative min-w-0 shrink sm:ml-2">
          <select
            value={sandboxId}
            onChange={(e) => onSandbox(e.target.value)}
            className="h-8 w-full max-w-44 appearance-none truncate rounded-lg border border-line bg-surface-2 pr-7 pl-2.5 text-xs outline-none hover:border-line-strong pointer-coarse:h-11"
            aria-label={t("lab.playground.chooseSandbox")}
          >
            {SANDBOXES.map((s) => (
              <option key={s.id} value={s.id}>
                {t(sandboxText(s.id).title)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-2 right-2 size-3.5 text-fg-3" />
        </div>
        {saveState !== "idle" && (
          <span
            className={clsx("hidden items-center gap-1.5 text-xs md:flex", saveState === "failed" ? "text-bad" : "text-fg-3")}
            title={saveState === "failed" ? t("lab.playground.saveFailedTitle") : t("lab.playground.savedTitle")}
            role="status"
          >
            <HardDrive className="size-3.5" />
            {saveState === "failed" ? t("lab.playground.notSaved") : resumed ? t("lab.playground.restored") : t("lab.playground.saved")}
          </span>
        )}
        <div className="scrollbar-thin ml-auto flex shrink-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
          <ToolBtn label={t("lab.playground.undo")} onClick={() => api.travel(cursor - 1)} disabled={cursor === 0}>
            <Undo2 className="size-4" />
          </ToolBtn>
          <ToolBtn label={t("lab.playground.redo")} onClick={() => api.travel(cursor + 1)} disabled={cursor >= history.length - 1}>
            <Redo2 className="size-4" />
          </ToolBtn>
          <ToolBtn label={t("lab.playground.timeTravel")} onClick={() => setShowTimeline((s) => !s)} active={showTimeline}>
            <History className="size-4" />
          </ToolBtn>
          <ToolBtn label={t("lab.playground.reset")} onClick={() => onSandbox(sandboxId)}>
            <RotateCcw className="size-4" />
          </ToolBtn>
          <ToolBtn label={copied ? t("lab.playground.linkCopied") : t("lab.playground.copyLink")} onClick={share}>
            {copied ? <Check className="size-4 text-ok" /> : <Link2 className="size-4" />}
          </ToolBtn>
          <ToolBtn label={full ? t("lab.playground.exitFull") : t("lab.playground.full")} onClick={onFull} active={full}>
            {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </ToolBtn>
        </div>
      </div>
      {showTimeline && (
        <div className="flex items-center gap-3 border-t border-line px-4 py-2.5">
          <span className="shrink-0 text-xs text-fg-3">{t("lab.playground.timeTravel")}</span>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={cursor}
            onChange={(e) => api.travel(Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
            aria-label={t("lab.playground.history")}
            aria-valuetext={history[cursor]?.label}
          />
          <span className="w-28 shrink-0 truncate font-mono text-xs text-fg-2 sm:w-48" title={history[cursor]?.label}>
            {cursor}/{history.length - 1} · {history[cursor]?.label}
          </span>
          <span className="hidden text-[11px] text-fg-3 lg:inline">{t("lab.playground.historyNote")}</span>
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
      className={clsx("grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-30 pointer-coarse:size-11", active ? "bg-accent-soft text-accent-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
    >
      {children}
    </button>
  );
}


