"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Check, Copy, Download, LifeBuoy, Search, Skull, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, type T } from "@/i18n";
import type { Locale } from "@/i18n/locale";
import { IGNORE, RECIPES, REFS, RULES, SECTIONS, type SheetItem } from "./cheatsheet-data";

const lane = (n: number) => `var(--lane-${n})`;

export function Cheatsheet() {
  const t = useT();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const loc = t.locale;
  const has = (...parts: string[]) => !query || parts.some((p) => p.toLowerCase().includes(query));

  const sections = SECTIONS.map((s) => {
    const titleHit = !!query && s.title[loc].toLowerCase().includes(query);
    return { ...s, items: titleHit ? s.items : s.items.filter((it) => has(it.cmd, it.desc[loc])) };
  }).filter((s) => s.items.length);
  const refs = REFS.filter((r) => has(r.ref, r.desc[loc]));
  const ignore = IGNORE.filter((r) => has(r.pattern, r.desc[loc]));
  const recipes = RECIPES.filter((r) => has(r.problem[loc], ...r.steps));
  const nothing = !sections.length && !refs.length && !ignore.length && !recipes.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-28 md:pb-16 print:max-w-none print:p-0">
      {/* ── Header */}
      <header className="max-w-3xl">
        <p className="font-mono text-sm text-accent-fg">{t("cheatsheet.prompt")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t("cheatsheet.title")}</h1>
        <p className="mt-2 text-fg-2 text-pretty print:hidden">{t("cheatsheet.subtitle")}</p>
      </header>

      <div className="sticky top-14 z-20 -mx-4 mt-6 border-b border-line/70 bg-bg/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-bg/75 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-fg-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQ("")}
              placeholder={t("cheatsheet.search")}
              aria-label={t("cheatsheet.searchLabel")}
              className="w-full rounded-lg border border-line bg-surface py-2 pr-9 pl-9 font-mono text-sm outline-none placeholder:font-sans focus:border-accent"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label={t("cheatsheet.clear")} className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg">
                <X className="size-4" />
              </button>
            )}
          </label>
          <Legend t={t} />
          <Button variant="secondary" size="sm" onClick={() => printAsPdf(t("cheatsheet.pdfName"))} className="ml-auto">
            <Download className="size-4" /> {t("cheatsheet.print")}
          </Button>
        </div>
        {!query && (
          <nav aria-label={t("cheatsheet.jump")} className="scrollbar-thin -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg-2 hover:border-line-strong hover:text-fg">
                <span className="size-2 rounded-full" style={{ background: lane(s.lane) }} />
                {s.title[loc]}
              </a>
            ))}
            <a href="#recipes" className="flex shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-fg">
              <LifeBuoy className="size-3.5" /> {t("cheatsheet.recipes")}
            </a>
          </nav>
        )}
      </div>

      {!query && <Areas t={t} />}

      {nothing && (
        <p className="mt-16 text-center text-fg-2">
          {t("cheatsheet.noMatch", { q })}{" "}
          <button onClick={() => setQ("")} className="font-medium text-accent-fg underline underline-offset-2">
            {t("cheatsheet.clear")}
          </button>
        </p>
      )}

      {/* ── Command sections, packed as a masonry */}
      <div className="mt-8 gap-5 sm:columns-2 lg:columns-3 print:mt-4 print:columns-2 print:gap-4">
        {sections.map((s) => (
          <SheetCard key={s.id} id={s.id} title={s.title[loc]} color={lane(s.lane)} intro={s.intro?.[loc]}>
            <ul className="divide-y divide-line/70">
              {s.items.map((it) => (
                <CommandRow key={it.cmd} item={it} locale={loc} t={t} />
              ))}
            </ul>
          </SheetCard>
        ))}
        {refs.length > 0 && (
          <SheetCard id="refs" title={t("cheatsheet.refs")} color="var(--accent-mark)" intro={t("cheatsheet.refsIntro")}>
            <KeyList rows={refs.map((r) => [r.ref, r.desc[loc]])} />
          </SheetCard>
        )}
        {ignore.length > 0 && (
          <SheetCard id="ignore" title={t("cheatsheet.ignore")} color="var(--text-3)" intro={t("cheatsheet.ignoreIntro")}>
            <KeyList rows={ignore.map((r) => [r.pattern, r.desc[loc]])} />
          </SheetCard>
        )}
      </div>

      {/* ── Recipes */}
      {recipes.length > 0 && (
        <section id="recipes" className="mt-10 scroll-mt-36 print:mt-4 print:break-before-page">
          <div className="flex items-center gap-2">
            <LifeBuoy className="size-5 text-accent-fg" />
            <h2 className="text-xl font-semibold tracking-tight">{t("cheatsheet.recipes")}</h2>
          </div>
          <p className="mt-1 text-sm text-fg-2">{t("cheatsheet.recipesLead")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
            {recipes.map((r) => (
              <article key={r.problem.en} className="flex break-inside-avoid flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
                <h3 className="px-4 pt-3.5 pb-3 text-sm font-semibold">{r.problem[loc]}</h3>
                <ol className="terminal mt-auto space-y-0.5 bg-term px-4 py-3 font-mono text-[12.5px]">
                  {r.steps.map((step) => (
                    <li key={step} className="flex gap-2">
                      <span className="text-[var(--t-green)] select-none">$</span>
                      <CopyText text={step} t={t} className="text-left text-[var(--t-text)]">
                        <Tokens cmd={step} dark />
                      </CopyText>
                    </li>
                  ))}
                </ol>
                {r.note && <p className="border-t border-line bg-surface-2/50 px-4 py-2 text-xs text-fg-2">{r.note[loc]}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Golden rules */}
      {!query && (
        <section className="mt-10 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] print:mt-4 print:break-inside-avoid">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[var(--star)]" />
            <h2 className="text-xl font-semibold tracking-tight">{t("cheatsheet.rules")}</h2>
          </div>
          <ol className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((r, n) => (
              <li key={r.en} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent-fg">{n + 1}</span>
                <span className="pt-0.5 text-fg-2">{r[loc]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Legend({ t }: { t: T }) {
  return (
    <div className="hidden items-center gap-3 text-xs text-fg-3 md:flex">
      <span className="font-mono">
        <span className="text-warn">&lt;…&gt;</span> {t("cheatsheet.placeholder")}
      </span>
      <span className="flex items-center gap-1">
        <AlertTriangle className="size-3.5 text-warn" /> {t("cheatsheet.careful")}
      </span>
      <span className="flex items-center gap-1">
        <Skull className="size-3.5 text-bad" /> {t("cheatsheet.destructive")}
      </span>
    </div>
  );
}

function SheetCard({ id, title, color, intro, children }: { id: string; title: string; color: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-5 scroll-mt-36 break-inside-avoid overflow-hidden print:break-inside-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] print:mb-4">
      <div className="h-1" style={{ background: color }} />
      <div className="px-4 pt-3 pb-1">
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
            <circle cx="6" cy="6" r="4.5" fill="none" stroke={color} strokeWidth="2.5" />
          </svg>
          {title}
        </h2>
        {intro && <p className="mt-1 text-xs text-fg-3">{intro}</p>}
      </div>
      <div className="px-1.5 pb-1.5">{children}</div>
    </section>
  );
}

function CommandRow({ item, locale, t }: { item: SheetItem; locale: Locale; t: T }) {
  return (
    <li className="break-inside-avoid">
      <CopyText text={item.cmd} t={t} className="group/row block w-full rounded-lg px-2.5 py-2 text-left hover:bg-surface-2/70">
        <span className="flex items-start gap-1.5">
          <code className="min-w-0 flex-1 font-mono text-[13px] leading-snug break-words">
            <Tokens cmd={item.cmd} />
          </code>
          {item.risk === "careful" && <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-label={t("cheatsheet.careful")} />}
          {item.risk === "destructive" && <Skull className="mt-0.5 size-3.5 shrink-0 text-bad" aria-label={t("cheatsheet.destructive")} />}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-fg-2">{item.desc[locale]}</span>
      </CopyText>
    </li>
  );
}

function KeyList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-line/70">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-baseline gap-3 px-2.5 py-2">
          <dt>
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] break-all text-accent-fg">{k}</code>
          </dt>
          <dd className="text-[13px] leading-snug text-fg-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A button that copies `text`, flashing a small "Copied" check. */
function CopyText({ text, t, className, children }: { text: string; t: T; className?: string; children: ReactNode }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <button type="button" onClick={copy} title={t("cheatsheet.copy", { cmd: text })} className={clsx("relative cursor-copy", className)}>
      {children}
      <span
        aria-live="polite"
        className={clsx(
          "pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-opacity print:hidden",
          done ? "bg-ok text-[var(--on-ok)] opacity-100" : "bg-elevated text-fg-3 opacity-0 shadow-sm group-hover/row:opacity-100",
        )}
      >
        {done ? (
          <>
            <Check className="size-3" /> {t("cheatsheet.copied")}
          </>
        ) : (
          <Copy className="size-3" />
        )}
      </span>
    </button>
  );
}

/** Syntax-colors a command: git · subcommand · flags · "strings" · <placeholders>. */
function Tokens({ cmd, dark }: { cmd: string; dark?: boolean }) {
  const parts = cmd.match(/"[^"]*"|<[^>]+>|\s+|[^\s"<]+/g) ?? [cmd];
  let word = 0;
  return (
    <>
      {parts.map((p, n) => {
        if (/^\s+$/.test(p)) return p;
        const w = word++;
        const cls =
          p.includes("<") ? (dark ? "text-[var(--t-yellow)] italic" : "text-warn italic")
          : p.startsWith('"') ? (dark ? "text-[var(--t-cyan)]" : "text-ok")
          : w === 0 && p === "git" ? (dark ? "text-[var(--t-muted)]" : "text-fg-3")
          : w === 1 ? (dark ? "font-semibold text-white" : "font-semibold text-fg")
          : p.startsWith("-") ? (dark ? "text-[var(--t-blue)]" : "text-info")
          : dark ? "text-[var(--t-text)]" : "text-fg-2";
        return (
          <span key={n} className={cls}>
            {p}
          </span>
        );
      })}
    </>
  );
}

// ───────────────────────── The four areas diagram

const FLOWS: Array<{ cmd: string; from: number; to: number; color: string }> = [
  { cmd: "git add", from: 1, to: 2, color: lane(1) },
  { cmd: "git commit", from: 2, to: 3, color: lane(0) },
  { cmd: "git push", from: 3, to: 4, color: lane(2) },
  { cmd: "git fetch", from: 4, to: 3, color: lane(4) },
  { cmd: "git pull", from: 4, to: 1, color: lane(5) },
  { cmd: "git restore --staged", from: 2, to: 1, color: lane(3) },
  { cmd: "git switch / restore", from: 3, to: 1, color: "var(--text-3)" },
];

function Areas({ t }: { t: T }) {
  const areas = [
    { name: t("cheatsheet.areas.work"), hint: t("cheatsheet.areas.workHint") },
    { name: t("cheatsheet.areas.stage"), hint: t("cheatsheet.areas.stageHint") },
    { name: t("cheatsheet.areas.local"), hint: t("cheatsheet.areas.localHint") },
    { name: t("cheatsheet.areas.remote"), hint: t("cheatsheet.areas.remoteHint") },
  ];
  return (
    <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] print:mt-4 print:break-inside-avoid" aria-labelledby="areas-title">
      <div className="px-5 pt-4">
        <h2 id="areas-title" className="font-semibold tracking-tight">
          {t("cheatsheet.areasTitle")}
        </h2>
        <p className="mt-0.5 text-sm text-fg-2">{t("cheatsheet.areasLead")}</p>
      </div>
      <div className="scrollbar-thin overflow-x-auto px-5 pt-4 pb-5">
        <div className="relative min-w-[600px]">
          {/* vertical guides under each area */}
          {areas.map((_, k) => (
            <div key={k} className="absolute top-14 bottom-0 border-l border-dashed border-line-strong" style={{ left: `${((k + 0.5) / 4) * 100}%` }} aria-hidden />
          ))}
          <div className="relative grid grid-cols-4 gap-3">
            {areas.map((a, k) => (
              <div key={k} className={clsx("rounded-lg border px-3 py-2 text-center", k === 3 ? "border-dashed border-line-strong bg-surface-2/40" : "border-line bg-elevated")}>
                <p className="text-sm font-semibold">{a.name}</p>
                <p className="text-[11px] text-fg-3">{a.hint}</p>
              </div>
            ))}
          </div>
          <ul className="relative mt-3 grid grid-cols-8 gap-y-1">
            {FLOWS.map((f) => {
              const lo = Math.min(f.from, f.to);
              const hi = Math.max(f.from, f.to);
              const right = f.to > f.from;
              return (
                <li key={f.cmd} className="flex flex-col items-center" style={{ gridColumn: `${lo * 2} / ${hi * 2}`, color: f.color }}>
                  <code className="rounded bg-surface px-1.5 font-mono text-xs font-semibold">{f.cmd}</code>
                  <span className="relative mt-0.5 block h-2.5 w-full" aria-hidden>
                    <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-current" />
                    <span className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-current" style={right ? { left: -4 } : { right: -4 }} />
                    <svg viewBox="0 0 10 10" className={clsx("absolute top-0 size-2.5", !right && "rotate-180")} style={right ? { right: -2 } : { left: -2 }}>
                      <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="sr-only">
                    {areas[f.from - 1].name} → {areas[f.to - 1].name}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Opens the browser's print dialog, where "Save as PDF" is the destination.
 * Always prints the light theme (ink on paper) with a tidy file name.
 */
function printAsPdf(fileName: string) {
  const root = document.documentElement;
  const theme = root.dataset.theme;
  const title = document.title;
  const restore = () => {
    if (theme) root.dataset.theme = theme;
    document.title = title;
    window.removeEventListener("afterprint", restore);
  };
  root.dataset.theme = "light";
  document.title = fileName;
  window.addEventListener("afterprint", restore);
  window.print();
}

// ───────────────────────── In-lesson drawer

/** Cheatsheet entries for a lesson's commands, e.g. "git push -u origin <branch>" → git push -u… */
function lessonItems(commands: string[]): SheetItem[] {
  const all = SECTIONS.flatMap((s) => s.items);
  const out: SheetItem[] = [];
  for (const c of commands) {
    const prefix = c.split("<")[0].trim();
    const sub = prefix.split(/\s+/)[1];
    let hits = all.filter((it) => it.cmd.startsWith(prefix));
    if (!hits.length) hits = all.filter((it) => it.cmd.split(/\s+/)[1] === sub).slice(0, 2);
    for (const h of hits.slice(0, 3)) if (!out.includes(h)) out.push(h);
  }
  return out;
}

/** A slide-over cheatsheet for use during a lesson; the lesson's own commands come first. */
export function CheatsheetDrawer({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: string[] }) {
  const t = useT();
  const loc = t.locale;
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  const match = (it: SheetItem) => !query || it.cmd.toLowerCase().includes(query) || it.desc[loc].toLowerCase().includes(query);
  const mine = lessonItems(commands).filter(match);
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter(match) })).filter((s) => s.items.length);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={t("cheatsheet.title")}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-bg shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="font-semibold tracking-tight">{t("cheatsheet.title")}</h2>
              <Link href="/cheatsheet" target="_blank" className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-fg-2 hover:bg-surface-2 hover:text-fg">
                {t("cheatsheet.openFull")} <ArrowUpRight className="size-3.5" />
              </Link>
              <button onClick={onClose} aria-label={t("common.close")} className="grid size-8 place-items-center rounded-md text-fg-2 hover:bg-surface-2 hover:text-fg">
                <X className="size-4" />
              </button>
            </div>
            <div className="border-b border-line px-4 py-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-fg-3" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("cheatsheet.search")}
                  aria-label={t("cheatsheet.searchLabel")}
                  className="w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-9 font-mono text-sm outline-none placeholder:font-sans focus:border-accent"
                />
              </label>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pt-4">
              {mine.length > 0 && (
                <SheetCard id="drawer-lesson" title={t("cheatsheet.inThisLesson")} color="var(--accent-mark)">
                  <ul className="divide-y divide-line/70">
                    {mine.map((it) => (
                      <CommandRow key={it.cmd} item={it} locale={loc} t={t} />
                    ))}
                  </ul>
                </SheetCard>
              )}
              {sections.map((s) => (
                <SheetCard key={s.id} id={`drawer-${s.id}`} title={s.title[loc]} color={lane(s.lane)}>
                  <ul className="divide-y divide-line/70">
                    {s.items.map((it) => (
                      <CommandRow key={it.cmd} item={it} locale={loc} t={t} />
                    ))}
                  </ul>
                </SheetCard>
              ))}
              {!mine.length && !sections.length && <p className="py-8 text-center text-sm text-fg-2">{t("cheatsheet.noMatch", { q })}</p>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
