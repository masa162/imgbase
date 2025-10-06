# Pages Functions 502エラー トラブルシューティング

**作成日**: 2025-10-06
**問題**: 管理画面でファイルアップロードすると502 Bad Gatewayエラー

---

## 症状

### エラー1: 署名付きURLアップロード
```
署名付きURLの取得に失敗しました (502): Bad gateway
Host: Error
```

### エラー2: プロキシアップロード
```
プロキシアップロードに失敗しました (500): Worker threw exception
Error 1101: Worker threw exception
```

---

## 原因

**Pages Functionsの環境変数設定ミス**

間違った環境変数:
```
IMGBASE_UPLOAD_URL = https://imgbase-worker.belong2jazz.workers.dev/upload
```

Worker API には `/upload` エンドポイントが存在しません:
- ✅ `/upload/sign` (署名付きURL取得)
- ✅ `/upload/proxy` (プロキシアップロード)
- ✅ `/upload/complete` (アップロード完了通知)
- ❌ `/upload` (存在しない → 404)

---

## 解決方法

### 1. Cloudflare Dashboard で環境変数を修正

**URL**: https://dash.cloudflare.com/c677241d7d66ff80103bab9f142128ab/pages/view/imgbase-admin/settings/environment-variables

**手順**:
1. **Production** タブを開く
2. `IMGBASE_UPLOAD_URL` を探す
3. **Edit** をクリック
4. 値を修正:
   ```
   旧: https://imgbase-worker.belong2jazz.workers.dev/upload
   新: https://imgbase-worker.belong2jazz.workers.dev/upload/sign
   ```
5. **Save** をクリック

### 2. 再デプロイ（必要に応じて）

環境変数の変更は、次回デプロイ時に自動適用されます。

すぐに反映したい場合:
- **Deployments** タブ → **Retry deployment**

### 3. 動作確認

管理画面 (https://admin.be2nd.com) で:
1. **署名付きURLアップロード** をテスト
2. **プロキシアップロード** をテスト

期待される結果:
- ✅ ファイル選択 → アップロード成功
- ✅ 画像一覧に表示される

---

## 検証済みの動作

### Worker API の直接テスト（成功）

```bash
# 署名付きURL取得（成功）
curl -X POST -u mn:39 \
  https://imgbase-worker.belong2jazz.workers.dev/upload/sign \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","contentType":"image/jpeg","size":1024}'

# レスポンス: 200 OK
# → 署名付きURLが返される
```

### 統合テスト（9つ全て成功）

```bash
# 環境変数を設定
export IMGBASE_SIGN_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/sign"
export IMGBASE_COMPLETE_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/complete"
export IMGBASE_ADMIN_USER="mn"
export IMGBASE_ADMIN_PASS="39"
export IMGBASE_TEST_FILE="sample.jpg"

# テスト実行
node scripts/integration-test.mjs
```

**結果**: 9つのテスト全て成功 ✅
1. ファイル読み込み
2. 署名付きURL取得
3. R2アップロード
4. アップロード完了通知
5. 画像一覧API確認
6. 画像配信テスト
7. 異なるサイズ・フォーマット配信
8. エラーケーステスト（404）
9. 認証エラーテスト（401）

---

## アーキテクチャ確認

### 正常な動作フロー

```
ブラウザ
  ↓
Pages Functions (/api/uploads)
  ↓ env.IMGBASE_UPLOAD_URL
Worker API (/upload/sign)
  ↓
署名付きURLを返却
  ↓
ブラウザが R2 に直接 PUT
  ↓
Pages Functions (/api/uploads/complete)
  ↓ env.IMGBASE_UPLOAD_COMPLETE_URL
Worker API (/upload/complete)
  ↓
D1 にメタデータ保存
```

### Pages Functions の実装

`/functions/api/uploads/index.js`:
```javascript
export async function onRequestPost(context) {
  const { request, env } = context;

  // env.IMGBASE_UPLOAD_URL を使用
  const response = await fetch(env.IMGBASE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildBasicAuthHeader(
        env.ADMIN_BASIC_AUTH_USER,
        env.ADMIN_BASIC_AUTH_PASS
      ),
    },
    body: JSON.stringify(payload),
  });

  return response;
}
```

**重要**: `env.IMGBASE_UPLOAD_URL` は完全なエンドポイントパスが必要:
- ❌ `.../upload` → Worker で404
- ✅ `.../upload/sign` → 正常動作

---

## 関連ドキュメント

- [環境変数設定ガイド](../cloudflare-environment-variables.md)
- [統合テストガイド](../archive/verification/integration-test.md)
- [Worker API仕様](../../worker/README.md)

---

## 教訓

1. **環境変数は完全なエンドポイントパスを指定する**
   - ベースURLだけでなく、具体的なパス (`/upload/sign`) まで含める

2. **Worker API のエンドポイント一覧を確認する**
   - `worker/src/index.ts` の router 定義を確認

3. **テストスクリプトを活用する**
   - Worker API が正常動作しているか `scripts/integration-test.mjs` で検証

4. **Pages Functions のログを確認する**
   - Cloudflare Dashboard > Workers & Pages > imgbase-admin > Logs

---

**最終更新**: 2025-10-06
