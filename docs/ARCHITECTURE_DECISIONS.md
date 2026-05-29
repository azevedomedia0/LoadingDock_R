# Architecture Decisions

## IPC Contract

- Main process is source of truth for app state and persistence.
- Renderer sends user intents through typed IPC messages.
- Main broadcasts state updates and errors back to all windows.

## Registry Schema

- Registry stores serializable app config only.
- Runtime fields (`status`, `containerId`) are ephemeral and rebuilt in memory.
- Registry path uses OS-native config directories.

## Docker Lifecycle Model

- Launch: best-effort remove previous container, then `docker run --rm --name ...`.
- Stop: terminate tracked process, then `docker stop` and `docker rm` cleanup.
- Logs: stream stdout/stderr lines to renderer windows.

## Compose Import Model

- Compose YAML is parsed in main process.
- Each service with an `image` becomes one `DockerApp` entry.
- Imported apps are grouped by `composeProject` and tagged in description.
