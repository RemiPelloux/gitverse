/**
 * Canonical simulation state. Everything the UI shows (graph, terminal,
 * files, lesson validation) derives from a `World`.
 *
 * The state is plain JSON so it can be cloned, serialized, shared and
 * time-travelled. All operations are pure: (World, input) -> (World, result).
 */

/** path -> file content. Snapshots are immutable once stored in a commit. */
export type FileMap = Record<string, string>;

export interface Commit {
  id: string;
  /** Full snapshot of the project at this commit. */
  tree: FileMap;
  parents: string[];
  message: string;
  author: string;
  /** Deterministic logical timestamp (seconds since simulation epoch). */
  time: number;
  /** Monotonic creation order; used for stable graph layout. */
  seq: number;
}

export type Head =
  | { kind: "branch"; name: string }
  | { kind: "detached"; commit: string };

export interface ReflogEntry {
  /** Commit HEAD pointed to after the operation. */
  commit: string;
  message: string;
}

/** An operation that stopped part-way (usually because of conflicts). */
export interface OpState {
  kind: "merge" | "revert" | "cherry-pick" | "rebase";
  /** Commit being merged / applied. For merges this is MERGE_HEAD. */
  theirs: string;
  theirsLabel: string;
  conflicts: string[];
  message: string;
  author?: string;
  rebase?: {
    branch: string | null;
    upstream: string;
    origHead: string;
    todo: string[];
    rewritten: Array<[string, string]>;
  };
}

export interface StashEntry {
  base: string;
  index: FileMap;
  workdir: FileMap;
  message: string;
}

/** A pull request on the simulated GitHub. Numbers are shared with issues, like on GitHub. */
export interface PullRequest {
  number: number;
  title: string;
  body: string;
  author: string;
  /** Branch with the changes. */
  head: string;
  /** Branch it should be merged into. */
  base: string;
  /** Commit the head branch pointed to when the PR was last updated. */
  headCommit: string;
  state: "open" | "merged" | "closed";
  reviews: Array<{ author: string; state: "approved" | "changes_requested" | "commented"; body: string }>;
  mergedWith?: "merge" | "squash" | "rebase";
  mergeCommit?: string;
}

export interface Issue {
  number: number;
  title: string;
  body: string;
  author: string;
  state: "open" | "closed";
  labels: string[];
  /** Commit or PR ("#12") that closed it. */
  closedBy?: string;
}

export interface Release {
  tag: string;
  title: string;
  notes: string;
  author: string;
}

/** One GitHub Actions workflow run. */
export interface WorkflowRun {
  id: number;
  workflow: string;
  event: "push" | "pull_request";
  branch: string;
  commit: string;
  status: "success" | "failure";
  pr?: number;
  jobs: Array<{ name: string; ok: boolean; log: string[] }>;
}

/** Branch protection rule (GitHub "rulesets" / protected branches). */
export interface Protection {
  /** Direct pushes are rejected: changes must arrive through a pull request. */
  requirePullRequest: boolean;
  requiredApprovals: number;
  /** Names of workflow jobs that must pass before merging. */
  requiredChecks: string[];
}

/** A repository hosted on the simulated GitHub. */
export interface HostedRepo {
  url: string;
  owner: string;
  name: string;
  branches: Record<string, string>;
  defaultBranch: string;
  /** Tags published with `git push --tags` / `git push origin <tag>`. */
  tags?: Record<string, string>;
  pulls?: PullRequest[];
  issues?: Issue[];
  releases?: Release[];
  runs?: WorkflowRun[];
  /** Actions secrets: name -> value (never printed). */
  secrets?: Record<string, string>;
  /** Branch name -> protection rule. */
  protection?: Record<string, Protection>;
  /** Simulated teammates who review (and approve) new pull requests. */
  autoReviewers?: string[];
  /** Next number for a PR or issue. */
  nextNumber?: number;
}

export interface Repo {
  /** Object store shared by local repo and simulated remotes (content addressed). */
  commits: Record<string, Commit>;
  branches: Record<string, string>;
  /** Order in which branches were created (stable lane assignment). */
  branchOrder: string[];
  tags: Record<string, string>;
  head: Head;
  /** The staging area: the snapshot the next commit will record. */
  index: FileMap;
  reflog: ReflogEntry[];
  op: OpState | null;
  stash: StashEntry[];
  /** Remote name -> URL of a hosted repository. */
  remotes: Record<string, string>;
  /** Remote-tracking refs, e.g. "origin/main" -> commit id. */
  remoteRefs: Record<string, string>;
  /** Local branch -> upstream ("origin/main"). */
  upstream: Record<string, string>;
  /** `git config` values other than user.name / user.email (e.g. core.hooksPath). */
  config?: Record<string, string>;
  /** An in-progress `git bisect` session. */
  bisect?: BisectState | null;
}

export interface BisectState {
  /** Branch (or detached commit) to return to on `git bisect reset`. */
  orig: string;
  bad: string | null;
  good: string[];
  /** The first bad commit, once found. */
  found?: string;
}

export interface World {
  version: 1;
  /** Files on disk in the project folder. Exists before `git init`. */
  workdir: FileMap;
  repo: Repo | null;
  /**
   * The simulated GitHub: hosted repositories by URL, and the commit objects
   * they hold. Commits only reach the local repo through fetch/pull/clone.
   */
  hosted: Record<string, HostedRepo>;
  hostedCommits: Record<string, Commit>;
  clock: number;
  seq: number;
  user: { name: string; email: string };
}

export type LineKind =
  | "out"
  | "muted"
  | "error"
  | "success"
  | "hint"
  | "added"
  | "removed"
  | "hunk"
  | "commit"
  | "warning";

export interface OutLine {
  text: string;
  kind: LineKind;
}

/** Semantic events that drive animations and lesson feedback. */
export type GitEvent =
  | { type: "init" }
  | { type: "stage"; paths: string[] }
  | { type: "unstage"; paths: string[] }
  | { type: "commit"; id: string; branch: string | null }
  | { type: "branch-create"; name: string; at: string }
  | { type: "branch-delete"; name: string }
  | { type: "checkout"; from: string | null; to: string; detached: boolean }
  | { type: "merge"; mode: "fast-forward" | "merge-commit" | "up-to-date"; into: string | null; from: string; id?: string }
  | { type: "conflict"; paths: string[] }
  | { type: "push"; remote: string; branch: string; id: string }
  | { type: "fetch"; remote: string; updated: string[] }
  | { type: "clone"; url: string }
  | { type: "reset"; mode: string; to: string }
  | { type: "rebase"; onto: string; rewritten: Array<[string, string]> }
  | { type: "file-change"; paths: string[] }
  | { type: "tag"; name: string; at: string }
  | { type: "stash"; action: "push" | "pop" };

export interface ExecResult {
  world: World;
  lines: OutLine[];
  events: GitEvent[];
  ok: boolean;
  /** Command name recognized (e.g. "commit"), for XP / mastery tracking. */
  command: string | null;
  /** Plain-language explanation of an error, for beginners. */
  explain?: string;
  clear?: boolean;
}
