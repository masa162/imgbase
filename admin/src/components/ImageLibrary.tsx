"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import CopyButton from "./CopyButton";

interface ImageItem {
  id: string;
  original_filename: string | null;
  short_id: string | null;
  mime: string;
  bytes: number;
  status: string;
  hash_sha256: string | null;
  created_at: string;
  updated_at: string;
}

interface ImagesResponse {
  items: ImageItem[];
  nextCursor: string | null;
}

type SortDirection = "asc" | "desc";

const SHORT_URL_BASE = "https://img.be2nd.com";

export default function ImageLibrary() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const hasMore = useMemo(() => Boolean(cursor), [cursor]);

  const sortedItems = useMemo(() => {
    if (items.length === 0) {
      return [] as ImageItem[];
    }

    return [...items].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return 0;
      }
      return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
    });
  }, [items, sortDirection]);

  const fetchImages = useCallback(
    async ({ reset = false, query, cursor: cursorOverride }: { reset?: boolean; query?: string; cursor?: string | null } = {}) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ limit: "20" });
        const effectiveQuery = query ?? appliedSearch;
        const effectiveCursor = cursorOverride ?? (reset ? null : cursor);

        if (effectiveQuery) {
          params.set("q", effectiveQuery);
        }

        if (effectiveCursor) {
          params.set("cursor", effectiveCursor);
        }

        const response = await fetch(`/api/images?${params.toString()}`);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`画像一覧の取得に失敗しました (${response.status}): ${body}`);
        }

        const json = (await response.json()) as ImagesResponse;

        setItems(prev => (reset ? json.items : [...prev, ...json.items]));
        setCursor(json.nextCursor);

        if (reset) {
          setAppliedSearch(effectiveQuery ?? "");
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "画像一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [appliedSearch, cursor]
  );

  useEffect(() => {
    fetchImages({ reset: true });
  }, [fetchImages]);

  const onSearchSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await fetchImages({ reset: true, query: searchInput.trim() });
    },
    [fetchImages, searchInput]
  );

  const onLoadMore = useCallback(async () => {
    if (!cursor) return;
    await fetchImages({ cursor });
  }, [fetchImages, cursor]);

  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => (prev === "desc" ? "asc" : "desc"));
  }, []);

  return (
    <section>
      <header style={headerWrapperStyle}>
        <div>
          <h2 style={{ marginBottom: "0.25rem" }}>画像ライブラリ</h2>
          <p style={{ margin: 0, color: "#94a3b8" }}>アップロード済みの画像一覧とメタ情報を確認できます。</p>
        </div>
        <form onSubmit={onSearchSubmit} style={searchFormStyle}>
          <input
            type="search"
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder="ファイル名やハッシュで検索"
            style={searchInputStyle}
          />
          <button type="submit" disabled={loading}>
            検索
          </button>
        </form>
      </header>

      {appliedSearch ? (
        <p style={{ marginTop: "0.75rem", color: "#94a3b8" }}>
          検索キーワード: <strong>{appliedSearch}</strong>
        </p>
      ) : null}

      {error ? (
        <p style={{ marginTop: "1rem", color: "#fda4af" }}>{error}</p>
      ) : null}

      <div style={tableWrapperStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(15, 23, 42, 0.8)", textAlign: "left" }}>
            <tr>
              <th style={headerCellStyle}>ファイル名</th>
              <th style={headerCellStyle}>短縮URL</th>
              <th style={headerCellStyle}>サイズ</th>
              <th style={headerCellStyle}>ステータス</th>
              <th style={headerCellStyle}>ハッシュ</th>
              <th style={headerCellStyle}>
                <button type="button" onClick={toggleSortDirection} style={sortButtonStyle}>
                  登録日時 {sortDirection === "desc" ? "↓" : "↑"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} style={emptyCellStyle}>
                  表示できる画像がありません。
                </td>
              </tr>
            ) : null}
            {sortedItems.map(item => {
              const shortUrl = buildShortUrl(item.short_id);
              return (
                <tr key={item.id} style={{ borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
                  <td style={bodyCellStyle}>
                    <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{item.original_filename ?? "(no name)"}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{item.id}</div>
                  </td>
                  <td style={bodyCellStyle}>
                    {shortUrl ? (
                      <div style={urlCellStyle}>
                        <span style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>{shortUrl}</span>
                        <CopyButton value={shortUrl} title="短縮URLをコピー" />
                      </div>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.85rem" }}>（短縮URLなし）</span>
                    )}
                  </td>
                  <td style={bodyCellStyle}>{formatBytes(item.bytes)}</td>
                  <td style={bodyCellStyle}>
                    <span style={statusBadgeStyle(item.status)}>{item.status}</span>
                  </td>
                  <td style={bodyCellStyle}>
                    <code style={{ fontSize: "0.75rem" }}>{item.hash_sha256?.slice(0, 12) ?? "-"}</code>
                  </td>
                  <td style={bodyCellStyle}>{formatDate(item.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={footerStyle}>
        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
          {items.length} 件表示中{hasMore ? "（さらに読み込み可能）" : ""}
        </span>
        <button type="button" onClick={onLoadMore} disabled={!hasMore || loading}>
          {loading && hasMore ? "読み込み中..." : hasMore ? "さらに読み込む" : "すべて読み込み済み"}
        </button>
      </div>
    </section>
  );
}

const headerWrapperStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem"
};

const searchFormStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem"
};

const searchInputStyle: CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderRadius: "6px",
  border: "1px solid #1f2937",
  background: "#0f172a",
  color: "#e2e8f0"
};

const tableWrapperStyle: CSSProperties = {
  marginTop: "1rem",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  overflow: "hidden"
};

const headerCellStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  fontSize: "0.85rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#94a3b8"
};

const bodyCellStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  fontSize: "0.9rem",
  color: "#cbd5f5",
  verticalAlign: "top"
};

const emptyCellStyle: CSSProperties = {
  padding: "1.5rem",
  textAlign: "center",
  color: "#64748b"
};

const footerStyle: CSSProperties = {
  marginTop: "1rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const sortButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#94a3b8",
  fontSize: "0.85rem",
  cursor: "pointer"
};

const urlCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem"
};

function buildShortUrl(shortId: string | null): string | null {
  if (!shortId) {
    return null;
  }
  return `${SHORT_URL_BASE}/${shortId}`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || value < 1 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusBadgeStyle(status: string): CSSProperties {
  const palette: Record<string, string> = {
    stored: "#22c55e",
    pending: "#eab308",
    error: "#f87171"
  };
  const color = palette[status] ?? "#38bdf8";
  return {
    display: "inline-block",
    padding: "0.1rem 0.6rem",
    borderRadius: "999px",
    background: `${color}1A`,
    color,
    fontSize: "0.75rem"
  };
}
