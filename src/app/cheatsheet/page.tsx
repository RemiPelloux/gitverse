import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { Cheatsheet } from "@/features/docs/cheatsheet";

export const metadata: Metadata = { title: "Git cheatsheet" };

export default function CheatsheetPage() {
  return (
    <>
      <AppNav />
      <main>
        <Cheatsheet />
      </main>
    </>
  );
}
