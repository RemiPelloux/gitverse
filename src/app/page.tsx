import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { LinkButton } from "@/components/ui/button";
import { CHAPTERS, TIER_LABEL } from "@/features/curriculum";
import { HeroDemo } from "@/features/landing/hero-demo";
import { StartButton } from "@/features/landing/start-button";

/** What Gitverse does, told as a commit history. */
const LOG = [
  { hash: "e3f1a09", head: true, msg: "Type real commands, see the result in the graph immediately" },
  { hash: "9b2c4d1", msg: "Explain each idea with a small scene before asking for a command" },
  { hash: "51ad7e8", msg: "Add an assisted terminal that explains every word you type" },
  { hash: "c08e2f3", msg: "Check challenges by the state of your repository, not your typing" },
  { hash: "7f9e011", msg: "Simulate GitHub locally — clearly labelled, nothing leaves your browser" },
  { hash: "0d4b6aa", msg: "Initial commit: learn Git by using it" },
];

const STEPS = [
  ["discover", "a short interactive scene explains one idea"],
  ["watch", "step through a real command and what it changes"],
  ["try", "run it yourself, with a suggestion if you want one"],
  ["challenge", "reach a goal on your own; hints are free"],
  ["celebrate", "XP, badges, and the next lesson unlocks"],
];

export default function Home() {
  return (
    <>
      <AppNav />
      <main className="pb-24 md:pb-0">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 lg:grid-cols-2 lg:pt-20">
          <div>
            <p className="font-mono text-sm text-fg-3">$ git learn --from-scratch</p>
            <h1 className="mt-4 text-[2.5rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-[3.4rem]">
              Learn Git by <span className="text-accent-fg">using</span> it.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-fg-2">
              Type Git commands and watch your project&apos;s history grow, branch and merge. Short lessons take you from &ldquo;what is a repository?&rdquo; to
              working with others on GitHub.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <StartButton />
              <LinkButton href="/playground" variant="secondary" size="lg">
                Open the playground
              </LinkButton>
            </div>
            <p className="mt-4 text-sm text-fg-3">No account needed. Progress stays in this browser. Nothing you type can break anything.</p>
          </div>
          <HeroDemo />
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Why it works</h2>
              <p className="mt-2 text-fg-2">Git is easier once you can see what each command does. So everything you type is drawn as it happens.</p>
            </div>
            <ol className="font-mono text-[13px] leading-7" aria-label="Features">
              {LOG.map((c, i) => (
                <li key={c.hash} className="flex gap-3">
                  <span className="relative flex w-3 shrink-0 justify-center" aria-hidden>
                    <span className={i === LOG.length - 1 ? "absolute top-0 h-3.5 w-px bg-line-strong" : "absolute inset-y-0 w-px bg-line-strong"} />
                    <span className="relative mt-[9px] size-2.5 rounded-full border-2 border-accent-mark bg-surface" />
                  </span>
                  <span className="shrink-0 text-warn">{c.hash}</span>
                  <span className="min-w-0">
                    {c.head && (
                      <span className="mr-2 text-fg-3">
                        (<span className="text-info">HEAD</span> -&gt; <span className="text-ok">main</span>)
                      </span>
                    )}
                    <span className="text-fg">{c.msg}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Every lesson, five steps</h2>
            <p className="mt-2 text-fg-2">About five minutes each, one idea at a time. Mistakes are expected — you can undo, retry or ask for a hint.</p>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {STEPS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-sm">
                  <dt className="font-mono text-accent-fg">{k}</dt>
                  <dd className="text-fg-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">The curriculum</h2>
            <p className="mt-2 text-fg-2">Twelve chapters, from your first commit to rescuing a broken main branch.</p>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {CHAPTERS.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-6 font-mono text-xs text-fg-3">{String(c.number).padStart(2, "0")}</span>
                  <span className="flex-1">{c.title}</span>
                  <span className="text-xs text-fg-3">{c.lessons.length ? `${c.lessons.length} lesson${c.lessons.length > 1 ? "s" : ""}` : "coming soon"}</span>
                  <span className="hidden w-24 text-right text-xs text-fg-3 sm:inline">{TIER_LABEL[c.tier]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="flex flex-col gap-6 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Your first commit is three minutes away.</h2>
              <p className="mt-1 max-w-xl text-sm text-fg-2">
                Git and GitHub are different things. Gitverse teaches both, and the simulated GitHub is always labelled so you know which is which.
              </p>
            </div>
            <StartButton />
          </div>
          <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 text-xs text-fg-3">
            <span>Gitverse — learn Git by using it.</span>
            <span className="flex gap-4">
              <Link href="/commands" className="hover:text-fg-2">
                Command reference
              </Link>
              <Link href="/profile" className="hover:text-fg-2">
                Settings & accessibility
              </Link>
            </span>
          </footer>
        </section>
      </main>
    </>
  );
}
