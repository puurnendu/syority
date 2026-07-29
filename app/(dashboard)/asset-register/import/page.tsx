'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { HierarchySelector, type HierarchySelection } from '@/components/hierarchy/HierarchySelector';

export default function AssetImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [hierarchySelection, setHierarchySelection] = useState<Partial<HierarchySelection>>({
    site_id: '', plant_id: '', area_id: '', unit_id: '',
  });
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpload = async () => {
    if (!file || !hierarchySelection.site_id || !hierarchySelection.unit_id) {
      setErrorMsg('Please select a file, site, and unit.');
      return;
    }
    
    setStatus('uploading');
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('site_id', hierarchySelection.site_id);
    formData.append('unit_id', hierarchySelection.unit_id);

    try {
      const res = await fetch('/api/line-lists/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }

      const data = await res.json();
      setResult(data);
      setStatus('success');
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/asset-register" className="text-gray-500 hover:text-gray-700 text-sm">← Asset Register</Link>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <p className="text-sm text-gray-600 mb-6">Upload an Excel (.xlsx) file containing your Line List (Sheet 1) and Joint Masters (Sheet 2).</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Hierarchy *</label>
            <HierarchySelector
              value={hierarchySelection}
              onChange={setHierarchySelection}
              requiredLevel="unit"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Excel File</label>
          <input 
            type="file" 
            accept=".xlsx, .xls"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-md p-1"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {errorMsg && status === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
            {errorMsg}
          </div>
        )}

        {status === 'success' && result && (
          <div className="mb-4 p-4 bg-green-50 text-green-800 rounded-md text-sm border border-green-200">
            <h3 className="font-bold mb-2">Import Successful!</h3>
            <ul className="list-disc pl-5">
              <li>{result.linesImported} Line Lists imported</li>
              <li>{result.jointsImported} Joint Masters imported</li>
            </ul>
          </div>
        )}

        <div>
          <button 
            onClick={handleUpload}
            disabled={status === 'uploading'}
            className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {status === 'uploading' ? 'Importing...' : 'Upload & Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
