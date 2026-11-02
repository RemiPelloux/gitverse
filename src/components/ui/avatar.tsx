"use client";

import { clsx } from "clsx";
import { UserRound } from "lucide-react";
import type { AvatarColor } from "@/features/progress/rules";

/** Initials on a lane-colored disc — the learner's mark across the app. */
export function Avatar({ name, color, size = "md", className }: { name: string; color: AvatarColor; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const sizes = { sm: "size-7 text-[11px]", md: "size-9 text-sm", lg: "size-14 text-xl", xl: "size-20 text-3xl" };
  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full font-semibold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]", sizes[size], className)}
      style={{ background: `var(--${color})` }}
      aria-hidden
    >
      {initials || <UserRound className="size-[55%]" />}
    </span>
  );
}
