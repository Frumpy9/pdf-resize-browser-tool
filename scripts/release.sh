#!/usr/bin/env bash
set -euo pipefail

# Build a self-contained offline zip from dist/
# Usage: ./scripts/release.sh [outZip]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT_ZIP="${1:-pdf-resize-browser-tool-dist.zip}"

rm -rf dist node_modules
npm ci
npm run build

rm -f "$OUT_ZIP"
( cd dist && zip -r "../$OUT_ZIP" . )

echo "Wrote: $ROOT/$OUT_ZIP"
