"use client";

import { useCallback, useRef, useState } from "react";

interface SignedUrlResponse {
  uploadUrl: string;
  objectKey: string;
  imageId: string;
  expiresIn: number;
  headers?: Record<string, string>;
}

export default function UploadPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0];
      setBusy(true);
      setError(null);
      setMessage(null);

      try {
        const signedUrl = await requestSignedUrl(file);
        await uploadFile(file, signedUrl);
        await notifyUploadComplete(signedUrl.imageId);
        setMessage(`アップロード完了: ${signedUrl.objectKey}`);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "アップロードに失敗しました");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return (
    <section>
      <h2>アップロード</h2>
      <p>Cloudflare R2 へ直接 PUT するための署名付き URL を取得し、画像をアップロードします。</p>
      <button type="button" onClick={pickFile} disabled={busy}>
        {busy ? "アップロード中..." : "ファイルを選択"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={event => handleFiles(event.target.files)}
      />
      {message ? <p>{message}</p> : null}
      {error ? <p style={{ color: "#ff8585" }}>{error}</p> : null}
    </section>
  );
}

async function requestSignedUrl(file: File): Promise<SignedUrlResponse> {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`署名付きURLの取得に失敗しました (${response.status}): ${reason}`);
  }

  return response.json();
}

async function uploadFile(file: File, signed: SignedUrlResponse) {
  const headers = new Headers(signed.headers);
  headers.set("content-type", file.type);

  const response = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers,
    body: file
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`R2 へのアップロードに失敗しました (${response.status}): ${reason}`);
  }
}

async function notifyUploadComplete(imageId: string) {
  const response = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ imageId })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`アップロード完了処理に失敗しました (${response.status}): ${reason}`);
  }
}
