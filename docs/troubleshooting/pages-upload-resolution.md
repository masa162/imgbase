# imgbase 管理UI アップロード機能の完全解決記録

**作成日**: 2025-10-06
**対象**: Cloudflare Pages Functions + Worker API統合
**結果**: ✅ 署名付きURLアップロード・プロキシアップロード両方成功

---

## 概要

管理UI（`https://admin.be2nd.com`）からの画像アップロード機能が完全に動作しない状態から、両方のアップロード方式（署名付きURL方式・プロキシ方式）を完全復旧させた解決プロセスの記録。

### 最終結果

✅ **署名付きURLアップロード成功**:
```
アップロード完了: c54d0c76-8c5e-495d-acbb-fc9b68b2aa46/original/PXL_20250623_011922083.jpg
```

✅ **プロキシアップロード成功**:
```
アップロード完了: 44983f30-7eea-4a58-b6c3-c13920180447/original/PXL_20250623_011924136.jpg (6209535 bytes)
```

両方とも **6MB以上の実画像ファイル** で検証済み、D1データベースに `status="stored"` で正常登録、SHA-256ハッシュ計算完了。

---

## 問題1: Pages Functions が 404 エラー

### 症状

```
GET https://admin.be2nd.com/api/images → 404 Not Found
POST https://admin.be2nd.com/api/uploads → 404 Not Found
POST https://admin.be2nd.com/api/uploads/proxy → 404 Not Found
```

管理UIは表示されるが、すべてのAPIエンドポイントが404を返す。

### 調査プロセス

1. **デプロイログ確認**:
   ```bash
   gh run view 12345678901 --log
   ```
   → ビルドは成功しているが、Functions がアップロードされていない

2. **ディレクトリ構造確認**:
   ```
   admin/
     functions/          ← ここにFunctions定義がある
       api/
         images/
           index.js
         uploads/
           index.js
           ...
     package.json
       "cf:build": "next build && cp -r functions out/"
   ```
   → ビルド後 `admin/out/functions/` にコピーされている

3. **Cloudflare Pages Functions 仕様確認**:
   - Functions は **プロジェクトルート** の `/functions/` を検索
   - または `<build_output>/_functions/` （アンダースコア始まり）
   - `admin/out/functions/` は検出されない ❌

### 根本原因

Cloudflare Pages は `/functions/` （リポジトリルート）にある Functions しか認識しない。
`admin/` サブディレクトリにあるファイルは無視される。

### 解決策

**Functions を `/functions/` に移動**:

```bash
# admin/functions/ → /functions/ に移動
mv admin/functions/* functions/
git add functions/ admin/
git commit -m "Move Pages Functions to repository root"
```

**ビルドスクリプト簡略化**:

```json
{
  "scripts": {
    "cf:build": "next build"  // コピー不要
  }
}
```

### 検証

デプロイログで確認:
```
✅ Uploading Functions (6)
  /api/images
  /api/uploads
  /api/uploads/complete
  /api/uploads/proxy
  ...
```

curl テスト:
```bash
curl -s https://admin.be2nd.com/api/images
# → 200 OK, JSON配列レスポンス
```

---

## 問題2: 環境変数エンドポイント誤り

### 症状

```
POST https://admin.be2nd.com/api/uploads → 502 Bad Gateway
```

Pages Function は動作しているが、Worker APIへの転送で失敗。

### 調査プロセス

1. **Pages Function のコード確認**:
   ```javascript
   const response = await fetch(env.IMGBASE_UPLOAD_URL, {
     method: 'POST',
     ...
   });
   ```
   → `IMGBASE_UPLOAD_URL` 環境変数を使用

2. **環境変数の値確認**:
   ```
   IMGBASE_UPLOAD_URL=https://imgbase-worker.belong2jazz.workers.dev/upload
   ```

3. **Worker API エンドポイント確認**:
   ```typescript
   router.post("/upload/sign", withAuth(...));
   router.post("/upload/proxy", withAuth(...));
   router.post("/upload/complete", withAuth(...));
   router.all("*", () => new Response("Not found", { status: 404 }));
   ```
   → `/upload` というエンドポイントは存在しない ❌

4. **直接curlテスト**:
   ```bash
   curl -X POST https://imgbase-worker.belong2jazz.workers.dev/upload \
     -u admin:password
   # → 404 Not Found

   curl -X POST https://imgbase-worker.belong2jazz.workers.dev/upload/sign \
     -u admin:password \
     -H "Content-Type: application/json" \
     -d '{"fileName":"test.jpg","contentType":"image/jpeg","size":1000}'
   # → 200 OK, {"imageId":"...","uploadUrl":"..."}
   ```

### 根本原因

環境変数 `IMGBASE_UPLOAD_URL` が間違ったエンドポイントを指していた:
- ❌ `.../upload` （存在しない）
- ✅ `.../upload/sign` （正しい）

### 解決策

1. **CSVファイル修正**:
   ```csv
   Secret,IMGBASE_UPLOAD_URL,https://imgbase-worker.belong2jazz.workers.dev/upload/sign,-
   ```

2. **Cloudflare Dashboard で手動更新**:
   - Pages プロジェクト → Settings → Environment Variables
   - `IMGBASE_UPLOAD_URL` の値を更新
   - 再デプロイ

3. **ドキュメント更新**:
   - `docs/cloudflare-environment-variables.md` に ⚠️ 警告追加
   - `docs/troubleshooting/pages-functions-502-error.md` 作成

### 検証

```bash
curl -s https://admin.be2nd.com/api/uploads \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","contentType":"image/jpeg","size":1000}'
# → 200 OK, {"imageId":"...","uploadUrl":"https://...","objectKey":"..."}
```

---

## 問題3: 署名付きURLアップロードで CORS エラー

### 症状

```
ブラウザコンソール:
Failed to fetch
CORS policy: No 'Access-Control-Allow-Origin' header is present
```

署名付きURL取得は成功するが、R2への直接PUTリクエストがブロックされる。

### 調査プロセス

1. **R2 CORS設定確認**:
   ```bash
   cd worker
   npx wrangler r2 bucket cors list imgbase
   # Error: The CORS configuration does not exist. [code: 10059]
   ```
   → CORS ポリシーが未設定 ❌

2. **フロー確認**:
   ```
   ブラウザ (https://admin.be2nd.com)
     ↓ PUT <signed-url>
   R2 Bucket
     ← CORS チェック: Origin が許可リストにあるか？
     ← 許可リストが存在しない → ブロック
   ```

3. **Cloudflare Dashboard 確認**:
   - R2 → imgbase bucket → Settings → CORS Policy
   - 空欄（未設定）

### 根本原因

R2バケットに CORS ポリシーが設定されていないため、ブラウザからの直接アップロードがブロックされる。

### 解決策

**Cloudflare Dashboard で CORS ポリシー設定**:

1. R2 Dashboard を開く:
   ```
   https://dash.cloudflare.com/.../r2/default/buckets/imgbase
   ```

2. **Settings** タブ → **CORS Policy** セクション

3. JSON エディタに以下を貼り付け:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://admin.be2nd.com"
       ],
       "AllowedMethods": [
         "GET",
         "PUT",
         "HEAD"
       ],
       "AllowedHeaders": [
         "content-type",
         "x-amz-meta-original-filename",
         "x-amz-date"
       ],
       "ExposeHeaders": [
         "etag"
       ],
       "MaxAgeSeconds": 86400
     },
     {
       "AllowedOrigins": [
         "http://localhost:3000"
       ],
       "AllowedMethods": [
         "GET",
         "PUT",
         "HEAD"
       ],
       "AllowedHeaders": [
         "content-type",
         "x-amz-meta-original-filename",
         "x-amz-date"
       ],
       "ExposeHeaders": [
         "etag"
       ],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. **Save** をクリック

**重要ポイント**:
- フィールド名は **大文字始まり** (`AllowedOrigins`, `AllowedMethods`, etc.)
- Origin は **末尾スラッシュなし** (`https://admin.be2nd.com` ✅, `https://admin.be2nd.com/` ❌)
- 本番と開発環境の両方を定義

### 検証

```bash
# CORS設定確認
npx wrangler r2 bucket cors list imgbase
# → JSON出力、2つのルールが表示される

# ブラウザでアップロードテスト
# DevTools → Network タブ → R2へのPUTリクエスト確認
# Response Headers:
#   Access-Control-Allow-Origin: https://admin.be2nd.com
#   Access-Control-Expose-Headers: etag
```

**成功例**:
```
アップロード完了: c54d0c76-8c5e-495d-acbb-fc9b68b2aa46/original/PXL_20250623_011922083.jpg
```

---

## 問題4: プロキシアップロードで Worker 例外エラー

### 症状

```
Error 1101: Worker threw exception
```

プロキシアップロードを試行すると、Worker APIで例外が発生。

### 調査プロセス

1. **Pages Function コード確認**:
   ```javascript
   // /functions/api/uploads/proxy/index.js (初期版)
   export async function onRequestPost(context) {
     const { request, env } = context;
     const formData = await request.formData();  // ← これが問題

     const response = await fetch(env.IMGBASE_UPLOAD_PROXY_URL, {
       method: 'POST',
       body: formData,  // FormDataを転送
     });
   }
   ```

2. **フロントエンド送信形式確認**:
   ```javascript
   // admin/src/app/page.tsx
   await fetch('/api/uploads/proxy', {
     method: 'POST',
     headers: {
       'Content-Type': file.type,
       'X-Filename': file.name,
     },
     body: file,  // File オブジェクト（バイナリデータ）
   });
   ```
   → FormData ではなく、バイナリデータ + ヘッダー形式 ❌

3. **Worker API 期待形式確認**:
   ```typescript
   // worker/src/index.ts
   router.post("/upload/proxy", withAuth(async (request, env) => {
     const contentType = request.headers.get("content-type");
     const fileName = request.headers.get("x-filename");
     const fileBuffer = await request.arrayBuffer();  // ArrayBuffer期待
     ...
   }));
   ```

### 根本原因

Pages Function が `request.formData()` でデータを取得しているが、実際のリクエストは:
- **送信形式**: Binary data + Headers (`Content-Type`, `X-Filename`)
- **期待形式**: ArrayBuffer + Headers

FormData に変換しようとして失敗していた。

### 解決策

**Pages Function を ArrayBuffer + Headers に修正**:

```javascript
export async function onRequestPost(context) {
  const { request, env } = context;

  // ヘッダーから情報取得
  const contentType = request.headers.get('content-type');
  const fileName = request.headers.get('x-filename');

  if (!contentType || !fileName) {
    return new Response(
      JSON.stringify({ error: 'Missing content-type or x-filename header' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // バイナリデータを ArrayBuffer として取得
  const fileData = await request.arrayBuffer();

  const authHeader = buildBasicAuthHeader(
    env.ADMIN_BASIC_AUTH_USER,
    env.ADMIN_BASIC_AUTH_PASS
  );

  // Worker API に転送（ヘッダー + バイナリデータ）
  const response = await fetch(env.IMGBASE_UPLOAD_PROXY_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': contentType,
      'X-Filename': fileName,
    },
    body: fileData,  // ArrayBuffer をそのまま転送
  });

  if (!response.ok) {
    const body = await response.text();
    return new Response(
      JSON.stringify({ error: 'UpstreamError', status: response.status, body }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const json = await response.json();
  return new Response(JSON.stringify(json), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildBasicAuthHeader(user, password) {
  const token = btoa(`${user}:${password}`);
  return `Basic ${token}`;
}
```

**変更ポイント**:
- ❌ `await request.formData()` → ✅ `await request.arrayBuffer()`
- ✅ ヘッダー検証追加（`content-type`, `x-filename`）
- ✅ Basic認証ヘッダー追加
- ✅ エラーハンドリング強化

### 検証

```bash
# 管理UIから6MBの画像をプロキシアップロード
# → 成功

# API確認
curl -s https://admin.be2nd.com/api/images | jq '.[] | select(.id=="44983f30-7eea-4a58-b6c3-c13920180447")'
{
  "id": "44983f30-7eea-4a58-b6c3-c13920180447",
  "status": "stored",
  "hash": "00e15a6ef94e5ac8cf67fb6cdb25398cf98d31cce0f5f8a49d0a3e7d7ab2b9cf",
  "size": 6209535,
  "content_type": "image/jpeg",
  "original_filename": "PXL_20250623_011924136.jpg",
  ...
}
```

**成功例**:
```
プロキシアップロード
アップロード完了: 44983f30-7eea-4a58-b6c3-c13920180447/original/PXL_20250623_011924136.jpg (6209535 bytes)
```

---

## 解決プロセスのタイムライン

| 時刻 | イベント | 結果 |
|------|---------|------|
| 10:00 | Pages Functions 404エラー報告 | 問題発覚 |
| 10:15 | デプロイログ確認 | Functions がアップロードされていない |
| 10:30 | Functions をルートに移動 | ✅ Functions 認識 |
| 10:45 | 環境変数エンドポイント誤り発見 | 502エラー |
| 11:00 | `IMGBASE_UPLOAD_URL` 修正 | ✅ 署名付きURL取得成功 |
| 11:15 | 署名付きURLアップロード失敗 | CORS エラー |
| 11:30 | R2 CORS ポリシー未設定確認 | 根本原因特定 |
| 11:45 | Dashboard で CORS 設定 | ✅ 署名付きURLアップロード成功 |
| 12:00 | プロキシアップロード失敗 | Error 1101 |
| 12:15 | Pages Function FormData誤り発見 | 根本原因特定 |
| 12:30 | ArrayBuffer + Headers に修正 | ✅ プロキシアップロード成功 |
| 12:45 | 両方式で実画像テスト | **完全解決** |

---

## 学んだこと

### 1. Cloudflare Pages Functions の配置ルール

- ✅ `/functions/` （リポジトリルート）に配置
- ❌ `admin/functions/` などサブディレクトリは無視される
- Advanced Mode は自動で有効化される

### 2. R2 CORS ポリシーの設定方法

- Dashboard の JSON エディタが最も確実
- Wrangler CLI は JSON フォーマットエラーが起きやすい
- フィールド名は **大文字始まり** (`AllowedOrigins`, NOT `allowedOrigins`)
- Origin は **末尾スラッシュなし**

### 3. Pages Functions のデータ転送

- FormData ではなく ArrayBuffer + Headers が正しい
- `request.arrayBuffer()` でバイナリデータ取得
- ヘッダー検証必須（`content-type`, `x-filename`）

### 4. 環境変数の重要性

- エンドポイントは `/upload/sign` であって `/upload` ではない
- 環境変数ミスは 502 エラーとして現れる
- CSV テンプレートとドキュメントの両方を更新

### 5. 2つのアップロード方式の使い分け

- **署名付きURL**: 高速・大容量・人間ユーザー向け
- **プロキシ**: 検証・AI処理・LLM/MCP統合向け
- 両方を残して、用途に応じて使い分ける

---

## 関連ドキュメント

- [アップロード戦略](../architecture/upload-strategies.md) - 2つの方式の詳細比較
- [R2 CORS設定](../setup/r2-cors-configuration.md) - JSON設定の詳細
- [環境変数一覧](../cloudflare-environment-variables.md) - すべての必須環境変数
- [Pages Functions 502エラー](./pages-functions-502-error.md) - 環境変数トラブルシューティング

---

## 次のステップ

1. ✅ **両方のアップロード方式が動作中**
2. 🔄 **pendingレコードのクリーンアップ** - 失敗したアップロードの削除
3. 🔄 **画像配信のテスト** - `/i/:uid/:size` エンドポイントの検証
4. 📋 **将来**: AI処理の追加（NSFW検出、自動タグ付け、OCR）

---

**最終更新**: 2025-10-06
**検証済み**: 両方式で 6MB+ 実画像アップロード成功
