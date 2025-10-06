"use client";

import type { CSSProperties } from "react";
import type { LibraryViewMode } from "../types/library";

interface ViewModeToggleProps {
  value: LibraryViewMode;
  onChange: (value: LibraryViewMode) => void;
  disabled?: boolean;
}

const MODES: Array<{ value: LibraryViewMode; label: string; icon: string }> = [
  { value: "list", label: "リスト", icon: "🗂️" },
  { value: "gallery", label: "ギャラリー", icon: "🖼️" }
];

export default function ViewModeToggle({ value, onChange, disabled = false }: ViewModeToggleProps) {
  return (
    <div style={containerStyle}>
      {MODES.map(mode => {
        const isActive = mode.value === value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            disabled={disabled || isActive}
            aria-pressed={isActive}
            style={isActive ? activeButtonStyle : buttonStyle}
          >
            <span aria-hidden style={{ marginRight: "0.35rem" }}>
              {mode.icon}
            </span>
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem"
};

const baseButton: CSSProperties = {
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  padding: "0.35rem 0.9rem",
  background: "rgba(15, 23, 42, 0.8)",
  color: "#cbd5f5",
  fontSize: "0.85rem",
  cursor: "pointer",
  transition: "background 120ms ease, color 120ms ease"
};

const buttonStyle: CSSProperties = {
  ...baseButton
};

const activeButtonStyle: CSSProperties = {
  ...baseButton,
  background: "#1d4ed8",
  borderColor: "#1d4ed8",
  color: "#f8fafc"
};
