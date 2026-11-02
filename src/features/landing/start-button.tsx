"use client";

import { ArrowRight } from "lucide-react";
import { ALL_LESSONS } from "@/features/curriculum";
import { localizeLesson } from "@/features/curriculum/localize";
import { useProgress } from "@/features/progress/store";
import { LinkButton } from "@/components/ui/button";
import { useHydrated } from "@/components/ui/misc";
import { useT } from "@/i18n";

/** Newcomers go through the welcome tour first; returning learners continue where they left off. */
export function StartButton() {
  const t = useT();
  const hydrated = useHydrated();
  const completed = useProgress((s) => s.completed);
  const onboarded = useProgress((s) => s.onboarded);
  const started = hydrated && Object.keys(completed).length > 0;
  const next = ALL_LESSONS.find((l) => !completed[l.id]) ?? ALL_LESSONS[0];
  const href = !hydrated || !onboarded ? "/welcome" : `/learn/${(started ? next : ALL_LESSONS[0]).id}`;
  return (
    <LinkButton href={href} size="lg" className="group">
      {started ? t("landing.continue", { title: localizeLesson(next, t.locale).title }) : t("landing.start")}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </LinkButton>
  );
}
