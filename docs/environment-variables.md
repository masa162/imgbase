# 環境変数設定ガイド

**作成日:** 2025-10-05

## 概要

imgbase プロジェクトで使用する環境変数の設定方法を説明します。

---

## Cloudflare Pages 環境変数

### 必須設定

**Settings** > **Environment variables** > **Production** で以下を設定：

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `NODE_VERSION` | `20` | Node.jsのバージョン |
| `BASIC_AUTH_USERNAME` | `<username>` | Basic認証のユーザー名 |
| `BASIC_AUTH_PASSWORD` | `<password>` | Basic認証のパスワード |

### オプション設定

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `NEXT_PUBLIC_API_URL` | `https://imgbase-worker.belong2jazz.workers.dev` | Worker APIのURL（開発時） |
| `NEXT_PUBLIC_API_URL` | `https://img.be2nd.com` | Worker APIのURL（本番・DNS切替後） |

---

## Worker 環境変数 (.dev.vars)

ローカル開発時は `worker/.dev.vars` に以下を設定：

```bash
# Basic auth credentials (for admin endpoints)
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=your-secure-password

# R2 credentials (from Cloudflare Dashboard)
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_ACCOUNT_ID=your-account-id
R2_BUCKET=imgbase
```

**注意:** `.dev.vars` は `.gitignore` に含まれており、Gitにコミットされません。

---

## Cloudflare Workers 本番環境変数

**Workers & Pages** > **imgbase-worker** > **Settings** > **Variables** で設定：

| 変数名 | 値 | タイプ |
|--------|-----|--------|
| `BASIC_AUTH_USERNAME` | `<username>` | Secret |
| `BASIC_AUTH_PASSWORD` | `<password>` | Secret |
| `R2_ACCESS_KEY_ID` | `<your-key>` | Secret |
| `R2_SECRET_ACCESS_KEY` | `<your-secret>` | Secret |
| `R2_ACCOUNT_ID` | `<account-id>` | Secret |
| `R2_BUCKET` | `imgbase` | Text |

**設定方法:**
1. **Edit variables** をクリック
2. **Add variable** で各変数を追加
3. **Encrypt** にチェック（Secret変数の場合）
4. **Save and deploy** をクリック

---

## 環境変数の確認方法

### Cloudflare Pages

```bash
# Cloudflare CLI で確認（要認証）
npx wrangler pages deployment list --project-name=imgbase-admin
```

または Dashboard の **Settings** > **Environment variables** で確認。

### Worker

```bash
# Secretは表示されない（設定済みかどうかのみ確認可能）
npx wrangler secret list
```

---

## セキュリティのベストプラクティス

### 1. Basic認証の強度

- **パスワード長:** 16文字以上推奨
- **文字種:** 英数字 + 記号
- **生成方法:**
  ```bash
  # ランダム生成
  openssl rand -base64 24
  ```

### 2. R2アクセスキーの管理

- **スコープ制限:** R2バケット `imgbase` のみアクセス可能
- **権限:** Read/Write のみ（Delete は不要）
- **ローテーション:** 90日ごとに更新推奨

### 3. .env ファイルの扱い

- ✅ `.gitignore` に含める
- ✅ チーム共有は 1Password 等のシークレット管理ツール
- ❌ Slackやメールで平文共有しない
- ❌ コミットログに含めない

---

## トラブルシューティング

### 問題1: Basic認証が動作しない

**症状:** 401エラーが出ない、または認証失敗

**確認:**
```bash
# 環境変数が設定されているか確認
curl -I -u "testuser:testpass" https://admin.be2nd.com
# 期待: HTTP 401 (誤った認証情報の場合)
```

**対処:**
1. Cloudflare Pages Dashboard で `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD` が設定されているか確認
2. 変数名のスペルミス確認
3. 再デプロイ実行

### 問題2: Worker が R2 にアクセスできない

**症状:** "R2ObjectNotFound" や認証エラー

**確認:**
```bash
# Wrangler でシークレット一覧確認
npx wrangler secret list
```

**対処:**
1. `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` が正しく設定されているか
2. R2バケット名が `imgbase` で一致しているか
3. アクセスキーの有効期限確認

### 問題3: 環境変数が反映されない

**症状:** `process.env.XXX` が `undefined`

**対処:**
1. **Cloudflare Pages:**
   - 環境変数を追加後、必ず **Retry deployment** で再デプロイ
   - クライアントサイドで使う変数は `NEXT_PUBLIC_` プレフィックス必須

2. **Worker:**
   - `wrangler.toml` の `[vars]` セクション確認
   - `wrangler secret put <name>` で再設定

---

## 参考資料

- [Cloudflare Pages - Environment variables](https://developers.cloudflare.com/pages/configuration/environment-variables/)
- [Cloudflare Workers - Environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Next.js - Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

---

## チェックリスト

- [ ] Cloudflare Pages に `NODE_VERSION=20` を設定
- [ ] Cloudflare Pages に `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD` を設定
- [ ] Worker に R2アクセス用の環境変数を設定
- [ ] `.dev.vars` をローカルに作成（Gitにコミットしない）
- [ ] 環境変数設定後に再デプロイを実行
- [ ] Basic認証が動作することを確認（curl または ブラウザ）
