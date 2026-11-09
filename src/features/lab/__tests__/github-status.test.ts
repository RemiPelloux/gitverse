import { describe, expect, it } from "vitest";
import { emptyWorld, type HostedRepo, type PullRequest, type WorkflowRun } from "@/engine";
import { checkStatus, checksState, hasGitHubData, hostedFor, latestRunFor, mergeBlockers, recentRuns, reviewSummary, sortPulls } from "../github-status";

const host = (extra: Partial<HostedRepo> = {}): HostedRepo => ({
  url: "https://github.com/acme/app",
  owner: "acme",
  name: "app",
  branches: { main: "c1" },
  defaultBranch: "main",
  ...extra,
});

const pr = (extra: Partial<PullRequest> = {}): PullRequest => ({
  number: 1,
  title: "Add login",
  body: "",
  author: "you",
  head: "feature",
  base: "main",
  headCommit: "c2",
  state: "open",
  reviews: [],
  ...extra,
});

const run = (extra: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: 1,
  workflow: "CI",
  event: "pull_request",
  branch: "feature",
  commit: "c2",
  status: "success",
  jobs: [{ name: "test", ok: true, log: [] }],
  ...extra,
});

const PROTECTED = { main: { requirePullRequest: true, requiredApprovals: 1, requiredChecks: ["test"] } };

describe("hostedFor", () => {
  it("prefers origin and returns null without a matching hosted repo", () => {
    const w = emptyWorld();
    expect(hostedFor(w)).toBeNull();
    const a = host({ url: "u-a" });
    const b = host({ url: "u-b", name: "b" });
    w.hosted = { "u-a": a, "u-b": b };
    w.repo = { remotes: { upstream: "u-a", origin: "u-b" } } as unknown as typeof w.repo;
    expect(hostedFor(w)).toEqual({ remote: "origin", host: b });
    w.repo = { remotes: { upstream: "u-a", origin: "missing" } } as unknown as typeof w.repo;
    expect(hostedFor(w)?.remote).toBe("upstream");
  });
});

describe("hasGitHubData", () => {
  it("is false for a plain hosted repo and true once any GitHub data exists", () => {
    expect(hasGitHubData(host())).toBe(false);
    expect(hasGitHubData(host({ pulls: [], secrets: {} }))).toBe(false);
    expect(hasGitHubData(host({ issues: [{ number: 1, title: "x", body: "", author: "a", state: "open", labels: [] }] }))).toBe(true);
    expect(hasGitHubData(host({ protection: PROTECTED }))).toBe(true);
  });
});

describe("runs", () => {
  it("finds the latest run on a commit", () => {
    const h = host({ runs: [run({ id: 1, status: "failure" }), run({ id: 2 }), run({ id: 3, commit: "other", status: "failure" })] });
    expect(latestRunFor(h, "c2")?.id).toBe(2);
    expect(checksState(h, pr())).toBe("success");
    expect(checksState(h, pr({ headCommit: "nope" }))).toBe("none");
  });

  it("lists the newest runs first, capped", () => {
    const h = host({ runs: [1, 2, 3, 4, 5, 6, 7].map((id) => run({ id })) });
    expect(recentRuns(h).map((r) => r.id)).toEqual([7, 6, 5, 4, 3]);
    expect(recentRuns(host())).toEqual([]);
  });
});

describe("reviewSummary", () => {
  it("keeps each reviewer's latest verdict and ignores self-reviews", () => {
    const s = reviewSummary(
      pr({
        reviews: [
          { author: "maya", state: "changes_requested", body: "" },
          { author: "maya", state: "approved", body: "" },
          { author: "leo", state: "approved", body: "" },
          { author: "leo", state: "commented", body: "nit" },
          { author: "sam", state: "commented", body: "?" },
          { author: "you", state: "approved", body: "" },
        ],
      }),
    );
    expect(s).toEqual({ approvedBy: ["maya", "leo"], changesRequestedBy: [], commentedBy: ["sam"] });
  });
});

describe("mergeBlockers", () => {
  it("has nothing to say without protection or for closed PRs", () => {
    expect(mergeBlockers(host(), pr())).toEqual([]);
    expect(mergeBlockers(host(), pr({ reviews: [{ author: "maya", state: "changes_requested", body: "" }] }))).toEqual([{ kind: "changesRequested", by: ["maya"] }]);
    expect(mergeBlockers(host({ protection: PROTECTED }), pr({ state: "merged" }))).toEqual([]);
  });

  it("reports missing approvals and pending checks", () => {
    expect(mergeBlockers(host({ protection: PROTECTED }), pr())).toEqual([
      { kind: "approvals", have: 0, need: 1 },
      { kind: "checksPending", checks: ["test"] },
    ]);
  });

  it("reports change requests and failing checks", () => {
    const h = host({ protection: PROTECTED, runs: [run({ status: "failure", jobs: [{ name: "test", ok: false, log: [] }] })] });
    const p = pr({ reviews: [{ author: "maya", state: "changes_requested", body: "" }] });
    expect(mergeBlockers(h, p)).toEqual([
      { kind: "changesRequested", by: ["maya"] },
      { kind: "approvals", have: 0, need: 1 },
      { kind: "checksFailing", checks: ["test"] },
    ]);
  });

  it("only counts pull_request runs that ran the required job", () => {
    const h = host({
      protection: PROTECTED,
      runs: [run({ id: 1, jobs: [{ name: "test", ok: false, log: [] }] }), run({ id: 2, jobs: [{ name: "lint", ok: true, log: [] }] }), run({ id: 3, event: "push" })],
    });
    const p = pr({ reviews: [{ author: "maya", state: "approved", body: "" }] });
    expect(checkStatus(h, p, "test")).toBe("fail");
    expect(checkStatus(h, p, "build")).toBe("missing");
    expect(mergeBlockers(h, p)).toEqual([{ kind: "checksFailing", checks: ["test"] }]);
  });

  it("is empty once approved and green", () => {
    const h = host({ protection: PROTECTED, runs: [run()] });
    expect(mergeBlockers(h, pr({ reviews: [{ author: "maya", state: "approved", body: "" }] }))).toEqual([]);
  });
});

describe("sortPulls", () => {
  it("splits open from done, newest first", () => {
    const { open, done } = sortPulls([pr({ number: 1 }), pr({ number: 2, state: "merged" }), pr({ number: 3 }), pr({ number: 4, state: "closed" })]);
    expect(open.map((p) => p.number)).toEqual([3, 1]);
    expect(done.map((p) => p.number)).toEqual([4, 2]);
  });
});
