import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { Encyclopedia } from "@/features/docs/encyclopedia";

export const metadata: Metadata = { title: "Command encyclopedia" };

export default function CommandsPage() {
  return (
    <>
      <AppNav />
      <main>
        <Encyclopedia />
      </main>
    </>
  );
}
