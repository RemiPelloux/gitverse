"use client";

import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n";

export default function NotFound() {
  const t = useT();
  return (
    <>
      <AppNav />
      <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-4 py-24">
        <p className="font-mono text-sm text-fg-3">$ git switch this-page</p>
        <p className="mt-2 font-mono text-sm text-bad">fatal: invalid reference: this-page</p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("notFound.title")}</h1>
        <p className="mt-2 text-fg-2">{t("notFound.body")}</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/" className={buttonClass("primary")}>
            {t("notFound.home")}
          </Link>
          <Link href="/learn" className={buttonClass("secondary")}>
            {t("notFound.path")}
          </Link>
        </div>
      </main>
    </>
  );
}
