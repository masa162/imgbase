"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";

import { SUPPORTED_MIME_TYPES } from "../../lib/imageConverter";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function FileDropZone({ onFilesSelected, disabled = false }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled) {
        return;
      }

      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return;
      }

      onFilesSelected(fileArray);
    },
    [disabled, onFilesSelected]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      if (disabled) {
        return;
      }

      const { files } = event.dataTransfer;
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!disabled) {
        event.dataTransfer.dropEffect = "copy";
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onClickSelect = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files ?? []);
      event.target.value = "";
    },
    [handleFiles]
  );

  const className = [
    "converter-dropzone",
    isDragOver ? "converter-dropzone--active" : "",
    disabled ? "converter-dropzone--disabled" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      data-disabled={disabled}
    >
      <p className="converter-dropzone__title">ファイルをドラッグ＆ドロップ</p>
      <p className="converter-dropzone__subtitle">または</p>
      <button
        type="button"
        onClick={onClickSelect}
        disabled={disabled}
        className="converter-dropzone__button"
      >
        ファイルを選択
      </button>
      <p className="converter-dropzone__hint">対応形式: PNG / JPEG ・ 複数ファイル可 ・ クリップボード(Ctrl+V)対応</p>
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_MIME_TYPES.join(",")}
        multiple
        hidden
        onChange={onInputChange}
      />
    </div>
  );
}
