"use client";

import { clsx } from "clsx";
import { Cloud, GitBranch, GitCommitHorizontal, GitMerge, MousePointerClick, Tag } from "lucide-react";
import { ancestors, shortId, type World } from "@/engine";
import { DiffBlock } from "./editor";
import { useLab } from "./store";

export function CommitInspector() {
  const world = useLab((s) => s.world);
  const selected = useLab((s) => s.selectedCommit);
  const select = useLab((s) => s.selectCommit);
  const repo = world.repo;
  const c = selected && repo ? repo.commits[selected] : null;
  if (!c || !repo)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-fg-3">
        <MousePointerClick className="size-6" />
        Click a commit in the graph to inspect it.
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
        <dt className="text-fg-3">Author</dt>
        <dd>{c.author}</dd>
        <dt className="text-fg-3">Parents</dt>
        <dd className="flex flex-wrap gap-1">
          {c.parents.length ? (
            c.parents.map((p) => (
              <button key={p} onClick={() => select(p)} className="rounded-md bg-surface-2 px-1.5 font-mono text-[11px] text-accent-fg hover:bg-elevated">
                {shortId(p)}
              </button>
            ))
          ) : (
            <span className="text-fg-3">none — the first commit</span>
          )}
        </dd>
        <dt className="text-fg-3">On branches</dt>
        <dd className="flex flex-wrap gap-1">
          {onBranches.length ? (
            onBranches.map((b) => (
              <span key={b} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 font-mono text-[11px]">
                <GitBranch className="size-3" />
                {b}
              </span>
            ))
          ) : (
            <span className="text-warn">no branch (unreachable — find it in git reflog)</span>
          )}
        </dd>
      </dl>
      {c.message.includes("\n") && <p className="mt-3 rounded-lg bg-surface-2 p-2 text-xs whitespace-pre-wrap text-fg-2">{c.message}</p>}
      <h4 className="mt-4 mb-2 text-[11px] font-semibold text-fg-3 ">
        {c.parents.length > 1 ? "Snapshot files" : `Changed files (${files.length})`}
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
  const remotes = repo ? Object.entries(repo.remotes) : [];
  if (!remotes.length)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-fg-3">
        <Cloud className="size-6" />
        No remote connected. Link one with <code className="font-mono text-fg-2">git remote add origin &lt;url&gt;</code>.
        {Object.keys(world.hosted).length > 0 && (
          <span className="mt-2 rounded-lg bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-2">Available: {Object.keys(world.hosted).join(", ")}</span>
        )}
      </div>
    );
  return (
    <div className="scrollbar-thin h-full space-y-4 overflow-y-auto p-3">
      <p className="rounded-lg border border-dashed border-line px-2 py-1.5 text-[11px] text-fg-3">
        Simulated GitHub — part of the learning environment. Nothing is sent over the internet.
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
          <section key={name} className="overflow-hidden rounded-lg border border-line">
            <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
              <Cloud className="size-4 text-info" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {host.owner}/<span className="font-semibold">{host.name}</span>
                </p>
                <p className="truncate font-mono text-[11px] text-fg-3">
                  {name} → {url}
                </p>
              </div>
            </header>
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-fg-3 ">Branches on GitHub</p>
              {Object.keys(host.branches).length ? (
                <ul className="mt-1.5 space-y-1">
                  {Object.entries(host.branches).map(([b, id]) => {
                    const local = repo!.branches[b];
                    const sync = !local ? "not local" : local === id ? "in sync" : ancestors(repo!, local).has(id) ? "you're ahead" : "behind / diverged";
                    return (
                      <li key={b} className="flex items-center gap-2 text-xs">
                        <GitBranch className="size-3.5 text-fg-3" />
                        <span className="font-mono">{b}</span>
                        <span className="font-mono text-[11px] text-fg-3">{shortId(id)}</span>
                        <span className={clsx("ml-auto rounded-md px-1.5 py-px text-[11px]", sync === "in sync" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{sync}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-fg-3">Empty repository — push to publish your commits.</p>
              )}
            </div>
            {Object.keys(host.tags ?? {}).length > 0 && (
              <div className="border-t border-line px-3 py-2">
                <p className="text-[11px] font-semibold text-fg-3">Tags on GitHub</p>
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
                <p className="text-[11px] font-semibold text-fg-3 ">Commits on {host.defaultBranch}</p>
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
        );
      })}
    </div>
  );
}
