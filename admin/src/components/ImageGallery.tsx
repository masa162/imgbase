"use client";

import type { CSSProperties } from "react";
import type { LibraryImage } from "../types/library";

interface ImageGalleryProps {
  items: LibraryImage[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  buildShortUrl: (shortId: string | null) => string | null;
  buildPreviewUrl: (item: LibraryImage) => string;
  formatBytes: (value: number) => string;
  formatDate: (value: string) => string;
}

export default function ImageGallery({
  items,
  selectedIds,
  onToggleSelect,
  buildShortUrl,
  buildPreviewUrl,
  formatBytes,
  formatDate
}: ImageGalleryProps) {
  if (items.length === 0) {
    return (
      <p style={{ marginTop: "1rem", textAlign: "center", color: "#64748b" }}>
        表示できる画像がありません。
      </p>
    );
  }

  return (
    <div style={gridStyle}>
      {items.map(item => {
        const isSelected = selectedIds.has(item.id);
        const previewUrl = buildPreviewUrl(item);
        const shortUrl = buildShortUrl(item.short_id);
        return (
          <article key={item.id} style={cardStyle}>
            <div style={previewWrapperStyle}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(item.id)}
                  style={checkboxStyle}
                />
              </label>
              <img
                src={previewUrl}
                alt={item.original_filename ?? item.id}
                style={previewStyle}
                loading="lazy"
              />
            </div>
            <div style={metaStyle}>
              <div style={filenameStyle}>{item.original_filename ?? "(no name)"}</div>
              <div style={smallTextStyle}>{formatDate(item.created_at)}</div>
              <div style={smallTextStyle}>{formatBytes(item.bytes)}</div>
              <div style={shortUrlStyle}>
                {shortUrl ? (
                  <a href={shortUrl} target="_blank" rel="noopener noreferrer">
                    {shortUrl}
                  </a>
                ) : (
                  <span style={{ color: "#64748b" }}>（短縮URLなし）</span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: "1rem",
  marginTop: "1rem"
};

const cardStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "12px",
  overflow: "hidden",
  background: "rgba(15, 23, 42, 0.65)",
  display: "flex",
  flexDirection: "column"
};

const previewWrapperStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  paddingTop: "66%",
  overflow: "hidden",
  background: "#0f172a"
};

const previewStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover"
};

const checkboxLabelStyle: CSSProperties = {
  position: "absolute",
  top: "0.5rem",
  left: "0.5rem",
  background: "rgba(15, 23, 42, 0.75)",
  borderRadius: "999px",
  padding: "0.2rem 0.45rem",
  zIndex: 2
};

const checkboxStyle: CSSProperties = {
  width: "1rem",
  height: "1rem"
};

const metaStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
  padding: "0.75rem 0.9rem"
};

const filenameStyle: CSSProperties = {
  fontWeight: 600,
  color: "#e2e8f0"
};

const smallTextStyle: CSSProperties = {
  fontSize: "0.8rem",
  color: "#94a3b8"
};

const shortUrlStyle: CSSProperties = {
  fontSize: "0.8rem",
  overflowWrap: "anywhere"
};
