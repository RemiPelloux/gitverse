"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { execute, type GitEvent, type World } from "@/engine";
import { scenario } from "@/features/curriculum/scenario";
import { GitGraph } from "@/features/lab/git-graph";

const SCRIPT = [
  { cmd: 'git commit -m "Add homepage"', note: "A commit is a snapshot. A new circle appears." },
  { cmd: "git switch -c feature/login", note: "A branch: a new timeline. HEAD moves onto it." },
  { cmd: 'echo "login" > login.html && git add . && git commit -m "Login page"', note: "Only feature/login moves. main stays safe." },
  { cmd: "git switch main", note: "Back to main — login.html disappears from your files." },
  { cmd: "git merge feature/login", note: "Merged! main now includes the login page." },
];

const initialWorld = () => scenario().run("git init").commit("Initial commit", { "README.md": "# Hi\n" }).files({ "index.html": "<h1>Hello</h1>\n" }).run("git add .").done();

/** The core interaction, right on the landing page: run a command, see what happened. */
export function HeroDemo() {
  const [world, setWorld] = useState<World>(initialWorld);
  const [i, setI] = useState(0);
  const [log, setLog] = useState<Array<{ cmd: string; out: string[] }>>([]);
  const [events, setEvents] = useState<GitEvent[]>([]);
  const step = () => {
    const s = SCRIPT[i];
    const r = execute(world, s.cmd);
    setWorld(r.world);
    setEvents(r.events);
    setLog((l) => [...l.slice(-2), { cmd: s.cmd, out: r.lines.map((x) => x.text).slice(0, 2) }]);
    setI(i + 1);
  };
  const reset = () => {
    setWorld(initialWorld());
    setI(0);
    setLog([]);
    setEvents([]);
  };
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface/80 shadow-[0_30px_80px_-30px_rgba(139,92,246,0.45)] backdrop-blur">
      <div className="h-56 border-b border-line bg-surface-2/30 sm:h-64">
        <GitGraph world={world} events={events} eventKey={i} compact />
      </div>
      <div className="terminal bg-term p-4 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
        <div className="min-h-[88px]">
          {log.map((l, k) => (
            <div key={k + l.cmd} className={clsx(k < log.length - 1 && "opacity-50")}>
              <p className="truncate">
                <span className="text-[#6ee7b7]">$</span> <span className="text-white">{l.cmd}</span>
              </p>
              {l.out.map((o, j) => (
                <p key={j} className="truncate text-[var(--t-muted)]">
                  {o}
                </p>
              ))}
            </div>
          ))}
          {!log.length && <p className="text-[var(--t-muted)]">A real (simulated) Git repository. Press the button to run the next command →</p>}
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3 font-sans">
          {i < SCRIPT.length ? (
            <button onClick={step} className="flex min-w-0 items-center gap-2 rounded-xl bg-[#8b5cf6] px-3 py-2 text-left text-xs font-medium text-white hover:brightness-110">
              <Play className="size-3.5 shrink-0 fill-current" />
              <code className="truncate font-mono">{SCRIPT[i].cmd.split(" && ")[0]}</code>
            </button>
          ) : (
            <button onClick={reset} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15">
              <RotateCcw className="size-3.5" /> Play again
            </button>
          )}
          <AnimatePresence mode="wait">
            <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 text-xs text-[#a3a9c9]">
              {i > 0 ? SCRIPT[i - 1].note : "5 commands. One complete Git story."}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
