"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  FlaskConical,
  Lightbulb,
  Lock,
  MessageCircle,
  Play,
  RotateCcw,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";
import { execute, type World } from "@/engine";
import { getChapter, getLesson, isUnlocked, nextLesson, type Lesson, type Step } from "@/features/curriculum";
import type { ChallengeStep, TryStep, WatchStep } from "@/features/curriculum/types";
import { GitGraph } from "@/features/lab/git-graph";
import { createLabStore, LabProvider, useLab } from "@/features/lab/store";
import { Workspace } from "@/features/lab/workspace";
import { useProgress } from "@/features/progress/store";
import { Button } from "@/components/ui/button";
import { ProgressBar, useHydrated } from "@/components/ui/misc";
import { Celebration } from "./celebration";
import { Scene } from "./scenes";

const STEP_LABEL: Record<Step["kind"], string> = {
  discover: "Discover",
  watch: "Watch",
  try: "Try",
  experiment: "Experiment",
  challenge: "Challenge",
  celebrate: "Celebrate",
};

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const hydrated = useHydrated();
  const lesson = getLesson(lessonId);
  if (!lesson) return <p className="p-8">Lesson not found.</p>;
  if (!hydrated) return <div className="h-dvh" aria-busy="true" />;
  return <LockGate lesson={lesson} />;
}

function LockGate({ lesson }: { lesson: Lesson }) {
  const completed = useProgress((s) => s.completed);
  const experience = useProgress((s) => s.experience);
  if (!isUnlocked(lesson.id, completed, experience))
    return (
      <div className="grid h-dvh place-items-center p-6 text-center">
        <div>
          <Lock className="mx-auto size-8 text-fg-3" />
          <h1 className="mt-4 text-xl font-semibold">“{lesson.title}” is locked</h1>
          <p className="mt-2 text-sm text-fg-2">Finish the previous lesson to unlock it — each one builds on the last.</p>
          <Link href="/learn" className="mt-6 inline-block text-sm text-violet-2 underline underline-offset-4">
            Back to your learning path
          </Link>
        </div>
      </div>
    );
  return <LessonRuntime key={lesson.id} lesson={lesson} />;
}

function LessonRuntime({ lesson }: { lesson: Lesson }) {
  const save = useProgress.getState().saves[lesson.id];
  const [start, setStart] = useState<World>(() => save?.start ?? lesson.setup());
  const [step, setStep] = useState(() => Math.min(save?.step ?? 0, lesson.steps.length - 1));
  const [ran, setRan] = useState<string[]>([]);
  const [openedAt] = useState(() => Date.now());
  const recordCommand = useProgress((s) => s.recordCommand);
  const saveLesson = useProgress((s) => s.saveLesson);
  const clearLesson = useProgress((s) => s.clearLesson);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);

  const [store] = useState(() =>
    createLabStore(save?.world ?? start, (r) => {
      if (r.command) recordCommand(r.command, r.ok, r.events, "lesson");
      if (r.ok && r.command) setRan((x) => [...x, r.command!]);
    }),
  );
  const world = useStore(store, (s) => s.world);

  // Autosave so learners can leave and come back.
  useEffect(() => {
    if (lesson.steps[step].kind === "celebrate") return;
    const t = setTimeout(() => saveLesson(lesson.id, step, world, start), 300);
    return () => clearTimeout(t);
  }, [world, step, start, lesson, saveLesson]);

  const current = lesson.steps[step];
  const goto = (i: number) => {
    setStep(Math.max(0, Math.min(lesson.steps.length - 1, i)));
    setRan([]);
  };
  const restart = () => {
    const fresh = lesson.setup();
    setStart(fresh);
    store.getState().reset(fresh, "Lesson start");
    clearLesson(lesson.id);
    goto(0);
  };

  const chapter = getChapter(lesson.chapterId)!;
  const usesWorkspace = current.kind === "try" || current.kind === "experiment" || current.kind === "challenge";
  const suggestion = current.kind === "try" && !current.check(world, start, ran) ? (current.command ?? null) : null;

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg/80 px-3 backdrop-blur sm:px-4">
      <Link href="/learn" className="flex items-center gap-1 rounded-lg p-1.5 text-fg-2 hover:bg-surface-2 hover:text-fg" aria-label="Back to learning path">
        <ArrowLeft className="size-4" />
      </Link>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-fg-3">
          Chapter {chapter.number} · {chapter.title}
        </p>
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {lesson.boss && <Swords className="size-3.5 text-amber" aria-label="Boss challenge" />}
          {lesson.title}
        </p>
      </div>
      <nav className="mx-auto hidden items-center gap-1 md:flex" aria-label="Lesson steps">
        {lesson.steps.map((s, i) => (
          <button
            key={i}
            onClick={() => i <= step && goto(i)}
            disabled={i > step}
            aria-current={i === step ? "step" : undefined}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              i === step ? "bg-violet-soft text-violet-2" : i < step ? "text-mint hover:bg-surface-2" : "text-fg-3",
            )}
          >
            {i < step ? <Check className="size-3" /> : <Circle className={clsx("size-2", i === step && "fill-current")} />}
            {STEP_LABEL[s.kind]}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <span className="hidden items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber sm:flex">
          <Sparkles className="size-3" /> {lesson.xp} XP
        </span>
        <Button variant="ghost" size="sm" onClick={restart} title="Restart lesson">
          <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">Restart</span>
        </Button>
      </div>
      <div className="absolute inset-x-0 top-14 md:hidden">
        <ProgressBar value={step / (lesson.steps.length - 1)} className="h-0.5 rounded-none" label="Lesson progress" />
      </div>
    </header>
  );

  return (
    <LabProvider store={store}>
      <div className="relative flex h-dvh flex-col">
        {header}
        <div className="min-h-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={usesWorkspace ? "workspace" : step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              {current.kind === "discover" && (
                <FocusCard eyebrow={STEP_LABEL.discover} title={current.title} onNext={() => goto(step + 1)} onBack={step > 0 ? () => goto(step - 1) : undefined}>
                  <div className="space-y-3 text-[15px] leading-relaxed text-fg-2">
                    {current.body.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Scene id={current.scene} />
                  </div>
                </FocusCard>
              )}
              {current.kind === "watch" && <WatchView step={current} onNext={() => goto(step + 1)} onBack={() => goto(step - 1)} />}
              {usesWorkspace && (
                <Workspace
                  ui={lesson.ui}
                  stagesDefault={lesson.ui.stages}
                  terminalMode={settings.terminalMode}
                  onTerminalModeChange={(m) => updateSettings({ terminalMode: m })}
                  suggestion={settings.terminalMode === "assisted" ? suggestion : null}
                  guide={<GuidePanel lesson={lesson} step={step} start={start} ran={ran} onNext={() => goto(step + 1)} onBack={() => goto(step - 1)} />}
                  mobileHeader={<MobileObjective lesson={lesson} step={step} start={start} ran={ran} world={world} />}
                />
              )}
              {current.kind === "celebrate" && <Celebration lesson={lesson} next={nextLesson(lesson.id)} onReplay={restart} startedAt={openedAt} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </LabProvider>
  );
}

function FocusCard({
  eyebrow,
  title,
  children,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="scrollbar-thin h-full overflow-y-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-violet-2 uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <div className="mt-5">{children}</div>
        <div className="mt-8 flex items-center justify-between gap-3">
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>
              <ChevronLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" onClick={onNext} disabled={nextDisabled}>
            {nextLabel} <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function WatchView({ step, onNext, onBack }: { step: WatchStep; onNext: () => void; onBack: () => void }) {
  const worlds = useMemo(() => {
    const out: Array<{ world: World; lines: string[]; events: ReturnType<typeof execute>["events"] }> = [{ world: step.setup(), lines: [], events: [] }];
    for (const f of step.frames) {
      const r = execute(out[out.length - 1].world, f.command);
      out.push({ world: r.world, lines: r.lines.map((l) => l.text), events: r.events });
    }
    return out;
  }, [step]);
  const [i, setI] = useState(0);
  const frame = i > 0 ? step.frames[i - 1] : null;
  return (
    <FocusCard eyebrow="Watch" title={step.title} onNext={onNext} onBack={onBack} nextLabel={i < step.frames.length ? "Skip ahead" : "Your turn"}>
      <p className="text-[15px] text-fg-2">{step.body}</p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-line">
        <div className="h-60 bg-surface-2/40">
          <GitGraph world={worlds[i].world} events={worlds[i].events} eventKey={i} compact />
        </div>
        <div className="terminal min-h-28 bg-term px-4 py-3 font-mono text-[13px]">
          {frame ? (
            <>
              <p>
                <span className="text-[#6ee7b7]">$</span> <span className="text-white">{frame.command}</span>
              </p>
              {worlds[i].lines.map((l, k) => (
                <p key={k} className="whitespace-pre-wrap text-[var(--t-muted)]">
                  {l}
                </p>
              ))}
            </>
          ) : (
            <p className="text-[var(--t-muted)]">Press “Next command” to run the first step.</p>
          )}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 min-h-12 text-[15px] text-fg" aria-live="polite">
          {frame?.caption ?? "Watch what each command changes in the graph."}
        </motion.p>
      </AnimatePresence>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="Previous command">
          <ChevronLeft className="size-4" /> Rewind
        </Button>
        <Button size="sm" onClick={() => setI((x) => Math.min(step.frames.length, x + 1))} disabled={i === step.frames.length}>
          <Play className="size-3.5 fill-current" /> Next command
        </Button>
        <span className="ml-auto text-xs text-fg-3">
          {i}/{step.frames.length}
        </span>
      </div>
    </FocusCard>
  );
}

/** Left panel during hands-on steps. */
function GuidePanel({ lesson, step, start, ran, onNext, onBack }: { lesson: Lesson; step: number; start: World; ran: string[]; onNext: () => void; onBack: () => void }) {
  const world = useLab((s) => s.world);
  const run = useLab((s) => s.run);
  const writeFile = useLab((s) => s.writeFile);
  const setOpenFile = useLab((s) => s.setOpenFile);
  const mode = useProgress((s) => s.settings.terminalMode);
  const current = lesson.steps[step];
  const [showCmd, setShowCmd] = useState(false);
  const [prevStep, setPrevStep] = useState(step);
  if (prevStep !== step) {
    setPrevStep(step);
    setShowCmd(false);
  }

  return (
    <div className="flex min-h-full flex-col p-5">
      <p className="text-xs font-semibold tracking-[0.14em] text-violet-2 uppercase">{STEP_LABEL[current.kind]}</p>
      {current.kind === "try" && (
        <TryView
          step={current}
          done={current.check(world, start, ran)}
          showCmd={showCmd || mode === "assisted"}
          onReveal={() => setShowCmd(true)}
          onRun={() => current.command && run(current.command)}
          onAction={() => {
            if (!current.action) return;
            writeFile(current.action.path, current.action.content);
            if (lesson.ui.editor) setOpenFile(current.action.path);
          }}
          onNext={onNext}
        />
      )}
      {current.kind === "experiment" && (
        <>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-2">{current.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {current.ideas.map((idea) => (
              <button key={idea} onClick={() => run(idea)} className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs hover:border-violet/50">
                <FlaskConical className="size-3.5 text-violet-2" /> {idea}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-fg-3">Click to run, or type anything you like. There&apos;s no wrong answer here.</p>
          <div className="mt-auto pt-6">
            <Button size="lg" className="w-full" onClick={onNext}>
              I&apos;m done exploring <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      )}
      {current.kind === "challenge" && <ChallengeView step={current} world={world} start={start} ran={ran} onNext={onNext} boss={!!lesson.boss} />}
      {step > 0 && lesson.steps[step - 1].kind !== "try" && (
        <button onClick={onBack} className="mt-4 self-start text-xs text-fg-3 hover:text-fg-2">
          ← Previous step
        </button>
      )}
    </div>
  );
}

function TryView({
  step,
  done,
  showCmd,
  onReveal,
  onRun,
  onAction,
  onNext,
}: {
  step: TryStep;
  done: boolean;
  showCmd: boolean;
  onReveal: () => void;
  onRun: () => void;
  onAction: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">{step.body}</p>
      {step.command && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-3">
          {showCmd ? (
            <>
              <code className="block font-mono text-sm break-all text-fg">{step.command}</code>
              {!done && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={onRun}>
                  <Play className="size-3 fill-current" /> Run it for me
                </Button>
              )}
            </>
          ) : (
            <button onClick={onReveal} className="flex items-center gap-2 text-sm text-fg-2 hover:text-fg">
              <Eye className="size-4" /> Show me the command
            </button>
          )}
          {step.hint && <p className="mt-2 text-xs text-fg-3">{step.hint}</p>}
        </div>
      )}
      {step.action && !done && (
        <Button className="mt-4 self-start" onClick={onAction}>
          {step.action.label}
        </Button>
      )}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="mt-5 rounded-2xl border border-mint/30 bg-mint-soft p-4"
            role="status"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-mint">
              <span className="grid size-5 place-items-center rounded-full bg-mint text-[#04261a]">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              Nice!
            </p>
            <p className="mt-1.5 text-sm text-fg">{step.success}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-auto pt-6">
        <Button size="lg" className="w-full" disabled={!done} onClick={onNext}>
          {done ? (
            <>
              Continue <ArrowRight className="size-4" />
            </>
          ) : (
            "Waiting for you…"
          )}
        </Button>
      </div>
    </>
  );
}

function ChallengeView({ step, world, start, ran, onNext, boss }: { step: ChallengeStep; world: World; start: World; ran: string[]; onNext: () => void; boss: boolean }) {
  const results = step.objectives.map((o) => o.check(world, start, ran));
  const allDone = results.every(Boolean);
  const feedback = allDone ? null : step.feedback?.(world, start);
  const [hintLevel, setHintLevel] = useState<Record<string, number>>({});
  const firstOpen = step.objectives.find((_, i) => !results[i]);
  const level = firstOpen ? (hintLevel[firstOpen.id] ?? 0) : 0;
  const hintNames = ["Idea", "Command", "Walkthrough"];
  return (
    <>
      <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight">
        {boss ? <Swords className="size-5 text-amber" /> : <Target className="size-5 text-violet-2" />}
        {step.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">{step.body}</p>
      <ul className="mt-4 space-y-2" aria-label="Objectives">
        {step.objectives.map((o, i) => (
          <motion.li
            key={o.id}
            layout
            className={clsx("flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors", results[i] ? "border-mint/30 bg-mint-soft" : "border-line bg-surface-2/50")}
          >
            <span className={clsx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", results[i] ? "border-mint bg-mint text-[#04261a]" : "border-line-strong")}>
              {results[i] && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                  <Check className="size-3" strokeWidth={3.5} />
                </motion.span>
              )}
            </span>
            <span className={results[i] ? "text-fg" : "text-fg-2"}>
              {o.label}
              <span className="sr-only">{results[i] ? " — done" : " — not done yet"}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <AnimatePresence>
        {feedback && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex gap-2 rounded-xl bg-violet-soft p-3 text-sm text-fg" role="status">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-violet-2" />
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
      {firstOpen && (
        <div className="mt-4">
          {level > 0 && (
            <div className="space-y-2">
              {firstOpen.hints.slice(0, level).map((h, i) => (
                <motion.p key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-amber/25 bg-amber-soft p-3 text-sm text-fg">
                  <span className="mb-0.5 block text-[11px] font-semibold tracking-wide text-amber uppercase">{hintNames[i]}</span>
                  {h}
                </motion.p>
              ))}
            </div>
          )}
          {level < 3 && (
            <button
              onClick={() => setHintLevel((h) => ({ ...h, [firstOpen.id]: level + 1 }))}
              className="mt-2 flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg"
            >
              <Lightbulb className="size-4 text-amber" />
              {level === 0 ? "Need a hint?" : `Show ${hintNames[level].toLowerCase()}`}
            </button>
          )}
          <p className="mt-1 text-[11px] text-fg-3">Hints are free — they never cost XP.</p>
        </div>
      )}
      <div className="mt-auto pt-6">
        <Button size="lg" variant={allDone ? "mint" : "primary"} className="w-full" disabled={!allDone} onClick={onNext}>
          {allDone ? (
            <>
              Complete lesson <ChevronRight className="size-4" />
            </>
          ) : (
            `${results.filter(Boolean).length}/${results.length} objectives`
          )}
        </Button>
      </div>
    </>
  );
}

/** On phones the current objective stays visible above every tab. */
function MobileObjective({ lesson, step, start, ran, world }: { lesson: Lesson; step: number; start: World; ran: string[]; world: World }) {
  const current = lesson.steps[step];
  let text = "";
  let done = false;
  if (current.kind === "try") {
    text = current.title;
    done = current.check(world, start, ran);
  } else if (current.kind === "challenge") {
    const open = current.objectives.find((o) => !o.check(world, start, ran));
    text = open ? open.label : "All objectives done!";
    done = !open;
  } else text = "title" in current ? current.title : "";
  return (
    <div className={clsx("flex items-center gap-2 border-b border-line px-4 py-2 text-xs", done ? "bg-mint-soft text-mint" : "bg-surface text-fg-2")}>
      {done ? <Check className="size-3.5" /> : <Target className="size-3.5 text-violet-2" />}
      <span className="truncate">{text}</span>
      {done && <span className="ml-auto shrink-0 font-medium">Open Guide to continue</span>}
    </div>
  );
}

