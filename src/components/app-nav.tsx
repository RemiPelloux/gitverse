"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookText, FlaskConical, Map as MapIcon, Moon, Sun, UserRound } from "lucide-react";
import { useProgress } from "@/features/progress/store";
import { levelFor, streak } from "@/features/progress/rules";
import { Logo, useHydrated } from "@/components/ui/misc";

const LINKS = [
  { href: "/learn", label: "Learn", icon: MapIcon },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/commands", label: "Commands", icon: BookText },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function AppNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);
  const activity = useProgress((s) => s.activity);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const lv = levelFor(xp);
  const days = hydrated ? streak(activity) : 0;
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" aria-label="Gitverse home">
            <Logo />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx("rounded-lg px-3 py-1.5 text-sm transition-colors", active ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg")}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {hydrated && xp > 0 && (
              <Link href="/profile" className="flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs hover:border-line-strong">
                <span className="grid size-5 place-items-center rounded-full bg-violet text-[10px] font-bold text-white">{lv.level}</span>
                <span className="font-semibold text-amber">{xp} XP</span>
                {settings.showStreak && days > 1 && <span className="text-fg-2">· {days}-day streak</span>}
              </Link>
            )}
            <button
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
              className="grid size-8 place-items-center rounded-lg text-fg-2 hover:bg-surface-2 hover:text-fg"
              aria-label={`Switch to ${settings.theme === "dark" ? "light" : "dark"} theme`}
            >
              {hydrated && settings.theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </div>
        </div>
      </header>
      {/* mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={clsx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-violet-2" : "text-fg-3")}>
              <l.icon className="size-5" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
