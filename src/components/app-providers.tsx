"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { Award, Sparkles, Target, X } from "lucide-react";
import { useProgress, type Toast } from "@/features/progress/store";
import { ACHIEVEMENTS } from "@/features/progress/rules";

export function AppProviders({ children }: { children: ReactNode }) {
  const settings = useProgress((s) => s.settings);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    if (settings.motion === "reduced") document.documentElement.dataset.motion = "reduced";
    else delete document.documentElement.dataset.motion;
  }, [settings.theme, settings.motion]);

  const reduced = settings.motion === "reduced" ? "always" : settings.motion === "full" ? "never" : "user";
  return (
    <MotionConfig reducedMotion={reduced}>
      {children}
      <Toasts />
    </MotionConfig>
  );
}

function Toasts() {
  const toasts = useProgress((s) => s.toasts);
  const dismiss = useProgress((s) => s.dismissToast);
  // Only the two most recent are shown; older ones are dropped quietly.
  const visible = toasts.slice(-2);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-16 z-[100] flex flex-col items-center gap-2 px-4"
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

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, t.kind === "xp" ? 2200 : 3800);
    return () => clearTimeout(timer);
  }, [t.kind, onDismiss]);
  const ach = t.kind === "achievement" ? ACHIEVEMENTS.find((a) => a.id === t.detail) : null;
  const Icon = t.kind === "achievement" ? Award : t.kind === "quest" ? Target : Sparkles;
  const compact = t.kind === "xp";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`pointer-events-auto flex w-full max-w-xs items-center gap-3 rounded-2xl border border-line bg-elevated/95 shadow-[var(--shadow)] backdrop-blur ${compact ? "p-2 pr-2" : "p-3 pr-2"}`}
      role="status"
    >
      <span className={`grid shrink-0 place-items-center rounded-xl ${compact ? "size-7" : "size-9"} ${t.kind === "achievement" ? "bg-amber-soft text-amber" : t.kind === "quest" ? "bg-mint-soft text-mint" : "bg-violet-soft text-violet-2"}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={compact ? "truncate text-xs font-medium" : "text-sm font-medium"}>{ach ? `Badge: ${ach.title}` : t.title}</p>
        <p className="truncate text-xs text-fg-2">{ach ? ach.description : t.detail}</p>
      </div>
      <button className="rounded-lg p-1 text-fg-3 hover:text-fg" onClick={onDismiss} aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </motion.div>
  );
}
