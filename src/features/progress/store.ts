"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GitEvent, World } from "@/engine";
import type { TerminalSnapshot } from "@/features/lab/persistence";
import { ALL_LESSONS, CHAPTERS } from "@/features/curriculum";
import type { Locale } from "@/i18n/locale";
import {
  achievementsForEvent,
  dayKey,
  DISCOVERY_XP,
  emptyDay,
  FLAWLESS_XP,
  levelFor,
  QUEST_XP,
  questsFor,
  streak,
  type AvatarColor,
  type DailyGoal,
  type DayActivity,
} from "./rules";

export type TerminalMode = "assisted" | "real";

/** Toasts store message keys, so they show in the learner's current language. */
export interface Toast {
  id: number;
  kind: "xp" | "achievement" | "quest" | "goal";
  /** discovered command (xp), badge id (achievement) or quest id (quest) */
  subject?: string;
  xp?: number;
}

export interface Settings {
  terminalMode: TerminalMode;
  theme: "dark" | "light";
  motion: "system" | "reduced" | "full";
  showStreak: boolean;
  /** Unset until the learner picks one (we then guess from the browser). */
  locale?: Locale;
  dailyGoal: DailyGoal;
}

interface ProgressState {
  name: string;
  onboarded: boolean;
  experience: "new" | "some" | "comfortable" | null;
  avatar: AvatarColor;
  xp: number;
  completed: Record<string, { at: number; xp: number; stars?: number }>;
  achievements: Record<string, number>;
  commands: Record<string, number>;
  activity: Record<string, DayActivity>;
  questsClaimed: Record<string, string[]>;
  /** Autosaved in-progress lessons. */
  saves: Record<string, { step: number; world: World; start: World; terminal?: TerminalSnapshot }>;
  settings: Settings;
  toasts: Toast[];
  /** Set when the learner reaches a new level; shown once as a celebration. */
  levelUp: number | null;
  /** While a learner is working through a lesson step, the level-up popup waits. */
  holdCelebrations: boolean;
  setHoldCelebrations: (hold: boolean) => void;
  /** The celebration screen lists badges itself, so toasts stay quiet there. */
  quietToasts: boolean;
  setQuietToasts: (quiet: boolean) => void;

  setName: (name: string) => void;
  setAvatar: (avatar: AvatarColor) => void;
  finishOnboarding: (experience: ProgressState["experience"]) => void;
  recordCommand: (command: string | null, ok: boolean, events: GitEvent[], where: "lesson" | "playground") => void;
  completeLesson: (lessonId: string, xp: number, boss: boolean, stars: number) => { gained: number; first: boolean; bonus: number; best: number };
  unlock: (id: string) => void;
  saveLesson: (id: string, step: number, world: World, start: World, terminal?: TerminalSnapshot) => void;
  clearLesson: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  dismissToast: (id: number) => void;
  dismissLevelUp: () => void;
  resetProgress: () => void;
}

let toastId = 1;

const initial = {
  name: "",
  onboarded: false,
  experience: null,
  avatar: "lane-0" as AvatarColor,
  xp: 0,
  completed: {},
  achievements: {},
  commands: {},
  activity: {},
  questsClaimed: {},
  saves: {},
  settings: { terminalMode: "assisted", theme: "light", motion: "system", showStreak: true, dailyGoal: 60 } as Settings,
  toasts: [] as Toast[],
  levelUp: null as number | null,
  holdCelebrations: false,
  quietToasts: false,
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      const pushToast = (t: Omit<Toast, "id">) => {
        if (!get().quietToasts) set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id: toastId++ }] }));
      };

      /** Add XP to totals + today's activity, then evaluate quests. */
      const addXp = (amount: number, mutateDay?: (d: DayActivity) => void) => {
        const key = dayKey();
        const before = get();
        const levelBefore = levelFor(before.xp).level;
        const dayXpBefore = before.activity[key]?.xp ?? 0;
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
            pushToast({ kind: "quest", subject: q.id, xp: QUEST_XP });
          }
        }
        const after = get();
        const goal = after.settings.dailyGoal ?? 60;
        if (dayXpBefore < goal && (after.activity[key]?.xp ?? 0) >= goal) {
          pushToast({ kind: "goal", xp: goal });
          unlock("goal-getter");
        }
        if (streak(after.activity) >= 3) unlock("on-fire");
        const levelAfter = levelFor(after.xp).level;
        if (levelAfter > levelBefore) set({ levelUp: levelAfter });
      };

      const unlock = (id: string) => {
        if (get().achievements[id]) return;
        set((s) => ({ achievements: { ...s.achievements, [id]: Date.now() } }));
        pushToast({ kind: "achievement", subject: id });
      };

      return {
        ...initial,
        setName: (name) => set({ name }),
        setAvatar: (avatar) => set({ avatar }),
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
          if (firstTime) pushToast({ kind: "xp", subject: command, xp: DISCOVERY_XP });
          for (const e of events) for (const a of achievementsForEvent(e)) unlock(a);
          if (Object.keys(get().commands).length >= 10) unlock("explorer");
        },
        completeLesson: (lessonId, xp, boss, stars) => {
          const prev = get().completed[lessonId];
          const first = !prev;
          const prevStars = prev ? (prev.stars ?? 1) : 0;
          const best = Math.max(prevStars, stars);
          // The flawless bonus is paid once per lesson, the first time it's earned.
          const bonus = stars === 3 && prevStars < 3 ? FLAWLESS_XP : 0;
          const gained = (first ? xp : 0) + bonus;
          set((s) => ({ completed: { ...s.completed, [lessonId]: { at: prev?.at ?? Date.now(), xp: prev?.xp ?? xp, stars: best } } }));
          if (stars === 3) unlock("flawless");
          addXp(gained, (d) => {
            d.lessons += 1;
          });
          if (boss) unlock("boss");
          if (lessonId === "merge-conflicts") unlock("peacemaker");
          if (lessonId === "lost-commit") unlock("rescuer");
          const foundations = CHAPTERS[0].lessons.every((l) => get().completed[l.id]);
          if (foundations) unlock("foundations");
          const done = ALL_LESSONS.filter((l) => get().completed[l.id]).length;
          if (done >= Math.ceil(ALL_LESSONS.length / 2)) unlock("halfway");
          if (done === ALL_LESSONS.length) unlock("graduate");
          return { gained, first, bonus, best };
        },
        unlock,
        saveLesson: (id, step, world, start, terminal) => set((s) => ({ saves: { ...s.saves, [id]: { step, world, start, terminal } } })),
        clearLesson: (id) =>
          set((s) => {
            const saves = { ...s.saves };
            delete saves[id];
            return { saves };
          }),
        updateSettings: (patch) => {
          const prev = get().settings;
          set((s) => ({ settings: { ...s.settings, ...patch } }));
          // Switching language on purpose (not the first automatic guess) earns a badge.
          if (patch.locale && prev.locale && patch.locale !== prev.locale && get().onboarded) unlock("polyglot");
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        dismissLevelUp: () => set({ levelUp: null }),
        setHoldCelebrations: (holdCelebrations) => set({ holdCelebrations }),
        setQuietToasts: (quietToasts) => set(quietToasts ? { quietToasts, toasts: [] } : { quietToasts }),
        resetProgress: () => set({ ...initial, name: get().name, avatar: get().avatar, onboarded: get().onboarded, experience: get().experience, settings: get().settings }),
      };
    },
    {
      name: "gitverse-progress",
      version: 2,
      // v1 → v2 only added fields; missing ones get defaults in merge().
      migrate: (state) => state as ProgressState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressState>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } };
      },
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { toasts, levelUp, holdCelebrations, quietToasts, ...rest } = s;
        return rest;
      },
    },
  ),
);
