import JSZip from "jszip";

import type { ConvertedImage } from "../types/converter";

const DEFAULT_ZIP_BASENAME = "converted-images";

export function toWebpFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base}.webp`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function downloadAllAsZip(
  images: ConvertedImage[],
  zipFileName = `${DEFAULT_ZIP_BASENAME}.zip`
) {
  if (images.length === 0) {
    return;
  }

  const zip = new JSZip();

  images.forEach(image => {
    const fileName = toWebpFileName(image.originalFile.name);
    zip.file(fileName, image.webpBlob);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipFileName);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export function formatCompression(ratio: number): string {
  const bounded = Math.max(Math.min(ratio, 100), -100);
  const sign = bounded > 0 ? "-" : bounded < 0 ? "+" : "";
  return `${sign}${Math.abs(bounded).toFixed(1)}%`;
}
