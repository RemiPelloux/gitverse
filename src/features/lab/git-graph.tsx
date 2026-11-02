"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Crosshair, GitCommitHorizontal, Maximize2, Minus, Plus, Tag, Cloud } from "lucide-react";
import { layoutGraph, shortId, type GitEvent, type GraphLayout, type GraphNode, type World } from "@/engine";
import { useT, type T } from "@/i18n";

const COL_W = 96;
const LANE_H = 112;
const PAD_X = 64;
const PAD_TOP = 92;
const R = 11;

export const laneColor = (lane: number) => `var(--lane-${lane % 6})`;
const nx = (n: { col: number }) => PAD_X + n.col * COL_W;
const ny = (n: { lane: number }) => PAD_TOP + n.lane * LANE_H;
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function edgePath(x1: number, y1: number, x2: number, y2: number, nearChild: boolean) {
  // Always "M L C L" so motion can interpolate between shapes.
  if (y1 === y2) return `M ${x1} ${y1} L ${x1} ${y1} C ${x1} ${y1} ${x2} ${y2} ${x2} ${y2} L ${x2} ${y2}`;
  const span = Math.min(COL_W, Math.abs(x2 - x1));
  if (nearChild) {
    const sx = x2 - span;
    return `M ${x1} ${y1} L ${sx} ${y1} C ${sx + span * 0.6} ${y1} ${x2 - span * 0.4} ${y2} ${x2} ${y2} L ${x2} ${y2}`;
  }
  const ex = x1 + span;
  return `M ${x1} ${y1} L ${x1} ${y1} C ${x1 + span * 0.6} ${y1} ${ex - span * 0.4} ${y2} ${ex} ${y2} L ${x2} ${y2}`;
}

export interface GitGraphProps {
  world: World;
  events?: GitEvent[];
  eventKey?: number;
  ghosts?: string[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  className?: string;
  /** Compact mode for teaching scenes: no controls, auto-fit. */
  compact?: boolean;
  showRemote?: boolean;
}

export function GitGraph({ world, events = [], eventKey = 0, ghosts = [], selected, onSelect, className, compact, showRemote = true }: GitGraphProps) {
  const layout = useMemo(() => layoutGraph(world, { showOrphans: ghosts, showRemote }), [world, ghosts, showRemote]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 300 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState(false);
  const [follow, setFollow] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const t = useT();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{ x: number; y: number; vx: number; vy: number; dist?: number; k?: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const contentW = PAD_X * 2 + Math.max(0, layout.cols - 1) * COL_W;
  const contentH = PAD_TOP + Math.max(0, layout.laneCount - 1) * LANE_H + 56;

  const fitView = useCallback(() => {
    const k = Math.max(0.35, Math.min(compact ? 1.15 : 1.1, size.w / Math.max(contentW, 1), size.h / Math.max(contentH, 1)));
    return { k, x: (size.w - contentW * k) / 2, y: Math.max(0, (size.h - contentH * k) / 2) };
  }, [compact, size.w, size.h, contentW, contentH]);
  const fit = () => setView(fitView());

  const headNode = layout.nodes.find((n) => n.isHead);

  // Keep HEAD in view (follow mode) and fit small graphs — recomputed when the layout or size changes.
  const sig = `${layout.cols}|${layout.laneCount}|${headNode?.id}|${size.w}|${size.h}`;
  const [lastSig, setLastSig] = useState("");
  if (sig !== lastSig) {
    setLastSig(sig);
    if (compact || contentW * view.k <= size.w) setView(fitView());
    else if (follow && headNode) {
      const sx = nx(headNode) * view.k + view.x;
      const sy = ny(headNode) * view.k + view.y;
      if (sx < 60 || sx > size.w - 80 || sy < 40 || sy > size.h - 40)
        setView({
          ...view,
          x: Math.min(0, size.w * 0.7 - nx(headNode) * view.k),
          y: Math.min(0, Math.max(size.h - contentH * view.k, size.h / 2 - ny(headNode) * view.k)),
        });
    }
  }

  const zoom = (factor: number, cx = size.w / 2, cy = size.h / 2) =>
    setView((v) => {
      const k = Math.min(2.2, Math.max(0.3, v.k * factor));
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });

  const onPointerDown = (e: RPointerEvent) => {
    if (compact) return;
    if ((e.target as Element).closest("[data-node]")) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      dragStart.current = { x: 0, y: 0, vx: view.x, vy: view.y, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), k: view.k };
    } else dragStart.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
    setFollow(false);
  };
  const onPointerMove = (e: RPointerEvent) => {
    if (!dragStart.current || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && dragStart.current.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const k = Math.min(2.2, Math.max(0.3, dragStart.current.k! * (d / dragStart.current.dist)));
      setView((v) => ({ ...v, k }));
      return;
    }
    setView((v) => ({ ...v, x: dragStart.current!.vx + e.clientX - dragStart.current!.x, y: dragStart.current!.vy + e.clientY - dragStart.current!.y }));
  };
  const onPointerUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) {
      dragStart.current = null;
      setDragging(false);
    }
  };
  useEffect(() => {
    const el = containerRef.current;
    if (!el || compact) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top);
      else {
        setFollow(false);
        setView((v) => ({ ...v, x: v.x - (e.shiftKey ? e.deltaY : e.deltaX || e.deltaY), y: e.shiftKey ? v.y : v.y - (e.deltaX ? e.deltaY : 0) }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, size.w, size.h]);

  const focusNode = (n: GraphNode) => setView({ k: 1.3, x: size.w / 2 - nx(n) * 1.3, y: size.h / 2 - ny(n) * 1.3 });

  const pulseIds = new Set(events.flatMap((e) => (e.type === "commit" ? [e.id] : e.type === "merge" && e.id ? [e.id] : [])));
  const rebasedNew = new Set(events.flatMap((e) => (e.type === "rebase" ? e.rewritten.map(([, n]) => n) : [])));
  const conflict = world.repo?.op ?? null;
  const hoverNode = hover ? layout.nodes.find((n) => n.id === hover) : null;

  const summary = describeGraph(layout, world, t);

  if (!world.repo) return <EmptyGraph className={className} kind="no-repo" compact={compact} />;
  if (!layout.nodes.length) return <EmptyGraph className={className} kind="no-commits" branch={layout.headBranch} compact={compact} />;

  return (
    <div
      ref={containerRef}
      className={clsx("relative h-full w-full overflow-hidden touch-none select-none", dragging ? "cursor-grabbing" : !compact && "cursor-grab", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        if (!(e.target as Element).closest("[data-node]")) onSelect?.(null);
      }}
    >
      <svg className="absolute inset-0 h-full w-full" role="img" aria-label={summary}>
        <defs>
          <pattern id="gv-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--border)" />
          </pattern>
        </defs>
        {!compact && <rect width="100%" height="100%" fill="url(#gv-dots)" opacity="0.6" />}
        <g
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformBox: "view-box",
            transformOrigin: "0 0",
            transition: dragging ? "none" : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* edges */}
          <AnimatePresence>
            {layout.edges.map((e) => {
              const a = layout.nodes.find((n) => n.id === e.to)!;
              const b = layout.nodes.find((n) => n.id === e.from)!;
              const d = edgePath(nx(a), ny(a), nx(b), ny(b), !e.primary);
              const ghost = a.orphan || b.orphan;
              return (
                <motion.path
                  key={e.id}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: ghost ? 0.35 : 1, d }}
                  exit={{ opacity: 0, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  fill="none"
                  stroke={laneColor(e.lane)}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={ghost ? "4 6" : undefined}
                />
              );
            })}
          </AnimatePresence>

          {/* in-progress merge: dashed link to the incoming commit */}
          {conflict &&
            (() => {
              const head = layout.nodes.find((n) => n.isHead);
              const theirs = layout.nodes.find((n) => n.id === conflict.theirs);
              if (!head || !theirs) return null;
              const x = nx(head) + COL_W;
              return (
                <g>
                  <path
                    d={`M ${nx(theirs)} ${ny(theirs)} C ${x} ${ny(theirs)} ${x - 20} ${ny(head)} ${x} ${ny(head)}`}
                    className="dash-flow"
                    stroke="var(--bad)"
                    strokeWidth={2.5}
                    strokeDasharray="6 6"
                    fill="none"
                  />
                  <path d={`M ${nx(head)} ${ny(head)} L ${x} ${ny(head)}`} className="dash-flow" stroke="var(--bad)" strokeWidth={2.5} strokeDasharray="6 6" />
                  <circle cx={x} cy={ny(head)} r={R} fill="var(--bad-soft)" stroke="var(--bad)" strokeWidth={2} strokeDasharray="3 3" />
                  <text x={x} y={ny(head) + R + 18} textAnchor="middle" className="fill-bad font-mono text-[11px] font-medium">
                    {conflict.conflicts.length ? t("lab.graph.conflict", { kind: conflict.kind }) : t("lab.graph.ready", { kind: conflict.kind })}
                  </text>
                </g>
              );
            })()}

          {/* nodes */}
          <AnimatePresence>
            {layout.nodes.map((n) => (
              <CommitNode
                key={n.id}
                node={n}
                selected={selected === n.id}
                pulse={pulseIds.has(n.id) ? eventKey : 0}
                rewritten={rebasedNew.has(n.id)}
                onSelect={(id) => onSelect?.(id)}
                onFocusNode={() => focusNode(n)}
                onHover={setHover}
                compact={compact}
                t={t}
              />
            ))}
          </AnimatePresence>

          {/* ref labels (keyed by name so they slide when a branch moves) */}
          <RefLabels layout={layout} t={t} />
        </g>
      </svg>

      {hoverNode && !dragging && (
        <div
          className="pointer-events-none absolute z-10 w-60 rounded-md border border-line bg-elevated p-3 text-xs shadow-[var(--shadow)]"
          style={{
            left: Math.min(size.w - 250, Math.max(8, nx(hoverNode) * view.k + view.x - 120)),
            top: ny(hoverNode) * view.k + view.y + 30 * view.k + 12 > size.h - 110 ? ny(hoverNode) * view.k + view.y - 130 : ny(hoverNode) * view.k + view.y + 28,
          }}
        >
          <p className="font-medium text-fg">{hoverNode.commit.message.split("\n")[0]}</p>
          <p className="mt-1 font-mono text-fg-2">
            {shortId(hoverNode.id)} · {hoverNode.commit.author}
          </p>
          <p className="mt-1 text-fg-3">
            {hoverNode.commit.parents.length === 0 ? t("lab.graph.firstCommit") : hoverNode.merge ? t("lab.graph.mergeCommit") : t("lab.graph.parent", { id: shortId(hoverNode.commit.parents[0]) })}
            {hoverNode.orphan && t("lab.graph.notOnBranch")}
          </p>
        </div>
      )}

      {!compact && (
        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-md border border-line bg-surface p-1 shadow-[var(--shadow)]">
          <GraphBtn label={t("lab.graph.zoomOut")} onClick={() => zoom(0.8)}>
            <Minus className="size-4" />
          </GraphBtn>
          <GraphBtn label={t("lab.graph.zoomIn")} onClick={() => zoom(1.25)}>
            <Plus className="size-4" />
          </GraphBtn>
          <GraphBtn label={t("lab.graph.zoomFit")} onClick={fit}>
            <Maximize2 className="size-4" />
          </GraphBtn>
          <GraphBtn
            label={follow ? t("lab.graph.following") : t("lab.graph.follow")}
            active={follow}
            onClick={() => {
              setFollow(true);
              if (headNode) focusNode(headNode);
            }}
          >
            <Crosshair className="size-4" />
          </GraphBtn>
        </div>
      )}
      <ol className="sr-only">
        {[...layout.nodes].reverse().map((n) => (
          <li key={n.id}>
            {t("lab.graph.srCommit", { id: shortId(n.id), msg: n.commit.message })}
            {n.refs.length ? t("lab.graph.srLabels", { list: n.refs.map((r) => r.name).join(", ") }) : ""}
            {n.isHead ? t("lab.graph.srHead") : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}

function GraphBtn({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx("grid size-8 place-items-center rounded-lg transition-colors pointer-coarse:size-11", active ? "bg-accent-soft text-accent-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
    >
      {children}
    </button>
  );
}

function CommitNode({
  node: n,
  selected,
  pulse,
  rewritten,
  onSelect,
  onFocusNode,
  onHover,
  compact,
  t,
}: {
  node: GraphNode;
  selected: boolean;
  pulse: number;
  rewritten: boolean;
  onSelect: (id: string) => void;
  onFocusNode: () => void;
  onHover: (id: string | null) => void;
  compact?: boolean;
  t: T;
}) {
  const color = laneColor(n.lane);
  const x = nx(n);
  const y = ny(n);
  return (
    <motion.g
      data-node
      initial={{ x, y, scale: 0, opacity: 0 }}
      animate={{ x, y, scale: 1, opacity: n.orphan ? 0.4 : 1 }}
      exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      role="button"
      tabIndex={compact ? -1 : 0}
      aria-label={`${t("lab.graph.nodeLabel", { id: shortId(n.id), msg: n.commit.message })}${n.isHead ? " (HEAD)" : ""}`}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(n.id);
      }}
      onDoubleClick={onFocusNode}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(n.id);
        }
      }}
      onPointerEnter={() => onHover(n.id)}
      onPointerLeave={() => onHover(null)}
      style={{ transformBox: "view-box", transformOrigin: "0 0" }}
      className="cursor-pointer outline-none [&:focus-visible>circle.ring]:opacity-100"
    >
      {pulse > 0 && (
        <circle key={pulse} r={R} fill="none" stroke={color} strokeWidth={3} style={{ animation: "pulse-ring 0.9s ease-out 2", transformOrigin: "center", transformBox: "fill-box" }} />
      )}
      <circle className="ring" r={R + 7} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={selected ? 1 : 0} />
      {n.isHead && <circle r={R + 4} fill="none" stroke="var(--text)" strokeWidth={2} opacity={0.9} />}
      <circle
        r={R}
        fill={n.orphan ? "var(--surface)" : color}
        stroke={n.orphan ? color : "var(--bg)"}
        strokeWidth={n.orphan ? 2 : 3}
        strokeDasharray={n.orphan ? "3 3" : undefined}
      />
      {n.merge && <circle r={4.5} fill="var(--bg)" />}
      {rewritten && <circle r={R + 4} fill="none" stroke="var(--warn)" strokeWidth={1.5} strokeDasharray="2 3" />}
      <text y={R + 18} textAnchor="middle" className="fill-[var(--text-2)] text-[11px] font-medium">
        {trunc(n.commit.message.split("\n")[0], compact ? 16 : 15)}
      </text>
      {!compact && (
        <text y={R + 31} textAnchor="middle" className="fill-[var(--text-3)] font-mono text-[10px]">
          {shortId(n.id)}
        </text>
      )}
      {n.orphan && (
        <text y={-R - 8} textAnchor="middle" className="fill-[var(--text-3)] text-[10px] italic">
          {t("lab.graph.unreachable")}
        </text>
      )}
    </motion.g>
  );
}

function RefLabels({ layout, t }: { layout: GraphLayout; t: T }) {
  const labels: Array<{ key: string; x: number; y: number; text: string; kind: string; current: boolean; lane: number }> = [];
  for (const n of layout.nodes) {
    // current branch first so HEAD sits right above the node
    const refs = [...n.refs].sort((a, b) => Number(!!b.current) - Number(!!a.current) || (a.kind === "head" ? -1 : 0));
    refs.forEach((r, i) => {
      labels.push({ key: `${r.kind}:${r.name}`, x: nx(n), y: ny(n) - R - 18 - i * 24, text: r.name, kind: r.kind, current: !!r.current, lane: n.lane });
    });
  }
  return (
    <AnimatePresence>
      {labels.map((l) => {
        const isRemote = l.kind === "remote";
        const isTag = l.kind === "tag";
        const isHead = l.kind === "head";
        const text = trunc(l.text, 16);
        const w = text.length * 6.6 + (isRemote || isTag ? 30 : 20) + (l.current ? 44 : 0);
        return (
          <motion.g
            key={l.key}
            initial={{ x: l.x, y: l.y - 8, opacity: 0 }}
            animate={{ x: l.x, y: l.y, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            style={{ transformBox: "view-box", transformOrigin: "0 0" }}
            aria-hidden
          >
            <rect
              x={-w / 2}
              y={-11}
              width={w}
              height={22}
              rx={11}
              fill={isRemote ? "var(--surface)" : isTag ? "var(--warn-soft)" : isHead ? "var(--bad-soft)" : "var(--surface-2)"}
              stroke={isTag ? "var(--warn)" : isHead ? "var(--bad)" : laneColor(l.lane)}
              strokeWidth={l.current ? 2 : 1.25}
              strokeDasharray={isRemote ? "3 3" : undefined}
            />
            {l.current && (
              <>
                <rect x={-w / 2 + 3} y={-8} width={40} height={16} rx={8} fill="var(--text)" />
                <text x={-w / 2 + 23} y={4} textAnchor="middle" className="fill-[var(--bg)] font-mono text-[10px] font-bold">
                  HEAD
                </text>
              </>
            )}
            {(isRemote || isTag) && (
              <foreignObject x={-w / 2 + 7} y={-7} width={14} height={14}>
                {isRemote ? <Cloud className="size-3.5 text-fg-2" /> : <Tag className="size-3.5 text-warn" />}
              </foreignObject>
            )}
            <text
              x={(l.current ? 22 : 0) + (isRemote || isTag ? 7 : 0)}
              y={4}
              textAnchor="middle"
              className={clsx("font-mono text-[11px] font-semibold", isHead ? "fill-bad" : isTag ? "fill-warn" : isRemote ? "fill-[var(--text-2)]" : "fill-[var(--text)]")}
            >
              {isHead ? t("lab.graph.headDetached") : text}
            </text>
          </motion.g>
        );
      })}
    </AnimatePresence>
  );
}

function EmptyGraph({ kind, branch, className, compact }: { kind: "no-repo" | "no-commits"; branch?: string | null; className?: string; compact?: boolean }) {
  const t = useT();
  const [repoBefore, repoAfter] = t("lab.graph.noRepoBody").split("{cmd}");
  const [commitsBefore, commitsAfter] = t("lab.graph.noCommitsBody").split("{branch}");
  return (
    <div className={clsx("flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center", className)}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={clsx("grid place-items-center rounded-full border-2 border-dashed", kind === "no-repo" ? "border-line-strong" : "border-accent/60", compact ? "size-12" : "size-16")}
      >
        <GitCommitHorizontal className={clsx(kind === "no-repo" ? "text-fg-3" : "text-accent-fg", compact ? "size-5" : "size-7")} />
      </motion.div>
      <div>
        <p className="text-sm font-medium text-fg">{kind === "no-repo" ? t("lab.graph.noRepo") : t("lab.graph.noCommits")}</p>
        <p className="mt-1 max-w-xs text-xs text-fg-2">
          {kind === "no-repo" ? (
            <>
              {repoBefore}
              <code className="font-mono text-accent-fg">git init</code>
              {repoAfter}
            </>
          ) : (
            <>
              {commitsBefore}
              <span className="font-mono text-fg">{branch}</span>
              {commitsAfter}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function describeGraph(layout: GraphLayout, world: World, t: T): string {
  if (!world.repo) return t("lab.graph.summaryNoRepo");
  const branches = Object.keys(world.repo.branches);
  const head = layout.nodes.find((n) => n.isHead);
  const commits = t(layout.nodes.length === 1 ? "lab.graph.commitsOne" : "lab.graph.commitsOther", { n: layout.nodes.length });
  const branchCount = t(branches.length === 1 ? "lab.graph.branchesOne" : "lab.graph.branchesOther", { n: branches.length });
  const msg = head?.commit.message.split("\n")[0] ?? "";
  const headText = head ? (layout.headBranch ? t("lab.graph.headOn", { branch: layout.headBranch, msg }) : t("lab.graph.headDetachedAt", { msg })) : "";
  return t("lab.graph.summary", { commits, branches: branchCount, list: branches.join(", "), head: headText });
}
