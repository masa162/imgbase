import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "../../../lib/config";

interface UploadRequestPayload {
  fileName: string;
  contentType: string;
  size: number;
}

export const runtime = "edge";

export async function POST(request: NextRequest) {
  let payload: UploadRequestPayload;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "InvalidJSON" }, { status: 400 });
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  let config;
  try {
    config = readConfig();
  } catch (error) {
    return NextResponse.json(
      { error: "ServerConfigurationError", message: (error as Error).message },
      { status: 503 }
    );
  }

  const response = await fetch(config.IMGBASE_UPLOAD_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: buildBasicAuthHeader(config.ADMIN_BASIC_AUTH_USER, config.ADMIN_BASIC_AUTH_PASS)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    return NextResponse.json(
      {
        error: "UpstreamError",
        status: response.status,
        body
      },
      { status: 502 }
    );
  }

  const signed = await response.json();
  return NextResponse.json(signed);
}

function validatePayload(payload: UploadRequestPayload): string | null {
  if (!payload.fileName || typeof payload.fileName !== "string") {
    return "fileName required";
  }

  if (!payload.contentType || typeof payload.contentType !== "string") {
    return "contentType required";
  }

  if (!Number.isFinite(payload.size) || payload.size <= 0) {
    return "size must be positive";
  }

  const maxSizeMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);
  if (payload.size > maxSizeMb * 1024 * 1024) {
    return `file exceeds ${maxSizeMb}MB limit`;
  }

  return null;
}

function buildBasicAuthHeader(user: string, password: string) {
  const token = Buffer.from(`${user}:${password}`).toString("base64");
  return `Basic ${token}`;
}
