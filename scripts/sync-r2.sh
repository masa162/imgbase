#!/usr/bin/env bash
# Sync the imgbase R2 bucket to a local directory using AWS CLI (S3-compatible).
set -euo pipefail

: "${IMGBASE_ACCOUNT_ID:?Set IMGBASE_ACCOUNT_ID to your Cloudflare account ID}"
: "${IMGBASE_R2_BUCKET:?Set IMGBASE_R2_BUCKET to the source bucket name}"
: "${IMGBASE_R2_ACCESS_KEY_ID:?Set IMGBASE_R2_ACCESS_KEY_ID for AWS CLI auth}"
: "${IMGBASE_R2_SECRET_ACCESS_KEY:?Set IMGBASE_R2_SECRET_ACCESS_KEY for AWS CLI auth}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${1:-$ROOT_DIR/r2-sync}"

mkdir -p "$TARGET_DIR"

echo "Syncing s3://$IMGBASE_R2_BUCKET -> $TARGET_DIR"
AWS_ACCESS_KEY_ID="$IMGBASE_R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$IMGBASE_R2_SECRET_ACCESS_KEY" \
aws s3 sync "s3://$IMGBASE_R2_BUCKET" "$TARGET_DIR" \
  --endpoint-url "https://$IMGBASE_ACCOUNT_ID.r2.cloudflarestorage.com" \
  --delete

echo "Completed R2 sync."
