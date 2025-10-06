# imgbase 画像処理ワークフロー

**最終更新**: 2025-10-06
**ステータス**: 実装完了

---

## 概要

imgbase では、**クライアントサイドで画像処理を完結**させる方針を採用しています。これにより、サーバー側のコストをゼロに抑えつつ、高品質な画像配信を実現しています。

---

## ワークフロー

### 1. ローカル変換（クライアント）

**場所**: `admin/src/app/converter/`

**処理内容**:
1. ユーザーが PNG/JPEG 画像をアップロード
2. ブラウザ上で Canvas API を使用して処理:
   - リサイズ: 長辺を **800px** に（アスペクト比保持）
   - フォーマット変換: WebP
   - 品質設定: **92%**（高品質・低ファイルサイズのバランス）
3. 処理後の画像をダウンロードまたは直接アップロード

**技術スタック**:
- Canvas API（ブラウザ標準）
- `createImageBitmap()` による高速処理
- サーバー側の処理不要（完全無料）

**設定値**:
```typescript
// admin/src/lib/imageConverter.ts
export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  maxDimension: 800,  // 長辺
  webpQuality: 92     // 品質
};
```

**備考**: 当初は 500px/85% を想定していましたが、画質テストの結果、800px/92% が最適と判断しました。

---

### 2. アップロード（Pages Function → Worker API）

**エンドポイント**: `POST /api/uploads/proxy`

**処理内容**:
1. Pages Function (`admin/functions/api/uploads/proxy.ts`) がリクエストを受信
2. Worker API (`POST /upload/proxy`) にプロキシ
3. Worker が R2 に直接アップロード
4. D1 にメタデータを保存

**R2 オブジェクトキー構造**:
```
{imageId}/original/{filename}
```

**例**:
```
44983f30-7eea-4a58-b6c3-c13920180447/original/photo.webp
```

---

### 3. 配信（R2 カスタムドメイン）

**URL 形式**:
```
https://img.be2nd.com/{imageId}/original/{filename}
```

**特徴**:
- バリアント生成なし（既にローカルで最適化済み）
- R2 の直接配信（低コスト・高速）
- Cloudflare CDN によるキャッシュ

---

## 廃止された機能

### `/i/:uid/:size` エンドポイント

**理由**: バリアント生成機能は不要（ローカルで処理済み）

**対応**:
- エンドポイントは `410 Gone` を返却
- 既存のバリアント（800x600.jpg, 400x300.webp など）は削除

**コード**:
```typescript
// worker/src/index.ts
router.get("/i/:uid/:size", async () => {
  return new Response("Variant generation is disabled. All images are pre-processed locally.", { status: 410 });
});
```

---

## メリット

### コスト
- ✅ **完全無料**: サーバー側の画像処理なし
- ✅ **ストレージ削減**: 元画像を保存しない（処理済みのみ）
- ✅ **転送量削減**: 最適化済み画像のみ配信

### パフォーマンス
- ✅ **即時処理**: ブラウザで完結（待ち時間なし）
- ✅ **並列処理**: 複数画像を同時変換可能
- ✅ **プライバシー**: 画像がサーバーに生データで送信されない

### 運用
- ✅ **シンプル**: バリアント管理不要
- ✅ **柔軟性**: ローカルで品質調整可能
- ✅ **拡張性**: 必要に応じて処理ロジックを変更

---

## 技術的詳細

### Canvas API によるリサイズ

```typescript
async function loadImageSource(file: File): Promise<ImageSourcePayload> {
  // ImageBitmap API を優先使用（高速）
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close?.()
    };
  }

  // フォールバック: HTMLImageElement
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.src = objectUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl)
  };
}
```

### WebP エンコード

```typescript
async function renderToWebP(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  ctx.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode WebP"));
      },
      "image/webp",
      quality / 100
    );
  });
}
```

---

## 既存データの扱い

### 既存画像（8枚）
- **方針**: そのまま残す
- **理由**: 遡及処理のコストが高い

### 無駄なバリアント
- **削除対象**:
  ```
  44983f30-7eea-4a58-b6c3-c13920180447/800x600.jpg    (6.21 MB)
  44983f30-7eea-4a58-b6c3-c13920180447/400x300.webp   (6.21 MB)
  ```
- **削除方法**: Cloudflare Dashboard または Wrangler CLI

---

## 将来の拡張

### 複数サイズ対応
- 現在: 800px のみ
- 将来: UI でサイズ選択（500px / 800px / 1200px）

### バッチ処理
- 複数画像の一括変換
- ZIP ダウンロード機能（実装済み）

### AI 最適化
- 画像内容に応じた品質調整
- 顔検出による自動クロップ

---

## 参考資料

- [R2 Storage Structure](./r2-storage-structure.md)
- [Local Image Converter Requirements](../requirements/local-image-converter.md)
- [MDN: Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN: ImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap)

---

**最終更新**: 2025-10-06
**次回レビュー**: 必要に応じて
