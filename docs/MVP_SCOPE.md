# MVP Scope And Success Criteria

## Goal

ElectroDocker should make common local Docker services feel like desktop apps that can be launched, stopped, and monitored without terminal commands.

## In Scope (MVP)

- App launcher grid with service cards and runtime status
- Add/edit/remove app definitions
- Launch/stop containers and stream logs
- Persist app registry across restarts
- Docker availability detection and onboarding guidance
- Docker Compose import (one app entry per service)

## Shipped Beyond MVP (v1.0 / Beta)

- Embedded Web UI windows (sandboxed) and system-browser fallback
- Search, status, and group filters on the installed grid
- Resource metrics, health checks, auto-restart on unhealthy
- Auto-updates (stable/beta), keychain secrets, recommended app catalog
- Local error log export

## Out Of Scope

- Remote Docker hosts
- Kubernetes support
- Cluster orchestration
- Team sync / cloud registry
- Remote crash telemetry (local `errors.jsonl` only)

## Success Criteria

- New users can launch at least one service in under 5 minutes
- Add/edit/remove actions are discoverable and validated
- Compose import works for typical development compose files
- Core quality gates pass: lint, format, typecheck, tests, build

## Target Platforms

- macOS (primary)
- Linux and Windows (supported)
