"use client";

import { clsx } from "clsx";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { ArrowRight, Cloud, FileText, FolderOpen, Inbox, Laptop, PackageCheck, X } from "lucide-react";
import { ancestors, headCommit, shortId, status, type Commit, type FileMap, type World } from "@/engine";
import { useT } from "@/i18n";

type NoteKey = "untrackedNoRepo" | "conflict" | "new" | "modified" | "deleted" | "committed" | "onGitHub";

interface Chip {
  path: string;
  tone: "bad" | "warn" | "ok" | "accent" | "info";
  /** Message key under lab.stages.notes. */
  note: NoteKey;
  content?: string;
}

function changedBetween(a: FileMap, b: FileMap) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p]).sort();
}

/** Derive what to show in each conceptual zone from the canonical world. */
function zones(world: World) {
  const repo = world.repo;
  const work: Chip[] = [];
  const stage: Chip[] = [];
  const local: Chip[] = [];
  const remote: Chip[] = [];
  let localCommit: Commit | null = null;
  let remoteCommit: Commit | null = null;
  let unpushed = 0;
  if (!repo) {
    for (const p of Object.keys(world.workdir).sort()) work.push({ path: p, tone: "info", note: "untrackedNoRepo", content: world.workdir[p] });
    return { work, stage, local, remote, localCommit, remoteCommit, unpushed, hasRemote: false };
  }
  const st = status(world);
  for (const e of st) {
    if (e.conflicted) work.push({ path: e.path, tone: "bad", note: "conflict", content: world.workdir[e.path] });
    else if (e.untracked) work.push({ path: e.path, tone: "bad", note: "new", content: world.workdir[e.path] });
    else if (e.unstaged) work.push({ path: e.path, tone: "warn", note: e.unstaged, content: world.workdir[e.path] });
    if (e.staged && !e.conflicted) stage.push({ path: e.path, tone: "ok", note: e.staged === "added" ? "new" : e.staged, content: repo.index[e.path] });
  }
  localCommit = headCommit(repo);
  const upstreamRef = repo.head.kind === "branch" ? repo.upstream[repo.head.name] : undefined;
  const remoteId = upstreamRef ? repo.remoteRefs[upstreamRef] : Object.values(repo.remoteRefs)[0];
  const hasRemote = Object.keys(repo.remotes).length > 0;
  remoteCommit = remoteId ? repo.commits[remoteId] : null;
  const taken = new Set([...work, ...stage].map((c) => c.path));
  if (localCommit) {
    const remoteAnc = remoteId ? ancestors(repo, remoteId) : new Set<string>();
    const unpushedIds = [...ancestors(repo, localCommit.id)].filter((id) => !remoteAnc.has(id));
    unpushed = hasRemote ? unpushedIds.length : 0;
    // files changed by commits not yet on the remote (or by the last commit)
    const paths = new Set<string>();
    const ids = hasRemote ? unpushedIds : [localCommit.id];
    for (const id of ids) {
      const c = repo.commits[id];
      const parent = c.parents[0] ? repo.commits[c.parents[0]].tree : {};
      for (const p of changedBetween(parent, c.tree)) paths.add(p);
    }
    for (const p of [...paths].sort())
      if (!taken.has(p)) local.push({ path: p, tone: "accent", note: localCommit.tree[p] === undefined ? "deleted" : "committed", content: localCommit.tree[p] });
  }
  if (remoteCommit) {
    const parent = remoteCommit.parents[0] ? repo.commits[remoteCommit.parents[0]]?.tree ?? {} : {};
    const takenAll = new Set([...taken, ...local.map((c) => c.path)]);
    for (const p of changedBetween(parent, remoteCommit.tree)) if (!takenAll.has(p)) remote.push({ path: p, tone: "info", note: "onGitHub", content: remoteCommit.tree[p] });
  }
  return { work, stage, local, remote, localCommit, remoteCommit, unpushed, hasRemote };
}

const TONE: Record<Chip["tone"], string> = {
  bad: "border-bad/40 bg-bad-soft text-bad",
  warn: "border-warn/40 bg-warn-soft text-warn",
  ok: "border-ok/40 bg-ok-soft text-ok",
  accent: "border-accent/40 bg-accent-soft text-accent-fg",
  info: "border-info/40 bg-info-soft text-info",
};

export function StagesVisualizer({ world, showRemote = true, className }: { world: World; showRemote?: boolean; className?: string }) {
  const z = useMemo(() => zones(world), [world]);
  const [inspect, setInspect] = useState<{ zone: string; chip: Chip } | null>(null);
  const isOpen = (zone: string, path: string) => inspect?.zone === zone && inspect.chip.path === path;
  const group = useId();
  const t = useT();
  const nFiles = Object.keys(world.workdir).length;
  const cols: Array<{ id: string; title: string; icon: React.ReactNode; chips: Chip[]; empty: string; foot?: string; arrow?: string }> = [
    {
      id: "work",
      title: t("lab.stages.work"),
      icon: <FolderOpen className="size-4" />,
      chips: z.work,
      empty: world.repo ? t("lab.stages.noChanges") : t("lab.stages.emptyFolder"),
      foot: t(nFiles === 1 ? "lab.stages.filesOnDiskOne" : "lab.stages.filesOnDiskOther", { n: nFiles }),
      arrow: "git add",
    },
    {
      id: "stage",
      title: t("lab.stages.stage"),
      icon: <Inbox className="size-4" />,
      chips: z.stage,
      empty: world.repo ? t("lab.stages.nothingStaged") : t("lab.stages.needsInit"),
      foot: t("lab.stages.nextSnapshot"),
      arrow: "git commit",
    },
    {
      id: "local",
      title: t("lab.stages.local"),
      icon: <Laptop className="size-4" />,
      chips: z.local,
      empty: z.localCommit ? t("lab.stages.upToDate") : t("lab.stages.noCommits"),
      foot: z.localCommit ? `HEAD · ${shortId(z.localCommit.id)}${z.unpushed ? ` · ${t("lab.stages.notPushed", { n: z.unpushed })}` : ""}` : undefined,
      arrow: showRemote ? "git push" : undefined,
    },
  ];
  if (showRemote)
    cols.push({
      id: "remote",
      title: t("lab.stages.remote"),
      icon: <Cloud className="size-4" />,
      chips: z.remote,
      empty: z.hasRemote ? (z.remoteCommit ? t("lab.stages.inSync") : t("lab.stages.nothingPushed")) : t("lab.stages.noRemote"),
      foot: z.remoteCommit ? `origin · ${shortId(z.remoteCommit.id)}` : undefined,
    });

  return (
    <div className={clsx("relative", className)}>
      <LayoutGroup id={group}>
        <div className={clsx("grid gap-2", showRemote ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
          {cols.map((col) => (
            <div key={col.id} className="relative flex min-h-36 min-w-0 flex-col rounded-lg border border-line bg-surface-2/60 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
                <span className="text-fg-3">{col.icon}</span>
                <span className="truncate">{col.title}</span>
              </div>
              <div className="mt-2 flex flex-1 flex-col gap-1.5">
                <AnimatePresence mode="popLayout">
                  {col.chips.map((c) => (
                    <motion.button
                      key={c.path}
                      layoutId={`chip-${c.path}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      onClick={() => setInspect(isOpen(col.title, c.path) ? null : { zone: col.title, chip: c })}
                      aria-expanded={isOpen(col.title, c.path)}
                      className={clsx(
                        "flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-xs transition-shadow",
                        TONE[c.tone],
                        isOpen(col.title, c.path) && "ring-2 ring-accent-mark/60",
                      )}
                      title={t("lab.stages.inspect", { path: c.path, zone: col.title })}
                    >
                      <FileText className="size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate font-mono">{c.path}</span>
                      <span className="ml-auto shrink-0 text-[11px] opacity-80">{t(`lab.stages.notes.${c.note}`)}</span>
                    </motion.button>
                  ))}
                </AnimatePresence>
                {!col.chips.length && <p className="my-auto text-center text-[11px] text-fg-3">{col.empty}</p>}
              </div>
              {col.foot && <p className="mt-2 truncate font-mono text-[11px] text-fg-3">{col.foot}</p>}
              {col.arrow && (
                <span className="pointer-events-none absolute top-1/2 -right-2 z-[1] hidden -translate-y-1/2 sm:block" aria-hidden>
                  <span className="grid size-4 place-items-center rounded-full border border-line bg-surface text-fg-3">
                    <ArrowRight className="size-2.5" />
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      </LayoutGroup>
      <div className="mt-1.5 hidden justify-around font-mono text-[11px] text-fg-3 sm:flex" aria-hidden>
        {cols.slice(0, -1).map((c) => (
          <span key={c.id}>{c.arrow} →</span>
        ))}
      </div>
      {/* Inline preview below the zones, so it never covers them. */}
      <AnimatePresence initial={false}>
        {inspect && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-2 max-h-48 overflow-auto rounded-lg border border-line bg-elevated p-3 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-2">
              <PackageCheck className="size-4 text-accent-fg" />
              <p className="text-xs">
                <span className="font-mono font-medium">{inspect.chip.path}</span>
                <span className="text-fg-3">{t("lab.stages.inZone", { zone: inspect.zone })}</span>
              </p>
              <button className="ml-auto rounded-md p-1 text-fg-3 hover:text-fg" onClick={() => setInspect(null)} aria-label={t("lab.stages.closeInspector")}>
                <X className="size-3.5" />
              </button>
            </div>
            <pre className="mt-2 rounded-lg bg-surface-2 p-2 font-mono text-[12px] whitespace-pre-wrap text-fg-2">
              {inspect.chip.content === undefined ? t("lab.stages.fileDeleted") : inspect.chip.content || t("lab.stages.emptyFile")}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
