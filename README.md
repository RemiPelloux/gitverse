# Gitverse

**Learn Git by using it.** A beginner-first, gamified web app in **English and French**. Learners type real Git commands into a safe simulated terminal and watch their repository's history grow, branch and merge in real time.

[![CI](https://github.com/RemiPelloux/gitverse/actions/workflows/ci.yml/badge.svg)](https://github.com/RemiPelloux/gitverse/actions/workflows/ci.yml) [![Deploy](https://github.com/RemiPelloux/gitverse/actions/workflows/pages.yml/badge.svg)](https://github.com/RemiPelloux/gitverse/actions/workflows/pages.yml)

**Live:** https://remipelloux.github.io/gitverse/

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine + curriculum tests (Vitest)
npm run e2e        # Playwright: desktop + phone journeys (builds required: npm run build)
```

## Deploying

- `.github/workflows/ci.yml` runs on every push and pull request: typecheck, lint, unit tests, production build and the Playwright browser tests (desktop + phone).
- Every push to `master` runs `.github/workflows/pages.yml`: unit tests, then a static build (`STATIC_EXPORT=1 BASE_PATH=/<repo>`) deployed to GitHub Pages. Gitverse runs entirely in the browser, so the static site is the whole app. To try the static build locally:

```bash
STATIC_EXPORT=1 BASE_PATH=/gitverse npx next build   # writes out/
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
  i18n/              useT() hook, typed message dictionaries (messages/en*.ts, fr*.ts), French engine explanations
```

## Languages

The interface, lessons, command reference and the terminal's plain-language explanations are available in English and French (language switcher in the header, also asked in the welcome tour; first guess comes from the browser). Git's own output stays in English, like real Git.

- UI strings: `src/i18n/messages/en.ts` (source of truth, typed keys) and `fr.ts`; workspace strings in `en-lab.ts` / `fr-lab.ts`.
- Lessons: `src/features/curriculum/fr.ts`, applied step by step by `localize.ts`; `__tests__/localize.test.ts` fails if a lesson changes without its translation.
- Command docs: `src/features/docs/commands.fr.ts`. Simulator explanations: `src/i18n/engine-fr.ts`.

To add a language, add a `Locale` in `src/i18n/locale.ts`, a dictionary typed `Messages`, and the curriculum/docs overlays.

Every view (graph, terminal output, files, stages, lesson objectives) is derived from one canonical `World`. Commands are pure `(World, input) → { world, lines, events }`; `events` drive animations only.

## What's built

- Routes: landing (with a playable hero demo), `/welcome` first-run tour (language, name & avatar, experience, daily goal — your commits are signed with your name), `/learn` dashboard with a winding learning path, 13 playable lessons across chapters 1, 2, 3, 4, 6, 7 (including 2 boss challenges); chapter 7 (GitHub) is complete: push, clone & contribute with a feature branch, fetch/pull with a teammate, `/playground` (5 starting repos, time travel, undo/redo, shareable `#s=` links, full-screen graph), `/commands` encyclopedia with live before/after demos, `/profile` (badges, theme, motion, terminal mode, streak toggle, shortcuts, reset).
- Gamification: XP and 12 levels with a level-up celebration, three stars per lesson (finish · no walkthrough hint · two mistakes or fewer) with a flawless bonus, a daily XP goal ring, three daily quests, optional streaks, 20 badges.
- The interface grows with the learner: lessons enable files → editor → remote panels progressively. The terminal has an Assisted mode (suggestion, word-by-word explanation, Run button, plain-language error explanations) and a Real mode.
- Responsive: three columns on desktop (resizable, remembered), two on tablet, tabbed Guide/Graph/Terminal/Files on phones.
- Accessibility: reduced motion (system/forced), keyboard-focusable commits, screen-reader graph summary and commit list, ARIA tabs and live regions.

## Not built yet (deliberate scope for this first slice)

- **Backend:** no PostgreSQL/Drizzle, no GitHub OAuth. Everyone is a guest; everything is saved in `localStorage`:
  - `gitverse-progress`: name, avatar, XP, lessons and stars, badges, quests, settings (language, daily goal…), and each unfinished lesson (repository, step, terminal transcript, command history). See `features/progress/store.ts`.
  - `gitverse-playground`: the Playground repository, chosen starter repo, terminal transcript and command history. See `features/lab/persistence.ts`.
- **Libraries swapped for lighter custom code:** the terminal is custom, not xterm.js, for assisted mode and phone support. The editor is a textarea-based editor with conflict tools, not Monaco.
- **Curriculum:** chapters 5 (Rebase), 8 (Pull Requests), 9–12 appear on the path as "coming soon". The engine already supports rebase, cherry-pick, stash and tags. Interactive rebase, bisect, worktrees and submodules return an honest "not available in the simulator yet" error.
- **Not started:** pull request simulator UI, AI tutor, command palette.
