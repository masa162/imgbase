#!/bin/bash
# imgbase ストレージ分析スクリプト
# R2とD1の状態を分析し、統計情報を表示

set -e

# カラー出力
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "imgbase Storage Analysis"
echo "========================================"
echo ""

# 1. D1データベース統計
echo -e "${CYAN}[1/4] D1 Database Statistics${NC}"
echo ""

# 合計画像数
TOTAL_IMAGES=$(npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT COUNT(*) as count FROM images" --json | \
  jq -r '.[0].results[0].count')

echo "Total images: $TOTAL_IMAGES"

# ステータス別
STORED_COUNT=$(npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT COUNT(*) as count FROM images WHERE status = 'stored'" --json | \
  jq -r '.[0].results[0].count')

PENDING_COUNT=$(npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT COUNT(*) as count FROM images WHERE status = 'pending'" --json | \
  jq -r '.[0].results[0].count')

echo "  - Stored: $STORED_COUNT"
echo "  - Pending: $PENDING_COUNT"

# 合計ストレージサイズ
TOTAL_BYTES=$(npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT SUM(bytes) as total FROM images WHERE status = 'stored'" --json | \
  jq -r '.[0].results[0].total')

# バイトを人間が読める形式に変換
TOTAL_MB=$(echo "scale=2; $TOTAL_BYTES / 1024 / 1024" | bc)
TOTAL_GB=$(echo "scale=2; $TOTAL_BYTES / 1024 / 1024 / 1024" | bc)

echo ""
echo "Total storage (stored images):"
echo "  - Bytes: $TOTAL_BYTES"
echo "  - MB: $TOTAL_MB"
echo "  - GB: $TOTAL_GB"

echo ""

# 2. MIME タイプ別統計
echo -e "${CYAN}[2/4] MIME Type Distribution${NC}"
echo ""

npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT mime, COUNT(*) as count, SUM(bytes) as total_bytes FROM images WHERE status = 'stored' GROUP BY mime ORDER BY count DESC" \
  --json | \
  jq -r '.[0].results[] | "\(.mime): \(.count) images (\(.total_bytes / 1024 / 1024 | floor) MB)"'

echo ""

# 3. 日別アップロード統計（過去30日）
echo -e "${CYAN}[3/4] Daily Upload Statistics (Last 30 days)${NC}"
echo ""

npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT DATE(created_at) as date, COUNT(*) as count FROM images WHERE created_at >= datetime('now', '-30 days') GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 10" \
  --json | \
  jq -r '.[0].results[] | "\(.date): \(.count) images"'

echo ""

# 4. R2オブジェクト統計
echo -e "${CYAN}[4/4] R2 Object Statistics${NC}"
echo ""

# R2オブジェクト数（時間がかかる場合あり）
echo "Fetching R2 object list (this may take a while)..."

R2_OBJECTS=$(npx wrangler r2 object list imgbase --remote --json)
R2_COUNT=$(echo "$R2_OBJECTS" | jq '.objects | length')

echo "Total R2 objects: $R2_COUNT"

# プレフィックス別（imageIdディレクトリ数）
IMAGE_DIRS=$(echo "$R2_OBJECTS" | jq -r '.objects[].key' | cut -d'/' -f1 | sort -u | wc -l)
echo "Unique image directories: $IMAGE_DIRS"

# オリジナルファイル数
ORIGINAL_COUNT=$(echo "$R2_OBJECTS" | jq -r '.objects[].key' | grep '/original/' | wc -l)
echo "Original files: $ORIGINAL_COUNT"

# バリアント数
VARIANT_COUNT=$((R2_COUNT - ORIGINAL_COUNT))
echo "Variant files: $VARIANT_COUNT"

echo ""

# 5. 整合性チェック
echo "========================================"
echo "Consistency Check"
echo "========================================"
echo ""

if [ "$STORED_COUNT" -eq "$ORIGINAL_COUNT" ]; then
  echo -e "${GREEN}✓ D1 stored images == R2 original files ($STORED_COUNT)${NC}"
else
  echo -e "${YELLOW}⚠ Mismatch detected:${NC}"
  echo "  - D1 stored images: $STORED_COUNT"
  echo "  - R2 original files: $ORIGINAL_COUNT"
  echo ""
  if [ "$STORED_COUNT" -gt "$ORIGINAL_COUNT" ]; then
    echo "  → Some D1 records are missing R2 files"
  else
    echo "  → Some R2 files are not in D1 (orphaned files)"
  fi
fi

echo ""

# バリアント比率
if [ "$ORIGINAL_COUNT" -gt 0 ]; then
  VARIANTS_PER_IMAGE=$(echo "scale=2; $VARIANT_COUNT / $ORIGINAL_COUNT" | bc)
  echo "Variants per image (average): $VARIANTS_PER_IMAGE"
fi

echo ""

# 6. ストレージコスト試算
echo "========================================"
echo "Cost Estimation (Cloudflare R2)"
echo "========================================"
echo ""

# R2料金: $0.015/GB/月
MONTHLY_COST=$(echo "scale=4; $TOTAL_GB * 0.015" | bc)

echo "Storage cost (stored images only):"
echo "  - Storage: $TOTAL_GB GB"
echo "  - Monthly: \$$MONTHLY_COST"
echo ""
echo "Note: R2 variants (thumbnails) add to storage cost."
echo "      Actual cost may be higher."

echo ""

# 7. 推奨事項
echo "========================================"
echo "Recommendations"
echo "========================================"
echo ""

if [ "$TOTAL_IMAGES" -lt 10000 ]; then
  echo "✓ Current structure (Phase 1) is optimal"
  echo "  - No action needed"
elif [ "$TOTAL_IMAGES" -lt 100000 ]; then
  echo "→ Consider Phase 2 (date-based partitioning)"
  echo "  - See: docs/architecture/r2-storage-structure.md"
else
  echo "→ Implement Phase 2 or Phase 3"
  echo "  - See: docs/architecture/r2-storage-structure.md"
fi

if [ "$PENDING_COUNT" -gt 10 ]; then
  echo ""
  echo "⚠ Warning: $PENDING_COUNT pending images"
  echo "  - Run cleanup script: scripts/cleanup-pending-records.sh"
fi

if [ "$STORED_COUNT" -ne "$ORIGINAL_COUNT" ]; then
  echo ""
  echo "⚠ Warning: D1 and R2 are out of sync"
  echo "  - Investigate missing files or orphaned records"
fi

echo ""
echo "========================================"
echo "Analysis completed"
echo "========================================"
