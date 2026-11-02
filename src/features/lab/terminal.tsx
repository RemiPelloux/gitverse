"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ClipboardCopy, CornerDownLeft, Eraser, Lightbulb, Play, TextCursorInput } from "lucide-react";
import type { OutLine } from "@/engine";
import { explainTokens } from "@/features/docs/commands";
import { useT, type T } from "@/i18n";
import { translateExplain } from "@/i18n/engine-fr";
import { complete, highlight, type Completion } from "./completion";
import { useLab, type TermEntry } from "./store";

const LINE_CLS: Record<OutLine["kind"], string> = {
  out: "text-[var(--t-text)]",
  muted: "text-[var(--t-muted)]",
  error: "text-[var(--t-red)]",
  success: "text-[var(--t-green)]",
  hint: "text-[var(--t-orange)]",
  added: "text-[var(--t-green)]",
  removed: "text-[var(--t-red)]",
  hunk: "text-[var(--t-blue)]",
  commit: "text-[var(--t-yellow)]",
  warning: "text-[var(--t-yellow)]",
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
  const t = useT();
  const locale = t.locale;

  const completions = useMemo(() => (value ? complete(value, world, locale).slice(0, 6) : []), [value, world, locale]);
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
        <span className="truncate">bash — ~/project <span className="font-sans text-[var(--t-muted)]">{t("lab.terminal.simulated")}</span></span>
        <div className="ml-auto flex items-center gap-1">
          {onModeChange && (
            <div className="mr-1 flex rounded-lg bg-white/5 p-0.5 font-sans" role="radiogroup" aria-label={t("lab.terminal.modeLabel")}>
              {(["assisted", "real"] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => onModeChange(m)}
                  className={clsx("rounded-md px-2 py-0.5 text-[11px] transition-colors pointer-coarse:py-2", mode === m ? "bg-white/10 text-white" : "hover:text-white")}
                >
                  {m === "assisted" ? t("lab.terminal.assisted") : t("lab.terminal.real")}
                </button>
              ))}
            </div>
          )}
          <button onClick={copyOutput} className="rounded-md p-1 hover:bg-white/5 hover:text-white pointer-coarse:p-2.5" aria-label={t("lab.terminal.copyAria")} title={t("lab.terminal.copyTitle")}>
            <ClipboardCopy className="size-3.5" />
          </button>
          <button onClick={clearTerminal} className="rounded-md p-1 hover:bg-white/5 hover:text-white pointer-coarse:p-2.5" aria-label={t("lab.terminal.clearAria")} title={t("lab.terminal.clearTitle")}>
            <Eraser className="size-3.5" />
          </button>
          {copied && <span className="font-sans text-[11px] text-[var(--t-green)]">{t("lab.terminal.copied")}</span>}
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
        aria-label={t("lab.terminal.outputLabel")}
      >
        {!entries.length && (
          <p className="text-[var(--t-muted)]">
            {mode === "assisted" ? t("lab.terminal.emptyAssisted") : t("lab.terminal.emptyReal")}
          </p>
        )}
        {entries.map((e) => (
          <Entry key={e.id} entry={e} plainWords={t("lab.terminal.plainWords")} explain={translateExplain(e.explain, locale)} />
        ))}
      </div>

      {mode === "assisted" && suggestion && (
        <AssistBar suggestion={suggestion} onRun={() => submit(suggestion)} onInsert={() => { setValue(suggestion); inputRef.current?.focus(); }} compact={compact} t={t} />
      )}

      <div className="relative shrink-0 border-t border-white/5 px-3 py-2.5">
        <AnimatePresence>
          {showMenu && completions.length > 1 && (
            <motion.ul
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full left-3 z-10 mb-1 w-72 overflow-hidden rounded-md border border-white/10 bg-[#2a2721] py-1 shadow-xl"
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
          <span className="sr-only">{t("lab.terminal.command")}</span>
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
              className="w-full bg-transparent text-transparent caret-[var(--t-orange)] outline-none selection:bg-accent/40"
            />
          </div>
          <button
            onClick={() => submit()}
            className="grid size-7 place-items-center rounded-lg bg-white/5 text-[var(--t-muted)] hover:bg-white/10 hover:text-white sm:hidden"
            aria-label={t("lab.terminal.runCommand")}
          >
            <CornerDownLeft className="size-3.5" />
          </button>
        </label>
        <p id="term-help" className="sr-only">
          {t("lab.terminal.help")}
        </p>
        {ghost && !compact && (
          <p className="pointer-events-none mt-1 hidden font-sans text-[11px] text-[var(--t-muted)] sm:block">
            <kbd className="rounded bg-white/5 px-1">Tab</kbd> {t("lab.terminal.toComplete")}
          </p>
        )}
      </div>
    </div>
  );
}

function Prompt({ branch }: { branch: string | null }) {
  return (
    <span className="shrink-0 select-none">
      <span className="text-[var(--t-green)]">you</span>
      <span className="text-[var(--t-muted)]">:</span>
      <span className="text-[var(--t-blue)]">~/project</span>
      {branch && <span className="text-[var(--t-orange)]"> ({branch})</span>}
      <span className="text-[var(--t-muted)]"> $</span>
    </span>
  );
}

function Entry({ entry, plainWords, explain }: { entry: TermEntry; plainWords: string; explain?: string }) {
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
      {explain && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 flex gap-2 rounded-lg border border-[var(--t-yellow)]/20 bg-[var(--t-yellow)]/[0.07] px-3 py-2 font-sans text-[13px] leading-snug text-[var(--t-yellow)]"
        >
          <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">{plainWords}</span>
            {explain}
          </span>
        </motion.div>
      )}
    </div>
  );
}

function AssistBar({ suggestion, onRun, onInsert, compact, t }: { suggestion: string; onRun: () => void; onInsert: () => void; compact?: boolean; t: T }) {
  const tokens = explainTokens(suggestion, t.locale);
  const tone: Record<string, string> = {
    program: "text-[var(--t-orange)]",
    command: "text-[var(--t-green)]",
    flag: "text-[var(--t-yellow)]",
    value: "text-[var(--t-magenta)]",
    operator: "text-[var(--t-muted)]",
  };
  return (
    <div className="shrink-0 border-t border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[var(--t-orange)]" aria-hidden>›</span>
        <span className="font-sans text-[11px] text-[var(--t-muted)] ">{t("lab.terminal.suggested")}</span>
        <code className="min-w-0 truncate text-white">{suggestion}</code>
        <div className="ml-auto flex shrink-0 gap-1 font-sans">
          <button onClick={onInsert} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--t-muted)] hover:bg-white/5 hover:text-white" title={t("lab.terminal.insertTitle")}>
            <TextCursorInput className="size-3.5" /> <span className="hidden sm:inline">{t("lab.terminal.insert")}</span>
          </button>
          <button onClick={onRun} className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white hover:brightness-110">
            <Play className="size-3 fill-current" /> {t("lab.terminal.run")}
          </button>
        </div>
      </div>
      {!compact && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-5 font-sans text-[11px]">
          {tokens.map((tok, i) => (
            <span key={i} className="text-[var(--t-muted)]">
              <code className={clsx("font-mono", tone[tok.kind])}>{tok.text.length > 24 ? tok.text.slice(0, 22) + "…" : tok.text}</code> {tok.meaning}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
