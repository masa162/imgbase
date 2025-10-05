# imgbase リリースチェックリスト

## 1. DNS / SSL
- [ ] Cloudflare DNS で `img.be2nd.com`, `admin.be2nd.com`, `api.be2nd.com` を Worker / Pages に割り当て
- [ ] HTTPS 有効化 (`Full` 以上) と HSTS 設定を確認
- [ ] 必要に応じて Cloudflare Access や IP 制限の検討メモを更新

## 2. アプリケーションデプロイ
- [ ] GitHub main ブランチが CI 通過済み
- [ ] `npm run cf:build` の成果物を Cloudflare Pages へデプロイ
- [ ] `npm run deploy` で Worker をリリースし、`wrangler tail` で初期アクセスを確認
- [ ] `/healthz` と 代表的な画像取得（例: `/i/<id>/1200x675.jpg`）で 200 が返ること

## 3. データ・ストレージ
- [ ] D1 マイグレーションが適用済み (`wrangler d1 migrations list` で未適用がないこと)
- [ ] R2 バケットに初期画像・サンプルデータが配置済み
- [ ] `scripts/backup-d1.sh` / `scripts/sync-r2.sh` 実行ログを保存（最終バックアップ日を記録）

## 4. 運用体制
- [ ] `docs/operations.md` の手順を共有し、オンコール担当者が確認
- [ ] Cloudflare Analytics の閲覧権限を関係者に付与
- [ ] コスト試算（R2 ストレージ量 / Worker リクエスト数）を Notion 等に記録

## 5. Phase 2 以降のバックログ
- [ ] EXIF 自動解析・タグ生成の Worker キュー案を Issue 化
- [ ] 類似画像検索（Embedding + D1 Index）の技術調査タスクを追加
- [ ] 公開 API (api.be2nd.com) のルーティング案をドキュメント化

## 6. リリース後フォロー
- [ ] 初週のアクセスログをレビューし、キャッシュヒット率を記録
- [ ] 主要端末（Mac/Windows/スマホ）で管理UIの動作を確認
- [ ] 改善点・不具合を GitHub Issues に起票
