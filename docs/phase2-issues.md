# imgbase Phase 2 機能リスト（Issue化用）

**作成日:** 2025-10-05
**対象:** v2.0以降の機能拡張

このドキュメントは、Phase 2以降の機能をGitHub Issueとして起票するためのテンプレートです。

---

## Issue #1: Cloudflare Image Resizing の実装

### Priority: High
### Labels: `enhancement`, `performance`, `phase-2`

### 概要
現在、画像配信時に実際のリサイズ処理が行われておらず、オリジナル画像がそのまま返されています。Cloudflare Image Resizing APIを統合し、適切なサイズの派生画像を生成します。

### 背景
- 現状のベンチマークで、すべてのサイズが50.02 KBと同一
- レスポンシブ対応やバンド幅削減のため、適切なリサイズが必要
- Cloudflareの組み込み機能を活用することで高速化が期待できる

### 実装内容

#### 1. worker/src/index.ts の `resizeImage` 関数を実装
```typescript
async function resizeImage(
  buffer: ArrayBuffer,
  { width, height, format }: { width: number; height: number; format: string }
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  // Cloudflare Image Resizing API の統合
  // または sharp/wasm-imagemagick等のライブラリ検討
}
```

#### 2. テストケース追加
- 異なるサイズでファイルサイズが異なることを確認
- フォーマット変換（JPEG → WebP）の動作確認
- 性能測定（リサイズ時のCPU時間）

#### 3. ドキュメント更新
- [performance-testing.md](./performance-testing.md) のベンチマーク再実行
- 新しいベースラインを記録

### 受け入れ基準
- [ ] 1200x675.jpg が元画像より小さくなる
- [ ] WebPフォーマットがJPEGより小さくなる
- [ ] 統合テストが全て成功
- [ ] p95レスポンスタイムが500ms以内を維持

### 参考資料
- [Cloudflare Image Resizing](https://developers.cloudflare.com/images/)
- [sharp (Node.js)](https://sharp.pixelplumbing.com/)

---

## Issue #2: クリップボードからの画像アップロード機能

### Priority: Medium
### Labels: `enhancement`, `ui/ux`, `phase-2`

### 概要
管理UIで、クリップボードにコピーした画像を直接ペースト（Ctrl+V / Cmd+V）してアップロードできる機能を実装します。

### 背景
- スクリーンショット等を素早くアップロードしたい
- ドラッグ&ドロップよりも直感的
- チャットアプリ等で一般的なUXパターン

### 実装内容

#### 1. admin/ の アップロードコンポーネントに paste イベントハンドラを追加

```typescript
const handlePaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        await uploadFile(file);
      }
    }
  }
};

useEffect(() => {
  document.addEventListener('paste', handlePaste);
  return () => {
    document.removeEventListener('paste', handlePaste);
  };
}, []);
```

#### 2. UI フィードバック
- ペースト時に「画像を検出しました」等のトースト通知
- アップロード進捗表示

#### 3. テストケース
- 手動テスト: スクリーンショットをペーストしてアップロード成功
- E2Eテスト（オプション）: Playwright等でクリップボードイベントをシミュレート

### 受け入れ基準
- [ ] Ctrl+V (Cmd+V) で画像がアップロードされる
- [ ] 複数画像の同時ペースト対応
- [ ] テキスト等の非画像データは無視される
- [ ] ユーザーにフィードバック（通知/進捗）が表示される

### 参考資料
- [MDN: ClipboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent)
- [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)

---

## Issue #3: EXIF自動解析パイプライン

### Priority: Medium
### Labels: `enhancement`, `automation`, `phase-2`

### 概要
アップロードされた画像から自動的にEXIF情報（撮影日時、カメラ機種、位置情報等）を抽出し、D1データベースに保存します。

### 背景
- 撮影日時でのソート・検索を実現
- カメラ機種でのフィルタリング
- 将来の位置情報ベース検索の基盤

### 実装内容

#### 1. EXIF解析ライブラリの選定
- [exif-js](https://github.com/exif-js/exif-js)
- [exifreader](https://github.com/mattiasw/ExifReader)
- Workers環境で動作するものを検証

#### 2. Worker での非同期処理
- アップロード完了時に Cloudflare Queue にメッセージを送信
- Queue Consumer Worker で EXIF 解析
- D1 の `exif_json` カラムに JSON 形式で保存

#### 3. 管理UIでの表示
- 画像詳細画面でEXIF情報を表示
- 撮影日時、カメラ機種、ISO、シャッタースピード等

### 技術設計

```
[アップロード完了]
  ↓
[Worker: /upload/complete]
  ↓ Queueに送信
[Queue: exif-processing]
  ↓
[Consumer Worker]
  - R2から画像取得
  - EXIF解析
  - D1に保存
```

### 受け入れ基準
- [ ] JPEG画像のEXIF情報がD1に保存される
- [ ] 撮影日時が `taken_at` カラムに設定される
- [ ] 管理UIで EXIF 情報が表示される
- [ ] 処理失敗時のリトライロジックが実装されている

### 参考資料
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [ExifReader](https://github.com/mattiasw/ExifReader)

---

## Issue #4: タグ管理機能の実装

### Priority: Low
### Labels: `enhancement`, `feature`, `phase-2`

### 概要
画像に対してタグを付与し、タグベースでの検索・フィルタリングを可能にします。

### 背景
- 現在のDBスキーマには `tags`, `image_tags` テーブルが定義済み
- フォルダ分けではなくタグベースで柔軟に分類したい
- 将来のAI自動タグ付けの基盤

### 実装内容

#### 1. 管理UI - タグ追加/削除
- 画像詳細画面でタグ入力フィールド
- オートコンプリート（既存タグから候補表示）
- タグのクリックで検索

#### 2. Worker API
- `POST /images/:id/tags` - タグ追加
- `DELETE /images/:id/tags/:tagId` - タグ削除
- `GET /tags` - 全タグ一覧

#### 3. 検索クエリ拡張
- `GET /images?tags=風景,夕日` - タグでフィルタ
- AND/OR検索の実装検討

### 受け入れ基準
- [ ] 画像にタグを追加できる
- [ ] タグで画像を検索できる
- [ ] タグの削除ができる
- [ ] 未使用タグの自動削除（オプション）

---

## Issue #5: 類似画像検索（Vectorize連携）

### Priority: Low
### Labels: `enhancement`, `ai`, `phase-3`

### 概要
Cloudflare Vectorize を利用し、画像の特徴ベクトルから類似画像を検索する機能を実装します。

### 背景
- 重複画像の検出
- 「この画像に似た画像」の提案
- コンテンツベースの画像検索

### 実装内容

#### 1. 画像Embedding生成
- CLIP等の事前学習モデルでEmbedding生成
- Cloudflare AI Workers または 外部API利用

#### 2. Vectorize への保存
- アップロード時にEmbeddingを生成
- Vectorizeインデックスに追加

#### 3. 類似検索API
- `GET /images/:id/similar` - 類似画像を取得
- コサイン類似度でランキング

### 受け入れ基準
- [ ] 画像のEmbeddingが生成される
- [ ] Vectorize に保存される
- [ ] 類似画像検索APIが動作する
- [ ] Top 10の類似画像が返される

### 参考資料
- [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)
- [Cloudflare AI](https://developers.cloudflare.com/workers-ai/)

---

## Issue #6: 公開API (api.be2nd.com) の実装

### Priority: Low
### Labels: `enhancement`, `api`, `phase-2`

### 概要
JSON APIを公開し、外部サービスや自動化スクリプトから画像管理を可能にします。

### 背景
- ブログ投稿時の自動画像選択
- バッチ処理でのアップロード
- サードパーティ連携

### 実装内容

#### 1. 新しいWorkerプロジェクト
- `imgbase-api` プロジェクト作成
- OpenAPI仕様の定義

#### 2. 認証
- API Key認証
- Rate Limiting（Cloudflare Rate Limiting利用）

#### 3. エンドポイント
- `GET /v1/images` - 画像一覧
- `POST /v1/images` - アップロード（署名付きURL発行）
- `GET /v1/images/:id` - 画像詳細
- `DELETE /v1/images/:id` - 画像削除

### 受け入れ基準
- [ ] API Key認証が機能する
- [ ] レート制限が適用される
- [ ] OpenAPI仕様書が公開される
- [ ] 統合テストが成功する

---

## Issue #7: アルバム機能の実装

### Priority: Low
### Labels: `enhancement`, `feature`, `phase-2`

### 概要
複数の画像をグループ化して「アルバム」として管理する機能を実装します。

### 背景
- 現在のDBスキーマには `albums` テーブルが定義済み
- イベントやプロジェクト単位で画像を整理したい
- ブログ記事へのアルバム埋め込み

### 実装内容

#### 1. 管理UI - アルバム管理
- アルバム一覧画面
- アルバム作成/編集/削除
- 画像のアルバムへの追加/削除

#### 2. Worker API
- `GET /albums` - アルバム一覧
- `POST /albums` - アルバム作成
- `GET /albums/:id/images` - アルバム内の画像
- `POST /albums/:id/images` - 画像をアルバムに追加

#### 3. カバー画像の設定
- アルバムのカバー画像（`cover_image_id`）を設定

### 受け入れ基準
- [ ] アルバムを作成できる
- [ ] 画像をアルバムに追加できる
- [ ] アルバム一覧が表示される
- [ ] カバー画像が設定できる

---

## Issue #8: バッチ削除機能

### Priority: Low
### Labels: `enhancement`, `ui/ux`, `phase-2`

### 概要
管理UIで複数の画像を選択して一括削除できる機能を実装します。

### 実装内容

#### 1. UI
- チェックボックスで複数選択
- 「選択した画像を削除」ボタン
- 削除確認ダイアログ

#### 2. Worker API
- `DELETE /images/batch` - 複数削除
- D1トランザクション処理
- R2オブジェクトの削除

### 受け入れ基準
- [ ] 複数画像を選択できる
- [ ] 一括削除が成功する
- [ ] D1とR2の両方から削除される
- [ ] エラー時のロールバック

---

## Issue化の優先順位

### High Priority（v2.0）
1. **#1: Cloudflare Image Resizing** - 性能・UXに直結
2. **#2: クリップボード画像アップロード** - UX改善

### Medium Priority（v2.1）
3. **#3: EXIF自動解析** - 検索機能の基盤
4. **#4: タグ管理** - 分類・検索の強化
5. **#6: 公開API** - 自動化・連携

### Low Priority（v2.2以降）
6. **#5: 類似画像検索** - 高度な機能
7. **#7: アルバム機能** - グループ化
8. **#8: バッチ削除** - 運用効率化

---

## Issue作成コマンド

```bash
# GitHub CLIを使用してIssue作成
gh issue create \
  --title "Cloudflare Image Resizing の実装" \
  --label "enhancement,performance,phase-2" \
  --body-file .github/issue-templates/phase2-01-image-resizing.md

# または手動でGitHub UIから作成
```

---

## 次のステップ

1. 各Issueをコピーして GitHub Issues に起票
2. マイルストーン `v2.0`, `v2.1` 等を作成
3. プロジェクトボードで進捗管理
4. 優先度の高いものから実装開始
