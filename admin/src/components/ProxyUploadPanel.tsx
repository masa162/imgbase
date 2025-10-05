"use client";

import { useCallback, useRef, useState } from "react";

interface ProxyUploadResponse {
  imageId: string;
  objectKey: string;
  bytes: number;
  hash: string;
  status: string;
}

export default function ProxyUploadPanel() {
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
        const result = await uploadFileProxy(file);
        setMessage(`アップロード完了: ${result.objectKey} (${result.bytes} bytes)`);
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
      <h2>プロキシアップロード</h2>
      <p>CORS問題を回避するため、Workerを経由してアップロードします。</p>
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
      {message ? <p style={{ color: "#4caf50" }}>{message}</p> : null}
      {error ? <p style={{ color: "#ff5252" }}>{error}</p> : null}
    </section>
  );
}

async function uploadFileProxy(file: File): Promise<ProxyUploadResponse> {
  const response = await fetch("/api/uploads/proxy", {
    method: "POST",
    headers: {
      "content-type": file.type,
      "x-filename": file.name
    },
    body: file
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`プロキシアップロードに失敗しました (${response.status}): ${reason}`);
  }

  return response.json();
}