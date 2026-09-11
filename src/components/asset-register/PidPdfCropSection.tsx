'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PidCropPanel, renderCropTilesFromImage, type CropRect } from '@/components/asset-register/PidCropPanel';
import { getPdfPageCount, renderPdfPageToBlob, loadImageFromBlob } from '@/components/asset-register/pidPdfPreview';

type Props = {
  file: File;
  pageNumber: number;
  onPageNumberChange: (page: number) => void;
  crops: CropRect[];
  onCropsChange: (crops: CropRect[]) => void;
  onPreviewImageReady: (img: HTMLImageElement | null) => void;
};

export function PidPdfCropSection({
  file,
  pageNumber,
  onPageNumberChange,
  crops,
  onCropsChange,
  onPreviewImageReady,
}: Props) {
  const [pageCount, setPageCount] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPdfPageCount(file)
      .then((count) => {
        if (!cancelled) {
          setPageCount(count);
          if (pageNumber > count) onPageNumberChange(1);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not read PDF page count');
      });
    return () => {
      cancelled = true;
    };
  }, [file, onPageNumberChange, pageNumber]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    onPreviewImageReady(null);
    onCropsChange([]);

    renderPdfPageToBlob(file, pageNumber)
      .then(async (rendered) => {
        if (cancelled) return;
        const img = await loadImageFromBlob(rendered.blob);
        previewImageRef.current = img;
        onPreviewImageReady(img);
        const url = URL.createObjectURL(rendered.blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setNaturalSize({ w: rendered.width, h: rendered.height });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to render PDF page');
          onPreviewImageReady(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, pageNumber]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">
          PDF page to preview
          <select
            value={pageNumber}
            onChange={(e) => onPageNumberChange(parseInt(e.target.value, 10))}
            className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                Page {p}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-gray-400">
          {pageCount} page{pageCount !== 1 ? 's' : ''} total · crop tiles apply to the selected page
        </span>
      </div>

      {loading && <p className="text-sm text-gray-500">Rendering page for crop…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {!loading && previewUrl && naturalSize.w > 0 && (
        <PidCropPanel
          previewUrl={previewUrl}
          naturalSize={naturalSize}
          crops={crops}
          onCropsChange={onCropsChange}
        />
      )}
    </div>
  );
}
