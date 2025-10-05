#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/worker"

required_vars=(
  IMGBASE_BASIC_AUTH_USER
  IMGBASE_BASIC_AUTH_PASS
  IMGBASE_R2_ACCESS_KEY_ID
  IMGBASE_R2_SECRET_ACCESS_KEY
)

missing=()
for var in "${required_vars[@]}"; do
  if [[ -z "${!var-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing environment variables: %s\n' "${missing[*]}" >&2
  printf 'Export the values before running this script.\n' >&2
  exit 1
fi

echo -n "$IMGBASE_BASIC_AUTH_USER" | wrangler secret put BASIC_AUTH_USERNAME --quiet

echo -n "$IMGBASE_BASIC_AUTH_PASS" | wrangler secret put BASIC_AUTH_PASSWORD --quiet

echo -n "$IMGBASE_R2_ACCESS_KEY_ID" | wrangler secret put R2_ACCESS_KEY_ID --quiet

echo -n "$IMGBASE_R2_SECRET_ACCESS_KEY" | wrangler secret put R2_SECRET_ACCESS_KEY --quiet

echo "All secrets uploaded to Cloudflare Worker."
