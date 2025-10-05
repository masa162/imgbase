import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';

const API_URL = "https://img.be2nd.com";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type");
    const fileName = request.headers.get("x-filename");

    if (!contentType || !fileName) {
      return NextResponse.json(
        { error: "Missing content-type or x-filename header" },
        { status: 400 }
      );
    }

    const body = await request.arrayBuffer();

    const response = await fetch(`${API_URL}/upload/proxy`, {
      method: "POST",
      headers: {
        "content-type": contentType,
        "x-filename": fileName,
        "authorization": request.headers.get("authorization") || ""
      },
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Worker upload failed: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error("Proxy upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}