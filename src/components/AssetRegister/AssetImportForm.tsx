'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  code: string | null;
}

interface AssetImportFormProps {
  sites: Site[];
}

export function AssetImportForm({ sites }: AssetImportFormProps) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created?: number; updated?: number; skipped?: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!siteId) { setError('Select a site'); return; }
    if (!file) { setError('Choose an Excel file'); return; }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('site_id', siteId);
      const res = await fetch('/api/assets/import', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? 'Import failed'); return; }
      setResult({ created: data.created, updated: data.updated, skipped: data.skipped });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch { setError('Request failed'); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/asset-register" className="text-sm text-gray-500 hover:text-gray-700">← Asset Register</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import Assets from Excel</h1>
      <div className="mb-4">
        <a href="/api/assets/import/template" target="_blank" rel="noreferrer" className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 inline-block">
          Download template
        </a>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        {error && <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}
        {result && (
          <div className="p-3 rounded-md bg-green-50 text-green-800 text-sm">
            Created: {result.created ?? 0}, Updated: {result.updated ?? 0}, Skipped: {result.skipped ?? 0}.
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site *</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required>
            <option value="">Select site</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excel file *</label>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={isSubmitting || !file} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? 'Importing…' : 'Import'}
          </button>
          <Link href="/asset-register" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200">Back</Link>
        </div>
      </form>
    </div>
  );
}
