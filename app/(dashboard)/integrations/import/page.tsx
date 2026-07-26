'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ScheduleImportPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [uploading, setUploading] = useState<string | null>(null); // format key
  const [statusMessage, setStatusMessage] = useState<string>('Uploading...');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ imported: number; relationships: number } | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.projects) setProjects(data.projects);
        else if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval: any;
    if (uploading && selectedProjectId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/projects/${selectedProjectId}/import/status`);
          const data = await res.json();
          if (data.status) setStatusMessage(data.status);
        } catch (e) {}
      }, 1500);
    } else {
      setStatusMessage('Uploading...');
    }
    return () => clearInterval(interval);
  }, [uploading, selectedProjectId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, formatId: string, endpoint: string) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;

    setUploading(formatId);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/import/${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess({ imported: data.imported, relationships: data.relationships });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(null);
      if (e.target) e.target.value = ''; // reset input
    }
  };

  const formats = [
    { id: 'ms-project', title: 'MS Project XML', ext: '.xml', endpoint: 'ms-project', desc: 'Microsoft Project 2019+ XML format' },
    { id: 'p6-xml', title: 'Primavera P6 XML', ext: '.xml', endpoint: 'p6-xml', desc: 'Primavera P6 standard XML format' },
    { id: 'p6-xer', title: 'Primavera P6 XER', ext: '.xer', endpoint: 'p6-xer', desc: 'Primavera P6 proprietary export format' }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Schedule Import</h1>
      <p className="text-sm text-gray-400 mb-8">
        Import schedules from Primavera P6 XER, MS Project XML or Excel.
      </p>

      {/* Project Selector */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
        <select
          className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white border outline-none"
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
        >
          <option value="">-- Select a project --</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
          ))}
        </select>
        {!selectedProjectId && (
          <p className="text-xs text-amber-600 mt-2">⚠ Select a project first to enable imports.</p>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm flex items-center justify-between">
          <div>
            <strong>Success:</strong> ✓ Imported {success.imported} activities, {success.relationships} relationships.
          </div>
          <Link
            href={`/projects/${selectedProjectId}/schedule`}
            className="ml-4 px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-xs whitespace-nowrap"
          >
            View Project Schedule
          </Link>
        </div>
      )}

      {/* Format Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {formats.map(f => (
          <div key={f.id} className="bg-white border text-left border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors flex flex-col">
            <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4 flex-1">{f.desc}</p>
            
            <div className="mt-auto">
              {uploading === f.id ? (
                <div className="text-sm text-indigo-600 font-medium py-2 text-center border border-indigo-100 bg-indigo-50 rounded-lg">
                  {statusMessage}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept={f.ext}
                    onChange={(e) => handleFileChange(e, f.id, f.endpoint)}
                    disabled={!selectedProjectId}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    title={!selectedProjectId ? 'Select a project first' : `Upload ${f.title}`}
                  />
                  <div className={`text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors ${selectedProjectId ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                    Choose {f.ext} file
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
