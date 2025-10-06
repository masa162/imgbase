"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface CopyButtonProps {
  value: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  title?: string;
}

export default function CopyButton({
  value,
  className,
  style,
  disabled = false,
  title = "URLをコピー"
}: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (!value || disabled) {
      return;
    }

    try {
      await copyText(value);
      setStatus("copied");
      timerRef.current = window.setTimeout(() => {
        setStatus("idle");
      }, 600);
    } catch (error) {
      console.error("Copy failed", error);
      setStatus("error");
      timerRef.current = window.setTimeout(() => {
        setStatus("idle");
      }, 1500);
    }
  }, [value, disabled]);

  const icon = status === "copied" ? "✓" : status === "error" ? "!" : "📋";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={{ ...baseStyle, ...style, opacity: disabled ? 0.5 : baseStyle.opacity }}
      disabled={disabled}
      aria-label={title}
      title={title}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  fallbackCopy(value);
}

function fallbackCopy(value: string) {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "2.25rem",
  padding: "0.25rem 0.6rem",
  borderRadius: "0.5rem",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  background: "rgba(15, 23, 42, 0.85)",
  color: "#e2e8f0",
  fontSize: "0.9rem",
  lineHeight: 1,
  cursor: "pointer",
  transition: "background 120ms ease, color 120ms ease",
  opacity: 1
};
