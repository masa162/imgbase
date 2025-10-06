import { decode as decodePNG } from "@jsquash/png";
import { decode as decodeJPEG } from "@jsquash/jpeg";
import { encode as encodeWebP } from "@jsquash/webp";
import { resize } from "@jsquash/resize";

import type {
  ConversionOptions,
  ConversionResult,
  Dimensions,
  SupportedMimeType
} from "../types/converter";

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  maxDimension: 500,
  webpQuality: 85
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
  if (!isSupportedMimeType(file.type)) {
    throw new Error(`Unsupported format: ${file.type || "unknown"}`);
  }

  const options: ConversionOptions = {
    ...DEFAULT_OPTIONS,
    ...overrides
  };

  const startedAt = performance.now();

  const arrayBuffer = await file.arrayBuffer();
  const imageData = await decodeImage(arrayBuffer, file.type);

  const originalDimensions: Dimensions = {
    width: imageData.width,
    height: imageData.height
  };

  const targetDimensions = calculateTargetDimensions(
    imageData.width,
    imageData.height,
    options.maxDimension
  );

  const processedData =
    targetDimensions.width === imageData.width &&
    targetDimensions.height === imageData.height
      ? imageData
      : await resize(imageData, targetDimensions);

  const webpArrayBuffer = await encodeWebP(processedData, {
    quality: options.webpQuality
  });

  const webpBlob = new Blob([webpArrayBuffer], { type: "image/webp" });
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
}

async function decodeImage(buffer: ArrayBuffer, mimeType: SupportedMimeType): Promise<ImageData> {
  if (mimeType === "image/png") {
    return decodePNG(buffer);
  }

  return decodeJPEG(buffer);
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
