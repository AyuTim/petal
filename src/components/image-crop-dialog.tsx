"use client";

import { Check, Maximize2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };
type Size = { width: number; height: number };

export function ImageCropDialog({
  file,
  onCancel,
  onUseOriginal,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onUseOriginal: () => void;
  onConfirm: (file: File) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ origin: Point; x: number; y: number } | null>(null);
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [sourceSize, setSourceSize] = useState<Size | null>(null);
  const [frameSize, setFrameSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [error, setError] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setFrameSize({ width: frame.clientWidth, height: frame.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const baseScale = sourceSize && frameSize.width && frameSize.height
    ? Math.max(frameSize.width / sourceSize.width, frameSize.height / sourceSize.height)
    : 1;
  const renderSize = sourceSize ? { width: sourceSize.width * baseScale * zoom, height: sourceSize.height * baseScale * zoom } : null;

  function clamp(next: Point, nextZoom = zoom) {
    if (!sourceSize || !frameSize.width || !frameSize.height) return next;
    const scale = baseScale * nextZoom;
    const width = sourceSize.width * scale;
    const height = sourceSize.height * scale;
    return {
      x: Math.max(-(width - frameSize.width) / 2, Math.min((width - frameSize.width) / 2, next.x)),
      y: Math.max(-(height - frameSize.height) / 2, Math.min((height - frameSize.height) / 2, next.y)),
    };
  }

  function updateZoom(nextZoom: number) {
    setZoom(nextZoom);
    setPosition((current) => clamp(current, nextZoom));
  }

  function crop() {
    const image = imageRef.current;
    if (!image || !sourceSize || !frameSize.width || !frameSize.height || !renderSize) return;
    const sourceCropWidth = (frameSize.width / renderSize.width) * sourceSize.width;
    const sourceCropHeight = (frameSize.height / renderSize.height) * sourceSize.height;
    const sx = Math.max(0, Math.min(sourceSize.width - sourceCropWidth, sourceSize.width / 2 - sourceCropWidth / 2 - (position.x / renderSize.width) * sourceSize.width));
    const sy = Math.max(0, Math.min(sourceSize.height - sourceCropHeight, sourceSize.height / 2 - sourceCropHeight / 2 - (position.y / renderSize.height) * sourceSize.height));
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1400;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, sx, sy, sourceCropWidth, sourceCropHeight, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      onConfirm(new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="image-crop-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="image-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="image-crop-head">
          <div>
            <p className="image-crop-kicker">Photo</p>
            <h2 id="image-crop-title">Crop and frame</h2>
          </div>
          <button type="button" className="image-crop-close" onClick={onCancel} aria-label="Cancel photo crop">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          ref={frameRef}
          className="image-crop-frame"
          onPointerDown={(event) => {
            if (!sourceSize) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { origin: position, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            setPosition(clamp({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y }));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          {error ? (
            <p className="image-crop-error">This image can’t be cropped here. You can still use the original file.</p>
          ) : (
            <img
              ref={imageRef}
              src={sourceUrl}
              alt="Crop preview"
              draggable={false}
              className="image-crop-preview"
              style={renderSize ? { width: renderSize.width, height: renderSize.height, transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)` } : undefined}
              onLoad={(event) => setSourceSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setError(true)}
            />
          )}
          <span className="image-crop-grid" aria-hidden />
          <span className="image-crop-hint">Drag to reposition</span>
        </div>

        <div className="image-crop-zoom">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => updateZoom(Number(event.target.value))}
            aria-label="Zoom photo crop"
            disabled={!sourceSize || error}
          />
          <span>{Math.round(zoom * 100)}%</span>
        </div>

        <footer className="image-crop-actions">
          <button type="button" className="image-crop-text-btn" onClick={onUseOriginal}>Use original</button>
          <button type="button" className="image-crop-confirm" onClick={crop} disabled={!sourceSize || error}>
            <Check className="h-3.5 w-3.5" /> Use crop
          </button>
        </footer>
      </section>
    </div>
  );
}
