#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import process from "node:process";

const env = process.env;
const baseUrl = env.IMGBASE_BENCHMARK_URL || "https://img.be2nd.com";
const imageId = env.IMGBASE_IMAGE_ID;
const iterations = Number.parseInt(env.IMGBASE_BENCHMARK_ITERATIONS ?? "10", 10);
const warmupRuns = Number.parseInt(env.IMGBASE_WARMUP_RUNS ?? "2", 10);

if (!imageId) {
  console.error("エラー: 環境変数 IMGBASE_IMAGE_ID が必要です");
  console.error("使用例:");
  console.error('  export IMGBASE_IMAGE_ID="your-image-id"');
  console.error('  export IMGBASE_BENCHMARK_URL="https://img.be2nd.com"  # オプション');
  console.error("  node scripts/benchmark.mjs");
  process.exit(1);
}

const variants = [
  { size: "1200x675", format: "jpg", label: "Large JPEG" },
  { size: "800x450", format: "jpg", label: "Medium JPEG" },
  { size: "400x225", format: "jpg", label: "Small JPEG" },
  { size: "800x450", format: "webp", label: "Medium WebP" },
  { size: "400x225", format: "webp", label: "Small WebP" }
];

function formatMs(ms) {
  return ms.toFixed(2);
}

function calculateStats(timings) {
  const sorted = [...timings].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)]
  };
}

async function measureRequest(url) {
  const start = performance.now();
  const response = await fetch(url);
  const end = performance.now();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const buffer = await response.arrayBuffer();
  const timing = end - start;
  const size = buffer.byteLength;
  const cacheStatus = response.headers.get("cf-cache-status") || "UNKNOWN";

  return {
    timing,
    size,
    cacheStatus,
    contentType: response.headers.get("content-type")
  };
}

async function benchmarkVariant(variant) {
  const url = `${baseUrl}/i/${imageId}/${variant.size}.${variant.format}`;

  console.log(`\n→ ${variant.label} (${variant.size}.${variant.format})`);
  console.log(`  URL: ${url}`);

  // ウォームアップラン
  console.log(`  ウォームアップ中... (${warmupRuns}回)`);
  for (let i = 0; i < warmupRuns; i++) {
    try {
      await measureRequest(url);
    } catch (error) {
      console.error(`  ⚠️  ウォームアップ失敗: ${error.message}`);
    }
  }

  // 本測定
  console.log(`  測定中... (${iterations}回)`);
  const timings = [];
  const cacheStatuses = [];
  let size = 0;
  let contentType = "";

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await measureRequest(url);
      timings.push(result.timing);
      cacheStatuses.push(result.cacheStatus);
      size = result.size;
      contentType = result.contentType;
      process.stdout.write(".");
    } catch (error) {
      console.error(`\n  ✗ リクエスト失敗: ${error.message}`);
      timings.push(null);
    }
  }
  console.log(); // 改行

  const validTimings = timings.filter(t => t !== null);
  if (validTimings.length === 0) {
    console.error("  ✗ すべてのリクエストが失敗しました");
    return null;
  }

  const stats = calculateStats(validTimings);
  const hitCount = cacheStatuses.filter(s => s === "HIT").length;
  const missCount = cacheStatuses.filter(s => s === "MISS" || s === "DYNAMIC").length;
  const hitRate = (hitCount / cacheStatuses.length) * 100;

  console.log(`  ✓ 完了`);
  console.log(`    ファイルサイズ: ${(size / 1024).toFixed(2)} KB`);
  console.log(`    Content-Type: ${contentType}`);
  console.log(`    最小: ${formatMs(stats.min)} ms`);
  console.log(`    平均: ${formatMs(stats.avg)} ms`);
  console.log(`    中央値: ${formatMs(stats.median)} ms`);
  console.log(`    p95: ${formatMs(stats.p95)} ms`);
  console.log(`    最大: ${formatMs(stats.max)} ms`);
  console.log(`    キャッシュヒット率: ${hitRate.toFixed(1)}% (HIT: ${hitCount}, MISS: ${missCount})`);

  return {
    variant,
    url,
    size,
    contentType,
    stats,
    cacheStatuses,
    hitRate,
    timings: validTimings
  };
}

async function runBenchmark() {
  console.log("=".repeat(60));
  console.log("imgbase パフォーマンスベンチマーク");
  console.log("=".repeat(60));
  console.log(`ベースURL: ${baseUrl}`);
  console.log(`画像ID: ${imageId}`);
  console.log(`測定回数: ${iterations}回 (ウォームアップ: ${warmupRuns}回)`);
  console.log("=".repeat(60));

  const results = [];

  for (const variant of variants) {
    const result = await benchmarkVariant(variant);
    if (result) {
      results.push(result);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("ベンチマーク結果サマリ");
  console.log("=".repeat(60));

  console.log("\n| バリエーション       | サイズ(KB) | 平均(ms) | 中央値(ms) | p95(ms) | キャッシュヒット率 |");
  console.log("|---------------------|-----------|---------|-----------|---------|-----------------|");

  for (const result of results) {
    const sizeKB = (result.size / 1024).toFixed(1);
    const avg = formatMs(result.stats.avg);
    const median = formatMs(result.stats.median);
    const p95 = formatMs(result.stats.p95);
    const hitRate = result.hitRate.toFixed(1);

    console.log(
      `| ${result.variant.label.padEnd(19)} | ` +
        `${sizeKB.padStart(9)} | ` +
        `${avg.padStart(7)} | ` +
        `${median.padStart(9)} | ` +
        `${p95.padStart(7)} | ` +
        `${(hitRate + "%").padStart(15)} |`
    );
  }

  // CSV出力
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const csvFilename = `benchmark-results-${timestamp}.csv`;

  const csvHeader = "Variant,Size,Format,URL,FileSize(bytes),Min(ms),Avg(ms),Median(ms),P95(ms),Max(ms),CacheHitRate(%),HitCount,MissCount\n";
  const csvRows = results.map(r => {
    const hitCount = r.cacheStatuses.filter(s => s === "HIT").length;
    const missCount = r.cacheStatuses.filter(s => s === "MISS" || s === "DYNAMIC").length;
    return [
      r.variant.label,
      r.variant.size,
      r.variant.format,
      r.url,
      r.size,
      formatMs(r.stats.min),
      formatMs(r.stats.avg),
      formatMs(r.stats.median),
      formatMs(r.stats.p95),
      formatMs(r.stats.max),
      r.hitRate.toFixed(1),
      hitCount,
      missCount
    ].join(",");
  });

  const csvContent = csvHeader + csvRows.join("\n");
  await writeFile(csvFilename, csvContent, "utf8");

  console.log(`\n✓ 詳細結果を ${csvFilename} に保存しました`);

  // 推奨事項
  console.log("\n" + "=".repeat(60));
  console.log("推奨事項");
  console.log("=".repeat(60));

  const slowVariants = results.filter(r => r.stats.p95 > 500);
  if (slowVariants.length > 0) {
    console.log("\n⚠️  以下のバリエーションでp95が500msを超えています:");
    for (const v of slowVariants) {
      console.log(`   - ${v.variant.label}: ${formatMs(v.stats.p95)}ms`);
    }
    console.log("   → 画像生成処理の最適化を検討してください");
  }

  const lowCacheHit = results.filter(r => r.hitRate < 80);
  if (lowCacheHit.length > 0) {
    console.log("\n⚠️  以下のバリエーションでキャッシュヒット率が80%未満です:");
    for (const v of lowCacheHit) {
      console.log(`   - ${v.variant.label}: ${v.hitRate.toFixed(1)}%`);
    }
    console.log("   → Cache-Control設定を確認してください");
  }

  const avgP95 = results.reduce((sum, r) => sum + r.stats.p95, 0) / results.length;
  const avgHitRate = results.reduce((sum, r) => sum + r.hitRate, 0) / results.length;

  if (avgP95 < 200 && avgHitRate > 80) {
    console.log("\n✅ パフォーマンスは良好です！");
  }

  console.log("\n次のステップ:");
  console.log("  1. Cloudflare Analytics でキャッシュヒット率を確認");
  console.log("  2. docs/performance-testing.md で詳細な分析方法を確認");
  console.log("  3. 定期的にベンチマークを実行してトレンドを監視");
}

runBenchmark().catch(error => {
  console.error("\n予期しないエラーが発生しました:", error);
  process.exit(1);
});
