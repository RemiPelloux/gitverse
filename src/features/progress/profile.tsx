"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Accessibility, Keyboard, Palette, RotateCcw, SquareTerminal, Trophy } from "lucide-react";
import { Button, Kbd } from "@/components/ui/button";
import { Card, DynamicIcon, ProgressBar, useHydrated } from "@/components/ui/misc";
import { useProgress, type Settings } from "./store";
import { ACHIEVEMENTS, LEVEL_TITLES, levelFor } from "./rules";

export function Profile() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <ProfileInner />;
}

function ProfileInner() {
  const p = useProgress();
  const lv = levelFor(p.xp);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pt-8 pb-28 md:pb-16">
      <Card className="flex flex-wrap items-center gap-5 p-6">
        <span className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-violet to-mint text-2xl font-bold text-white">{lv.level}</span>
        <div className="min-w-0 flex-1">
          <label className="text-xs text-fg-3" htmlFor="name">
            Display name
          </label>
          <input
            id="name"
            value={p.name}
            onChange={(e) => p.setName(e.target.value.slice(0, 30))}
            placeholder="Guest learner"
            className="block w-full bg-transparent text-xl font-semibold outline-none placeholder:text-fg-3"
          />
          <p className="text-sm text-fg-2">
            {LEVEL_TITLES[lv.level - 1]} · {p.xp} XP · {Object.keys(p.completed).length} lessons
          </p>
          <ProgressBar value={lv.progress} className="mt-2 max-w-sm" label="Level progress" />
        </div>
        <p className="w-full rounded-xl bg-surface-2 px-3 py-2 text-xs text-fg-3">
          You&apos;re learning as a guest. Progress is stored in this browser only.
        </p>
      </Card>

      <section aria-labelledby="ach">
        <h2 id="ach" className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Trophy className="size-5 text-amber" /> Achievements
          <span className="text-sm font-normal text-fg-3">
            {Object.keys(p.achievements).length}/{ACHIEVEMENTS.length}
          </span>
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const at = p.achievements[a.id];
            return (
              <li key={a.id} className={clsx("flex items-center gap-3 rounded-2xl border p-3", at ? "border-amber/30 bg-amber-soft/50" : "border-line opacity-60")}>
                <span className={clsx("grid size-10 shrink-0 place-items-center rounded-xl", at ? "bg-amber text-[#3a2600]" : "bg-surface-2 text-fg-3")}>
                  <DynamicIcon name={a.icon} className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-fg-2">{a.description}</p>
                </div>
                {at && <span className="ml-auto shrink-0 text-[10px] text-fg-3">{new Date(at).toLocaleDateString()}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="settings" className="space-y-3">
        <h2 id="settings" className="text-lg font-semibold">
          Preferences & accessibility
        </h2>
        <Card className="divide-y divide-line">
          <Setting icon={<Palette className="size-4" />} title="Theme" desc="Dark is the default.">
            <Segmented value={p.settings.theme} options={[["dark", "Dark"], ["light", "Light"]]} onChange={(v) => p.updateSettings({ theme: v as Settings["theme"] })} />
          </Setting>
          <Setting icon={<Accessibility className="size-4" />} title="Motion" desc="Reduce animations. “System” follows your OS setting.">
            <Segmented
              value={p.settings.motion}
              options={[["system", "System"], ["reduced", "Reduced"], ["full", "Full"]]}
              onChange={(v) => p.updateSettings({ motion: v as Settings["motion"] })}
            />
          </Setting>
          <Setting icon={<SquareTerminal className="size-4" />} title="Terminal mode" desc="Assisted suggests and explains commands. Real expects you to type them.">
            <Segmented
              value={p.settings.terminalMode}
              options={[["assisted", "Assisted"], ["real", "Real"]]}
              onChange={(v) => p.updateSettings({ terminalMode: v as Settings["terminalMode"] })}
            />
          </Setting>
          <Setting icon={<Trophy className="size-4" />} title="Show streaks" desc="Streaks are optional — turn them off if they feel like pressure.">
            <Segmented value={p.settings.showStreak ? "on" : "off"} options={[["on", "On"], ["off", "Off"]]} onChange={(v) => p.updateSettings({ showStreak: v === "on" })} />
          </Setting>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="size-4" /> Keyboard shortcuts
          </h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {[
              [["Tab"], "Complete a command"],
              [["↑", "↓"], "Browse command history"],
              [["→"], "Accept ghost suggestion"],
              [["Ctrl", "L"], "Clear the terminal"],
              [["Ctrl", "Alt", "Z"], "Playground: time-travel back"],
              [["Enter"], "Select a focused commit"],
              [["Ctrl", "Scroll"], "Zoom the graph"],
              [["Esc"], "Close suggestions"],
            ].map(([keys, label]) => (
              <div key={label as string} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-1.5">
                <dt className="text-fg-2">{label as string}</dt>
                <dd className="flex gap-1">
                  {(keys as string[]).map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold">Reset progress</p>
            <p className="text-xs text-fg-2">Erase XP, lessons and badges from this browser. Settings are kept.</p>
          </div>
          {confirm ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  p.resetProgress();
                  setConfirm(false);
                }}
              >
                Yes, erase everything
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          )}
        </Card>
      </section>
    </div>
  );
}

function Setting({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-fg-2">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-fg-2">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={clsx("rounded-lg px-3 py-1 text-xs font-medium transition-colors", value === v ? "bg-elevated text-fg shadow-sm" : "text-fg-3 hover:text-fg")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
