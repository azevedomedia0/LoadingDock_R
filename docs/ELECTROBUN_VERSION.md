# Electrobun Version Audit

**Date:** 2026-05-30  
**Audited by:** Claude Sonnet 4.6

---

## Current Status

| Channel | Version | Status |
|---------|---------|--------|
| **stable (installed)** | `1.18.1` | ✅ Pinned in `package.json` |
| **beta** | `1.18.4-beta.3` | ⏭ Not adopted — see below |

---

## What Changed in 1.18.x (Relevant to This Project)

### Breaking change in ≥ 1.18.1 — IPC transport layer

Electrobun 1.18.1 changed the webview ↔ bun message transport to use a
**typed RPC envelope format** (`{type:"message", id, payload}`) instead of
passing raw payloads through `bunBridge`. Two specific fixes were required and
are now in the codebase:

1. **Renderer → Main** (`ev.send` polyfill in `script.ts`)  
   Raw payload was sent via `bunBridge`; now wrapped in the RPC envelope.

2. **Main → Renderer** (`safeSend` in `index.ts`)  
   `webview.send(name, payload)` no longer exists on `BrowserView`; replaced  
   with `webview.rpc.send["ipc-message"](payload)` (the RPC proxy API).

3. **Main listener** (`createLauncher` / `openAppWindow` in `index.ts`)  
   `(webview as any).on("ipc-message", handler)` registers on the DOM event  
   emitter, which is never triggered by RPC messages. Fixed to use  
   `webview.rpc.addMessageListener("ipc-message", handler)`.

### Constructor signature change in ≥ 1.18.1

`new Electroview(config)` now requires a config argument. Fixed by passing
`{} as any` with the polyfill fallback.

---

## Why We Are Not Upgrading to 1.18.4-beta.3

- Beta channel is opt-in and not recommended for production distribution.
- No changelog entries for `1.18.2` → `1.18.4-beta.3` indicate any blocking
  bugs or security issues affecting this project.
- The current IPC workarounds were tested specifically against `1.18.1` stable.
- Re-test against beta before any version bump.

---

## Upgrade Checklist (when a new stable is released)

- [ ] Read the Electrobun release notes for any IPC, `BrowserView`, or
      `Tray` API changes.
- [ ] Run `bun install` and `bun run typecheck` — TypeScript will surface
      any API renames.
- [ ] Verify the `ev.on` / `ev.send` polyfills in `src/renderer/launcher/script.ts`
      and `src/renderer/app-window/script.ts` still work.
- [ ] Verify `safeSend` in `src/main/index.ts` (`rpc.send["ipc-message"]`).
- [ ] Run `bun test` — all 85+ tests must pass.
- [ ] Smoke-test: launch an app, check logs, verify update chip, toggle theme.
- [ ] Update pinned version in `package.json` and this document.

---

## Recommendation

**Stay on `1.18.1` stable** for the v1.2 release. Schedule a version-bump
review when `1.19.0` stable is published.
