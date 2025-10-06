# Cloudflare環境変数設定ガイド

**作成日**: 2025-10-06
**対象**: imgbaseプロジェクト

## 📋 概要

Cloudflare Pages (管理UI) と Cloudflare Workers (API) で使用する環境変数の完全なリスト。

---

## 🔧 imgbase-admin (Cloudflare Pages)

**設定場所**: Cloudflare Dashboard > Pages > imgbase-admin > Settings > Environment variables > Production

### 必須環境変数 (7個)

| 変数名 | 値 | 用途 |
|--------|-----|------|
| `ADMIN_BASIC_AUTH_PASS` | `39` | Pages Functions用Basic認証パスワード |
| `ADMIN_BASIC_AUTH_USER` | `mn` | Pages Functions用Basic認証ユーザー名 |
| `BASIC_AUTH_PASSWORD` | `39` | (予備) |
| `BASIC_AUTH_USERNAME` | `mn` | (予備) |
| `IMGBASE_UPLOAD_URL` | `https://imgbase-worker.belong2jazz.workers.dev/upload` | 署名付きURL取得API |
| `IMGBASE_UPLOAD_COMPLETE_URL` | `https://imgbase-worker.belong2jazz.workers.dev/upload/complete` | アップロード完了通知API |
| `IMGBASE_UPLOAD_PROXY_URL` | `https://imgbase-worker.belong2jazz.workers.dev/upload/proxy` | プロキシアップロードAPI |

### CSVファイル

`temp/imgbase-admin_variables.csv` に保存済み

---

## ⚙️ imgbase-worker (Cloudflare Workers)

**設定場所**: `worker/.dev.vars` (ローカル開発) / Cloudflare Dashboard (本番)

### 必須環境変数 (10個)

| 変数名 | タイプ | 値 | 用途 |
|--------|--------|-----|------|
| `BASIC_AUTH_USERNAME` | Secret | `mn` | Worker API Basic認証ユーザー名 |
| `BASIC_AUTH_PASSWORD` | Secret | `39` | Worker API Basic認証パスワード |
| `BASIC_AUTH_REALM` | Plaintext | `imgbase` | Basic認証realm |
| `R2_ACCOUNT_ID` | Secret | `c677241d7d66ff80103bab9f142128ab` | CloudflareアカウントID |
| `R2_BUCKET_NAME` | Plaintext | `imgbase` | R2バケット名 |
| `R2_ACCESS_KEY_ID` | Secret | `b426237534434da29ddc517ac1873846` | R2アクセスキーID |
| `R2_SECRET_ACCESS_KEY` | Secret | `8a68886445f131bfc2f6d21708d5edc55b60cb4b67e4274a3aad243a9ab92463` | R2シークレットキー |
| `PUBLIC_BASE_URL` | Plaintext | `https://img.be2nd.com` | 画像配信用ベースURL |
| `MAX_UPLOAD_BYTES` | Plaintext | `52428800` | 最大アップロードサイズ (50MB) |
| `UPLOAD_URL_EXPIRY_SECONDS` | Plaintext | `900` | 署名付きURL有効期限 (15分) |

### バインディング

- **D1 Database**: `IMGBASE_DB` → `imgbase`
- **R2 Bucket**: `IMGBASE_BUCKET` → `imgbase`

### CSVファイル

`temp/imgbase-worker_variables.csv` に保存済み

---

## 🚀 Cloudflare Pages ビルド設定

**設定場所**: Cloudflare Dashboard > Pages > imgbase-admin > Settings > Builds & deployments

### ビルド設定

- **Framework preset**: Next.js
- **Build command**: `cd admin && npm install && npm run cf:build`
- **Build output directory**: `admin/out`
- **Root directory**: (空欄)
- **Node.js version**: 20

---

## 📝 設定手順

### 1. Cloudflare Pagesの環境変数設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/c677241d7d66ff80103bab9f142128ab/pages/view/imgbase-admin) を開く
2. **Settings** > **Environment variables** > **Production** に移動
3. CSVファイル (`temp/imgbase-admin_variables.csv`) の内容を1つずつ追加
4. 各変数のTypeは **Secret** を選択

### 2. ビルド設定の確認

1. **Settings** > **Builds & deployments** > **Build configurations**
2. 上記の設定値を確認・更新

### 3. 再デプロイ

1. **Deployments** タブに移動
2. 最新のデプロイメントを選択
3. **Retry deployment** をクリック

---

## ✅ 確認方法

### 環境変数が正しく設定されているか確認

```bash
# Pages Functions経由でWorker APIにアクセス
curl https://admin.be2nd.com/api/images

# 正常なら画像一覧のJSONが返る
# エラーなら環境変数が不足している
```

### ビルドログの確認

デプロイメント詳細ページで以下を確認：
- ✅ `cd admin && npm install && npm run cf:build` が実行されている
- ✅ `admin/out/functions/` が作成されている
- ✅ Pages Functionsがデプロイされている

---

## 🔐 セキュリティ

- ⚠️ CSVファイル (`temp/*.csv`) は **gitignore済み**
- ⚠️ `.env`, `.dev.vars` も **gitignore済み**
- ✅ 本番環境の変数はCloudflare Dashboard上でのみ管理
- ✅ シークレット値はすべて **Secret** タイプで保存

---

**最終更新**: 2025-10-06
