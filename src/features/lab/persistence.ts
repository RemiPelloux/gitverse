import type { StoreApi } from "zustand";
import type { World } from "@/engine";
import type { LabState, TermEntry } from "./store";

/** What a workspace remembers between visits (besides the repository itself). */
export interface TerminalSnapshot {
  entries: TermEntry[];
  inputHistory: string[];
}

const MAX_ENTRIES = 40;
const MAX_LINES_PER_ENTRY = 80;
const MAX_INPUT_HISTORY = 50;

/** Keep saved transcripts small so localStorage never fills up. */
export function snapshotTerminal(s: Pick<LabState, "entries" | "inputHistory">): TerminalSnapshot {
  return {
    entries: s.entries.slice(-MAX_ENTRIES).map((e) => ({ ...e, lines: e.lines.slice(-MAX_LINES_PER_ENTRY) })),
    inputHistory: s.inputHistory.slice(-MAX_INPUT_HISTORY),
  };
}

/** localStorage can be missing, blocked (private mode) or full: never let that break the app. */
export function loadJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

// ───────────────────────── Playground

export const PLAYGROUND_KEY = "gitverse-playground";

export interface PlaygroundSave extends TerminalSnapshot {
  v: 1;
  sandboxId: string;
  world: World;
  savedAt: number;
}

export function loadPlayground(): PlaygroundSave | null {
  const s = loadJSON<PlaygroundSave>(PLAYGROUND_KEY);
  return s && s.v === 1 && s.world && typeof s.world.workdir === "object" ? s : null;
}

/**
 * Save the playground whenever its repository or terminal changes (debounced).
 * Returns an unsubscribe function.
 */
export function autosavePlayground(store: StoreApi<LabState>, getSandboxId: () => string, onSaved?: (ok: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    timer = null;
    const st = store.getState();
    const ok = saveJSON(PLAYGROUND_KEY, { v: 1, sandboxId: getSandboxId(), world: st.world, savedAt: Date.now(), ...snapshotTerminal(st) } satisfies PlaygroundSave);
    onSaved?.(ok);
  };
  // Never lose a pending save when the tab is closed, reloaded or hidden.
  const flush = () => {
    if (!timer) return;
    clearTimeout(timer);
    write();
  };
  const unsub = store.subscribe((s, prev) => {
    if (s.world === prev.world && s.entries === prev.entries && s.inputHistory === prev.inputHistory) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, 400);
  });
  const onVisibility = () => document.visibilityState === "hidden" && flush();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    flush();
    unsub();
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
