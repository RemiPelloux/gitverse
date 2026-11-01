"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GitEvent, World } from "@/engine";
import type { TerminalSnapshot } from "@/features/lab/persistence";
import { CHAPTERS } from "@/features/curriculum";
import {
  achievementsForEvent,
  dayKey,
  DISCOVERY_XP,
  emptyDay,
  QUEST_XP,
  questsFor,
  type DayActivity,
} from "./rules";

export type TerminalMode = "assisted" | "real";

export interface Toast {
  id: number;
  kind: "xp" | "achievement" | "quest" | "level";
  title: string;
  detail?: string;
}

export interface Settings {
  terminalMode: TerminalMode;
  theme: "dark" | "light";
  motion: "system" | "reduced" | "full";
  showStreak: boolean;
}

interface ProgressState {
  name: string;
  onboarded: boolean;
  experience: "new" | "some" | "comfortable" | null;
  xp: number;
  completed: Record<string, { at: number; xp: number }>;
  achievements: Record<string, number>;
  commands: Record<string, number>;
  activity: Record<string, DayActivity>;
  questsClaimed: Record<string, string[]>;
  /** Autosaved in-progress lessons. */
  saves: Record<string, { step: number; world: World; start: World; terminal?: TerminalSnapshot }>;
  settings: Settings;
  toasts: Toast[];

  setName: (name: string) => void;
  finishOnboarding: (experience: ProgressState["experience"]) => void;
  recordCommand: (command: string | null, ok: boolean, events: GitEvent[], where: "lesson" | "playground") => void;
  completeLesson: (lessonId: string, xp: number, boss: boolean) => { gained: number; first: boolean };
  unlock: (id: string) => void;
  saveLesson: (id: string, step: number, world: World, start: World, terminal?: TerminalSnapshot) => void;
  clearLesson: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  dismissToast: (id: number) => void;
  resetProgress: () => void;
}

let toastId = 1;

const initial = {
  name: "",
  onboarded: false,
  experience: null,
  xp: 0,
  completed: {},
  achievements: {},
  commands: {},
  activity: {},
  questsClaimed: {},
  saves: {},
  settings: { terminalMode: "assisted", theme: "light", motion: "system", showStreak: true } as Settings,
  toasts: [] as Toast[],
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      const pushToast = (t: Omit<Toast, "id">) => set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id: toastId++ }] }));

      /** Add XP to totals + today's activity, then evaluate quests. */
      const addXp = (amount: number, mutateDay?: (d: DayActivity) => void) => {
        const key = dayKey();
        set((s) => {
          const day = { ...(s.activity[key] ?? emptyDay()) };
          day.commands = [...day.commands];
          day.xp += amount;
          mutateDay?.(day);
          return { xp: s.xp + amount, activity: { ...s.activity, [key]: day } };
        });
        const s = get();
        const day = s.activity[key];
        const claimed = s.questsClaimed[key] ?? [];
        for (const q of questsFor(key)) {
          if (!claimed.includes(q.id) && q.progress(day) >= q.target) {
            set((st) => ({
              xp: st.xp + QUEST_XP,
              questsClaimed: { ...st.questsClaimed, [key]: [...(st.questsClaimed[key] ?? []), q.id] },
            }));
            pushToast({ kind: "quest", title: `Daily quest complete: ${q.title}`, detail: `+${QUEST_XP} XP` });
          }
        }
      };

      const unlock = (id: string) => {
        if (get().achievements[id]) return;
        set((s) => ({ achievements: { ...s.achievements, [id]: Date.now() } }));
        pushToast({ kind: "achievement", title: "Achievement unlocked", detail: id });
      };

      return {
        ...initial,
        setName: (name) => set({ name }),
        finishOnboarding: (experience) => set({ onboarded: true, experience }),
        recordCommand: (command, ok, events, where) => {
          if (!command) return;
          if (!get().achievements["hello-terminal"]) unlock("hello-terminal");
          if (where === "playground") unlock("sandbox");
          if (!ok && !events.length) return;
          const isGit = events.length > 0 || ["status", "log", "diff", "show", "reflog", "branch", "remote", "tag"].includes(command);
          const firstTime = isGit && !get().commands[command];
          set((s) => ({ commands: { ...s.commands, [command]: (s.commands[command] ?? 0) + 1 } }));
          const commits = events.filter((e) => e.type === "commit").length;
          addXp(firstTime ? DISCOVERY_XP : 0, (d) => {
            if (isGit && !d.commands.includes(command)) d.commands.push(command);
            d.commits += commits;
            if (where === "playground") d.playground = true;
          });
          if (firstTime) pushToast({ kind: "xp", title: `New command discovered: git ${command}`, detail: `+${DISCOVERY_XP} XP` });
          for (const e of events) for (const a of achievementsForEvent(e)) unlock(a);
          if (Object.keys(get().commands).length >= 10) unlock("explorer");
        },
        completeLesson: (lessonId, xp, boss) => {
          const first = !get().completed[lessonId];
          const gained = first ? xp : 0;
          if (first) set((s) => ({ completed: { ...s.completed, [lessonId]: { at: Date.now(), xp } } }));
          addXp(gained, (d) => {
            d.lessons += 1;
          });
          if (boss) unlock("boss");
          if (lessonId === "merge-conflicts") unlock("peacemaker");
          if (lessonId === "lost-commit") unlock("rescuer");
          const foundations = CHAPTERS[0].lessons.every((l) => get().completed[l.id]);
          if (foundations) unlock("foundations");
          return { gained, first };
        },
        unlock,
        saveLesson: (id, step, world, start, terminal) => set((s) => ({ saves: { ...s.saves, [id]: { step, world, start, terminal } } })),
        clearLesson: (id) =>
          set((s) => {
            const saves = { ...s.saves };
            delete saves[id];
            return { saves };
          }),
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        resetProgress: () => set({ ...initial, settings: get().settings }),
      };
    },
    {
      name: "gitverse-progress",
      version: 1,
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { toasts, ...rest } = s;
        return rest;
      },
    },
  ),
);
