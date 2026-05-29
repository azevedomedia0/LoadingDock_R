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

## Housekeeping

- [x] Remove unrelated root assets (`Camera Companion2.svg` removed)
- [x] Document Windows CI E2E skip (`docs/CI.md`)
- [x] Sync README, MVP scope, and project board with shipped features
