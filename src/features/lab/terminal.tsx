"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ClipboardCopy, CornerDownLeft, Eraser, Lightbulb, Play, Sparkles, TextCursorInput } from "lucide-react";
import type { OutLine } from "@/engine";
import { explainTokens } from "@/features/docs/commands";
import { complete, highlight, type Completion } from "./completion";
import { useLab, type TermEntry } from "./store";

const LINE_CLS: Record<OutLine["kind"], string> = {
  out: "text-[var(--t-text)]",
  muted: "text-[var(--t-muted)]",
  error: "text-[#fda4af]",
  success: "text-[#6ee7b7]",
  hint: "text-[#c4b5fd]",
  added: "text-[#6ee7b7]",
  removed: "text-[#fda4af]",
  hunk: "text-[#93c5fd]",
  commit: "text-[#fcd34d]",
  warning: "text-[#fcd34d]",
};

export interface TerminalProps {
  mode: "assisted" | "real";
  /** Command suggested by the current lesson step (assisted mode). */
  suggestion?: string | null;
  className?: string;
  onModeChange?: (m: "assisted" | "real") => void;
  autoFocus?: boolean;
  compact?: boolean;
}

export function Terminal({ mode, suggestion, className, onModeChange, autoFocus, compact }: TerminalProps) {
  const entries = useLab((s) => s.entries);
  const world = useLab((s) => s.world);
  const run = useLab((s) => s.run);
  const inputHistory = useLab((s) => s.inputHistory);
  const clearTerminal = useLab((s) => s.clearTerminal);
  const [value, setValue] = useState("");
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [selIdx, setSelIdx] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const completions = useMemo(() => (value ? complete(value, world).slice(0, 6) : []), [value, world]);
  const ghost = useMemo(() => {
    if (!value) return "";
    if (suggestion && suggestion.startsWith(value) && mode === "assisted") return suggestion.slice(value.length);
    const c = completions[0];
    return c && c.value.startsWith(value) ? c.value.slice(value.length) : "";
  }, [value, completions, suggestion, mode]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  const branch = world.repo ? (world.repo.head.kind === "branch" ? world.repo.head.name : world.repo.head.commit.slice(0, 7) + "…") : null;

  const submit = (cmd = value) => {
    if (!cmd.trim()) return;
    run(cmd);
    setValue("");
    setHistIdx(null);
    setShowMenu(false);
    inputRef.current?.focus();
  };

  const accept = (c: Completion) => {
    setValue(c.value);
    setShowMenu(false);
    setSelIdx(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showMenu && completions[selIdx] && completions.length > 1) accept(completions[selIdx]);
      else submit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (completions.length > 1 && !ghost) setShowMenu(true);
      else if (ghost) setValue(value + ghost);
      else if (completions[0]) accept(completions[0]);
    } else if (e.key === "ArrowRight" && ghost && inputRef.current?.selectionStart === value.length) {
      e.preventDefault();
      setValue(value + ghost);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showMenu) return setSelIdx((i) => Math.max(0, i - 1));
      if (!inputHistory.length) return;
      const i = histIdx === null ? inputHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setValue(inputHistory[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showMenu) return setSelIdx((i) => Math.min(completions.length - 1, i + 1));
      if (histIdx === null) return;
      const i = histIdx + 1;
      if (i >= inputHistory.length) {
        setHistIdx(null);
        setValue("");
      } else {
        setHistIdx(i);
        setValue(inputHistory[i]);
      }
    } else if (e.key === "Escape") setShowMenu(false);
    else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      clearTerminal();
    } else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      setValue("");
    }
  };

  const copyOutput = async () => {
    const text = entries.map((en) => `$ ${en.input}\n${en.lines.map((l) => l.text).join("\n")}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={clsx("terminal flex h-full min-h-0 flex-col overflow-hidden bg-term font-mono text-[13px] leading-[1.55]", className)}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/5 px-3 text-xs text-[var(--t-muted)]">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#fb7185]/70" />
          <span className="size-2.5 rounded-full bg-[#fbbf24]/70" />
          <span className="size-2.5 rounded-full bg-[#34d399]/70" />
        </span>
        <span className="ml-1 truncate font-sans">Terminal · simulated, safe to experiment</span>
        <div className="ml-auto flex items-center gap-1">
          {onModeChange && (
            <div className="mr-1 flex rounded-lg bg-white/5 p-0.5 font-sans" role="radiogroup" aria-label="Terminal mode">
              {(["assisted", "real"] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => onModeChange(m)}
                  className={clsx("rounded-md px-2 py-0.5 text-[11px] transition-colors", mode === m ? "bg-white/10 text-white" : "hover:text-white")}
                >
                  {m === "assisted" ? "Assisted" : "Real"}
                </button>
              ))}
            </div>
          )}
          <button onClick={copyOutput} className="rounded-md p-1 hover:bg-white/5 hover:text-white" aria-label="Copy terminal output" title="Copy output">
            <ClipboardCopy className="size-3.5" />
          </button>
          <button onClick={clearTerminal} className="rounded-md p-1 hover:bg-white/5 hover:text-white" aria-label="Clear terminal (Ctrl+L)" title="Clear (Ctrl+L)">
            <Eraser className="size-3.5" />
          </button>
          {copied && <span className="font-sans text-[11px] text-[#6ee7b7]">Copied</span>}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-2"
        onClick={() => {
          if (!window.getSelection()?.toString()) inputRef.current?.focus();
        }}
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
      >
        {!entries.length && (
          <p className="text-[var(--t-muted)]">
            {mode === "assisted" ? "Type a command, or use the suggestion below. Type help for a list of commands." : "Type help to list available commands."}
          </p>
        )}
        {entries.map((e) => (
          <Entry key={e.id} entry={e} />
        ))}
      </div>

      {mode === "assisted" && suggestion && (
        <AssistBar suggestion={suggestion} onRun={() => submit(suggestion)} onInsert={() => { setValue(suggestion); inputRef.current?.focus(); }} compact={compact} />
      )}

      <div className="relative shrink-0 border-t border-white/5 px-3 py-2.5">
        <AnimatePresence>
          {showMenu && completions.length > 1 && (
            <motion.ul
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full left-3 z-10 mb-1 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#161a2e] py-1 shadow-xl"
              role="listbox"
            >
              {completions.map((c, i) => (
                <li
                  key={c.value}
                  role="option"
                  aria-selected={i === selIdx}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    accept(c);
                  }}
                  className={clsx("flex cursor-pointer items-center justify-between gap-3 px-3 py-1", i === selIdx && "bg-white/10")}
                >
                  <span className="text-white">{c.label}</span>
                  {c.detail && <span className="truncate font-sans text-[11px] text-[var(--t-muted)]">{c.detail}</span>}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        <label className="flex items-center gap-2">
          <span className="sr-only">Command</span>
          <Prompt branch={branch} />
          <div className="relative min-w-0 flex-1">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre">
              {highlight(value).map((t, i) => (
                <span key={i} className={t.cls}>
                  {t.text}
                </span>
              ))}
              <span className="text-[var(--t-muted)] opacity-60">{ghost}</span>
            </div>
            <input
              ref={inputRef}
              value={value}
              autoFocus={autoFocus}
              onChange={(e) => {
                setValue(e.target.value);
                setHistIdx(null);
                setSelIdx(0);
                setShowMenu(false);
              }}
              onKeyDown={onKeyDown}
              onBlur={() => setTimeout(() => setShowMenu(false), 100)}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="go"
              aria-describedby="term-help"
              className="w-full bg-transparent text-transparent caret-[#c4b5fd] outline-none selection:bg-violet/40"
            />
          </div>
          <button
            onClick={() => submit()}
            className="grid size-7 place-items-center rounded-lg bg-white/5 text-[var(--t-muted)] hover:bg-white/10 hover:text-white sm:hidden"
            aria-label="Run command"
          >
            <CornerDownLeft className="size-3.5" />
          </button>
        </label>
        <p id="term-help" className="sr-only">
          Press Enter to run. Tab completes. Up and down arrows browse history. Control L clears.
        </p>
        {ghost && !compact && (
          <p className="pointer-events-none mt-1 hidden font-sans text-[11px] text-[var(--t-muted)] sm:block">
            <kbd className="rounded bg-white/5 px-1">Tab</kbd> to complete
          </p>
        )}
      </div>
    </div>
  );
}

function Prompt({ branch }: { branch: string | null }) {
  return (
    <span className="shrink-0 select-none">
      <span className="text-[#6ee7b7]">you</span>
      <span className="text-[var(--t-muted)]">:</span>
      <span className="text-[#93c5fd]">~/project</span>
      {branch && <span className="text-[#c4b5fd]"> ({branch})</span>}
      <span className="text-[var(--t-muted)]"> $</span>
    </span>
  );
}

function Entry({ entry }: { entry: TermEntry }) {
  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-x-2">
        <Prompt branch={entry.branch} />
        <span>
          {highlight(entry.input).map((t, i) => (
            <span key={i} className={t.cls}>
              {t.text}
            </span>
          ))}
        </span>
      </div>
      {entry.lines.map((l, i) => (
        <div key={i} className={clsx("whitespace-pre-wrap break-words", LINE_CLS[l.kind])}>
          {l.text || " "}
        </div>
      ))}
      {entry.explain && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 flex gap-2 rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/[0.07] px-3 py-2 font-sans text-[13px] leading-snug text-[#fde68a]"
        >
          <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">In plain words: </span>
            {entry.explain}
          </span>
        </motion.div>
      )}
    </div>
  );
}

function AssistBar({ suggestion, onRun, onInsert, compact }: { suggestion: string; onRun: () => void; onInsert: () => void; compact?: boolean }) {
  const tokens = explainTokens(suggestion);
  const tone: Record<string, string> = {
    program: "text-[#c4b5fd]",
    command: "text-[#6ee7b7]",
    flag: "text-[#fcd34d]",
    value: "text-[#f9a8d4]",
    operator: "text-[var(--t-muted)]",
  };
  return (
    <div className="shrink-0 border-t border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 shrink-0 text-[#c4b5fd]" aria-hidden />
        <span className="font-sans text-[11px] tracking-wide text-[var(--t-muted)] uppercase">Suggested</span>
        <code className="min-w-0 truncate text-white">{suggestion}</code>
        <div className="ml-auto flex shrink-0 gap-1 font-sans">
          <button onClick={onInsert} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--t-muted)] hover:bg-white/5 hover:text-white" title="Put it in the input so you can type/edit it">
            <TextCursorInput className="size-3.5" /> <span className="hidden sm:inline">Insert</span>
          </button>
          <button onClick={onRun} className="flex items-center gap-1 rounded-lg bg-[#8b5cf6] px-2.5 py-1 text-xs font-medium text-white hover:brightness-110">
            <Play className="size-3 fill-current" /> Run
          </button>
        </div>
      </div>
      {!compact && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-5 font-sans text-[11px]">
          {tokens.map((t, i) => (
            <span key={i} className="text-[var(--t-muted)]">
              <code className={clsx("font-mono", tone[t.kind])}>{t.text.length > 24 ? t.text.slice(0, 22) + "…" : t.text}</code> {t.meaning}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
