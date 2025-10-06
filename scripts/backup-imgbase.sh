#!/bin/bash
# imgbase 完全バックアップスクリプト
# D1データベース + R2オブジェクトリスト + R2データ本体をバックアップ

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

echo "========================================"
echo "imgbase Backup Script"
echo "========================================"
echo ""
echo "Backup directory: $BACKUP_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR"

# 1. D1データベースのバックアップ
echo -e "${YELLOW}[1/3] Backing up D1 database...${NC}"
npx wrangler d1 export imgbase-db --remote \
  --output="$BACKUP_DIR/imgbase_db.sql"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ D1 database backed up${NC}"
  ls -lh "$BACKUP_DIR/imgbase_db.sql"
else
  echo -e "${RED}✗ D1 database backup failed${NC}"
  exit 1
fi

echo ""

# 2. D1データベースのJSON形式バックアップ（画像メタデータ）
echo -e "${YELLOW}[2/3] Backing up image metadata (JSON)...${NC}"
npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT * FROM images ORDER BY created_at DESC" \
  --json > "$BACKUP_DIR/images_metadata.json"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Image metadata backed up${NC}"
  IMAGE_COUNT=$(cat "$BACKUP_DIR/images_metadata.json" | jq '.[0].results | length')
  echo "Total images: $IMAGE_COUNT"
  ls -lh "$BACKUP_DIR/images_metadata.json"
else
  echo -e "${RED}✗ Image metadata backup failed${NC}"
  exit 1
fi

echo ""

# 3. R2オブジェクトリストのバックアップ
echo -e "${YELLOW}[3/3] Backing up R2 object list...${NC}"
npx wrangler r2 object list imgbase --remote \
  --json > "$BACKUP_DIR/r2_objects.json"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ R2 object list backed up${NC}"
  R2_COUNT=$(cat "$BACKUP_DIR/r2_objects.json" | jq '.objects | length')
  echo "Total R2 objects: $R2_COUNT"
  ls -lh "$BACKUP_DIR/r2_objects.json"
else
  echo -e "${RED}✗ R2 object list backup failed${NC}"
  exit 1
fi

echo ""

# 4. バックアップサマリー
echo "========================================"
echo "Backup Summary"
echo "========================================"
echo "Backup location: $BACKUP_DIR"
echo ""
echo "Files:"
echo "  - imgbase_db.sql         (D1 database dump)"
echo "  - images_metadata.json   (Image metadata)"
echo "  - r2_objects.json        (R2 object list)"
echo ""
echo "Statistics:"
echo "  - Images in D1: $IMAGE_COUNT"
echo "  - Objects in R2: $R2_COUNT"
echo ""

# ディスクサイズ
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "Total backup size: $BACKUP_SIZE"

echo ""
echo -e "${GREEN}✓ Backup completed successfully${NC}"
echo ""

# 5. オプション: 古いバックアップの削除（30日以上前）
if [ "${AUTO_CLEANUP}" = "true" ]; then
  echo "Cleaning up old backups (older than 30 days)..."
  find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" -mtime +30 -exec rm -rf {} \;
  echo "Cleanup completed"
fi

# 6. オプション: R2データ本体のバックアップ（rclone必要）
if command -v rclone &> /dev/null; then
  echo ""
  read -p "Do you want to backup R2 data (images) using rclone? (y/N): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Backing up R2 data...${NC}"
    mkdir -p "$BACKUP_DIR/r2_data"
    rclone sync r2:imgbase "$BACKUP_DIR/r2_data" --progress
    echo -e "${GREEN}✓ R2 data backed up${NC}"
  fi
else
  echo ""
  echo -e "${YELLOW}Note: rclone not found. To backup R2 data, install rclone:${NC}"
  echo "  https://rclone.org/install/"
fi

echo ""
echo "========================================"
echo "Backup completed: $BACKUP_DIR"
echo "========================================"
