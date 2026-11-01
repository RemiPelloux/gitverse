"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, GitCommitHorizontal, PartyPopper, Map as MapIcon, RotateCcw, Terminal } from "lucide-react";
import type { Lesson } from "@/features/curriculum";
import { useProgress } from "@/features/progress/store";
import { ACHIEVEMENTS, LEVEL_TITLES, levelFor } from "@/features/progress/rules";
import { Button, LinkButton } from "@/components/ui/button";
import { DynamicIcon, ProgressBar } from "@/components/ui/misc";

export function Celebration({ lesson, next, onReplay, startedAt }: { lesson: Lesson; next: Lesson | null; onReplay: () => void; startedAt: number }) {
  const completeLesson = useProgress((s) => s.completeLesson);
  const clearLesson = useProgress((s) => s.clearLesson);
  const xp = useProgress((s) => s.xp);
  const achievements = useProgress((s) => s.achievements);
  const [result, setResult] = useState<{ gained: number; first: boolean } | null>(null);
  const done = useRef(false);
  const [xpBefore] = useState(() => useProgress.getState().xp);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    setResult(completeLesson(lesson.id, lesson.xp, !!lesson.boss));
    clearLesson(lesson.id);
  }, [completeLesson, clearLesson, lesson]);

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    if (!result) return;
    const c = animate(count, result.gained, { duration: 1.1, ease: "easeOut", delay: 0.3 });
    return () => c.stop();
  }, [result, count]);

  const lv = levelFor(xp);
  const leveledUp = levelFor(xpBefore).level < lv.level && !!result?.gained;
  const recent = ACHIEVEMENTS.filter((a) => (achievements[a.id] ?? 0) >= startedAt);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto px-4 py-10">
      <div className="mx-auto max-w-xl text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="relative mx-auto grid size-24 place-items-center"
        >
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-ok"
            initial={{ scale: 0.85, opacity: 0.6 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.2, ease: "easeOut" }}
          />
          <span className="grid size-20 place-items-center rounded-full bg-ok">
            <Check className="size-10 text-[var(--on-ok)]" strokeWidth={2.5} />
          </span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6 text-3xl font-semibold tracking-tight">
          Lesson complete!
        </motion.h1>
        <p className="mt-2 text-fg-2">{lesson.title}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface p-4 text-left">
            <p className="text-xs text-fg-3">XP earned</p>
            <p className="mt-1 flex items-baseline gap-1 text-3xl font-semibold text-warn">
              +<motion.span>{rounded}</motion.span>
              <GitCommitHorizontal className="size-5" />
            </p>
            {result && !result.first && <p className="mt-1 text-xs text-fg-3">Replay — XP is only awarded the first time, but practice always counts.</p>}
          </div>
          <div className="rounded-lg border border-line bg-surface p-4 text-left">
            <p className="text-xs text-fg-3">Level {lv.level}</p>
            <p className="mt-1 font-semibold">{LEVEL_TITLES[lv.level - 1]}</p>
            <ProgressBar value={lv.progress} className="mt-3" label="Level progress" />
            <p className="mt-1.5 text-[11px] text-fg-3">
              {xp - lv.floor} / {lv.ceil - lv.floor} XP to level {lv.level + 1}
            </p>
            {leveledUp && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-accent-fg">
                <PartyPopper className="size-3.5" /> Level up!
              </p>
            )}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="mt-3 rounded-lg border border-line bg-surface p-4 text-left">
            <p className="text-xs text-fg-3">Badges earned in this lesson</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {recent.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.12, type: "spring", stiffness: 300, damping: 18 }}
                  className="flex items-center gap-2 rounded-md bg-warn-soft px-3 py-1.5 text-sm"
                >
                  <DynamicIcon name={a.icon} className="size-4 text-warn" /> {a.title}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-line bg-surface p-5 text-left">
          <p className="text-xs font-semibold text-fg-3 ">What you learned</p>
          <ul className="mt-3 space-y-2">
            {lesson.recap.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-fg-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ok" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-semibold text-fg-3 ">Commands</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lesson.commands.map((c) => (
              <code key={c} className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">
                <Terminal className="size-3 text-accent-fg" />
                {c}
              </code>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          {next ? (
            <LinkButton href={`/learn/${next.id}`} size="lg">
              Next: {next.title} <ArrowRight className="size-4" />
            </LinkButton>
          ) : (
            <LinkButton href="/playground" size="lg">
              Open the Playground <ArrowRight className="size-4" />
            </LinkButton>
          )}
          <LinkButton href="/learn" variant="secondary" size="lg">
            <MapIcon className="size-4" /> Learning path
          </LinkButton>
          <Button variant="ghost" size="lg" onClick={onReplay}>
            <RotateCcw className="size-4" /> Replay
          </Button>
        </div>
      </div>
    </div>
  );
}
