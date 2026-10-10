#!/usr/bin/env bash
# Runs @ddtds/vitest's test suite against every supported vitest major version.
# Restores the committed lockfile/node_modules state afterwards.
set -euo pipefail

versions=(4 5)

cleanup() {
  git checkout -- packages/vitest/package.json pnpm-lock.yaml
  pnpm install --frozen-lockfile
}
trap cleanup EXIT

for version in "${versions[@]}"; do
  echo "==> vitest@$version"
  pnpm add -D "vitest@$version" --filter @ddtds/vitest --lockfile=false
  pnpm --filter @ddtds/vitest test
done
