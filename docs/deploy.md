# imgbase デプロイ手順

## Cloudflare Pages（admin）
1. 依存関係インストール
   ```bash
   cd admin
   npm install
   ```
2. Next.js ビルドと Cloudflare 互換出力
   ```bash
   npm run build
   npx @cloudflare/next-on-pages@1.13.16
   ```
   - `.vercel/output/static` と `__next-on-pages-dist__` が生成される
3. Cloudflare Pages へデプロイ（GitHub 連携があれば push で自動）
   ```bash
   wrangler pages project create imgbase-admin --production-branch main   # 初回のみ
   wrangler pages deploy .vercel/output/static --project-name=imgbase-admin --commit-dirty=true
   ```
   - `ADMIN_BASIC_AUTH_*` や `IMGBASE_UPLOAD_URL` は Cloudflare Pages の環境変数で設定
      - `IMGBASE_UPLOAD_URL=https://imgbase-worker.belong2jazz.workers.dev/upload/sign`
      - `IMGBASE_UPLOAD_COMPLETE_URL=https://imgbase-worker.belong2jazz.workers.dev/upload/complete`
      - `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASS` は Worker と同一に揃える
   - プレビュー用ブランチには `--branch` を指定してデプロイ

## Cloudflare Workers（API）
1. 依存関係とビルド確認
   ```bash
   cd worker
   npm install
   npm run typecheck
   npm run test:integration
   ```
2. リモート D1 へのマイグレーション
   ```bash
   npx wrangler d1 migrations apply IMGBASE_DB
   ```
3. Worker デプロイ
   ```bash
   npm run deploy
   ```
4. ヘルスチェック
   ```bash
   npx wrangler tail
   curl https://img.be2nd.com/healthz
   ```

## R2 / D1 シークレット設定
環境変数をエクスポートした上で、用意したスクリプトからまとめて投入できます。

```bash
export IMGBASE_BASIC_AUTH_USER="admin"
export IMGBASE_BASIC_AUTH_PASS="********"
export IMGBASE_R2_ACCESS_KEY_ID="AKIA..."
export IMGBASE_R2_SECRET_ACCESS_KEY="********"

./scripts/set-worker-secrets.sh
```

直接コマンドを実行する場合は以下を利用してください。

```bash
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put BASIC_AUTH_USERNAME
npx wrangler secret put BASIC_AUTH_PASSWORD
```

## 動作確認
1. 管理UI から画像アップロード → `wrangler tail` でログ確認
2. `/upload/sign` レスポンスの `uploadUrl` に対して `curl -T file` でアップロードし、R2 でオブジェクト生成を確認
3. `/i/{uid}/{width}x{height}.jpg` へアクセスし、初回リクエストで Worker が派生画像を生成して200が返るか確認（R2へ書き戻される）

## CI / 自動化
- GitHub Actions（`.github/workflows/ci.yml`）で lint / typecheck / Worker の統合テスト / Next.js ビルドを自動実行。
- main / develop / feature ブランチ向けの push / PR を対象。
