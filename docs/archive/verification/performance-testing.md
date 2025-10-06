# imgbase 性能測定ガイド

## 概要
このドキュメントは、imgbase の性能（パフォーマンス）を測定・評価するためのガイドラインと手順をまとめています。

## 測定目的
1. **CDNキャッシュヒット率** - Cloudflare経由での配信効率を確認
2. **レスポンスタイム** - 画像配信の速度を測定
3. **同時アクセス性能** - 負荷時の挙動を確認
4. **コスト効率** - R2ストレージとWorkerリクエスト数の最適化

---

## 1. 自動ベンチマークスクリプト

### 1.1 実行方法
```bash
# 環境変数を設定
export IMGBASE_BENCHMARK_URL="https://img.be2nd.com"
export IMGBASE_IMAGE_ID="<テスト用画像ID>"

# ベンチマークスクリプトを実行
node scripts/benchmark.mjs
```

### 1.2 出力結果
- 各サイズ・フォーマットのレスポンスタイム
- キャッシュヒット/ミスの判定
- 統計データ（平均、中央値、最小/最大値）
- CSV形式での詳細レポート（`benchmark-results-{timestamp}.csv`）

---

## 2. Cloudflare Analytics での確認

### 2.1 アクセス方法
1. Cloudflare Dashboard にログイン
2. Workers & Pages > imgbase-worker を選択
3. **Analytics** タブを開く

### 2.2 確認項目

#### キャッシュヒット率
- **Target:** 80%以上（2回目以降のアクセス）
- **確認方法:**
  ```
  Analytics > Requests > Cache Status
  ```
- 初回アクセスは `MISS` または `DYNAMIC` になるのが正常
- 同じURLへの2回目以降は `HIT` になることを確認

#### レスポンスタイム
- **Target:** p50 < 100ms、p95 < 500ms（キャッシュヒット時）
- **確認方法:**
  ```
  Analytics > Performance > Response Time (p50, p95, p99)
  ```

#### エラー率
- **Target:** < 0.1%
- **確認方法:**
  ```
  Analytics > Requests > Status Codes
  ```
- 4xx エラー（特に404）の割合を監視
- 5xx エラーは即座に対応が必要

#### リクエスト数
- **確認方法:**
  ```
  Analytics > Requests > Total Requests
  ```
- 日次・週次のトレンドを確認
- 急激な増加時はコスト影響を評価

---

## 3. コマンドラインツールでの負荷テスト

### 3.1 Apache Bench (ab)

#### インストール
```bash
# macOS
brew install httpd

# Ubuntu/Debian
sudo apt-get install apache2-utils
```

#### 実行例
```bash
# 同時接続10、合計100リクエスト
ab -n 100 -c 10 \
  "https://img.be2nd.com/i/${IMAGE_ID}/1200x675.jpg"
```

#### 期待される結果
- **初回（キャッシュミス時）:**
  - Time per request: 500-1000ms
  - Requests per second: 10-20

- **2回目以降（キャッシュヒット時）:**
  - Time per request: 50-200ms
  - Requests per second: 50-200

### 3.2 wrk（より高負荷テスト）

#### インストール
```bash
# macOS
brew install wrk

# Ubuntu/Debian
sudo apt-get install wrk
```

#### 実行例
```bash
# 10スレッド、100接続、30秒間の負荷テスト
wrk -t10 -c100 -d30s \
  "https://img.be2nd.com/i/${IMAGE_ID}/1200x675.jpg"
```

#### 期待される結果
- **Latency:**
  - 50th percentile: < 100ms
  - 99th percentile: < 500ms
- **Requests/sec:** 1000以上（キャッシュヒット時）

---

## 4. リアルユーザーモニタリング（RUM）

### 4.1 管理UIでのパフォーマンス測定

#### ブラウザ開発者ツールでの確認
1. Chrome DevTools を開く (F12)
2. **Network** タブを選択
3. 画像アップロード・一覧表示を実行

#### 確認項目
- **Time to First Byte (TTFB):** < 200ms
- **画像読み込み時間:** サムネイル < 500ms
- **合計ページロード時間:** < 2秒

### 4.2 Lighthouse スコア

```bash
# Lighthouseでパフォーマンススコアを測定
npx lighthouse https://admin.be2nd.com \
  --only-categories=performance \
  --output=html \
  --output-path=./lighthouse-report.html
```

#### Target スコア
- **Performance:** 90以上
- **Largest Contentful Paint (LCP):** < 2.5s
- **First Input Delay (FID):** < 100ms
- **Cumulative Layout Shift (CLS):** < 0.1

---

## 5. R2 ストレージパフォーマンス

### 5.1 オブジェクト取得速度

```bash
# 特定オブジェクトの取得時間を測定
time curl -o /dev/null -s \
  "https://c677241d7d66ff80103bab9f142128ab.r2.cloudflarestorage.com/imgbase/${OBJECT_KEY}"
```

#### 期待値
- **小さいファイル（< 1MB）:** < 500ms
- **中程度のファイル（1-10MB）:** < 2秒
- **大きいファイル（> 10MB）:** ネットワーク帯域に依存

### 5.2 バケットサイズとコスト

```bash
# R2バケット内のオブジェクト数とサイズを確認
wrangler r2 object list imgbase --limit 1000 | wc -l

# 詳細な統計（AWS CLI使用）
aws s3 ls s3://imgbase --recursive --summarize \
  --endpoint-url https://c677241d7d66ff80103bab9f142128ab.r2.cloudflarestorage.com
```

#### コスト試算
- **R2 ストレージ:** $0.015 / GB / 月
- **Class A Operations (write):** $4.50 / 百万リクエスト
- **Class B Operations (read):** $0.36 / 百万リクエスト
- **Egress:** 無料（Cloudflare経由）

**例:** 10,000枚（各5MB）の場合
- ストレージ: 50GB × $0.015 = $0.75/月
- 書き込み: 10,000 × $4.50/1M = $0.045
- 読み込み: 100,000 × $0.36/1M = $0.036
- **合計:** 約$0.83/月

---

## 6. Worker パフォーマンス

### 6.1 CPU時間の監視

```bash
# Worker のログを監視
./scripts/tail-worker.sh
```

#### 確認項目
- **CPU時間:** < 50ms（派生画像生成含む）
- **メモリ使用量:** < 128MB
- **エラーログ:** なし

### 6.2 コールドスタート時間
- Cloudflare Workers はコールドスタートがほぼゼロ
- 初回リクエストでも数ミリ秒程度で応答

---

## 7. 性能測定の実施スケジュール

### 7.1 リリース前
- [ ] ベンチマークスクリプトを実行し、ベースライン測定
- [ ] 負荷テスト（ab/wrk）で同時アクセス性能を確認
- [ ] Lighthouseスコアを測定

### 7.2 リリース後
- **初週:**
  - 毎日 Cloudflare Analytics でキャッシュヒット率を確認
  - 異常なエラー率やレスポンスタイムがないか監視

- **月次:**
  - ベンチマークスクリプトを再実行し、トレンド分析
  - R2ストレージ使用量とコストを記録
  - パフォーマンス改善の優先順位を検討

### 7.3 大規模アップデート前後
- デプロイ前後でベンチマークを実施
- リグレッションがないか確認

---

## 8. パフォーマンス改善のヒント

### 8.1 キャッシュヒット率の向上
- 適切な `Cache-Control` ヘッダー設定（現在: `max-age=31536000, immutable`）
- 派生画像のプリウォーミング（人気サイズを事前生成）

### 8.2 画像配信の最適化
- WebP/AVIF フォーマットの優先利用
- レスポンシブ画像の適切なサイズ選択
- 画像圧縮率の調整（品質 vs サイズ）

### 8.3 Worker の最適化
- 不要な処理の削減
- D1クエリの最適化（インデックス利用）
- 並列処理の活用

### 8.4 ネットワークの最適化
- Cloudflare の Argo Smart Routing 検討
- HTTP/3 の有効化確認

---

## 9. トラブルシューティング

### 遅いレスポンスタイムの場合
1. **キャッシュヒット率を確認**
   - ヒット率が低い → Cache-Control設定を見直し

2. **Worker CPU時間を確認**
   - 画像生成に時間がかかっている → 最適化検討

3. **R2レイテンシを確認**
   - 特定リージョンで遅い → Cloudflare サポートに相談

### キャッシュヒット率が低い場合
1. URLパラメータの一貫性を確認
2. `Vary` ヘッダーの影響を確認
3. キャッシュ有効期限を確認

---

## 10. 性能測定レポートテンプレート

### 測定日: YYYY-MM-DD
### 測定環境: 本番 / ステージング

#### ベンチマーク結果
| サイズ       | 初回(ms) | 2回目(ms) | キャッシュヒット率 |
|-------------|---------|----------|-----------------|
| 1200x675.jpg |         |          |                 |
| 800x450.jpg  |         |          |                 |
| 400x225.webp |         |          |                 |

#### Cloudflare Analytics
- 総リクエスト数:
- キャッシュヒット率:
- p50 レスポンスタイム:
- p95 レスポンスタイム:
- エラー率:

#### R2 ストレージ
- オブジェクト数:
- 総サイズ:
- 月間コスト試算:

#### 改善提案
1.
2.
3.

---

## 次のステップ

性能測定が完了したら:
1. [integration-test.md](./integration-test.md) で統合テストを実施
2. [release-checklist.md](./release-checklist.md) でリリース準備を確認
3. [operations.md](./operations.md) で定期監視を継続
