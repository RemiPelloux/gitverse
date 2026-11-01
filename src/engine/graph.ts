import { ancestors, headCommitId, reachable } from "./repo";
import type { Commit, World } from "./types";

export interface GraphRef {
  name: string;
  kind: "branch" | "remote" | "tag" | "head";
  /** HEAD attached to this branch. */
  current?: boolean;
}

export interface GraphNode {
  id: string;
  commit: Commit;
  col: number;
  lane: number;
  refs: GraphRef[];
  isHead: boolean;
  /** No longer reachable from any ref (e.g. after reset or rebase). */
  orphan: boolean;
  /** Exists on the remote only (fetched but not merged is still local). */
  merge: boolean;
}

export interface GraphEdge {
  id: string;
  from: string; // child
  to: string; // parent
  lane: number;
  primary: boolean;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lanes: { lane: number; label: string }[];
  cols: number;
  laneCount: number;
  headId: string | null;
  /** Branch the HEAD is attached to, or null if detached/no repo. */
  headBranch: string | null;
}

/**
 * Deterministic layout: x = creation order (time flows left→right),
 * y = lane. Lanes are claimed by walking first-parent chains from refs in a
 * stable priority order (default branch first, then by creation order), so a
 * branch keeps its row across state transitions.
 */
export function layoutGraph(world: World, opts: { showOrphans?: string[]; showRemote?: boolean } = {}): GraphLayout {
  const repo = world.repo;
  if (!repo) return { nodes: [], edges: [], lanes: [], cols: 0, laneCount: 0, headId: null, headBranch: null };
  const showRemote = opts.showRemote ?? true;
  const live = reachable(repo);
  const visible = new Set<string>(live);
  for (const o of opts.showOrphans ?? []) {
    if (repo.commits[o]) for (const a of ancestors(repo, o)) visible.add(a);
  }
  if (!showRemote) {
    // hide commits only reachable from remote refs
    const local = new Set<string>();
    const tips = [...Object.values(repo.branches), ...Object.values(repo.tags)];
    const h = headCommitId(repo);
    if (h) tips.push(h);
    if (repo.op) tips.push(repo.op.theirs);
    for (const t of tips) for (const a of ancestors(repo, t)) local.add(a);
    for (const id of [...visible]) if (!local.has(id) && live.has(id)) visible.delete(id);
  }

  const commits = [...visible].map((id) => repo.commits[id]).filter(Boolean).sort((a, b) => a.seq - b.seq);
  const col = new Map(commits.map((c, i) => [c.id, i]));

  // ordered ref tips for lane claiming
  const order: Array<{ label: string; tip: string }> = [];
  const branchNames = [...repo.branchOrder.filter((b) => repo.branches[b]), ...Object.keys(repo.branches).filter((b) => !repo.branchOrder.includes(b)).sort()];
  for (const b of branchNames) order.push({ label: b, tip: repo.branches[b] });
  if (showRemote) for (const r of Object.keys(repo.remoteRefs).sort()) order.push({ label: r, tip: repo.remoteRefs[r] });
  if (repo.head.kind === "detached") order.push({ label: "HEAD", tip: repo.head.commit });
  if (repo.op) order.push({ label: repo.op.theirsLabel, tip: repo.op.theirs });
  for (const t of Object.keys(repo.tags).sort()) order.push({ label: t, tip: repo.tags[t] });
  // orphans: the most recent unclaimed tips
  const childCount = new Map<string, number>();
  for (const c of commits) for (const p of c.parents) childCount.set(p, (childCount.get(p) ?? 0) + 1);
  for (const c of [...commits].reverse()) if (!childCount.has(c.id) && !live.has(c.id)) order.push({ label: "(unreachable)", tip: c.id });

  const laneOf = new Map<string, number>();
  const lanes: { lane: number; label: string }[] = [];
  // Lane reuse: a lane is free for a new chain if its occupied column span doesn't overlap.
  const laneSpans: Array<Array<[number, number]>> = [];
  const claim = (label: string, tip: string, mergedAt?: number) => {
    if (!visible.has(tip) || laneOf.has(tip)) return;
    const chain: string[] = [];
    let cur: string | undefined = tip;
    while (cur && visible.has(cur) && !laneOf.has(cur)) {
      chain.push(cur);
      cur = repo.commits[cur]?.parents[0];
    }
    if (!chain.length) return;
    const cols = chain.map((c) => col.get(c)!);
    const lo = Math.min(...cols) - (cur ? 1 : 0);
    const hi = Math.max(...cols, mergedAt ?? -1);
    let lane = laneSpans.findIndex((spans) => spans.every(([a, b]) => hi < a || lo > b));
    if (lane === -1) {
      lane = laneSpans.length;
      laneSpans.push([]);
    }
    laneSpans[lane].push([lo, hi]);
    if (label) lanes.push({ lane, label });
    for (const c of chain) laneOf.set(c, lane);
  };
  for (const { label, tip } of order) claim(label, tip);
  // side branches that were merged and whose ref is gone
  for (const c of [...commits].reverse()) {
    for (const p of c.parents.slice(1)) claim("", p, col.get(c.id));
  }
  for (const c of [...commits].reverse()) claim("", c.id);
  for (const c of commits) if (!laneOf.has(c.id)) laneOf.set(c.id, 0);

  const refsAt = new Map<string, GraphRef[]>();
  const addRef = (id: string, r: GraphRef) => {
    if (!refsAt.has(id)) refsAt.set(id, []);
    refsAt.get(id)!.push(r);
  };
  const headId = headCommitId(repo);
  for (const b of branchNames) addRef(repo.branches[b], { name: b, kind: "branch", current: repo.head.kind === "branch" && repo.head.name === b });
  if (showRemote) for (const [r, id] of Object.entries(repo.remoteRefs)) addRef(id, { name: r, kind: "remote" });
  for (const [t, id] of Object.entries(repo.tags)) addRef(id, { name: t, kind: "tag" });
  if (repo.head.kind === "detached") addRef(repo.head.commit, { name: "HEAD", kind: "head" });

  const nodes: GraphNode[] = commits.map((c) => ({
    id: c.id,
    commit: c,
    col: col.get(c.id)!,
    lane: laneOf.get(c.id)!,
    refs: refsAt.get(c.id) ?? [],
    isHead: c.id === headId,
    orphan: !live.has(c.id),
    merge: c.parents.length > 1,
  }));
  const edges: GraphEdge[] = [];
  for (const c of commits) {
    c.parents.forEach((p, i) => {
      if (!visible.has(p)) return;
      edges.push({ id: `${c.id}-${p}`, from: c.id, to: p, lane: i === 0 ? laneOf.get(c.id)! : laneOf.get(p)!, primary: i === 0 });
    });
  }
  return {
    nodes,
    edges,
    lanes,
    cols: commits.length,
    laneCount: Math.max(1, laneSpans.length),
    headId,
    headBranch: repo.head.kind === "branch" ? repo.head.name : null,
  };
}
