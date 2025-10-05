#!/usr/bin/env bash
# Export the IMGBASE_DB database to a timestamped SQL file.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/worker"

DATABASE_NAME="${1:-IMGBASE_DB}"
OUTPUT_DIR="${2:-$ROOT_DIR/backups}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
OUTPUT_FILE="$OUTPUT_DIR/d1-${DATABASE_NAME}-${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"

echo "Exporting $DATABASE_NAME to $OUTPUT_FILE"
wrangler d1 export "$DATABASE_NAME" --remote --file "$OUTPUT_FILE"

echo "Done."
