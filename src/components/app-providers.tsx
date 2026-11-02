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

/** Compact one-line notices just under the header: they never cover the terminal, editor or guide. */
function Toasts() {
  const toasts = useProgress((s) => s.toasts);
  const dismiss = useProgress((s) => s.dismissToast);
  // Only the most recent are shown (two on larger screens, one on phones).
  const visible = toasts.slice(-2);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[62px] z-[100] flex flex-col items-center gap-1.5 px-4 max-md:[&>*:not(:last-child)]:hidden"
      aria-live="polite"
    >
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
    const timer = setTimeout(onDismiss, toast.kind === "xp" ? 2200 : 3600);
    return () => clearTimeout(timer);
  }, [toast.kind, onDismiss]);
  const ach = toast.kind === "achievement" ? ACHIEVEMENTS.find((a) => a.id === toast.subject) : null;
  let title = "";
  let detail = "";
  if (toast.kind === "xp") title = t("toast.discovered", { cmd: toast.subject ?? "" });
  else if (toast.kind === "achievement" && ach) {
    title = t("toast.badge", { title: t(`badges.${ach.id}.title` as MessageKey) });
    detail = t(`badges.${ach.id}.description` as MessageKey);
  } else if (toast.kind === "quest") title = t("toast.quest", { title: t(`quests.${toast.subject}` as MessageKey) });
  else if (toast.kind === "goal") {
    title = t("toast.goal");
    detail = t("toast.goalDetail", { xp: toast.xp ?? 0 });
  }
  const xpChip = toast.kind === "xp" || toast.kind === "quest" ? t("common.plusXp", { n: toast.xp ?? 0 }) : null;
  const tone =
    toast.kind === "achievement" ? "bg-warn-soft text-warn" : toast.kind === "quest" || toast.kind === "goal" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent-fg";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="pointer-events-auto flex max-w-[min(30rem,100%)] items-center gap-2 rounded-full border border-line bg-elevated py-1 pr-1 pl-1 shadow-[var(--shadow-lg)]"
      role="status"
      title={detail || undefined}
    >
      <motion.span
        initial={{ rotate: -20, scale: 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.05 }}
        className={`grid size-7 shrink-0 place-items-center rounded-full ${tone}`}
      >
        {ach ? (
          <DynamicIcon name={ach.icon} className="size-4" />
        ) : toast.kind === "quest" || toast.kind === "goal" ? (
          <Target className="size-4" />
        ) : toast.kind === "achievement" ? (
          <Award className="size-4" />
        ) : (
          <GitCommitHorizontal className="size-4" />
        )}
      </motion.span>
      <p className="min-w-0 truncate text-[13px] font-medium">{title}</p>
      {xpChip && <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-bold text-warn">{xpChip}</span>}
      <button className="grid size-6 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-2 hover:text-fg pointer-coarse:size-9" onClick={onDismiss} aria-label={t("common.dismiss")}>
        <X className="size-3.5" />
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
