# imgbase 運用手順 確認レポート

**確認日:** 2025-10-05
**確認者:** Claude Code
**環境:** 本番環境 (Cloudflare Workers)

## 確認項目

### ✅ 1. デプロイメント

#### Worker デプロイ
- **スクリプト:** `cd worker && npm run deploy`
- **状態:** ✅ 動作確認済み
- **デプロイURL:** https://imgbase-worker.belong2jazz.workers.dev
- **最終デプロイ:** 2025-10-05
- **備考:** AWS署名修正版がデプロイ済み

#### 管理UI デプロイ
- **スクリプト:** `cd admin && npm run cf:build && wrangler pages deploy`
- **状態:** ⏳ 未実施（次のステップ）
- **備考:** Next.jsビルドとPages デプロイが必要

### ✅ 2. 統合テスト

#### 自動統合テスト
- **スクリプト:** `scripts/integration-test.mjs`
- **状態:** ✅ 全テスト成功 (10/10)
- **実行コマンド:**
  ```bash
  export IMGBASE_SIGN_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/sign"
  export IMGBASE_COMPLETE_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/complete"
  export IMGBASE_ADMIN_USER="<user>"
  export IMGBASE_ADMIN_PASS="<pass>"
  export IMGBASE_TEST_FILE="sample.jpg"
  node scripts/integration-test.mjs
  ```
- **結果:**
  - アップロードフロー: ✅
  - 画像配信: ✅
  - エラーハンドリング: ✅
  - 認証: ✅

#### 性能測定
- **スクリプト:** `scripts/benchmark.mjs`
- **状態:** ✅ 実行済み
- **実行コマンド:**
  ```bash
  export IMGBASE_IMAGE_ID="<image-id>"
  export IMGBASE_BENCHMARK_URL="https://imgbase-worker.belong2jazz.workers.dev"
  node scripts/benchmark.mjs
  ```
- **結果:** 平均レスポンスタイム 241ms、p95 320ms
- **ベースライン:** [performance-baseline-2025-10-05.md](./performance-baseline-2025-10-05.md)

### ⏳ 3. バックアップ

#### D1 バックアップ
- **スクリプト:** `scripts/backup-d1.sh`
- **状態:** ⏳ 未実施
- **実行コマンド:**
  ```bash
  ./scripts/backup-d1.sh IMGBASE_DB ./backups
  ```
- **確認項目:**
  - [ ] `backups/d1-IMGBASE_DB-<timestamp>.sql` が生成される
  - [ ] SQLファイルにテーブル定義とデータが含まれる

#### R2 バックアップ
- **スクリプト:** `scripts/sync-r2.sh`
- **状態:** ⏳ 未実施（AWS CLI設定が必要）
- **実行コマンド:**
  ```bash
  export IMGBASE_ACCOUNT_ID="c677241d7d66ff80103bab9f142128ab"
  export IMGBASE_R2_BUCKET="imgbase"
  export IMGBASE_R2_ACCESS_KEY_ID="<key>"
  export IMGBASE_R2_SECRET_ACCESS_KEY="<secret>"
  ./scripts/sync-r2.sh ./r2-backup
  ```
- **確認項目:**
  - [ ] AWS CLI がインストールされている
  - [ ] R2 アクセスキーが正しく設定されている
  - [ ] `r2-backup/` にオブジェクトが同期される

### ⏳ 4. 監視・ログ

#### Worker ログ監視
- **スクリプト:** `scripts/tail-worker.sh`
- **状態:** ⏳ 未実施
- **実行コマンド:**
  ```bash
  ./scripts/tail-worker.sh
  ```
- **確認項目:**
  - [ ] リアルタイムでWorkerログが表示される
  - [ ] エラーログがあれば即座に検知できる

#### Cloudflare Analytics
- **アクセス方法:** Cloudflare Dashboard > Workers & Pages > imgbase-worker > Analytics
- **状態:** ⏳ DNS統合後に有効
- **確認項目:**
  - [ ] リクエスト数
  - [ ] レスポンスタイム (p50, p95, p99)
  - [ ] エラー率
  - [ ] キャッシュヒット率（DNS統合後）

### ✅ 5. シークレット管理

#### Worker シークレット
- **スクリプト:** `scripts/set-worker-secrets.sh`
- **状態:** ✅ 設定済み
- **設定項目:**
  - `BASIC_AUTH_USERNAME`
  - `BASIC_AUTH_PASSWORD`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
- **確認方法:**
  ```bash
  cd worker && wrangler secret list
  ```

### ⏳ 6. 定期作業

#### 週次
- [ ] D1バックアップを取得
- [ ] R2バックアップを取得
- [ ] 外部ストレージ（S3/GCS等）へ転送

#### 月次
- [ ] Cloudflare Analytics でトラフィック分析
- [ ] コスト確認（R2ストレージ量、Workerリクエスト数）
- [ ] 運用ドキュメントの更新

#### リリース毎
- [ ] 統合テスト実施
- [ ] 性能ベンチマーク実施
- [ ] トラブルシューティングの記録更新

## 運用スクリプト一覧

| スクリプト | 用途 | 状態 | 頻度 |
|-----------|------|------|------|
| `integration-test.mjs` | 統合テスト | ✅ 検証済み | リリース毎 |
| `benchmark.mjs` | 性能測定 | ✅ 検証済み | リリース毎、月次 |
| `test-upload.mjs` | 簡易アップロードテスト | ✅ 検証済み | 随時 |
| `backup-d1.sh` | D1バックアップ | ⏳ 要実施 | 週次 |
| `sync-r2.sh` | R2バックアップ | ⏳ 要設定 | 週次 |
| `tail-worker.sh` | Workerログ監視 | ⏳ 要実施 | 障害時 |
| `set-worker-secrets.sh` | シークレット設定 | ✅ 実施済み | 初回、変更時 |

## トラブルシューティング実績

### 問題1: AWS署名エラー (SignatureDoesNotMatch)
- **発生日:** 2025-10-05
- **症状:** R2アップロード時に403エラー
- **原因:** 署名付きURLがcontent-typeヘッダーを署名対象に含んでいなかった
- **対処:** `worker/src/index.ts` の `signR2PutUrl` 関数を修正
- **結果:** ✅ 解決済み

### 問題2: 統合テストスクリプトのバグ
- **発生日:** 2025-10-05
- **症状:** Test 3とTest 4で異なる画像IDが使われていた
- **原因:** Test 3で署名付きURLを再取得していた
- **対処:** `scripts/integration-test.mjs` を修正し、同一署名データを使用
- **結果:** ✅ 解決済み

## 改善提案

### 短期（リリース前）
1. ✅ 統合テストスクリプトの修正
2. ⏳ D1バックアップの初回実行
3. ⏳ R2バックアップの設定と初回実行
4. ⏳ Workerログ監視の動作確認

### 中期（リリース後1ヶ月）
1. Cloudflare Image Resizing の実装
2. CDNキャッシュヒット率の測定と最適化
3. 自動バックアップのスケジュール化（cron等）
4. アラート設定（エラー率、レスポンスタイム）

### 長期（Phase 2以降）
1. EXIF自動解析パイプライン
2. 類似画像検索機能
3. 公開API (api.be2nd.com)
4. マルチリージョン対応

## 結論

### ✅ 運用準備完了項目
- Worker デプロイ
- 統合テスト
- 性能測定
- シークレット管理
- 基本的な運用スクリプト

### ⏳ 残タスク
- 管理UI デプロイ
- バックアップ手順の実施確認
- ログ監視の動作確認
- DNS統合

### 総合評価
**運用準備状況: 80%完了**

核心機能（アップロード、配信）は完全に動作し、テストも合格しています。残りはバックアップとログ監視の実施確認、およびDNS統合のみです。

## 次のステップ

1. ⏳ D1バックアップの初回実行
2. ⏳ DNS切替計画の策定
3. ⏳ Phase 2機能のIssue化
4. ⏳ リリースチェックリストの最終確認

---

**参考ドキュメント:**
- [運用ガイド](./operations.md)
- [統合テスト手順](./integration-test.md)
- [性能測定ガイド](./performance-testing.md)
- [性能ベースライン](./performance-baseline-2025-10-05.md)
