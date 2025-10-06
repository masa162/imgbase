"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_CONVERSION_OPTIONS,
  convertToWebP,
  isSupportedMimeType
} from "../../lib/imageConverter";
import {
  downloadAllAsZip,
  formatFileSize
} from "../../lib/downloadHelper";
import type {
  ConversionError,
  ConvertedImage
} from "../../types/converter";
import ConversionCard from "./ConversionCard";
import FileDropZone from "./FileDropZone";
import ProgressBar from "./ProgressBar";

function createIdentifier() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ImageConverter() {
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [errors, setErrors] = useState<ConversionError[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const totals = useMemo(() => {
    if (images.length === 0) {
      return null;
    }

    const original = images.reduce((sum, item) => sum + item.originalSize, 0);
    const converted = images.reduce((sum, item) => sum + item.convertedSize, 0);
    const saved = original - converted;
    const ratio = original === 0 ? 0 : (saved / original) * 100;

    return {
      original,
      converted,
      saved,
      ratio
    };
  }, [images]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const freshErrors: ConversionError[] = [];
    const queue = files.filter(file => {
      if (isSupportedMimeType(file.type)) {
        return true;
      }

      freshErrors.push({
        file,
        message: "対応していないファイル形式です (PNG / JPEG のみ)"
      });
      return false;
    });

    if (queue.length === 0) {
      if (freshErrors.length > 0) {
        setErrors(prev => [...prev, ...freshErrors]);
      }
      return;
    }

    setIsConverting(true);

    const convertedItems: ConvertedImage[] = [];

    for (const file of queue) {
      try {
        const result = await convertToWebP(file, DEFAULT_CONVERSION_OPTIONS);
        convertedItems.push({
          ...result,
          id: createIdentifier(),
          createdAt: Date.now()
        });
      } catch (error) {
        console.error("convertToWebP failed", error);
        freshErrors.push({
          file,
          message: error instanceof Error ? error.message : "変換に失敗しました"
        });
      }
    }

    if (convertedItems.length > 0) {
      setImages(prev => [...convertedItems, ...prev]);
    }

    if (freshErrors.length > 0) {
      setErrors(prev => [...prev, ...freshErrors]);
    }

    setIsConverting(false);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (images.length === 0) {
      return;
    }
    await downloadAllAsZip(images);
  }, [images]);

  const handleClearHistory = useCallback(() => {
    setImages([]);
    setErrors([]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      if (!clipboard) {
        return;
      }

      const files: File[] = [];

      for (const item of Array.from(clipboard.items)) {
        if (item.kind !== "file") {
          continue;
        }

        const file = item.getAsFile();
        if (file && isSupportedMimeType(file.type)) {
          files.push(file);
        }
      }

      if (files.length === 0) {
        for (const file of Array.from(clipboard.files ?? [])) {
          if (isSupportedMimeType(file.type)) {
            files.push(file);
          }
        }
      }

      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      void handleFilesSelected(files);
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [handleFilesSelected]);

  return (
    <section className="converter-container">
      <header className="converter-header">
        <p className="converter-badge">ローカル変換</p>
        <h1>WebP ローカル変換ツール</h1>
        <p className="converter-description">
          ブラウザ内で PNG / JPEG を自動的に WebP (最大長辺 800px ・ 品質 92%) に変換します。変換済みファイルは ZIP で一括ダウンロードでき、サーバーへアップロードされません。
        </p>
      </header>

      <FileDropZone onFilesSelected={handleFilesSelected} disabled={isConverting} />

      {errors.length > 0 ? (
        <div className="converter-alert" role="status">
          <p>一部のファイルで問題が発生しました:</p>
          <ul>
            {errors.slice(-3).map(error => (
              <li key={`${error.file.name}-${error.message}`}>
                {error.file.name}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isConverting ? <ProgressBar /> : null}

      {totals ? (
        <section className="converter-summary">
          <p>
            合計 {formatFileSize(totals.original)} → {formatFileSize(totals.converted)}
            <span className="converter-summary__saving">
              ({totals.saved >= 0 ? "-" : "+"}
              {Math.abs(totals.ratio).toFixed(1)}% / {formatFileSize(Math.abs(totals.saved))} {totals.saved >= 0 ? "削減" : "増加"})
            </span>
          </p>
          <div className="converter-summary__actions">
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={images.length === 0}
            >
              すべてダウンロード (ZIP)
            </button>
            <button type="button" className="converter-summary__ghost" onClick={handleClearHistory}>
              リセット
            </button>
            <Link href="/" className="converter-summary__link">
              変換済み画像をアップロード
            </Link>
          </div>
        </section>
      ) : (
        <p className="converter-empty">まだ変換履歴はありません。上のエリアにファイルをドロップしてください。</p>
      )}

      <div className="converter-grid">
        {images.map(image => (
          <ConversionCard key={image.id} image={image} />
        ))}
      </div>
    </section>
  );
}
