import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_LESSONS, getLesson } from "@/features/curriculum";
import { LessonPlayer } from "@/features/lesson/lesson-player";

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
