# R2 CORS Configuration

**作成日**: 2025-10-06
**目的**: 管理画面から署名付きURLでR2に直接アップロードするためのCORS設定

---

## 問題

署名付きURLアップロードで "Failed to fetch" エラーが発生：
```
ブラウザ (admin.be2nd.com) → R2署名付きURL (PUT)
❌ CORS error: No 'Access-Control-Allow-Origin' header
```

---

## 原因

R2バケット `imgbase` にCORS設定が適用されていない：
```bash
$ npx wrangler r2 bucket cors list imgbase
Error: The CORS configuration does not exist. [code: 10059]
```

---

## 解決方法

### Option A: Cloudflare Dashboard - JSON直接編集（推奨）

1. **R2ダッシュボードを開く**
   - https://dash.cloudflare.com/c677241d7d66ff80103bab9f142128ab/r2/default/buckets/imgbase

2. **Settings** タブ → **CORS Policy** セクション

3. JSON編集エリアに以下をコピー＆ペースト：

   **推奨設定（本番 + 開発環境）**:
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

### JSONフィールドの説明

| フィールド | 説明 | 推奨値 |
|-----------|------|--------|
| `AllowedOrigins` | 許可するオリジン（ドメイン）<br>⚠️ 末尾スラッシュなし | `"https://admin.be2nd.com"` |
| `AllowedMethods` | 許可するHTTPメソッド | `["GET", "PUT", "HEAD"]` |
| `AllowedHeaders` | クライアントが送信できるヘッダー<br>`["*"]` で全て許可も可能 | 具体的に列挙推奨 |
| `ExposeHeaders` | ブラウザがアクセスできるレスポンスヘッダー | `["etag"]` |
| `MaxAgeSeconds` | ブラウザのキャッシュ時間（秒） | `86400` (24時間) |

### Option B: Wrangler CLI

**注意**: JSONフォーマットが厳密なため、Dashboardの方が確実です。

```bash
# JSONファイルを作成
cat > r2-cors.json <<'EOF'
{
  "rules": [
    {
      "allowedOrigins": ["https://admin.be2nd.com"],
      "allowedMethods": ["PUT", "GET", "HEAD"],
      "allowedHeaders": ["*"],
      "exposeHeaders": ["etag"],
      "maxAgeSeconds": 86400
    }
  ]
}
EOF

# CORS設定を適用
cd worker
npx wrangler r2 bucket cors set imgbase --file ../r2-cors.json
```

---

## 確認方法

### 1. CORS設定が適用されているか確認

```bash
cd worker
npx wrangler r2 bucket cors list imgbase
```

期待される出力:
```json
{
  "rules": [
    {
      "allowedOrigins": ["https://admin.be2nd.com"],
      "allowedMethods": ["PUT", "GET", "HEAD"],
      ...
    }
  ]
}
```

### 2. 管理画面でアップロードテスト

1. https://admin.be2nd.com/ を開く
2. **アップロード** セクション
3. **ファイルを選択** → 画像を選択
4. アップロード成功を確認

期待される結果:
- ✅ "アップロード完了: <object-key>" メッセージ
- ✅ ライブラリに画像が表示される

### 3. ブラウザDevToolsで確認

1. ブラウザのDevTools (F12) → **Network** タブ
2. アップロード実行
3. R2署名付きURLへのPUTリクエストを確認

期待される Response Headers:
```
Access-Control-Allow-Origin: https://admin.be2nd.com
Access-Control-Expose-Headers: etag
```

---

## トラブルシューティング

### Still getting CORS errors after configuration

**チェック項目**:
1. ブラウザのキャッシュをクリア (Ctrl+Shift+Del)
2. CORS設定のOriginが完全一致しているか確認
   - ❌ `https://admin.be2nd.com/` (末尾スラッシュ)
   - ✅ `https://admin.be2nd.com` (スラッシュなし)
3. HTTPSで接続しているか確認 (HTTPは不可)

### Wrangler CLI でエラーが出る場合

エラー:
```
The JSON you provided was not well formed. [code: 10040]
```

対処法:
- Cloudflare Dashboardから設定する
- JSONフォーマットを確認 (カンマ、括弧、引用符)
- 最新のwranglerにアップデート

---

## 関連ドキュメント

- [Cloudflare R2 CORS Documentation](https://developers.cloudflare.com/r2/buckets/cors/)
- [R2 API: CORS Policy](https://developers.cloudflare.com/api/operations/r2-put-bucket-cors-policy)
- [imgbase Integration Test](../archive/verification/integration-test.md)

---

## セキュリティ考慮事項

**現在の設定**:
- ✅ Origin制限あり: `https://admin.be2nd.com` のみ許可
- ✅ Method制限あり: PUT, GET, HEAD のみ
- ⚠️ Headers: `*` (全て許可) - 本番環境では具体的に指定推奨

**推奨される本番設定**:
```json
{
  "allowedOrigins": ["https://admin.be2nd.com"],
  "allowedMethods": ["PUT", "GET", "HEAD"],
  "allowedHeaders": [
    "content-type",
    "x-amz-meta-original-filename",
    "x-amz-date"
  ],
  "exposeHeaders": ["etag"],
  "maxAgeSeconds": 86400
}
```

---

**最終更新**: 2025-10-06
