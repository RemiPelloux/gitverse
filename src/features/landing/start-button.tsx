"use client";

import { ArrowRight } from "lucide-react";
import { ALL_LESSONS } from "@/features/curriculum";
import { useProgress } from "@/features/progress/store";
import { LinkButton } from "@/components/ui/button";
import { useHydrated } from "@/components/ui/misc";

/** "Start Learning" drops a newcomer straight into lesson 1; returning learners continue where they left off. */
export function StartButton() {
  const hydrated = useHydrated();
  const completed = useProgress((s) => s.completed);
  const started = hydrated && Object.keys(completed).length > 0;
  const next = ALL_LESSONS.find((l) => !completed[l.id]) ?? ALL_LESSONS[0];
  return (
    <LinkButton href={started ? `/learn/${next.id}` : `/learn/${ALL_LESSONS[0].id}`} size="lg" className="group">
      {started ? `Continue: ${next.title}` : "Start learning"}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </LinkButton>
  );
}
