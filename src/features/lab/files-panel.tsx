"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { FilePlus2, FileText, Minus, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { status, type StatusEntry, type World } from "@/engine";
import { useLab } from "./store";

export type FileState = "untracked" | "modified" | "staged" | "staged-modified" | "conflict" | "deleted" | "clean" | "new-staged";

export function fileStates(world: World): Map<string, FileState> {
  const map = new Map<string, FileState>();
  const entries = status(world);
  const byPath = new Map<string, StatusEntry>(entries.map((e) => [e.path, e]));
  const paths = new Set([...Object.keys(world.workdir), ...entries.map((e) => e.path)]);
  for (const p of paths) {
    const e = byPath.get(p);
    if (!world.repo) map.set(p, "untracked");
    else if (!e) map.set(p, "clean");
    else if (e.conflicted) map.set(p, "conflict");
    else if (e.untracked) map.set(p, "untracked");
    else if (e.unstaged === "deleted" || (e.staged === "deleted" && !(p in world.workdir))) map.set(p, "deleted");
    else if (e.staged && e.unstaged) map.set(p, "staged-modified");
    else if (e.staged === "added") map.set(p, "new-staged");
    else if (e.staged) map.set(p, "staged");
    else map.set(p, "modified");
  }
  return map;
}

export const STATE_META: Record<FileState, { letter: string; label: string; cls: string; help: string }> = {
  untracked: { letter: "U", label: "new · untracked", cls: "text-coral bg-coral-soft", help: "Git has never saved this file. Stage it with git add." },
  modified: { letter: "M", label: "modified", cls: "text-amber bg-amber-soft", help: "Changed since the last commit, not staged yet." },
  staged: { letter: "S", label: "staged", cls: "text-mint bg-mint-soft", help: "This change will be in the next commit." },
  "new-staged": { letter: "A", label: "new · staged", cls: "text-mint bg-mint-soft", help: "A new file that will be added in the next commit." },
  "staged-modified": { letter: "M", label: "staged + edited", cls: "text-amber bg-amber-soft", help: "Part of this file is staged; newer edits aren't." },
  conflict: { letter: "C", label: "conflict", cls: "text-coral bg-coral-soft ring-1 ring-coral/50", help: "Both branches changed this file. Resolve it, then git add." },
  deleted: { letter: "D", label: "deleted", cls: "text-coral bg-coral-soft", help: "Removed from your folder." },
  clean: { letter: "", label: "saved", cls: "text-fg-3", help: "Identical to the last commit." },
};

export function StateBadge({ state, compact }: { state: FileState; compact?: boolean }) {
  const m = STATE_META[state];
  if (state === "clean") return null;
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px text-[10px] font-semibold", m.cls)} title={m.help}>
      <span className="font-mono">{m.letter}</span>
      {!compact && <span className="font-medium">{m.label}</span>}
    </span>
  );
}

export function FilesPanel({ onOpen }: { onOpen?: (path: string) => void }) {
  const world = useLab((s) => s.world);
  const run = useLab((s) => s.run);
  const writeFile = useLab((s) => s.writeFile);
  const deleteFile = useLab((s) => s.deleteFile);
  const renameFile = useLab((s) => s.renameFile);
  const openFile = useLab((s) => s.openFile);
  const setOpenFile = useLab((s) => s.setOpenFile);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");

  const states = useMemo(() => fileStates(world), [world]);
  const paths = [...states.keys()].sort();

  const open = (p: string) => {
    setOpenFile(p);
    onOpen?.(p);
  };

  const create = () => {
    const name = newName.trim();
    if (name && !(name in world.workdir)) {
      writeFile(name, "");
      open(name);
    }
    setCreating(false);
    setNewName("");
  };

  const counts = { changed: 0, staged: 0 };
  for (const s of states.values()) {
    if (["untracked", "modified", "deleted", "conflict", "staged-modified"].includes(s)) counts.changed++;
    if (["staged", "new-staged", "staged-modified"].includes(s)) counts.staged++;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-fg-3 uppercase">Project files</p>
          <p className="text-[11px] text-fg-3">
            {world.repo ? `${counts.changed} changed · ${counts.staged} staged` : "Not a Git repository yet"}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs text-fg-2 hover:border-line-strong hover:text-fg"
        >
          <FilePlus2 className="size-3.5" /> New file
        </button>
      </div>
      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Files">
        <AnimatePresence initial={false}>
          {creating && (
            <motion.li initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="px-1 py-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  create();
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.replace(/\s/g, ""))}
                  onBlur={() => !newName && setCreating(false)}
                  onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
                  placeholder="file name, e.g. README.md"
                  className="min-w-0 flex-1 rounded-lg border border-violet/60 bg-surface-2 px-2 py-1 font-mono text-xs outline-none"
                  aria-label="New file name"
                />
                <button type="submit" className="rounded-lg bg-violet px-2 py-1 text-xs text-white" aria-label="Create file">
                  <Check className="size-3.5" />
                </button>
              </form>
            </motion.li>
          )}
          {paths.map((p) => {
            const st = states.get(p)!;
            const canStage = world.repo && ["untracked", "modified", "deleted", "conflict", "staged-modified"].includes(st);
            const canUnstage = world.repo && ["staged", "new-staged", "staged-modified"].includes(st);
            const exists = p in world.workdir;
            return (
              <motion.li
                key={p}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className={clsx(
                  "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                  openFile === p ? "bg-violet-soft" : "hover:bg-surface-2",
                )}
              >
                {renaming === p ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      renameFile(p, renameTo.trim());
                      setRenaming(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={renameTo}
                      onChange={(e) => setRenameTo(e.target.value.replace(/\s/g, ""))}
                      onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                      className="min-w-0 flex-1 rounded-md border border-violet/60 bg-surface-2 px-1.5 py-0.5 font-mono text-xs outline-none"
                      aria-label={`Rename ${p}`}
                    />
                    <button type="button" onClick={() => setRenaming(null)} aria-label="Cancel rename" className="text-fg-3">
                      <X className="size-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    className={clsx("flex min-w-0 flex-1 items-center gap-2 text-left", !exists && "line-through opacity-60")}
                    onClick={() => exists && open(p)}
                    disabled={!exists}
                  >
                    <FileText className={clsx("size-4 shrink-0", st === "clean" ? "text-fg-3" : "text-fg-2")} aria-hidden />
                    <span className="truncate font-mono text-[13px]">{p}</span>
                  </button>
                )}
                <StateBadge state={st} compact />
                <span className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {canStage && (
                    <RowBtn label={`Stage ${p} (git add)`} onClick={() => run(`git add ${p}`)}>
                      <Plus className="size-3.5" />
                    </RowBtn>
                  )}
                  {canUnstage && (
                    <RowBtn label={`Unstage ${p} (git restore --staged)`} onClick={() => run(world.repo && Object.keys(world.repo.commits).length ? `git restore --staged ${p}` : `git rm --cached ${p}`)}>
                      <Minus className="size-3.5" />
                    </RowBtn>
                  )}
                  {exists && (
                    <>
                      <RowBtn
                        label={`Rename ${p}`}
                        onClick={() => {
                          setRenaming(p);
                          setRenameTo(p);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </RowBtn>
                      <RowBtn label={`Delete ${p}`} onClick={() => deleteFile(p)}>
                        <Trash2 className="size-3.5" />
                      </RowBtn>
                    </>
                  )}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {!paths.length && !creating && (
          <li className="px-3 py-6 text-center text-xs text-fg-3">This folder is empty. Create a file to get started.</li>
        )}
      </ul>
      <Legend />
    </div>
  );
}

function RowBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-elevated hover:text-fg">
      {children}
    </button>
  );
}

function Legend() {
  return (
    <details className="border-t border-line px-3 py-2 text-[11px] text-fg-3">
      <summary className="cursor-pointer select-none hover:text-fg-2">What do the badges mean?</summary>
      <ul className="mt-2 space-y-1.5">
        {(["untracked", "modified", "new-staged", "staged", "conflict", "deleted"] as FileState[]).map((s) => (
          <li key={s} className="flex items-start gap-2">
            <StateBadge state={s} />
            <span>{STATE_META[s].help}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
