"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BookMarked, BookOpen, Cloud, Files, GitCommitHorizontal, GitFork, Layers, SquareTerminal } from "lucide-react";
import { useT } from "@/i18n";
import { Editor } from "./editor";
import { FilesPanel, type Spotlight } from "./files-panel";
import { GitGraph } from "./git-graph";
import { hasGitHubData, hostedFor } from "./github-status";
import { CommitInspector, RemotePanel } from "./inspector";
import { StagesVisualizer } from "./stages";
import { useLab } from "./store";
import { Terminal } from "./terminal";

export interface WorkspaceUi {
  files: boolean;
  editor: boolean;
  stages: boolean;
  remote: boolean;
}

function useMedia(query: string, fallback: boolean) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

function usePersistentNumber(key: string, initial: number) {
  const [v, setV] = useState(() => {
    if (typeof window === "undefined") return initial;
    try {
      const s = Number(localStorage.getItem(key));
      return s > 0 ? s : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, String(v));
    } catch {
      /* storage unavailable */
    }
  }, [key, v]);
  return [v, setV] as const;
}

type SideTab = "guide" | "files" | "commit" | "remote";

export function Workspace({
  ui,
  guide,
  terminalMode,
  onTerminalModeChange,
  suggestion,
  mobileHeader,
  stagesDefault,
  spotlight,
}: {
  ui: WorkspaceUi;
  guide?: ReactNode;
  terminalMode: "assisted" | "real";
  onTerminalModeChange?: (m: "assisted" | "real") => void;
  suggestion?: string | null;
  mobileHeader?: ReactNode;
  stagesDefault?: boolean;
  /** A file the current lesson step wants edited: the Files panel comes forward and highlights it. */
  spotlight?: Spotlight | null;
}) {
  const t = useT();
  const isDesktop = useMedia("(min-width: 1100px)", true);
  const isTablet = useMedia("(min-width: 768px)", true);
  const world = useLab((s) => s.world);
  const events = useLab((s) => s.events);
  const eventKey = useLab((s) => s.eventKey);
  const ghosts = useLab((s) => s.ghosts);
  const selected = useLab((s) => s.selectedCommit);
  const selectCommit = useLab((s) => s.selectCommit);
  const openFile = useLab((s) => s.openFile);
  const setOpenFile = useLab((s) => s.setOpenFile);
  const [showStages, setShowStages] = useState(stagesDefault ?? ui.stages);
  const [sideTab, setSideTab] = useState<SideTab>(guide && !isDesktop ? "guide" : "files");
  const [mobileTab, setMobileTab] = useState<"guide" | "graph" | "terminal" | "files">(guide ? "guide" : "terminal");
  const [termH, setTermH] = usePersistentNumber("gv-term-h", 300);
  const [sideW, setSideW] = usePersistentNumber("gv-side-w", 340);

  // A conflict (or other request from the simulation) brings the relevant panel forward.
  const panelRequest = useLab((s) => s.panelRequest);
  const [seenRequest, setSeenRequest] = useState(panelRequest.key);
  if (panelRequest.key !== seenRequest) {
    setSeenRequest(panelRequest.key);
    setSideTab(panelRequest.tab);
  }

  // Bring the Files panel forward when a step asks the learner to edit a file.
  const spotKey = spotlight ? `${spotlight.kind}:${spotlight.path}` : null;
  const [seenSpot, setSeenSpot] = useState<string | null>(null);
  if (spotKey !== seenSpot) {
    setSeenSpot(spotKey);
    if (spotKey && ui.files) {
      setSideTab("files");
      if (openFile && spotlight && openFile !== spotlight.path) setOpenFile(null);
    }
  }

  const onSelect = (id: string | null) => {
    selectCommit(id);
    if (id) {
      setSideTab("commit");
      if (!isTablet) setMobileTab("files");
    }
  };

  const graph = (
    <GitGraph world={world} events={events} eventKey={eventKey} ghosts={ghosts} selected={selected} onSelect={onSelect} />
  );
  const terminal = (compact?: boolean) => (
    <Terminal mode={terminalMode} onModeChange={onTerminalModeChange} suggestion={suggestion} compact={compact} />
  );
  const filesOrEditor =
    ui.editor && openFile && openFile in world.workdir ? (
      <Editor key={openFile} path={openFile} onBack={() => setOpenFile(null)} />
    ) : (
      <FilesPanel onOpen={(p) => (ui.editor ? setOpenFile(p) : setOpenFile(null))} editable={ui.editor} spotlight={spotlight} />
    );

  // Once the hosted repo has pull requests, issues or workflow runs, the remote tab is a GitHub view.
  const githubTab = hasGitHubData(hostedFor(world)?.host);
  const tabs: Array<{ id: SideTab; label: string; icon: ReactNode; show: boolean }> = [
    { id: "guide", label: t("lab.workspace.guide"), icon: <BookOpen className="size-3.5" />, show: !!guide && !isDesktop },
    { id: "files", label: t("lab.workspace.files"), icon: <Files className="size-3.5" />, show: ui.files },
    { id: "commit", label: t("lab.workspace.commit"), icon: <GitCommitHorizontal className="size-3.5" />, show: true },
    githubTab
      ? { id: "remote", label: t("lab.workspace.github"), icon: <BookMarked className="size-3.5" />, show: ui.remote }
      : { id: "remote", label: t("lab.workspace.remote"), icon: <Cloud className="size-3.5" />, show: ui.remote },
  ];
  const activeSide = tabs.find((tab) => tab.id === sideTab && tab.show) ? sideTab : (tabs.find((tab) => tab.show)?.id ?? "commit");

  const sidePanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-line px-2 pt-2" role="tablist" aria-label={t("lab.workspace.panels")}>
        {tabs
          .filter((tab) => tab.show)
          .map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeSide === tab.id}
              onClick={() => setSideTab(tab.id)}
              className={clsx(
                "relative flex items-center gap-1.5 rounded-t-lg px-2.5 pt-1.5 pb-2 text-xs font-medium transition-colors",
                activeSide === tab.id ? "text-fg" : "text-fg-3 hover:text-fg-2",
              )}
            >
              {tab.icon}
              {tab.label}
              {activeSide === tab.id && <motion.span layoutId="side-tab" className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
      </div>
      <div className="min-h-0 flex-1" role="tabpanel">
        {activeSide === "guide" && guide}
        {activeSide === "files" && filesOrEditor}
        {activeSide === "commit" && <CommitInspector />}
        {activeSide === "remote" && <RemotePanel />}
      </div>
    </div>
  );

  const stagesToggle = (
    <button
      onClick={() => setShowStages((s) => !s)}
      aria-pressed={showStages}
      className={clsx(
        "absolute top-3 left-3 z-[2] flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors",
        showStages ? "border-accent/40 bg-accent-soft text-accent-fg" : "border-line bg-surface text-fg-2 hover:text-fg",
      )}
    >
      <Layers className="size-3.5" /> {showStages ? t("lab.workspace.hideStages", { n: ui.remote ? 4 : 3 }) : t("lab.workspace.showStages", { n: ui.remote ? 4 : 3 })}
    </button>
  );

  const center = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {stagesToggle}
        <div className="flex h-full flex-col">
          <AnimatePresence initial={false}>
            {showStages && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="shrink-0 overflow-hidden border-b border-line"
              >
                <StagesVisualizer world={world} showRemote={ui.remote} className="px-3 pt-12 pb-3" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="min-h-0 flex-1">{graph}</div>
        </div>
      </div>
      <ResizeHandle orientation="horizontal" onDrag={(d) => setTermH((h) => Math.min(620, Math.max(150, h + d)))} />
      <div style={{ height: termH }} className="shrink-0">
        {terminal()}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <div className="flex h-full min-h-0">
        {guide && <aside className="scrollbar-thin w-[min(380px,30vw)] shrink-0 overflow-y-auto border-r border-line bg-surface">{guide}</aside>}
        <main className="min-w-0 flex-1">{center}</main>
        <ResizeHandle orientation="vertical" onDrag={(d) => setSideW((w) => Math.min(560, Math.max(260, w + d)))} />
        <aside style={{ width: sideW }} className="shrink-0 border-l border-line bg-surface">
          {sidePanel}
        </aside>
      </div>
    );
  }
  if (isTablet) {
    return (
      <div className="flex h-full min-h-0">
        <main className="min-w-0 flex-1">{center}</main>
        <aside className="w-[340px] shrink-0 border-l border-line bg-surface">{sidePanel}</aside>
      </div>
    );
  }

  // Mobile: a focused, tabbed workspace rather than a shrunken desktop.
  const mobileTabs = [
    { id: "guide" as const, label: t("lab.workspace.guide"), icon: BookOpen, show: !!guide },
    { id: "graph" as const, label: t("lab.workspace.graph"), icon: GitFork, show: true },
    { id: "terminal" as const, label: t("lab.workspace.terminal"), icon: SquareTerminal, show: true },
    { id: "files" as const, label: ui.files ? t("lab.workspace.files") : t("lab.workspace.details"), icon: Files, show: true },
  ].filter((tab) => tab.show);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {mobileHeader}
      <div className="relative min-h-0 flex-1">
        {mobileTab === "guide" && <div className="scrollbar-thin h-full overflow-y-auto">{guide}</div>}
        {mobileTab === "graph" && (
          <div className="flex h-full flex-col">
            {ui.stages && <StagesVisualizer world={world} showRemote={ui.remote} className="shrink-0 p-3" />}
            <div className="min-h-0 flex-1">{graph}</div>
          </div>
        )}
        {mobileTab === "terminal" && (
          <div className="flex h-full flex-col">
            <div className="h-36 shrink-0 border-b border-line">
              <GitGraph world={world} events={events} eventKey={eventKey} ghosts={ghosts} compact />
            </div>
            <div className="min-h-0 flex-1">{terminal(true)}</div>
          </div>
        )}
        {mobileTab === "files" && sidePanel}
      </div>
      <nav className="grid shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, 1fr)` }} aria-label={t("lab.workspace.nav")}>
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            aria-current={mobileTab === tab.id}
            className={clsx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", mobileTab === tab.id ? "text-accent-fg" : "text-fg-3")}
          >
            <span className="relative">
              <tab.icon className="size-5" />
              {tab.id === "files" && spotlight && mobileTab !== "files" && (
                <span className="absolute -top-0.5 -right-1 grid size-2.5 place-items-center" aria-hidden>
                  <span className="absolute size-full animate-ping rounded-full bg-accent-mark/70" />
                  <span className="size-2 rounded-full bg-accent-mark" />
                </span>
              )}
            </span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function ResizeHandle({ orientation, onDrag }: { orientation: "horizontal" | "vertical"; onDrag: (delta: number) => void }) {
  const last = useRef<number | null>(null);
  const horizontal = orientation === "horizontal";
  const t = useT();
  return (
    <div
      role="separator"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      tabIndex={0}
      aria-label={horizontal ? t("lab.workspace.resizeTerminal") : t("lab.workspace.resizeSide")}
      onKeyDown={(e) => {
        if (e.key === (horizontal ? "ArrowUp" : "ArrowLeft")) onDrag(20);
        if (e.key === (horizontal ? "ArrowDown" : "ArrowRight")) onDrag(-20);
      }}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        last.current = horizontal ? e.clientY : e.clientX;
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const pos = horizontal ? e.clientY : e.clientX;
        onDrag(last.current - pos);
        last.current = pos;
      }}
      onPointerUp={() => (last.current = null)}
      className={clsx(
        "group relative z-[3] shrink-0 bg-line transition-colors hover:bg-accent focus-visible:bg-accent",
        horizontal ? "h-px cursor-row-resize" : "w-px cursor-col-resize",
      )}
    >
      <span className={clsx("absolute", horizontal ? "inset-x-0 -top-1.5 -bottom-1.5" : "inset-y-0 -left-1.5 -right-1.5")} />
    </div>
  );
}
