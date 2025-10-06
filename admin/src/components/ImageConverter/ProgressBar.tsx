"use client";

interface ProgressBarProps {
  label?: string;
}

export default function ProgressBar({ label = "変換中..." }: ProgressBarProps) {
  return (
    <div className="converter-progress" role="status" aria-live="polite">
      <span className="converter-progress__label">{label}</span>
      <div className="converter-progress__track">
        <div className="converter-progress__bar" />
      </div>
    </div>
  );
}
