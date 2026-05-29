# Changelog

All notable changes to ElectroDocker are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added (v1.0)
- **Embedded Web UI** — sandboxed `BrowserWindow` for `openUrl`; **Open embedded** / **System browser** in app detail; **Web UI** on launcher cards when running.
- **Launcher filters** — search (debounced), status, and group dropdowns for installed apps.
- **Release channel UI** — stable/beta dropdown in settings footer (persisted).

### Added (beta)
- **Auto-restart on unhealthy** — after 3 consecutive unhealthy health-check polls (~15s), running apps with a healthcheck and restart policy restart automatically (toggle in launcher footer).
- **Log level filter** — app detail window filters logs by error / warn / info / system; download exports the filtered view.
- **Local error reporting** — errors append to `errors.jsonl` in the config directory; export via **Export errors** (opt-out toggle; no remote telemetry).
- **Beta settings bar** — launcher footer toggles for auto-restart and error logging.

### Tests
- `health-recovery.test.ts`, `error-report.test.ts`, `ipc-integration.test.ts`, and log-level coverage in `metrics.test.ts`.

## [0.2.0] — 2026-05-21

### Added (since RC1)
- **Platform keychain integration** (`src/main/keychain.ts`) — `keychainSet` /
  `keychainGet` / `keychainDelete` backed by `security`(macOS), DPAPI/PowerShell
  (Windows), and `secret-tool`/libsecret (Linux). Secrets are resolved at launch
  time and never written to `apps.json`.
- **`keychainEnvKeys`** field on `DockerApp` tracks which env keys are
  keychain-backed; preserved through registry save/load cycle.
- **`sortOrder`** field on `DockerApp` preserves drag-and-drop position.
- **Drag-and-drop reorder** — installed-app cards are draggable; dropping
  broadcasts `app:reorder` and persists new order via `sortOrder`.
- **`app:reorder` IPC message** — main process sorts the apps array and saves registry.
- **Env-var editor** in Add / Edit modals — dynamic key/value table with per-row
  keychain toggle (🔑); serialises to `DockerApp.env` and `keychainEnvKeys`.
- **Volume editor** in Add / Edit modals — dynamic host:container path table;
  replaces the previous `[]` default.
- **Update notification banner** — dedicated UI element with version title, release-
  notes excerpt, animated progress bar, and Install / Later buttons.
- **Auto-check on startup** — checks GitHub Releases once per 24 h (cooldown
  stored in `settings.json` as `lastUpdateCheckAt`); small 3 s delay after
  window opens so the launcher is ready to receive the message.
- **Native OS notifications** — unexpected container errors/stops trigger
  `osascript` (macOS), `notify-send` (Linux), or PowerShell toast (Windows).
  User-initiated stops (status `"stopping"`) are excluded.
- **Hub search cache** — `hubCache` Map deduplicated repeated queries in the
  launcher; Popular / Search / hub modal all read from cache first.
- **`src/renderer/app-window/renderer.ts`** — `statusBadgeSpec`, `buildEnvEntries`,
  `buildPortsListItems`, `formatHealthLabel` extracted as pure functions.
- **`src/renderer/app-window/renderer.test.ts`** — 30 tests covering badge spec,
  env masking/locking, log buffering, metrics history, and IPC state transitions.
- **`src/main/keychain.ts` tests** covered via settings + updater test suite.
- **`.github/workflows/ci.yml`** — lint → unit (3 platforms) → E2E Linux/macOS →
  Windows skip-verification → build (3 platforms) matrix.
- **`.github/workflows/release.yml`** — tag-triggered build, checksum generation,
  and GitHub Release artifact upload.
- **`scripts/release.sh`** — local release helper: runs tests, checks version,
  builds macOS, generates checksums, tags commit.
- **`RELEASE_NOTES.md`** — human-readable notes used by the release workflow as
  GitHub Release body.

### Changed (since RC1)
- `CURRENT_VERSION` in `index.ts` bumped to `0.2.0`.
- `launchApp` signature accepts optional `resolvedEnv` map; when keychain mode is
  enabled the main process resolves secrets before spawning the container.
- `broadcast` now sends a real native notification on unexpected `error` / `stopped`
  transitions instead of only broadcasting an in-app error banner.
- `secrets:keychain` IPC handler now triggers actual `saveSettings` and removes the
  "scaffold" marker from the error banner.
- Launcher `renderHubResults` / `renderStoreTopImages` use safe DOM methods
  (no `innerHTML` clearing).
- Hub modal, Popular button, and Search button all hit the cache before sending IPC.

## [0.2.0-rc.1] — 2026-05-21 — Release Candidate 1

### Added
- **Update channel persistence** — `releaseChannel`, `notificationsEnabled`,
  `secretsMaskingEnabled`, and `keychainSecretsEnabled` are now saved to
  `settings.json` alongside the app registry and survive restarts.
- **Real updater integration** — `src/main/updater.ts` checks the GitHub
  Releases API for the current channel, downloads the platform-specific
  artifact with progress reporting, and applies the update by launching the
  installer and exiting.
- **Updater IPC messages** — `update:check`, `update:available`,
  `update:not-available`, `update:download`, `update:download:progress`,
  `update:download:done`, `update:apply`, and `update:state` added to the
  shared IPC type union.
- **"Check for updates" button** (↻) in the launcher toolbar wired to the
  new `update:check` IPC message.
- **Virtual scroll for large catalogs** — installed-app grid switches to an
  IntersectionObserver-based batch renderer when more than 80 apps are
  present, keeping first-paint fast regardless of catalog size.
- **Hub search cache** — Docker Hub results are cached in-memory by query
  string to avoid redundant network round-trips during a session.
- **Extracted pure-logic modules** — `src/renderer/launcher/filter.ts` and
  `src/renderer/app-window/metrics.ts` centralise all renderer logic that
  can be unit tested without a browser runtime.
- **Automated tests** — 85 passing tests across 9 files:
  - `src/main/settings.test.ts` — path derivation, save/load, corrupt-file fallback
  - `src/main/updater.test.ts` — semantic-version comparison
  - `src/renderer/launcher/filter.test.ts` — filterApps (search, status,
    group, tags, combos, 2000-app perf), collectGroups, buildCardHTML,
    buildHubCardHTML
  - `src/renderer/app-window/metrics.test.ts` — maskValue, filterLogLines,
    rangeMs, scopeMetrics, buildSparkline, latestMetricsLabel
  - `src/e2e/smoke.test.ts` — launch/stop/log/health/metrics against the
    real Docker CLI; skips automatically when Docker is unavailable
- **`virtual-sentinel` CSS** added to the launcher stylesheet for the
  IntersectionObserver anchor element.

### Changed
- `src/renderer/launcher/script.ts` now delegates filtering, card HTML
  generation, and hub card HTML generation to `filter.ts`.
- `src/renderer/app-window/script.ts` now delegates log filtering, metrics
  scoping, sparkline generation, and value masking to `metrics.ts`.
- `refreshGroupFilterOptions` refactored to use safe DOM methods (no more
  `innerHTML`).
- `update:channel:set` handler now persists the change to `settings.json`.
- `secrets:mask`, `secrets:keychain`, and `notifications:enabled` handlers
  now persist their changes to `settings.json`.
- `openLauncher` now sends `update:state` on DOM-ready so the channel
  dropdown reflects the persisted value.

### Fixed
- Group filter dropdown retained stale option list when all apps in a group
  were removed.

---

## [0.1.0] — 2026-05-01 — Initial Release

### Added
- Launcher window with app grid, search, status filter, and group filter.
- App detail window with live logs, pull progress, health badge, and metrics sparkline.
- Docker CLI integration: launch, stop, pull, health inspect, stats.
- App registry persisted to platform-appropriate config directory.
- Metrics history persisted across restarts (7-day window, 5 000-point cap per app).
- Docker Compose import (docker-compose.yml → multiple apps).
- Docker Hub browse and search with one-click install flow.
- Preset configurations for postgres, redis, and minio.
- Secrets masking in the environment-variable list.
- Registry JSON export and import.
- System tray icon with Open/Quit menu.
- macOS Application menu.
- Release channel selector (stable / beta) in the toolbar.
