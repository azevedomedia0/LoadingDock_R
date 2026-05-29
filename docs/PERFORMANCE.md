# Performance Notes

## Large app catalogs

- **Virtual scroll** activates when more than **80** installed apps match the current filter (`IntersectionObserver` sentinel in the launcher grid).
- **Search debounce** — 120 ms on the installed-apps search field to avoid re-rendering on every keystroke.
- **Filter functions** — `filterApps()` is pure and covered by a 2000-app benchmark in `filter.test.ts` (target &lt; 50 ms).

## QA thresholds

See `docs/QA_MATRIX.md` §7 for manual benchmarks:

| Scenario | Target |
|----------|--------|
| 200 apps time-to-interactive | &lt; 400 ms |
| 500 apps time-to-interactive | &lt; 600 ms |
| Search 500 apps | &lt; 100 ms |
| Hub cache hit (repeat query) | &lt; 50 ms |

## Hub search cache

Repeated Docker Hub queries are served from an in-memory `hubCache` in the launcher (no duplicate network calls for the same query string).
