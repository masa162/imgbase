# imgbase セットアップ手順（Cloudflare）

1. Cloudflare リソース作成
   - R2: `imgbase` バケット（プレビュー用に `imgbase-dev` も作成）
   - D1: `imgbase-db` を作成し、`wrangler d1 list` で database_id を取得
   - Pages: `imgbase-admin` プロジェクトを新規作成（ブランチは main を想定）
   - Workers: `imgbase-worker` を作成し、R2/D1 バインディングを登録

2. Wrangler 設定
   - `worker/wrangler.toml` の `bucket_name`, `preview_bucket_name`, `database_id` を実値に更新
 - `wrangler secret put BASIC_AUTH_USERNAME` などで認証情報を投入
  - まとめて投入する場合は `./scripts/set-worker-secrets.sh` と環境変数を利用
   - ローカル開発では `.dev.vars` に BASIC 認証や API URL を設定

3. 管理UI 環境変数
   - `admin/.env.local` を `.env.local.example` から複製し、R2 認証情報と Worker エンドポイントを設定
   - Next.js ビルド環境（Pages）でも同じキーを設定

4. デプロイフロー
   - GitHub main ブランチ push → Pages が自動ビルド（`npm run cf:build` がビルドコマンド）
   - 手動デプロイ時は `npm run cf:build` の後 `npx wrangler pages deploy .open-next --project-name=imgbase-admin`
   - Worker は `npm run test:integration` → `npm run deploy`
   - D1 スキーマは `npx wrangler d1 migrations apply IMGBASE_DB` で適用

5. 認証・セキュリティ
   - Basic 認証は当面 Workers 側で検証（後続で Cloudflare Access を検討）
   - R2 署名付き URL は限定期間（15分など）を推奨
   - `.env` 類は Git 管理外（.gitignore に追加済み）で扱う
