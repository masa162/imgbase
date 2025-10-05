import { describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { createHash } from "node:crypto";

const baseUrl = "https://imgbase.test";
const basicAuthHeader = `Basic ${btoa("admin:change-me")}`;

describe("upload signing", () => {
  it("returns a presigned URL, registers metadata, and completes upload", async () => {
    const signResponse = await SELF.fetch(`${baseUrl}/upload/sign`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        fileName: "sample.jpg",
        contentType: "image/jpeg",
        size: 6
      })
    });

    expect(signResponse.status).toBe(200);
    const signedBody = await signResponse.json<{
      uploadUrl: string;
      objectKey: string;
      imageId: string;
      expiresIn: number;
      headers: Record<string, string>;
    }>();

    expect(signedBody.uploadUrl).toMatch(/^https:\/\//);
    expect(signedBody.objectKey).toMatch(/original\/.*sample\.jpg$/);
    expect(signedBody.imageId).toMatch(/[0-9a-f-]{36}/);
    expect(signedBody.expiresIn).toBeGreaterThan(0);
    expect(signedBody.headers["content-type"]).toBe("image/jpeg");

    const payload = new TextEncoder().encode("image!");

    const payloadBuffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);

    await env.IMGBASE_BUCKET.put(signedBody.objectKey, payloadBuffer, {
      httpMetadata: {
        contentType: "image/jpeg"
      }
    });

    const completeResponse = await SELF.fetch(`${baseUrl}/upload/complete`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader,
        "content-type": "application/json"
      },
      body: JSON.stringify({ imageId: signedBody.imageId })
    });

    expect(completeResponse.status).toBe(200);
    const completeBody = await completeResponse.json<{
      status: string;
      hash: string;
      bytes: number;
    }>();

    const expectedHash = createHash("sha256").update(payload).digest("hex");
    expect(completeBody.status).toBe("stored");
    expect(completeBody.hash).toBe(expectedHash);
    expect(completeBody.bytes).toBe(payload.byteLength);

    const dbResult = await env.IMGBASE_DB.prepare("SELECT status, hash_sha256, bytes FROM images WHERE id = ?1")
      .bind(signedBody.imageId)
      .first<{ status: string; hash_sha256: string; bytes: number }>();

    expect(dbResult?.status).toBe("stored");
    expect(dbResult?.hash_sha256).toBe(expectedHash);
    expect(dbResult?.bytes).toBe(payload.byteLength);

    const variantResponse = await SELF.fetch(`${baseUrl}/i/${signedBody.imageId}/200x200.jpg`);
    expect(variantResponse.status).toBe(200);
    expect(variantResponse.headers.get("cache-control")).toContain("max-age=31536000");
    const variantBody = new Uint8Array(await variantResponse.arrayBuffer());
    expect(Array.from(variantBody)).toEqual(Array.from(payload));
  });

  it("rejects oversized files", async () => {
    const response = await SELF.fetch(`${baseUrl}/upload/sign`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        fileName: "large.jpg",
        contentType: "image/jpeg",
        size: 999999999
      })
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("file exceeds");
  });
});
