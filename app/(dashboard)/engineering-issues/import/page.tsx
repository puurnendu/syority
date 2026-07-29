'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type DryRunResult = {
  import_id: string;
  detected_columns: string[];
  auto_mapped: Record<string, string>;
  unmapped_columns: string[];
  total_rows: number;
  preview: Array<{
    row_number: number;
    issue_number: string | null;
    equipment_tag: string | null;
    department: string | null;
    problem: string | null;
    priority: string | null;
    status: string;
    warnings: string[];
  }>;
  errors: Array<{ row: number; field: string; message: string }>;
};

const ISSUE_FIELDS = [
  { value: 'issue_number', label: 'Issue Number' },
  { value: 'equipment_tag_raw', label: 'Equipment Tag' },
  { value: 'equipment_desc_raw', label: 'Equipment Description' },
  { value: 'department', label: 'Department' },
  { value: 'problem', label: 'Problem Description' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'priority', label: 'Priority' },
  { value: 'severity', label: 'Severity' },
  { value: 'target_ta', label: 'Target TA' },
  { value: 'originator', label: 'Originator' },
  { value: 'raised_date', label: 'Raised Date' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'comments', label: 'Comments' },
  { value: 'discipline', label: 'Discipline' },
  { value: '', label: '— Skip —' },
];

const SOURCE_TYPES = [
  { value: 'excel', label: '📊 Excel Spreadsheet' },
  { value: 'csv', label: '📄 CSV File' },
  { value: 'cmms', label: '🔧 CMMS Export' },
  { value: 'sap', label: '⚙️ SAP Export' },
  { value: 'maximo', label: '🏭 Maximo Export' },
  { value: 'inspection', label: '🔍 Inspection Software' },
];

export default function ImportWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState('excel');
  const [department, setDepartment] = useState('');
  const [batchName, setBatchName] = useState('');
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);

  // AI extraction
  const [aiText, setAiText] = useState('');
  const [useAi, setUseAi] = useState(false);

  // Step 1 → Step 2: Dry run
  const handleDryRun = async () => {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/engineering-issues/import/dry-run', { method: 'POST', body: form });
    const data = await res.json();
    setDryResult(data);
    setMapping(data.auto_mapped || {});
    setBatchName(batchName || file.name.replace(/\.[^.]+$/, ''));
    setStep(2);
    setLoading(false);
  };

  // Step 2 → Step 3: Update mapping
  const updateMapping = (col: string, field: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (field) {
        next[col] = field;
      } else {
        delete next[col];
      }
      return next;
    });
  };

  // Step 3: Commit
  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('batch_name', batchName);
    form.append('source_type', sourceType);
    if (department) form.append('source_department', department);
    form.append('column_mapping', JSON.stringify(mapping));

    const res = await fetch('/api/engineering-issues/import/commit', { method: 'POST', body: form });
    const data = await res.json();
    setCommitResult(data);
    setStep(4);
    setLoading(false);
  };

  // AI extraction
  const handleAiExtract = async () => {
    if (!aiText.trim()) return;
    setLoading(true);
    const res = await fetch('/api/engineering-issues/import/ai-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: aiText,
        source_type: 'pdf',
        batch_name: batchName || 'AI Extracted Issues',
        department,
      }),
    });
    const data = await res.json();
    setCommitResult(data);
    setStep(4);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/engineering-issues" className="hover:text-blue-600">Scope Intelligence</Link>
        <span>→</span>
        <span className="text-gray-900 font-medium">Import Issues</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-8">
        {['Upload', 'Map Columns', 'Preview', 'Done'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step > i + 1 ? 'bg-emerald-500 text-white' :
              step === i + 1 ? 'bg-blue-600 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium ${step === i + 1 ? 'text-blue-600' : 'text-gray-500'}`}>{label}</span>
            {i < 3 && <span className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Upload Issue Register</h2>

          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setUseAi(false)}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${!useAi ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              📊 Excel / CSV
            </button>
            <button
              onClick={() => setUseAi(true)}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${useAi ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              🤖 AI Extract (PDF / Email / Text)
            </button>
          </div>

          {!useAi ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    {SOURCE_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Mechanical, Inspection"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Name</label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. Mech Dept Issue List Q3 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-4xl mb-3">📎</div>
                  <p className="text-gray-600 font-medium">{file ? file.name : 'Click to select file'}</p>
                  <p className="text-sm text-gray-400 mt-1">Excel (.xlsx, .xls) or CSV</p>
                </label>
              </div>

              <button
                onClick={handleDryRun}
                disabled={!file || loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Analysing...' : 'Analyse File →'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Name</label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. Inspection Email Batch"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Inspection"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paste text (PDF content, email body, WhatsApp export)
                </label>
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={12}
                  placeholder="Paste the text content here. AI will extract engineering issues automatically..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              <button
                onClick={handleAiExtract}
                disabled={!aiText.trim() || loading}
                className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? '🤖 Extracting...' : '🤖 AI Extract Issues →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && dryResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Map Columns</h2>
          <p className="text-sm text-gray-500 mb-4">
            {dryResult.total_rows} rows detected. {Object.keys(mapping).length} columns auto-mapped.
            {dryResult.unmapped_columns.length > 0 && ` ${dryResult.unmapped_columns.length} unmapped.`}
          </p>

          <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
            {dryResult.detected_columns.map((col) => (
              <div key={col} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-48 truncate font-mono" title={col}>{col}</span>
                <span className="text-gray-400">→</span>
                <select
                  value={mapping[col] || ''}
                  onChange={(e) => updateMapping(col, e.target.value)}
                  className={`flex-1 px-3 py-1.5 border rounded-lg text-sm ${
                    mapping[col] ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <option value="">— Skip —</option>
                  {ISSUE_FIELDS.filter((f) => f.value).map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!mapping.problem && !mapping.equipment_tag_raw}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Preview →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && dryResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Preview ({dryResult.total_rows} rows)</h2>

          {dryResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 font-medium">{dryResult.errors.length} errors found</p>
              {dryResult.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Issue #</th>
                  <th className="px-3 py-2 text-left">Tag</th>
                  <th className="px-3 py-2 text-left">Dept</th>
                  <th className="px-3 py-2 text-left">Problem</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dryResult.preview.map((row) => (
                  <tr key={row.row_number} className={row.status === 'error' ? 'bg-red-50' : row.status === 'warning' ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-2 text-gray-500">{row.row_number}</td>
                    <td className="px-3 py-2 font-mono">{row.issue_number || '—'}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{row.equipment_tag || '—'}</td>
                    <td className="px-3 py-2">{row.department || '—'}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{row.problem || '—'}</td>
                    <td className="px-3 py-2">{row.priority || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        row.status === 'valid' ? 'bg-emerald-100 text-emerald-800' :
                        row.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <button
              onClick={handleCommit}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Importing...' : `✅ Import ${dryResult.total_rows} Issues`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && commitResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete!</h2>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-6">
            <div>
              <p className="text-2xl font-bold text-blue-600">{commitResult.total_rows || commitResult.total_extracted || 0}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{commitResult.created || 0}</p>
              <p className="text-xs text-gray-400">Created</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{commitResult.errors || 0}</p>
              <p className="text-xs text-gray-400">Errors</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.push(`/engineering-issues/${commitResult.batch_id}`)}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              Review Batch →
            </button>
            <button
              onClick={() => { setStep(1); setFile(null); setDryResult(null); setCommitResult(null); setAiText(''); }}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50"
            >
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
