#!/usr/bin/env bash
# Setup CORS policy for R2 bucket to allow uploads from admin UI
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/worker"

# R2 CORS configuration
CORS_CONFIG='{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://admin.be2nd.com",
        "https://*.pages.dev"
      ],
      "AllowedMethods": [
        "PUT",
        "GET",
        "HEAD",
        "OPTIONS"
      ],
      "AllowedHeaders": [
        "content-type",
        "x-amz-meta-original-filename",
        "x-amz-date",
        "authorization"
      ],
      "ExposeHeaders": [
        "etag"
      ],
      "MaxAgeSeconds": 86400
    }
  ]
}'

echo "Setting CORS policy for R2 bucket 'imgbase'"
echo "$CORS_CONFIG" | wrangler r2 bucket cors put imgbase

echo "CORS policy applied successfully"
echo "Verifying CORS configuration:"
wrangler r2 bucket cors get imgbase