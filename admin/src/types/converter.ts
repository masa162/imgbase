export type SupportedMimeType = "image/png" | "image/jpeg" | "image/jpg";

export interface ConversionOptions {
  maxDimension: number;
  webpQuality: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ConversionResult {
  originalFile: File;
  webpBlob: Blob;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
  originalDimensions: Dimensions;
  convertedDimensions: Dimensions;
  durationMs: number;
}

export interface ConversionError {
  file: File;
  message: string;
}

export interface ConvertedImage extends ConversionResult {
  id: string;
  createdAt: number;
}
