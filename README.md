# ElectroDocker

Docker containers as desktop app icons, built with [Electrobun](https://electrobun.dev).

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine on Linux)
- macOS, Windows, or Linux

## Quick Start

```bash
bun install
bun start
```

## Quality Commands

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
```

## Build

```bash
bun run build
bun run build:mac
bun run build:win
bun run build:linux
```

## Features

- **Launcher** — grid of apps with search, status/group filters, drag-and-drop reorder, recommended catalog
- **Docker lifecycle** — launch, stop, logs, health badges, CPU/memory metrics
- **Compose import** — YAML → one app per service
- **Embedded Web UI** — sandboxed in-app window for `openUrl` (or open in system browser)
- **Secrets** — optional OS keychain for env vars; masking in the detail view
- **Updates** — GitHub Releases with stable/beta channels (↻ in toolbar)
- **Settings** — auto-restart on unhealthy, local error log export

## Registry & settings

App definitions: `apps.json` in OS-native config directories:

- macOS: `~/Library/Application Support/electrodocker/apps.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/electrodocker/apps.json`
- Windows: `%APPDATA%/electrodocker/apps.json`

Also in that folder: `settings.json`, `metrics.json`, `errors.jsonl`.

## Release channels

Use the **Channel** dropdown in the launcher footer (`stable` default, `beta` opt-in).

## Troubleshooting

- Docker warning banner: start Docker Desktop and reopen ElectroDocker.
- Launch fails: check image name and host port conflicts (`host:container`, e.g. `8080:80`).
- Web UI won’t load: ensure the container is **running** and `openUrl` matches your mapped port.
- No health/metrics: container must be running; Docker CLI must be reachable.
- Reset apps: delete `apps.json` from the paths above and relaunch.

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/PROJECT_BOARD.md](docs/PROJECT_BOARD.md) | Milestones |
| [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) | Scope |
| [docs/QA_MATRIX.md](docs/QA_MATRIX.md) | QA scenarios |
| [docs/QA_SIGNOFF.md](docs/QA_SIGNOFF.md) | Release sign-off checklist |
| [docs/RELEASE_OPERATIONS.md](docs/RELEASE_OPERATIONS.md) | Release process |
| [docs/CI.md](docs/CI.md) | CI & Windows E2E skip |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Performance notes |

## Structure

```
ElectroDocker/
├── electrobun.config.ts
├── src/
│   ├── main/           Main process: windows, IPC, Docker, updater
│   ├── renderer/
│   │   ├── launcher/   App grid + recommended catalog
│   │   └── app-window/ Per-app logs, metrics, Web UI controls
│   └── shared/         Types + validation
└── assets/icons/
```
