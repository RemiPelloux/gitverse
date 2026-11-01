# Gitverse

**Learn Git by playing with it.** A beginner-first, gamified web app. Learners type real Git commands into a safe simulated terminal and watch their repository's history grow, branch and merge in real time.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine + curriculum tests (Vitest)
npm run e2e        # Playwright: desktop + phone journeys (builds required: npm run build)
```

## Architecture

```
src/
  engine/            Pure TypeScript Git simulation. No React, deterministic, JSON state.
    types.ts         World = workdir + repo (commits, refs, HEAD, index, reflog, op, stash, remotes) + simulated GitHub
    shell.ts         Tokenizer (quotes, >, >>, &&) + allowlisted command dispatcher. Failing commands are atomic.
    git/             init/status/add/rm/mv/commit/log/show/diff/restore/tag/reflog · branch/switch/checkout/
                     merge (ff, 3-way, conflicts, --abort)/rebase (with conflicts, --continue/--abort)/reset/
                     revert/cherry-pick/stash · remote/push/fetch/pull/clone
    diff.ts          LCS line diff, unified hunks, diff3 three-way merge with conflict markers
    graph.ts         Stable DAG layout: x = creation order, lanes claimed by first-parent chains in ref order
  features/
    curriculum/      Chapters, lessons and scenario builder. Validators check *state*, never command text
    lab/             Zustand store per workspace (time-travel history), graph, terminal, files, editor,
                     4-stage visualizer, inspector, simulated-GitHub panel, responsive Workspace shell
    lesson/          Lesson player (Discover → Watch → Try → Experiment → Challenge → Celebrate), scenes
    progress/        XP, levels, badges, daily quests, optional streaks, autosaved lessons (localStorage)
    docs/            Command reference shared by the assisted terminal, autocomplete and /commands
```

Every view (graph, terminal output, files, stages, lesson objectives) is derived from one canonical `World`. Commands are pure `(World, input) → { world, lines, events }`; `events` drive animations only.

## What's built

- Routes: landing (with a playable hero demo), `/learn` dashboard + learning path + onboarding, 12 playable lessons across chapters 1, 2, 3, 4, 6, 7 (including 2 boss challenges), `/playground` (5 starting repos, time travel, undo/redo, shareable `#s=` links, full-screen graph), `/commands` encyclopedia with live before/after demos, `/profile` (badges, theme, motion, terminal mode, streak toggle, shortcuts, reset).
- The interface grows with the learner: lessons enable files → editor → remote panels progressively. The terminal has an Assisted mode (suggestion, word-by-word explanation, Run button, plain-language error explanations) and a Real mode.
- Responsive: three columns on desktop (resizable, remembered), two on tablet, tabbed Guide/Graph/Terminal/Files on phones.
- Accessibility: reduced motion (system/forced), keyboard-focusable commits, screen-reader graph summary and commit list, ARIA tabs and live regions.

## Not built yet (deliberate scope for this first slice)

- **Backend:** no PostgreSQL/Drizzle, no GitHub OAuth. Everyone is a guest, and progress lives in `localStorage` (store shape in `features/progress/store.ts`).
- **Libraries swapped for lighter custom code:** the terminal is custom, not xterm.js, for assisted mode and phone support. The editor is a textarea-based editor with conflict tools, not Monaco.
- **Curriculum:** chapters 5 (Rebase), 8 (Pull Requests), 9–12 appear on the path as "coming soon". The engine already supports rebase, cherry-pick, stash and tags. Interactive rebase, bisect, worktrees and submodules return an honest "not available in the simulator yet" error.
- **Not started:** pull request simulator UI, AI tutor, command palette.
