"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";

import DateRangeFilter from "./DateRangeFilter";
import ImageGallery from "./ImageGallery";
import ViewModeToggle from "./ViewModeToggle";
import CopyButton from "./CopyButton";
import type { LibraryImage, LibraryViewMode } from "../types/library";

type SortDirection = "asc" | "desc";

interface ImagesResponse {
  items: LibraryImage[];
  nextCursor: string | null;
}

const SHORT_URL_BASE = "https://img.be2nd.com";

export default function ImageLibrary() {
  const [items, setItems] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("list");
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const hasMore = useMemo(() => Boolean(cursor), [cursor]);
  const totalSelected = selectedIds.size;

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
        setCursor(json.nextCursor ?? null);

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
    void fetchImages({ reset: true });
  }, [fetchImages]);

  useEffect(() => {
    setSelectedIds(prev => {
      const next = new Set(Array.from(prev).filter(id => items.some(item => item.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const displayItems = useMemo(() => {
    const from = appliedDateFrom ? new Date(`${appliedDateFrom}T00:00:00`) : null;
    const to = appliedDateTo ? new Date(`${appliedDateTo}T23:59:59`) : null;

    return [...items]
      .filter(item => {
        const created = new Date(item.created_at);
        if (Number.isNaN(created.getTime())) {
          return true;
        }
        if (from && created < from) {
          return false;
        }
        if (to && created > to) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
          return 0;
        }
        return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [items, appliedDateFrom, appliedDateTo, sortDirection]);

  const allVisibleSelected = displayItems.length > 0 && displayItems.every(item => selectedIds.has(item.id));
  const someVisibleSelected = displayItems.some(item => selectedIds.has(item.id));

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => (prev === "desc" ? "asc" : "desc"));
  }, []);

  const handleToggleView = useCallback((mode: LibraryViewMode) => {
    setViewMode(mode);
  }, []);

  const handleSearchSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStatusMessage(null);
      setSelectedIds(new Set());
      await fetchImages({ reset: true, query: searchInput.trim() });
    },
    [fetchImages, searchInput]
  );

  const handleLoadMore = useCallback(async () => {
    if (!cursor) {
      return;
    }
    await fetchImages({ cursor });
  }, [cursor, fetchImages]);

  const handleVisibleSelectionToggle = useCallback(() => {
    setSelectedIds(prev => {
      if (displayItems.length === 0) {
        return prev;
      }
      const next = new Set(prev);
      const shouldSelectAll = !displayItems.every(item => next.has(item.id));
      for (const item of displayItems) {
        if (shouldSelectAll) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      }
      return next;
    });
  }, [displayItems]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (deleting || selectedIds.size === 0) {
      return;
    }

    const ids = Array.from(selectedIds);
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/images", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ imageIds: ids })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`画像の削除に失敗しました (${response.status}): ${body}`);
      }

      const result = await response.json();
      const deletedCount = typeof result.deleted === "number" ? result.deleted : 0;
      type FailedItem = { id?: string; reason?: string };
      const failedItems = (Array.isArray(result.failed) ? result.failed : []) as FailedItem[];

      setSelectedIds(new Set());
      await fetchImages({ reset: true });

      if (failedItems.length > 0) {
        const sampleIds = failedItems
          .map(item => (item && typeof item.id === "string") ? item.id : undefined)
          .filter((id): id is string => Boolean(id))
          .slice(0, 3);
        const sampleLabel = sampleIds.length > 0 ? `（例: ${sampleIds.join(", ")}）` : "";
        setError(`一部の画像の削除に失敗しました${sampleLabel}`);
        setStatusMessage(`${deletedCount}件の画像を削除しました（失敗: ${failedItems.length}件）`);
      } else {
        setError(null);
        setStatusMessage(`${deletedCount}件の画像を削除しました`);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "画像の削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }, [deleting, selectedIds, fetchImages]);

  const handleDateRangeApply = useCallback(() => {
    setAppliedDateFrom(dateFromInput);
    setAppliedDateTo(dateToInput);
  }, [dateFromInput, dateToInput]);

  const handleDateRangeClear = useCallback(() => {
    setDateFromInput("");
    setDateToInput("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
  }, []);

  const appliedDateSummary = useMemo(() => {
    if (!appliedDateFrom && !appliedDateTo) {
      return null;
    }
    const fromLabel = appliedDateFrom ? appliedDateFrom.replace(/-/g, "/") : "未指定";
    const toLabel = appliedDateTo ? appliedDateTo.replace(/-/g, "/") : "未指定";
    return `${fromLabel} 〜 ${toLabel}`;
  }, [appliedDateFrom, appliedDateTo]);

  return (
    <section>
      <header style={headerWrapperStyle}>
        <div>
          <h2 style={{ marginBottom: "0.25rem" }}>画像ライブラリ</h2>
          <p style={{ margin: 0, color: "#94a3b8" }}>アップロード済みの画像一覧とメタ情報を確認できます。</p>
        </div>
        <div style={headerActionsStyle}>
          <ViewModeToggle value={viewMode} onChange={handleToggleView} />
          <form onSubmit={handleSearchSubmit} style={searchFormStyle}>
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
        </div>
      </header>

      <div style={filtersRowStyle}>
        <DateRangeFilter
          from={dateFromInput}
          to={dateToInput}
          disabled={loading}
          onChange={(field, value) => {
            if (field === "from") {
              setDateFromInput(value);
            } else {
              setDateToInput(value);
            }
          }}
          onApply={handleDateRangeApply}
          onClear={handleDateRangeClear}
        />
        <div style={actionsGroupStyle}>
          <button
            type="button"
            onClick={handleVisibleSelectionToggle}
            disabled={displayItems.length === 0}
            style={secondaryButtonStyle}
          >
            {allVisibleSelected ? "表示中を解除" : "表示中を選択"}
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={deleting || selectedIds.size === 0}
          >
            {deleting ? "削除中..." : "選択した画像を削除"}
          </button>
          {totalSelected > 0 ? (
            <span style={selectionInfoStyle}>{totalSelected}件選択中</span>
          ) : null}
        </div>
      </div>

      {appliedSearch ? (
        <p style={{ marginTop: "0.75rem", color: "#94a3b8" }}>
          検索キーワード: <strong>{appliedSearch}</strong>
        </p>
      ) : null}

      {appliedDateSummary ? (
        <p style={{ marginTop: "0.5rem", color: "#94a3b8" }}>
          日付フィルタ: <strong>{appliedDateSummary}</strong>
        </p>
      ) : null}

      {statusMessage ? (
        <p style={{ marginTop: "0.75rem", color: "#34d399" }}>{statusMessage}</p>
      ) : null}

      {error ? (
        <p style={{ marginTop: "1rem", color: "#fda4af" }}>{error}</p>
      ) : null}

      {viewMode === "list" ? (
        <div style={tableWrapperStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(15, 23, 42, 0.8)", textAlign: "left" }}>
              <tr>
                <th style={checkboxHeaderStyle}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    onChange={handleVisibleSelectionToggle}
                    disabled={displayItems.length === 0}
                    checked={displayItems.length > 0 && allVisibleSelected}
                  />
                </th>
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
              {displayItems.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} style={emptyCellStyle}>
                    表示できる画像がありません。
                  </td>
                </tr>
              ) : null}
              {displayItems.map(item => {
                const shortUrl = buildShortUrl(item.short_id);
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr key={item.id} style={{ borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
                    <td style={checkboxCellStyle}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.id)}
                      />
                    </td>
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
      ) : (
        <ImageGallery
          items={displayItems}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          buildShortUrl={buildShortUrl}
          buildPreviewUrl={buildPreviewUrl}
          formatBytes={formatBytes}
          formatDate={formatDate}
        />
      )}

      <div style={footerStyle}>
        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
          {displayItems.length} 件表示中{hasMore ? "（さらに読み込み可能）" : ""}
        </span>
        <button type="button" onClick={handleLoadMore} disabled={!hasMore || loading}>
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
  gap: "1rem",
  flexWrap: "wrap"
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
  justifyContent: "flex-end"
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

const filtersRowStyle: CSSProperties = {
  marginTop: "1rem",
  display: "flex",
  flexWrap: "wrap",
  gap: "1rem",
  justifyContent: "space-between",
  alignItems: "center"
};

const actionsGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap"
};

const selectionInfoStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.85rem"
};

const secondaryButtonStyle: CSSProperties = {
  borderRadius: "6px",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  padding: "0.35rem 0.75rem",
  background: "rgba(15, 23, 42, 0.8)",
  color: "#cbd5f5",
  fontSize: "0.85rem",
  cursor: "pointer"
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

const checkboxHeaderStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  width: "3rem"
};

const bodyCellStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  fontSize: "0.9rem",
  color: "#cbd5f5",
  verticalAlign: "top"
};

const checkboxCellStyle: CSSProperties = {
  padding: "0.75rem 1rem",
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
  alignItems: "center",
  flexWrap: "wrap",
  gap: "0.75rem"
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

function buildPreviewUrl(item: LibraryImage): string {
  return `/i/${item.id}/320x320.jpg`;
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
