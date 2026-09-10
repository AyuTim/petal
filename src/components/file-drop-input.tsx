"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

type FileDropInputProps = {
  accept: string;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  onFile: (file: File) => void;
};

/**
 * A single-file picker that also understands image drops and pasted clipboard files.
 * The visible wrapper remains compatible with the app's existing photo-drop styling.
 */
export function FileDropInput({ accept, ariaLabel, className = "", children, disabled = false, onFile }: FileDropInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accepts(file: File) {
    return accept.split(",").some((rule) => {
      const value = rule.trim().toLowerCase();
      if (!value) return false;
      if (value.endsWith("/*")) return file.type.toLowerCase().startsWith(value.slice(0, -1));
      if (value.startsWith(".")) return file.name.toLowerCase().endsWith(value);
      return file.type.toLowerCase() === value;
    });
  }

  function choose(files: FileList | File[] | null) {
    if (disabled || !files) return;
    const file = Array.from(files).find(accepts);
    if (file) onFile(file);
  }

  function hasFiles(event: DragEvent<HTMLDivElement>) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      title="Click, drop, or paste a file"
      className={`file-drop-input ${className} ${dragging ? "is-file-dragging" : ""}`.trim()}
      onClick={(event) => {
        if (event.target === inputRef.current) return;
        openPicker();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDragging(false);
        choose(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        const files = event.clipboardData.files;
        if (!Array.from(files).some(accepts)) return;
        event.preventDefault();
        choose(files);
      }}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          choose(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
