"use client";

import Link from "next/link";
import { Award, Star, Target, Zap } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { LinkButton } from "@/components/ui/button";
import { TIER_LABEL } from "@/features/curriculum";
import { localizedChapters, tierLabel } from "@/features/curriculum/localize";
import { HeroDemo } from "@/features/landing/hero-demo";
import { StartButton } from "@/features/landing/start-button";
import { useT } from "@/i18n";

/** What Gitverse does, told as a commit history (messages come from the dictionary). */
const LOG = [
  { hash: "e3f1a09", head: true },
  { hash: "9b2c4d1" },
  { hash: "51ad7e8" },
  { hash: "c08e2f3" },
  { hash: "7f9e011" },
  { hash: "0d4b6aa" },
];

const STEPS = ["discover", "watch", "try", "challenge", "celebrate"] as const;

const GAME = [
  ["xp", Zap, "var(--lane-0)"],
  ["stars", Star, "var(--lane-3)"],
  ["quests", Target, "var(--lane-1)"],
  ["badges", Award, "var(--lane-2)"],
] as const;

export function Landing() {
  const t = useT();
  const chapters = localizedChapters(t.locale);
  const log = t.list("landing.log");
  return (
    <>
      <AppNav />
      <main className="pb-24 md:pb-0">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 lg:grid-cols-2 lg:pt-20">
          <div>
            <p className="font-mono text-sm text-fg-3">{t("landing.prompt")}</p>
            <h1 className="mt-4 text-[2.5rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-[3.4rem]">
              {t("landing.title1")} <span className="text-accent-fg">{t("landing.titleAccent")}</span>
              {t.locale === "fr" ? "" : " "}
              {t("landing.title2")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-fg-2">
              {t("landing.lead")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <StartButton />
              <LinkButton href="/playground" variant="secondary" size="lg">
                {t("landing.openPlayground")}
              </LinkButton>
            </div>
            <p className="mt-4 text-sm text-fg-3">{t("landing.reassure")}</p>
          </div>
          <HeroDemo />
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{t("landing.whyTitle")}</h2>
              <p className="mt-2 text-fg-2">{t("landing.whyBody")}</p>
            </div>
            <ol className="font-mono text-[13px] leading-7" aria-label={t("landing.featuresLabel")}>
              {LOG.map((c, i) => (
                <li key={c.hash} className="flex gap-3">
                  <span className="relative flex w-3 shrink-0 justify-center" aria-hidden>
                    <span className={i === LOG.length - 1 ? "absolute top-0 h-3.5 w-px bg-line-strong" : "absolute inset-y-0 w-px bg-line-strong"} />
                    <span className="relative mt-[9px] size-2.5 rounded-full border-2 border-accent-mark bg-surface" />
                  </span>
                  <span className="shrink-0 text-warn">{c.hash}</span>
                  <span className="min-w-0">
                    {c.head && (
                      <span className="mr-2 text-fg-3">
                        (<span className="text-info">HEAD</span> -&gt; <span className="text-ok">main</span>)
                      </span>
                    )}
                    <span className="text-fg">{log[i]}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("landing.stepsTitle")}</h2>
            <p className="mt-2 text-fg-2">{t("landing.stepsBody")}</p>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {STEPS.map((k) => (
                <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-sm">
                  <dt className="font-mono text-accent-fg">{t(`steps.${k}`).toLowerCase()}</dt>
                  <dd className="text-fg-2">{t(`landing.steps.${k}`)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("landing.curriculumTitle")}</h2>
            <p className="mt-2 text-fg-2">{t("landing.curriculumBody")}</p>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {chapters.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-6 font-mono text-xs text-fg-3">{String(c.number).padStart(2, "0")}</span>
                  <span className="flex-1">{c.title}</span>
                  <span className="text-xs text-fg-3">{c.lessons.length ? (c.lessons.length > 1 ? t("landing.lessonsCount", { n: c.lessons.length }) : t("landing.lessonCount")) : t("common.comingSoon")}</span>
                  <span className="hidden w-24 text-right text-xs text-fg-3 sm:inline">{tierLabel(c.tier, t.locale, TIER_LABEL[c.tier])}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">{t("landing.gameTitle")}</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {GAME.map(([id, Icon, color]) => (
                <li key={id} className="rounded-xl border border-line bg-elevated p-5 shadow-[var(--shadow-card)]">
                  <span className="grid size-11 place-items-center rounded-xl text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]" style={{ background: color }}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{t(`landing.game.${id}.title`)}</h3>
                  <p className="mt-1 text-sm text-fg-2">{t(`landing.game.${id}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-14 pb-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t("landing.ctaTitle")}</h2>
              <p className="mt-1 max-w-xl text-sm text-fg-2">
                {t("landing.ctaBody")}
              </p>
            </div>
            <StartButton />
          </div>
          <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 text-xs text-fg-3">
            <span>{t("landing.footer")}</span>
            <span className="flex gap-4">
              <Link href="/commands" className="hover:text-fg-2">
                {t("landing.footerCommands")}
              </Link>
              <Link href="/profile" className="hover:text-fg-2">
                {t("landing.footerSettings")}
              </Link>
            </span>
          </footer>
        </section>
      </main>
    </>
  );
}
