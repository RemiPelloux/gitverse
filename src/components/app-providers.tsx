"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { Award, GitCommitHorizontal, Sparkles, Target, X } from "lucide-react";
import { useProgress, type Toast } from "@/features/progress/store";
import { ACHIEVEMENTS, levelFor } from "@/features/progress/rules";
import { detectLocale, useT, type MessageKey } from "@/i18n";
import { Button } from "./ui/button";
import { Confetti } from "./ui/confetti";
import { DynamicIcon } from "./ui/misc";

export function AppProviders({ children }: { children: ReactNode }) {
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    if (settings.motion === "reduced") document.documentElement.dataset.motion = "reduced";
    else delete document.documentElement.dataset.motion;
  }, [settings.theme, settings.motion]);

  // First visit: guess the language from the browser until the learner picks one.
  useEffect(() => {
    const apply = () => {
      const s = useProgress.getState().settings;
      if (!s.locale) updateSettings({ locale: detectLocale() });
    };
    if (useProgress.persist.hasHydrated()) apply();
    return useProgress.persist.onFinishHydration(apply);
  }, [updateSettings]);

  useEffect(() => {
    if (settings.locale) document.documentElement.lang = settings.locale;
  }, [settings.locale]);

  const reduced = settings.motion === "reduced" ? "always" : settings.motion === "full" ? "never" : "user";
  return (
    <MotionConfig reducedMotion={reduced}>
      {children}
      <Toasts />
      <LevelUp />
    </MotionConfig>
  );
}

function Toasts() {
  const toasts = useProgress((s) => s.toasts);
  const dismiss = useProgress((s) => s.dismissToast);
  // Only the two most recent are shown; older ones are dropped quietly.
  const visible = toasts.slice(-2);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[100] flex flex-col items-center gap-2 px-4 md:items-end" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.kind === "xp" ? 2200 : 3800);
    return () => clearTimeout(timer);
  }, [toast.kind, onDismiss]);
  const ach = toast.kind === "achievement" ? ACHIEVEMENTS.find((a) => a.id === toast.subject) : null;
  let title = "";
  let detail = "";
  if (toast.kind === "xp") {
    title = t("toast.discovered", { cmd: toast.subject ?? "" });
    detail = t("common.plusXp", { n: toast.xp ?? 0 });
  } else if (toast.kind === "achievement" && ach) {
    title = t("toast.badge", { title: t(`badges.${ach.id}.title` as MessageKey) });
    detail = t(`badges.${ach.id}.description` as MessageKey);
  } else if (toast.kind === "quest") {
    title = t("toast.quest", { title: t(`quests.${toast.subject}` as MessageKey) });
    detail = t("common.plusXp", { n: toast.xp ?? 0 });
  } else if (toast.kind === "goal") {
    title = t("toast.goal");
    detail = t("toast.goalDetail", { xp: toast.xp ?? 0 });
  }
  const compact = toast.kind === "xp";
  const tone =
    toast.kind === "achievement" ? "bg-warn-soft text-warn" : toast.kind === "quest" || toast.kind === "goal" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent-fg";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-line bg-elevated shadow-[var(--shadow-lg)] ${compact ? "p-2 pr-2" : "p-3 pr-2"}`}
      role="status"
    >
      <motion.span
        initial={{ rotate: -20, scale: 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.05 }}
        className={`grid shrink-0 place-items-center rounded-lg ${compact ? "size-7" : "size-10"} ${tone}`}
      >
        {ach ? (
          <DynamicIcon name={ach.icon} className="size-5" />
        ) : toast.kind === "quest" || toast.kind === "goal" ? (
          <Target className="size-4" />
        ) : toast.kind === "achievement" ? (
          <Award className="size-4" />
        ) : (
          <GitCommitHorizontal className="size-4" />
        )}
      </motion.span>
      <div className="min-w-0 flex-1">
        <p className={compact ? "truncate text-xs font-medium" : "text-sm font-semibold"}>{title}</p>
        <p className="truncate text-xs text-fg-2">{detail}</p>
      </div>
      <button className="rounded-lg p-1 text-fg-3 hover:text-fg pointer-coarse:p-2.5" onClick={onDismiss} aria-label={t("common.dismiss")}>
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

/** Full-screen celebration the first time the learner reaches a new level. */
function LevelUp() {
  const t = useT();
  const pending = useProgress((s) => s.levelUp);
  const hold = useProgress((s) => s.holdCelebrations);
  const level = hold ? null : pending;
  const dismiss = useProgress((s) => s.dismissLevelUp);
  const xp = useProgress((s) => s.xp);
  useEffect(() => {
    if (!level) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [level, dismiss]);
  const titles = t.list("levels");
  return (
    <AnimatePresence>
      {level && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] grid place-items-center bg-black/55 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal
          aria-labelledby="lvl-title"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative w-full max-w-sm rounded-2xl border border-line bg-elevated p-8 text-center shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Confetti />
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-accent-fg">
              <Sparkles className="size-4" /> {t("levelUp.eyebrow")}
            </p>
            <motion.div
              initial={{ rotate: -12, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.15 }}
              className="mx-auto mt-5 grid size-28 place-items-center rounded-[28px] bg-accent text-5xl font-bold text-white shadow-[0_6px_0_var(--accent-deep)]"
            >
              {level}
            </motion.div>
            <h2 id="lvl-title" className="mt-6 text-2xl font-semibold tracking-tight">
              {t("levelUp.title", { n: level })}
            </h2>
            <p className="mt-2 text-sm text-fg-2">{t("levelUp.body")}</p>
            <p className="mt-1 text-lg font-semibold text-fg">{titles[level - 1]}</p>
            <p className="mt-1 text-xs text-fg-3">{t("common.xp", { n: xp })} · {t("learn.toNext", { n: levelFor(xp).ceil - xp, level: level + 1 })}</p>
            <Button size="lg" className="mt-7 w-full" onClick={dismiss} autoFocus>
              {t("levelUp.cta")}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
