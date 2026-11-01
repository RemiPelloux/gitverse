import { LESSONS } from "./lessons";
import type { Chapter, Lesson, Tier } from "./types";

const L = LESSONS;

export const CHAPTERS: Chapter[] = [
  {
    id: "foundations",
    number: 1,
    title: "Git Foundations",
    tier: "beginner",
    description: "What Git is, and how to save your very first snapshot.",
    lessons: [L.whatIsGit, L.firstCommit, L.makingChanges],
    upcoming: [],
  },
  {
    id: "history",
    number: 2,
    title: "Understanding History",
    tier: "beginner",
    description: "Read the timeline, commit IDs, HEAD and time travel.",
    lessons: [L.readingHistory],
    upcoming: ["Inspecting changes between commits"],
  },
  {
    id: "branching",
    number: 3,
    title: "Branching",
    tier: "intermediate",
    description: "Parallel timelines for safe experiments.",
    lessons: [L.branches],
    upcoming: ["Renaming and deleting branches"],
  },
  {
    id: "merging",
    number: 4,
    title: "Merging",
    tier: "intermediate",
    description: "Join timelines back together — and handle conflicts.",
    lessons: [L.fastForward, L.threeWay, L.conflicts],
    upcoming: [],
  },
  {
    id: "rebase",
    number: 5,
    title: "Rebase",
    tier: "intermediate",
    description: "Replay commits for a clean, linear history.",
    lessons: [],
    upcoming: ["Rebase fundamentals", "Interactive rebase", "Squash & fixup", "Merge vs rebase"],
  },
  {
    id: "undo",
    number: 6,
    title: "Undoing Changes",
    tier: "advanced",
    description: "Restore, revert, reset — and recovering “lost” work.",
    lessons: [L.revertLesson, L.lostCommit],
    upcoming: ["Amend", "Reset modes in depth"],
  },
  {
    id: "github",
    number: 7,
    title: "GitHub Fundamentals",
    tier: "advanced",
    description: "Remotes, push, fetch and pull with teammates.",
    lessons: [L.firstPush, L.cloneContribute, L.fetchPull],
    upcoming: [],
  },
  {
    id: "pull-requests",
    number: 8,
    title: "Pull Requests",
    tier: "advanced",
    description: "Propose, review and merge changes on GitHub.",
    lessons: [],
    upcoming: ["Creating pull requests", "Code review", "Merge strategies", "Branch protection"],
  },
  {
    id: "collaboration",
    number: 9,
    title: "Team Collaboration",
    tier: "advanced",
    description: "Feature branches, GitHub Flow and trunk-based development.",
    lessons: [],
    upcoming: ["GitHub Flow", "Trunk-based development", "Release management"],
  },
  {
    id: "advanced",
    number: 10,
    title: "Advanced Git",
    tier: "expert",
    description: "Cherry-pick, stash, tags, bisect and more.",
    lessons: [],
    upcoming: ["Cherry-pick", "Stash", "Tags", "Bisect", ".gitignore", "Hooks"],
  },
  {
    id: "workflows",
    number: 11,
    title: "GitHub Developer Workflows",
    tier: "expert",
    description: "Issues, Actions, CI/CD and repository security.",
    lessons: [],
    upcoming: ["GitHub Actions", "CI/CD", "Secrets", "Permissions"],
  },
  {
    id: "scenarios",
    number: 12,
    title: "Real-World Rescue Missions",
    tier: "expert",
    description: "Committed a secret? Wrong branch? Broke main? Fix it.",
    lessons: [],
    upcoming: ["Committed to the wrong branch", "Broke main", "Accidentally committed a secret"],
  },
];

export const ALL_LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);

export const getLesson = (id: string) => ALL_LESSONS.find((l) => l.id === id) ?? null;
export const getChapter = (id: string) => CHAPTERS.find((c) => c.id === id) ?? null;

export function nextLesson(id: string): Lesson | null {
  const i = ALL_LESSONS.findIndex((l) => l.id === id);
  return i >= 0 ? (ALL_LESSONS[i + 1] ?? null) : null;
}

/**
 * A lesson unlocks when the previous playable lesson is complete. Completed
 * lessons are always replayable. Learners who said they already know Git
 * (onboarding assessment) can skip ahead.
 */
export function isUnlocked(id: string, completed: Record<string, unknown>, experience: "new" | "some" | "comfortable" | null = null): boolean {
  const i = ALL_LESSONS.findIndex((l) => l.id === id);
  if (i <= 0 || completed[id]) return true;
  if (experience === "comfortable") return true;
  if (experience === "some" && i <= ALL_LESSONS.findIndex((l) => l.chapterId === "branching")) return true;
  return !!completed[ALL_LESSONS[i - 1].id];
}

export const TIER_LABEL: Record<Tier, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export type { Chapter, Lesson, Step, Tier, Objective } from "./types";
