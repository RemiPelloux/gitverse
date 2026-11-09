"use client";

import { clsx } from "clsx";
import { useMemo } from "react";
import { BookMarked, Cloud, GitBranch, GitCommitHorizontal, GitMerge, MousePointerClick, Tag } from "lucide-react";
import { ancestors, layoutGraph, shortId, type World } from "@/engine";
import { DiffBlock } from "./editor";
import { laneColor } from "./git-graph";
import { GitHubSections, ProtectedBadge } from "./github-panel";
import { useT } from "@/i18n";
import { useLab } from "./store";

export function CommitInspector() {
  const world = useLab((s) => s.world);
  const selected = useLab((s) => s.selectedCommit);
  const select = useLab((s) => s.selectCommit);
  const t = useT();
  const repo = world.repo;
  const c = selected && repo ? repo.commits[selected] : null;
  if (!c || !repo)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-fg-3">
        <MousePointerClick className="size-6" />
        {t("lab.inspector.clickCommit")}
      </div>
    );
  const parent = c.parents[0] ? repo.commits[c.parents[0]] : null;
  const files = [...new Set([...Object.keys(parent?.tree ?? {}), ...Object.keys(c.tree)])].filter((p) => parent?.tree[p] !== c.tree[p]).sort();
  const onBranches = Object.entries(repo.branches)
    .filter(([, id]) => ancestors(repo, id).has(c.id))
    .map(([b]) => b);
  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-3">
      <div className="flex items-start gap-2">
        <span className={clsx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", c.parents.length > 1 ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent-fg")}>
          {c.parents.length > 1 ? <GitMerge className="size-4" /> : <GitCommitHorizontal className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="font-medium">{c.message.split("\n")[0]}</p>
          <p className="font-mono text-[11px] text-fg-3">{c.id}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-fg-3">{t("lab.inspector.author")}</dt>
        <dd>{c.author}</dd>
        <dt className="text-fg-3">{t("lab.inspector.parents")}</dt>
        <dd className="flex flex-wrap gap-1">
          {c.parents.length ? (
            c.parents.map((p) => (
              <button key={p} onClick={() => select(p)} className="rounded-md bg-surface-2 px-1.5 font-mono text-[11px] text-accent-fg hover:bg-elevated">
                {shortId(p)}
              </button>
            ))
          ) : (
            <span className="text-fg-3">{t("lab.inspector.noParent")}</span>
          )}
        </dd>
        <dt className="text-fg-3">{t("lab.inspector.onBranches")}</dt>
        <dd className="flex flex-wrap gap-1">
          {onBranches.length ? (
            onBranches.map((b) => (
              <span key={b} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 font-mono text-[11px]">
                <GitBranch className="size-3" />
                {b}
              </span>
            ))
          ) : (
            <span className="text-warn">{t("lab.inspector.noBranch")}</span>
          )}
        </dd>
      </dl>
      {c.message.includes("\n") && <p className="mt-3 rounded-lg bg-surface-2 p-2 text-xs whitespace-pre-wrap text-fg-2">{c.message}</p>}
      <h4 className="mt-4 mb-2 text-[11px] font-semibold text-fg-3 ">
        {c.parents.length > 1 ? t("lab.inspector.snapshotFiles") : t("lab.inspector.changedFiles", { n: files.length })}
      </h4>
      <div className="space-y-3">
        {c.parents.length > 1 ? (
          <ul className="space-y-1 font-mono text-xs text-fg-2">
            {Object.keys(c.tree).sort().map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          files.map((p) => (
            <div key={p}>
              <p className="mb-1 font-mono text-xs">{p}</p>
              <DiffBlock title="" from={parent?.tree[p]} to={c.tree[p]} empty="" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RemotePanel() {
  const world = useLab((s) => s.world);
  return <RemoteView world={world} />;
}

export function RemoteView({ world }: { world: World }) {
  const repo = world.repo;
  const remotes = repo ? Object.entries(repo.remotes).sort(([a], [b]) => (a === "origin" ? -1 : b === "origin" ? 1 : a.localeCompare(b))) : [];
  const t = useT();
  const lanes = useBranchLanes(world);
  // Two remotes can point at the same repo: show its GitHub sections once.
  const githubFor = new Map<string, string>();
  for (const [name, url] of remotes) if (!githubFor.has(url)) githubFor.set(url, name);
  if (!remotes.length) {
    const [before, after] = t("lab.inspector.noRemote").split("{cmd}");
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-fg-3">
        <Cloud className="size-6" />
        {before}
        <code className="font-mono text-fg-2">git remote add origin &lt;url&gt;</code>
        {after}
        {Object.keys(world.hosted).length > 0 && (
          <span className="mt-2 rounded-lg bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-2">{t("lab.inspector.available", { list: Object.keys(world.hosted).join(", ") })}</span>
        )}
      </div>
    );
  }
  return (
    <div className="scrollbar-thin h-full space-y-4 overflow-y-auto p-3">
      <p className="rounded-lg border border-dashed border-line px-2 py-1.5 text-[11px] text-fg-3">
        {t("lab.inspector.simulated")}
      </p>
      {remotes.map(([name, url]) => {
        const host = world.hosted[url];
        if (!host) return null;
        const def = host.branches[host.defaultBranch];
        const log: string[] = [];
        let cur: string | undefined = def;
        while (cur && log.length < 8) {
          log.push(cur);
          cur = world.hostedCommits[cur]?.parents[0];
        }
        return (
          <div key={name} className="space-y-3">
          <section className="overflow-hidden rounded-lg border border-line">
            <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
              <BookMarked className="size-4 shrink-0 text-fg-2" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="text-fg-2">{host.owner}</span>
                  <span className="text-fg-3"> / </span>
                  <span className="font-semibold">{host.name}</span>
                </p>
                <p className="truncate font-mono text-[11px] text-fg-3">
                  {name} → {url}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-fg-2" title={t("lab.github.defaultBranch")}>
                <GitBranch className="size-3" />
                {host.defaultBranch}
              </span>
            </header>
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-fg-3 ">{t("lab.inspector.branchesOnGitHub")}</p>
              {Object.keys(host.branches).length ? (
                <ul className="mt-1.5 space-y-1">
                  {Object.entries(host.branches).map(([b, id]) => {
                    const local = repo!.branches[b];
                    const sync = !local ? "notLocal" : local === id ? "inSync" : ancestors(repo!, local).has(id) ? "ahead" : "behind";
                    return (
                      <li key={b} className="flex items-center gap-2 text-xs">
                        <GitBranch className="size-3.5 shrink-0" style={{ color: lanes.has(b) ? laneColor(lanes.get(b)!) : "var(--text-3)" }} />
                        <span className="min-w-0 truncate font-mono">{b}</span>
                        {host.protection?.[b] && <ProtectedBadge rule={host.protection[b]} />}
                        <span className="font-mono text-[11px] text-fg-3">{shortId(id)}</span>
                        <span className={clsx("ml-auto rounded-md px-1.5 py-px text-[11px]", sync === "inSync" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{t(`lab.inspector.${sync}`)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-fg-3">{t("lab.inspector.emptyRepo")}</p>
              )}
            </div>
            {Object.keys(host.tags ?? {}).length > 0 && (
              <div className="border-t border-line px-3 py-2">
                <p className="text-[11px] font-semibold text-fg-3">{t("lab.inspector.tagsOnGitHub")}</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(host.tags!).map(([t, id]) => (
                    <li key={t} className="flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 font-mono text-[11px] text-warn" title={shortId(id)}>
                      <Tag className="size-3" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {log.length > 0 && (
              <div className="border-t border-line px-3 py-2">
                <p className="text-[11px] font-semibold text-fg-3 ">{t("lab.inspector.commitsOn", { branch: host.defaultBranch })}</p>
                <ol className="mt-1.5 space-y-1.5">
                  {log.map((id) => {
                    const c = world.hostedCommits[id];
                    return (
                      <li key={id} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-[11px] text-info">{shortId(id)}</span>
                        <span className="min-w-0 truncate">{c.message.split("\n")[0]}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-fg-3">{c.author}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>
          {githubFor.get(url) === name && <GitHubSections host={host} />}
          </div>
        );
      })}
    </div>
  );
}

/** Branch name -> graph lane, so branch icons here match the colors in the commit graph. */
function useBranchLanes(world: World) {
  return useMemo(() => {
    const map = new Map<string, number>();
    const repo = world.repo;
    if (!repo) return map;
    const laneOf = new Map(layoutGraph(world).nodes.map((n) => [n.id, n.lane]));
    for (const [b, id] of Object.entries(repo.branches)) if (laneOf.has(id)) map.set(b, laneOf.get(id)!);
    for (const [ref, id] of Object.entries(repo.remoteRefs)) {
      const b = ref.slice(ref.indexOf("/") + 1);
      if (!map.has(b) && laneOf.has(id)) map.set(b, laneOf.get(id)!);
    }
    return map;
  }, [world]);
}
