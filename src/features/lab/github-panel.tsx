"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Check, ChevronRight, CircleCheck, CircleDot, GitMerge, GitPullRequest, GitPullRequestClosed, KeyRound, MessageSquare, Play, ShieldCheck, Tag, X } from "lucide-react";
import { shortId, type HostedRepo, type Issue, type Protection, type PullRequest, type Release, type WorkflowRun } from "@/engine";
import { useT, type T } from "@/i18n";
import { checksState, mergeBlockers, recentRuns, reviewSummary, sortPulls, type ChecksState } from "./github-status";

/** GitHub's merged purple, from the shared lane palette. */
const PURPLE = "var(--lane-4)";

const enter = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: "easeOut" as const },
};

function hashLane(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `var(--lane-${Math.abs(h) % 6})`;
}

/** "Requires a pull request · 1 approval · checks: test" */
export function protectionText(t: T, rule: Protection) {
  const parts: string[] = [];
  if (rule.requirePullRequest) parts.push(t("lab.github.requiresPr"));
  if (rule.requiredApprovals > 0) parts.push(t(rule.requiredApprovals === 1 ? "lab.github.approvalsOne" : "lab.github.approvalsOther", { n: rule.requiredApprovals }));
  if (rule.requiredChecks.length) parts.push(t("lab.github.checks", { list: rule.requiredChecks.join(", ") }));
  return parts.join(" · ");
}

export function ProtectedBadge({ rule }: { rule: Protection }) {
  const t = useT();
  const tip = protectionText(t, rule);
  return (
    <span
      title={tip}
      aria-label={`${t("lab.github.protectedBadge")}: ${tip}`}
      className="inline-flex items-center gap-0.5 rounded-md bg-info-soft px-1 py-px text-[10px] font-medium text-info"
    >
      <ShieldCheck className="size-3" />
      {t("lab.github.protectedBadge")}
    </span>
  );
}

function Section({ icon, title, count, children }: { icon: ReactNode; title: string; count?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line">
      <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
        <span className="text-fg-3">{icon}</span>
        <h3 className="text-xs font-semibold">{title}</h3>
        {count !== undefined && <span className="ml-auto text-[11px] text-fg-3">{count}</span>}
      </header>
      {children}
    </section>
  );
}

function Expander({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RowButton({ open, onClick, children }: { open: boolean; onClick: () => void; children: ReactNode }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      title={t("lab.github.toggleDetails")}
      className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2/60"
    >
      {children}
      <ChevronRight className={clsx("mt-0.5 size-3.5 shrink-0 text-fg-3 transition-transform", open && "rotate-90")} />
    </button>
  );
}

function BranchPill({ name }: { name: string }) {
  return <span className="max-w-[9rem] truncate rounded bg-surface-2 px-1 font-mono text-[11px] text-fg-2">{name}</span>;
}

function ChecksDot({ state }: { state: ChecksState }) {
  const t = useT();
  return (
    <span
      title={t(`lab.github.checksState.${state}`)}
      aria-label={t(`lab.github.checksState.${state}`)}
      className={clsx("mt-1 size-2 shrink-0 rounded-full", state === "success" ? "bg-ok" : state === "failure" ? "bg-bad" : "border border-warn bg-warn-soft")}
    />
  );
}

/* ───────────────────────── Pull requests ───────────────────────── */

function PrIcon({ state }: { state: PullRequest["state"] }) {
  if (state === "merged") return <GitMerge className="size-4" style={{ color: PURPLE }} />;
  if (state === "closed") return <GitPullRequestClosed className="size-4 text-bad" />;
  return <GitPullRequest className="size-4 text-ok" />;
}

function ReviewLine({ pr }: { pr: PullRequest }) {
  const t = useT();
  const r = reviewSummary(pr);
  if (r.changesRequestedBy.length)
    return (
      <span className="inline-flex items-center gap-0.5 text-bad">
        <X className="size-3" />
        {t("lab.github.changesBy", { list: r.changesRequestedBy.join(", ") })}
      </span>
    );
  if (r.approvedBy.length)
    return (
      <span className="inline-flex items-center gap-0.5 text-ok">
        <Check className="size-3" />
        {t("lab.github.approvedBy", { list: r.approvedBy.join(", ") })}
      </span>
    );
  if (r.commentedBy.length)
    return (
      <span className="inline-flex items-center gap-0.5">
        <MessageSquare className="size-3" />
        {t("lab.github.commentedBy", { list: r.commentedBy.join(", ") })}
      </span>
    );
  return pr.state === "open" ? <span>{t("lab.github.noReviewsShort")}</span> : null;
}

function PullRow({ host, pr }: { host: HostedRepo; pr: PullRequest }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const blockers = mergeBlockers(host, pr);
  const rule = host.protection?.[pr.base];
  return (
    <motion.li layout="position" {...enter} className="border-b border-line last:border-b-0">
      <RowButton open={open} onClick={() => setOpen((o) => !o)}>
        <span className="mt-px shrink-0">
          <PrIcon state={pr.state} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            <span className="font-normal text-fg-3">#{pr.number}</span> {pr.title}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-fg-3">
            <BranchPill name={pr.head} />→<BranchPill name={pr.base} />
            {pr.state === "merged" && pr.mergedWith && (
              <span
                className="ml-auto shrink-0 rounded px-1 text-[10px] font-medium"
                style={{
                  color: PURPLE,
                  backgroundColor: `color-mix(in srgb, ${PURPLE} 12%, transparent)`,
                }}
              >
                {t(`lab.github.mergedWith.${pr.mergedWith}`)}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-fg-3">
            <ReviewLine pr={pr} />
          </span>
        </span>
        <ChecksDot state={checksState(host, pr)} />
      </RowButton>
      <Expander open={open}>
        <div className="space-y-2 px-3 pb-3 pl-9 text-xs">
          <p className="text-[11px] text-fg-3">
            {t(`lab.github.state.${pr.state}`)} · {t("lab.github.openedBy", { author: pr.author })} · <span className="font-mono">{shortId(pr.headCommit)}</span>
          </p>
          <p className={clsx("rounded-md bg-surface-2 p-2 whitespace-pre-wrap", pr.body ? "text-fg-2" : "text-fg-3 italic")}>{pr.body || t("lab.github.noDescription")}</p>
          {pr.reviews.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-fg-3">{t("lab.github.reviews")}</p>
              <ul className="space-y-1.5">
                {pr.reviews.map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    {r.state === "approved" ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-ok" />
                    ) : r.state === "changes_requested" ? (
                      <X className="mt-0.5 size-3.5 shrink-0 text-bad" />
                    ) : (
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                    )}
                    <span className="min-w-0">
                      <span className="font-medium">{r.author}</span> <span className="text-fg-3">{t(`lab.github.reviewState.${r.state}`)}</span>
                      {r.body && <span className="block text-fg-2">{r.body}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pr.state === "open" &&
            (blockers.length ? (
              <div className="rounded-md border border-bad/30 bg-bad-soft p-2">
                <p className="flex items-center gap-1 font-medium text-bad">
                  <X className="size-3.5" />
                  {t("lab.github.blocked")}
                </p>
                <ul className="mt-1 space-y-0.5 pl-[1.125rem] text-[11px] text-fg-2">
                  {blockers.map((b) => (
                    <li key={b.kind} className="list-disc">
                      {b.kind === "approvals"
                        ? t("lab.github.blocker.approvals", {
                            need: b.need,
                            have: b.have,
                          })
                        : b.kind === "changesRequested"
                          ? t("lab.github.blocker.changesRequested", {
                              list: b.by.join(", "),
                            })
                          : t(`lab.github.blocker.${b.kind}`, {
                              list: b.checks.join(", "),
                            })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : rule ? (
              <p className="flex items-center gap-1 rounded-md border border-ok/30 bg-ok-soft p-2 font-medium text-ok">
                <Check className="size-3.5" />
                {t("lab.github.readyToMerge")}
              </p>
            ) : (
              <p className="text-[11px] text-fg-3">{t("lab.github.noRule", { branch: pr.base })}</p>
            ))}
        </div>
      </Expander>
    </motion.li>
  );
}

function PullsSection({ host }: { host: HostedRepo }) {
  const t = useT();
  const [showDone, setShowDone] = useState(false);
  const { open, done } = sortPulls(host.pulls ?? []);
  const [before, after] = t("lab.github.noPulls").split("{cmd}");
  return (
    <Section icon={<GitPullRequest className="size-3.5" />} title={t("lab.github.pulls")} count={open.length ? t("lab.github.openCount", { n: open.length }) : undefined}>
      {open.length === 0 && done.length === 0 && (
        <p className="px-3 py-2 text-[11px] text-fg-3">
          {before}
          <code className="font-mono text-fg-2">gh pr create</code>
          {after}
        </p>
      )}
      <ul>
        <AnimatePresence initial={false}>
          {[...open, ...(showDone ? done : [])].map((pr) => (
            <PullRow key={pr.number} host={host} pr={pr} />
          ))}
        </AnimatePresence>
      </ul>
      {done.length > 0 && (
        <button
          onClick={() => setShowDone((s) => !s)}
          className="w-full border-t border-line px-3 py-1.5 text-left text-[11px] font-medium text-fg-3 transition-colors hover:text-fg-2"
        >
          {showDone ? t("lab.github.hideClosed") : t("lab.github.showClosed", { n: done.length })}
        </button>
      )}
    </Section>
  );
}

/* ───────────────────────── Actions ───────────────────────── */

function logTone(line: string) {
  const l = line.trimStart();
  if (/^(✓|✔|PASS\b|ok\b)/i.test(l)) return "text-t-green";
  if (/^(✗|✘|×|FAIL\b|Error\b|error:)/i.test(l) || /exit code [1-9]/i.test(l)) return "text-t-red";
  if (/^(\$|>|Run\b)/.test(l)) return "text-t-blue";
  if (/^(warn|⚠)/i.test(l)) return "text-t-yellow";
  return "text-t-text";
}

function RunRow({ run }: { run: WorkflowRun }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ok = run.status === "success";
  return (
    <motion.li layout="position" {...enter} className="border-b border-line last:border-b-0">
      <RowButton open={open} onClick={() => setOpen((o) => !o)}>
        <span
          className={clsx("mt-px grid size-4 shrink-0 place-items-center rounded-full", ok ? "bg-ok text-[var(--on-ok)]" : "bg-bad text-white")}
          aria-label={t(`lab.github.runStatus.${run.status}`)}
        >
          {ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            {run.workflow}
            {run.pr !== undefined && <span className="font-normal text-fg-3"> · #{run.pr}</span>}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-fg-3">
            <span className="shrink-0">{t(`lab.github.event.${run.event}`)}</span>
            ·<BranchPill name={run.branch} />
            <span className="ml-auto shrink-0 font-mono text-info">{shortId(run.commit)}</span>
          </span>
        </span>
      </RowButton>
      <Expander open={open}>
        <div className="space-y-2 px-3 pb-3 pl-9">
          {run.jobs.map((job) => (
            <div key={job.name} className="overflow-hidden rounded-md border border-line">
              <p className="flex items-center gap-1.5 bg-surface-2 px-2 py-1 text-[11px] font-medium">
                {job.ok ? <Check className="size-3 text-ok" /> : <X className="size-3 text-bad" />}
                {job.name}
              </p>
              <pre className="terminal scrollbar-thin max-h-48 overflow-auto bg-term px-2 py-1.5 font-mono text-[11px] leading-[1.5]">
                {job.log.length ? (
                  job.log.map((line, i) => (
                    <span key={i} className={clsx("block whitespace-pre-wrap break-words", logTone(line))}>
                      {line || " "}
                    </span>
                  ))
                ) : (
                  <span className="text-t-muted">{t("lab.github.noLog")}</span>
                )}
              </pre>
            </div>
          ))}
        </div>
      </Expander>
    </motion.li>
  );
}

function RunsSection({ host }: { host: HostedRepo }) {
  const t = useT();
  const runs = recentRuns(host, 5);
  return (
    <Section icon={<Play className="size-3.5" />} title={t("lab.github.actions")}>
      <ul>
        <AnimatePresence initial={false}>
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </AnimatePresence>
      </ul>
    </Section>
  );
}

/* ───────────────────────── Issues ───────────────────────── */

function IssueRow({ issue }: { issue: Issue }) {
  const t = useT();
  const open = issue.state === "open";
  return (
    <motion.li layout="position" {...enter} className="flex items-start gap-2 border-b border-line px-3 py-2 last:border-b-0">
      {open ? <CircleDot className="mt-px size-4 shrink-0 text-ok" /> : <CircleCheck className="mt-px size-4 shrink-0" style={{ color: PURPLE }} />}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">
          <span className="font-normal text-fg-3">#{issue.number}</span> {issue.title}
        </span>
        {(issue.labels.length > 0 || issue.closedBy) && (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {issue.labels.map((l) => (
              <span
                key={l}
                className="rounded-full px-1.5 text-[10px] font-medium"
                style={{
                  color: hashLane(l),
                  backgroundColor: `color-mix(in srgb, ${hashLane(l)} 13%, transparent)`,
                }}
              >
                {l}
              </span>
            ))}
            {issue.closedBy && (
              <span className="text-[11px] text-fg-3">
                {t("lab.github.closedBy", {
                  ref: issue.closedBy.startsWith("#") ? issue.closedBy : shortId(issue.closedBy),
                })}
              </span>
            )}
          </span>
        )}
      </span>
    </motion.li>
  );
}

function IssuesSection({ host }: { host: HostedRepo }) {
  const t = useT();
  const issues = [...(host.issues ?? [])].sort((a, b) => (a.state === b.state ? b.number - a.number : a.state === "open" ? -1 : 1));
  const nOpen = issues.filter((i) => i.state === "open").length;
  const nClosed = issues.length - nOpen;
  return (
    <Section
      icon={<CircleDot className="size-3.5" />}
      title={t("lab.github.issues")}
      count={[nOpen && t("lab.github.openCount", { n: nOpen }), nClosed && t("lab.github.closedCount", { n: nClosed })].filter(Boolean).join(" · ")}
    >
      <ul>
        <AnimatePresence initial={false}>
          {issues.map((i) => (
            <IssueRow key={i.number} issue={i} />
          ))}
        </AnimatePresence>
      </ul>
    </Section>
  );
}

/* ───────────────────────── Releases & secrets ───────────────────────── */

function ReleasesSection({ releases }: { releases: Release[] }) {
  const t = useT();
  const newest = [...releases].reverse();
  return (
    <Section icon={<Tag className="size-3.5" />} title={t("lab.github.releases")}>
      <ul>
        <AnimatePresence initial={false}>
          {newest.map((r, i) => (
            <motion.li key={r.tag} layout="position" {...enter} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
              <span className="rounded-md bg-warn-soft px-1.5 py-px font-mono text-[11px] text-warn">{r.tag}</span>
              <span className="min-w-0 flex-1 truncate text-xs" title={r.notes || undefined}>
                {r.title}
              </span>
              {i === 0 && <span className="shrink-0 rounded-full border border-ok/40 px-1.5 text-[10px] font-semibold text-ok">{t("lab.github.latest")}</span>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Section>
  );
}

function SecretsSection({ names }: { names: string[] }) {
  const t = useT();
  return (
    <Section icon={<KeyRound className="size-3.5" />} title={t("lab.github.secrets")} count={names.length}>
      <div className="px-3 py-2">
        <ul className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {names.map((n) => (
              <motion.li key={n} layout="position" {...enter} className="flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
                <KeyRound className="size-3 text-warn" />
                {n}
                <span className="text-fg-3" aria-hidden>
                  ••••
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <p className="mt-1.5 text-[11px] text-fg-3">{t("lab.github.secretsHint")}</p>
      </div>
    </Section>
  );
}

/** GitHub-only state of a hosted repo. Sections without data are not rendered at all. */
export function GitHubSections({ host }: { host: HostedRepo }) {
  const secrets = Object.keys(host.secrets ?? {}).sort();
  const showPulls = host.pulls !== undefined || Object.keys(host.protection ?? {}).length > 0;
  return (
    <>
      {showPulls && <PullsSection host={host} />}
      {(host.runs?.length ?? 0) > 0 && <RunsSection host={host} />}
      {(host.issues?.length ?? 0) > 0 && <IssuesSection host={host} />}
      {(host.releases?.length ?? 0) > 0 && <ReleasesSection releases={host.releases!} />}
      {secrets.length > 0 && <SecretsSection names={secrets} />}
    </>
  );
}
