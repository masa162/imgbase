import { Router, type IRequest } from "itty-router";

const textEncoder = new TextEncoder();

interface Env {
  IMGBASE_BUCKET: R2Bucket;
  IMGBASE_DB: D1Database;
  PUBLIC_BASE_URL: string;
  BASIC_AUTH_REALM?: string;
  BASIC_AUTH_USERNAME?: string;
  BASIC_AUTH_PASSWORD?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  UPLOAD_URL_EXPIRY_SECONDS?: string;
  MAX_UPLOAD_BYTES?: string;
}

type Handler = (request: IRequest, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

const router = Router();
let schemaPrepared = false;

router.get("/healthz", () =>
  new Response(
    JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
    {
      headers: {
        "content-type": "application/json"
      }
    }
  )
);

router.post(
  "/upload/sign",
  withAuth(async (request, env) => {
    let body: UploadRequest;
    try {
      body = await readJson<UploadRequest>(request);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const validationError = validateUploadBody(body, env.MAX_UPLOAD_BYTES);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
      return Response.json({ error: "ServerMisconfigured", message: "R2 credentials are missing" }, { status: 503 });
    }

    await ensureSchema(env);

    const imageId = crypto.randomUUID();
    const objectKey = buildObjectKey(imageId, body.fileName);
    const expiresSeconds = Number.parseInt(env.UPLOAD_URL_EXPIRY_SECONDS ?? "900", 10) || 900;

    const uploadUrl = await signR2PutUrl({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
      objectKey,
      expiresIn: expiresSeconds,
      contentType: body.contentType,
      metadata: {
        "original-filename": body.fileName
      }
    });

    const now = new Date().toISOString();

    try {
      await env.IMGBASE_DB.prepare(
        `INSERT INTO images (id, bucket_key, original_filename, mime, bytes, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
        .bind(imageId, objectKey, body.fileName, body.contentType, body.size, "pending", now, now)
        .run();
    } catch (error) {
      console.error("Failed to insert metadata", error);
      return Response.json({ error: "DatabaseError", message: "Failed to register metadata" }, { status: 500 });
    }

    return Response.json({
      uploadUrl,
      objectKey,
      imageId,
      expiresIn: expiresSeconds,
      headers: {
        "content-type": body.contentType,
        "x-amz-meta-original-filename": body.fileName
      }
    });
  })
);

router.post(
  "/upload/complete",
  withAuth(async (request, env) => {
    let body: CompleteUploadRequest;
    try {
      body = await readJson<CompleteUploadRequest>(request);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    if (!body.imageId) {
      return Response.json({ error: "imageId is required" }, { status: 400 });
    }

    await ensureSchema(env);

    const record = await env.IMGBASE_DB.prepare("SELECT bucket_key FROM images WHERE id = ?1")
      .bind(body.imageId)
      .first<{ bucket_key: string }>();

    if (!record) {
      return Response.json({ error: "ImageNotFound" }, { status: 404 });
    }

    const object = await env.IMGBASE_BUCKET.get(record.bucket_key);
    if (!object) {
      return Response.json({ error: "R2ObjectNotFound" }, { status: 404 });
    }

    const buffer = await object.arrayBuffer();
    const bytes = object.size ?? buffer.byteLength;
    const hash = await sha256Hex(buffer);
    const metadata = await extractMetadata(object, buffer);
    const now = new Date().toISOString();

    try {
      await env.IMGBASE_DB.prepare(
        `UPDATE images
         SET status = ?2, bytes = ?3, hash_sha256 = ?4, exif_json = ?5, taken_at = ?6, updated_at = ?7
         WHERE id = ?1`
      )
        .bind(body.imageId, "stored", bytes, hash, metadata.exifJson, metadata.takenAt, now)
        .run();
    } catch (error) {
      console.error("Failed to update metadata", error);
      return Response.json({ error: "DatabaseError", message: "Failed to update metadata" }, { status: 500 });
    }

    return Response.json({ status: "stored", hash, bytes, takenAt: metadata.takenAt });
  })
);

router.get(
  "/images",
  withAuth(async (request, env) => {
    await ensureSchema(env);

    const url = new URL(request.url);
    const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;
    const cursor = url.searchParams.get("cursor");
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? null;
    const status = url.searchParams.get("status")?.trim() ?? null;

    const conditions: string[] = [];
    const bindings: Array<string | number> = [];

    if (cursor) {
      conditions.push("created_at < ?");
      bindings.push(cursor);
    }

    if (q) {
      conditions.push("LOWER(original_filename) LIKE ?");
      bindings.push(`%${q}%`);
    }

    if (status) {
      conditions.push("status = ?");
      bindings.push(status);
    }

    let query =
      "SELECT id, original_filename, mime, bytes, status, hash_sha256, created_at, updated_at FROM images";

    if (conditions.length) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY datetime(created_at) DESC, id DESC LIMIT ?";

    const statement = env.IMGBASE_DB.prepare(query).bind(...bindings, limit);
    const result = await statement.all<{
      id: string;
      original_filename: string | null;
      mime: string;
      bytes: number;
      status: string;
      hash_sha256: string | null;
      created_at: string;
      updated_at: string;
    }>();

    const items = result.results ?? [];
    const nextCursor = items.length === limit ? items[items.length - 1]?.created_at ?? null : null;

    return Response.json({ items, nextCursor });
  })
);

router.get("/i/:uid/:size", async (request, env: Env) => {
  const { uid, size } = request.params ?? {};
  if (!uid || !size) {
    return new Response("Bad Request", { status: 400 });
  }

  const dimensionMatch = size.match(/^(\d+)x(\d+)\.(jpg|jpeg|webp)$/i);
  if (!dimensionMatch) {
    return new Response("Invalid size parameter", { status: 400 });
  }

  const [, width, height, rawFormat] = dimensionMatch;
  const normalizedFormat = normalizeFormat(rawFormat);
  const widthNumber = Number(width);
  const heightNumber = Number(height);
  const variantKey = `${uid}/${width}x${height}.${normalizedFormat}`;

  const cachedObject = await env.IMGBASE_BUCKET.get(variantKey);
  if (cachedObject) {
    return buildImageResponse(cachedObject, normalizedFormat);
  }

  return generateVariantResponse(env, {
    imageId: uid,
    variantKey,
    width: widthNumber,
    height: heightNumber,
    format: normalizedFormat
  });
});

router.all("*", () => new Response("Not found", { status: 404 }));

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx);
  }
};

async function ensureSchema(env: Env) {
  if (schemaPrepared) {
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      bucket_key TEXT NOT NULL,
      original_filename TEXT,
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      hash_sha256 TEXT,
      exif_json TEXT,
      taken_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      cover_image_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cover_image_id) REFERENCES images(id)
    )`,
    `CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS image_tags (
      image_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (image_id, tag_id),
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )`,
    "CREATE INDEX IF NOT EXISTS idx_images_bucket_key ON images(bucket_key)",
    "CREATE INDEX IF NOT EXISTS idx_images_taken_at ON images(taken_at)",
    "CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)"
  ];

  for (const statement of statements) {
    await env.IMGBASE_DB.prepare(statement).run();
  }

  schemaPrepared = true;
}

async function readJson<T>(request: IRequest | Request): Promise<T> {
  const text = await request.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new BadRequestError("Invalid JSON payload");
  }
}

function buildImageResponse(object: R2ObjectBody, format: string): Response {
  const headers = new Headers({
    "content-type": contentTypeForFormat(format),
    "cache-control": "public, max-age=31536000, immutable"
  });

  if (object.httpMetadata?.contentType) {
    headers.set("content-type", object.httpMetadata.contentType);
  }

  return new Response(object.body, {
    headers
  });
}

function withAuth(handler: Handler): Handler {
  return async (request, env, ctx) => {
    const credentials = parseBasicAuth(request.headers.get("authorization"));

    if (!credentials) {
      return unauthorizedResponse(env.BASIC_AUTH_REALM);
    }

    const expectedUser = env.BASIC_AUTH_USERNAME;
    const expectedPass = env.BASIC_AUTH_PASSWORD;

    if (!expectedUser || !expectedPass) {
      console.warn("Basic auth env vars missing");
      return new Response("Server configuration error", { status: 503 });
    }

    const userBuffer = new TextEncoder().encode(credentials.user);
    const passBuffer = new TextEncoder().encode(credentials.pass);
    const expectedUserBuffer = new TextEncoder().encode(expectedUser);
    const expectedPassBuffer = new TextEncoder().encode(expectedPass);

    const userMatches = constantTimeEqual(userBuffer, expectedUserBuffer);
    const passMatches = constantTimeEqual(passBuffer, expectedPassBuffer);

    if (!userMatches || !passMatches) {
      return unauthorizedResponse(env.BASIC_AUTH_REALM);
    }

    return handler(request, env, ctx);
  };
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

function parseBasicAuth(header: string | null) {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const token = header.slice("Basic ".length);
  try {
    const decoded = atob(token);
    const [user, pass] = decoded.split(":");
    if (!user || !pass) {
      return null;
    }
    return { user, pass };
  } catch (error) {
    console.warn("Failed to decode basic auth header", error);
    return null;
  }
}

function unauthorizedResponse(realm?: string) {
  const headers = new Headers();
  headers.set("WWW-Authenticate", `Basic realm="${realm ?? "imgbase"}", charset="UTF-8"`);
  return new Response("Unauthorized", {
    status: 401,
    headers
  });
}

function validateUploadBody(body: UploadRequest, maxUploadBytes?: string): string | null {
  if (!body.fileName) return "fileName is required";
  if (!body.contentType) return "contentType is required";
  if (!Number.isFinite(body.size) || body.size <= 0) return "size must be > 0";

  const limit = Number.parseInt(maxUploadBytes ?? "0", 10);
  if (limit > 0 && body.size > limit) {
    return `file exceeds ${Math.floor(limit / (1024 * 1024))}MB limit`;
  }

  return null;
}

interface UploadRequest {
  fileName: string;
  contentType: string;
  size: number;
}

interface CompleteUploadRequest {
  imageId: string;
}

function buildObjectKey(imageId: string, fileName: string) {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  return `${imageId}/original/${cleanName || "file"}`;
}

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

interface SignOptions {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  objectKey: string;
  expiresIn: number;
  contentType?: string;
  metadata?: Record<string, string>;
}

async function signR2PutUrl(options: SignOptions): Promise<string> {
  const host = `${options.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeRfc3986(options.bucketName)}/${encodeObjectKey(options.objectKey)}`;

  const now = new Date();
  const amzDate = formatAmzDate(now);
  const datestamp = amzDate.slice(0, 8);
  const credentialScope = `${datestamp}/auto/s3/aws4_request`;
  const algorithm = "AWS4-HMAC-SHA256";

  // Build canonical headers - must include all headers that will be sent
  const headersToSign: Array<[string, string]> = [["host", host]];

  if (options.contentType) {
    headersToSign.push(["content-type", options.contentType]);
  }

  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      headersToSign.push([`x-amz-meta-${key}`, value]);
    }
  }

  // Sort headers by name for canonical form
  headersToSign.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = headersToSign.map(([name, value]) => `${name}:${value}\n`).join("");
  const signedHeaders = headersToSign.map(([name]) => name).join(";");

  const baseQuery = {
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": `${options.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(options.expiresIn),
    "X-Amz-SignedHeaders": signedHeaders
  } as Record<string, string>;

  const canonicalQuery = canonicalizeQuery(baseQuery);
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, amzDate, credentialScope, hashedCanonicalRequest].join("\n");
  const signingKey = await deriveSigningKey(options.secretAccessKey, datestamp);
  const signature = await hmacHex(signingKey, stringToSign);

  const finalQuery = canonicalizeQuery({
    ...baseQuery,
    "X-Amz-Signature": signature
  });

  return `https://${host}${canonicalUri}?${finalQuery}`;
}

async function extractMetadata(object: R2ObjectBody, buffer: ArrayBuffer): Promise<{ exifJson: string | null; takenAt: string | null }> {
  // TODO: integrate actual EXIF parsing/AI enrichment pipeline.
  const exifFromMetadata = object.customMetadata?.exif ?? null;
  const takenAt = object.customMetadata?.taken_at ?? null;
  return {
    exifJson: typeof exifFromMetadata === "string" ? exifFromMetadata : null,
    takenAt: typeof takenAt === "string" ? takenAt : null
  };
}

function normalizeFormat(format: string): string {
  const lowered = format.toLowerCase();
  if (lowered === "jpeg") {
    return "jpg";
  }
  return lowered;
}

async function generateVariantResponse(
  env: Env,
  {
    imageId,
    variantKey,
    width,
    height,
    format
  }: {
    imageId: string;
    variantKey: string;
    width: number;
    height: number;
    format: string;
  }
): Promise<Response> {
  const record = await env.IMGBASE_DB.prepare("SELECT bucket_key FROM images WHERE id = ?1")
    .bind(imageId)
    .first<{ bucket_key: string }>();

  if (!record) {
    return Response.json({ error: "ImageNotFound" }, { status: 404 });
  }

  const originalObject = await env.IMGBASE_BUCKET.get(record.bucket_key);
  if (!originalObject) {
    return Response.json({ error: "OriginalNotFound" }, { status: 404 });
  }

  const originalBuffer = await originalObject.arrayBuffer();
  const resized = await resizeImage(originalBuffer, { width, height, format });

  await env.IMGBASE_BUCKET.put(variantKey, resized.bytes, {
    httpMetadata: {
      contentType: resized.contentType
    }
  });

  return new Response(resized.bytes, {
    headers: {
      "content-type": resized.contentType,
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
}

async function resizeImage(
  buffer: ArrayBuffer,
  { width, height, format }: { width: number; height: number; format: string }
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  // TODO: swap stub with Cloudflare Image Resizing service call.
  const cloned = buffer.slice(0);
  const contentType = contentTypeForFormat(format);
  return { bytes: cloned, contentType };
}

function contentTypeForFormat(format: string): string {
  const lowered = format.toLowerCase();
  if (lowered === "jpg" || lowered === "jpeg") {
    return "image/jpeg";
  }
  return `image/${lowered}`;
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeObjectKey(objectKey: string): string {
  return objectKey
    .split("/")
    .map(segment => encodeRfc3986(segment))
    .join("/");
}

function canonicalizeQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map(key => `${encodeRfc3986(key)}=${encodeRfc3986(params[key])}`)
    .join("&");
}

async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === "string" ? textEncoder.encode(input) : new Uint8Array(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hash);
}

async function deriveSigningKey(secretAccessKey: string, datestamp: string): Promise<ArrayBuffer> {
  const kSecret = textEncoder.encode(`AWS4${secretAccessKey}`);
  const kDate = await hmac(kSecret, datestamp);
  const kRegion = await hmac(kDate, "auto");
  const kService = await hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const rawKey = key instanceof ArrayBuffer ? key : key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(data));
}

async function hmacHex(key: ArrayBuffer | Uint8Array, data: string): Promise<string> {
  const signature = await hmac(key, data);
  return bufferToHex(signature);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatAmzDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}
