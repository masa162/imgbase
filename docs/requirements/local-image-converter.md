# imgbase ローカル画像変換機能 要件定義書

**作成日**: 2025-10-06
**バージョン**: 1.1
**ステータス**: ✅ 実装完了（品質チューニング済み）

---

## 1. 概要

### 1.1 目的

ブラウザ内で完結するクライアントサイド画像変換機能を実装し、PNG/JPEG画像をWebP形式に変換する。変換後の画像は既存の管理画面から手動アップロードする。

**実装済み設定**:
- **リサイズ**: 長辺 800px（アスペクト比保持）
- **品質**: WebP 92%
- **技術**: Canvas API（jSquash不使用）

> **注**: 当初は 500px/85% を想定していましたが、品質テストの結果、800px/92% が画質とファイルサイズのバランスが最適と判断しました。

### 1.2 背景

- **課題**: Cloudflare Workers有料プラン（$5/月）のランニングコストが高い
- **解決策**: サーバーサイド処理を廃止し、クライアントサイドで変換
- **メリット**: 完全無料、事前確認可能、高速処理

### 1.3 アプローチ

```
[ブラウザ内で完結]
  1. ユーザーが画像を選択（PNG/JPEG）
  2. jSquash で WebP (800px, 92%品質) に変換
  3. プレビュー表示・ダウンロード
  4. 変換済みファイルを管理画面の「オリジナル保存」でアップロード
```

**重要**: すべての処理がブラウザ内で実行され、サーバーに画像データを送信しない

---

## 2. リポジトリ構成の選択

### 2.1 選択肢の比較

| オプション | メリット | デメリット | 推奨度 |
|-----------|---------|-----------|--------|
| **A. 既存プロジェクトに統合** | 一元管理、コード共有 | 管理画面との結合度増加 | ⭐⭐⭐ |
| **B. 別リポジトリ** | 独立性、デプロイ分離 | 管理コスト増加 | ⭐ |
| **C. モノレポ** | 独立性+コード共有 | 構成複雑化 | ⭐⭐ |

### 2.2 推奨: オプションA（既存プロジェクトに統合）

**配置場所**: `admin/src/app/converter/page.tsx`

**理由**:
1. ✅ 管理画面の一機能として自然
2. ✅ 既存のUIコンポーネント・スタイルを再利用
3. ✅ 依存関係の共有（Next.js, React, TypeScript）
4. ✅ デプロイが一緒（https://admin.be2nd.com/converter）
5. ✅ 管理が容易

**ディレクトリ構造**:
```
imgbase/
  admin/
    src/
      app/
        page.tsx              # 既存: メインページ
        converter/            # 新規: 画像変換ページ
          page.tsx
          layout.tsx
      components/
        UploadPanel.tsx       # 既存
        ImageConverter.tsx    # 新規: 変換UI
        ConvertedPreview.tsx  # 新規: プレビュー
      lib/
        imageConverter.ts     # 新規: 変換ロジック
```

**アクセスURL**:
- 管理画面: `https://admin.be2nd.com/`
- 変換ツール: `https://admin.be2nd.com/converter`

---

## 3. 機能要件

### 3.1 画像変換機能

#### 入力仕様

| 項目 | 仕様 |
|------|------|
| 対応形式 | PNG, JPEG (JPG) |
| 最大サイズ | 制限なし（ブラウザメモリ依存） |
| 複数ファイル | 対応（一括変換） |

#### 処理仕様

| 処理 | 仕様 |
|------|------|
| フォーマット変換 | PNG/JPEG → WebP |
| WebP品質 | 92%（固定） |
| リサイズロジック | 長辺を800pxに（アスペクト比保持） |
| 小画像の扱い | 800px以下は拡大しない |
| 透明度 | WebPで保持 |

#### 出力仕様

| 項目 | 仕様 |
|------|------|
| ファイル名 | `{元ファイル名}.webp` |
| ダウンロード | 個別 or 一括ZIP |
| プレビュー | 変換前後の比較表示 |

### 3.2 UI/UX

#### ページレイアウト

```
┌──────────────────────────────────────────┐
│  画像変換ツール                           │
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ ファイルをドラッグ&ドロップ          │ │
│  │ または [ファイルを選択]              │ │
│  └────────────────────────────────────┘ │
│                                          │
│  設定:                                   │
│    ☑ リサイズ: 長辺800px                 │
│    ☑ WebP品質: 92%                      │
│                                          │
│  ┌─ 変換前 ─────┬─ 変換後 ─────────┐  │
│  │ photo.jpg    │ photo.webp         │  │
│  │ 6.2 MB       │ 45.2 KB (-99%)     │  │
│  │ 4624x3472    │ 800x601           │  │
│  │ [プレビュー] │ [プレビュー]       │  │
│  │              │ [ダウンロード]     │  │
│  └──────────────┴────────────────────┘  │
│                                          │
│  [すべてダウンロード (ZIP)]              │
│  [変換済み画像をアップロード]            │
└──────────────────────────────────────────┘
```

#### 操作フロー

1. **ファイル選択**
   - ドラッグ&ドロップ
   - ファイル選択ダイアログ
   - 複数選択可能

2. **自動変換**
   - 選択直後に変換開始
   - プログレスバー表示

3. **プレビュー**
   - 変換前後の画像を並べて表示
   - ファイルサイズ・圧縮率を表示

4. **ダウンロード**
   - 個別ダウンロード
   - 一括ZIP（複数ファイル時）

5. **アップロード連携**
   - 「変換済み画像をアップロード」ボタン
   - 管理画面のアップロード機能を開く

### 3.3 技術仕様

#### 使用ライブラリ

| ライブラリ | 用途 | バージョン |
|-----------|------|-----------|
| `@jsquash/webp` | WebPエンコード・デコード | latest |
| `@jsquash/png` | PNGデコード | latest |
| `@jsquash/jpeg` | JPEGデコード | latest |
| `@jsquash/resize` | 画像リサイズ | latest |
| `browser-image-resizer` | 代替案（オプション） | - |

#### クライアントサイド処理

**すべてブラウザ内で実行**:
- ✅ サーバーにデータ送信なし
- ✅ プライバシー保護
- ✅ オフラインでも動作（初回読み込み後）
- ✅ 高速処理（ローカルCPU使用）

---

## 4. 実装詳細

### 4.1 ディレクトリ構造

```
admin/
  package.json                    # jSquashパッケージ追加
  src/
    app/
      converter/
        page.tsx                   # メインページ
        layout.tsx                 # レイアウト
    components/
      ImageConverter/
        index.tsx                  # 変換UIコンポーネント
        FileDropZone.tsx           # ドロップゾーン
        ConversionCard.tsx         # 変換前後の表示カード
        ProgressBar.tsx            # プログレスバー
    lib/
      imageConverter.ts            # 変換ロジック
      downloadHelper.ts            # ダウンロード・ZIP生成
    types/
      converter.ts                 # 型定義
```

### 4.2 コア機能の実装

#### `lib/imageConverter.ts`

```typescript
import { decode as decodeWebP, encode as encodeWebP } from "@jsquash/webp";
import { decode as decodePNG } from "@jsquash/png";
import { decode as decodeJPEG } from "@jsquash/jpeg";
import { resize } from "@jsquash/resize";

export interface ConversionOptions {
  maxDimension: number;  // 800
  webpQuality: number;   // 85
}

export interface ConversionResult {
  originalFile: File;
  webpBlob: Blob;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
  originalDimensions: { width: number; height: number };
  convertedDimensions: { width: number; height: number };
}

export async function convertToWebP(
  file: File,
  options: ConversionOptions = { maxDimension: 800, webpQuality: 92 }
): Promise<ConversionResult> {

  // 1. ファイルを読み込み
  const arrayBuffer = await file.arrayBuffer();

  // 2. デコード（フォーマット判定）
  let imageData: ImageData;

  if (file.type === "image/png") {
    imageData = await decodePNG(arrayBuffer);
  } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
    imageData = await decodeJPEG(arrayBuffer);
  } else {
    throw new Error(`Unsupported format: ${file.type}`);
  }

  const originalDimensions = {
    width: imageData.width,
    height: imageData.height,
  };

  // 3. サイズ計算
  const { width, height } = calculateTargetSize(
    imageData.width,
    imageData.height,
    options.maxDimension
  );

  // 4. リサイズ
  let processedData = imageData;
  if (width !== imageData.width || height !== imageData.height) {
    processedData = await resize(imageData, { width, height });
  }

  // 5. WebPエンコード
  const webpArrayBuffer = await encodeWebP(processedData, {
    quality: options.webpQuality,
  });

  const webpBlob = new Blob([webpArrayBuffer], { type: "image/webp" });

  return {
    originalFile: file,
    webpBlob,
    originalSize: file.size,
    convertedSize: webpBlob.size,
    compressionRatio: ((1 - webpBlob.size / file.size) * 100),
    originalDimensions,
    convertedDimensions: { width, height },
  };
}

function calculateTargetSize(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {

  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth > originalHeight) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}
```

#### `components/ImageConverter/index.tsx`

```typescript
"use client";

import { useState } from "react";
import { convertToWebP, ConversionResult } from "@/lib/imageConverter";
import FileDropZone from "./FileDropZone";
import ConversionCard from "./ConversionCard";

export default function ImageConverter() {
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    setIsConverting(true);

    const newResults: ConversionResult[] = [];

    for (const file of files) {
      try {
        const result = await convertToWebP(file);
        newResults.push(result);
      } catch (error) {
        console.error(`Failed to convert ${file.name}:`, error);
      }
    }

    setResults([...results, ...newResults]);
    setIsConverting(false);
  };

  const handleDownloadAll = () => {
    // ZIP生成・ダウンロード
    // 実装は lib/downloadHelper.ts
  };

  return (
    <div>
      <h1>画像変換ツール</h1>

      <FileDropZone onFilesSelected={handleFilesSelected} />

      {isConverting && <ProgressBar />}

      <div className="results">
        {results.map((result, index) => (
          <ConversionCard key={index} result={result} />
        ))}
      </div>

      {results.length > 0 && (
        <div className="actions">
          <button onClick={handleDownloadAll}>
            すべてダウンロード (ZIP)
          </button>
          <button onClick={() => window.location.href = "/"}>
            変換済み画像をアップロード
          </button>
        </div>
      )}
    </div>
  );
}
```

### 4.3 パッケージ追加

**ファイル**: `admin/package.json`

```json
{
  "dependencies": {
    "next": "^14.2.3",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@jsquash/webp": "^1.5.0",
    "@jsquash/png": "^1.2.0",
    "@jsquash/jpeg": "^1.3.0",
    "@jsquash/resize": "^1.1.0",
    "jszip": "^3.10.1"
  }
}
```

**インストールコマンド**:
```bash
cd admin
npm install @jsquash/webp @jsquash/png @jsquash/jpeg @jsquash/resize jszip
```

---

## 5. ユーザーフロー

### 5.1 基本的な使用方法

1. `https://admin.be2nd.com/converter` にアクセス
2. PNG/JPEG画像をドラッグ&ドロップ
3. 自動的にWebP変換（ブラウザ内で完結）
4. プレビュー・圧縮率を確認
5. 「すべてダウンロード」でZIPダウンロード
6. 「変換済み画像をアップロード」で管理画面へ
7. 管理画面の「オリジナル保存」でアップロード

### 5.2 複数ファイル処理

```
[ユーザー]
  ├─ 10枚のJPEG画像を選択
  ├─ 一括変換（プログレスバー表示）
  ├─ 結果一覧を確認
  └─ ZIPダウンロード
     → photo1.webp
     → photo2.webp
     ...
     → photo10.webp
```

---

## 6. 非機能要件

### 6.1 パフォーマンス

| 項目 | 目標値 |
|------|--------|
| 変換速度 | 6MB画像を1秒以内 |
| メモリ使用量 | ブラウザの制限内 |
| 同時処理 | 10ファイルまで |

### 6.2 互換性

| 項目 | 対応 |
|------|------|
| ブラウザ | Chrome 90+, Edge 90+, Safari 14+ |
| デバイス | PC, Mac, タブレット |
| オフライン | 初回読み込み後は可能 |

### 6.3 セキュリティ

- ✅ すべての処理がクライアントサイド
- ✅ サーバーに画像データ送信なし
- ✅ プライバシー保護

---

## 7. 制約事項

### 7.1 ブラウザ制限

- メモリ不足の可能性（大量ファイル処理時）
- ブラウザタブを閉じると処理が中断
- Service Worker未使用時はオフライン動作不可

### 7.2 対応フォーマット

- ✅ PNG, JPEG
- ❌ GIF（アニメーションGIFは非対応）
- ❌ SVG（ベクター画像）
- ❌ HEIC（iOS形式、ブラウザ未対応）

---

## 8. 将来の拡張

### 8.1 追加機能候補

- [ ] GIFアニメーション対応
- [ ] 複数サイズ一括生成（100px, 500px, 1000px）
- [ ] カスタム品質設定（スライダー）
- [ ] バッチ処理（フォルダドラッグ&ドロップ）
- [ ] Service Worker（完全オフライン対応）

### 8.2 統合機能

- [ ] 変換後、直接アップロードAPI呼び出し
- [ ] クリップボード連携（Ctrl+V で貼り付け）
- [ ] ブラウザ拡張機能化

---

## 9. コスト

### 9.1 開発コスト

| 項目 | 工数 |
|------|------|
| 変換ロジック実装 | 2時間 |
| UI実装 | 3時間 |
| テスト | 1時間 |
| **合計** | **6時間** |

### 9.2 運用コスト

**完全無料**:
- Cloudflare Pages 無料プラン（既存）
- すべてクライアントサイド処理
- サーバーリソース消費なし

---

## 10. テスト計画

### 10.1 単体テスト

| テストケース | 入力 | 期待結果 |
|-------------|------|----------|
| PNG→WebP | 1000x800 PNG | 800x640 WebP (92%) |
| JPEG→WebP | 4624x3472 JPEG | 800x601 WebP |
| 小画像 | 300x200 JPEG | 300x200 WebP（拡大なし） |
| 透明PNG | PNG (透明あり) | WebP (透明保持) |

### 10.2 統合テスト

| テストケース | 手順 | 期待結果 |
|-------------|------|----------|
| 一括変換 | 10ファイル選択 | 全て変換成功 |
| ZIP生成 | 「すべてダウンロード」 | ZIPダウンロード |
| アップロード連携 | 「変換済み画像をアップロード」 | 管理画面へ遷移 |

---

## 11. まとめ

### 11.1 推奨構成

**リポジトリ**: 既存プロジェクトに統合（`admin/src/app/converter/`）

### 11.2 実装タスク

1. [ ] パッケージインストール
2. [ ] 変換ロジック実装（`lib/imageConverter.ts`）
3. [ ] UIコンポーネント実装
4. [ ] ページ作成（`app/converter/page.tsx`）
5. [ ] テスト
6. [ ] デプロイ

### 11.3 期待される成果

- ✅ **完全無料** でWebP変換機能を提供
- ✅ サーバーコスト **$0**
- ✅ ブラウザ内で高速処理
- ✅ 既存の管理画面と統合

---

**最終更新**: 2025-10-06
**承認**: 要件定義完了、実装開始可能
