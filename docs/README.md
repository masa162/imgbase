# imgbase ドキュメント

**imgbase** は Cloudflare フルスタック（R2 + D1 + Workers + Pages）による個人フォトギャラリー・画像配信基盤です。

## 📚 コアドキュメント

### 📘 基本計画
- **[要件定義書v1.md](要件定義書v1.md)** - プロジェクト全体の要件定義・アーキテクチャ

### 📝 開発・運用
- **[memo.md](memo.md)** - 開発状況・完了事項のまとめ
- **[operations.md](operations.md)** - 日常運用手順（デプロイ・バックアップ等）
- **[release-checklist.md](release-checklist.md)** - リリース前チェックリスト

### ⚙️ 環境設定
- **[environment-variables.md](environment-variables.md)** - 環境変数設定ガイド

---

## 🗂️ アーカイブ

過去の作業ログ・完了済みドキュメントは `archive/` 配下に保管されています。

```
archive/
├── setup/           # セットアップ手順（完了済み）
├── verification/    # 検証・テストログ
└── logs/           # 代行ツールログ
```

---

## 🚀 クイックスタート

### 環境構築
```bash
# Worker
cd worker
npm install
npx wrangler dev

# Admin UI
cd admin
npm install
npm run dev
```

### デプロイ
```bash
# Worker
cd worker
npm run deploy

# Admin UI (GitHub Actions経由)
git push origin main
```

詳細は [operations.md](operations.md) を参照してください。

---

## 🔗 主要URL

| サービス | URL | 説明 |
|---------|-----|------|
| 画像配信 | https://img.be2nd.com | Cloudflare Worker + R2 |
| 管理UI | https://admin.be2nd.com | Cloudflare Pages (Next.js) |
| Worker (開発) | https://imgbase-worker.belong2jazz.workers.dev | テスト環境 |

---

## 📋 現在のステータス

**Phase 1**: MVP構築 ✅ 完了
- Worker API（アップロード・配信）
- 管理UI（Next.js）
- D1 + R2 統合
- Basic認証
- CI/CD（GitHub Actions）

**Phase 2**: 今後の拡張
- Cloudflare Image Resizing 実装
- EXIF自動解析
- タグ管理強化

詳細は [memo.md](memo.md) を参照してください。

---

**Last Updated:** 2025-10-06
