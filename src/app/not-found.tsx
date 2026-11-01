import Link from "next/link";
import { AppNav } from "@/components/app-nav";

export default function NotFound() {
  return (
    <>
      <AppNav />
      <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-4 py-24">
        <p className="font-mono text-sm text-fg-3">$ git switch this-page</p>
        <p className="mt-2 font-mono text-sm text-bad">fatal: invalid reference: this-page</p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-fg-2">This page doesn&apos;t exist — maybe the link has a typo, or it moved.</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-[#b0361a]">
            Go home
          </Link>
          <Link href="/learn" className="rounded-md border border-line bg-surface-2 px-4 py-2 font-medium hover:border-line-strong">
            Your learning path
          </Link>
        </div>
      </main>
    </>
  );
}
