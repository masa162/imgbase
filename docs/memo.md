# imgbase 開発メモ

## 開発ステップ（v1.0）
### 進捗サマリ（2025-10-05）
- [x] Step 1: プロジェクト初期化 — ディレクトリ構成・CI雛形・環境変数テンプレ整備済み
- [x] Step 2: インフラ準備 — Wrangler 設定・Cloudflare アカウント ID 連携、Secrets投入スクリプト整備（本番リソース作成はこれから）
- [x] Step 3: データモデル整備 — `db/schema.sql` と初回マイグレーション反映、テストで検証済み
- [x] Step 4: 管理UI（Next.js） — アップロード＋完了通知＋画像ライブラリ一覧/検索の MVP 実装
- [x] Step 5: 画像配信 Worker — 派生生成パイプライン（R2キャッシュ書き戻し）と統合テスト整備、Image Resizing 実呼び出しは今後
- [x] **Step 6: 統合テストと運用準備** — 完了
  - [x] 統合テスト手順書 ([docs/integration-test.md](./integration-test.md))
  - [x] 自動統合テストスクリプト ([scripts/integration-test.mjs](../scripts/integration-test.mjs))
  - [x] 性能測定ガイド ([docs/performance-testing.md](./performance-testing.md))
  - [x] ベンチマークスクリプト ([scripts/benchmark.mjs](../scripts/benchmark.mjs))
  - [x] 実インフラでの統合テスト実施 ✅ 10/10成功
  - [x] 性能測定とベースライン記録 ✅ 平均241ms、p95 320ms
  - [x] 運用手順の最終確認 ✅ [確認レポート](./operations-verification-2025-10-05.md)
- [x] **Step 7: リリースと改善ロードマップ** — 準備完了
  - [x] DNS切替計画 ([docs/dns-migration-plan.md](./dns-migration-plan.md))
  - [x] Phase2機能のIssue化準備 ([docs/phase2-issues.md](./phase2-issues.md))
  - [ ] 管理UIのデプロイ (Cloudflare Pages)
  - [ ] DNS切替の実施 (img.be2nd.com, admin.be2nd.com)
  - [ ] 本番監視の開始


***
当初の予定
1. プロジェクト初期化
   - リポジトリ構成を要件通りに整備（admin/、worker/、db/、docs/）
   - Wrangler CLI と Cloudflare アカウント設定、環境変数・シークレット管理方針を決定
   - D1/R2 の命名規則、ブランチ戦略、開発フロー（issue/PR）を整理
2. インフラ準備
   - Cloudflare 上で R2 バケット・D1 データベースを作成し接続情報を確認
   - Pages/Workers のプロジェクトを作成し、GitHub 連携とデプロイフローを構築
   - Basic 認証の仕組み（Workers KV など）と `.env` 管理を準備
3. データモデル整備
   - `db/schema.sql` に images / albums / tags / image_tags テーブル定義を実装
   - マイグレーションとシード手順を作成し、ローカル／D1 双方で検証
   - EXIF 保持ポリシーに沿ったカラム設計とバリデーションを実装
4. 管理UI（Next.js）実装
   - アップロード画面とドラッグ&ドロップ UI、署名付き PUT のフローを構築
   - ファイル一覧・検索（タグ/日付/サイズ）とサムネイル表示を実装
   - 認証、レスポンシブ対応、エラーハンドリング、基本E2Eテストを整備
5. 画像配信 Worker 実装
   - `/i/{uid}/{width}x{height}.{format}` エンドポイントと R2 連携を実装
   - Cloudflare Image Resizing 設定、キャッシュ制御ヘッダー、フォーマット変換を確認
   - エラーハンドリング、ログ出力、将来拡張用の API 設計を反映
6. 統合テストと運用準備
   - 管理UI→R2→D1→Worker の一連のフローで統合テストを実施
     - **自動統合テスト:** `node scripts/integration-test.mjs` でアップロード〜配信までを自動検証
     - **手動テスト:** 管理UI経由での動作確認、ブラウザ・デバイス互換性チェック
     - **エラーケース:** 認証失敗、無効なデータ、存在しない画像IDなどの異常系テスト
   - バックアップ手順（`wrangler d1 export`、R2 同期）と監視（`wrangler tail`）を検証
   - パフォーマンス測定（CDN キャッシュ前提）とコスト試算を記録
     - **ベンチマーク:** `node scripts/benchmark.mjs` でレスポンスタイム・キャッシュヒット率を測定
     - **Cloudflare Analytics:** ダッシュボードで実トラフィックのパフォーマンス監視
     - **負荷テスト:** Apache Bench/wrk で同時アクセス性能を検証
7. リリースと改善ロードマップ
   - DNS 統合（img/admin/api.be2nd.com）と HTTPS 設定、ドメインルールの最終確認
   - 運用ドキュメントとトラブルシュートメモを作成、更新フローを確立
   - Phase 2 以降（EXIF 自動解析、AI 連携等）のタスクを backlog 化




