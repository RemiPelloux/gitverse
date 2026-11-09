import type { World } from "@/engine";

export type Tier = "beginner" | "intermediate" | "advanced" | "expert";

/**
 * A check over the canonical simulation state — never over command text.
 * `ran` lists successfully executed command names (e.g. "status") and is
 * only used for read-only "look around" steps that don't change state.
 */
export type Check = (world: World, start: World, ran: string[]) => boolean;

export interface Objective {
  id: string;
  label: string;
  check: Check;
  /** Three-level adaptive hints: concept → command → full walkthrough. */
  hints: [string, string, string];
}

/** Visual scenes for "Discover" steps (see lesson/visuals). */
export type SceneId =
  | "snapshots"
  | "repository"
  | "three-areas"
  | "history"
  | "branch-split"
  | "fast-forward"
  | "three-way"
  | "conflict"
  | "remote"
  | "fetch-pull"
  | "undo"
  /** The lesson's own starting repository, drawn as a graph (not an interactive demo). */
  | "repo-state";

export interface DiscoverStep {
  kind: "discover";
  title: string;
  body: string[];
  scene: SceneId;
}

export interface WatchStep {
  kind: "watch";
  title: string;
  body: string;
  setup: () => World;
  frames: Array<{ command: string; caption: string }>;
}

export interface TryStep {
  kind: "try";
  title: string;
  body: string;
  /** Suggested command (Assisted mode shows it with a Run button). */
  command?: string;
  /** Alternative to a command: a UI action (e.g. creating a file). */
  action?: { label: string; kind: "create-file" | "edit-file"; path: string; content: string };
  check: Check;
  success: string;
  hint?: string;
}

export interface ExperimentStep {
  kind: "experiment";
  title: string;
  body: string;
  ideas: string[];
}

export interface ChallengeStep {
  kind: "challenge";
  title: string;
  body: string;
  objectives: Objective[];
  /** Contextual feedback derived from state (e.g. "you're still on main"). */
  feedback?: (world: World, start: World) => string | null;
}

export interface CelebrateStep {
  kind: "celebrate";
}

export type Step = DiscoverStep | WatchStep | TryStep | ExperimentStep | ChallengeStep | CelebrateStep;

/** Which tools the lesson workspace shows: the interface grows with the learner. */
export interface LessonUi {
  files: boolean;
  editor: boolean;
  stages: boolean;
  remote: boolean;
}

export interface Lesson {
  id: string;
  chapterId: string;
  title: string;
  tagline: string;
  xp: number;
  boss?: boolean;
  concepts: string[];
  commands: string[];
  setup: () => World;
  steps: Step[];
  ui: LessonUi;
  /** Plain-language recap shown on completion. */
  recap: string[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  tier: Tier;
  description: string;
  lessons: Lesson[];
  /** Lesson titles planned but not yet playable. */
  upcoming: string[];
}
