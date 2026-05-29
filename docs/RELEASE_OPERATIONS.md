# Release Operations

## Versioning

- Use [semantic versioning](https://semver.org/).
- Update `package.json`, `CHANGELOG.md`, and `CURRENT_VERSION` in `src/main/index.ts` per release.

## Release Checklist

### Automated gates

- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun test --timeout 30000 --ignore "src/e2e/**"`
- [ ] `bun test src/e2e/smoke.test.ts` (with Docker, locally or via CI)
- [ ] CI green on `main` (see [CI.md](./CI.md))

### Build & publish

- [ ] `./scripts/release.sh <version>` (or tag push triggers `.github/workflows/release.yml`)
- [ ] Verify GitHub Release artifacts: macOS zip, Windows exe, Linux AppImage, checksums
- [ ] Attach `RELEASE_NOTES.md` body; mark prior pre-releases if needed

### Manual QA

Complete [QA_SIGNOFF.md](./QA_SIGNOFF.md) on macOS (required) and spot-check Windows/Linux for:

- Launch / stop / logs / health / metrics
- Embedded Web UI + system browser
- Updater (↻) and channel dropdown
- Compose import, registry export/import
- Settings footer toggles and error export

### Performance (large catalogs)

Optional — record results in QA sign-off §7 or [PERFORMANCE.md](./PERFORMANCE.md):

- 200+ app grid render
- Search/filter responsiveness
- Virtual scroll scroll-through

## Rollback Plan

- Keep previous signed artifacts on the Releases page.
- If severe regression: revert tag, republish previous artifacts, document in `CHANGELOG.md`.

## Channels

- **stable** — default (`settings.json` → `releaseChannel`)
- **beta** — opt-in via launcher footer **Channel** dropdown
