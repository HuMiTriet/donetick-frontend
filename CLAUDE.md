# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Donetick frontend: a React 18 + Vite app (JS/JSX only, no TypeScript in `src`) that ships as a web app/PWA, a self-hosted bundle, and iOS/Android apps via Capacitor. The Go backend is a separate repo (`donetick/donetick`); its setup is documented at https://github.com/donetick/donetick#development-environment. PRs target `develop`.

## Commands

```sh
npm run dev                    # Vite dev server (API URL from .env.development)
npm run build                  # production build (cloud); `vite build --mode selfhosted` for self-hosted
npm run lint                   # eslint + prettier --check + i18n audit (CI runs build + lint:ci)
npm run lint:fix               # eslint --fix + prettier --write
npm run lint:i18n              # every t()/i18nKey must exist in public/locales/en
npm run setup-apple-silicon    # installs the darwin-arm64 rollup/swc native binaries if vite fails to start
```

Unit tests are `node:test` files in `tests/` with no npm script. Pass a file path, not the directory:

```sh
node --test tests/vite-config.test.mjs
```

E2E tests use Playwright in `e2e/` (separate package.json; run `npm install` there first):

```sh
cd e2e && npm test                          # against already-running dev servers (frontend :5173, backend :2021)
cd e2e && npx playwright test tests/chores.spec.js -g "name"   # single file / test
cd e2e && ./run-e2e.sh                      # boots an isolated backend (:2022, from ~/workspace/donetick-core) + frontend (:5180)
```

Native: `npm run android` / `npm run ios` (build + `cap sync`), `npm run android:dev` for live reload. Signed release builds and store uploads: see `AUTOMATED_RELEASE.md` (`scripts/release.sh`).

## Code style

Prettier: no semicolons, single quotes (also in JSX), `arrowParens: 'avoid'`, trailing commas, width 80. ESLint _errors_ on unsorted imports (`simple-import-sort`) and unsorted destructured keys (`sort-destructure-keys`). A Husky pre-commit hook runs lint-staged. `@` is aliased to `src/`.

UI is MUI Joy (`@mui/joy`, styled with `sx`) first; Tailwind is secondary, with `preflight: false` and class-based dark mode toggled on `#root`.

## Architecture

### Entry and providers

`src/main.jsx` lazy-loads `MarketingApp.jsx` (donetick.com or `?site=marketing`) or `Application.jsx` (the app). `src/contexts/Contexts.jsx` nests the outer providers. `RouterContext` is innermost and ignores its children: `<App/>` is the router's root route element, so providers above it cannot use router hooks. Auth, SSE, paywall, and impersonation providers are mounted inside `App.jsx`. All routes are defined in `src/contexts/RouterContext.jsx`.

### HTTP layer

- `src/utils/Fetcher.jsx` exports one function per endpoint, all going through the `apiClient` singleton (`src/utils/ApiClient.js`).
- **Fetcher calls resolve with the raw `Response` even on 4xx/5xx**; only network failures and the 10s timeout throw. Always check `response.ok` and call `.json()` yourself.
  - A TanStack `mutationFn` that returns a Fetcher call directly will report HTTP errors as success and hand `onSuccess` a `Response`, not data. Parse and throw, as in `parseTimerResponse` in `src/queries/TimeQueries.jsx`.
- `ApiClient` handles 401s by refreshing the token once and replaying queued requests. When the refresh fails it logs out and resolves `null`.
- API base URL:
  - `VITE_APP_API_URL` (`src/Config.js`; `'AUTO'` means `<host>/api`).
  - On native it can be overridden at runtime by the `customServerUrl` Capacitor Preference.
- Cloud vs self-hosted is checked two ways:
  - `VITE_IS_SELF_HOSTED` at build time.
  - `isOfficialDonetickInstance()` at runtime, in `src/utils/FeatureToggle.js`.

### Server state (TanStack Query v5)

- Hooks live in `src/queries/*Queries.jsx`. The client is in `src/contexts/QueryContext.jsx`: staleTime 5m, no refetch on window focus, retry 1.
- Main keys:
  - `['chores', includeArchived]`, so invalidate `['chores']` by prefix and update with `setQueriesData`. `setQueryData(['chores'])` misses both variants.
  - `['choreDetails', id]` feeds the chore page.
  - `['choreTimer', id]` and `['choreHistory', id]`.
- Pages read ids from `useParams()` as strings, while list data has numeric ids. Query keys must use the type the consumer used, or invalidation silently misses.
- Chore list actions (complete/skip/start/pause/archive, bulk actions, undo) live in `src/views/Chores/hooks/useChoreActions.js`. It's a dependency-injected hook used by `MyChores` and `HomeView` that mostly calls Fetcher directly. Its logic overlaps with `src/queries/ChoreQueries.jsx` and the chore page (`src/views/ChoreEdit/ChoreView.jsx`), so a behavior change usually has to be mirrored in each.
- Toasts come from `useNotification()` (`src/service/NotificationProvider.jsx`): `showSuccess/showError/...` with an optional `undoAction`.

### Offline mode

- On by default (`localStorage.offline_feature_enabled`, `src/utils/OfflineFeatureToggle.js`).
- Storage (`src/utils/OfflineDB.js`): SQLite on native, IndexedDB on web.
- Mutations follow one pattern: try the request; when `isNetworkError(err)`, `commandQueue.enqueue(CommandType.X, entityId, payload)` (`src/utils/CommandQueue.js`). Then apply the change optimistically, invalidate `['pendingCommands']`, and offer an undo that calls `commandQueue.cancel(cmdId)`.
- `src/utils/SyncEngine.js` replays the queue and then delta-syncs from `/sync/changes?since=cursor`:
  - Conflicts are decided server-side and come back as 409.
  - Temp ids (`temp_*`) are remapped after creates.
- `useSyncOnReconnect` (mounted in `App.jsx`) drives sync on reconnect, resume and intervals, then invalidates all queries.
- `useChores` reads from `offlineDB` once synced.
- `networkManager.isOnline` requires both device connectivity and a successful sync.

### Real-time

`src/hooks/useSSE.js` listens to `/realtime/sse` and patches React Query caches directly (`chore.*`, `subtask.*`, `project.updated`). Native uses a one-time ticket because `EventSource` can't send headers.

### i18n

- i18next loads `public/locales/{lng}/{ns}.json` over HTTP. There are 12 namespaces and the default is `common`.
- **Only edit `public/locales/en/*.json` by hand.** Crowdin manages the other locales.
- `npm run lint:i18n` resolves each file's namespace from its first `useTranslation('ns')`; an `ns:key` prefix overrides it.
- The CI workflow `i18n-safety.yml` (`scripts/i18n/i18n-pr-safety.mjs`) rejects PRs that drop keys, plural forms, `{{placeholders}}` or HTML tags in non-English locales.

### Analytics

- Call `track('event_name', props)` from `src/analytics`.
- Every event and property must be declared in `EVENT_SCHEMAS` (`src/analytics/eventSchemas.js`). Undeclared events and properties are silently dropped; this is the PII guard.
- Consent defaults to opt-out on cloud and opt-in on self-hosted.

### Native (Capacitor)

- `src/CapacitorListener.js` handles deep links (OAuth, NFC), push, notification actions and the Android back button.
- Home-screen widgets get a snapshot of the query cache through a custom `WidgetBridge` plugin (`src/service/WidgetService.js`).
- `patches/` is applied by patch-package on `postinstall` and patches `@capacitor-community/speech-recognition`.
- Free-tier limits are in `src/utils/entitlements.js`. The paywall uses RevenueCat on native and Stripe on web.
