#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";

const env = process.env;
const signUrl = env.IMGBASE_SIGN_URL;
const completeUrl = env.IMGBASE_COMPLETE_URL;
const imageGetUrl = env.IMGBASE_IMAGE_GET_URL || signUrl.replace("/upload/sign", "");
const username = env.IMGBASE_ADMIN_USER;
const password = env.IMGBASE_ADMIN_PASS;
const filePath = env.IMGBASE_TEST_FILE ?? "sample.jpg";
const contentType = env.IMGBASE_TEST_CONTENT_TYPE ?? "image/jpeg";

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
}

assertEnv(signUrl, "IMGBASE_SIGN_URL");
assertEnv(completeUrl, "IMGBASE_COMPLETE_URL");
assertEnv(username, "IMGBASE_ADMIN_USER");
assertEnv(password, "IMGBASE_ADMIN_PASS");

const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");
let testsPassed = 0;
let testsFailed = 0;

function logStep(message) {
  console.log(`\n→ ${message}`);
}

function logSuccess(message, data) {
  console.log(`✓ ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  testsPassed++;
}

function logError(message, error) {
  console.error(`✗ ${message}`);
  console.error(error);
  testsFailed++;
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("imgbase 統合テスト");
  console.log("=".repeat(60));

  let imageId;
  let objectKey;
  let uploadedHash;
  let signedData;

  // ========================================
  // Test 1: ファイル読み込み
  // ========================================
  logStep("Test 1: テストファイルを読み込み");
  try {
    const absPath = resolve(filePath);
    const fileBuffer = await readFile(absPath);
    const fileName = basename(absPath);
    logSuccess(`ファイル読み込み成功: ${fileName} (${fileBuffer.byteLength} bytes)`);
  } catch (error) {
    logError("ファイル読み込み失敗", error.message);
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const fileBuffer = await readFile(absPath);
  const fileName = basename(absPath);

  // ========================================
  // Test 2: 署名付きURL取得
  // ========================================
  logStep("Test 2: 署名付きURLを取得");
  try {
    const signResponse = await fetch(signUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        fileName,
        contentType,
        size: fileBuffer.byteLength
      })
    });

    if (!signResponse.ok) {
      const text = await signResponse.text();
      throw new Error(`HTTP ${signResponse.status}: ${text}`);
    }

    const signed = await signResponse.json();
    signedData = signed;
    imageId = signed.imageId;
    objectKey = signed.objectKey;

    logSuccess("署名付きURL取得成功", {
      imageId: signed.imageId,
      objectKey: signed.objectKey,
      expiresIn: signed.expiresIn
    });
  } catch (error) {
    logError("署名付きURL取得失敗", error.message);
    process.exit(1);
  }

  // ========================================
  // Test 3: R2へのアップロード
  // ========================================
  logStep("Test 3: R2へファイルをアップロード");
  try {
    const putResponse = await fetch(signedData.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": signedData.headers["content-type"],
        "x-amz-meta-original-filename": signedData.headers["x-amz-meta-original-filename"]
      },
      body: fileBuffer
    });

    if (!putResponse.ok) {
      const text = await putResponse.text();
      throw new Error(`HTTP ${putResponse.status}: ${text}`);
    }

    logSuccess("R2アップロード成功");
  } catch (error) {
    logError("R2アップロード失敗", error.message);
    process.exit(1);
  }

  // ========================================
  // Test 4: アップロード完了通知
  // ========================================
  logStep("Test 4: アップロード完了を通知");
  try {
    const completeResponse = await fetch(completeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${basicAuth}`
      },
      body: JSON.stringify({ imageId })
    });

    if (!completeResponse.ok) {
      const text = await completeResponse.text();
      throw new Error(`HTTP ${completeResponse.status}: ${text}`);
    }

    const completeJson = await completeResponse.json();
    uploadedHash = completeJson.hash;

    logSuccess("完了通知成功", {
      status: completeJson.status,
      hash: completeJson.hash,
      bytes: completeJson.bytes
    });
  } catch (error) {
    logError("完了通知失敗", error.message);
    testsFailed++;
  }

  // ========================================
  // Test 5: 画像一覧APIで確認
  // ========================================
  logStep("Test 5: 画像一覧APIでメタデータを確認");
  try {
    const listUrl = `${imageGetUrl}/images`;
    const listResponse = await fetch(listUrl, {
      headers: {
        authorization: `Basic ${basicAuth}`
      }
    });

    if (!listResponse.ok) {
      const text = await listResponse.text();
      throw new Error(`HTTP ${listResponse.status}: ${text}`);
    }

    const listData = await listResponse.json();
    const foundImage = listData.items.find(img => img.id === imageId);

    if (foundImage) {
      logSuccess("画像一覧に登録確認", {
        id: foundImage.id,
        filename: foundImage.original_filename,
        status: foundImage.status
      });
    } else {
      throw new Error("アップロードした画像が一覧に見つかりません");
    }
  } catch (error) {
    logError("画像一覧取得失敗", error.message);
    testsFailed++;
  }

  // ========================================
  // Test 6: 画像配信（オリジナル相当）
  // ========================================
  logStep("Test 6: 画像配信をテスト (1200x675.jpg)");
  try {
    const imageUrl = `${imageGetUrl}/i/${imageId}/1200x675.jpg`;
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      const text = await imageResponse.text();
      throw new Error(`HTTP ${imageResponse.status}: ${text}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentTypeHeader = imageResponse.headers.get("content-type");

    logSuccess("画像配信成功", {
      url: imageUrl,
      size: imageBuffer.byteLength,
      contentType: contentTypeHeader
    });
  } catch (error) {
    logError("画像配信失敗", error.message);
    testsFailed++;
  }

  // ========================================
  // Test 7: 異なるサイズ・フォーマットの配信
  // ========================================
  logStep("Test 7: 異なるサイズ・フォーマットの配信をテスト");
  const variants = [
    { size: "800x450", format: "jpg" },
    { size: "400x225", format: "webp" }
  ];

  for (const variant of variants) {
    try {
      const variantUrl = `${imageGetUrl}/i/${imageId}/${variant.size}.${variant.format}`;
      const variantResponse = await fetch(variantUrl);

      if (!variantResponse.ok) {
        throw new Error(`HTTP ${variantResponse.status}`);
      }

      const variantBuffer = await variantResponse.arrayBuffer();
      logSuccess(`バリエーション配信成功: ${variant.size}.${variant.format} (${variantBuffer.byteLength} bytes)`);
    } catch (error) {
      logError(`バリエーション配信失敗: ${variant.size}.${variant.format}`, error.message);
      testsFailed++;
    }
  }

  // ========================================
  // Test 8: エラーケーステスト（存在しない画像）
  // ========================================
  logStep("Test 8: 存在しない画像IDでエラーハンドリングを確認");
  try {
    const invalidUrl = `${imageGetUrl}/i/invalid-image-id/1200x675.jpg`;
    const invalidResponse = await fetch(invalidUrl);

    if (invalidResponse.status === 404) {
      logSuccess("存在しない画像に対して404を正しく返却");
    } else {
      throw new Error(`期待: 404, 実際: ${invalidResponse.status}`);
    }
  } catch (error) {
    logError("エラーハンドリングテスト失敗", error.message);
    testsFailed++;
  }

  // ========================================
  // Test 9: 認証エラーテスト
  // ========================================
  logStep("Test 9: 認証なしでアクセスして401を確認");
  try {
    const unauthResponse = await fetch(signUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        fileName: "test.jpg",
        contentType: "image/jpeg",
        size: 1000
      })
    });

    if (unauthResponse.status === 401) {
      logSuccess("認証なしで401を正しく返却");
    } else {
      throw new Error(`期待: 401, 実際: ${unauthResponse.status}`);
    }
  } catch (error) {
    logError("認証エラーテスト失敗", error.message);
    testsFailed++;
  }

  // ========================================
  // テスト結果サマリ
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("テスト結果サマリ");
  console.log("=".repeat(60));
  console.log(`✓ 成功: ${testsPassed}`);
  console.log(`✗ 失敗: ${testsFailed}`);
  console.log(`合計: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log("\n🎉 すべてのテストが成功しました！");
    process.exit(0);
  } else {
    console.log("\n⚠️  一部のテストが失敗しました。ログを確認してください。");
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error("予期しないエラーが発生しました:", error);
  process.exit(1);
});
