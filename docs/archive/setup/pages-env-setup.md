# Cloudflare Pages 環境変数設定手順

**作成日:** 2025-10-05

## 問題

Basic認証が有効にならない理由は、環境変数 `BASIC_AUTH_USERNAME` と `BASIC_AUTH_PASSWORD` が設定されていないためです。

## 解決方法

Cloudflare Pages Dashboard で環境変数を設定します。

---

## 手順

### 1. Cloudflare Dashboard にアクセス

1. https://dash.cloudflare.com/ にログイン
2. 左メニューから **Workers & Pages** を選択
3. **imgbase-admin** プロジェクトをクリック

### 2. 環境変数の設定

1. **Settings** タブをクリック
2. **Environment variables** セクションまでスクロール
3. **Production** タブを選択（本番環境用）
4. **Add variable** ボタンをクリック

### 3. 必須の環境変数を追加

以下の変数を1つずつ追加します：

#### 変数1: BASIC_AUTH_USERNAME（管理UI自体の認証）

- **Variable name:** `BASIC_AUTH_USERNAME`
- **Value:** お好きなユーザー名（例: `admin`）
- **Environment:** `Production` にチェック
- **Save** をクリック

#### 変数2: BASIC_AUTH_PASSWORD（管理UI自体の認証）

- **Variable name:** `BASIC_AUTH_PASSWORD`
- **Value:** お好きなパスワード（16文字以上推奨）
- **Environment:** `Production` にチェック
- **Save** をクリック

#### 変数3: IMGBASE_UPLOAD_URL（Worker APIエンドポイント）

- **Variable name:** `IMGBASE_UPLOAD_URL`
- **Value:** `https://imgbase-worker.belong2jazz.workers.dev/upload/sign`
- **Environment:** `Production` にチェック
- **Save** をクリック

#### 変数4: IMGBASE_UPLOAD_COMPLETE_URL（Worker APIエンドポイント）

- **Variable name:** `IMGBASE_UPLOAD_COMPLETE_URL`
- **Value:** `https://imgbase-worker.belong2jazz.workers.dev/upload/complete`
- **Environment:** `Production` にチェック
- **Save** をクリック

#### 変数5: ADMIN_BASIC_AUTH_USER（Worker API認証用）

- **Variable name:** `ADMIN_BASIC_AUTH_USER`
- **Value:** Worker側で設定したユーザー名（例: `admin`）
- **Environment:** `Production` にチェック
- **Save** をクリック

#### 変数6: ADMIN_BASIC_AUTH_PASS（Worker API認証用）

- **Variable name:** `ADMIN_BASIC_AUTH_PASS`
- **Value:** Worker側で設定したパスワード
- **Environment:** `Production` にチェック
- **Save** をクリック

**パスワード生成例:**
```bash
# ランダムなパスワードを生成（macOS/Linux）
openssl rand -base64 24
```

出力例: `Xy7kL9pQm3nV8wZ5rT2jU4bN6hF1`

### 4. 再デプロイ

環境変数を追加しただけでは反映されません。再デプロイが必要です。

#### 方法1: ダッシュボードから手動再デプロイ

1. **Deployments** タブを開く
2. 最新のデプロイ（一番上）の右側にある **⋮** （3点メニュー）をクリック
3. **Retry deployment** を選択
4. ビルドが完了するまで待つ（約2分）

#### 方法2: GitHubにpush（自動デプロイ）

```bash
# READMEに軽微な変更を加える
echo "" >> README.md
git add README.md
git commit -m "Trigger redeploy for env vars"
git push
```

Cloudflare Pagesが自動的に再デプロイします。

---

## 動作確認

### ブラウザで確認

1. `https://imgbase-admin.pages.dev` を開く
2. Basic認証ダイアログが表示される
3. 設定したユーザー名とパスワードを入力
4. 管理UI画面が表示される ✅

### curlで確認

```bash
# 認証なし（失敗するべき）
curl -I https://imgbase-admin.pages.dev

# 期待: HTTP/1.1 401 Unauthorized
# WWW-Authenticate: Basic realm="imgbase admin"

# 認証あり
curl -I -u "admin:your-password" https://imgbase-admin.pages.dev

# 期待: HTTP/1.1 200 OK
```

---

## トラブルシューティング

### 問題1: 再デプロイ後も401エラーが出ない

**原因:** 環境変数が設定されていない、またはデプロイ時に反映されていない

**確認:**
1. **Settings** > **Environment variables** で変数が存在するか確認
2. **Production** 環境に設定されているか確認
3. もう一度 **Retry deployment** を実行

### 問題2: 正しいパスワードでも401エラー

**原因:** パスワードに特殊文字が含まれている可能性

**対処:**
1. パスワードを英数字のみに変更
2. 環境変数を更新
3. 再デプロイ

### 問題3: 環境変数が保存できない

**原因:** 権限不足またはCloudflareの一時的な問題

**対処:**
1. ブラウザをリロード
2. 別のブラウザで試す
3. Cloudflare Statusページで障害情報を確認: https://www.cloudflarestatus.com/

---

## セキュリティ推奨事項

### パスワードの強度

- **長さ:** 16文字以上
- **文字種:** 英数字 + 記号（`!@#$%^&*` など）
- **生成:** ランダム生成ツールを使用

### 定期ローテーション

- 90日ごとにパスワードを変更
- 変更時は必ず再デプロイ

### アクセス管理

- パスワードは1Passwordなどのシークレット管理ツールで保管
- チーム共有は安全な方法で（SlackやメールでのDMは避ける）

---

## 現在の設定状態

- ✅ Basic認証Middleware実装済み (`admin/src/middleware.ts`)
- ✅ Next.js 15.5.4にアップデート（セキュリティ修正）
- ⏳ 環境変数設定待ち（`BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`）
- ⏳ 再デプロイ待ち

---

## 次のステップ

1. ⏳ 環境変数を設定（本ドキュメントの手順に従う）
2. ⏳ 再デプロイを実行
3. ⏳ Basic認証動作確認（ブラウザ/curl）
4. ⏳ カスタムドメイン設定（`admin.be2nd.com`）

---

## 参考

- `docs/environment-variables.md` - 全環境変数の一覧
- `docs/cloudflare-pages-setup.md` - Pages初期セットアップ手順
- `admin/src/middleware.ts:4` - Basic認証実装
