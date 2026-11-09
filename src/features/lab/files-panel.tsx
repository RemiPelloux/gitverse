"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { FilePlus2, FileText, Minus, MousePointerClick, Plus, SquarePen, TextCursorInput, Trash2, Check, X } from "lucide-react";
import { status, type StatusEntry, type World } from "@/engine";
import { useT, type T } from "@/i18n";
import { useHydrated } from "@/components/ui/misc";
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

export const STATE_META: Record<FileState, { letter: string; key: StateKey; cls: string }> = {
  untracked: { letter: "U", key: "untracked", cls: "text-bad bg-bad-soft" },
  modified: { letter: "M", key: "modified", cls: "text-warn bg-warn-soft" },
  staged: { letter: "S", key: "staged", cls: "text-ok bg-ok-soft" },
  "new-staged": { letter: "A", key: "newStaged", cls: "text-ok bg-ok-soft" },
  "staged-modified": { letter: "M", key: "stagedModified", cls: "text-warn bg-warn-soft" },
  conflict: { letter: "C", key: "conflict", cls: "text-bad bg-bad-soft ring-1 ring-bad/50" },
  deleted: { letter: "D", key: "deleted", cls: "text-bad bg-bad-soft" },
  clean: { letter: "", key: "clean", cls: "text-fg-3" },
};

type StateKey = "untracked" | "modified" | "staged" | "newStaged" | "stagedModified" | "conflict" | "deleted" | "clean";

/** Translated label and help text for a file state. */
export function stateText(t: T, state: FileState) {
  const k = STATE_META[state].key;
  return { label: t(`lab.files.states.${k}.label`), help: t(`lab.files.states.${k}.help`) };
}

export function StateBadge({ state, compact }: { state: FileState; compact?: boolean }) {
  const t = useT();
  const m = STATE_META[state];
  if (state === "clean") return null;
  const text = stateText(t, state);
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-semibold", m.cls)} title={text.help}>
      <span className="font-mono">{m.letter}</span>
      {!compact && <span className="font-medium">{text.label}</span>}
    </span>
  );
}

const TIP_KEY = "gv-tip-edit-seen";
function readTipSeen() {
  try {
    return localStorage.getItem(TIP_KEY) === "1";
  } catch {
    return false;
  }
}

/** The file a lesson step wants the learner to edit (or create): it gets a pulsing "click me" spotlight. */
export interface Spotlight {
  path: string;
  kind: "edit-file" | "create-file";
}

export function FilesPanel({ onOpen, editable = true, spotlight }: { onOpen?: (path: string) => void; editable?: boolean; spotlight?: Spotlight | null }) {
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
  const t = useT();

  const states = useMemo(() => fileStates(world), [world]);
  const paths = [...states.keys()].sort();
  // "Click a file to edit it" stays until the learner has opened a file once.
  const hydrated = useHydrated();
  const [openedOnce, setOpenedOnce] = useState(false);
  const tipSeen = !hydrated || openedOnce || readTipSeen();
  const spotPath = spotlight && spotlight.kind === "edit-file" && spotlight.path in world.workdir ? spotlight.path : null;
  const spotNew = !!spotlight && spotlight.kind === "create-file" && !(spotlight.path in world.workdir);

  const open = (p: string) => {
    setOpenFile(p);
    onOpen?.(p);
    if (!tipSeen) {
      setOpenedOnce(true);
      try {
        localStorage.setItem(TIP_KEY, "1");
      } catch {
        /* storage unavailable */
      }
    }
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
          <p className="text-xs font-semibold text-fg-3 ">{t("lab.files.title")}</p>
          <p className="text-[11px] text-fg-3">
            {world.repo ? t("lab.files.counts", { changed: counts.changed, staged: counts.staged }) : t("lab.files.noRepo")}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className={clsx(
            "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs hover:text-fg",
            spotNew ? "spotlight border-accent bg-accent-soft font-medium text-accent-fg" : "border-line text-fg-2 hover:border-line-strong",
          )}
        >
          <FilePlus2 className="size-3.5" /> {t("lab.files.newFile")}
        </button>
      </div>
      {editable && paths.length > 0 && (!tipSeen || spotPath) && (
        <p className={clsx("mx-3 mb-2 flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs", spotPath ? "bg-accent-soft text-fg" : "bg-info-soft text-fg-2")}>
          <MousePointerClick className={clsx("mt-px size-4 shrink-0", spotPath ? "text-accent-fg" : "text-info")} aria-hidden />
          <span>{spotPath ? t("lab.files.spotlight", { path: spotPath }) : t("lab.files.tip")}</span>
        </p>
      )}
      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label={t("lab.files.listLabel")}>
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
                  placeholder={t("lab.files.placeholder")}
                  className="min-w-0 flex-1 rounded-lg border border-accent/60 bg-surface-2 px-2 py-1 font-mono text-xs outline-none"
                  aria-label={t("lab.files.newFileName")}
                />
                <button type="submit" className="rounded-lg bg-accent px-2 py-1 text-xs text-white" aria-label={t("lab.files.createFile")}>
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
                  "group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                  openFile === p ? "bg-accent-soft" : "hover:bg-surface-2",
                  spotPath === p && "spotlight bg-accent-soft",
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
                      className="min-w-0 flex-1 rounded-md border border-accent/60 bg-surface-2 px-1.5 py-0.5 font-mono text-xs outline-none"
                      aria-label={t("lab.files.rename", { path: p })}
                    />
                    <button type="button" onClick={() => setRenaming(null)} aria-label={t("lab.files.cancelRename")} className="text-fg-3">
                      <X className="size-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    className={clsx("flex min-w-0 flex-1 items-center gap-2 text-left", !exists && "line-through opacity-60")}
                    onClick={() => exists && open(p)}
                    disabled={!exists}
                    title={exists && editable ? t("lab.files.clickToEdit", { path: p }) : undefined}
                  >
                    <FileText className={clsx("size-4 shrink-0", st === "clean" ? "text-fg-3" : "text-fg-2")} aria-hidden />
                    <span className="truncate font-mono text-[13px]">{p}</span>
                    {exists && editable && (
                      <span
                        className={clsx(
                          "ml-auto flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-medium",
                          spotPath === p ? "bg-accent text-white" : "text-fg-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:hidden",
                        )}
                      >
                        <SquarePen className="size-3" aria-hidden /> {t("lab.files.edit")}
                      </span>
                    )}
                  </button>
                )}
                <StateBadge state={st} compact />
                <span className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {canStage && (
                    <RowBtn label={t("lab.files.stage", { path: p })} onClick={() => run(`git add ${p}`)}>
                      <Plus className="size-3.5" />
                    </RowBtn>
                  )}
                  {canUnstage && (
                    <RowBtn label={t("lab.files.unstage", { path: p })} onClick={() => run(world.repo && Object.keys(world.repo.commits).length ? `git restore --staged ${p}` : `git rm --cached ${p}`)}>
                      <Minus className="size-3.5" />
                    </RowBtn>
                  )}
                  {exists && (
                    <>
                      <RowBtn
                        label={t("lab.files.rename", { path: p })}
                        onClick={() => {
                          setRenaming(p);
                          setRenameTo(p);
                        }}
                      >
                        <TextCursorInput className="size-3.5" />
                      </RowBtn>
                      <RowBtn label={t("lab.files.delete", { path: p })} onClick={() => deleteFile(p)}>
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
          <li className="px-3 py-6 text-center text-xs text-fg-3">{t("lab.files.empty")}</li>
        )}
      </ul>
      <Legend />
    </div>
  );
}

function RowBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-elevated hover:text-fg pointer-coarse:size-10">
      {children}
    </button>
  );
}

function Legend() {
  const t = useT();
  return (
    <details className="border-t border-line px-3 py-2 text-[11px] text-fg-3">
      <summary className="cursor-pointer select-none hover:text-fg-2">{t("lab.files.legend")}</summary>
      <ul className="mt-2 space-y-1.5">
        {(["untracked", "modified", "new-staged", "staged", "conflict", "deleted"] as FileState[]).map((s) => (
          <li key={s} className="flex items-start gap-2">
            <StateBadge state={s} />
            <span>{stateText(t, s).help}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
