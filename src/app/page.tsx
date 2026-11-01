import Link from "next/link";
import { Eye, Gamepad2, GitFork, MousePointerClick, ShieldCheck, Sparkles, SquareTerminal } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { LinkButton } from "@/components/ui/button";
import { CHAPTERS, TIER_LABEL } from "@/features/curriculum";
import { HeroDemo } from "@/features/landing/hero-demo";
import { StartButton } from "@/features/landing/start-button";

export default function Home() {
  return (
    <>
      <AppNav />
      <main className="pb-24 md:pb-0">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-fg-2">
              <Sparkles className="size-3.5 text-violet-2" /> Free · No account needed · Made for total beginners
            </p>
            <h1 className="mt-6 text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              Learn Git by <span className="bg-gradient-to-r from-violet-2 via-violet to-mint bg-clip-text text-transparent">playing</span> with it.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-fg-2">
              Type real Git commands and watch your project&apos;s history grow, branch and merge — live. Short, game-like lessons take you from
              &ldquo;what is a repository?&rdquo; to collaborating on GitHub.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <StartButton />
              <LinkButton href="/playground" variant="secondary" size="lg">
                Explore the playground
              </LinkButton>
            </div>
            <p className="mt-4 text-xs text-fg-3">Your progress is saved in this browser. Everything runs in a safe simulation — nothing can break.</p>
          </div>
          <HeroDemo />
        </section>

        <section className="border-y border-line/60 bg-surface/30">
          <div className="mx-auto grid max-w-6xl gap-px px-4 py-14 sm:grid-cols-3 sm:gap-8">
            {[
              { icon: Eye, title: "See it, then do it", body: "Every idea starts as a little interactive scene before you ever touch a command." },
              { icon: SquareTerminal, title: "A friendly terminal", body: "Assisted mode suggests commands and explains every word. Switch to Real mode when you're ready." },
              { icon: GitFork, title: "History you can watch", body: "Commits pop into the graph, branches split, merges reconnect — exactly as Git really does it." },
            ].map((f) => (
              <div key={f.title} className="py-4">
                <span className="grid size-10 place-items-center rounded-2xl bg-violet-soft text-violet-2">
                  <f.icon className="size-5" />
                </span>
                <h2 className="mt-4 font-semibold">{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Every lesson is a tiny game.</h2>
              <p className="mt-3 text-fg-2">About 5 minutes each. One idea at a time. Mistakes are part of the fun — you can always undo, retry, or ask for a hint.</p>
              <ol className="mt-8 space-y-4">
                {[
                  ["Discover", "An animated scene explains the idea in plain words."],
                  ["Watch", "Step through a real command and see what it changes."],
                  ["Try", "Run it yourself — with a suggestion if you want one."],
                  ["Challenge", "Reach a goal on your own. We check the result, not your typing."],
                  ["Celebrate", "Earn XP, badges, and unlock the next lesson."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface font-mono text-xs text-violet-2">{i + 1}</span>
                    <div>
                      <p className="font-medium">{t}</p>
                      <p className="text-sm text-fg-2">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-3xl border border-line bg-surface/60 p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Gamepad2 className="size-4 text-violet-2" /> Your journey
              </p>
              <ul className="mt-4 space-y-2">
                {CHAPTERS.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
                    <span className="w-6 font-mono text-xs text-fg-3">{String(c.number).padStart(2, "0")}</span>
                    <span className="flex-1 text-sm">{c.title}</span>
                    <span className="text-[11px] text-fg-3">{c.lessons.length ? `${c.lessons.length} lesson${c.lessons.length > 1 ? "s" : ""}` : "coming soon"}</span>
                    <span className="hidden rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-fg-2 sm:inline">{TIER_LABEL[c.tier]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-6 rounded-3xl border border-line bg-gradient-to-br from-violet-soft to-transparent p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-12">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your first commit is 3 minutes away.</h2>
              <p className="mt-2 flex items-start gap-2 text-sm text-fg-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint" />
                Git and GitHub are different things — Gitverse teaches both, and clearly labels the simulated GitHub so you always know which is which.
              </p>
            </div>
            <StartButton />
          </div>
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 text-xs text-fg-3">
            <span className="flex items-center gap-1.5">
              <MousePointerClick className="size-3.5" /> Gitverse — learn Git by playing with it.
            </span>
            <span className="flex gap-4">
              <Link href="/commands" className="hover:text-fg-2">
                Command encyclopedia
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

