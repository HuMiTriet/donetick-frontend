# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Donetick's web and mobile client: a React 18 + Vite single-page app that is also packaged as Android/iOS apps with Capacitor 8 (`android/`, `ios/`, `capacitor.config.ts`). The backend is a separate Go repository (donetick core). This repo only talks to it over HTTP at `/api/v1/...`.

The design principle of this code is KISS: Keep It Simple Stupid. If there is a simpler design for something while still achieving the same result do that instead. 
In addition, strive to make the code as self documenting as much as possible. Do not add new comments to the code unless it is for warning against serious consequences.

Any new code that you write in this repo will be in typescript, unless the file is already in javascript. Same goes for react components, every new one is in typescript react instead of javascript.

## Commands

- `npm run dev`: Vite dev server on :5173. The API base URL comes from `VITE_APP_API_URL` (`.env.development` points to `http://localhost:2021`). `npm start` does the same with `--host`.
- `npm run build`: production build. `npm run build-selfhosted` builds with `--mode selfhosted` (`.env.selfhosted`, empty API URL meaning same origin), but it also deletes and reinstalls `package-lock.json`.
- `npm run lint`: ESLint, `prettier -c .` and the i18n audit. CI (`.github/workflows/build.yml`) runs `npm run build` and then `npm run lint:ci`. Fix with `npm run lint:fix`. The pre-commit hook runs lint-staged (`eslint --fix` plus `prettier --write`).
- Type check (no npm script): `npx tsc --noEmit`. The codebase is mixed JS/TS (`allowJs`, strict).
- Unit tests use Node's built-in runner: `node --test tests/*.test.mjs`. Run one file with `node --test tests/vite-config.test.mjs`, or one test with `--test-name-pattern "<name>"`.
- E2E tests use Playwright from a separate package in `e2e/`. Run `npm install` there first.
  - `e2e/run-e2e.sh [playwright args]` starts an isolated Go backend (sqlite, :2022) and Vite (:5180), runs the suite, then tears both down.
  - It expects the backend checkout at `$HOME/workspace/donetick-core`. If yours is elsewhere, edit `BACKEND_DIR` in the script.
  - Run one spec with `./run-e2e.sh tests/chores.spec.js` or `./run-e2e.sh -g "<test name>"`.
  - Against servers that are already running: `E2E_FRONTEND_URL=… E2E_API_URL=… npx playwright test`.
  - Tests run sequentially (`workers: 1`) because they share one SQLite database.
- Mobile: `npm run android` / `npm run ios` builds and runs `cap sync`. `npm run android:dev` runs Android with live reload.
- i18n: `npm run lint:i18n` fails when a `t()` key used in `src/` is missing from `public/locales/en/`. Add `--orphans` (`node scripts/i18n/i18n-audit.mjs --orphans`) to list keys nothing uses.

## Architecture

**Boot.** `src/main.jsx` lazy-loads either `MarketingApp.jsx` (landing site) or `Application.jsx`. `Application.jsx` wraps `App.jsx` in `contexts/Contexts.jsx`. `App.jsx` adds the Auth, SSE, global search, keyboard-shortcut and paywall providers. Routes are a single list in `src/contexts/RouterContext.jsx`.

**API layer.** Every request goes through `src/utils/Fetcher.jsx`, which is a set of named endpoint functions over `src/utils/ApiClient.js` (base URL, auth headers). Screens don't call `fetch` directly.

**Server state.** TanStack Query hooks live in `src/queries/*`. The main task list is `useChores()` with the cache key `['chores', false]`, and many screens patch that cache directly for optimistic updates. Save a whole task with `SaveChore(chore)` (`PUT /chores/`) or `useUpdateChore()`. The usual pattern is `SaveChore({ ...chore, field })`. Smaller endpoints exist for single fields: due date, priority, assignee.

**Offline-first writes.** When the offline feature is on (`utils/OfflineFeatureToggle.js`) and a write fails with a network error, the write is queued instead.

- It goes into `utils/CommandQueue.js` as a `CommandType`, and the entity is stored in `utils/OfflineDB.js` (Capacitor SQLite on native).
- `utils/SyncEngine.js` replays the queue in order. It maps temporary ids from offline-created tasks to real ids, and `CommandQueue.compact()` merges commands.
- Optimistic entities carry `_pendingCreate` / `_pendingUpdate`.
- A new kind of offline write needs three things: a `CommandType`, a `SyncEngine._executeCommand` case and, where relevant, a compaction merge.

**Real-time.** The backend pushes task changes over SSE (`contexts/SSEContext.jsx`). `hooks/useSSE.js` writes those events into the query cache.

**Task domain details that span files:**

- `nextDueDate` is the current occurrence. Repeating tasks advance it on complete or skip.
- Reminders are `notificationMetadata.templates: [{ value, unit: 'm'|'h'|'d' }]`, offsets from the due date: negative is before, 0 is on due, positive is after. `notification: true` turns them on.
  - The backend rebuilds its notification rows when a task is saved in full.
  - The native apps also schedule the same reminders as local notifications (`views/Chores/LocalNotificationScheduler.js`).
- Smart, due-date and priority grouping for task lists all come from `ChoresGrouper` in `utils/Chores.jsx`.
- Plans: `utils/entitlements.js` defines the free-plan limits. Free accounts get only the on-due reminder. `sanitizeRemindersForPlan` is applied on every save path.
  - `contexts/PaywallContext.jsx` exposes `usePaywall()`, which returns `{ isPlus, showPaywall(PAYWALL_REASON.X) }`.
  - Plus means `userProfile.expiration` is in the future. A self-hosted backend reports every user as Plus.

**UI.** Mostly MUI Joy (`@mui/joy` 5.0.0-beta), plus a few `@mui/material` imports (for example `useMediaQuery`), Tailwind and CSS modules. Theme and dark mode come from `--joy-palette-*` CSS variables, so custom CSS should use those rather than fixed colors. Dates, times, week start and RTL come from `useLocalization()` (`contexts/LocalizationContext.jsx`).

**i18n.** Strings live in namespaced JSON files in `public/locales/en/*.json`. The namespace comes from `useTranslation('<ns>')`, and the default is `common`. Only edit English. Other languages are synced from Crowdin (`crowdin.yml`). The audit resolves keys per file, so a new key must exist in the namespace that file's `useTranslation` uses.

**Types and lint.** API model types are in `src/types/models.ts`. TS files are linted with strict typescript-eslint, including no-unsafe rules and no `any`. Importing a JS hook into a `.ts` file therefore often needs an explicit cast, for example `useNotification() as {...}`. ESLint also enforces `simple-import-sort`, alphabetical `sort-destructure-keys` and `eqeqeq`. Prettier owns the style (no semicolons, single quotes, including in JSX).
