import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { LearnDashboard } from "@/features/progress/learn-dashboard";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <>
      <AppNav />
      <main>
        <LearnDashboard />
      </main>
    </>
  );
}
