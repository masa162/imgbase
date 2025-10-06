# imgbase R2 オブジェクトストレージ構造設計

**作成日**: 2025-10-06
**対象**: R2バケット構造、スケーリング戦略、移行計画

---

## 概要

imgbaseは **Cloudflare R2** を使用した画像ストレージシステムです。本ドキュメントでは、現在の構造、将来のスケーリング戦略、データ移管・バックアップ方法について説明します。

---

## 現在の構造（Phase 1）

### バケット構成

**バケット数**: 1個（`imgbase`）

**推奨**: バケットは1つのまま維持

**理由**:
- シンプルな管理
- CORS設定が単一
- Worker APIのバインディングが容易
- R2の課金はバケット数に依存しない

### オブジェクトキー構造

```
imgbase/
  {imageId}/
    original/{sanitizedFilename}
    {width}x{height}.{format}
    {width}x{height}.{format}
    ...
```

**例**:
```
imgbase/
  44983f30-7eea-4a58-b6c3-c13920180447/
    original/PXL_20250623_011924136.jpg  (6.21 MB)
    800x600.jpg                           (6.21 MB - 現在はスタブ)
    400x300.webp                          (6.21 MB - 現在はスタブ)
```

### 実装

**コード**: `worker/src/index.ts:498-501`

```typescript
function buildObjectKey(imageId: string, fileName: string) {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  return `${imageId}/original/${cleanName || "file"}`;
}
```

**バリアントキー生成**: `worker/src/index.ts:299`

```typescript
const variantKey = `${uid}/${width}x${height}.${normalizedFormat}`;
```

### D1メタデータ連携

**テーブル**: `images`

**重要カラム**:
- `id` (TEXT PRIMARY KEY) - UUID、R2オブジェクトキーのプレフィックス
- `bucket_key` (TEXT NOT NULL) - R2オブジェクトキー（完全パス）
- `original_filename` (TEXT) - 元のファイル名
- `mime` (TEXT) - MIMEタイプ
- `bytes` (INTEGER) - ファイルサイズ
- `hash_sha256` (TEXT) - SHA-256ハッシュ（重複検出用）

**関係性**:
```
D1.images.id           → R2 オブジェクトキーのプレフィックス
D1.images.bucket_key   → R2 オブジェクトキーの完全パス
```

---

## 現在の構造の評価

### ✅ メリット

1. **シンプルさ**
   - 理解しやすい
   - 実装が容易
   - デバッグが簡単

2. **データ整合性**
   - imageIdでグループ化
   - D1とR2の同期が容易
   - 画像削除時にディレクトリごと削除可能

3. **パフォーマンス**
   - R2はS3互換で、プレフィックスによる自動分散
   - UUIDのランダム性により自然に分散
   - 最新のS3/R2では、連続的な命名でもパフォーマンス問題なし

4. **運用性**
   - Dashboardで視覚的に確認可能
   - 手動操作が容易
   - バックアップ・リストアが直感的

### ⚠️ 潜在的な課題

1. **スケーラビリティ**
   - ルートレベルのディレクトリ数が増加（1画像 = 1ディレクトリ）
   - 100万画像時点で、ルートに100万ディレクトリ
   - Dashboardでの一覧表示が重くなる（実運用には影響なし）

2. **時系列検索**
   - アップロード日時でのフィルタリングが困難
   - R2には日付ベースのクエリ機能なし（D1で対応）

3. **ストレージ分析**
   - 日別・月別のストレージ使用量分析が困難
   - R2 Metricsは全体のみ

### 推奨規模

**〜10万画像**: 問題なし、変更不要

**10万〜100万画像**: Phase 2（日付ベースパーティショニング）を検討

**100万画像超**: Phase 3（ハッシュベースシャーディング）を検討

---

## Phase 2: 日付ベースパーティショニング

### 実装時期

- オブジェクト数が **10万** を超えた時点
- 日別・月別のストレージ分析が必要になった時点
- Dashboard での一覧表示が重くなった時点

### 新構造

```
imgbase/
  {YYYY}/{MM}/{DD}/{imageId}/
    original/{sanitizedFilename}
    variants/
      {width}x{height}.{format}
      {width}x{height}.{format}
      ...
```

**例**:
```
imgbase/
  2025/10/06/44983f30-7eea-4a58-b6c3-c13920180447/
    original/PXL_20250623_011924136.jpg
    variants/
      800x600.jpg
      400x300.webp
```

### メリット

1. **時系列分析が容易**
   - 日別・月別のストレージ使用量を集計可能
   - 古いデータのアーカイブが容易

2. **Dashboard表示の改善**
   - ルートレベルは年単位（数個）
   - 階層的にドリルダウン

3. **バックアップ戦略**
   - 日次バックアップが容易
   - 差分バックアップの実装が可能

4. **データライフサイクル管理**
   - 古い画像の自動削除・アーカイブが容易

### 実装方法

#### 1. `buildObjectKey()` の修正

```typescript
function buildObjectKey(imageId: string, fileName: string, createdAt?: Date) {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");

  // Phase 2: 日付ベースパーティショニング
  if (createdAt) {
    const year = createdAt.getUTCFullYear();
    const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(createdAt.getUTCDate()).padStart(2, '0');
    return `${year}/${month}/${day}/${imageId}/original/${cleanName || "file"}`;
  }

  // Phase 1: 既存の構造（後方互換性）
  return `${imageId}/original/${cleanName || "file"}`;
}
```

#### 2. バリアントキー生成の修正

```typescript
function buildVariantKey(imageId: string, width: number, height: number, format: string, createdAt?: Date) {
  // Phase 2: 日付ベース + variants サブフォルダ
  if (createdAt) {
    const year = createdAt.getUTCFullYear();
    const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(createdAt.getUTCDate()).padStart(2, '0');
    return `${year}/${month}/${day}/${imageId}/variants/${width}x${height}.${format}`;
  }

  // Phase 1: 既存の構造（後方互換性）
  return `${imageId}/${width}x${height}.${format}`;
}
```

#### 3. D1スキーマ変更

**不要** - `bucket_key` に完全パスが保存されるため、構造変更の影響なし

#### 4. 既存データの移行

**オプション** - 新しい画像のみ新構造を使用し、既存画像はそのまま維持

**移行が必要な場合**:

```bash
# マイグレーションスクリプト（未実装）
# 1. D1から全画像のメタデータ取得
# 2. created_atから日付パスを生成
# 3. R2でオブジェクトをコピー（新パス）
# 4. D1のbucket_keyを更新
# 5. 旧オブジェクトを削除
```

### デメリット

1. **実装コストが増加**
2. **既存データとの混在**（移行しない場合）
3. **コードの複雑化**

---

## Phase 3: ハッシュベースシャーディング

### 実装時期

- オブジェクト数が **100万** を超えた時点
- 超高速な分散処理が必要な時点

### 新構造

```
imgbase/
  {hash[0:2]}/{hash[2:4]}/{imageId}/
    original/{sanitizedFilename}
    variants/
      {width}x{height}.{format}
      ...
```

**例**:
```
imgbase/
  ce/95/44983f30-7eea-4a58-b6c3-c13920180447/
    original/PXL_20250623_011924136.jpg
    variants/
      800x600.jpg
```

**ハッシュソース**: SHA-256の最初の4文字

### メリット

1. **最大限の分散**
   - 256 x 256 = 65,536 パーティション
   - ホットスポットの回避

2. **S3/R2のパフォーマンス最適化**
   - プレフィックスによる自動負荷分散
   - 並列処理の効率化

3. **大規模対応**
   - 数億オブジェクトまで対応可能

### デメリット

1. **可読性の低下**
   - Dashboard で見づらい
   - 手動操作が困難

2. **時系列分析が困難**
   - 日付情報がパスにない
   - D1クエリに完全依存

3. **実装コストが高い**

### 推奨

**Phase 2 で十分** - Phase 3 は極端な大規模化時のみ

---

## バケット分割の検討

### 単一バケット（現在・推奨）

**メリット**:
- シンプルな管理
- CORS設定が単一
- Worker バインディングが容易

**デメリット**:
- 全データが同一バケット
- 削除ミスのリスク

### 複数バケット（非推奨）

**パターン例**:
```
imgbase-original   # 元画像専用
imgbase-variants   # バリアント専用
imgbase-archive    # アーカイブ専用
```

**メリット**:
- 用途別の分離
- 削除ミスのリスク低減
- バケットレベルのアクセス制御

**デメリット**:
- 管理コストの増加
- CORS設定の複雑化
- Worker バインディングの複数化
- コードの複雑化

**結論**: 現状は **単一バケット** のまま維持を推奨

---

## データ移管・バックアップ戦略

### 1. R2データのエクスポート

#### 方法A: Wrangler CLI（推奨）

```bash
# 全オブジェクトのリスト取得
npx wrangler r2 object list imgbase --remote > objects_list.json

# 個別ダウンロード
npx wrangler r2 object get imgbase/{objectKey} --remote --file={localPath}

# ディレクトリ単位のダウンロード（スクリプト必要）
# 例: 特定のimageIdの全ファイル
for key in $(wrangler r2 object list imgbase --prefix "{imageId}/" | jq -r '.objects[].key'); do
  wrangler r2 object get imgbase/$key --remote --file=./backup/$key
done
```

#### 方法B: S3互換ツール

```bash
# rclone（推奨）
rclone sync r2:imgbase ./local-backup

# aws-cli（S3互換モード）
aws s3 sync s3://imgbase ./local-backup \
  --endpoint-url https://{accountId}.r2.cloudflarestorage.com
```

### 2. D1データベースのエクスポート

```bash
# SQL形式でエクスポート
npx wrangler d1 export imgbase-db --remote --output=imgbase_backup.sql

# JSON形式でエクスポート（全テーブル）
npx wrangler d1 execute imgbase-db --remote \
  --command "SELECT * FROM images" --json > images_backup.json
```

### 3. 完全バックアップスクリプト

```bash
#!/bin/bash
# backup-imgbase.sh

BACKUP_DIR="./backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 1. D1データベースのバックアップ
echo "Backing up D1 database..."
npx wrangler d1 export imgbase-db --remote \
  --output="$BACKUP_DIR/imgbase_db.sql"

# 2. R2オブジェクトリストのバックアップ
echo "Backing up R2 object list..."
npx wrangler r2 object list imgbase --remote \
  > "$BACKUP_DIR/r2_objects.json"

# 3. R2データのバックアップ（rclone使用）
echo "Backing up R2 objects..."
rclone sync r2:imgbase "$BACKUP_DIR/r2_data"

echo "Backup completed: $BACKUP_DIR"
```

### 4. データ移管（他サービスへの移行）

#### R2 → S3

```bash
# rclone で直接同期
rclone sync r2:imgbase s3:destination-bucket

# または aws-cli
aws s3 sync s3://imgbase s3://destination-bucket \
  --source-endpoint-url https://{accountId}.r2.cloudflarestorage.com \
  --endpoint-url https://s3.amazonaws.com
```

#### R2 → Google Cloud Storage

```bash
rclone sync r2:imgbase gcs:destination-bucket
```

#### R2 → ローカルストレージ

```bash
rclone sync r2:imgbase /mnt/nas/imgbase-backup
```

---

## 運用上の推奨事項

### 1. 定期バックアップ

**推奨頻度**:
- D1データベース: 毎日
- R2オブジェクトリスト: 毎日
- R2オブジェクト本体: 週次

**自動化**:
```yaml
# GitHub Actions 例
name: Backup imgbase

on:
  schedule:
    - cron: '0 2 * * *'  # 毎日 AM 2:00 UTC

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup D1
        run: npx wrangler d1 export imgbase-db --remote

      - name: Backup R2 list
        run: npx wrangler r2 object list imgbase --remote

      - name: Upload to backup storage
        run: rclone sync r2:imgbase backup:imgbase
```

### 2. モニタリング

**追跡すべきメトリクス**:
- R2オブジェクト数（D1から取得）
- R2ストレージ使用量（Cloudflare Dashboard）
- 日別アップロード数
- エラー率

**実装**:
```sql
-- D1クエリ: 日別アップロード数
SELECT DATE(created_at) as date, COUNT(*) as count
FROM images
WHERE created_at >= datetime('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- D1クエリ: 合計ストレージサイズ
SELECT SUM(bytes) as total_bytes FROM images WHERE status = 'stored';
```

### 3. データクリーンアップ

**孤立オブジェクトの削除**:

```bash
# 1. D1に存在しないR2オブジェクトの検出
# 2. 一定期間（例: 7日）経過したpendingレコードの削除
# 3. 対応するR2オブジェクトの削除
```

**実装例**:
```sql
-- 7日以上前のpendingレコードを削除
DELETE FROM images
WHERE status = 'pending'
  AND created_at < datetime('now', '-7 days');
```

### 4. ストレージコスト最適化

**R2料金体系**:
- ストレージ: $0.015/GB/月
- Class A操作（PUT, POST, LIST）: $4.50/百万リクエスト
- Class B操作（GET, HEAD）: $0.36/百万リクエスト
- **Egress: 無料** ← R2の最大の利点

**最適化ポイント**:
1. 重複画像の検出・削除（hash_sha256を活用）
2. 古いバリアントの削除（アクセスログから未使用サイズを特定）
3. 画像圧縮の最適化（リサイズ機能実装後）

---

## 移行計画テンプレート

### Phase 1 → Phase 2 への移行

**前提条件**:
- オブジェクト数が10万を超える
- 日別ストレージ分析が必要
- Dashboard表示が重い

**移行手順**:

1. **準備フェーズ（1週間）**
   - コード変更（`buildObjectKey()`の修正）
   - テスト環境での検証
   - ロールバック計画の策定

2. **デプロイフェーズ（1日）**
   - Worker APIのデプロイ
   - 新構造での動作確認
   - 既存画像は旧構造のまま維持

3. **移行フェーズ（オプション・数週間）**
   - マイグレーションスクリプトの実行
   - 日次で一部ずつ移行
   - D1メタデータの更新

4. **検証フェーズ（1週間）**
   - 新旧両構造での動作確認
   - パフォーマンステスト
   - ロールバックの準備維持

5. **完了フェーズ**
   - 旧構造コードの削除
   - ドキュメント更新

---

## まとめ

### 現在の推奨事項

1. **構造変更は不要** - 現在の8画像では Phase 1 で十分
2. **単一バケット維持** - 管理コストを最小化
3. **D1メタデータ活用** - R2の構造に依存しない検索・分析
4. **定期バックアップ** - データ損失リスクの最小化

### 将来の検討事項

1. **10万画像時点** - Phase 2（日付ベース）を検討
2. **100万画像時点** - Phase 3（ハッシュベース）を検討
3. **ストレージコスト** - 重複削除・圧縮最適化

### 運用の要点

> **「D1でメタデータ管理、R2は単なるストレージ」**
>
> R2の構造は最小限にし、すべての検索・フィルタリング・分析は D1 で実施。
> R2は「imageIdから高速に取得できる」ことだけを保証する設計。

これにより、R2の構造変更の影響を最小化し、柔軟な拡張が可能になります。

---

**最終更新**: 2025-10-06
**次回レビュー**: オブジェクト数が5万を超えた時点
