# QA Sign-off Matrix — v1.0

**Target release date:** ___________  
**Build:** ___________  
**Tester(s):** ___________  
**Sign-off date:** ___________

Mark each scenario: ✅ Pass · ❌ Fail (link issue) · ⏭ Skipped (reason)

---

## 1. Update channel persistence

| # | Scenario | macOS | Win | Linux |
|---|----------|-------|-----|-------|
| 1.1 | Switch channel to "beta", quit and relaunch — dropdown shows "beta" | | | |
| 1.2 | Switch channel back to "stable", relaunch — dropdown shows "stable" | | | |
| 1.3 | Delete `settings.json`, relaunch — defaults to "stable" | | | |
| 1.4 | Corrupt `settings.json` contents, relaunch — falls back to defaults without crash | | | |

## 2. Updater — check / download / apply

| # | Scenario | macOS | Win | Linux |
|---|----------|-------|-----|-------|
| 2.1 | Click ↻ on latest version — "You are on the latest version." banner appears | | | |
| 2.2 | Simulate older local version (env override): ↻ shows "Update available: vX.Y.Z" banner | | | |
| 2.3 | Accept download — progress banner increments and reaches 100% | | | |
| 2.4 | Download completes — "Update ready. Restarting to apply…" shown, installer launched | | | |
| 2.5 | Network offline — ↻ shows error banner, does not crash | | | |

## 3. Renderer — modals

| # | Scenario | Expected |
|---|----------|----------|
| 3.1 | Click ＋ → Add modal opens; Cancel hides it without state leak | |
| 3.2 | Add valid app (name + image) → card appears in grid | |
| 3.3 | Add duplicate name → error banner, no new card | |
| 3.4 | Add invalid port (0:80) → error banner, modal stays open | |
| 3.5 | Edit app → fields pre-populated correctly | |
| 3.6 | Edit app rename to existing name → error banner | |
| 3.7 | Remove app → confirm dialog; confirm removes card | |
| 3.8 | Remove app → confirm dialog; cancel leaves card | |
| 3.9 | Compose import modal → valid YAML → apps appear in grid | |
| 3.10 | Compose import → invalid YAML → error banner | |
| 3.11 | Registry export → JSON file downloaded | |
| 3.12 | Registry import → apps replaced in grid | |

## 4. App Store (Docker Hub) flow

| # | Scenario | Expected |
|---|----------|----------|
| 4.1 | Open 🐳 → popular images load in hub grid | |
| 4.2 | Search "nginx" → results update, status text shows query | |
| 4.3 | Search Enter key → same as clicking Search | |
| 4.4 | "Popular" button → resets to popular images | |
| 4.5 | Details button → meta panel appears with name, stars, pulls | |
| 4.6 | Install button (in hub modal) → closes hub, opens Add modal pre-filled | |
| 4.7 | Install button (in store panel) → opens Add modal pre-filled, hub stays hidden | |
| 4.8 | Repeated same query → uses cached result (no extra network call) | |
| 4.9 | Hub modal Close → modal hidden, store panel unchanged | |

## 5. Search / filter

| # | Scenario | Expected |
|---|----------|----------|
| 5.1 | Type partial name → only matching cards shown | |
| 5.2 | Filter by "Running" status → only running apps shown | |
| 5.3 | Filter by group → only that group shown | |
| 5.4 | Combine search + status + group → intersection of all three | |
| 5.5 | Clear search → all cards return | |
| 5.6 | Filter with 0 matches → empty grid (no crash) | |
| 5.7 | Tag search ("fast") → matches on tag field | |

## 6. Launch / Stop / Log / Health / Metrics (Docker required)

| # | Scenario | macOS | Win | Linux |
|---|----------|-------|-----|-------|
| 6.1 | Launch app → status badge → Starting → Running | | | |
| 6.2 | Log lines stream in real time during launch | | | |
| 6.3 | Stop running app → status → Stopping → Stopped | | | |
| 6.4 | Stop stops container (verify with `docker ps`) | | | |
| 6.5 | Health badge updates within 10 s of container starting | | | |
| 6.6 | Metrics value updates within 10 s (CPU% / MEM MB) | | | |
| 6.7 | Sparkline chart updates with new data points | | | |
| 6.8 | Metrics range selector (1h / 24h / 7d) re-scopes chart | | | |
| 6.9 | Log filter hides non-matching lines | | | |
| 6.10 | Download log → .txt file contains expected lines | | | |
| 6.11 | Clear log → log output emptied | | | |
| 6.12 | Pull progress banner shown for image not yet local | | | |

## 7. Performance

| # | Scenario | Threshold | Result |
|---|----------|-----------|--------|
| 7.1 | Render grid with 200 apps — time to interactive | < 400 ms | |
| 7.2 | Render grid with 500 apps — time to interactive | < 600 ms | |
| 7.3 | Search across 500 apps — result appears | < 100 ms | |
| 7.4 | Scroll to bottom of 500-app virtual grid — smooth 60 fps | no jank | |
| 7.5 | Hub search result cache hit (same query twice) — second response | < 50 ms | |

## 8. Regression checks

| # | Area | Expected |
|---|------|----------|
| 8.1 | Tray icon opens launcher on click | |
| 8.2 | App detail window shows correct app after clicking card | |
| 8.3 | Secrets masking hides env values; toggle shows them | |
| 8.4 | Keychain toggle (🔑) stores secret; not written to `apps.json` | |
| 8.7 | Embedded Web UI opens sandboxed window when app is running | |
| 8.8 | System browser opens `openUrl` via external handler | |
| 8.9 | Release channel dropdown persists (stable ↔ beta) | |
| 8.10 | Installed search + status + group filters work together | |
| 8.5 | Notifications toggle persists across restarts | |
| 8.6 | First-run onboarding banner shown once, hidden after | |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Engineering | | | |
| Product | | | |

**RC1 disposition:** ☐ Ship as-is · ☐ Ship with noted exceptions · ☐ Block — requires RC2
