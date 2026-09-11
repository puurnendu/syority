'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PidCropPanel, renderCropTiles, renderCropTilesFromImage, type CropRect } from '@/components/asset-register/PidCropPanel';
import { PidPdfCropSection } from '@/components/asset-register/PidPdfCropSection';

type PidItem = {
  item_type: string;
  tag_number: string;
  description: string | null;
  confidence: 'high' | 'medium' | 'low';
  source_page: number;
  already_exists: boolean;
};

type ExtractionResult = {
  job_id: string;
  drawing_number: string | null;
  drawing_title: string | null;
  revision: string | null;
  unit_area: string | null;
  items: PidItem[];
  equipment_count: number;
  line_count: number;
  source_filename?: string;
  pages_processed?: number[];
  tiles_processed?: number;
};

type UnitOption = { id: string; name: string; code: string; site_id: string; site_name: string };

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-red-100 text-red-800',
};

export default function PidExtractionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [crops, setCrops] = useState<CropRect[]>([]);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfPreviewImage, setPdfPreviewImage] = useState<HTMLImageElement | null>(null);
  const [pageNumbers, setPageNumbers] = useState('');
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'review' | 'committing'>('idle');
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/units')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? [];
        setUnits(
          list.map((u: any) => ({
            id: u.id,
            name: u.name ?? u.code,
            code: u.code ?? '',
            site_id: u.site_id ?? u.site?.id ?? '',
            site_name: u.site?.name ?? '',
          }))
        );
      })
      .catch(() => {});
  }, []);

  const equipment = useMemo(
    () => (result?.items ?? []).filter((i) => i.item_type === 'equipment'),
    [result]
  );
  const lines = useMemo(
    () => (result?.items ?? []).filter((i) => i.item_type === 'line'),
    [result]
  );
  const valves = useMemo(
    () => (result?.items ?? []).filter((i) => i.item_type === 'valve'),
    [result]
  );
  const instruments = useMemo(
    () => (result?.items ?? []).filter((i) => i.item_type === 'instrument'),
    [result]
  );

  const isPdfFile = (f: File) =>
    f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

  const handleUpload = async () => {
    if (!file) return;
    setStatus('processing');
    setError(null);
    setCommitResult(null);

    const formData = new FormData();
    const isImage = file.type.startsWith('image/');
    const isPdf = isPdfFile(file);
    if (crops.length > 0 && (isImage || isPdf)) {
      const tiles = pdfPreviewImage
        ? await renderCropTilesFromImage(pdfPreviewImage, crops)
        : await renderCropTiles(file, crops);
      for (const tile of tiles) {
        formData.append('tiles', tile, `tile-${crypto.randomUUID()}.png`);
      }
    }
    formData.append('file', file);
    if (unitId) formData.append('unit_id', unitId);
    if (crops.length === 0 && pageNumbers.trim()) {
      formData.append('page_numbers', pageNumbers.trim());
    } else if (crops.length > 0 && isPdf) {
      formData.append('page_numbers', String(pdfPageNumber));
    }

    try {
      const res = await fetch('/api/asset-register/extract-pid', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');

      setResult(data);
      const tagDefaults = new Set<string>();
      const lineDefaults = new Set<string>();
      for (const item of data.items ?? []) {
        if (item.already_exists) continue;
        if (['equipment', 'valve', 'instrument'].includes(item.item_type)) {
          tagDefaults.add(item.tag_number);
        }
        if (item.item_type === 'line') lineDefaults.add(item.tag_number);
      }
      setSelectedTags(tagDefaults);
      setSelectedLines(lineDefaults);
      setStatus('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
      setStatus('idle');
    }
  };

  const handleCommit = async () => {
    if (!result?.job_id) return;
    if (!unitId) {
      setError('Select a target unit before accepting tags into the Asset Register.');
      return;
    }
    setStatus('committing');
    setError(null);

    try {
      const res = await fetch(`/api/asset-register/extract-pid/${result.job_id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          accepted_tags: [...selectedTags],
          accepted_lines: [...selectedLines],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Accept failed');

      const parts = [
        `${data.assets_created} asset(s) created`,
        `${data.lines_created} line(s) created`,
      ];
      if (data.skipped > 0) parts.push(`${data.skipped} already existed (skipped)`);
      setCommitResult(parts.join(', '));
      setStatus('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Accept failed');
      setStatus('review');
    }
  };

  const toggleTag = (tag: string, exists: boolean) => {
    if (exists) return;
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const toggleLine = (line: string, exists: boolean) => {
    if (exists) return;
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/asset-register" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Asset Register
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">P&ID AI Extraction</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {status === 'idle' && (
          <div className="space-y-6">
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-blue-600 font-semibold">Upload a P&ID file</span>
                <input
                  id="file-upload"
                  type="file"
                  className="sr-only"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setCrops([]);
                    setPdfPageNumber(1);
                    setPdfPreviewImage(null);
                  }}
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">PDF, PNG, JPEG, WebP · max 10 MB</p>
              {file && <p className="text-sm font-medium text-gray-900 mt-3">{file.name}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-gray-600">Target unit (for accept step)</span>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select unit —</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.site_name ? `${u.site_name} / ` : ''}{u.code} — {u.name}
                    </option>
                  ))}
                </select>
              </label>
              {file && isPdfFile(file) ? (
                <div className="text-sm text-gray-500">
                  <span className="text-gray-600 font-medium">Multi-page extract</span>
                  <p className="text-xs text-gray-400 mt-1">
                    Use crop tiles below for one page, or leave crops empty and specify pages here.
                  </p>
                  <input
                    type="text"
                    value={pageNumbers}
                    onChange={(e) => setPageNumbers(e.target.value)}
                    placeholder="e.g. 1,2,3 or 1-3 (when not using crops)"
                    disabled={crops.length > 0}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  />
                </div>
              ) : (
                <label className="block text-sm">
                  <span className="text-gray-600">PDF pages (optional)</span>
                  <input
                    type="text"
                    value={pageNumbers}
                    onChange={(e) => setPageNumbers(e.target.value)}
                    placeholder="e.g. 1,2,3 or 1-3"
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-gray-400">
                    For multi-page PDFs without crop tiles.
                  </span>
                </label>
              )}
            </div>

            {file?.type.startsWith('image/') && (
              <PidCropPanel file={file} crops={crops} onCropsChange={setCrops} />
            )}

            {file && isPdfFile(file) && (
              <PidPdfCropSection
                file={file}
                pageNumber={pdfPageNumber}
                onPageNumberChange={setPdfPageNumber}
                crops={crops}
                onCropsChange={setCrops}
                onPreviewImageReady={setPdfPreviewImage}
              />
            )}

            {file && (
              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700"
                >
                  Start AI Extraction
                </button>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {status === 'processing' && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Processing P&ID</h3>
            <p className="text-sm text-gray-500 mt-2">Extracting equipment tags, lines, valves and instruments…</p>
          </div>
        )}

        {(status === 'review' || status === 'committing') && result && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Review extracted tags</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {result.source_filename && <>File: <strong>{result.source_filename}</strong> · </>}
                  {result.equipment_count} equipment · {result.line_count} lines
                  {result.tiles_processed ? ` · ${result.tiles_processed} crop tile(s)` : ''}
                  {!result.tiles_processed && result.pages_processed?.length
                    ? ` · pages ${result.pages_processed.join(', ')}`
                    : ''}
                </p>
                {(result.drawing_number || result.drawing_title) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {[result.drawing_number, result.drawing_title, result.revision && `Rev ${result.revision}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <label className="text-sm text-gray-600">
                  Unit for new assets/lines
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="">— Required —</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={handleCommit}
                  disabled={status === 'committing' || (!selectedTags.size && !selectedLines.size)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {status === 'committing' ? 'Accepting…' : `Accept selected (${selectedTags.size + selectedLines.size})`}
                </button>
              </div>
            </div>

            {commitResult && (
              <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                ✓ {commitResult}.{' '}
                <Link href="/asset-register" className="underline font-medium">Return to register</Link>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <section>
              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-3">Equipment tags</h4>
              {equipment.length === 0 ? (
                <p className="text-sm text-gray-400">No equipment tags extracted.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-2 border w-10" />
                        <th className="p-2 border text-left">Tag</th>
                        <th className="p-2 border text-left">Description</th>
                        <th className="p-2 border">Confidence</th>
                        <th className="p-2 border">Page</th>
                        <th className="p-2 border">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipment.map((eq) => (
                        <tr key={eq.tag_number} className={eq.already_exists ? 'bg-gray-50 opacity-70' : 'hover:bg-blue-50/40'}>
                          <td className="p-2 border text-center">
                            <input
                              type="checkbox"
                              checked={selectedTags.has(eq.tag_number)}
                              disabled={eq.already_exists}
                              onChange={() => toggleTag(eq.tag_number, eq.already_exists)}
                            />
                          </td>
                          <td className="p-2 border font-medium text-blue-700">{eq.tag_number}</td>
                          <td className="p-2 border text-gray-600">{eq.description ?? '—'}</td>
                          <td className="p-2 border text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONFIDENCE_STYLE[eq.confidence] ?? CONFIDENCE_STYLE.low}`}>
                              {eq.confidence}
                            </span>
                          </td>
                          <td className="p-2 border text-center text-gray-500">{eq.source_page}</td>
                          <td className="p-2 border text-center">
                            {eq.already_exists ? (
                              <span className="text-xs text-amber-700 font-medium">Already exists — skipping</span>
                            ) : (
                              <span className="text-xs text-gray-400">New</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-3">Line numbers</h4>
              {lines.length === 0 ? (
                <p className="text-sm text-gray-400">No lines extracted.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-2 border w-10" />
                        <th className="p-2 border text-left">Line number</th>
                        <th className="p-2 border text-left">Description</th>
                        <th className="p-2 border">Confidence</th>
                        <th className="p-2 border">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.tag_number} className={line.already_exists ? 'bg-gray-50 opacity-70' : 'hover:bg-blue-50/40'}>
                          <td className="p-2 border text-center">
                            <input
                              type="checkbox"
                              checked={selectedLines.has(line.tag_number)}
                              disabled={line.already_exists}
                              onChange={() => toggleLine(line.tag_number, line.already_exists)}
                            />
                          </td>
                          <td className="p-2 border font-medium text-blue-600">{line.tag_number}</td>
                          <td className="p-2 border text-gray-600">{line.description ?? '—'}</td>
                          <td className="p-2 border text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONFIDENCE_STYLE[line.confidence] ?? CONFIDENCE_STYLE.low}`}>
                              {line.confidence}
                            </span>
                          </td>
                          <td className="p-2 border text-center">
                            {line.already_exists ? (
                              <span className="text-xs text-amber-700 font-medium">Already exists — skipping</span>
                            ) : (
                              <span className="text-xs text-gray-400">New</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {valves.length > 0 && (
              <section>
                <h4 className="font-semibold text-gray-800 border-b pb-2 mb-3">Valve tags</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-2 border w-10" />
                        <th className="p-2 border text-left">Tag</th>
                        <th className="p-2 border text-left">Description</th>
                        <th className="p-2 border">Confidence</th>
                        <th className="p-2 border">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valves.map((v) => (
                        <tr key={v.tag_number} className={v.already_exists ? 'bg-gray-50 opacity-70' : 'hover:bg-blue-50/40'}>
                          <td className="p-2 border text-center">
                            <input
                              type="checkbox"
                              checked={selectedTags.has(v.tag_number)}
                              disabled={v.already_exists}
                              onChange={() => toggleTag(v.tag_number, v.already_exists)}
                            />
                          </td>
                          <td className="p-2 border font-medium text-purple-700">{v.tag_number}</td>
                          <td className="p-2 border text-gray-600">{v.description ?? '—'}</td>
                          <td className="p-2 border text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONFIDENCE_STYLE[v.confidence] ?? CONFIDENCE_STYLE.low}`}>
                              {v.confidence}
                            </span>
                          </td>
                          <td className="p-2 border text-center">
                            {v.already_exists ? (
                              <span className="text-xs text-amber-700 font-medium">Already exists — skipping</span>
                            ) : (
                              <span className="text-xs text-gray-400">New · asset_type: valve</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {instruments.length > 0 && (
              <section>
                <h4 className="font-semibold text-gray-800 border-b pb-2 mb-3">Instrument tags</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-2 border w-10" />
                        <th className="p-2 border text-left">Tag</th>
                        <th className="p-2 border text-left">Description</th>
                        <th className="p-2 border">Confidence</th>
                        <th className="p-2 border">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instruments.map((inst) => (
                        <tr key={inst.tag_number} className={inst.already_exists ? 'bg-gray-50 opacity-70' : 'hover:bg-blue-50/40'}>
                          <td className="p-2 border text-center">
                            <input
                              type="checkbox"
                              checked={selectedTags.has(inst.tag_number)}
                              disabled={inst.already_exists}
                              onChange={() => toggleTag(inst.tag_number, inst.already_exists)}
                            />
                          </td>
                          <td className="p-2 border font-medium text-teal-700">{inst.tag_number}</td>
                          <td className="p-2 border text-gray-600">{inst.description ?? '—'}</td>
                          <td className="p-2 border text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONFIDENCE_STYLE[inst.confidence] ?? CONFIDENCE_STYLE.low}`}>
                              {inst.confidence}
                            </span>
                          </td>
                          <td className="p-2 border text-center">
                            {inst.already_exists ? (
                              <span className="text-xs text-amber-700 font-medium">Already exists — skipping</span>
                            ) : (
                              <span className="text-xs text-gray-400">New · asset_type: instrument</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
