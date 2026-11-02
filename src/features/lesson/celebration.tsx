"use client";

import { clsx } from "clsx";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, GitCommitHorizontal, Map as MapIcon, PartyPopper, RotateCcw, Sparkles, Terminal, X } from "lucide-react";
import type { Lesson } from "@/features/curriculum";
import { useProgress } from "@/features/progress/store";
import { ACHIEVEMENTS, levelFor, starsFor } from "@/features/progress/rules";
import { useT, type MessageKey } from "@/i18n";
import { Button, LinkButton } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { DynamicIcon, ProgressBar } from "@/components/ui/misc";
import type { RunStats } from "./lesson-player";

type Result = { gained: number; first: boolean; bonus: number; best: number };

export function Celebration({
  lesson,
  next,
  onReplay,
  startedAt,
  stats,
}: {
  lesson: Lesson;
  next: Lesson | null;
  onReplay: () => void;
  startedAt: number;
  stats: RunStats;
}) {
  const t = useT();
  const completeLesson = useProgress((s) => s.completeLesson);
  const clearLesson = useProgress((s) => s.clearLesson);
  const xp = useProgress((s) => s.xp);
  const name = useProgress((s) => s.name);
  const achievements = useProgress((s) => s.achievements);
  const [result, setResult] = useState<Result | null>(null);
  const done = useRef(false);
  const [xpBefore] = useState(() => useProgress.getState().xp);
  const [prevBest] = useState(() => useProgress.getState().completed[lesson.id]?.stars ?? 0);
  const stars = starsFor(stats);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    setResult(completeLesson(lesson.id, lesson.xp, !!lesson.boss, stars));
    clearLesson(lesson.id);
  }, [completeLesson, clearLesson, lesson, stars]);

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    if (!result) return;
    const c = animate(count, result.gained, { duration: 1.1, ease: "easeOut", delay: 0.9 });
    return () => c.stop();
  }, [result, count]);

  const lv = levelFor(xp);
  const leveledUp = levelFor(xpBefore).level < lv.level && !!result?.gained;
  const recent = ACHIEVEMENTS.filter((a) => (achievements[a.id] ?? 0) >= startedAt);
  const reasons = t.list("celebrate.starReasons");
  const earned = [true, !stats.walkthrough, stats.mistakes <= 2];
  const titles = t.list("levels");

  return (
    <div className="scrollbar-thin bg-dots h-full overflow-y-auto px-4 py-10">
      <div className="relative mx-auto max-w-xl text-center">
        <Confetti count={stars === 3 ? 56 : 30} />
        <div className="flex items-end justify-center gap-2" role="img" aria-label={t("learn.stars", { n: stars })}>
          {[1, 2, 3].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -40, y: 10 }}
              animate={{ scale: 1, rotate: 0, y: i === 2 ? -10 : 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 13, delay: 0.15 + i * 0.22 }}
            >
              <svg viewBox="0 0 24 24" className={clsx(i === 2 ? "size-20" : "size-16", "drop-shadow-[0_3px_0_rgba(0,0,0,0.12)]", i <= stars ? "text-(color:--star)" : "text-line-strong")}>
                <path
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                  d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z"
                />
              </svg>
            </motion.span>
          ))}
        </div>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-6 text-3xl font-semibold tracking-tight">
          {name ? t("celebrate.titleName", { name }) : t("celebrate.title")}
        </motion.h1>
        <p className="mt-1 text-fg-2">{lesson.title}</p>
        {stars > prevBest && prevBest > 0 && <p className="mt-2 text-sm font-semibold text-warn">{t("celebrate.newBest")}</p>}

        <ul className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
          {reasons.map((r, i) => (
            <motion.li
              key={r}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.1 }}
              className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", earned[i] ? "border-[var(--star)]/40 bg-warn-soft text-fg" : "border-line text-fg-3")}
            >
              {earned[i] ? <Check className="size-3.5 text-warn" strokeWidth={3} /> : <X className="size-3.5" />}
              {r}
            </motion.li>
          ))}
        </ul>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)]">
            <p className="text-xs text-fg-3">{t("celebrate.xpEarned")}</p>
            <p className="mt-1 flex items-baseline gap-1 text-3xl font-semibold text-warn">
              +<motion.span>{rounded}</motion.span>
              <GitCommitHorizontal className="size-5" />
            </p>
            {!!result?.bonus && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-accent-fg">
                <Sparkles className="size-3.5" /> {t("celebrate.flawlessBonus", { n: result.bonus })}
              </p>
            )}
            {result && !result.first && <p className="mt-1 text-xs text-fg-3">{t("celebrate.replayNote")}</p>}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)]">
            <p className="text-xs text-fg-3">{t("common.level", { n: lv.level })}</p>
            <p className="mt-1 font-semibold">{titles[lv.level - 1]}</p>
            <ProgressBar value={lv.progress} className="mt-3" label={t("learn.levelProgress")} />
            <p className="mt-1.5 text-[11px] text-fg-3">{t("celebrate.toNext", { xp: xp - lv.floor, span: lv.ceil - lv.floor, n: lv.level + 1 })}</p>
            {leveledUp && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-accent-fg">
                <PartyPopper className="size-3.5" /> {t("celebrate.levelUp")}
              </p>
            )}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="mt-3 rounded-xl border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)]">
            <p className="text-xs text-fg-3">{t("celebrate.badges")}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {recent.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.2 + i * 0.12, type: "spring", stiffness: 300, damping: 18 }}
                  className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-1.5 text-sm"
                >
                  <DynamicIcon name={a.icon} className="size-4 text-warn" /> {t(`badges.${a.id}.title` as MessageKey)}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 rounded-xl border border-line bg-surface p-5 text-left shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold text-fg-3">{t("celebrate.learned")}</p>
          <ul className="mt-3 space-y-2">
            {lesson.recap.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-fg-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ok" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-semibold text-fg-3">{t("celebrate.commands")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lesson.commands.map((c) => (
              <code key={c} className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">
                <Terminal className="size-3 text-accent-fg" />
                {c}
              </code>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {next ? (
            <LinkButton href={`/learn/${next.id}`} size="lg">
              {t("celebrate.next", { title: next.title })} <ArrowRight className="size-4" />
            </LinkButton>
          ) : (
            <LinkButton href="/playground" size="lg">
              {t("celebrate.openPlayground")} <ArrowRight className="size-4" />
            </LinkButton>
          )}
          <LinkButton href="/learn" variant="secondary" size="lg">
            <MapIcon className="size-4" /> {t("celebrate.path")}
          </LinkButton>
          <Button variant="ghost" size="lg" onClick={onReplay}>
            <RotateCcw className="size-4" /> {t("celebrate.replay")}
          </Button>
        </div>
      </div>
    </div>
  );
}
