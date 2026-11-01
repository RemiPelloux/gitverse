import { ancestors, currentBranch, headCommit, headCommitId, isClean, status, type World } from "@/engine";

export const hasRepo = (w: World) => w.repo !== null;
export const commitCount = (w: World) => Object.keys(w.repo?.commits ?? {}).length;
export const reachableCount = (w: World) => {
  const h = w.repo && headCommitId(w.repo);
  return h ? ancestors(w.repo!, h).size : 0;
};
export const onBranch = (w: World, name: string) => !!w.repo && currentBranch(w.repo) === name;
export const branchExists = (w: World, name: string) => !!w.repo?.branches[name];
export const fileExists = (w: World, path: string) => path in w.workdir;
export const staged = (w: World, path: string) =>
  !!w.repo && w.repo.index[path] !== undefined && w.repo.index[path] === w.workdir[path] && headCommit(w.repo)?.tree[path] !== w.repo.index[path];
export const inHead = (w: World, path: string) => !!w.repo && headCommit(w.repo)?.tree[path] !== undefined;
export const committedContent = (w: World, path: string) => (w.repo ? headCommit(w.repo)?.tree[path] : undefined);
export const clean = (w: World) => !!w.repo && isClean(w);
export const newCommitsSince = (w: World, start: World) => {
  const before = new Set(Object.keys(start.repo?.commits ?? {}));
  return Object.keys(w.repo?.commits ?? {}).filter((id) => !before.has(id) && w.repo!.commits[id].author !== "Maya").length;
};
export const ranStatus = (w: World) => w.repo !== null; // status is read-only; tracked via terminal events
export const isModified = (w: World, path: string) => status(w).some((e) => e.path === path && (e.unstaged || e.untracked));
export const branchContains = (w: World, branch: string, commitId: string | undefined) =>
  !!commitId && !!w.repo?.branches[branch] && ancestors(w.repo, w.repo.branches[branch]).has(commitId);
export const headIsMerge = (w: World) => (w.repo ? (headCommit(w.repo)?.parents.length ?? 0) > 1 : false);
export const findCommit = (w: World, message: string) =>
  Object.values(w.repo?.commits ?? {}).find((c) => c.message === message)?.id;
export const visitedInReflog = (w: World, commitId: string | undefined) =>
  !!commitId && !!w.repo?.reflog.some((e) => e.commit === commitId && e.message.startsWith("checkout"));
export const noConflictMarkers = (w: World) => !Object.values(w.workdir).some((c) => /^(<<<<<<<|>>>>>>>) /m.test(c));
