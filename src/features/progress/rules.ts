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

export const LEVEL_TITLES = [
  "Curious Newcomer",
  "First Snapshot",
  "History Reader",
  "Branch Explorer",
  "Merge Maker",
  "Conflict Tamer",
  "Time Traveler",
  "Remote Operator",
  "Team Player",
  "Git Wrangler",
  "Git Sage",
  "Gitverse Legend",
];

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "hello-terminal", title: "Hello, terminal", description: "Run your first command.", icon: "TerminalSquare" },
  { id: "ground-zero", title: "Ground zero", description: "Create your first repository.", icon: "FolderGit2" },
  { id: "snapshot", title: "Say cheese", description: "Make your first commit.", icon: "Camera" },
  { id: "branch-out", title: "Branching out", description: "Create a branch.", icon: "GitBranch" },
  { id: "time-traveler", title: "Time traveler", description: "Visit an old commit in detached HEAD.", icon: "History" },
  { id: "together", title: "Together again", description: "Merge two branches.", icon: "GitMerge" },
  { id: "peacemaker", title: "Peacemaker", description: "Resolve a merge conflict.", icon: "Handshake" },
  { id: "to-the-cloud", title: "To the cloud", description: "Push to the simulated GitHub.", icon: "CloudUpload" },
  { id: "in-sync", title: "In sync", description: "Fetch new work from a teammate.", icon: "RefreshCw" },
  { id: "rescuer", title: "Rescue mission", description: "Recover a lost commit with the reflog.", icon: "LifeBuoy" },
  { id: "explorer", title: "Explorer", description: "Use 10 different Git commands.", icon: "Compass" },
  { id: "foundations", title: "Foundations laid", description: "Complete Chapter 1.", icon: "Blocks" },
  { id: "boss", title: "Boss slayer", description: "Defeat a boss challenge.", icon: "Swords" },
  { id: "sandbox", title: "Mad scientist", description: "Experiment in the Playground.", icon: "FlaskConical" },
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

export interface QuestDef {
  id: string;
  title: string;
  target: number;
  progress: (d: DayActivity) => number;
}

const QUEST_POOL: QuestDef[] = [
  { id: "lesson", title: "Complete a lesson", target: 1, progress: (d) => d.lessons },
  { id: "xp", title: "Earn 100 XP", target: 100, progress: (d) => d.xp },
  { id: "commands", title: "Use 4 different Git commands", target: 4, progress: (d) => d.commands.length },
  { id: "commits", title: "Make 3 commits", target: 3, progress: (d) => d.commits },
  { id: "playground", title: "Experiment in the Playground", target: 1, progress: (d) => (d.playground ? 1 : 0) },
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
