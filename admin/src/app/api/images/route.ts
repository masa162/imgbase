import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "../../../lib/config";
import { buildBasicAuthHeader } from "../../../lib/auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  let config;
  try {
    config = readConfig();
  } catch (error) {
    return NextResponse.json(
      { error: "ServerConfigurationError", message: (error as Error).message },
      { status: 503 }
    );
  }

  const baseUrl = new URL(config.IMGBASE_UPLOAD_URL);
  const endpoint = new URL(`/images${request.nextUrl.search}`, baseUrl);

  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: buildBasicAuthHeader(config.ADMIN_BASIC_AUTH_USER, config.ADMIN_BASIC_AUTH_PASS)
    }
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
