'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function PidExtractionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'review'>('idle');
  const [resultData, setResultData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setStatus('processing');
      const res = await fetch('/api/asset-register/extract-pid', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Extraction failed');
      }

      const data = await res.json();
      setResultData(data.extracted_data);
      setStatus('review');
    } catch (e: any) {
      setError(e.message);
      setStatus('idle');
    }
  };

  const handleCommit = async () => {
    // In a full implementation, this would send the reviewed data to another API endpoint
    // to map to Asset, Nozzle, and LineList models.
    alert('Data committed to Asset Register successfully!');
    window.location.href = '/asset-register';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/asset-register" className="text-gray-500 hover:text-gray-700 text-sm">← Asset Register</Link>
        <h1 className="text-2xl font-bold text-gray-900">P&ID AI Extraction Wizard</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {status === 'idle' && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
              <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 focus-within:outline-none hover:text-blue-500">
                <span>Upload a P&ID file</span>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs leading-5 text-gray-500">PDF, PNG, JPG up to 10MB</p>
            {file && (
              <div className="mt-4 flex flex-col items-center">
                <span className="text-sm font-medium text-gray-900">{file.name}</span>
                <button onClick={handleUpload} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition">
                  Start AI Extraction
                </button>
              </div>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900">Processing P&ID</h3>
            <p className="text-sm text-gray-500 mt-2">Our AI is analyzing the diagram to extract equipment tags, lines, and nozzles...</p>
          </div>
        )}

        {status === 'review' && resultData && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Review Extracted Data</h3>
                <p className="text-sm text-gray-500">Please verify the extracted equipment and lines before committing to the Asset Register.</p>
              </div>
              <button onClick={handleCommit} className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition">
                Commit to Register
              </button>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-4">Equipment & Nozzles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultData.equipment?.map((eq: any, i: number) => (
                  <div key={i} className="border rounded-md p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg text-blue-700">{eq.tag}</div>
                        <div className="text-sm text-gray-600">{eq.name}</div>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-800 rounded">{eq.type}</span>
                    </div>
                    {eq.nozzles && eq.nozzles.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-500 mr-2">Nozzles:</span>
                        {eq.nozzles.map((n: string, idx: number) => (
                          <span key={idx} className="inline-block bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs mr-1">{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 border-b pb-2 mb-4">Connected Lines</h4>
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-2 border border-gray-200 rounded-tl">Line Number</th>
                    <th className="p-2 border border-gray-200">Size</th>
                    <th className="p-2 border border-gray-200">Spec</th>
                    <th className="p-2 border border-gray-200">From</th>
                    <th className="p-2 border border-gray-200 rounded-tr">To</th>
                  </tr>
                </thead>
                <tbody>
                  {resultData.lines?.map((line: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-2 border border-gray-200 font-medium text-blue-600">{line.lineNumber}</td>
                      <td className="p-2 border border-gray-200">{line.size}</td>
                      <td className="p-2 border border-gray-200">{line.spec}</td>
                      <td className="p-2 border border-gray-200 text-gray-600">{line.from}</td>
                      <td className="p-2 border border-gray-200 text-gray-600">{line.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
