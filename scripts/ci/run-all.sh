#!/usr/bin/env bash
set -euo pipefail

echo "=== Typecheck ==="
bun run typecheck

echo "=== Test ==="
bun test

echo "=== Lint ==="
bun run lint

echo "=== Format check ==="
bun run format -- --check

echo "=== All checks passed ==="
