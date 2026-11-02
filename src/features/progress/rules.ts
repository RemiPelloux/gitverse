/** Pure progression rules: levels, achievements, daily quests. */
import type { GitEvent } from "@/engine";

export const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000];

export function levelFor(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) level = i + 1;
  const floor = LEVELS[level - 1];
  const ceil = LEVELS[level] ?? floor + 1000;
  return { level, floor, ceil, progress: (xp - floor) / (ceil - floor) };
}

/** Titles live in the message dictionaries (`levels`), one per level. */
export const LEVEL_COUNT = LEVELS.length;

export interface AchievementDef {
  id: string;
  icon: string; // lucide icon name
}

/** Badge names and descriptions live in the message dictionaries (`badges.<id>`). */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "hello-terminal", icon: "TerminalSquare" },
  { id: "ground-zero", icon: "FolderGit2" },
  { id: "snapshot", icon: "Camera" },
  { id: "branch-out", icon: "GitBranch" },
  { id: "time-traveler", icon: "History" },
  { id: "together", icon: "GitMerge" },
  { id: "peacemaker", icon: "Handshake" },
  { id: "to-the-cloud", icon: "CloudUpload" },
  { id: "in-sync", icon: "RefreshCw" },
  { id: "rescuer", icon: "LifeBuoy" },
  { id: "explorer", icon: "Compass" },
  { id: "foundations", icon: "Blocks" },
  { id: "boss", icon: "Swords" },
  { id: "sandbox", icon: "FlaskConical" },
  { id: "flawless", icon: "Star" },
  { id: "goal-getter", icon: "Target" },
  { id: "on-fire", icon: "Flame" },
  { id: "halfway", icon: "Milestone" },
  { id: "graduate", icon: "GraduationCap" },
  { id: "polyglot", icon: "Languages" },
];

/** Achievement ids unlocked by a simulator event. */
export function achievementsForEvent(e: GitEvent): string[] {
  switch (e.type) {
    case "init":
      return ["ground-zero"];
    case "commit":
      return ["snapshot"];
    case "branch-create":
      return ["branch-out"];
    case "checkout":
      return e.detached ? ["time-traveler"] : [];
    case "merge":
      return e.mode === "up-to-date" ? [] : ["together"];
    case "push":
      return ["to-the-cloud"];
    case "fetch":
      return e.updated.length ? ["in-sync"] : [];
    default:
      return [];
  }
}

/** XP for discovering a Git command for the first time (rewards exploration, not repetition). */
export const DISCOVERY_XP = 5;
export const QUEST_XP = 20;

export interface DayActivity {
  xp: number;
  lessons: number;
  commands: string[];
  commits: number;
  playground: boolean;
}

export const emptyDay = (): DayActivity => ({ xp: 0, lessons: 0, commands: [], commits: 0, playground: false });

/** Quest titles live in the message dictionaries (`quests.<id>`). */
export interface QuestDef {
  id: string;
  target: number;
  progress: (d: DayActivity) => number;
}

const QUEST_POOL: QuestDef[] = [
  { id: "lesson", target: 1, progress: (d) => d.lessons },
  { id: "xp", target: 100, progress: (d) => d.xp },
  { id: "commands", target: 4, progress: (d) => d.commands.length },
  { id: "commits", target: 3, progress: (d) => d.commits },
  { id: "playground", target: 1, progress: (d) => (d.playground ? 1 : 0) },
];

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Three deterministic quests per day. */
export function questsFor(day: string): QuestDef[] {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...QUEST_POOL];
  const out: QuestDef[] = [];
  while (out.length < 3) out.push(pool.splice(h++ % pool.length, 1)[0]);
  return out;
}

export function streak(activity: Record<string, DayActivity>, today = new Date()): number {
  let n = 0;
  const d = new Date(today);
  if (!activity[dayKey(d)]?.xp) d.setDate(d.getDate() - 1); // today not done yet doesn't break it
  while (activity[dayKey(d)]?.xp) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Stars for a finished lesson: finishing, solving without the walkthrough hint, and few mistakes. */
export function starsFor(run: { walkthrough: boolean; mistakes: number }) {
  return 1 + (run.walkthrough ? 0 : 1) + (run.mistakes <= 2 ? 1 : 0);
}

/** Bonus XP for a flawless (3-star) first completion. */
export const FLAWLESS_XP = 15;

export const DAILY_GOALS = [30, 60, 120] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number];

/** Avatar colors (lane colors of the graph). */
export const AVATAR_COLORS = ["lane-0", "lane-1", "lane-2", "lane-3", "lane-4", "lane-5"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];
