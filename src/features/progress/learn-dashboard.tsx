"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Check, Flame, GitCommitHorizontal, Lock, Play, Swords, Target, Trophy } from "lucide-react";
import { ALL_LESSONS, isUnlocked, TIER_LABEL, type Chapter, type Lesson } from "@/features/curriculum";
import { localizedChapters, tierLabel } from "@/features/curriculum/localize";
import { categoryLabel, COMMAND_DOCS } from "@/features/docs/commands";
import { useT, type MessageKey } from "@/i18n";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card, DynamicIcon, ProgressBar, Ring, Stars, useHydrated } from "@/components/ui/misc";
import { useProgress } from "./store";
import { ACHIEVEMENTS, dayKey, emptyDay, levelFor, questsFor, streak } from "./rules";

export function LearnDashboard() {
  const hydrated = useHydrated();
  const onboarded = useProgress((s) => s.onboarded);
  const router = useRouter();
  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/welcome");
  }, [hydrated, onboarded, router]);
  if (!hydrated || !onboarded) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <Dashboard />;
}

function Dashboard() {
  const t = useT();
  const p = useProgress();
  const chapters = localizedChapters(t.locale);
  const lessons = chapters.flatMap((c) => c.lessons);
  const lv = levelFor(p.xp);
  const next = lessons.find((l) => !p.completed[l.id] && isUnlocked(l.id, p.completed, p.experience)) ?? null;
  const today = dayKey();
  const day = p.activity[today] ?? emptyDay();
  const quests = questsFor(today);
  const claimed = p.questsClaimed[today] ?? [];
  const days = streak(p.activity);
  const doneCount = Object.keys(p.completed).length;
  const goal = p.settings.dailyGoal ?? 60;
  const titles = t.list("levels");
  const nextChapter = next ? chapters.find((c) => c.id === next.chapterId)! : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:pt-8 md:pb-16">
      <Card className="bg-dots relative overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Avatar name={p.name} color={p.avatar} size="lg" />
              <div className="min-w-0">
                <p className="text-sm text-fg-2">
                  {p.name ? (doneCount ? t("learn.welcomeBackName", { name: p.name }) : t("learn.hello", { name: p.name })) : doneCount ? t("learn.welcomeBack") : t("learn.welcome")}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  {next ? (doneCount ? t("learn.nextTitle") : t("learn.firstTitle")) : t("learn.allDone")}
                </h1>
              </div>
            </div>
            {next && nextChapter ? (
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-line bg-elevated p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
                <span className="grid size-12 shrink-0 place-items-center rounded-full text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]" style={{ background: laneOf(nextChapter) }}>
                  {next.boss ? <Swords className="size-5" /> : <Play className="size-5 fill-current" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-3">
                    {p.saves[next.id] ? t("learn.chapterInProgress", { n: nextChapter.number }) : t("learn.chapterUpNext", { n: nextChapter.number })} · {t("common.xp", { n: next.xp })}
                  </p>
                  <p className="font-semibold">{next.title}</p>
                  <p className="truncate text-sm text-fg-2">{next.tagline}</p>
                </div>
                <LinkButton href={`/learn/${next.id}`} size="lg">
                  <Play className="size-4 fill-current" /> {p.saves[next.id] ? t("learn.resume") : t("learn.start")}
                </LinkButton>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <LinkButton href="/playground">{t("learn.openPlayground")}</LinkButton>
                <LinkButton href="/commands" variant="secondary">
                  {t("learn.browseCommands")}
                </LinkButton>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-5 md:flex-col md:items-center md:gap-2 md:pl-4">
            <Ring value={day.xp / goal} size={104} stroke={10}>
              <span className="text-center leading-tight">
                <span className="block text-2xl font-bold">{day.xp}</span>
                <span className="block text-[11px] text-fg-3">/ {goal} XP</span>
              </span>
            </Ring>
            <div className="md:text-center">
              <p className="text-sm font-semibold">{t("learn.dailyGoal")}</p>
              <p className={clsx("text-xs", day.xp >= goal ? "font-medium text-ok" : "text-fg-3")}>
                {day.xp >= goal ? t("learn.goalDone") : t("learn.goalProgress", { xp: day.xp, goal })}
              </p>
              {p.settings.showStreak && days > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-warn md:justify-center">
                  <Flame className="size-3.5" /> {t("nav.streak", { n: days })}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="path-title" className="min-w-0">
          <h2 id="path-title" className="mb-4 text-lg font-semibold">
            {t("learn.pathTitle")}
          </h2>
          <div className="space-y-5">
            {chapters.map((c) => (
              <ChapterTrail key={c.id} chapter={c} nextId={next?.id} />
            ))}
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-accent text-lg font-bold text-white shadow-[0_3px_0_var(--accent-deep)]">{lv.level}</span>
              <div className="min-w-0">
                <p className="text-xs text-fg-3">{t("common.level", { n: lv.level })}</p>
                <p className="truncate font-semibold">{titles[lv.level - 1]}</p>
              </div>
              <span className="ml-auto flex items-center gap-1 text-sm font-semibold text-warn">
                <GitCommitHorizontal className="size-4" />
                {p.xp}
              </span>
            </div>
            <ProgressBar value={lv.progress} className="mt-4 h-2.5" label={t("learn.levelProgress")} />
            <p className="mt-1.5 text-[11px] text-fg-3">{t("learn.toNext", { n: lv.ceil - p.xp, level: lv.level + 1 })}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label={t("learn.lessonsDone")} value={`${doneCount}/${ALL_LESSONS.length}`} />
              <Stat label={t("learn.commandsUsed")} value={String(Object.keys(p.commands).length)} />
              <Stat label={t("learn.badgesCount")} value={`${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}`} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Target className="size-4 text-ok" /> {t("learn.quests")}
            </h2>
            <ul className="mt-3 space-y-3">
              {quests.map((q) => {
                const prog = Math.min(q.target, q.progress(day));
                const done = claimed.includes(q.id);
                const title = t(`quests.${q.id}` as MessageKey);
                return (
                  <li key={q.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={clsx(done ? "text-fg-3 line-through" : "text-fg")}>{title}</span>
                      <span className="shrink-0 text-xs text-fg-3">{done ? <Check className="size-4 text-ok" /> : `${prog}/${q.target}`}</span>
                    </div>
                    <ProgressBar value={prog / q.target} tone="ok" className="mt-1.5 h-1.5" label={title} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-fg-3">{t("learn.questsNote")}</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Trophy className="size-4 text-warn" /> {t("learn.badges")}
              </h2>
              <Link href="/profile" className="text-xs text-fg-3 hover:text-fg-2">
                {t("learn.seeAll")}
              </Link>
            </div>
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {ACHIEVEMENTS.slice(0, 10).map((a) => {
                const got = !!p.achievements[a.id];
                const title = t(`badges.${a.id}.title` as MessageKey);
                return (
                  <li
                    key={a.id}
                    title={`${title} — ${t(`badges.${a.id}.description` as MessageKey)}`}
                    className={clsx(
                      "grid aspect-square place-items-center rounded-lg",
                      got ? "bg-warn-soft text-warn shadow-[inset_0_-2px_0_color-mix(in_oklab,var(--warn)_25%,transparent)]" : "bg-surface-2 text-fg-3 opacity-50",
                    )}
                  >
                    <DynamicIcon name={a.icon} className="size-4" />
                    <span className="sr-only">
                      {title}: {got ? t("learn.earned") : t("learn.locked")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <CommandMastery commands={p.commands} />
          <Activity activity={p.activity} />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2">
      <p className="text-sm font-semibold">{value}</p>
      <p className="truncate text-[11px] text-fg-3">{label}</p>
    </div>
  );
}

const laneOf = (c: Chapter) => `var(--lane-${(c.number - 1) % 6})`;

/** Horizontal offset of the n-th node on the winding path. */
const OFFSETS = [0, 64, 96, 64, 0, -64, -96, -64];
const ROW = 128;

/** A chapter as a branch: its lessons are commits along a winding lane. */
function ChapterTrail({ chapter, nextId }: { chapter: Chapter; nextId?: string }) {
  const t = useT();
  const completed = useProgress((s) => s.completed);
  const saves = useProgress((s) => s.saves);
  const experience = useProgress((s) => s.experience);
  const done = chapter.lessons.filter((l) => completed[l.id]).length;
  const total = chapter.lessons.length;
  const mastered = total > 0 && done === total;
  const lane = laneOf(chapter);
  const nodes: Array<{ lesson?: Lesson; upcoming?: string }> = [...chapter.lessons.map((l) => ({ lesson: l })), ...chapter.upcoming.slice(0, total ? 2 : 0).map((u) => ({ upcoming: u }))];
  const firstGlobal = ALL_LESSONS.findIndex((l) => l.id === chapter.lessons[0]?.id);
  const pts = nodes.map((_, i) => ({ x: OFFSETS[(Math.max(0, firstGlobal) + i) % OFFSETS.length], y: 84 + i * ROW }));
  const height = nodes.length ? pts[pts.length - 1].y + 96 : 0;
  // smooth path through the node centers (x relative to the column center)
  const path = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `C ${pts[i - 1].x} ${pts[i - 1].y + ROW / 2}, ${p.x} ${p.y - ROW / 2}, ${p.x} ${p.y}`)).join(" ");
  const doneUpTo = chapter.lessons.reduce((acc, l, i) => (completed[l.id] ? i : acc), -1);
  const donePath = pts.slice(0, doneUpTo + 2).map((p, i, arr) => (i === 0 ? `M ${p.x} ${p.y}` : `C ${arr[i - 1].x} ${arr[i - 1].y + ROW / 2}, ${p.x} ${p.y - ROW / 2}, ${p.x} ${p.y}`)).join(" ");

  return (
    <Card className={clsx("overflow-hidden", !total && "opacity-75")}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/70 p-4 sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]" style={{ background: total ? lane : "var(--border-strong)" }}>
          {mastered ? <Check className="size-5" strokeWidth={3} /> : chapter.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{chapter.title}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-2">{tierLabel(chapter.tier, t.locale, TIER_LABEL[chapter.tier])}</span>
            {mastered && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">{t("learn.mastered")}</span>}
          </p>
          <p className="text-sm text-fg-2">{chapter.description}</p>
        </div>
        {total > 0 && (
          <span className="flex items-center gap-2 text-xs text-fg-3">
            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:block">
              <span className="block h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: lane }} />
            </span>
            {done}/{total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <ul className="flex flex-wrap gap-2 p-4 sm:px-5">
          {chapter.upcoming.map((u) => (
            <li key={u} className="flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1 text-xs text-fg-3">
              <Lock className="size-3" /> {u}
            </li>
          ))}
          <li className="px-1 py-1 text-xs text-fg-3">· {t("common.comingSoon")}</li>
        </ul>
      ) : (
        <div className="relative mx-auto" style={{ height, width: "100%", maxWidth: 420 }}>
          <svg className="absolute top-0 left-1/2 overflow-visible" width="1" height={height} aria-hidden>
            <path d={path} fill="none" stroke="var(--border-strong)" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 11" />
            {doneUpTo >= 0 && (
              <motion.path
                d={donePath}
                fill="none"
                stroke={lane}
                strokeWidth="5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            )}
          </svg>
          <ol>
            {nodes.map((n, i) =>
              n.lesson ? (
                <TrailNode
                  key={n.lesson.id}
                  lesson={n.lesson}
                  x={pts[i].x}
                  y={pts[i].y}
                  lane={lane}
                  done={!!completed[n.lesson.id]}
                  stars={completed[n.lesson.id]?.stars ?? (completed[n.lesson.id] ? 1 : 0)}
                  inProgress={!!saves[n.lesson.id]}
                  unlocked={isUnlocked(n.lesson.id, completed, experience)}
                  next={n.lesson.id === nextId}
                />
              ) : (
                <li key={n.upcoming} className="absolute flex w-36 -translate-x-1/2 flex-col items-center text-center" style={{ left: `calc(50% + ${pts[i].x}px)`, top: pts[i].y - 26 }}>
                  <span className="grid size-[52px] place-items-center rounded-full border-2 border-dashed border-line-strong bg-surface text-fg-3">
                    <Lock className="size-4" />
                  </span>
                  <span className="mt-1.5 line-clamp-2 rounded-md bg-surface px-1.5 text-xs text-fg-3">{n.upcoming}</span>
                  <span className="rounded-md bg-surface px-1 text-[10px] tracking-wide text-fg-3 uppercase">{t("common.comingSoon")}</span>
                </li>
              ),
            )}
          </ol>
        </div>
      )}
    </Card>
  );
}

function TrailNode({
  lesson,
  x,
  y,
  lane,
  done,
  stars,
  inProgress,
  unlocked,
  next,
}: {
  lesson: Lesson;
  x: number;
  y: number;
  lane: string;
  done: boolean;
  stars: number;
  inProgress: boolean;
  unlocked: boolean;
  next: boolean;
}) {
  const t = useT();
  const status = done ? t("learn.completed") : inProgress ? t("learn.inProgress") : unlocked ? `${lesson.xp} XP · ${lesson.tagline}` : t("learn.lockedLesson");
  const size = next ? 68 : 60;
  const circle = (
    <span
      className={clsx(
        "relative grid place-items-center rounded-full transition-transform duration-150 group-hover:scale-105 group-active:translate-y-[3px]",
        done || next || unlocked ? "text-white" : "bg-surface-2 text-fg-3",
        lesson.boss && "rounded-[22px]",
      )}
      style={{
        width: size,
        height: size,
        background: done ? lane : next ? "var(--accent)" : unlocked ? `color-mix(in oklab, ${lane} 55%, var(--surface))` : undefined,
        boxShadow: done
          ? `0 5px 0 color-mix(in oklab, ${lane} 65%, black)`
          : next
            ? "0 5px 0 var(--accent-deep)"
            : unlocked
              ? `0 5px 0 color-mix(in oklab, ${lane} 45%, var(--border-strong))`
              : "0 5px 0 var(--border-strong)",
      }}
    >
      {done ? (
        <Check className="size-7" strokeWidth={3} />
      ) : !unlocked ? (
        <Lock className="size-5" />
      ) : lesson.boss ? (
        <Swords className="size-6" />
      ) : (
        <Play className="size-6 translate-x-0.5 fill-current" />
      )}
      {next && <span className="absolute -inset-2 animate-ping rounded-full border-2 border-accent/40 [animation-duration:2.4s]" aria-hidden />}
    </span>
  );
  const label = (
    <>
      {next && (
        <span className="bob absolute -top-9 left-1/2 rounded-lg border border-line bg-elevated px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap text-accent-fg uppercase shadow-[var(--shadow-card)]">
          {inProgress ? t("learn.continueHere") : t("learn.startHere")}
          <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-r border-b border-line bg-elevated" />
        </span>
      )}
      {circle}
      <span className={clsx("mt-2 line-clamp-2 rounded-md bg-surface px-1.5 py-0.5 text-sm leading-tight font-medium", unlocked ? "text-fg" : "text-fg-3")}>{lesson.title}</span>
      {done ? (
        <span className="mt-0.5 rounded-md bg-surface px-1" title={t("learn.stars", { n: stars })}>
          <Stars n={stars} />
          <span className="sr-only">{t("learn.stars", { n: stars })}</span>
        </span>
      ) : lesson.boss ? (
        <span className="rounded-md bg-surface px-1 text-[10px] font-bold tracking-wide text-warn uppercase">{t("learn.bossLabel")}</span>
      ) : null}
    </>
  );
  const pos = { left: `calc(50% + ${x}px)`, top: y - size / 2 };
  const cls = "group absolute flex w-36 -translate-x-1/2 flex-col items-center text-center outline-none";
  return (
    <li className="contents">
      {unlocked ? (
        <Link href={`/learn/${lesson.id}`} className={cls} style={pos} aria-label={`${lesson.title} — ${status}`} title={status}>
          {label}
        </Link>
      ) : (
        <div className={cls} style={pos} aria-label={`${lesson.title} — ${status}`} title={status} aria-disabled>
          {label}
        </div>
      )}
    </li>
  );
}

function CommandMastery({ commands }: { commands: Record<string, number> }) {
  const t = useT();
  const groups = ["Basics", "History", "Branches", "Undo", "Remote"] as const;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">{t("learn.competency")}</h2>
      <p className="mt-0.5 text-[11px] text-fg-3">{t("learn.competencyNote")}</p>
      <ul className="mt-3 space-y-2.5">
        {groups.map((g) => {
          const cmds = COMMAND_DOCS.filter((d) => d.category === g);
          const used = cmds.filter((d) => commands[d.name]).length;
          const label = categoryLabel(g, t.locale);
          return (
            <li key={g}>
              <div className="flex justify-between text-xs">
                <span className="text-fg-2">{label}</span>
                <span className="text-fg-3">
                  {used}/{cmds.length}
                </span>
              </div>
              <ProgressBar value={used / cmds.length} className="mt-1 h-1.5" label={label} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Activity({ activity }: { activity: Record<string, { xp: number }> }) {
  const t = useT();
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (20 - i));
    return { key: dayKey(d), xp: activity[dayKey(d)]?.xp ?? 0, label: d.toLocaleDateString(t.locale, { month: "short", day: "numeric" }) };
  });
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">{t("learn.lastWeeks")}</h2>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <span
            key={d.key}
            title={t("learn.dayXp", { day: d.label, xp: d.xp })}
            className={clsx("aspect-square rounded-md", d.xp === 0 ? "bg-surface-2" : d.xp < 50 ? "bg-accent/30" : d.xp < 150 ? "bg-accent/60" : "bg-accent")}
          />
        ))}
      </div>
    </Card>
  );
}
