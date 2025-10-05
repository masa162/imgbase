# imgbase DNS切替計画

**作成日:** 2025-10-05
**対象ドメイン:** be2nd.com
**DNSプロバイダ:** Cloudflare

## 概要

imgbaseの本番リリースに向けて、以下のドメインをCloudflare Workers/Pagesに割り当てます。

| サブドメイン | サービス | 用途 |
|-------------|---------|------|
| `img.be2nd.com` | Cloudflare Worker | 画像配信（CDN） |
| `admin.be2nd.com` | Cloudflare Pages | 管理UI（Next.js） |
| `api.be2nd.com` | Cloudflare Worker | API（Phase 2） |

## 前提条件

### 必須
- ✅ Cloudflare アカウントに `be2nd.com` ドメインが登録済み
- ✅ Cloudflare Workers がデプロイ済み (`imgbase-worker`)
- ⏳ Cloudflare Pages に管理UIがデプロイ済み
- ✅ 統合テストが全て成功
- ✅ 性能ベンチマークが完了

### 推奨
- 現在の `img.be2nd.com` の利用状況確認（既存サービスとの競合確認）
- DNS変更前のバックアップ取得
- ロールバック手順の準備

---

## DNS切替手順

### Phase 1: 管理UI デプロイ (admin.be2nd.com)

#### 1.1 Pages プロジェクト作成とデプロイ

```bash
# 管理UIをビルド
cd admin
npm run cf:build

# Cloudflare Pages にデプロイ
wrangler pages deploy .vercel/output/static \
  --project-name imgbase-admin \
  --branch main
```

**期待される結果:**
- デプロイURL: `https://imgbase-admin.pages.dev` （一時URL）
- ビルド成功、アクセス可能

#### 1.2 カスタムドメイン設定

**Cloudflare Dashboard での操作:**

1. **Pages** > **imgbase-admin** > **Custom domains** を開く
2. **Add a custom domain** をクリック
3. ドメイン入力: `admin.be2nd.com`
4. **Continue** をクリック
5. DNS レコードが自動追加される（CNAME: `imgbase-admin.pages.dev`）

**DNSレコード（自動設定）:**
```
Type: CNAME
Name: admin
Target: imgbase-admin.pages.dev
Proxy: Proxied (オレンジクラウド)
TTL: Auto
```

#### 1.3 Basic認証の設定

管理UIにBasic認証を設定するには、Next.jsのMiddlewareまたはCloudflare Pagesの関数を使用します。

**方法1: Next.js Middleware**
`admin/middleware.ts` を作成:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const auth = request.headers.get('authorization');

  if (!auth) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="imgbase admin"'
      }
    });
  }

  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64')
    .toString()
    .split(':');

  const validUser = process.env.BASIC_AUTH_USERNAME;
  const validPass = process.env.BASIC_AUTH_PASSWORD;

  if (user === validUser && pass === validPass) {
    return NextResponse.next();
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="imgbase admin"'
    }
  });
}
```

**環境変数をPages に設定:**
```bash
# Cloudflare Dashboard > Pages > imgbase-admin > Settings > Environment variables
# または wrangler コマンドで設定
```

#### 1.4 動作確認

```bash
# ブラウザで確認
open https://admin.be2nd.com

# curlで確認
curl -I https://admin.be2nd.com
# 期待: HTTP 401 (認証なし)

curl -I -u "username:password" https://admin.be2nd.com
# 期待: HTTP 200 (認証成功)
```

---

### Phase 2: 画像配信 Worker (img.be2nd.com)

#### 2.1 Worker にカスタムドメインを追加

**Cloudflare Dashboard での操作:**

1. **Workers & Pages** > **imgbase-worker** を開く
2. **Settings** > **Domains & Routes** をクリック
3. **Add** > **Custom Domain** をクリック
4. ドメイン入力: `img.be2nd.com`
5. **Add domain** をクリック

**DNSレコード（自動設定）:**
```
Type: CNAME
Name: img
Target: imgbase-worker.belong2jazz.workers.dev
Proxy: Proxied (オレンジクラウド)
TTL: Auto
```

#### 2.2 wrangler.toml の更新

```bash
cd worker
```

`wrangler.toml` に以下を追加（オプション）:
```toml
# カスタムドメインの記録（自動設定されるため必須ではない）
# routes = [
#   { pattern = "img.be2nd.com/*", custom_domain = true }
# ]
```

#### 2.3 環境変数の更新

`PUBLIC_BASE_URL` を本番URLに更新:

```bash
cd worker

# wrangler.toml を編集
# [vars]
# PUBLIC_BASE_URL = "https://img.be2nd.com"
```

または:

```bash
# 環境変数として設定
wrangler secret put PUBLIC_BASE_URL
# 入力: https://img.be2nd.com
```

#### 2.4 再デプロイ

```bash
npm run deploy
```

#### 2.5 動作確認

```bash
# ヘルスチェック
curl https://img.be2nd.com/healthz
# 期待: {"status":"ok","timestamp":"..."}

# 画像配信テスト（統合テストで作成した画像）
IMAGE_ID="10920e1e-631e-4831-bf33-cf5bb19af55a"
curl -I "https://img.be2nd.com/i/${IMAGE_ID}/1200x675.jpg"
# 期待: HTTP 200, Content-Type: image/jpeg
```

---

### Phase 3: API Worker (api.be2nd.com) - Phase 2以降

**備考:** 現時点では未実装。Phase 2で実装予定。

#### 将来の手順（参考）
1. 新しいWorkerプロジェクト作成: `imgbase-api`
2. REST APIエンドポイント実装
3. カスタムドメイン `api.be2nd.com` を設定
4. CORS設定、認証（API Key等）

---

## DNS切替スケジュール

### 推奨スケジュール

| フェーズ | 内容 | 所要時間 | 担当 |
|---------|------|---------|------|
| **準備** | 管理UIビルド・デプロイ | 30分 | 開発者 |
| **Phase 1** | admin.be2nd.com 設定 | 15分 | 開発者 |
| **検証1** | 管理UI動作確認 | 15分 | 開発者 |
| **Phase 2** | img.be2nd.com 設定 | 15分 | 開発者 |
| **検証2** | 画像配信動作確認 | 15分 | 開発者 |
| **Phase 3** | 統合テスト再実行 | 10分 | 自動 |
| **監視** | Cloudflare Analytics確認 | 継続 | 開発者 |

**合計所要時間:** 約2時間

### DNS浸透時間

- **Cloudflare Proxy (オレンジクラウド):** 即座 ～ 数分
- **TTL:** Auto（Cloudflareが管理）
- **グローバル浸透:** 最大24-48時間（通常は数分～数時間）

---

## ロールバック手順

### 管理UI (admin.be2nd.com) のロールバック

1. Cloudflare Dashboard > Pages > imgbase-admin > Custom domains
2. `admin.be2nd.com` を削除
3. DNSレコードも自動削除される

### 画像配信 Worker (img.be2nd.com) のロールバック

1. Cloudflare Dashboard > Workers > imgbase-worker > Settings > Domains & Routes
2. `img.be2nd.com` を削除
3. 元の `imgbase-worker.belong2jazz.workers.dev` URLに戻す

### Workerバージョンのロールバック

```bash
# 過去のデプロイバージョンを確認
cd worker
wrangler deployments list

# 特定バージョンにロールバック
wrangler rollback [VERSION_ID]
```

---

## 検証チェックリスト

### Phase 1完了後（admin.be2nd.com）

- [ ] `https://admin.be2nd.com` にアクセス可能
- [ ] Basic認証が機能している
- [ ] ファイルアップロード画面が表示される
- [ ] アップロード機能が正常動作
- [ ] 画像一覧が表示される
- [ ] SSL証明書が有効（Cloudflareが自動発行）

### Phase 2完了後（img.be2nd.com）

- [ ] `https://img.be2nd.com/healthz` が200を返す
- [ ] 既存の画像URLが正常に配信される
- [ ] 異なるサイズ・フォーマットの配信が機能する
- [ ] レスポンスタイムがベースライン以内
- [ ] SSL証明書が有効

### 統合テスト再実行

```bash
export IMGBASE_SIGN_URL="https://img.be2nd.com/upload/sign"
export IMGBASE_COMPLETE_URL="https://img.be2nd.com/upload/complete"
export IMGBASE_ADMIN_USER="<user>"
export IMGBASE_ADMIN_PASS="<pass>"
export IMGBASE_TEST_FILE="sample.jpg"
node scripts/integration-test.mjs
```

- [ ] 全テスト成功 (10/10)

### ベンチマーク再実行

```bash
export IMGBASE_IMAGE_ID="<image-id>"
export IMGBASE_BENCHMARK_URL="https://img.be2nd.com"
node scripts/benchmark.mjs
```

- [ ] レスポンスタイムがベースライン同等
- [ ] キャッシュヒット率の向上確認（CDN経由）

---

## 監視項目

### 初日
- リクエスト数
- エラー率（特に404, 5xx）
- レスポンスタイム（p50, p95, p99）
- SSL証明書の状態

### 初週
- キャッシュヒット率
- CDN経由のトラフィック
- R2ストレージ使用量
- D1クエリ数

### 月次
- コスト分析（R2, Workers, Pages）
- パフォーマンストレンド
- エラーログレビュー

---

## トラブルシューティング

### 問題: DNSが浸透しない

**症状:** `dig img.be2nd.com` でCNAMEが返らない

**対処:**
```bash
# DNSキャッシュをクリア
sudo dscacheutil -flushcache  # macOS
sudo systemd-resolve --flush-caches  # Linux

# Cloudflare DNSで直接確認
dig @1.1.1.1 img.be2nd.com
```

### 問題: SSL証明書エラー

**症状:** ブラウザで「証明書が無効」と表示される

**対処:**
1. Cloudflare Dashboard > SSL/TLS > Overview
2. SSL/TLS encryption mode を **Full** に設定
3. Edge Certificates タブで証明書の状態を確認
4. 数分待ってから再アクセス

### 問題: 画像が404エラー

**症状:** `https://img.be2nd.com/i/<id>/1200x675.jpg` が404

**対処:**
```bash
# Workerログを確認
./scripts/tail-worker.sh

# D1でデータを確認
wrangler d1 execute IMGBASE_DB --remote --command \
  "SELECT id, bucket_key, status FROM images WHERE id = '<id>'"

# R2でオブジェクトを確認
wrangler r2 object list imgbase --prefix="<id>/"
```

---

## Phase 2以降の計画

### 1. EXIF自動解析
- Worker Queuesを利用した非同期処理
- アップロード完了時に自動でEXIF抽出
- D1に撮影日時・カメラ情報を保存

### 2. 類似画像検索
- Cloudflare Vectorize導入検討
- 画像のEmbedding生成
- ベクトル類似度検索

### 3. 公開API (api.be2nd.com)
- REST API実装
- API Key認証
- レート制限

---

## 参考資料

- [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [imgbase 運用ガイド](./operations.md)
- [imgbase リリースチェックリスト](./release-checklist.md)
