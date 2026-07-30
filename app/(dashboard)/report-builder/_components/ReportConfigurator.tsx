'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  definitionId: string;
  canBuild: boolean;
}

export function ReportConfigurator({ definitionId, canBuild }: Props) {
  const { data, error, isLoading } = useSWR(`/api/report-builder/definitions/${definitionId}`, fetcher);

  // Configuration state
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [includeAi, setIncludeAi] = useState(false);
  const [params, setParams] = useState<Record<string, any>>({});
  const [paramOptions, setParamOptions] = useState<Record<string, Array<{ value: string; label: string }>>>({});

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<any>(null);

  const def = data?.definition;

  // Initialize selected sections from defaults
  useEffect(() => {
    if (def?.sections) {
      setSelectedSections(
        def.sections.filter((s: any) => s.is_default || s.is_required).map((s: any) => s.key)
      );
      setOutputFormat(def.default_output ?? 'pdf');
    }
  }, [def]);

  // Load dynamic options for parameters
  useEffect(() => {
    if (!def?.parameters) return;
    for (const link of def.parameters) {
      const p = link.parameter;
      if (p.options_source) {
        fetch(`/api/report-builder/parameters/${p.key}/options`)
          .then((r) => r.json())
          .then((d) => setParamOptions((prev) => ({ ...prev, [p.key]: d.options ?? [] })));
      } else if (p.options_static) {
        setParamOptions((prev) => ({ ...prev, [p.key]: p.options_static }));
      }
    }
  }, [def]);

  const toggleSection = useCallback((key: string, required: boolean) => {
    if (required) return;
    setSelectedSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewHtml(null);
    try {
      const res = await fetch('/api/report-builder/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition_id: definitionId,
          selected_sections: selectedSections,
          parameters: params,
          include_ai_summary: includeAi,
        }),
      });
      if (res.ok) {
        const html = await res.text();
        setPreviewHtml(html);
      }
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch('/api/report-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition_id: definitionId,
          output_format: outputFormat,
          selected_sections: selectedSections,
          parameters: params,
          include_ai_summary: includeAi,
        }),
      });
      const result = await res.json();
      setGenResult(result);
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#E8701A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !def) {
    return <div className="p-8 text-center text-red-500">Report definition not found</div>;
  }

  const supportsOutputs = def.supports_outputs ?? ['html', 'pdf', 'excel', 'csv'];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/report-builder" className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${getCatColor(def.category?.slug)}15`, color: getCatColor(def.category?.slug) }}>
                {def.category?.icon} {def.category?.name}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#0D2137] mt-1">{def.name}</h1>
            {def.description && <p className="text-sm text-gray-500 mt-1">{def.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {previewing ? '⏳ Loading...' : '👁️ Preview'}
          </button>
          {canBuild && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white bg-[#E8701A] rounded-lg hover:bg-[#d4631a] disabled:opacity-50 transition-colors"
            >
              {generating ? '⏳ Generating...' : '📄 Generate Report'}
            </button>
          )}
        </div>
      </div>

      {/* Success Banner */}
      {genResult?.status === 'completed' && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center justify-between">
          <span className="text-green-800 font-medium text-sm">✅ Report generated successfully!</span>
          <a
            href={`/api/report-builder/generations/${genResult.generationId}/download`}
            className="text-sm font-medium text-green-700 hover:text-green-900 underline"
          >
            Download
          </a>
        </div>
      )}
      {genResult?.status === 'failed' && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-red-800 text-sm font-medium">
          ❌ Generation failed: {genResult.error}
        </div>
      )}

      {/* Config + Preview Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Configuration */}
        <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto p-5 flex-shrink-0">
          {/* Parameters */}
          {def.parameters?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0D2137] mb-3">🔧 Parameters</h3>
              <div className="space-y-3">
                {def.parameters.map((link: any) => {
                  const p = link.parameter;
                  const options = paramOptions[p.key] ?? [];
                  return (
                    <div key={p.id}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {p.name} {link.is_required && <span className="text-red-500">*</span>}
                      </label>
                      {(p.param_type === 'select' || p.param_type === 'multi_select') ? (
                        <select
                          value={params[p.key] ?? ''}
                          onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8701A] focus:border-transparent"
                        >
                          <option value="">All</option>
                          {options.map((o: any) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : p.param_type === 'date' || p.param_type === 'date_range' ? (
                        <input
                          type="date"
                          value={params[p.key] ?? ''}
                          onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8701A] focus:border-transparent"
                        />
                      ) : p.param_type === 'boolean' ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={params[p.key] ?? false}
                            onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-600">Enabled</span>
                        </label>
                      ) : (
                        <input
                          type="text"
                          value={params[p.key] ?? ''}
                          onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8701A] focus:border-transparent"
                          placeholder={p.description ?? ''}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sections */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#0D2137] mb-3">📑 Sections</h3>
            <div className="space-y-2">
              {def.sections?.map((s: any) => (
                <label
                  key={s.key}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedSections.includes(s.key) ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'
                  } ${s.is_required ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(s.key)}
                    onChange={() => toggleSection(s.key, s.is_required)}
                    disabled={s.is_required}
                    className="rounded border-gray-300 text-[#E8701A]"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.section_type} {s.is_required ? '(required)' : ''}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Output Format */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#0D2137] mb-3">📄 Output Format</h3>
            <div className="flex gap-2 flex-wrap">
              {supportsOutputs.map((fmt: string) => (
                <button
                  key={fmt}
                  onClick={() => setOutputFormat(fmt)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    outputFormat === fmt
                      ? 'bg-[#E8701A] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* AI Summary */}
          {def.supports_ai_summary && (
            <div className="mb-6">
              <label className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAi}
                  onChange={(e) => setIncludeAi(e.target.checked)}
                  className="rounded border-purple-300 text-purple-600"
                />
                <div>
                  <div className="text-sm font-medium text-purple-800">🤖 AI Executive Summary</div>
                  <div className="text-xs text-purple-600">Generate an AI-powered executive summary</div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          {previewHtml ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">PREVIEW</span>
                <button
                  onClick={() => setPreviewHtml(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕ Close
                </button>
              </div>
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ minHeight: '600px', height: '80vh' }}
                title="Report Preview"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-lg font-medium">Configure & Preview</p>
                <p className="text-sm mt-2">Adjust parameters and sections, then click Preview to see your report</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getCatColor(slug?: string) {
  const colors: Record<string, string> = {
    planning: '#2563EB', shutdown: '#DC2626', execution: '#059669',
    management: '#7C3AED', platform: '#0D2137',
  };
  return colors[slug ?? ''] ?? '#6B7280';
}
