# imgbase 運用ガイド

## 1. リリース前チェック
- `npm run lint`（admin）と `npm run test:integration`（worker）をローカルで実行
- GitHub Actions (`ci.yml`) で成功していることを確認
- `scripts/set-worker-secrets.sh` で Cloudflare Secrets を最新化
- `npm run cf:build` → `wrangler pages deploy` で管理UI、`npm run deploy` で Worker をデプロイ

## 2. バックアップ
### D1 エクスポート
```bash
./scripts/backup-d1.sh IMGBASE_DB ./backups
```
- `wrangler d1 export` を呼び出し、`backups/` 配下に `d1-IMGBASE_DB-<timestamp>.sql` を保存
- リモートDBへの接続には `wrangler login` が必要

### R2 ミラーリング
```bash
export IMGBASE_ACCOUNT_ID="c677241d7d66ff80103bab9f142128ab"
export IMGBASE_R2_BUCKET="imgbase"
export IMGBASE_R2_ACCESS_KEY_ID="..."
export IMGBASE_R2_SECRET_ACCESS_KEY="..."
./scripts/sync-r2.sh ./r2-backup
```
- AWS CLI (`aws`) を利用して R2 バケットをローカルへ同期
- `--delete` オプションで削除分も反映するため、実行前に退避ディレクトリを確認

## 3. 監視・トラブルシュート
- Worker ログ: `./scripts/tail-worker.sh`
- ページデプロイ: Cloudflare Pages ダッシュボードでビルド履歴を確認
- Worker 健康チェック: `curl https://img.be2nd.com/healthz`
- エラー時は D1 の最新レコードを確認: `wrangler d1 execute IMGBASE_DB --remote --command "SELECT * FROM images ORDER BY created_at DESC LIMIT 10"`
- 本番アップロードの通しテスト: 
  ```bash
  export IMGBASE_SIGN_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/sign"
  export IMGBASE_COMPLETE_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/complete"
  export IMGBASE_ADMIN_USER="<Basic Auth User>"
  export IMGBASE_ADMIN_PASS="<Basic Auth Pass>"
  export IMGBASE_TEST_FILE="/path/to/sample.jpg"
  node ./scripts/test-upload.mjs
  ```

## 4. パフォーマンス・コスト
- 画像配信: 初回リクエストで派生生成→R2にキャッシュ、2回目以降はヒットを想定
- Cloudflare Analytics で `img.be2nd.com` のキャッシュ率とレスポンス時間を監視
- R2 利用量: Cloudflare Dashboard > R2 > Metrics でバケットサイズを定期確認
- 月次で `aws s3 ls --summarize`（`--endpoint-url` を付与）を利用しローカル記録に残す

## 5. 障害対応フロー
1. Cloudflare Status / Twitter を確認し大規模障害かを切り分け
2. Worker ログを tail し、エラーメッセージを特定
3. R2 / D1 の接続エラーの場合は `wrangler` 経由で個別の疎通テストを実行
4. 問題が Worker のデプロイ内容である場合、直近タグへ `wrangler deploy --version <tag>` でロールバック

## 6. 定期作業
- 週次: R2 バックアップ・D1 エクスポートを取得し、外部ストレージへ保存
- 月次: `docs/deploy.md` と `docs/setup.md` の内容を棚卸し
- リリース毎: `docs/operations.md` に新しい運用タスクやトラブルシュート結果を追記
