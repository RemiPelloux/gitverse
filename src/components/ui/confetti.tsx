"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const COLORS = ["var(--lane-0)", "var(--lane-1)", "var(--lane-2)", "var(--lane-3)", "var(--lane-4)", "var(--lane-5)"];

/** A short burst of commit-dot confetti. Skipped entirely with reduced motion. */
export function Confetti({ count = 36 }: { count?: number }) {
  const reduce = useReducedMotion();
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * 520,
      y: -(140 + Math.random() * 220),
      r: Math.random() * 540 - 270,
      d: 0.9 + Math.random() * 0.7,
      s: 6 + Math.random() * 6,
      round: i % 3 === 0,
      c: COLORS[i % COLORS.length],
    })),
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2"
          style={{ width: p.s, height: p.round ? p.s : p.s * 0.45, background: p.c, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 320], opacity: [1, 1, 0], rotate: p.r }}
          transition={{ duration: p.d + 0.8, ease: "easeOut", times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
