# imgbase ストレージ構造移行ガイド

**作成日**: 2025-10-06
**対象**: Phase 1 → Phase 2 への移行手順

---

## 概要

このドキュメントでは、現在の構造（Phase 1）から日付ベースパーティショニング（Phase 2）への移行手順を説明します。

---

## 移行の前提条件

### いつ移行すべきか

以下のいずれかに該当する場合、Phase 2 への移行を検討してください：

- ✅ オブジェクト数が **10万** を超えた
- ✅ Cloudflare Dashboard での一覧表示が重い
- ✅ 日別・月別のストレージ分析が必要
- ✅ 古いデータのアーカイブ・削除を計画している

### 移行しなくても良い場合

- ❌ オブジェクト数が 10万未満
- ❌ Dashboard を使用していない（API経由のみ）
- ❌ 時系列分析が不要（D1クエリで十分）

---

## 移行戦略

### オプション A: 新規画像のみ新構造（推奨）

**概要**:
- 既存画像はそのまま維持
- 新規アップロード画像から新構造を適用
- 両方の構造が混在するが、D1メタデータで透過的に扱える

**メリット**:
- 移行コストが最小
- ダウンタイムなし
- ロールバックが容易

**デメリット**:
- 構造が混在（運用上の注意が必要）
- Dashboard で2つの構造が見える

### オプション B: 全画像を新構造に移行

**概要**:
- 既存画像を全て新構造にコピー・移動
- 旧構造を完全に削除

**メリット**:
- 構造が統一される
- Dashboard での見た目がきれい

**デメリット**:
- 移行コストが高い（時間・ストレージ）
- 一時的にストレージ容量が2倍になる
- ダウンタイムが発生する可能性

**推奨**: **オプション A**（新規画像のみ新構造）

---

## Phase 2 実装手順（オプション A）

### Step 1: 環境変数の追加

`worker/.dev.vars` および Cloudflare Dashboard に以下を追加：

```
STORAGE_STRUCTURE_VERSION=2
```

**値**:
- `1` または未設定 → Phase 1（既存の構造）
- `2` → Phase 2（日付ベースパーティショニング）

### Step 2: コード変更

#### 2-1. `buildObjectKey()` の修正

**ファイル**: `worker/src/index.ts`

**変更前**:
```typescript
function buildObjectKey(imageId: string, fileName: string) {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  return `${imageId}/original/${cleanName || "file"}`;
}
```

**変更後**:
```typescript
function buildObjectKey(
  imageId: string,
  fileName: string,
  createdAt: Date,
  env: Env
): string {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  const version = env.STORAGE_STRUCTURE_VERSION || "1";

  if (version === "2") {
    // Phase 2: 日付ベースパーティショニング
    const year = createdAt.getUTCFullYear();
    const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(createdAt.getUTCDate()).padStart(2, "0");
    return `${year}/${month}/${day}/${imageId}/original/${cleanName || "file"}`;
  }

  // Phase 1: 既存の構造（デフォルト）
  return `${imageId}/original/${cleanName || "file"}`;
}
```

#### 2-2. バリアントキー生成の修正

**新規追加**:
```typescript
function buildVariantKey(
  imageId: string,
  width: number,
  height: number,
  format: string,
  bucketKey: string,
  env: Env
): string {
  const version = env.STORAGE_STRUCTURE_VERSION || "1";

  if (version === "2") {
    // Phase 2: bucket_key から日付パスを抽出
    // bucket_key 例: "2025/10/06/{imageId}/original/{filename}"
    const match = bucketKey.match(/^(\d{4}\/\d{2}\/\d{2})\//);
    if (match) {
      const datePath = match[1];
      return `${datePath}/${imageId}/variants/${width}x${height}.${format}`;
    }
  }

  // Phase 1: 既存の構造（デフォルト）
  return `${imageId}/${width}x${height}.${format}`;
}
```

#### 2-3. アップロードエンドポイントの修正

**`/upload/sign` エンドポイント**:

```typescript
router.post(
  "/upload/sign",
  withAuth(async (request, env) => {
    // ... 既存のバリデーション ...

    const imageId = crypto.randomUUID();
    const now = new Date();
    const objectKey = buildObjectKey(imageId, body.fileName, now, env);

    // ... 残りは同じ ...
  })
);
```

**`/upload/proxy` エンドポイント**:

```typescript
router.post(
  "/upload/proxy",
  withAuth(async (request, env) => {
    // ... 既存のバリデーション ...

    const imageId = crypto.randomUUID();
    const now = new Date();
    const objectKey = buildObjectKey(imageId, fileName, now, env);

    // ... 残りは同じ ...
  })
);
```

**`/i/:uid/:size` エンドポイント**:

```typescript
router.get("/i/:uid/:size", async (request, env: Env) => {
  const { uid, size } = request.params ?? {};

  // ... バリデーション ...

  const widthNumber = Number(width);
  const heightNumber = Number(height);

  // D1から元画像のbucket_keyを取得
  const record = await env.IMGBASE_DB.prepare(
    "SELECT bucket_key FROM images WHERE id = ?1"
  )
    .bind(uid)
    .first<{ bucket_key: string }>();

  if (!record) {
    return new Response("Bad Request", { status: 400 });
  }

  const variantKey = buildVariantKey(
    uid,
    widthNumber,
    heightNumber,
    normalizedFormat,
    record.bucket_key,
    env
  );

  // ... 残りは同じ ...
});
```

### Step 3: テスト

#### 3-1. ローカルテスト

```bash
# .dev.vars に追加
echo "STORAGE_STRUCTURE_VERSION=2" >> worker/.dev.vars

# ローカルWorkerを起動
cd worker
npm run dev

# テストアップロード
curl -X POST http://localhost:8787/upload/proxy \
  -u admin:password \
  -H "Content-Type: image/jpeg" \
  -H "X-Filename: test.jpg" \
  --data-binary @sample.jpg
```

**期待される結果**:
```json
{
  "imageId": "...",
  "objectKey": "2025/10/06/{imageId}/original/test.jpg",
  "hash": "..."
}
```

#### 3-2. 本番デプロイ前の確認

```bash
# Workerコードをデプロイ（環境変数は未設定）
cd worker
npm run deploy

# テストアップロード（Phase 1 のまま）
curl -X POST https://imgbase-worker.belong2jazz.workers.dev/upload/proxy \
  -u admin:password \
  -H "Content-Type: image/jpeg" \
  -H "X-Filename: test-phase1.jpg" \
  --data-binary @sample.jpg

# 期待: 2025/10/06 パスなし（既存の構造）
```

### Step 4: 本番環境への適用

#### 4-1. 環境変数の設定

Cloudflare Dashboard で以下を設定：

1. Workers & Pages > imgbase-worker > Settings > Variables
2. **Environment Variables** → **Production**
3. 追加: `STORAGE_STRUCTURE_VERSION` = `2`
4. **Save and deploy**

#### 4-2. 動作確認

```bash
# テストアップロード
curl -X POST https://imgbase-worker.belong2jazz.workers.dev/upload/proxy \
  -u admin:password \
  -H "Content-Type: image/jpeg" \
  -H "X-Filename: test-phase2.jpg" \
  --data-binary @sample.jpg

# 期待: objectKey に 2025/10/06 パスが含まれる
```

#### 4-3. R2で確認

Cloudflare Dashboard > R2 > imgbase を開き、以下を確認：

```
imgbase/
  2025/
    10/
      06/
        {imageId}/
          original/
            test-phase2.jpg
```

### Step 5: 監視とロールバック準備

#### 5-1. 監視

```bash
# D1クエリ: 新構造の画像数
npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT COUNT(*) as count FROM images WHERE bucket_key LIKE '20%/%/%/%'"

# R2確認
npx wrangler r2 object list imgbase --remote --prefix "2025/"
```

#### 5-2. ロールバック

問題が発生した場合：

1. 環境変数を削除または `STORAGE_STRUCTURE_VERSION=1` に変更
2. Worker を再デプロイ
3. 新構造でアップロードされた画像は D1 から削除

```sql
-- Phase 2 でアップロードされた画像を削除
DELETE FROM images WHERE bucket_key LIKE '20%/%/%/%';
```

---

## 既存画像の移行（オプション B）

### 注意事項

- **ストレージ容量が一時的に2倍**になります
- **移行中はアップロード機能を停止**することを推奨
- **バックアップ必須**

### 移行スクリプト（未実装）

```bash
#!/bin/bash
# migrate-to-phase2.sh（参考実装）

# 1. D1から全画像のメタデータ取得
IMAGES=$(npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT id, bucket_key, created_at FROM images" --json)

# 2. 各画像をコピー
echo "$IMAGES" | jq -r '.[0].results[] | @json' | while read -r row; do
  IMAGE_ID=$(echo "$row" | jq -r '.id')
  OLD_KEY=$(echo "$row" | jq -r '.bucket_key')
  CREATED_AT=$(echo "$row" | jq -r '.created_at')

  # 日付パスを生成
  YEAR=$(date -d "$CREATED_AT" +%Y)
  MONTH=$(date -d "$CREATED_AT" +%m)
  DAY=$(date -d "$CREATED_AT" +%d)

  # 新しいキーを生成
  FILENAME=$(basename "$OLD_KEY")
  NEW_KEY="$YEAR/$MONTH/$DAY/$IMAGE_ID/original/$FILENAME"

  echo "Migrating: $OLD_KEY → $NEW_KEY"

  # R2でコピー（Wrangler CLIでは直接コピー不可、rclone推奨）
  # rclone copyto r2:imgbase/$OLD_KEY r2:imgbase/$NEW_KEY

  # D1の bucket_key を更新
  npx wrangler d1 execute imgbase-db --remote \
    --command "UPDATE images SET bucket_key = '$NEW_KEY' WHERE id = '$IMAGE_ID'"
done

# 3. バリアントも移行（同様の手順）

# 4. 旧オブジェクトを削除
# (慎重に確認してから実行)
```

**推奨ツール**: `rclone` を使用したバッチコピー

---

## トラブルシューティング

### 問題1: 画像が表示されない

**症状**: Phase 2 適用後、既存画像が表示されない

**原因**: バリアントキー生成が旧構造のまま

**解決**:
1. `buildVariantKey()` が正しく実装されているか確認
2. `bucket_key` から日付パスを抽出できているか確認

### 問題2: 新旧構造が混在して混乱

**症状**: Dashboard で構造が統一されていない

**解決**:
- 正常動作です。D1メタデータで透過的に扱えます。
- Dashboard は参考程度に使用し、実際の検索は D1 クエリで実施

### 問題3: ストレージ容量が増加

**症状**: Phase 2 適用後、ストレージ使用量が増加

**原因**: バリアントが重複生成されている

**解決**:
1. 古いバリアントを削除するスクリプトを実行
2. D1 の `bucket_key` と R2 のオブジェクトを照合

---

## まとめ

### 推奨アプローチ

1. **Phase 1 のまま運用** - 10万画像まで
2. **Phase 2 への移行** - 新規画像のみ新構造
3. **既存画像の移行** - 必要に応じてバッチ処理

### 重要ポイント

- ✅ D1 メタデータで構造の違いを吸収
- ✅ 環境変数で構造を切り替え
- ✅ ダウンタイムなしで移行可能
- ✅ ロールバックが容易

---

**最終更新**: 2025-10-06
**次回レビュー**: Phase 2 実装時
