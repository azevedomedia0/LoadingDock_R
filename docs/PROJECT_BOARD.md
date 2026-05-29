# Project Board And Milestones

## MVP Milestone

- [x] Core launcher UI and status badges
- [x] Docker launch/stop bridge
- [x] Registry persistence
- [x] First-run onboarding and Docker guidance
- [x] App management (add/edit/remove/search/filter)
- [x] Compose import

## Beta Milestone

- [x] Better health checks and restart policies (auto-restart after unhealthy streak; settings toggle)
- [x] Resource usage telemetry (CPU/mem history, sparklines, persisted metrics)
- [x] Improved logs UX (search, level filter, export filtered logs)
- [x] Error analytics and crash reporting (local `errors.jsonl`, export, process handlers; opt-out toggle)
- [x] More integration tests (health-recovery, error-report, ipc-integration, log level tests)

## v1.0 Milestone

- [x] Embedded app webviews (sandboxed `BrowserWindow` for `openUrl`; launcher + detail actions)
- [x] Auto-update strategy and release channels (GitHub Releases, stable/beta footer dropdown)
- [x] Performance tuning for large app sets (virtual scroll, debounced search, filter toolbar, documented QA targets)
- [x] Full docs and release checklist (`README`, `RELEASE_OPERATIONS`, `QA_SIGNOFF`, `CI`, `PERFORMANCE`)

## v1.1 — UI & UX Overhaul (shipped)

- [x] Renamed app to **The Loading Dock(r)**
- [x] Cal Sans title font via Bunny Fonts
- [x] Custom app icon (whale + house) in topbar
- [x] Iconoir icon buttons in toolbar
- [x] Docker Hub button moved to toolbar with label
- [x] Section dropdowns with animated chevron arrows
- [x] Installed apps redesigned as vertical icon grid (launch/stop on icon click)
- [x] Recommended apps 2-column grid with live GET → installing animation
- [x] App icon images from Dashboard Icons CDN with gradient fallback
- [x] Colored status indicators (Running/Offline/Error)
- [x] Settings gear per card (replaces Edit·Del); Delete moved to edit modal
- [x] Restart button in status row (running apps only)
- [x] Scrollbar styled transparent
- [x] IPC layer fixed for Electrobun ≥1.18.1 RPC envelope format

## v1.2 — Settings & Recommended Apps (shipped)

- [x] Open at Login checkbox (macOS login item via osascript)
- [x] Auto check for updates toggle
- [x] Removed Local Error Log from footer
- [x] Added Navidrome, Homebridge, Puter, Guacamole to recommended apps
- [x] All recommended apps pinned to `:latest`
- [x] Tailscale moved to Self-hosted Essentials
- [x] Linked to GitHub — https://github.com/azevedomedia0/LoadingDock_R

## Up Next

- [ ] MIT licence added to repository
- [ ] App restart confirmation / undo toast
- [ ] Dark/light theme toggle
- [ ] One-click update flow with progress in topbar
- [ ] Search recommended apps by name/category
