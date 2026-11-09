"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Eye,
  FlaskConical,
  Lightbulb,
  Lock,
  MessageCircle,
  Play,
  RotateCcw,
  GitCommitHorizontal,
  Swords,
  Target,
} from "lucide-react";
import { execute, type World } from "@/engine";
import { getChapter, getLesson, isUnlocked, nextLesson, type Lesson, type Step } from "@/features/curriculum";
import { localizedChapters, localizeLesson } from "@/features/curriculum/localize";
import type { ChallengeStep, TryStep, WatchStep } from "@/features/curriculum/types";
import { GitGraph } from "@/features/lab/git-graph";
import { snapshotTerminal } from "@/features/lab/persistence";
import { createLabStore, LabProvider, useLab } from "@/features/lab/store";
import { Workspace } from "@/features/lab/workspace";
import { withLearner } from "@/features/progress/learner";
import { useProgress } from "@/features/progress/store";
import { useT, type MessageKey } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ProgressBar, useHydrated } from "@/components/ui/misc";
import { localizedDocs } from "@/features/docs/commands";
import { CheatsheetDrawer } from "@/features/docs/cheatsheet";
import { Celebration } from "./celebration";
import { Scene } from "./scenes";

const stepLabel = (t: ReturnType<typeof useT>, kind: Step["kind"]) => t(`steps.${kind}` as MessageKey);

/** How the learner is doing in this run of the lesson (drives the stars). */
export interface RunStats {
  mistakes: number;
  walkthrough: boolean;
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const t = useT();
  const hydrated = useHydrated();
  const base = getLesson(lessonId);
  if (!base) return <p className="p-8">{t("lesson.notFound")}</p>;
  if (!hydrated) return <div className="h-dvh" aria-busy="true" />;
  return <LockGate lesson={localizeLesson(base, t.locale)} />;
}

function LockGate({ lesson }: { lesson: Lesson }) {
  const t = useT();
  const completed = useProgress((s) => s.completed);
  const experience = useProgress((s) => s.experience);
  if (!isUnlocked(lesson.id, completed, experience))
    return (
      <div className="grid h-dvh place-items-center p-6 text-center">
        <div>
          <Lock className="mx-auto size-8 text-fg-3" />
          <h1 className="mt-4 text-xl font-semibold">{t("lesson.lockedTitle", { title: lesson.title })}</h1>
          <p className="mt-2 text-sm text-fg-2">{t("lesson.lockedBody")}</p>
          <Link href="/learn" className="mt-6 inline-block text-sm text-accent-fg underline underline-offset-4">
            {t("lesson.backToPath")}
          </Link>
        </div>
      </div>
    );
  return <LessonRuntime key={lesson.id} lesson={lesson} />;
}

function LessonRuntime({ lesson }: { lesson: Lesson }) {
  const t = useT();
  const save = useProgress.getState().saves[lesson.id];
  const learnerName = useProgress((s) => s.name);
  const fresh = () => withLearner(lesson.setup(), useProgress.getState().name);
  const [start, setStart] = useState<World>(() => save?.start ?? fresh());
  const [stats, setStats] = useState<RunStats>({ mistakes: 0, walkthrough: false });
  const [step, setStep] = useState(() => Math.min(save?.step ?? 0, lesson.steps.length - 1));
  const [ran, setRan] = useState<string[]>([]);
  const [openedAt] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const recordCommand = useProgress((s) => s.recordCommand);
  const saveLesson = useProgress((s) => s.saveLesson);
  const clearLesson = useProgress((s) => s.clearLesson);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);

  const [store] = useState(() =>
    createLabStore(
      save?.world ?? start,
      (r) => {
        if (r.command) recordCommand(r.command, r.ok, r.events, "lesson");
        if (r.ok && r.command) setRan((x) => [...x, r.command!]);
        // A failed command that isn't an intended conflict counts as a mistake.
        if (!r.ok && r.command && !r.world.repo?.op) setStats((st) => ({ ...st, mistakes: st.mistakes + 1 }));
      },
      save?.terminal,
    ),
  );
  const world = useStore(store, (s) => s.world);
  const entries = useStore(store, (s) => s.entries);

  // Autosave so learners can leave and come back.
  useEffect(() => {
    if (lesson.steps[step].kind === "celebrate") return;
    // State only changes once per command or (debounced) edit, so save right away: nothing is lost on reload.
    saveLesson(lesson.id, step, world, start, snapshotTerminal(store.getState()));
  }, [world, entries, step, start, lesson, saveLesson, store]);

  const current = lesson.steps[step];
  // Don't interrupt hands-on steps with the level-up popup; it shows on the celebration screen.
  const setHold = useProgress((s) => s.setHoldCelebrations);
  useEffect(() => {
    setHold(current.kind !== "celebrate");
    return () => setHold(false);
  }, [current.kind, setHold]);
  const goto = (i: number) => {
    setStep(Math.max(0, Math.min(lesson.steps.length - 1, i)));
    setRan([]);
  };
  const restart = () => {
    const w = fresh();
    setStart(w);
    store.getState().reset(w, "Lesson start");
    clearLesson(lesson.id);
    setStats({ mistakes: 0, walkthrough: false });
    goto(0);
  };

  const chapter = localizedChapters(t.locale).find((c) => c.id === lesson.chapterId) ?? getChapter(lesson.chapterId)!;
  const nextBase = nextLesson(lesson.id);
  const next = nextBase ? localizeLesson(nextBase, t.locale) : null;
  const usesWorkspace = current.kind === "try" || current.kind === "experiment" || current.kind === "challenge";
  const suggestion = current.kind === "try" && !current.check(world, start, ran) ? (current.command ?? null) : null;

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg px-3 sm:px-4">
      <Link href="/learn" className="flex items-center gap-1 rounded-lg p-1.5 text-fg-2 hover:bg-surface-2 hover:text-fg" aria-label={t("lesson.backToPath")}>
        <ArrowLeft className="size-4" />
      </Link>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-fg-3">
          {t("lesson.chapter", { n: chapter.number, title: chapter.title })}
        </p>
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {lesson.boss && <Swords className="size-3.5 text-warn" aria-label={t("lesson.boss")} />}
          {lesson.title}
        </p>
      </div>
      <nav className="mx-auto hidden items-center gap-1 md:flex" aria-label={t("lesson.stepsNav")}>
        {lesson.steps.map((s, i) => (
          <button
            key={i}
            onClick={() => i <= step && goto(i)}
            disabled={i > step}
            aria-current={i === step ? "step" : undefined}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              i === step ? "bg-accent-soft text-accent-fg" : i < step ? "text-ok hover:bg-surface-2" : "text-fg-3",
            )}
          >
            {i < step ? <Check className="size-3" /> : <Circle className={clsx("size-2", i === step && "fill-current")} />}
            {stepLabel(t, s.kind)}
            {lesson.steps.filter((x) => x.kind === s.kind).length > 1 && (
              <span className="tabular-nums opacity-70">{lesson.steps.slice(0, i + 1).filter((x) => x.kind === s.kind).length}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <span className="hidden items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn sm:flex">
          <GitCommitHorizontal className="size-3.5" /> {lesson.xp} XP
        </span>
        <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)} title={t("lesson.cheatsheet")} aria-haspopup="dialog">
          <ClipboardList className="size-3.5" /> <span className="hidden sm:inline">{t("lesson.cheatsheet")}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={restart} title={t("lesson.restartTitle")}>
          <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">{t("lesson.restart")}</span>
        </Button>
      </div>
      <div className="absolute inset-x-0 top-14 md:hidden">
        <ProgressBar value={step / (lesson.steps.length - 1)} className="h-0.5 rounded-none" label={t("lesson.progress")} />
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
                <FocusCard eyebrow={stepLabel(t, "discover")} title={current.title} onNext={() => goto(step + 1)} onBack={step > 0 ? () => goto(step - 1) : undefined}>
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
                  guide={
                    <GuidePanel
                      lesson={lesson}
                      step={step}
                      start={start}
                      ran={ran}
                      name={learnerName}
                      onWalkthrough={() => setStats((st) => (st.walkthrough ? st : { ...st, walkthrough: true }))}
                      onNext={() => goto(step + 1)}
                      onBack={() => goto(step - 1)}
                    />
                  }
                  mobileHeader={<MobileObjective lesson={lesson} step={step} start={start} ran={ran} world={world} />}
                />
              )}
              {current.kind === "celebrate" && <Celebration lesson={lesson} next={next} onReplay={restart} startedAt={openedAt} stats={stats} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <CheatsheetDrawer open={sheetOpen} onClose={closeSheet} commands={lesson.commands} />
    </LabProvider>
  );
}

function FocusCard({
  eyebrow,
  title,
  children,
  onNext,
  onBack,
  nextLabel,
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
  const t = useT();
  return (
    <div className="scrollbar-thin h-full overflow-y-auto px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold text-accent-fg ">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        <div className="mt-5">{children}</div>
        <div className="mt-8 flex items-center justify-between gap-3">
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>
              <ChevronLeft className="size-4" /> {t("common.back")}
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" onClick={onNext} disabled={nextDisabled}>
            {nextLabel ?? t("common.continue")} <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function WatchView({ step, onNext, onBack }: { step: WatchStep; onNext: () => void; onBack: () => void }) {
  const t = useT();
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
    <FocusCard eyebrow={stepLabel(t, "watch")} title={step.title} onNext={onNext} onBack={onBack} nextLabel={i < step.frames.length ? t("lesson.skipAhead") : t("lesson.yourTurn")}>
      <p className="text-[15px] text-fg-2">{step.body}</p>
      <div className="mt-5 overflow-hidden rounded-lg border border-line">
        <div className="h-60 bg-surface-2/40">
          <GitGraph world={worlds[i].world} events={worlds[i].events} eventKey={i} compact />
        </div>
        <div className="terminal min-h-28 bg-term px-4 py-3 font-mono text-[13px]">
          {frame ? (
            <>
              <p>
                <span className="text-[var(--t-green)]">$</span> <span className="text-white">{frame.command}</span>
              </p>
              {worlds[i].lines.map((l, k) => (
                <p key={k} className="whitespace-pre-wrap text-[var(--t-muted)]">
                  {l}
                </p>
              ))}
            </>
          ) : (
            <p className="text-[var(--t-muted)]">{t("lesson.watchStart")}</p>
          )}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 min-h-12 text-[15px] text-fg" aria-live="polite">
          {frame?.caption ?? t("lesson.watchHint")}
        </motion.p>
      </AnimatePresence>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label={t("lesson.previousCommand")}>
          <ChevronLeft className="size-4" /> {t("lesson.rewind")}
        </Button>
        <Button size="sm" onClick={() => setI((x) => Math.min(step.frames.length, x + 1))} disabled={i === step.frames.length}>
          <Play className="size-3.5 fill-current" /> {t("lesson.nextCommand")}
        </Button>
        <span className="ml-auto text-xs text-fg-3">
          {i}/{step.frames.length}
        </span>
      </div>
    </FocusCard>
  );
}

/** Left panel during hands-on steps. */
function GuidePanel({
  lesson,
  step,
  start,
  ran,
  name,
  onWalkthrough,
  onNext,
  onBack,
}: {
  lesson: Lesson;
  step: number;
  start: World;
  ran: string[];
  name: string;
  onWalkthrough: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const world = useLab((s) => s.world);
  const run = useLab((s) => s.run);
  const writeFile = useLab((s) => s.writeFile);
  const setOpenFile = useLab((s) => s.setOpenFile);
  const mode = useProgress((s) => s.settings.terminalMode);
  const current = lesson.steps[step];
  const [showCmd, setShowCmd] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [prevStep, setPrevStep] = useState(step);
  if (prevStep !== step) {
    setPrevStep(step);
    setShowCmd(false);
    setHintLevel(0);
  }

  return (
    <div className="flex min-h-full flex-col p-5">
      <p className="text-xs font-semibold text-accent-fg ">{stepLabel(t, current.kind)}</p>
      {current.kind === "try" && (
        <TryView
          step={current}
          done={current.check(world, start, ran)}
          showCmd={showCmd || mode === "assisted"}
          onReveal={() => setShowCmd(true)}
          hintLevel={hintLevel}
          onHint={() => setHintLevel(1)}
          onRun={() => current.command && run(current.command)}
          onAction={() => {
            if (!current.action) return;
            writeFile(current.action.path, current.action.content);
            if (lesson.ui.editor) setOpenFile(current.action.path);
          }}
          onNext={onNext}
          name={name}
        />
      )}
      {current.kind === "experiment" && (
        <>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-2">{current.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {current.ideas.map((idea) => (
              <button key={idea} onClick={() => run(idea)} className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs hover:border-accent/50">
                <FlaskConical className="size-3.5 text-accent-fg" /> {idea}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-fg-3">{t("lesson.ideasNote")}</p>
          <div className="mt-auto pt-6">
            <Button size="lg" className="w-full" onClick={onNext}>
              {t("lesson.doneExploring")} <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      )}
      {current.kind === "challenge" && <ChallengeView step={current} world={world} start={start} ran={ran} onNext={onNext} boss={!!lesson.boss} onWalkthrough={onWalkthrough} />}
      {step > 0 && lesson.steps[step - 1].kind !== "try" && (
        <button onClick={onBack} className="mt-4 self-start text-xs text-fg-3 hover:text-fg-2">
          {t("lesson.previousStep")}
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
  name,
  hintLevel,
  onHint,
}: {
  name: string;
  step: TryStep;
  done: boolean;
  showCmd: boolean;
  onReveal: () => void;
  hintLevel: number;
  onHint: () => void;
  onRun: () => void;
  onAction: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const hintNames = t.list("lesson.hintNames");
  const idea = tryHint(step, t);
  return (
    <>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">{step.body}</p>
      {step.command && (
        <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-3">
          {showCmd ? (
            <>
              <code className="block font-mono text-sm break-all text-fg">{step.command}</code>
              {!done && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={onRun}>
                  <Play className="size-3 fill-current" /> {t("lesson.runForMe")}
                </Button>
              )}
            </>
          ) : (
            <button onClick={onReveal} className="flex items-center gap-2 text-sm text-fg-2 hover:text-fg">
              <Eye className="size-4" /> {t("lesson.showCommand")}
            </button>
          )}
        </div>
      )}
      {!done && idea && (
        <div className="mt-4">
          {hintLevel > 0 && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-warn/25 bg-warn-soft p-3 text-sm text-fg">
              <span className="mb-0.5 block text-[11px] font-semibold text-warn">{hintNames[0]}</span>
              {idea}
            </motion.p>
          )}
          {hintLevel === 0 && (
            <button onClick={onHint} className="flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
              <Lightbulb className="size-4 text-warn" />
              {t("lesson.needHint")}
            </button>
          )}
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
            className="mt-5 rounded-lg border border-ok/30 bg-ok-soft p-4"
            role="status"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-ok">
              <span className="grid size-5 place-items-center rounded-full bg-ok text-[var(--on-ok)]">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              {name ? t("lesson.niceName", { name }) : t("lesson.nice")}
            </p>
            <p className="mt-1.5 text-sm text-fg">{step.success}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-auto pt-6">
        <Button size="lg" variant={done ? "primary" : "secondary"} className="w-full disabled:opacity-100 disabled:text-fg-3 disabled:shadow-none" disabled={!done} onClick={onNext}>
          {done ? (
            <>
              {t("common.continue")} <ArrowRight className="size-4" />
            </>
          ) : (
            t("lesson.waiting")
          )}
        </Button>
      </div>
    </>
  );
}

function ChallengeView({
  step,
  world,
  start,
  ran,
  onNext,
  boss,
  onWalkthrough,
}: {
  step: ChallengeStep;
  world: World;
  start: World;
  ran: string[];
  onNext: () => void;
  boss: boolean;
  onWalkthrough: () => void;
}) {
  const t = useT();
  const results = step.objectives.map((o) => o.check(world, start, ran));
  const allDone = results.every(Boolean);
  const feedback = allDone ? null : step.feedback?.(world, start);
  const [hintLevel, setHintLevel] = useState<Record<string, number>>({});
  const firstOpen = step.objectives.find((_, i) => !results[i]);
  const level = firstOpen ? (hintLevel[firstOpen.id] ?? 0) : 0;
  const hintNames = t.list("lesson.hintNames");
  return (
    <>
      <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight">
        {boss ? <Swords className="size-5 text-warn" /> : <Target className="size-5 text-accent-fg" />}
        {step.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">{step.body}</p>
      <ul className="mt-4 space-y-2" aria-label={t("lesson.objectives")}>
        {step.objectives.map((o, i) => (
          <motion.li
            key={o.id}
            layout
            className={clsx("flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors", results[i] ? "border-ok/30 bg-ok-soft" : "border-line bg-surface-2/50")}
          >
            <span className={clsx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", results[i] ? "border-ok bg-ok text-[var(--on-ok)]" : "border-line-strong")}>
              {results[i] && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                  <Check className="size-3" strokeWidth={3.5} />
                </motion.span>
              )}
            </span>
            <span className={results[i] ? "text-fg" : "text-fg-2"}>
              {o.label}
              <span className="sr-only">{results[i] ? t("lesson.objDone") : t("lesson.objTodo")}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <AnimatePresence>
        {feedback && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex gap-2 rounded-md bg-accent-soft p-3 text-sm text-fg" role="status">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent-fg" />
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
      {firstOpen && (
        <div className="mt-4">
          {level > 0 && (
            <div className="space-y-2">
              {firstOpen.hints.slice(0, level).map((h, i) => (
                <motion.p key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-warn/25 bg-warn-soft p-3 text-sm text-fg">
                  <span className="mb-0.5 block text-[11px] font-semibold text-warn ">{hintNames[i]}</span>
                  {h}
                </motion.p>
              ))}
            </div>
          )}
          {level < 3 && (
            <button
              onClick={() => {
                setHintLevel((h) => ({ ...h, [firstOpen.id]: level + 1 }));
                if (level + 1 >= 3) onWalkthrough();
              }}
              className="mt-2 flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg"
            >
              <Lightbulb className="size-4 text-warn" />
              {level === 0 ? t("lesson.needHint") : t("lesson.showHint", { name: hintNames[level].toLowerCase() })}
            </button>
          )}
          <p className="mt-1 text-[11px] text-fg-3">{t("lesson.hintsFree")}</p>
        </div>
      )}
      <div className="mt-auto pt-6">
        <Button size="lg" variant={allDone ? "ok" : "secondary"} className="w-full disabled:opacity-100 disabled:text-fg-3 disabled:shadow-none" disabled={!allDone} onClick={onNext}>
          {allDone ? (
            <>
              {t("lesson.complete")} <ChevronRight className="size-4" />
            </>
          ) : (
            t("lesson.objectivesCount", { done: results.filter(Boolean).length, total: results.length })
          )}
        </Button>
      </div>
    </>
  );
}

/** The "idea" hint for a Try step: its own hint, else what its command does. */
function tryHint(step: TryStep, t: ReturnType<typeof useT>): string | null {
  if (step.hint) return step.hint;
  const name = step.command?.match(/^git\s+([a-z-]+)/)?.[1];
  const doc = name ? localizedDocs(t.locale).find((d) => d.name === name) : undefined;
  if (doc) return t("lesson.hintCommand", { cmd: `git ${doc.name}`, what: doc.plain });
  if (step.action) return t("lesson.hintAction", { label: step.action.label });
  return null;
}

/** On phones the current objective stays visible above every tab. */
function MobileObjective({ lesson, step, start, ran, world }: { lesson: Lesson; step: number; start: World; ran: string[]; world: World }) {
  const t = useT();
  const current = lesson.steps[step];
  let text = "";
  let done = false;
  if (current.kind === "try") {
    text = current.title;
    done = current.check(world, start, ran);
  } else if (current.kind === "challenge") {
    const open = current.objectives.find((o) => !o.check(world, start, ran));
    text = open ? open.label : t("lesson.allObjectives");
    done = !open;
  } else text = "title" in current ? current.title : "";
  return (
    <div className={clsx("flex items-center gap-2 border-b border-line px-4 py-2 text-xs", done ? "bg-ok-soft text-ok" : "bg-surface text-fg-2")}>
      {done ? <Check className="size-3.5" /> : <Target className="size-3.5 text-accent-fg" />}
      <span className="truncate">{text}</span>
      {done && <span className="ml-auto shrink-0 font-medium">{t("lesson.openGuide")}</span>}
    </div>
  );
}

