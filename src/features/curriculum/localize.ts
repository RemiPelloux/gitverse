import type { Locale } from "@/i18n/locale";
import { CHAPTERS } from "./index";
import { CURRICULUM_FR } from "./fr";
import type { Chapter, Lesson, Step, Tier } from "./types";

/**
 * Translations of the curriculum's words. Lessons themselves (setups, checks,
 * commands) are language-independent and live in lessons.ts; a translation
 * only replaces the text, step by step, in the same order.
 */
export interface StepText {
  title?: string;
  /** string for watch/try/experiment/challenge, string[] for discover */
  body?: string | string[];
  /** watch: one caption per frame */
  captions?: string[];
  /** try */
  success?: string;
  hint?: string;
  actionLabel?: string;
  /** challenge: one entry per objective, same order */
  objectives?: Array<{ label: string; hints: [string, string, string] }>;
}

export interface LessonText {
  title: string;
  tagline: string;
  concepts: string[];
  recap: string[];
  /** One entry per step, same order as lessons.ts (`null` for celebrate). */
  steps: Array<StepText | null>;
  /**
   * Challenge feedback is computed from state in English; each pair maps an
   * English message (exact string, or a RegExp) to its translation. With a
   * RegExp, `$1`… in the translation are replaced by the captured groups.
   */
  feedback?: Array<[string | RegExp, string]>;
}

export interface ChapterText {
  title: string;
  description: string;
  upcoming: string[];
}

export interface CurriculumText {
  tiers: Record<Tier, string>;
  chapters: Record<string, ChapterText>;
  lessons: Record<string, LessonText>;
}

const TEXT: Partial<Record<Locale, CurriculumText>> = { fr: CURRICULUM_FR };

function localizeStep(step: Step, t: StepText | null | undefined): Step {
  if (!t) return step;
  switch (step.kind) {
    case "discover":
      return { ...step, title: t.title ?? step.title, body: Array.isArray(t.body) ? t.body : step.body };
    case "watch":
      return {
        ...step,
        title: t.title ?? step.title,
        body: typeof t.body === "string" ? t.body : step.body,
        frames: step.frames.map((f, i) => ({ ...f, caption: t.captions?.[i] ?? f.caption })),
      };
    case "try":
      return {
        ...step,
        title: t.title ?? step.title,
        body: typeof t.body === "string" ? t.body : step.body,
        success: t.success ?? step.success,
        hint: t.hint ?? step.hint,
        action: step.action && t.actionLabel ? { ...step.action, label: t.actionLabel } : step.action,
      };
    case "experiment":
      return { ...step, title: t.title ?? step.title, body: typeof t.body === "string" ? t.body : step.body };
    case "challenge":
      return {
        ...step,
        title: t.title ?? step.title,
        body: typeof t.body === "string" ? t.body : step.body,
        objectives: step.objectives.map((o, i) => ({ ...o, label: t.objectives?.[i]?.label ?? o.label, hints: t.objectives?.[i]?.hints ?? o.hints })),
      };
    default:
      return step;
  }
}

export function translateFeedback(msg: string | null, pairs: LessonText["feedback"]): string | null {
  if (!msg || !pairs) return msg;
  for (const [from, to] of pairs) {
    if (typeof from === "string") {
      if (from === msg) return to;
    } else {
      const m = msg.match(from);
      if (m) return to.replace(/\$(\d)/g, (_, n: string) => m[Number(n)] ?? "");
    }
  }
  return msg;
}

const lessonCache = new Map<string, Lesson>();

export function localizeLesson(lesson: Lesson, locale: Locale): Lesson {
  const text = TEXT[locale]?.lessons[lesson.id];
  if (!text) return lesson;
  const key = `${locale}:${lesson.id}`;
  const hit = lessonCache.get(key);
  if (hit) return hit;
  const out: Lesson = {
    ...lesson,
    title: text.title,
    tagline: text.tagline,
    concepts: text.concepts.length === lesson.concepts.length ? text.concepts : lesson.concepts,
    recap: text.recap,
    steps: lesson.steps.map((s, i) => {
      const st = localizeStep(s, text.steps[i]);
      if (st.kind === "challenge" && st.feedback) {
        const fb = st.feedback;
        return { ...st, feedback: (w, start) => translateFeedback(fb(w, start), text.feedback) };
      }
      return st;
    }),
  };
  lessonCache.set(key, out);
  return out;
}

const chapterCache = new Map<Locale, Chapter[]>();

export function localizedChapters(locale: Locale): Chapter[] {
  const text = TEXT[locale];
  if (!text) return CHAPTERS;
  const hit = chapterCache.get(locale);
  if (hit) return hit;
  const out = CHAPTERS.map((c) => {
    const ct = text.chapters[c.id];
    return {
      ...c,
      title: ct?.title ?? c.title,
      description: ct?.description ?? c.description,
      upcoming: ct?.upcoming.length === c.upcoming.length ? ct.upcoming : c.upcoming,
      lessons: c.lessons.map((l) => localizeLesson(l, locale)),
    };
  });
  chapterCache.set(locale, out);
  return out;
}

export function tierLabel(tier: Tier, locale: Locale, fallback: string) {
  return TEXT[locale]?.tiers[tier] ?? fallback;
}
