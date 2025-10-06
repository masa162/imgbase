"use client";

import type { CSSProperties, ChangeEvent } from "react";

interface DateRangeFilterProps {
  from: string;
  to: string;
  disabled?: boolean;
  onChange: (field: "from" | "to", value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export default function DateRangeFilter({ from, to, disabled = false, onChange, onApply, onClear }: DateRangeFilterProps) {
  const handleChange = (field: "from" | "to") => (event: ChangeEvent<HTMLInputElement>) => {
    onChange(field, event.target.value);
  };

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>
        <span style={labelTextStyle}>開始</span>
        <input type="date" value={from} onChange={handleChange("from")} disabled={disabled} style={inputStyle} />
      </label>
      <span style={separatorStyle}>〜</span>
      <label style={labelStyle}>
        <span style={labelTextStyle}>終了</span>
        <input type="date" value={to} onChange={handleChange("to")} disabled={disabled} style={inputStyle} />
      </label>
      <button type="button" onClick={onApply} disabled={disabled} style={applyButtonStyle}>
        適用
      </button>
      <button type="button" onClick={onClear} disabled={disabled || (!from && !to)} style={clearButtonStyle}>
        クリア
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap"
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.75rem",
  color: "#94a3b8"
};

const labelTextStyle: CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.05em"
};

const inputStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1f2937",
  borderRadius: "6px",
  color: "#e2e8f0",
  padding: "0.35rem 0.6rem"
};

const separatorStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.85rem"
};

const baseButtonStyle: CSSProperties = {
  borderRadius: "6px",
  border: "1px solid rgba(148, 163, 184, 0.3)",
  padding: "0.35rem 0.75rem",
  background: "rgba(15, 23, 42, 0.9)",
  color: "#e2e8f0",
  fontSize: "0.85rem",
  cursor: "pointer",
  transition: "background 120ms ease, color 120ms ease"
};

const applyButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "#1d4ed8",
  borderColor: "#1d4ed8"
};

const clearButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "transparent"
};
