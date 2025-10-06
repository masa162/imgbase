import type {
  ConversionOptions,
  ConversionResult,
  Dimensions,
  SupportedMimeType
} from "../types/converter";

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  maxDimension: 800,
  webpQuality: 92
};

const DEFAULT_OPTIONS = DEFAULT_CONVERSION_OPTIONS;

export const SUPPORTED_MIME_TYPES: ReadonlyArray<SupportedMimeType> = [
  "image/png",
  "image/jpeg",
  "image/jpg"
];

export function isSupportedMimeType(value: string): value is SupportedMimeType {
  return SUPPORTED_MIME_TYPES.includes(value as SupportedMimeType);
}

export async function convertToWebP(
  file: File,
  overrides: Partial<ConversionOptions> = {}
): Promise<ConversionResult> {
  if (typeof window === "undefined") {
    throw new Error("変換処理はブラウザ上でのみ実行できます");
  }

  if (!isSupportedMimeType(file.type)) {
    throw new Error(`Unsupported format: ${file.type || "unknown"}`);
  }

  const options: ConversionOptions = {
    ...DEFAULT_OPTIONS,
    ...overrides
  };

  const startedAt = performance.now();

  const { source, width, height, cleanup } = await loadImageSource(file);

  try {
    const originalDimensions: Dimensions = { width, height };
    const targetDimensions = calculateTargetDimensions(
      width,
      height,
      options.maxDimension
    );

    const webpBlob = await renderToWebP(
      source,
      targetDimensions.width,
      targetDimensions.height,
      options.webpQuality
    );

    const durationMs = performance.now() - startedAt;

    return {
      originalFile: file,
      webpBlob,
      originalSize: file.size,
      convertedSize: webpBlob.size,
      compressionRatio: calculateCompressionRatio(file.size, webpBlob.size),
      originalDimensions,
      convertedDimensions: targetDimensions,
      durationMs
    };
  } finally {
    cleanup();
  }
}

interface ImageSourcePayload {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function loadImageSource(file: File): Promise<ImageSourcePayload> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => {
        bitmap.close?.();
      }
    };
  }

  const objectUrl = URL.createObjectURL(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = objectUrl;
  }).catch(error => {
    URL.revokeObjectURL(objectUrl);
    throw error;
  });

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => {
      URL.revokeObjectURL(objectUrl);
    }
  };
}

async function renderToWebP(
  source: CanvasImageSource,
  width: number,
  height: number,
  qualityPercent: number
): Promise<Blob> {
  const quality = clamp(qualityPercent / 100, 0, 1);

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("2D コンテキストの取得に失敗しました");
    }

    context.drawImage(source, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/webp", quality });
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D コンテキストの取得に失敗しました");
  }

  context.drawImage(source, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("WebP 生成に失敗しました"));
        return;
      }
      resolve(blob);
    }, "image/webp", quality);
  });
}

function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): Dimensions {
  if (
    originalWidth <= maxDimension &&
    originalHeight <= maxDimension
  ) {
    return {
      width: originalWidth,
      height: originalHeight
    };
  }

  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth >= originalHeight) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio)
    };
  }

  return {
    width: Math.round(maxDimension * aspectRatio),
    height: maxDimension
  };
}

function calculateCompressionRatio(original: number, converted: number) {
  if (original === 0) {
    return 0;
  }

  const ratio = 1 - converted / original;
  return Math.round(ratio * 1000) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
