# Cloudflare Pages セットアップガイド

**作成日:** 2025-10-05
**対象:** imgbase 管理UI (Next.js)

## 概要

GitHubリポジトリ `masa162/imgbase` と Cloudflare Pages を連携し、管理UIを自動デプロイします。

---

## 前提条件

- ✅ GitHubリポジトリにpush済み (`masa162/imgbase`)
- ✅ Cloudflareアカウント
- ✅ `be2nd.com` ドメインがCloudflareに登録済み

---

## 手順

### 1. Cloudflare Pages プロジェクト作成

#### 1.1 Cloudflare Dashboard にアクセス

1. https://dash.cloudflare.com/ にログイン
2. 左メニューから **Workers & Pages** を選択
3. **Create application** ボタンをクリック
4. **Pages** タブを選択
5. **Connect to Git** をクリック

#### 1.2 GitHub連携

1. **Connect GitHub account** をクリック
2. GitHubの認証画面で **Authorize Cloudflare** をクリック
3. リポジトリ選択画面で **masa162/imgbase** を選択
4. **Begin setup** をクリック

#### 1.3 ビルド設定

**Set up builds and deployments** 画面で以下を設定：

| 項目 | 値 |
|------|-----|
| **Project name** | `imgbase-admin` |
| **Production branch** | `main` |
| **Framework preset** | `Next.js` |
| **Build command** | `cd admin && npm run build` |
| **Build output directory** | `admin/.next` |
| **Root directory (advanced)** | `/` |

**環境変数（Environment variables）:**

| 変数名 | 値 |
|--------|-----|
| `NODE_VERSION` | `18` |
| `NEXT_PUBLIC_API_URL` | `https://imgbase-worker.belong2jazz.workers.dev` |

**注意:** Next.jsのPages RouterとCloudflare Pagesの互換性の問題があるため、`@cloudflare/next-on-pages` を使用します。

#### 1.4 修正: ビルド設定の変更

**より確実な設定:**

| 項目 | 値 |
|------|-----|
| **Build command** | `cd admin && npm install && npm run cf:build` |
| **Build output directory** | `admin/.vercel/output/static` |

これにより、`@cloudflare/next-on-pages` が生成する静的ファイルが正しくデプロイされます。

#### 1.5 デプロイ開始

1. **Save and Deploy** をクリック
2. ビルドが開始される（数分かかります）
3. ✅ デプロイ成功後、一時URLが表示される
   - 例: `https://imgbase-admin.pages.dev`

---

### 2. カスタムドメイン設定

#### 2.1 カスタムドメインの追加

1. Cloudflare Pages > **imgbase-admin** > **Custom domains** タブを開く
2. **Set up a custom domain** をクリック
3. ドメイン入力: `admin.be2nd.com`
4. **Continue** をクリック
5. DNS設定を確認:
   ```
   Type: CNAME
   Name: admin
   Target: imgbase-admin.pages.dev
   Proxy: Proxied (オレンジクラウド)
   ```
6. **Activate domain** をクリック

#### 2.2 SSL証明書の確認

- Cloudflareが自動的にSSL証明書を発行します
- 数分待つと `https://admin.be2nd.com` でアクセス可能になります

---

### 3. 環境変数の設定（Basic認証用）

#### 3.1 本番環境の環境変数

1. Cloudflare Pages > **imgbase-admin** > **Settings** タブ
2. **Environment variables** セクション
3. **Production** タブで **Add variable** をクリック

**追加する変数:**

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `NEXT_PUBLIC_API_URL` | `https://img.be2nd.com` | Worker APIのURL（DNS切替後） |
| `BASIC_AUTH_USERNAME` | `<your-username>` | Basic認証ユーザー名 |
| `BASIC_AUTH_PASSWORD` | `<your-password>` | Basic認証パスワード |

#### 3.2 再デプロイ

環境変数を追加した後、再デプロイが必要です：

1. **Deployments** タブを開く
2. 最新のデプロイの右側の **⋮** メニューをクリック
3. **Retry deployment** をクリック

---

### 4. Basic認証の実装（Next.js Middleware）

現在の `admin/` には Basic認証が実装されていないため、追加が必要です。

#### 4.1 Middleware の作成

`admin/src/middleware.ts` を作成:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Basic認証のチェック
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgbase admin"',
      },
    });
  }

  const [scheme, encoded] = authHeader.split(' ');

  if (scheme !== 'Basic') {
    return new NextResponse('Invalid authentication scheme', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgbase admin"',
      },
    });
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [username, password] = decoded.split(':');

  const validUsername = process.env.BASIC_AUTH_USERNAME;
  const validPassword = process.env.BASIC_AUTH_PASSWORD;

  if (username === validUsername && password === validPassword) {
    return NextResponse.next();
  }

  return new NextResponse('Invalid credentials', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="imgbase admin"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (used internally)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

#### 4.2 コミットとプッシュ

```bash
git add admin/src/middleware.ts
git commit -m "Add Basic authentication middleware for admin UI"
git push
```

Cloudflare Pagesが自動的に再デプロイします。

---

### 5. 動作確認

#### 5.1 一時URLで確認

```bash
# 認証なし（失敗するべき）
curl -I https://imgbase-admin.pages.dev
# 期待: HTTP 401

# 認証あり
curl -I -u "username:password" https://imgbase-admin.pages.dev
# 期待: HTTP 200
```

#### 5.2 カスタムドメインで確認

```bash
# DNS切替後
curl -I https://admin.be2nd.com
# 期待: HTTP 401 (認証なし)

# 認証成功
curl -I -u "username:password" https://admin.be2nd.com
# 期待: HTTP 200
```

#### 5.3 ブラウザで確認

1. `https://admin.be2nd.com` をブラウザで開く
2. Basic認証ダイアログが表示される
3. ユーザー名・パスワードを入力
4. 管理UI画面が表示される
5. ファイルアップロード機能を確認

---

### 6. 自動デプロイの設定

#### GitHub Actions との連携（オプション）

既に `.github/workflows/ci.yml` が存在しますが、Cloudflare Pagesの自動デプロイとは独立して動作します。

**Cloudflare Pages の自動デプロイ:**
- `main` ブランチへのpush時に自動デプロイ
- プルリクエストごとにプレビューデプロイ生成

**GitHub Actions CI:**
- Lintとテストの自動実行
- Cloudflare Pagesのデプロイとは別に動作

---

## トラブルシューティング

### 問題1: ビルドが失敗する

**症状:** "Build failed" エラー

**確認事項:**
1. `admin/package.json` の dependencies が正しいか
2. `NODE_VERSION` 環境変数が設定されているか
3. ビルドログで具体的なエラーを確認

**対処:**
```bash
# ローカルでビルドテスト
cd admin
npm install
npm run build
npm run cf:build
```

### 問題2: 環境変数が反映されない

**症状:** `process.env.NEXT_PUBLIC_API_URL` が undefined

**対処:**
1. Environment variables が **Production** タブに設定されているか確認
2. 変数名が `NEXT_PUBLIC_` で始まっているか確認（クライアントサイドで使う場合）
3. Retry deployment で再デプロイ

### 問題3: Basic認証が動作しない

**症状:** 401エラーが出ない、または認証をパスできない

**対処:**
1. `middleware.ts` が正しく配置されているか確認
2. 環境変数 `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD` が設定されているか
3. Cloudflare Pagesのログを確認

---

## 参考資料

- [Cloudflare Pages - Next.js](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [next-on-pages](https://github.com/cloudflare/next-on-pages)
- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

---

## 次のステップ

1. ✅ GitHub連携とPages作成
2. ✅ カスタムドメイン設定 (`admin.be2nd.com`)
3. ✅ Basic認証の実装
4. ⏳ Worker URLの更新（`img.be2nd.com` へ）
5. ⏳ 統合テストの再実行
