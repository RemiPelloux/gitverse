"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Check, Compass, Coffee, Flame, Rocket, Sprout, Star, Trophy, Zap } from "lucide-react";
import { ALL_LESSONS } from "@/features/curriculum";
import { LOCALES, useT, type Locale } from "@/i18n";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { Logo, useHydrated } from "@/components/ui/misc";
import { useProgress } from "./store";
import { AVATAR_COLORS, DAILY_GOALS, type AvatarColor, type DailyGoal } from "./rules";

type Exp = "new" | "some" | "comfortable";
const STEPS = ["lang", "name", "exp", "goal", "ready"] as const;

export function Welcome() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="h-dvh" aria-busy="true" />;
  return <WelcomeFlow />;
}

function WelcomeFlow() {
  const t = useT();
  const router = useRouter();
  const p = useProgress.getState();
  const updateSettings = useProgress((s) => s.updateSettings);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(p.name);
  const [avatar, setAvatar] = useState<AvatarColor>(p.avatar ?? "lane-0");
  const [exp, setExp] = useState<Exp>(p.experience ?? "new");
  const [goal, setGoal] = useState<DailyGoal>(p.settings.dailyGoal ?? 60);
  const id = STEPS[step];
  const trimmed = name.trim();

  const go = (d: number) => {
    setDir(d);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + d)));
  };
  const finish = (to: "lesson" | "path") => {
    const s = useProgress.getState();
    s.setName(trimmed);
    s.setAvatar(avatar);
    s.updateSettings({ dailyGoal: goal });
    s.finishOnboarding(exp);
    router.push(to === "lesson" ? `/learn/${ALL_LESSONS[0].id}` : "/learn");
  };
  const skipAll = () => {
    useProgress.getState().finishOnboarding("new");
    router.push(`/learn/${ALL_LESSONS[0].id}`);
  };

  // The settings, told as git config — the way Git itself remembers who you are.
  const config: Array<[string, string, boolean]> = [
    ["gitverse.lang", t.locale, step >= 0],
    ["user.name", trimmed ? `"${trimmed}"` : "", step >= 1 && !!trimmed],
    ["gitverse.level", exp, step >= 2],
    ["gitverse.goal", `${goal}xp`, step >= 3],
  ];

  return (
    <div className="bg-dots flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-4">
        <Link href="/" aria-label={t("nav.home")}>
          <Logo />
        </Link>
        <div className="mx-auto hidden w-full max-w-xs gap-1.5 sm:flex" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <motion.span className="block h-full rounded-full bg-accent-mark" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
            </span>
          ))}
        </div>
        {id !== "ready" && (
          <button onClick={skipAll} className="ml-auto shrink-0 text-sm text-fg-3 hover:text-fg-2 sm:ml-0">
            {t("common.skip")}
          </button>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-16 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-3">{t("welcome.stepOf", { n: Math.min(step + 1, 4), total: 4 })}</p>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.section
              key={id}
              custom={dir}
              initial={{ opacity: 0, x: 24 * dir }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 * dir }}
              transition={{ duration: 0.22 }}
              className="mt-2"
            >
              {id === "lang" && (
                <Panel title={t("welcome.langTitle")} body={t("welcome.langBody")}>
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("common.language")}>
                    {LOCALES.map((l) => (
                      <Choice key={l.id} selected={t.locale === l.id} onSelect={() => updateSettings({ locale: l.id as Locale })} lang={l.id}>
                        <span className="grid size-11 place-items-center rounded-lg bg-surface-2 font-mono text-sm font-bold text-fg-2">{l.short}</span>
                        <span className="text-lg font-semibold">{l.label}</span>
                      </Choice>
                    ))}
                  </div>
                  <Nav onNext={() => go(1)} t={t} />
                </Panel>
              )}

              {id === "name" && (
                <Panel title={t("welcome.nameTitle")} body={t("welcome.nameBody")}>
                  <NameInput value={name} onChange={setName} onEnter={() => go(1)} label={t("welcome.nameLabel")} placeholder={t("welcome.namePlaceholder")} />
                  <div className="mt-5 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("profile.avatar")}>
                    <span className="mr-1 text-sm text-fg-2">{t("profile.avatar")}</span>
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        role="radio"
                        aria-checked={avatar === c}
                        aria-label={c}
                        onClick={() => setAvatar(c)}
                        className={clsx("rounded-full p-0.5 ring-offset-2 ring-offset-bg transition-transform hover:scale-110", avatar === c && "ring-2 ring-fg")}
                      >
                        <Avatar name={name} color={c} size="sm" />
                      </button>
                    ))}
                  </div>
                  <Nav onBack={() => go(-1)} onNext={() => go(1)} t={t} nextLabel={trimmed ? t("welcome.next") : t("common.skip")} />
                </Panel>
              )}

              {id === "exp" && (
                <Panel title={trimmed ? t("welcome.expTitle", { name: trimmed }) : t("welcome.expTitleAnon")} body={t("welcome.expBody")}>
                  <div className="grid gap-3" role="radiogroup">
                    {(
                      [
                        ["new", Sprout],
                        ["some", Compass],
                        ["comfortable", Rocket],
                      ] as const
                    ).map(([e, Icon]) => (
                      <Choice key={e} selected={exp === e} onSelect={() => setExp(e)}>
                        <span className={clsx("grid size-11 shrink-0 place-items-center rounded-lg", exp === e ? "bg-accent text-white" : "bg-surface-2 text-fg-2")}>
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{t(`welcome.exp.${e}.title`)}</span>
                          <span className="block text-sm text-fg-2">{t(`welcome.exp.${e}.body`)}</span>
                        </span>
                      </Choice>
                    ))}
                  </div>
                  <Nav onBack={() => go(-1)} onNext={() => go(1)} t={t} />
                </Panel>
              )}

              {id === "goal" && (
                <Panel title={t("welcome.goalTitle")} body={t("welcome.goalBody")}>
                  <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
                    {DAILY_GOALS.map((g, i) => {
                      const Icon = [Coffee, Zap, Flame][i];
                      return (
                        <Choice key={g} selected={goal === g} onSelect={() => setGoal(g)} vertical>
                          <span className={clsx("grid size-11 place-items-center rounded-lg", goal === g ? "bg-accent text-white" : "bg-surface-2 text-fg-2")}>
                            <Icon className="size-5" />
                          </span>
                          <span className="mt-2 block font-semibold">{t(`welcome.goals.${g}.title`)}</span>
                          <span className="block font-mono text-sm text-accent-fg">{t("common.xp", { n: g })}</span>
                          <span className="block text-xs text-fg-2">{t(`welcome.goals.${g}.body`)}</span>
                        </Choice>
                      );
                    })}
                  </div>
                  <Nav onBack={() => go(-1)} onNext={() => go(1)} t={t} />
                </Panel>
              )}

              {id === "ready" && (
                <div className="relative">
                  <Confetti />
                  <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
                    <Avatar name={name} color={avatar} size="xl" />
                  </motion.div>
                  <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                    {trimmed ? t("welcome.readyTitle", { name: trimmed }) : t("welcome.readyTitleAnon")}
                  </h1>
                  <p className="mt-3 max-w-lg text-lg text-fg-2">{t("welcome.readyBody")}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {t.list("welcome.perks").map((perk, i) => {
                      const Icon = [Zap, Award, Star][i] ?? Trophy;
                      return (
                        <li key={perk} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                          <Icon className="size-4 text-accent-fg" /> {perk}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" onClick={() => finish("lesson")} autoFocus>
                      {t("welcome.readyStart")} <ArrowRight className="size-4" />
                    </Button>
                    <Button size="lg" variant="secondary" onClick={() => finish("path")}>
                      {t("welcome.readyPath")}
                    </Button>
                  </div>
                  <button onClick={() => go(-1)} className="mt-6 flex items-center gap-1 text-sm text-fg-3 hover:text-fg-2">
                    <ArrowLeft className="size-3.5" /> {t("common.back")}
                  </button>
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        <aside className="hidden lg:block" aria-hidden>
          <div className="overflow-hidden rounded-2xl border border-line bg-term shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-[var(--t-red)]/80" />
              <span className="size-2.5 rounded-full bg-[var(--t-yellow)]/80" />
              <span className="size-2.5 rounded-full bg-[var(--t-green)]/80" />
              <span className="ml-2 font-mono text-[11px] text-[var(--t-muted)]">~/.gitconfig</span>
            </div>
            <div className="terminal space-y-1.5 px-4 py-4 font-mono text-[13px]">
              <AnimatePresence initial={false}>
                {config
                  .filter(([, , show]) => show)
                  .map(([k, v]) => (
                    <motion.p key={k} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="break-all">
                      <span className="text-[var(--t-green)]">$</span> git config --global <span className="text-[var(--t-cyan)]">{k}</span>{" "}
                      <span className="text-[var(--t-yellow)]">{v}</span>
                    </motion.p>
                  ))}
              </AnimatePresence>
              <p>
                <span className="text-[var(--t-green)]">$</span> <span className="caret inline-block h-4 w-2 translate-y-0.5 bg-[var(--t-text)]" />
              </p>
            </div>
            <div className="border-t border-white/5 px-4 py-4 font-mono text-[12.5px] leading-relaxed text-[var(--t-text)]">
              <p className="mb-2 font-sans text-[11px] text-[var(--t-muted)]">{t("welcome.namePreview")}</p>
              <p>
                <span className="text-[var(--t-yellow)]">commit 3f9a2c1</span> (<span className="text-[var(--t-cyan)]">HEAD</span> -&gt;{" "}
                <span className="text-[var(--t-green)]">main</span>)
              </p>
              <p>
                Author: <span className="text-white">{trimmed || "You"}</span>
              </p>
              <p className="mt-2 pl-4">Initial commit</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Panel({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-fg-2">{body}</p>
      <div className="mt-7">{children}</div>
    </>
  );
}

function Choice({
  selected,
  onSelect,
  children,
  vertical,
  lang,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  vertical?: boolean;
  lang?: string;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      lang={lang}
      className={clsx(
        "relative flex rounded-xl border-2 bg-elevated p-4 text-left transition-[border-color,transform,box-shadow] active:translate-y-[2px] active:shadow-none",
        vertical ? "flex-col items-start" : "items-center gap-4",
        selected ? "border-accent shadow-[0_3px_0_var(--accent-deep)]" : "border-line shadow-[0_3px_0_var(--edge)] hover:border-line-strong",
      )}
    >
      {children}
      {selected && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-accent text-white">
          <Check className="size-3" strokeWidth={3.5} />
        </motion.span>
      )}
    </button>
  );
}

function NameInput({ value, onChange, onEnter, label, placeholder }: { value: string; onChange: (v: string) => void; onEnter: () => void; label: string; placeholder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <label className="block">
      <span className="text-sm font-medium text-fg-2">{label}</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 30))}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
        placeholder={placeholder}
        autoComplete="given-name"
        className="mt-2 block w-full max-w-md rounded-xl border-2 border-line bg-elevated px-4 py-3 text-xl font-semibold outline-none placeholder:font-normal placeholder:text-fg-3 focus:border-accent"
      />
    </label>
  );
}

function Nav({ onBack, onNext, nextLabel, t }: { onBack?: () => void; onNext: () => void; nextLabel?: string; t: ReturnType<typeof useT> }) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <Button size="lg" onClick={onNext}>
        {nextLabel ?? t("welcome.next")} <ArrowRight className="size-4" />
      </Button>
      {onBack && (
        <Button size="lg" variant="ghost" onClick={onBack}>
          {t("common.back")}
        </Button>
      )}
    </div>
  );
}
