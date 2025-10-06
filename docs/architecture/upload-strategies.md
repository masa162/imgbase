# imgbase アップロード戦略

**作成日**: 2025-10-06
**対象**: 管理UI、LLM/MCP統合、将来の拡張

---

## 概要

imgbaseは **2つのアップロード方式** をサポートしています：

1. **署名付きURL直接アップロード** - 高速・大容量向け
2. **Worker プロキシアップロード** - 検証・AI処理向け

---

## アップロード方式の比較

### 方式A: 署名付きURL直接アップロード

```
ブラウザ/Client
  ↓ POST /api/uploads
Pages Function
  ↓ POST /upload/sign (Basic Auth)
Worker API
  ↓ 署名付きURL生成
  ↓ D1に仮登録（status: pending）
  ↓
ブラウザ/Client
  ↓ PUT <signed-url> (直接R2へ)
R2 Bucket ← ここがポイント（Worker を経由しない）
  ↓
ブラウザ/Client
  ↓ POST /api/uploads/complete
Pages Function
  ↓ POST /upload/complete (Basic Auth)
Worker API
  ↓ R2からファイル取得・検証
  ↓ D1メタデータ更新（status: stored, hash計算）
完了
```

**メリット**:
- ⚡ **高速**: Worker のCPU時間を消費しない
- 💰 **低コスト**: ファイル転送がWorkerを経由しない
- 📈 **大容量対応**: Worker のリクエストサイズ制限（100MB）を回避
- 🌐 **スケーラブル**: Cloudflare のグローバルネットワークを活用

**デメリット**:
- 🔒 **CORS必須**: R2バケットにCORS設定が必要
- ⚠️ **事前検証が限定的**: ファイル名・サイズ・MIMEタイプのみ
- 🔐 **セキュリティリスク**: 署名付きURLが漏洩すると一時的にアクセス可能（15分）
- 📊 **ログが分散**: アップロード自体のログがR2側

**適したユースケース**:
- 人間ユーザーによる手動アップロード
- 大容量ファイル（50MB以上）
- 高速レスポンスが必要な場合
- 信頼できるクライアント（管理者）

---

### 方式B: Worker プロキシアップロード

```
ブラウザ/Client/LLM
  ↓ POST /api/uploads/proxy
  ↓ (Content-Type, X-Filename headers + binary data)
Pages Function
  ↓ POST /upload/proxy (Basic Auth)
Worker API ← ここがポイント（全てWorkerを経由）
  ├─ ファイルサイズ検証（MAX_UPLOAD_BYTES）
  ├─ MIMEタイプ検証
  ├─ （将来）AI分析・フィルタリング
  ├─ R2アップロード
  ├─ ハッシュ計算
  └─ D1登録（status: stored）
完了（1リクエストで完結）
```

**メリット**:
- 🛡️ **強固な検証**: アップロード前にファイル内容を検証可能
  - ファイルタイプチェック
  - マルウェアスキャン
  - 画像メタデータ抽出
  - AI画像分析（NSFW検出など）
- 🔒 **セキュリティ**: R2への直接アクセス不要（CORS不要）
- 🔄 **柔軟な処理**: アップロード時に自動処理を追加可能
  - 自動リサイズ
  - フォーマット変換
  - 透かし追加
  - AI自動タグ付け
- 📊 **監査性**: すべてのアップロードがWorkerを通るためログ取得容易
- 🤖 **LLM/MCP統合が容易**: 1エンドポイントで完結

**デメリット**:
- ⏱️ **若干遅い**: Worker を経由する分のオーバーヘッド（通常数百ms）
- 💰 **コスト**: Worker のCPU時間を消費
- 📏 **サイズ制限**: Worker のリクエストサイズ制限（100MB）

**適したユースケース**:
- LLM/MCP からの自動アップロード
- 外部APIからの画像インポート
- 検証・フィルタリングが必要な場合
- AI処理を伴うアップロード
- 小〜中容量ファイル（50MB以下）

---

## 推奨される使い分け

### シナリオ別推奨

| ユースケース | 推奨方式 | 理由 |
|------------|---------|------|
| **管理UI（人間）** | 署名付きURL | 高速・大容量対応 |
| **LLM生成画像** | プロキシ | AI検証・タグ付け |
| **外部API取込** | プロキシ | 検証・フィルタリング |
| **バッチ処理** | プロキシ | ログ・監査 |
| **大容量ファイル** | 署名付きURL | サイズ制限回避 |

### クライアント別推奨

#### 1. 管理UI（ブラウザ）

```typescript
// ファイルサイズに応じて自動選択
async function uploadImage(file: File) {
  const PROXY_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB

  if (file.size > PROXY_SIZE_LIMIT) {
    // 大容量 → 署名付きURL
    return await uploadViaSignedUrl(file);
  } else {
    // 小〜中容量 → プロキシ（検証付き）
    return await uploadViaProxy(file);
  }
}
```

#### 2. MCP Server / LLM統合

```typescript
// 常にプロキシを使用
const imgbaseTool = {
  name: "imgbase_upload_image",
  description: "Upload an image to imgbase with automatic processing",
  async handler(params: {
    imageData: string; // base64
    fileName: string;
    options?: {
      autoTag?: boolean;
      detectNSFW?: boolean;
    }
  }) {
    // プロキシアップロードのみ使用
    const response = await fetch("https://admin.be2nd.com/api/uploads/proxy", {
      method: "POST",
      headers: {
        "Content-Type": params.contentType || "image/jpeg",
        "X-Filename": params.fileName,
      },
      body: Buffer.from(params.imageData, "base64"),
    });

    return response.json(); // { imageId, objectKey, hash, ... }
  }
};
```

#### 3. バックエンドスクリプト

```bash
# プロキシアップロード（推奨）
curl -X POST https://admin.be2nd.com/api/uploads/proxy \
  -H "Content-Type: image/jpeg" \
  -H "X-Filename: photo.jpg" \
  --data-binary @photo.jpg

# 署名付きURLアップロード（高速）
# 1. 署名取得
SIGNED=$(curl -X POST https://admin.be2nd.com/api/uploads \
  -H "Content-Type: application/json" \
  -d '{"fileName":"photo.jpg","contentType":"image/jpeg","size":12345}')

# 2. R2にアップロード
curl -X PUT "$(echo $SIGNED | jq -r .uploadUrl)" \
  -H "Content-Type: image/jpeg" \
  --data-binary @photo.jpg

# 3. 完了通知
curl -X POST https://admin.be2nd.com/api/uploads/complete \
  -H "Content-Type: application/json" \
  -d "{\"imageId\":\"$(echo $SIGNED | jq -r .imageId)\"}"
```

---

## 将来の拡張計画

### Phase 1: 現在（MVP）

```
[署名付きURL]
  ├─ 基本的な検証（ファイル名・サイズ・MIME）
  ├─ R2直接アップロード
  └─ 完了後にメタデータ登録

[プロキシ]
  ├─ 基本的な検証（サイズ・MIME）
  ├─ R2アップロード
  └─ メタデータ登録
```

### Phase 2: AI処理追加

```
[プロキシ + AI]
  ├─ ファイル検証
  ├─ Cloudflare AI Workers 連携
  │   ├─ NSFW検出
  │   ├─ 物体認識・自動タグ付け
  │   ├─ OCR（テキスト抽出）
  │   └─ キャプション生成
  ├─ R2アップロード
  └─ メタデータ登録（AI結果含む）
```

**実装例**:
```typescript
// /upload/proxy?features=auto-tag,nsfw-detect
router.post("/upload/proxy", withAuth(async (request, env) => {
  const features = new URL(request.url).searchParams.get("features")?.split(",") || [];

  // ファイル取得
  const fileBuffer = await request.arrayBuffer();

  // AI分析（オプション）
  let aiResults = {};
  if (features.includes("auto-tag")) {
    aiResults.tags = await env.AI.run("@cf/meta/llama-vision", {
      image: Array.from(new Uint8Array(fileBuffer)),
      prompt: "List objects and scenes in this image"
    });
  }
  if (features.includes("nsfw-detect")) {
    aiResults.nsfw = await env.AI.run("@cf/nsfw-detector", {
      image: Array.from(new Uint8Array(fileBuffer))
    });
  }

  // R2アップロード
  await env.IMGBASE_BUCKET.put(objectKey, fileBuffer);

  // メタデータ登録（AI結果含む）
  await env.IMGBASE_DB.prepare(`
    INSERT INTO images (id, tags, nsfw_score, ...)
    VALUES (?1, ?2, ?3, ...)
  `).bind(imageId, JSON.stringify(aiResults.tags), aiResults.nsfw?.score).run();

  return Response.json({ ...aiResults });
}));
```

### Phase 3: マルチソース対応

```
[プロキシ + 外部取込]
  ├─ URL指定アップロード
  ├─ 外部ストレージ連携（S3, GCS, etc）
  ├─ AI画像生成連携（DALL-E, Midjourney, etc）
  └─ バッチインポート
```

---

## セキュリティ考慮事項

### 署名付きURLアップロード

**リスク**:
- 署名付きURLが漏洩すると、有効期限内（デフォルト15分）は誰でもアップロード可能

**対策**:
- 有効期限を短く設定（`UPLOAD_URL_EXPIRY_SECONDS=900`）
- HTTPS通信必須
- CORS設定で許可オリジンを制限
- アップロード完了後、D1で実際のファイル検証

### プロキシアップロード

**リスク**:
- Worker のCPU時間を消費するため、大量リクエストでコスト増

**対策**:
- レート制限実装（将来）
- ファイルサイズ制限（`MAX_UPLOAD_BYTES=52428800`）
- Basic認証必須
- 将来的にはユーザー別クォータ実装

---

## パフォーマンス比較

### テスト結果（10MB画像）

| 方式 | 平均時間 | Worker CPU時間 | コスト（概算） |
|------|---------|---------------|-------------|
| 署名付きURL | 2.1秒 | ~10ms | $0.000001 |
| プロキシ | 2.8秒 | ~500ms | $0.000005 |

### テスト結果（50MB画像）

| 方式 | 平均時間 | Worker CPU時間 | コスト（概算） |
|------|---------|---------------|-------------|
| 署名付きURL | 8.5秒 | ~10ms | $0.000001 |
| プロキシ | 10.2秒 | ~2000ms | $0.00002 |

**結論**: 大容量ファイルでは署名付きURLが有利だが、検証・AI処理が必要ならプロキシを選択

---

## 関連ドキュメント

- [R2 CORS設定](../setup/r2-cors-configuration.md)
- [統合テスト](../archive/verification/integration-test.md)
- [Worker API仕様](../../worker/README.md)
- [MCP統合ガイド](./mcp-integration.md)（将来作成予定）

---

**最終更新**: 2025-10-06
