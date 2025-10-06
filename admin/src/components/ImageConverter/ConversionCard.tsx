"use client";

import { useEffect, useMemo } from "react";

import {
  downloadBlob,
  formatCompression,
  formatFileSize,
  toWebpFileName
} from "../../lib/downloadHelper";
import type { ConvertedImage } from "../../types/converter";

interface ConversionCardProps {
  image: ConvertedImage;
}

export default function ConversionCard({ image }: ConversionCardProps) {
  const originalUrl = useMemo(() => URL.createObjectURL(image.originalFile), [image.originalFile]);
  const convertedUrl = useMemo(() => URL.createObjectURL(image.webpBlob), [image.webpBlob]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(originalUrl);
      URL.revokeObjectURL(convertedUrl);
    };
  }, [originalUrl, convertedUrl]);

  const convertedFileName = toWebpFileName(image.originalFile.name);

  return (
    <article className="conversion-card">
      <header className="conversion-card__header">
        <div>
          <p className="conversion-card__timestamp">
            {new Date(image.createdAt).toLocaleString("ja-JP")}
          </p>
          <h3 className="conversion-card__title">{image.originalFile.name}</h3>
        </div>
        <button
          type="button"
          className="conversion-card__download"
          onClick={() => downloadBlob(image.webpBlob, convertedFileName)}
        >
          ダウンロード
        </button>
      </header>

      <div className="conversion-card__body">
        <section className="conversion-card__column">
          <h4>変換前</h4>
          <img
            src={originalUrl}
            alt={`${image.originalFile.name} の変換前プレビュー`}
            loading="lazy"
          />
          <dl>
            <div>
              <dt>サイズ</dt>
              <dd>{formatFileSize(image.originalSize)}</dd>
            </div>
            <div>
              <dt>解像度</dt>
              <dd>
                {image.originalDimensions.width} × {image.originalDimensions.height}
              </dd>
            </div>
          </dl>
        </section>

        <section className="conversion-card__column conversion-card__column--after">
          <h4>変換後</h4>
          <img
            src={convertedUrl}
            alt={`${image.originalFile.name} のWebPプレビュー`}
            loading="lazy"
          />
          <dl>
            <div>
              <dt>サイズ</dt>
              <dd>
                {formatFileSize(image.convertedSize)}
                <span className="conversion-card__badge">{formatCompression(image.compressionRatio)}</span>
              </dd>
            </div>
            <div>
              <dt>解像度</dt>
              <dd>
                {image.convertedDimensions.width} × {image.convertedDimensions.height}
              </dd>
            </div>
            <div>
              <dt>所要時間</dt>
              <dd>{Math.round(image.durationMs)} ms</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}
