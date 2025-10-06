# imgbase 画像リサイズ機能 実装方針書

**作成日**: 2025-10-06
**バージョン**: 1.0
**ステータス**: 決定

---

## 1. 技術選定結果

### 1.1 調査したライブラリ

| ライブラリ | 対応状況 | WebP品質 | リサイズ | 判定 |
|-----------|---------|----------|----------|------|
| **sharp-wasm** | ❌ 非対応 | - | - | 不可 |
| **@cf-wasm/photon** | ✅ 対応 | ❌ 不可 | ✅ 可能 | 条件付き |
| **@jsquash/webp** | ✅ 対応 | ✅ 可能 | ❌ 不可 | 条件付き |
| **@jsquash/resize** | ✅ 対応 | - | ✅ 可能 | - |

### 1.2 調査結果詳細

#### sharp-wasm
- **結論**: Cloudflare Workers非対応
- **理由**: マルチスレッディング未サポート
- **出典**: https://github.com/lovell/sharp/issues/2863

#### @cf-wasm/photon
- **機能**: リサイズ + WebP変換
- **WebP品質**: デフォルト値のみ（カスタマイズ不可）
- **リサイズ**: `resize()` 関数あり
- **出典**: https://www.npmjs.com/package/@cf-wasm/photon

**コード例**:
```typescript
import { PhotonImage, resize } from "@cf-wasm/photon";

const inputImage = PhotonImage.new_from_byteslice(inputBytes);
const outputImage = resize(inputImage, width, height, SamplingFilter.Nearest);
const outputBytes = outputImage.get_bytes_webp(); // 品質設定不可
```

#### @jsquash/webp
- **機能**: WebP エンコード・デコード
- **WebP品質**: `quality: 0-100` で設定可能
- **リサイズ**: **非対応**（別ライブラリ必要）
- **出典**: https://www.npmjs.com/package/@jsquash/webp

**コード例**:
```typescript
import { encode } from "@jsquash/webp";

const webpData = await encode(imageData, { quality: 85 });
```

#### @jsquash/resize
- **機能**: 画像リサイズ
- **WebP変換**: **非対応**（別ライブラリ必要）
- **出典**: https://www.npmjs.com/package/@jsquash/resize

---

## 2. 採用技術の決定

### 2.1 最終決定

**組み合わせ**: `@jsquash/resize` + `@jsquash/webp`

**理由**:
1. ✅ WebP品質を80-85%に設定可能
2. ✅ リサイズ機能も利用可能
3. ✅ Cloudflare Workers完全対応
4. ✅ 要件定義書の仕様を完全に満たす

### 2.2 実装パターン

```typescript
import { decode, encode } from "@jsquash/webp";
import { resize } from "@jsquash/resize";

// 1. 画像をデコード（PNG/JPEG → ImageData）
const imageData = await decode(inputBytes);

// 2. リサイズ（長辺500px、アスペクト比保持）
const { width, height } = calculateSize(imageData.width, imageData.height, 500);
const resizedData = await resize(imageData, { width, height });

// 3. WebPエンコード（品質85%）
const webpBytes = await encode(resizedData, { quality: 85 });
```

---

## 3. 実装詳細

### 3.1 パッケージインストール

```bash
cd worker
npm install @jsquash/webp @jsquash/resize
```

### 3.2 Wrangler設定（wrangler.toml）

Cloudflare WorkersでWasmを使用する場合、追加設定が必要：

```toml
[build]
command = "npm run build"

[build.upload]
format = "modules"
main = "./dist/index.js"

[[build.upload.rules]]
type = "CompiledWasm"
globs = ["**/*.wasm"]
fallthrough = true
```

### 3.3 画像処理関数の実装

**ファイル**: `worker/src/image-processor.ts`（新規作成）

```typescript
import { decode as decodeWebP, encode as encodeWebP } from "@jsquash/webp";
import { decode as decodePNG } from "@jsquash/png";
import { decode as decodeJPEG } from "@jsquash/jpeg";
import { resize } from "@jsquash/resize";

export interface ProcessImageOptions {
  maxDimension: number;  // 500
  webpQuality: number;   // 80-85
  preserveAlpha: boolean; // true
}

export async function processImage(
  inputBytes: ArrayBuffer,
  mimeType: string,
  options: ProcessImageOptions
): Promise<{ bytes: ArrayBuffer; width: number; height: number }> {

  // 1. デコード（フォーマット判定）
  let imageData: ImageData;

  if (mimeType === "image/png") {
    imageData = await decodePNG(inputBytes);
  } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    imageData = await decodeJPEG(inputBytes);
  } else if (mimeType === "image/webp") {
    imageData = await decodeWebP(inputBytes);
  } else {
    throw new Error(`Unsupported format: ${mimeType}`);
  }

  // 2. サイズ計算（アスペクト比保持、拡大なし）
  const { width, height } = calculateTargetSize(
    imageData.width,
    imageData.height,
    options.maxDimension
  );

  // 3. リサイズ（元サイズと同じなら省略）
  let processedData = imageData;
  if (width !== imageData.width || height !== imageData.height) {
    processedData = await resize(imageData, { width, height });
  }

  // 4. WebPエンコード
  const webpBytes = await encodeWebP(processedData, {
    quality: options.webpQuality,
  });

  return {
    bytes: webpBytes,
    width,
    height,
  };
}

function calculateTargetSize(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {

  // 既に小さい場合は拡大しない
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  // 長辺を基準にリサイズ
  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth > originalHeight) {
    // 横長
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    // 縦長
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}
```

### 3.4 Worker API エンドポイント修正

**ファイル**: `worker/src/index.ts`

#### 既存の `/upload/proxy` を修正（通常アップロード）

```typescript
import { processImage } from "./image-processor";

router.post(
  "/upload/proxy",
  withAuth(async (request, env) => {
    const contentType = request.headers.get("content-type");
    const fileName = request.headers.get("x-filename");

    if (!contentType || !fileName) {
      return Response.json(
        { error: "Missing content-type or x-filename header" },
        { status: 400 }
      );
    }

    const fileBuffer = await request.arrayBuffer();
    await ensureSchema(env);

    const imageId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      // 画像処理（リサイズ + WebP変換）
      const { bytes: processedBytes, width, height } = await processImage(
        fileBuffer,
        contentType,
        {
          maxDimension: 500,
          webpQuality: 85,
          preserveAlpha: true,
        }
      );

      // WebP形式で保存
      const webpFileName = fileName.replace(/\.(png|jpe?g)$/i, "") + ".webp";
      const objectKey = `${imageId}/processed/${webpFileName}`;

      await env.IMGBASE_BUCKET.put(objectKey, processedBytes, {
        httpMetadata: {
          contentType: "image/webp",
        },
      });

      // SHA-256ハッシュ計算
      const hashBuffer = await crypto.subtle.digest("SHA-256", processedBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // D1にメタデータ登録
      await env.IMGBASE_DB.prepare(
        `INSERT INTO images (id, bucket_key, original_filename, mime, bytes, width, height, hash_sha256, status, processing_mode, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      )
        .bind(
          imageId,
          objectKey,
          fileName, // 元のファイル名を保持
          "image/webp",
          processedBytes.byteLength,
          width,
          height,
          hash,
          "stored",
          "processed", // 新規カラム
          now,
          now
        )
        .run();

      return Response.json({
        imageId,
        objectKey,
        hash,
        width,
        height,
        originalSize: fileBuffer.byteLength,
        processedSize: processedBytes.byteLength,
        compressionRatio: (
          (1 - processedBytes.byteLength / fileBuffer.byteLength) *
          100
        ).toFixed(2),
      });
    } catch (error) {
      console.error("Image processing error:", error);
      return Response.json(
        { error: "ImageProcessingFailed", message: String(error) },
        { status: 500 }
      );
    }
  })
);
```

#### 新規 `/upload/original` エンドポイント（オリジナル保存）

```typescript
router.post(
  "/upload/original",
  withAuth(async (request, env) => {
    const contentType = request.headers.get("content-type");
    const fileName = request.headers.get("x-filename");

    if (!contentType || !fileName) {
      return Response.json(
        { error: "Missing content-type or x-filename header" },
        { status: 400 }
      );
    }

    const fileBuffer = await request.arrayBuffer();
    await ensureSchema(env);

    const imageId = crypto.randomUUID();
    const objectKey = `${imageId}/original/${fileName}`;
    const now = new Date().toISOString();

    try {
      // R2に保存（無加工）
      await env.IMGBASE_BUCKET.put(objectKey, fileBuffer, {
        httpMetadata: {
          contentType,
        },
      });

      // SHA-256ハッシュ計算
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // D1にメタデータ登録
      await env.IMGBASE_DB.prepare(
        `INSERT INTO images (id, bucket_key, original_filename, mime, bytes, hash_sha256, status, processing_mode, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
      )
        .bind(
          imageId,
          objectKey,
          fileName,
          contentType,
          fileBuffer.byteLength,
          hash,
          "stored",
          "original", // 新規カラム
          now,
          now
        )
        .run();

      return Response.json({
        imageId,
        objectKey,
        hash,
        size: fileBuffer.byteLength,
        mode: "original",
      });
    } catch (error) {
      console.error("Upload error:", error);
      return Response.json(
        { error: "UploadFailed", message: String(error) },
        { status: 500 }
      );
    }
  })
);
```

### 3.5 D1スキーマ更新

**マイグレーションSQL**:

```sql
-- processing_mode カラムの追加
ALTER TABLE images ADD COLUMN processing_mode TEXT DEFAULT 'original';

-- 既存レコードをすべて 'original' に設定（既にデフォルト値で対応）

-- インデックス追加（検索高速化）
CREATE INDEX IF NOT EXISTS idx_images_processing_mode ON images(processing_mode);
```

---

## 4. Pages Function 実装

### 4.1 新規エンドポイント作成

**ファイル**: `/functions/api/uploads/original/index.js`（新規作成）

```javascript
export async function onRequestPost(context) {
  const { request, env } = context;

  const contentType = request.headers.get('content-type');
  const fileName = request.headers.get('x-filename');

  if (!contentType || !fileName) {
    return new Response(
      JSON.stringify({ error: 'Missing content-type or x-filename header' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const fileData = await request.arrayBuffer();

  const authHeader = buildBasicAuthHeader(
    env.ADMIN_BASIC_AUTH_USER,
    env.ADMIN_BASIC_AUTH_PASS
  );

  // Worker API の /upload/original に転送
  const response = await fetch(`${env.IMGBASE_WORKER_URL}/upload/original`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': contentType,
      'X-Filename': fileName,
    },
    body: fileData,
  });

  if (!response.ok) {
    const body = await response.text();
    return new Response(
      JSON.stringify({
        error: 'UpstreamError',
        status: response.status,
        body,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
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

---

## 5. 制約事項と注意点

### 5.1 Cloudflare Workers の制限

| 項目 | 制限 | 対策 |
|------|------|------|
| CPU時間 | 50ms（無料）、30秒（有料） | 最大50MB制限で対応 |
| メモリ | 128MB | 画像サイズチェック |
| バンドルサイズ | 1MB（圧縮後） | Wasmバイナリ最適化 |

### 5.2 パッケージサイズ

- `@jsquash/webp`: ~200KB (gzip)
- `@jsquash/resize`: ~100KB (gzip)
- `@jsquash/png`: ~50KB (gzip)
- `@jsquash/jpeg`: ~50KB (gzip)

**合計**: ~400KB（1MB制限に収まる）

### 5.3 処理時間見積もり

| 画像サイズ | 処理時間（予測） |
|-----------|----------------|
| 100KB | ~200ms |
| 1MB | ~500ms |
| 6MB | ~1500ms |
| 50MB | ~5000ms |

**無料プランの50ms制限では不足** → 有料プラン（Workers Paid）が必要

---

## 6. コスト試算

### 6.1 Worker コスト

**Workers Paid プラン**: $5/月（基本料金）

| 項目 | 単価 | 想定使用量 | 月額 |
|------|------|-----------|------|
| CPU時間 | $0.02/百万GB-s | 1秒/画像 x 100画像 | ~$0.000002 |
| リクエスト | $0.15/百万リクエスト | 100リクエスト | ~$0.000015 |

**合計**: $5.00 + α（ほぼ基本料金のみ）

### 6.2 R2 ストレージコスト

**削減効果**:
- 元画像: 6MB → WebP: 50KB（~98%削減）
- 月間100画像アップロード: 600MB → 5MB

**月額コスト**: 5MB x $0.015/GB = **$0.000075**（ほぼ無料）

---

## 7. まとめ

### 7.1 採用技術

- ✅ `@jsquash/resize` + `@jsquash/webp`
- ✅ WebP品質: 85%
- ✅ 長辺500px リサイズ
- ✅ アスペクト比保持
- ✅ 透明度保持

### 7.2 実装タスク

1. ✅ 要件定義書作成
2. ✅ 技術選定完了
3. ⏳ パッケージインストール
4. ⏳ 画像処理関数実装
5. ⏳ Worker API修正
6. ⏳ Pages Function実装
7. ⏳ D1スキーマ更新
8. ⏳ UI更新
9. ⏳ テスト・デプロイ

### 7.3 注意事項

**重要**: Cloudflare Workers **有料プラン**（$5/月）が必要
- 理由: 画像処理で50ms（無料プラン）を超える
- 対策: 事前に有料プラン契約を確認

---

**最終更新**: 2025-10-06
**承認**: 技術選定完了、実装開始可能
