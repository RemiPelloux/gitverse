"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useState } from "react";
import { Accessibility, Flame, Keyboard, Languages, Palette, RotateCcw, SquareTerminal, Star, Target, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button, Kbd } from "@/components/ui/button";
import { Card, DynamicIcon, ProgressBar, useHydrated } from "@/components/ui/misc";
import { PLAYGROUND_KEY, removeKey } from "@/features/lab/persistence";
import { LOCALES, useT, type Locale, type MessageKey } from "@/i18n";
import { useProgress, type Settings } from "./store";
import { ACHIEVEMENTS, AVATAR_COLORS, DAILY_GOALS, dayKey, levelFor, type DailyGoal } from "./rules";

export function Profile() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <ProfileInner />;
}

/** Longest run of consecutive active days. */
function bestStreak(activity: Record<string, { xp: number }>) {
  const days = Object.keys(activity)
    .filter((k) => activity[k].xp > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of days) {
    const [y, m, d] = k.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (prev) {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      run = dayKey(next) === k ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

function ProfileInner() {
  const t = useT();
  const p = useProgress();
  const lv = levelFor(p.xp);
  const [confirm, setConfirm] = useState(false);
  const titles = t.list("levels");
  const starCount = Object.values(p.completed).reduce((n, c) => n + (c.stars ?? 1), 0);
  const stats: Array<[React.ReactNode, string, string]> = [
    [<Trophy key="l" className="size-4 text-accent-fg" />, t("profile.statLessons"), String(Object.keys(p.completed).length)],
    [<Star key="s" className="size-4 text-(color:--star)" />, t("profile.statStars"), String(starCount)],
    [<SquareTerminal key="c" className="size-4 text-info" />, t("profile.statCommands"), String(Object.keys(p.commands).length)],
    [<Flame key="f" className="size-4 text-warn" />, t("profile.statBest"), String(bestStreak(p.activity))],
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pt-8 pb-28 md:pb-16">
      <Card className="bg-dots overflow-hidden p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={p.name} color={p.avatar} size="xl" />
          <div className="min-w-0 flex-1">
            <label className="text-xs text-fg-3" htmlFor="name">
              {t("profile.displayName")}
            </label>
            <input
              id="name"
              value={p.name}
              onChange={(e) => p.setName(e.target.value.slice(0, 30))}
              placeholder={t("common.guest")}
              className="block w-full rounded-md bg-transparent text-2xl font-semibold outline-none placeholder:text-fg-3 focus-visible:bg-surface-2"
            />
            <p className="text-sm text-fg-2">{t("profile.summary", { title: titles[lv.level - 1], xp: p.xp, n: Object.keys(p.completed).length })}</p>
            <ProgressBar value={lv.progress} className="mt-2 max-w-sm" label={t("learn.levelProgress")} />
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t("profile.avatar")}>
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={p.avatar === c}
                  aria-label={`${t("profile.avatar")} ${c.slice(-1)}`}
                  onClick={() => p.setAvatar(c)}
                  className={clsx("size-6 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110", p.avatar === c && "ring-2 ring-fg")}
                  style={{ background: `var(--${c})` }}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-3">{t("profile.guestNote")}</p>
      </Card>

      <section aria-labelledby="stats">
        <h2 id="stats" className="mb-3 text-lg font-semibold">
          {t("profile.stats")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([icon, label, value]) => (
            <li key={label} className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              {icon}
              <p className="mt-2 text-2xl font-semibold">{value}</p>
              <p className="text-xs text-fg-3">{label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ach">
        <h2 id="ach" className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Trophy className="size-5 text-warn" /> {t("profile.achievements")}
          <span className="text-sm font-normal text-fg-3">
            {Object.keys(p.achievements).length}/{ACHIEVEMENTS.length}
          </span>
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const at = p.achievements[a.id];
            return (
              <li key={a.id} className={clsx("flex items-center gap-3 rounded-xl border p-3", at ? "border-warn/30 bg-warn-soft/50" : "border-line opacity-60")}>
                <span className={clsx("grid size-11 shrink-0 place-items-center rounded-xl", at ? "bg-warn text-[var(--surface)] shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]" : "bg-surface-2 text-fg-3")}>
                  <DynamicIcon name={a.icon} className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`badges.${a.id}.title` as MessageKey)}</p>
                  <p className="text-xs text-fg-2">{t(`badges.${a.id}.description` as MessageKey)}</p>
                </div>
                {at && <span className="ml-auto shrink-0 text-[11px] text-fg-3">{new Date(at).toLocaleDateString(t.locale)}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="settings" className="space-y-3">
        <h2 id="settings" className="text-lg font-semibold">
          {t("profile.settings")}
        </h2>
        <Card className="divide-y divide-line">
          <Setting icon={<Languages className="size-4" />} title={t("profile.language")} desc={t("profile.languageDesc")}>
            <Segmented value={t.locale} options={LOCALES.map((l) => [l.id, l.label])} onChange={(v) => p.updateSettings({ locale: v as Locale })} />
          </Setting>
          <Setting icon={<Target className="size-4" />} title={t("profile.goal")} desc={t("profile.goalDesc")}>
            <Segmented
              value={String(p.settings.dailyGoal ?? 60)}
              options={DAILY_GOALS.map((g) => [String(g), `${g} XP`])}
              onChange={(v) => p.updateSettings({ dailyGoal: Number(v) as DailyGoal })}
            />
          </Setting>
          <Setting icon={<Palette className="size-4" />} title={t("profile.theme")} desc={t("profile.themeDesc")}>
            <Segmented
              value={p.settings.theme}
              options={[
                ["light", t("profile.themePaper")],
                ["dark", t("profile.themeDark")],
              ]}
              onChange={(v) => p.updateSettings({ theme: v as Settings["theme"] })}
            />
          </Setting>
          <Setting icon={<Accessibility className="size-4" />} title={t("profile.motion")} desc={t("profile.motionDesc")}>
            <Segmented
              value={p.settings.motion}
              options={[
                ["system", t("profile.motionSystem")],
                ["reduced", t("profile.motionReduced")],
                ["full", t("profile.motionFull")],
              ]}
              onChange={(v) => p.updateSettings({ motion: v as Settings["motion"] })}
            />
          </Setting>
          <Setting icon={<SquareTerminal className="size-4" />} title={t("profile.terminal")} desc={t("profile.terminalDesc")}>
            <Segmented
              value={p.settings.terminalMode}
              options={[
                ["assisted", t("profile.assisted")],
                ["real", t("profile.real")],
              ]}
              onChange={(v) => p.updateSettings({ terminalMode: v as Settings["terminalMode"] })}
            />
          </Setting>
          <Setting icon={<Flame className="size-4" />} title={t("profile.streaks")} desc={t("profile.streaksDesc")}>
            <Segmented
              value={p.settings.showStreak ? "on" : "off"}
              options={[
                ["on", t("profile.on")],
                ["off", t("profile.off")],
              ]}
              onChange={(v) => p.updateSettings({ showStreak: v === "on" })}
            />
          </Setting>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="size-4" /> {t("profile.shortcuts")}
          </h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {(
              [
                [["Tab"], "complete"],
                [["↑", "↓"], "history"],
                [["→"], "ghost"],
                [["Ctrl", "L"], "clear"],
                [["Ctrl", "Alt", "Z"], "travel"],
                [["Enter"], "select"],
                [["Ctrl", "Scroll"], "zoom"],
                [["Esc"], "esc"],
              ] as const
            ).map(([keys, id]) => (
              <div key={id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-1.5">
                <dt className="text-fg-2">{t(`profile.keys.${id}`)}</dt>
                <dd className="flex gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("profile.reset")}</p>
            <p className="text-xs text-fg-2">{t("profile.resetDesc")}</p>
            <Link href="/welcome" className="mt-1 inline-block text-xs text-accent-fg underline underline-offset-2">
              {t("profile.replayWelcome")}
            </Link>
          </div>
          {confirm ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  p.resetProgress();
                  removeKey(PLAYGROUND_KEY);
                  setConfirm(false);
                }}
              >
                {t("profile.resetConfirm")}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
              <RotateCcw className="size-3.5" /> {t("profile.resetButton")}
            </Button>
          )}
        </Card>
      </section>
    </div>
  );
}

function Setting({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-fg-2">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-fg-2">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg bg-surface-2 p-1" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={clsx("rounded-md px-3 py-1 text-xs font-medium transition-colors", value === v ? "bg-elevated text-fg shadow-sm" : "text-fg-3 hover:text-fg")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
