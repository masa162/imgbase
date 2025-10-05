# 既存の imgbase-admin Pages プロジェクトの設定

**作成日:** 2025-10-05

## 状況確認

既に `imgbase-admin` という Cloudflare Pages プロジェクトが存在している場合の設定手順です。

---

## 手順

### 1. 現在の状態を確認

Cloudflare Dashboard で以下を確認してください：

1. **Workers & Pages** > **imgbase-admin** を開く
2. **Settings** タブを確認

**確認項目:**
- [ ] GitHub リポジトリと連携されているか？
- [ ] ビルド設定は正しいか？
- [ ] 環境変数は設定されているか？

---

### 2. GitHubリポジトリとの連携

#### 2.1 連携されていない場合

**Settings** > **Builds & deployments** セクション:

1. **Source** を確認
2. **Connect to Git** ボタンがあればクリック
3. GitHub認証を完了
4. `masa162/imgbase` リポジトリを選択
5. Production branch: `main`

#### 2.2 既に連携されている場合

- そのまま使用できます
- 設定が間違っていれば修正

---

### 3. ビルド設定の確認・更新

**Settings** > **Builds & deployments** > **Build configuration**

以下の設定になっているか確認：

| 項目 | 推奨値 |
|------|--------|
| **Framework preset** | `Next.js` または `None` |
| **Build command** | `cd admin && npm install && npm run cf:build` |
| **Build output directory** | `admin/.vercel/output/static` |
| **Root directory** | `/` （空欄または `/`） |

**設定が違う場合:**
1. **Edit configuration** をクリック
2. 上記の値に変更
3. **Save** をクリック

---

### 4. 環境変数の設定

**Settings** > **Environment variables** セクション:

#### 4.1 Production 環境

**Add variable** で以下を追加：

| 変数名 | 値 | 備考 |
|--------|-----|------|
| `NODE_VERSION` | `18` | Node.jsバージョン |
| `NEXT_PUBLIC_API_URL` | `https://imgbase-worker.belong2jazz.workers.dev` | 現在のWorker URL（後で変更） |

**Basic認証用（Middleware実装後）:**

| 変数名 | 値 |
|--------|-----|
| `BASIC_AUTH_USERNAME` | `<your-username>` |
| `BASIC_AUTH_PASSWORD` | `<your-password>` |

---

### 5. 手動デプロイのトリガー

GitHubリポジトリと連携した後、初回デプロイを実行：

#### 方法1: ダッシュボードから

1. **Deployments** タブを開く
2. **Create deployment** をクリック
3. Branch: `main` を選択
4. **Save and Deploy** をクリック

#### 方法2: GitHubにpush（自動デプロイ）

既に `main` ブランチにpush済みなので、何か変更を加えてpushすれば自動デプロイされます。

簡単な確認用の変更：

```bash
# READMEを作成
cat > README.md <<'EOF'
# imgbase

Cloudflare-based photo management and delivery system.

## Components

- **Worker**: Image upload and delivery API
- **Admin UI**: Next.js-based management interface
- **R2**: Object storage
- **D1**: Metadata database

## Documentation

See [docs/](./docs/) for detailed documentation.
EOF

git add README.md
git commit -m "Add README"
git push
```

これでCloudflare Pagesが自動的にデプロイを開始します。

---

### 6. デプロイの確認

1. **Deployments** タブを開く
2. 最新のデプロイのステータスを確認
   - 🟡 Building...
   - ✅ Success
   - ❌ Failed

3. ビルドログを確認（失敗した場合）
   - デプロイをクリック > **View build log**

---

### 7. カスタムドメインの設定（未設定の場合）

**Custom domains** タブ:

1. **Set up a custom domain** をクリック
2. ドメイン入力: `admin.be2nd.com`
3. **Continue** をクリック
4. DNS設定を確認して **Activate domain**

---

## よくある状況と対処

### 状況A: 既に別のリポジトリと連携されている

**対処:**
1. **Settings** > **Builds & deployments** > **Source**
2. 現在のリポジトリとの連携を解除
3. 新しく `masa162/imgbase` と連携

### 状況B: 以前のビルド設定が残っている

**対処:**
- Build configuration を上記の推奨値に更新
- 環境変数を追加
- 再デプロイ

### 状況C: 空のプロジェクトとして作成されていた

**対処:**
- GitHubリポジトリと連携（手順2）
- ビルド設定を追加（手順3）
- デプロイ実行（手順5）

---

## プロジェクトを削除して再作成する場合

もし設定が複雑になって一から作り直したい場合：

### 削除手順

1. **Workers & Pages** > **imgbase-admin**
2. **Settings** タブ > 一番下までスクロール
3. **Delete project** セクション > **Delete** をクリック
4. 確認ダイアログでプロジェクト名を入力
5. **Delete** をクリック

### 再作成手順

[cloudflare-pages-setup.md](./cloudflare-pages-setup.md) の手順1から実施してください。

---

## 推奨: 既存プロジェクトを活用

**理由:**
- プロジェクト名 `imgbase-admin` が既に確保されている
- カスタムドメイン `admin.be2nd.com` が設定済みの可能性
- デプロイ履歴が残る

**結論:** 削除せずに設定を更新することを推奨します。

---

## チェックリスト

設定完了後、以下を確認：

- [ ] GitHubリポジトリ `masa162/imgbase` と連携済み
- [ ] Build command: `cd admin && npm install && npm run cf:build`
- [ ] Build output: `admin/.vercel/output/static`
- [ ] 環境変数 `NODE_VERSION`, `NEXT_PUBLIC_API_URL` が設定済み
- [ ] デプロイが成功している（Deployments タブで確認）
- [ ] `https://imgbase-admin.pages.dev` にアクセス可能
- [ ] カスタムドメイン `admin.be2nd.com` が設定済み（オプション）

---

## 次のステップ

1. ✅ 既存プロジェクトの設定確認・更新
2. ⏳ デプロイの成功確認
3. ⏳ Basic認証Middlewareの追加
4. ⏳ 動作確認（アップロード・一覧表示）
