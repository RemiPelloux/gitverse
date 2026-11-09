"use client";

import { clsx } from "clsx";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookText, Check, ClipboardList, Flame, FlaskConical, Languages, Map as MapIcon, Moon, Sun, UserRound } from "lucide-react";
import { useProgress } from "@/features/progress/store";
import { dayKey, levelFor, streak } from "@/features/progress/rules";
import { LOCALES, useT, type Locale } from "@/i18n";
import { Avatar } from "@/components/ui/avatar";
import { Logo, Ring, useHydrated } from "@/components/ui/misc";

const LINKS = [
  { href: "/learn", key: "nav.learn", icon: MapIcon },
  { href: "/playground", key: "nav.playground", icon: FlaskConical },
  { href: "/commands", key: "nav.commands", icon: BookText },
  { href: "/cheatsheet", key: "nav.cheatsheet", icon: ClipboardList },
  { href: "/profile", key: "nav.profile", icon: UserRound },
] as const;

export function AppNav() {
  const t = useT();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);
  const name = useProgress((s) => s.name);
  const avatar = useProgress((s) => s.avatar);
  const activity = useProgress((s) => s.activity);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const lv = levelFor(xp);
  const days = hydrated ? streak(activity) : 0;
  const todayXp = hydrated ? (activity[dayKey()]?.xp ?? 0) : 0;
  const goal = settings.dailyGoal ?? 60;
  const onboarded = useProgress((s) => s.onboarded);
  return (
    <>
      <header className="sticky top-0 z-40 print:hidden border-b border-line/70 bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" aria-label={t("nav.home")}>
            <Logo />
          </Link>
          <nav className="ml-2 hidden items-center gap-0.5 md:flex lg:ml-4 lg:gap-1" aria-label={t("nav.main")}>
            {LINKS.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx("rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors lg:px-3", active ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg")}
                >
                  {t(l.key)}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {hydrated && (xp > 0 || onboarded) && (
              <Link
                href="/learn"
                className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-xs hover:border-line-strong"
                title={t("nav.goal", { xp: todayXp, goal })}
              >
                <Ring value={todayXp / goal} size={26} stroke={3.5}>
                  <span className="text-[10px] font-bold">{lv.level}</span>
                </Ring>
                <XpCounter xp={xp} />
                {settings.showStreak && days > 0 && (
                  <span className="hidden items-center gap-0.5 font-semibold text-warn sm:flex" title={t("nav.streak", { n: days })}>
                    <Flame className="size-3.5" />
                    {days}
                  </span>
                )}
              </Link>
            )}
            <LanguageMenu value={t.locale} onChange={(locale) => updateSettings({ locale })} />
            <button
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
              className="grid size-9 place-items-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg"
              aria-label={settings.theme === "dark" ? t("nav.toLight") : t("nav.toDark")}
            >
              {hydrated && settings.theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            {hydrated && onboarded && (
              <Link href="/profile" className="hidden rounded-full ring-offset-2 ring-offset-bg hover:ring-2 hover:ring-line-strong lg:block" aria-label={t("nav.profile")}>
                <Avatar name={name} color={avatar} size="sm" />
              </Link>
            )}
          </div>
        </div>
      </header>
      {/* mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden" aria-label={t("nav.main")}>
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={clsx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-accent-fg" : "text-fg-3")}
            >
              <l.icon className="size-5" />
              {t(l.key)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** XP total that counts up when it grows, with a little "+n" float. */
function XpCounter({ xp }: { xp: number }) {
  const mv = useMotionValue(xp);
  const shown = useTransform(mv, (v) => Math.round(v));
  const prev = useRef(xp);
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null);
  useEffect(() => {
    const diff = xp - prev.current;
    prev.current = xp;
    const c = animate(mv, xp, { duration: 0.8, ease: "easeOut" });
    if (diff > 0) setGain({ n: diff, k: Date.now() });
    return () => c.stop();
  }, [xp, mv]);
  return (
    <span className="relative font-semibold text-fg">
      <motion.span>{shown}</motion.span> XP
      <AnimatePresence>
        {gain && (
          <motion.span
            key={gain.k}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -18, opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            onAnimationComplete={() => setGain(null)}
            className="absolute -top-1 right-0 text-[11px] font-bold text-ok"
            aria-hidden
          >
            +{gain.n}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function LanguageMenu({ value, onChange }: { value: Locale; onChange: (l: Locale) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("nav.chooseLanguage")}
        className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-fg-2 hover:bg-surface-2 hover:text-fg"
      >
        <Languages className="size-4" />
        {LOCALES.find((l) => l.id === value)?.short}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            role="listbox"
            aria-label={t("common.language")}
            className="absolute right-0 mt-1.5 w-40 overflow-hidden rounded-xl border border-line bg-elevated p-1 shadow-[var(--shadow-lg)]"
          >
            {LOCALES.map((l) => (
              <li key={l.id}>
                <button
                  role="option"
                  aria-selected={l.id === value}
                  lang={l.id}
                  onClick={() => {
                    onChange(l.id);
                    setOpen(false);
                  }}
                  className={clsx("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm", l.id === value ? "bg-accent-soft text-accent-fg" : "hover:bg-surface-2")}
                >
                  <span className="w-6 font-mono text-[11px] text-fg-3">{l.short}</span>
                  <span className="flex-1">{l.label}</span>
                  {l.id === value && <Check className="size-4" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
