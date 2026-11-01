"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Flame, Lock, Play, Sparkles, Swords, Target, Trophy } from "lucide-react";
import { ALL_LESSONS, CHAPTERS, isUnlocked, TIER_LABEL, type Chapter, type Lesson } from "@/features/curriculum";
import { COMMAND_DOCS } from "@/features/docs/commands";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, DynamicIcon, ProgressBar, useHydrated } from "@/components/ui/misc";
import { useProgress } from "./store";
import { ACHIEVEMENTS, dayKey, emptyDay, LEVEL_TITLES, levelFor, questsFor, streak } from "./rules";

export function LearnDashboard() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <Dashboard />;
}

function Dashboard() {
  const p = useProgress();
  const lv = levelFor(p.xp);
  const next = ALL_LESSONS.find((l) => !p.completed[l.id] && isUnlocked(l.id, p.completed, p.experience)) ?? null;
  const today = dayKey();
  const day = p.activity[today] ?? emptyDay();
  const quests = questsFor(today);
  const claimed = p.questsClaimed[today] ?? [];
  const days = streak(p.activity);
  const doneCount = Object.keys(p.completed).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-28 md:pb-16">
      {!p.onboarded && <Onboarding />}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="relative overflow-hidden p-6 sm:p-8">
            <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-violet/20 blur-3xl" aria-hidden />
            <p className="text-sm text-fg-2">{p.name ? `Welcome back, ${p.name}` : doneCount ? "Welcome back" : "Welcome to Gitverse"} 👋</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {next ? (doneCount ? "Ready for your next lesson?" : "Let's make your first commit.") : "You've finished every lesson available!"}
            </h1>
            {next ? (
              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-2/60 p-4">
                  <p className="text-xs text-fg-3">
                    Chapter {CHAPTERS.find((c) => c.id === next.chapterId)!.number} · {p.saves[next.id] ? "In progress" : "Up next"}
                  </p>
                  <p className="mt-0.5 font-semibold">{next.title}</p>
                  <p className="text-sm text-fg-2">{next.tagline}</p>
                </div>
                <LinkButton href={`/learn/${next.id}`} size="lg">
                  <Play className="size-4 fill-current" /> {p.saves[next.id] ? "Resume" : "Start"}
                </LinkButton>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <LinkButton href="/playground">Open the Playground</LinkButton>
                <LinkButton href="/commands" variant="secondary">
                  Browse commands
                </LinkButton>
              </div>
            )}
          </Card>

          <section aria-labelledby="path-title">
            <h2 id="path-title" className="mt-8 mb-4 text-lg font-semibold">
              Your learning path
            </h2>
            <div className="space-y-4">
              {CHAPTERS.map((c) => (
                <ChapterBlock key={c.id} chapter={c} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet to-violet-2 text-lg font-bold text-white shadow-[0_8px_24px_-8px_var(--violet)]">
                {lv.level}
              </span>
              <div>
                <p className="text-xs text-fg-3">Level {lv.level}</p>
                <p className="font-semibold">{LEVEL_TITLES[lv.level - 1]}</p>
              </div>
              <span className="ml-auto flex items-center gap-1 text-sm font-semibold text-amber">
                <Sparkles className="size-4" />
                {p.xp}
              </span>
            </div>
            <ProgressBar value={lv.progress} className="mt-4" label="Progress to next level" />
            <p className="mt-1.5 text-[11px] text-fg-3">{lv.ceil - p.xp} XP to level {lv.level + 1}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Lessons" value={`${doneCount}/${ALL_LESSONS.length}`} />
              <Stat label="Commands" value={String(Object.keys(p.commands).length)} />
              <Stat label={p.settings.showStreak ? "Day streak" : "Badges"} value={p.settings.showStreak ? String(days) : String(Object.keys(p.achievements).length)} icon={p.settings.showStreak && days > 0 ? <Flame className="size-3.5 text-amber" /> : undefined} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Target className="size-4 text-mint" /> Daily quests
            </h2>
            <ul className="mt-3 space-y-3">
              {quests.map((q) => {
                const prog = Math.min(q.target, q.progress(day));
                const done = claimed.includes(q.id);
                return (
                  <li key={q.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={clsx(done ? "text-fg-3 line-through" : "text-fg")}>{q.title}</span>
                      <span className="shrink-0 text-xs text-fg-3">{done ? <Check className="size-4 text-mint" /> : `${prog}/${q.target}`}</span>
                    </div>
                    <ProgressBar value={prog / q.target} tone="mint" className="mt-1.5 h-1.5" label={q.title} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-fg-3">+20 XP each. New quests every day — no pressure to keep a streak.</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Trophy className="size-4 text-amber" /> Badges
              </h2>
              <Link href="/profile" className="text-xs text-fg-3 hover:text-fg-2">
                See all
              </Link>
            </div>
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {ACHIEVEMENTS.slice(0, 10).map((a) => {
                const got = !!p.achievements[a.id];
                return (
                  <li key={a.id} title={`${a.title} — ${a.description}`} className={clsx("grid aspect-square place-items-center rounded-xl", got ? "bg-amber-soft text-amber" : "bg-surface-2 text-fg-3 opacity-50")}>
                    <DynamicIcon name={a.icon} className="size-4" />
                    <span className="sr-only">
                      {a.title}: {got ? "earned" : "locked"}
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

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <p className="flex items-center justify-center gap-1 text-sm font-semibold">
        {icon}
        {value}
      </p>
      <p className="text-[10px] text-fg-3">{label}</p>
    </div>
  );
}

function ChapterBlock({ chapter }: { chapter: Chapter }) {
  const completed = useProgress((s) => s.completed);
  const saves = useProgress((s) => s.saves);
  const experience = useProgress((s) => s.experience);
  const done = chapter.lessons.filter((l) => completed[l.id]).length;
  const total = chapter.lessons.length;
  const mastered = total > 0 && done === total;
  const available = chapter.lessons.some((l) => isUnlocked(l.id, completed, experience));
  const state = !total ? "soon" : mastered ? "mastered" : done > 0 ? "progress" : available ? "available" : "locked";
  return (
    <Card className={clsx("p-5", state === "locked" || state === "soon" ? "opacity-70" : "")}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={clsx(
            "grid size-10 place-items-center rounded-2xl font-mono text-sm font-semibold",
            state === "mastered" ? "bg-mint text-[#04261a]" : state === "progress" || state === "available" ? "bg-violet-soft text-violet-2" : "bg-surface-2 text-fg-3",
          )}
        >
          {state === "mastered" ? <Check className="size-5" strokeWidth={3} /> : state === "locked" ? <Lock className="size-4" /> : chapter.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {chapter.title}
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-fg-2">{TIER_LABEL[chapter.tier]}</span>
            {state === "mastered" && <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-medium text-mint">Mastered</span>}
          </p>
          <p className="text-sm text-fg-2">{chapter.description}</p>
        </div>
        {total > 0 && <span className="text-xs text-fg-3">{done}/{total}</span>}
      </div>
      <ol className="relative mt-5 flex flex-wrap gap-3">
        {chapter.lessons.map((l) => (
          <LessonNode key={l.id} lesson={l} done={!!completed[l.id]} inProgress={!!saves[l.id]} unlocked={isUnlocked(l.id, completed, experience)} />
        ))}
        {chapter.upcoming.map((t) => (
          <li key={t} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-2.5 text-sm text-fg-3 sm:w-[calc(50%-0.375rem)]">
            <span className="grid size-8 place-items-center rounded-full bg-surface-2">
              <Lock className="size-3.5" />
            </span>
            <span className="min-w-0 truncate">{t}</span>
            <span className="ml-auto shrink-0 text-[10px]">coming soon</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function LessonNode({ lesson, done, inProgress, unlocked }: { lesson: Lesson; done: boolean; inProgress: boolean; unlocked: boolean }) {
  const content = (
    <>
      <span
        className={clsx(
          "relative grid size-10 shrink-0 place-items-center rounded-full border-2 transition-transform group-hover:scale-105",
          done ? "border-mint bg-mint text-[#04261a]" : unlocked ? "border-violet bg-violet-soft text-violet-2" : "border-line bg-surface-2 text-fg-3",
        )}
      >
        {done ? <Check className="size-5" strokeWidth={3} /> : !unlocked ? <Lock className="size-4" /> : lesson.boss ? <Swords className="size-4" /> : <Play className="size-4 fill-current" />}
        {unlocked && !done && <span className="absolute inset-0 animate-ping rounded-full border border-violet/50 [animation-duration:2.5s]" aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{lesson.title}</span>
        <span className="block truncate text-xs text-fg-3">
          {done ? "Completed · replay anytime" : inProgress ? "In progress" : unlocked ? `${lesson.xp} XP · ${lesson.tagline}` : "Finish the previous lesson to unlock"}
        </span>
      </span>
    </>
  );
  const cls = "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 sm:w-[calc(50%-0.375rem)]";
  return (
    <li className="contents">
      {unlocked ? (
        <Link href={`/learn/${lesson.id}`} className={clsx(cls, done ? "border-mint/20 hover:border-mint/40" : "border-violet/30 bg-violet-soft/30 hover:border-violet/60")}>
          {content}
        </Link>
      ) : (
        <div className={clsx(cls, "border-line")} aria-disabled>
          {content}
        </div>
      )}
    </li>
  );
}

function CommandMastery({ commands }: { commands: Record<string, number> }) {
  const groups = ["Basics", "History", "Branches", "Undo", "Remote"] as const;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Git competency</h2>
      <p className="mt-0.5 text-[11px] text-fg-3">Based on commands you&apos;ve used successfully.</p>
      <ul className="mt-3 space-y-2.5">
        {groups.map((g) => {
          const cmds = COMMAND_DOCS.filter((d) => d.category === g);
          const used = cmds.filter((d) => commands[d.name]).length;
          return (
            <li key={g}>
              <div className="flex justify-between text-xs">
                <span className="text-fg-2">{g}</span>
                <span className="text-fg-3">
                  {used}/{cmds.length}
                </span>
              </div>
              <ProgressBar value={used / cmds.length} className="mt-1 h-1.5" label={`${g} commands`} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Activity({ activity }: { activity: Record<string, { xp: number }> }) {
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (20 - i));
    return { key: dayKey(d), xp: activity[dayKey(d)]?.xp ?? 0, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
  });
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Last 3 weeks</h2>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <span
            key={d.key}
            title={`${d.label}: ${d.xp} XP`}
            className={clsx("aspect-square rounded-md", d.xp === 0 ? "bg-surface-2" : d.xp < 50 ? "bg-violet/30" : d.xp < 150 ? "bg-violet/60" : "bg-violet")}
          />
        ))}
      </div>
    </Card>
  );
}

function Onboarding() {
  const setName = useProgress((s) => s.setName);
  const finish = useProgress((s) => s.finishOnboarding);
  const [name, setLocal] = useState("");
  const [exp, setExp] = useState<"new" | "some" | "comfortable">("new");
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const choices = [
    { id: "new" as const, title: "I'm brand new", body: "Never used Git. Start from the very beginning." },
    { id: "some" as const, title: "I've tried it a bit", body: "Unlock the first chapters so you can skip around." },
    { id: "comfortable" as const, title: "I use Git already", body: "Unlock everything and jump to what you need." },
  ];
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-labelledby="onb-title">
        <motion.div initial={{ y: 16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} className="w-full max-w-md rounded-3xl border border-line bg-elevated p-6 shadow-2xl">
          <h2 id="onb-title" className="text-xl font-semibold">
            Welcome! Quick setup
          </h2>
          <p className="mt-1 text-sm text-fg-2">Two questions, then you&apos;re in. You can change this later.</p>
          <label className="mt-5 block text-sm font-medium" htmlFor="onb-name">
            What should we call you? <span className="text-fg-3">(optional)</span>
          </label>
          <input
            id="onb-name"
            value={name}
            onChange={(e) => setLocal(e.target.value.slice(0, 30))}
            placeholder="Your first name"
            className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-violet"
          />
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">Have you used Git before?</legend>
            <div className="mt-2 space-y-2">
              {choices.map((c) => (
                <label key={c.id} className={clsx("flex cursor-pointer gap-3 rounded-xl border p-3", exp === c.id ? "border-violet bg-violet-soft" : "border-line hover:border-line-strong")}>
                  <input type="radio" name="exp" className="mt-1 accent-[var(--violet)]" checked={exp === c.id} onChange={() => setExp(c.id)} />
                  <span>
                    <span className="block text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-fg-2">{c.body}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                finish("new");
                setOpen(false);
              }}
            >
              Skip
            </Button>
            <Button
              onClick={() => {
                if (name.trim()) setName(name.trim());
                finish(exp);
                setOpen(false);
              }}
            >
              Let&apos;s go <ArrowRight className="size-4" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
