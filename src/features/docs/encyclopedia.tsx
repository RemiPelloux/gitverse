"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Search, ShieldCheck, Skull } from "lucide-react";
import { emptyWorld, execute, runScript, serializeWorld } from "@/engine";
import { GitGraph } from "@/features/lab/git-graph";
import { StagesVisualizer } from "@/features/lab/stages";
import { withHosting } from "@/features/lab/sandboxes";
import { Button, LinkButton } from "@/components/ui/button";
import { useT } from "@/i18n";
import { categoryLabel, localizedDocs, type CommandDoc } from "./commands";

const RISK = {
  safe: { label: "lab.encyclopedia.risk.safe", icon: ShieldCheck, cls: "bg-ok-soft text-ok" },
  careful: { label: "lab.encyclopedia.risk.careful", icon: AlertTriangle, cls: "bg-warn-soft text-warn" },
  destructive: { label: "lab.encyclopedia.risk.destructive", icon: Skull, cls: "bg-bad-soft text-bad" },
} as const;

export function Encyclopedia() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("commit");
  const t = useT();
  const docs = localizedDocs(t.locale);
  const results = docs.filter((d) => (d.name + " " + d.summary + " " + d.plain).toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(docs.map((d) => d.category))];
  const doc = docs.find((d) => d.name === sel)!;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-8 pb-28 md:grid-cols-[260px_minmax(0,1fr)] md:pb-16">
      <aside className="min-w-0 md:sticky md:top-20 md:self-start">
        <h1 className="text-2xl font-semibold tracking-tight">{t("lab.encyclopedia.title")}</h1>
        <p className="mt-1 text-sm text-fg-2">{t("lab.encyclopedia.subtitle")}</p>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-fg-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("lab.encyclopedia.searchPlaceholder")}
            className="w-full rounded-md border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-accent"
            aria-label={t("lab.encyclopedia.searchLabel")}
          />
        </label>
        <nav className="scrollbar-thin mt-4 flex gap-2 overflow-x-auto pb-2 md:block md:max-h-[65vh] md:space-y-4 md:overflow-y-auto" aria-label={t("lab.encyclopedia.navLabel")}>
          {groups.map((g) => {
            const items = results.filter((d) => d.category === g);
            if (!items.length) return null;
            return (
              <div key={g} className="contents md:block">
                <p className="mb-1 hidden px-2 text-[11px] font-semibold text-fg-3 md:block">{categoryLabel(g, t.locale)}</p>
                {items.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => setSel(d.name)}
                    aria-current={sel === d.name}
                    className={clsx(
                      "shrink-0 rounded-lg px-2.5 py-1.5 text-left font-mono text-sm md:flex md:w-full md:items-center md:justify-between",
                      sel === d.name ? "bg-accent-soft text-accent-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    git {d.name}
                  </button>
                ))}
              </div>
            );
          })}
          {!results.length && <p className="px-2 text-sm text-fg-3">{t("lab.encyclopedia.noMatch", { q })}</p>}
        </nav>
      </aside>
      <CommandPage key={doc.name} doc={doc} />
    </div>
  );
}

function CommandPage({ doc }: { doc: CommandDoc }) {
  const { before, after } = useMemo(() => {
    const before = runScript(withHosting(emptyWorld()), doc.demo.setup);
    return { before, after: execute(before, doc.demo.command) };
  }, [doc]);
  const [showAfter, setShowAfter] = useState(false);
  const t = useT();
  const risk = RISK[doc.risk];
  const world = showAfter ? after.world : before;
  return (
    <article className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-3xl font-semibold tracking-tight">git {doc.name}</h2>
        <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", risk.cls)}>
          <risk.icon className="size-3.5" /> {t(risk.label)}
        </span>
      </div>
      <p className="mt-2 text-lg text-fg">{doc.summary}</p>
      <p className="mt-1 text-fg-2">{doc.plain}</p>
      {doc.riskNote && <p className={clsx("mt-3 rounded-md px-3 py-2 text-sm", risk.cls)}>{doc.riskNote}</p>}

      <section className="mt-6 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <p className="text-sm font-medium">{t("lab.encyclopedia.liveExample")}</p>
          <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs" role="radiogroup" aria-label={t("lab.encyclopedia.beforeAfter")}>
            {[false, true].map((a) => (
              <button
                key={String(a)}
                role="radio"
                aria-checked={showAfter === a}
                onClick={() => setShowAfter(a)}
                className={clsx("rounded-md px-3 py-1", showAfter === a ? "bg-elevated text-fg shadow-sm" : "text-fg-3 hover:text-fg")}
              >
                {a ? t("lab.encyclopedia.after") : t("lab.encyclopedia.before")}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56 bg-surface-2/30">
          <GitGraph world={world} events={showAfter ? after.events : []} eventKey={showAfter ? 1 : 0} compact />
        </div>
        <div className="border-t border-line p-3">
          <StagesVisualizer world={world} showRemote={doc.category === "Remote"} />
        </div>
        <div className="terminal bg-term px-4 py-3 font-mono text-[13px]">
          <p>
            <span className="text-[var(--t-green)]">$</span> <span className="text-white">{doc.demo.command}</span>
          </p>
          {showAfter ? (
            after.lines.slice(0, 14).map((l, i) => (
              <p key={i} className="whitespace-pre-wrap text-[var(--t-muted)]">
                {l.text}
              </p>
            ))
          ) : (
            <Button size="sm" className="mt-2 font-sans" onClick={() => setShowAfter(true)}>
              {t("lab.encyclopedia.runIt")} <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </section>
      <div className="mt-3">
        <LinkButton href={`/playground#s=${serializeWorld(before)}`} variant="secondary" size="sm">
          {t("lab.encyclopedia.tryIt")} <ArrowRight className="size-3.5" />
        </LinkButton>
      </div>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">{t("lab.encyclopedia.syntax")}</h3>
          <ul className="mt-2 space-y-1.5">
            {doc.syntax.map((s) => (
              <li key={s}>
                <code className="block rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-sm">{s}</code>
              </li>
            ))}
          </ul>
        </div>
        {doc.flags.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">{t("lab.encyclopedia.options")}</h3>
            <dl className="mt-2 space-y-2">
              {doc.flags.map((f) => (
                <div key={f.flag} className="flex gap-3 text-sm">
                  <dt className="w-28 shrink-0 font-mono text-warn">{f.flag}</dt>
                  <dd className="text-fg-2">{f.desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </article>
  );
}
