"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import { useSyncExternalStore, type ReactNode } from "react";
import {
  Award, Blocks, Camera, CloudUpload, Compass, FlaskConical, FolderGit2, GitBranch, GitMerge, Handshake, History, LifeBuoy,
  RefreshCw, Sparkles, Swords, TerminalSquare, type LucideIcon,
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

export function ProgressBar({ value, className, tone = "violet", label }: { value: number; className?: string; tone?: "violet" | "mint"; label?: string }) {
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
        className={clsx("h-full rounded-full", tone === "violet" ? "bg-gradient-to-r from-violet to-violet-2" : "bg-mint")}
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
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <defs>
          <linearGradient id="gv-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--violet-2)" />
            <stop offset="1" stopColor="var(--mint)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#gv-logo)" opacity="0.18" />
        <path d="M10 9v14M10 16c0-4 12-2 12-7" stroke="url(#gv-logo)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="10" cy="9" r="3" fill="var(--violet-2)" />
        <circle cx="10" cy="23" r="3" fill="var(--violet-2)" />
        <circle cx="22" cy="9" r="3" fill="var(--mint)" />
      </svg>
      <span>Gitverse</span>
    </span>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "violet" | "mint" | "amber" | "coral"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-fg-2 border-line",
    violet: "bg-violet-soft text-violet-2 border-transparent",
    mint: "bg-mint-soft text-mint border-transparent",
    amber: "bg-amber-soft text-amber border-transparent",
    coral: "bg-coral-soft text-coral border-transparent",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}
