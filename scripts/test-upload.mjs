#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";

const env = process.env;
const signUrl = env.IMGBASE_SIGN_URL;
const completeUrl = env.IMGBASE_COMPLETE_URL;
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

const absPath = resolve(filePath);

const fileBuffer = await readFile(absPath);
const fileName = basename(absPath);
const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

console.log("→ Requesting signed URL...");

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
  throw new Error(`Sign request failed: ${signResponse.status} ${text}`);
}

const signed = await signResponse.json();
console.log("✓ Signed URL acquired", signed);

const headers = signed.headers ?? {};
const uploadHeaders = Object.fromEntries(
  Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
);
if (!uploadHeaders["content-type"]) {
  uploadHeaders["content-type"] = contentType;
}

console.log("→ Uploading file to R2...");
const putResponse = await fetch(signed.uploadUrl, {
  method: "PUT",
  headers: uploadHeaders,
  body: fileBuffer
});

if (!putResponse.ok) {
  const text = await putResponse.text();
  throw new Error(`Upload failed: ${putResponse.status} ${text}`);
}
console.log("✓ Upload completed");

console.log("→ Notifying upload completion...");
const completeResponse = await fetch(completeUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Basic ${basicAuth}`
  },
  body: JSON.stringify({ imageId: signed.imageId })
});

if (!completeResponse.ok) {
  const text = await completeResponse.text();
  throw new Error(`Complete request failed: ${completeResponse.status} ${text}`);
}

const completeJson = await completeResponse.json();
console.log("✓ Upload pipeline succeeded", completeJson);
