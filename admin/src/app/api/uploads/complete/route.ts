import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "../../../../lib/config";

interface CompletePayload {
  imageId: string;
}

export const runtime = "edge";

export async function POST(request: NextRequest) {
  let payload: CompletePayload;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "InvalidJSON" }, { status: 400 });
  }

  if (!payload.imageId || typeof payload.imageId !== "string") {
    return NextResponse.json({ error: "imageId required" }, { status: 400 });
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

  const response = await fetch(config.IMGBASE_UPLOAD_COMPLETE_URL, {
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

  const json = await response.json();
  return NextResponse.json(json);
}

function buildBasicAuthHeader(user: string, password: string) {
  const token = Buffer.from(`${user}:${password}`).toString("base64");
  return `Basic ${token}`;
}
