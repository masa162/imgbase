# imgbase 統合テストガイド

## 概要
このドキュメントは、imgbase の全コンポーネント（管理UI、Worker、R2、D1）が連携して正しく動作することを確認するための統合テスト手順をまとめています。

## 前提条件
- Cloudflare Workers と Pages がデプロイ済み
- 環境変数・シークレットが設定済み
- テスト用の画像ファイルが用意されている（`sample.jpg` など）

---

## 1. アップロードフロー統合テスト

### 1.1 自動テスト（推奨）
```bash
# 環境変数を設定
export IMGBASE_SIGN_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/sign"
export IMGBASE_COMPLETE_URL="https://imgbase-worker.belong2jazz.workers.dev/upload/complete"
export IMGBASE_ADMIN_USER="<Basic Auth User>"
export IMGBASE_ADMIN_PASS="<Basic Auth Pass>"
export IMGBASE_TEST_FILE="sample.jpg"

# 統合テストスクリプトを実行
node scripts/integration-test.mjs
```

**期待される結果:**
- ✅ 署名付きURL取得成功
- ✅ R2へのアップロード成功
- ✅ 完了通知成功
- ✅ D1にメタデータが記録される
- ✅ 画像が指定URLで取得可能

### 1.2 手動テスト（管理UI経由）
1. **管理UIにアクセス**
   ```
   https://admin.be2nd.com
   ```
   ※ 開発環境の場合: `http://localhost:3000`

2. **Basic認証**
   - ユーザー名・パスワードを入力

3. **ファイルアップロード**
   - ドラッグ&ドロップ または ファイル選択でアップロード
   - プログレスバーの表示確認
   - アップロード完了メッセージの確認

4. **画像一覧の確認**
   - アップロードした画像が一覧に表示される
   - サムネイルが正しく生成・表示される
   - ファイル名、サイズ、日時が正確に表示される

5. **検索機能**
   - ファイル名での検索が機能する
   - ステータスでのフィルタリングが機能する

---

## 2. 画像配信フロー統合テスト

### 2.1 派生サイズ生成テスト
```bash
# アップロード済み画像のIDを取得
IMAGE_ID="<取得したimage-id>"

# 異なるサイズ・フォーマットでリクエスト
curl -I "https://img.be2nd.com/i/${IMAGE_ID}/1200x675.jpg"
curl -I "https://img.be2nd.com/i/${IMAGE_ID}/800x450.jpg"
curl -I "https://img.be2nd.com/i/${IMAGE_ID}/400x225.webp"
```

**期待される結果:**
- 初回リクエスト: HTTP 200、画像が生成される
- 2回目以降: HTTP 200、R2キャッシュから配信（高速）
- Content-Type が正しい（image/jpeg, image/webp）
- Cache-Control ヘッダーが適切に設定されている

### 2.2 エラーケーステスト
```bash
# 存在しないID
curl -I "https://img.be2nd.com/i/invalid-id/1200x675.jpg"
# 期待: HTTP 404

# 無効なサイズ指定
curl -I "https://img.be2nd.com/i/${IMAGE_ID}/invalid-size.jpg"
# 期待: HTTP 400
```

---

## 3. データ整合性テスト

### 3.1 D1データベース検証
```bash
# 最新のアップロード画像を確認
wrangler d1 execute IMGBASE_DB --remote --command \
  "SELECT id, original_filename, mime, bytes, status, hash_sha256, created_at FROM images ORDER BY created_at DESC LIMIT 5"
```

**確認項目:**
- `status` が `stored` になっている
- `hash_sha256` が設定されている
- `bytes` がファイルサイズと一致している
- `mime` が正しいMIMEタイプである

### 3.2 R2ストレージ検証
```bash
# R2バケット内のオブジェクトを確認
wrangler r2 object list imgbase --prefix="<IMAGE_ID>/"
```

**期待される構造:**
```
<IMAGE_ID>/original/sample.jpg
<IMAGE_ID>/1200x675.jpg
<IMAGE_ID>/800x450.jpg
...
```

---

## 4. 認証・セキュリティテスト

### 4.1 Basic認証テスト
```bash
# 認証なし（失敗するべき）
curl -I "https://imgbase-worker.belong2jazz.workers.dev/upload/sign"
# 期待: HTTP 401

# 不正な認証情報（失敗するべき）
curl -I -u "wrong:credentials" "https://imgbase-worker.belong2jazz.workers.dev/upload/sign"
# 期待: HTTP 401

# 正しい認証情報
curl -I -u "${IMGBASE_ADMIN_USER}:${IMGBASE_ADMIN_PASS}" \
  "https://imgbase-worker.belong2jazz.workers.dev/upload/sign"
# 期待: HTTP 405 (Method Not Allowed - POST必須だが認証は通過)
```

### 4.2 ファイルサイズ制限テスト
```bash
# MAX_UPLOAD_BYTES (52428800 = 50MB) を超えるファイル
# 期待: サーバーサイドでリジェクト
```

---

## 5. ブラウザ・デバイス互換性テスト

### 5.1 対応ブラウザ
- [ ] Chrome (最新版)
- [ ] Firefox (最新版)
- [ ] Safari (最新版)
- [ ] Edge (最新版)

### 5.2 対応デバイス
- [ ] デスクトップ (Mac)
- [ ] デスクトップ (Windows)
- [ ] タブレット (iPad)
- [ ] スマートフォン (iOS)
- [ ] スマートフォン (Android)

### 5.3 確認項目
- [ ] ファイルアップロード動作
- [ ] ドラッグ&ドロップ動作
- [ ] レスポンシブレイアウト
- [ ] 画像プレビュー表示
- [ ] 検索フィルター動作

---

## 6. パフォーマンステスト連携

詳細は [performance-testing.md](./performance-testing.md) を参照してください。

```bash
# 性能測定スクリプトの実行
node scripts/benchmark.mjs
```

---

## 7. トラブルシューティング

### アップロードが失敗する場合
1. Worker ログを確認
   ```bash
   ./scripts/tail-worker.sh
   ```
2. R2接続情報を確認
   ```bash
   wrangler r2 bucket list
   ```
3. D1接続を確認
   ```bash
   wrangler d1 list
   ```

### 画像配信が失敗する場合
1. R2にオブジェクトが存在するか確認
2. D1にレコードが存在するか確認
3. Worker の環境変数を確認
   ```bash
   wrangler secret list
   ```

### 認証エラーが発生する場合
1. シークレットが正しく設定されているか確認
   ```bash
   wrangler secret list
   ```
2. 必要に応じて再設定
   ```bash
   ./scripts/set-worker-secrets.sh
   ```

---

## 8. テスト実行記録

### 実行日: YYYY-MM-DD
- テスト実行者:
- テスト環境:
- テスト結果サマリ:
  - [ ] アップロードフロー: ✅ / ❌
  - [ ] 画像配信フロー: ✅ / ❌
  - [ ] データ整合性: ✅ / ❌
  - [ ] 認証・セキュリティ: ✅ / ❌
  - [ ] ブラウザ互換性: ✅ / ❌
- 発見された問題:
  1.
  2.
- 対応状況:
  -

---

## 次のステップ

統合テストが完了したら:
1. [performance-testing.md](./performance-testing.md) で性能測定を実施
2. [release-checklist.md](./release-checklist.md) でリリース準備を確認
3. [operations.md](./operations.md) で運用体制を整備
