#!/bin/bash
# imgbase D1データベース - pendingレコードのクリーンアップ
# 失敗したアップロード試行のメタデータを削除

set -e

echo "========================================"
echo "imgbase D1 Pending Records Cleanup"
echo "========================================"
echo ""

# 1. 削除前の状態確認
echo "📊 現在の状態:"
echo ""
echo "全レコード数:"
npx wrangler d1 execute imgbase-db --remote --command \
  "SELECT COUNT(*) as total FROM images" --json | \
  jq -r '.[0].results[0].total'

echo ""
echo "pending レコード数:"
PENDING_COUNT=$(npx wrangler d1 execute imgbase-db --remote --command \
  "SELECT COUNT(*) as count FROM images WHERE status = 'pending'" --json | \
  jq -r '.[0].results[0].count')
echo "$PENDING_COUNT"

echo ""
echo "stored レコード数:"
npx wrangler d1 execute imgbase-db --remote --command \
  "SELECT COUNT(*) as count FROM images WHERE status = 'stored'" --json | \
  jq -r '.[0].results[0].count'

if [ "$PENDING_COUNT" -eq 0 ]; then
  echo ""
  echo "✅ pendingレコードはありません。クリーンアップ不要です。"
  exit 0
fi

echo ""
echo "========================================"
echo "削除対象のpendingレコード一覧:"
echo "========================================"
npx wrangler d1 execute imgbase-db --remote --command \
  "SELECT id, original_filename, bytes, created_at FROM images WHERE status = 'pending' ORDER BY created_at DESC" --json | \
  jq -r '.[0].results[] | "\(.id) - \(.original_filename) (\(.bytes) bytes) - \(.created_at)"'

echo ""
echo "========================================"
read -p "🗑️  ${PENDING_COUNT}件のpendingレコードを削除しますか? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ キャンセルしました。"
  exit 1
fi

echo ""
echo "🧹 pendingレコードを削除中..."
npx wrangler d1 execute imgbase-db --remote --command \
  "DELETE FROM images WHERE status = 'pending'"

echo ""
echo "✅ 削除完了"
echo ""

# 2. 削除後の状態確認
echo "========================================"
echo "📊 削除後の状態:"
echo "========================================"
echo "全レコード数:"
npx wrangler d1 execute imgbase-db --remote --command \
  "SELECT COUNT(*) as total FROM images" --json | \
  jq -r '.[0].results[0].total'

echo ""
echo "stored レコード数:"
npx wrangler d1 execute imgbase-db --remote --command \
  "SELECT COUNT(*) as count FROM images WHERE status = 'stored'" --json | \
  jq -r '.[0].results[0].count'

echo ""
echo "========================================"
echo "✅ クリーンアップ完了"
echo "========================================"
