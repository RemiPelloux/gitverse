import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_LESSONS, getLesson } from "@/features/curriculum";
import { LessonPlayer } from "@/features/lesson/lesson-player";

/** Every lesson is known at build time (required for the static GitHub Pages build). */
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_LESSONS.map((l) => ({ lessonId: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[lessonId]">): Promise<Metadata> {
  const { lessonId } = await params;
  return { title: getLesson(lessonId)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: PageProps<"/learn/[lessonId]">) {
  const { lessonId } = await params;
  if (!getLesson(lessonId)) notFound();
  return <LessonPlayer lessonId={lessonId} />;
}
