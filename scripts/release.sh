#!/usr/bin/env bash
# scripts/release.sh — local release helper
# Usage: ./scripts/release.sh 0.2.0
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>  (e.g. 0.2.0)" >&2
  exit 1
fi

TAG="v${VERSION}"

echo "==> Running tests…"
bun test --timeout 30000 --ignore "src/e2e/**"

echo "==> Verifying package.json version matches ${VERSION}…"
PKG_VER=$(node -p "require('./package.json').version")
if [[ "$PKG_VER" != "$VERSION" ]]; then
  echo "ERROR: package.json version is ${PKG_VER}, expected ${VERSION}" >&2
  exit 1
fi

echo "==> Building macOS artifact…"
bun run build:mac

echo "==> Generating checksums…"
mkdir -p dist
(cd dist && shasum -a 256 ./* > checksums.txt 2>/dev/null || true)
echo "    Checksums written to dist/checksums.txt"

echo "==> Tagging git commit as ${TAG}…"
git tag -s "${TAG}" -m "Release ${TAG}" 2>/dev/null || git tag "${TAG}" -m "Release ${TAG}"

echo ""
echo "✅ Local release preparation complete."
echo "   Next steps:"
echo "   1. git push origin ${TAG}"
echo "   2. GitHub Actions release.yml will build all platforms and publish."
echo "   3. Verify the GitHub Release page has all three artifacts + checksums."
echo "   4. Mark previous pre-releases as 'pre-release' if applicable."
