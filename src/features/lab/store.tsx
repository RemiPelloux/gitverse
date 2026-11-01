"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import { execute, type ExecResult, type GitEvent, type OutLine, type World } from "@/engine";

export interface TermEntry {
  id: number;
  input: string;
  lines: OutLine[];
  ok: boolean;
  explain?: string;
  branch: string | null;
}

export interface Snapshot {
  world: World;
  label: string;
}

export interface LabState {
  world: World;
  entries: TermEntry[];
  /** Time travel: every state the simulation passed through. */
  history: Snapshot[];
  cursor: number;
  /** Latest events, with a monotonically increasing key for animations. */
  events: GitEvent[];
  eventKey: number;
  /** Commits that became unreachable recently (shown as ghosts, e.g. after rebase). */
  ghosts: string[];
  inputHistory: string[];
  selectedCommit: string | null;
  openFile: string | null;
  /** Bumped when the UI should bring a panel to front (e.g. a conflict opens the editor). */
  panelRequest: { tab: "files" | "commit"; key: number };
  /** Called after every command (progress, lesson validation). */
  onResult?: (r: ExecResult, input: string) => void;

  run: (input: string) => ExecResult;
  /** UI-driven file edits (explorer/editor) go through the same canonical world. */
  writeFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (from: string, to: string) => void;
  reset: (world: World, label?: string) => void;
  travel: (index: number) => void;
  clearTerminal: () => void;
  selectCommit: (id: string | null) => void;
  setOpenFile: (path: string | null) => void;
}

let entryId = 1;

const branchOf = (w: World) => (w.repo ? (w.repo.head.kind === "branch" ? w.repo.head.name : `(${w.repo.head.commit.slice(0, 7)})`) : null);

export function createLabStore(
  initial: World,
  onResult?: LabState["onResult"],
  restore?: { entries?: TermEntry[]; inputHistory?: string[] },
) {
  // Keep entry ids unique when a saved transcript is restored.
  for (const e of restore?.entries ?? []) entryId = Math.max(entryId, e.id + 1);
  return createStore<LabState>()((set, get) => {
    const commitWorld = (world: World, label: string, events: GitEvent[], ghosts: string[] = []) => {
      const { history, cursor } = get();
      const nextHistory = [...history.slice(0, cursor + 1), { world, label }].slice(-200);
      set((s) => ({
        world,
        history: nextHistory,
        cursor: nextHistory.length - 1,
        events,
        eventKey: s.eventKey + 1,
        ghosts,
      }));
    };

    return {
      world: initial,
      entries: restore?.entries ?? [],
      history: [{ world: initial, label: "Start" }],
      cursor: 0,
      events: [],
      eventKey: 0,
      ghosts: [],
      inputHistory: restore?.inputHistory ?? [],
      selectedCommit: null,
      openFile: null,
      panelRequest: { tab: "files", key: 0 },
      onResult,

      run: (input) => {
        const before = get().world;
        const r = execute(before, input);
        const trimmed = input.trim();
        set((s) => ({
          inputHistory: trimmed ? [...s.inputHistory.filter((h) => h !== trimmed), trimmed].slice(-100) : s.inputHistory,
        }));
        if (r.clear) set({ entries: [] });
        else
          set((s) => ({
            entries: [
              ...s.entries,
              { id: entryId++, input, lines: r.lines, ok: r.ok, explain: r.explain, branch: branchOf(before) },
            ].slice(-300),
          }));
        if (r.world !== before && JSON.stringify(r.world) !== JSON.stringify(before)) {
          const ghosts = r.events.flatMap((e) => (e.type === "rebase" ? e.rewritten.map(([o]) => o) : []));
          commitWorld(r.world, trimmed, r.events, ghosts);
        } else if (r.events.length) set((s) => ({ events: r.events, eventKey: s.eventKey + 1 }));
        const conflict = r.events.find((e) => e.type === "conflict");
        if (conflict?.type === "conflict" && conflict.paths[0])
          set((s) => ({ openFile: conflict.paths[0], panelRequest: { tab: "files", key: s.panelRequest.key + 1 } }));
        get().onResult?.(r, input);
        return r;
      },
      writeFile: (path, content) => {
        const w = get().world;
        if (w.workdir[path] === content) return;
        commitWorld({ ...w, workdir: { ...w.workdir, [path]: content } }, `edit ${path}`, [{ type: "file-change", paths: [path] }]);
        get().onResult?.({ world: get().world, lines: [], events: [{ type: "file-change", paths: [path] }], ok: true, command: null }, "");
      },
      deleteFile: (path) => {
        const w = get().world;
        const workdir = { ...w.workdir };
        delete workdir[path];
        commitWorld({ ...w, workdir }, `delete ${path}`, [{ type: "file-change", paths: [path] }]);
        if (get().openFile === path) set({ openFile: null });
        get().onResult?.({ world: get().world, lines: [], events: [], ok: true, command: null }, "");
      },
      renameFile: (from, to) => {
        const w = get().world;
        if (!(from in w.workdir) || to in w.workdir || !to.trim()) return;
        const workdir = { ...w.workdir, [to]: w.workdir[from] };
        delete workdir[from];
        commitWorld({ ...w, workdir }, `rename ${from}`, [{ type: "file-change", paths: [from, to] }]);
        if (get().openFile === from) set({ openFile: to });
        get().onResult?.({ world: get().world, lines: [], events: [], ok: true, command: null }, "");
      },
      reset: (world, label = "Reset") =>
        set((s) => ({
          world,
          history: [{ world, label }],
          cursor: 0,
          entries: [],
          events: [],
          eventKey: s.eventKey + 1,
          ghosts: [],
          selectedCommit: null,
          openFile: null,
        })),
      travel: (index) => {
        const snap = get().history[index];
        if (!snap) return;
        set((s) => ({ world: snap.world, cursor: index, events: [], eventKey: s.eventKey + 1, ghosts: [] }));
        get().onResult?.({ world: snap.world, lines: [], events: [], ok: true, command: null }, "");
      },
      clearTerminal: () => set({ entries: [] }),
      selectCommit: (id) => set({ selectedCommit: id }),
      setOpenFile: (path) => set({ openFile: path }),
    };
  });
}

const LabContext = createContext<StoreApi<LabState> | null>(null);

export function LabProvider({
  initial,
  onResult,
  children,
  store: external,
}: {
  initial?: World;
  onResult?: LabState["onResult"];
  children: ReactNode;
  store?: StoreApi<LabState>;
}) {
  const [store] = useState(() => external ?? createLabStore(initial!, onResult));
  return <LabContext.Provider value={store}>{children}</LabContext.Provider>;
}

export function useLab<T>(selector: (s: LabState) => T): T {
  const store = useContext(LabContext);
  if (!store) throw new Error("useLab must be used inside <LabProvider>");
  return useStore(store, selector);
}

export function useLabApi(): StoreApi<LabState> {
  const store = useContext(LabContext);
  if (!store) throw new Error("useLabApi must be used inside <LabProvider>");
  return store;
}
