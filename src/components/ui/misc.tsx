"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import { useSyncExternalStore, type ReactNode } from "react";
import {
  Award, Blocks, Camera, CloudUpload, Compass, FlaskConical, FolderGit2, GitBranch, GitMerge, Handshake, History, LifeBuoy,
  RefreshCw, Swords, TerminalSquare, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Award, Blocks, Camera, CloudUpload, Compass, FlaskConical, FolderGit2, GitBranch, GitMerge, Handshake, History, LifeBuoy,
  RefreshCw, Swords, TerminalSquare,
};

/** True after the client has mounted (persisted progress is only known client-side). */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ProgressBar({ value, className, tone = "accent", label }: { value: number; className?: string; tone?: "accent" | "ok"; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={clsx("h-2 overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={clsx("h-full rounded-full", tone === "accent" ? "bg-accent-mark" : "bg-ok")}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
      />
    </div>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]", className)} {...rest}>
      {children}
    </div>
  );
}

export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Award;
  return <Icon className={className} aria-hidden />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="6" fill="var(--accent-mark)" />
        <path d="M11 8v16M11 17c0-4 10-3 10-8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle cx="11" cy="8.5" r="2.6" fill="#fff" />
        <circle cx="11" cy="23.5" r="2.6" fill="#fff" />
        <circle cx="21" cy="8.5" r="2.6" fill="#fff" />
      </svg>
      <span>Gitverse</span>
    </span>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "bad"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-fg-2 border-line",
    accent: "bg-accent-soft text-accent-fg border-transparent",
    ok: "bg-ok-soft text-ok border-transparent",
    warn: "bg-warn-soft text-warn border-transparent",
    bad: "bg-bad-soft text-bad border-transparent",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}
