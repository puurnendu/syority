'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type CropRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  /** Direct image upload — provide `file` OR `previewUrl` + `naturalSize`. */
  file?: File | null;
  previewUrl?: string | null;
  naturalSize?: { w: number; h: number };
  crops: CropRect[];
  onCropsChange: (crops: CropRect[]) => void;
};

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/** Render crop regions as PNG blobs at native resolution for vision extraction. */
export async function renderCropTilesFromImage(
  img: HTMLImageElement,
  crops: CropRect[]
): Promise<Blob[]> {
  if (crops.length === 0) return [];
  const blobs: Blob[] = [];

  for (const crop of crops) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width));
    canvas.height = Math.max(1, Math.round(crop.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png', 0.92)
    );
    if (blob) blobs.push(blob);
  }

  return blobs;
}

export async function renderCropTiles(file: File, crops: CropRect[]): Promise<Blob[]> {
  if (crops.length === 0) return [];
  const img = await loadImageFromFile(file);
  return renderCropTilesFromImage(img, crops);
}

export function PidCropPanel({
  file = null,
  previewUrl: previewUrlProp = null,
  naturalSize: naturalSizeProp,
  crops,
  onCropsChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(
    null
  );

  useEffect(() => {
    if (previewUrlProp) {
      setPreviewUrl(previewUrlProp);
      if (naturalSizeProp) setNaturalSize(naturalSizeProp);
      return;
    }

    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      setNaturalSize({ w: 0, h: 0 });
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file, previewUrlProp, naturalSizeProp]);

  useEffect(() => {
    if (!containerRef.current || !previewUrl) return;
    const ro = new ResizeObserver(() => {
      const el = containerRef.current?.querySelector('img');
      if (el) {
        setDisplaySize({ w: el.clientWidth, h: el.clientHeight });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [previewUrl]);

  const scaleX = naturalSize.w > 0 ? displaySize.w / naturalSize.w : 1;
  const scaleY = naturalSize.h > 0 ? displaySize.h / naturalSize.h : 1;

  const toNatural = useCallback(
    (clientX: number, clientY: number) => {
      const img = containerRef.current?.querySelector('img');
      if (!img) return { x: 0, y: 0 };
      const rect = img.getBoundingClientRect();
      const x = Math.max(0, Math.min(naturalSize.w, (clientX - rect.left) / scaleX));
      const y = Math.max(0, Math.min(naturalSize.h, (clientY - rect.top) / scaleY));
      return { x, y };
    },
    [naturalSize.w, naturalSize.h, scaleX, scaleY]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!previewUrl) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const { x, y } = toNatural(e.clientX, e.clientY);
    setDrawing({ startX: x, startY: y, curX: x, curY: y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing) return;
    const { x, y } = toNatural(e.clientX, e.clientY);
    setDrawing({ ...drawing, curX: x, curY: y });
  };

  const onPointerUp = () => {
    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.curX);
    const y = Math.min(drawing.startY, drawing.curY);
    const width = Math.abs(drawing.curX - drawing.startX);
    const height = Math.abs(drawing.curY - drawing.startY);
    setDrawing(null);

    if (width < 40 || height < 40) return;

    onCropsChange([
      ...crops,
      { id: crypto.randomUUID(), x, y, width, height },
    ]);
  };

  const removeCrop = (id: string) => {
    onCropsChange(crops.filter((c) => c.id !== id));
  };

  if (!previewUrl && !file?.type.startsWith('image/')) return null;

  const draftRect = drawing
    ? {
        x: Math.min(drawing.startX, drawing.curX),
        y: Math.min(drawing.startY, drawing.curY),
        width: Math.abs(drawing.curX - drawing.startX),
        height: Math.abs(drawing.curY - drawing.startY),
      }
    : null;

  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">Crop regions (optional)</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Drag on the preview to define tiles for dense P&ID sheets. Each crop is sent separately to
            the vision model for better tag accuracy.
          </p>
        </div>
        {crops.length > 0 && (
          <button
            type="button"
            onClick={() => onCropsChange([])}
            className="text-xs text-gray-600 hover:text-gray-900 underline"
          >
            Clear crops — use full image
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative inline-block max-w-full select-none touch-none cursor-crosshair border border-gray-300 rounded bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setDrawing(null)}
      >
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="P&ID preview" className="max-w-full h-auto block" draggable={false} />
        )}
        {crops.map((crop, idx) => (
          <div
            key={crop.id}
            className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
              left: crop.x * scaleX,
              top: crop.y * scaleY,
              width: crop.width * scaleX,
              height: crop.height * scaleY,
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] font-bold text-blue-700 bg-white/90 px-1 rounded">
              Tile {idx + 1}
            </span>
          </div>
        ))}
        {draftRect && (
          <div
            className="absolute border-2 border-dashed border-amber-500 bg-amber-400/10 pointer-events-none"
            style={{
              left: draftRect.x * scaleX,
              top: draftRect.y * scaleY,
              width: draftRect.width * scaleX,
              height: draftRect.height * scaleY,
            }}
          />
        )}
      </div>

      {crops.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {crops.map((crop, idx) => (
            <li
              key={crop.id}
              className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-gray-200 rounded text-xs"
            >
              <span>
                Tile {idx + 1}: {Math.round(crop.width)}×{Math.round(crop.height)} px
              </span>
              <button
                type="button"
                onClick={() => removeCrop(crop.id)}
                className="text-red-600 hover:text-red-800"
                aria-label={`Remove tile ${idx + 1}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-gray-400">
        {crops.length === 0
          ? 'No crops defined — the full image will be used.'
          : `${crops.length} tile(s) will be extracted instead of the full sheet.`}
      </p>
    </div>
  );
}
