# Cross-Platform QA Matrix

## Build Matrix

- macOS arm64: `bun run build:mac`
- Linux x64: `bun run build:linux`
- Windows x64: `bun run build:win`

## Smoke Scenarios

- Launch app and open launcher
- Add, edit, remove app
- Import compose services
- Start and stop container
- Verify health + metrics update
- Verify log filter + download

## Regression Gate

- lint
- format check
- typecheck
- tests
- platform build
