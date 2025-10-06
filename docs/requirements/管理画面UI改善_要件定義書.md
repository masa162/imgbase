📘 管理画面UI改善 要件定義書

  作成日: 2025-10-06バージョン: 2.0ステータス: 実装待ち

  ---
  1. 概要

  1.1 目的

  管理画面（https://admin.be2nd.com/）のライブラリ機能を改善し、短縮URL活用を効率化する
  。

  1.2 優先度

  | 機能              | 優先度    | 所要時間  |
  |-----------------|--------|-------|
  | URL列表示 + コピーボタン | ⭐⭐⭐ 必須 | 1時間   |
  | 登録日時ソート機能       | ⭐⭐ 重要  | 0.5時間 |
  | 日付範囲フィルタ        | ⭐ 将来   | 1時間   |
  | チェックボックス + 一括削除 | ⭐ 将来   | 1.5時間 |
  | ギャラリー表示         | ⭐ 将来   | 1.5時間 |
  | トグルボタン          | ⭐ 将来   | 0.5時間 |

  ---
  2. 機能要件（優先順）

  2.1 URL列表示 + コピーボタン（必須）

  2.1.1 UI配置

  現在のテーブル:
  ファイル名    サイズ   ステータス  ハッシュ  登録日時

  変更後:
  ファイル名    URL              サイズ   ステータス  ハッシュ  登録日時
              [📋 コピー]

  2.1.2 URL表示形式

  表示URL:
  https://img.be2nd.com/c9d0e1f2

  フォールバック（short_idがNULLの場合）:
  （短縮URLなし）

  2.1.3 コピーボタン仕様

  アイコン: 📋 クリップボード動作: クリック → URL
  をクリップボードにコピーフィードバック: ボタンアイコンが 📋 → ✓
  に変化（0.5秒後に戻る）

  実装例:
  async function copyToClipboard(url: string, buttonId: string) {
    try {
      await navigator.clipboard.writeText(url);

      const button = document.getElementById(buttonId);
      if (button) {
        button.textContent = "✓";
        setTimeout(() => {
          button.textContent = "📋";
        }, 500);
      }
    } catch (error) {
      // フォールバック（古いブラウザ対応）
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
  }

  ---
  2.2 登録日時ソート機能（重要）

  2.2.1 ソート対象

  - 登録日時のみ（昇順/降順切り替え）
  - デフォルト: 降順（新しい順）

  2.2.2 UI表示

  カラムヘッダー:
  登録日時 ↓    ← クリッカブル

  クリック時:
  登録日時 ↑    ← 昇順（古い順）

  2.2.3 実装

  フロントエンド（クライアントサイド）:
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortDirection === 'desc' ? bTime - aTime : aTime - bTime;
    });
  }, [images, sortDirection]);

  ---
  2.3 日付範囲フィルタ（将来実装）

  2.3.1 UI配置

  テーブルの上部:
  日付範囲: [2025/01/01] 〜 [2025/10/06] [適用]

  2.3.2 仕様

  - <input type="date"> を2つ（開始日、終了日）
  - 「適用」ボタンクリックでフィルタ実行
  - 空欄の場合は制限なし

  2.3.3 実装

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const filteredImages = useMemo(() => {
    return images.filter(img => {
      const createdAt = new Date(img.created_at);
      if (dateFrom && createdAt < new Date(dateFrom)) return false;
      if (dateTo && createdAt > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [images, dateFrom, dateTo]);

  ---
  2.4 チェックボックス + 一括削除（将来実装）

  2.4.1 UI配置

  テーブル:
  [☑] ファイル名    URL    サイズ  ...
  [☑] photo1.webp  ...    5.9 MB
  [ ] photo2.jpg   ...    6.2 MB

  上部に削除ボタン:
  [2件選択中] [選択した画像を削除]

  2.4.2 削除フロー

  1. ユーザーがチェックボックスで複数選択
  2. 「選択した画像を削除」ボタンクリック
  3. 確認ダイアログ表示: 「2件の画像を削除しますか？」
  4. OK → Worker API DELETE /images/batch 呼び出し
  5. D1とR2から削除

  2.4.3 Worker API実装（新規）

  router.delete(
    "/images/batch",
    withAuth(async (request, env) => {
      const { imageIds } = await request.json();

      for (const imageId of imageIds) {
        const record = await env.IMGBASE_DB.prepare(
          "SELECT bucket_key FROM images WHERE id = ?1"
        ).bind(imageId).first<{ bucket_key: string }>();

        if (record) {
          await env.IMGBASE_BUCKET.delete(record.bucket_key);
          await env.IMGBASE_DB.prepare("DELETE FROM images WHERE id = ?1")
            .bind(imageId).run();
        }
      }

      return Response.json({ deleted: imageIds.length });
    })
  );

  ---
  2.5 ギャラリー表示（将来実装）

  2.5.1 レイアウト

  グリッド表示:
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;

  カードデザイン:
  ┌────────────────────┐
  │   [サムネイル]      │
  │      250x250       │
  ├────────────────────┤
  │ photo.jpg          │
  │ 2025/10/06         │
  │ [📋 コピー]        │
  └────────────────────┘

  2.5.2 サムネイル生成

  Canvas API（クライアントサイド）:
  async function generateThumbnail(imageUrl: string): Promise<string> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    await new Promise(resolve => img.onload = resolve);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const size = 250;
    const scale = Math.min(size / img.width, size / img.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.8);
  }

  2.5.3 URLコピー

  動作: 画像クリック → URLをクリップボードにコピーフィードバック:
  画像の上に緑のチェックマーク表示（1秒後に消える）

  function handleImageClick(url: string, imageId: string) {
    navigator.clipboard.writeText(url);

    // 緑のチェックマーク表示
    const overlay = document.createElement("div");
    overlay.className = "copy-success-overlay";
    overlay.innerHTML = "✓";
    document.getElementById(imageId)?.appendChild(overlay);

    setTimeout(() => overlay.remove(), 1000);
  }

  ---
  2.6 表示切り替えトグルボタン（将来実装）

  2.6.1 UI配置

  テーブルの上部:
  [🗂️ リスト] [🖼️ ギャラリー]    検索: [_____]

  2.6.2 実装

  type ViewMode = 'list' | 'gallery';
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  return (
    <>
      <div className="view-mode-toggle">
        <button onClick={() => setViewMode('list')}>
          🗂️ リスト
        </button>
        <button onClick={() => setViewMode('gallery')}>
          🖼️ ギャラリー
        </button>
      </div>

      {viewMode === 'list' ? <ImageTable /> : <ImageGallery />}
    </>
  );

  ---
  3. 実装ファイル

  3.1 変更ファイル（優先順）

  Phase 1（必須）:
  1. admin/src/components/ImageLibrary.tsx - URL列追加
  2. admin/src/components/CopyButton.tsx（新規） - コピーボタン
  3. admin/src/components/ImageLibrary.tsx - ソート機能

  Phase 2（将来）:
  4. admin/src/components/DateRangeFilter.tsx（新規） - 日付フィルタ
  5. admin/src/components/ImageLibrary.tsx - チェックボックス
  6. worker/src/index.ts - DELETE /images/batch エンドポイント
  7. admin/src/components/ImageGallery.tsx（新規） - ギャラリー表示
  8. admin/src/components/ViewModeToggle.tsx（新規） - 切り替えボタン

  ---
  4. API仕様

  4.1 GET /images（変更済み）

  レスポンス:
  {
    "items": [
      {
        "id": "uuid",
        "original_filename": "photo.jpg",
        "mime": "image/jpeg",
        "bytes": 6209535,
        "status": "stored",
        "hash_sha256": "abc123...",
        "short_id": "c9d0e1f2",  // ← 追加済み
        "created_at": "2025-10-06T16:01:00Z",
        "updated_at": "2025-10-06T16:01:00Z"
      }
    ],
    "nextCursor": "2025-10-05T12:00:00Z"
  }

  4.2 DELETE /images/batch（新規・将来実装）

  リクエスト:
  {
    "imageIds": ["uuid1", "uuid2"]
  }

  レスポンス:
  {
    "deleted": 2
  }

  ---
  5. 実装スケジュール

  | Phase   | 内容            | 所要時間  | 実装タイミング |
  |---------|---------------|-------|---------|
  | Phase 1 | URL列 + コピーボタン | 1時間   | 次回セッション |
  | Phase 1 | ソート機能         | 0.5時間 | 次回セッション |
  | Phase 2 | 日付フィルタ        | 1時間   | 必要時     |
  | Phase 2 | 一括削除          | 1.5時間 | 必要時     |
  | Phase 3 | ギャラリー表示       | 1.5時間 | 必要時     |
  | Phase 3 | トグルボタン        | 0.5時間 | 必要時     |

  ---
  6. カスタムドメイン設定手順（重要）

  現在は imgbase-worker.belong2jazz.workers.dev でアクセスできますが、本来の目的は
  img.be2nd.com で配信することです。

  6.1 設定手順（Cloudflare Dashboard）

  1. Workers & Pages → imgbase-worker を開く
  2. Settings → Triggers → Custom Domains
  3. Add Custom Domain をクリック
  4. ドメイン入力: img.be2nd.com
  5. Add Custom Domain をクリック
  6. DNS設定が自動で追加される（CNAMEレコード）

  6.2 DNS伝播待ち

  - 通常: 5分〜1時間
  - 最大: 24時間

  6.3 動作確認

  curl -I https://img.be2nd.com/c9d0e1f2

  ✅ HTTP 200 が返れば成功

  ---
  7. 承認

  本要件定義書に基づき、次回セッションで Phase 1（URL列 + コピーボタン + ソート）
  を実装します。

  ---
  最終更新: 2025-10-06次回作業: 管理画面UI実装（Phase 1）