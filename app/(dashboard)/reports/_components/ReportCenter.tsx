'use client';

/**
 * M14-R5 — Enterprise Report Center & Consumption Workspace
 *
 * Provides a responsive, unified report catalog, template management,
 * filter builder, live preview, and embedded visual designer workspace.
 *
 * Supported Modes:
 * - Center / Catalog Workspace (Desktop, Tablet, Mobile)
 * - Visual Report Designer (Full Canvas Mode)
 *
 * Consumes:
 * - DimensionRegistry (standard + tenant UDFs)
 * - ControlledValueResolver (controlled master dimensions)
 * - Immutable ReportDataset (R1–R4 pipeline)
 * - R4 Multi-Format Renderers (HTML, PDF, XLSX, CSV)
 *
 * ZERO business calculations. ZERO metric recalculations.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ReportFilterBuilder, FilterState } from '@/components/reports/ReportFilterBuilder';
import { ReportDesigner } from '@/components/reports/ReportDesigner';
import type { ReportLayoutModel } from '@/core/report-builder/ReportDesignerStateManager';

interface ReportDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  data_source_key: string;
  category?: {
    name: string;
    slug: string;
  };
}

interface SavedTemplateItem {
  id: string;
  name: string;
  description?: string;
  definition_id: string;
  output_format: string;
  parameters: Record<string, any>;
  is_shared: boolean;
  definition?: {
    name: string;
    slug: string;
  };
  created_at: string;
}

interface GenerationHistoryItem {
  id: string;
  definition_id: string;
  output_format: string;
  status: string;
  dataset_hash?: string;
  created_at: string;
  definition?: {
    name: string;
  };
}

const STANDARD_CATEGORIES = [
  { id: 'all', name: 'All Standard Reports', icon: '📂' },
  { id: 'executive', name: 'Executive & EVM', icon: '📊' },
  { id: 'progress', name: 'Physical Progress', icon: '📈' },
  { id: 'planning', name: 'CPM & Schedule', icon: '📋' },
  { id: 'execution', name: 'Field Execution', icon: '⚡' },
  { id: 'readiness', name: 'Gate Readiness', icon: '🛡️' },
  { id: 'management', name: 'Control Tower', icon: '💼' },
];

export function ReportCenter() {
  const [activeTab, setActiveTab] = useState<'standard' | 'templates' | 'recent' | 'schedules'>('standard');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [templates, setTemplates] = useState<SavedTemplateItem[]>([]);
  const [recentGenerations, setRecentGenerations] = useState<GenerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Filters State (managed by ReportFilterBuilder)
  const [filters, setFilters] = useState<FilterState>({});

  // Preview and Designer Modes
  const [viewMode, setViewMode] = useState<'cards' | 'html' | 'designer'>('cards');
  const [dataset, setDataset] = useState<any | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch('/api/report-builder/definitions').then((r) => r.json()),
      fetch('/api/report-builder/views').then((r) => r.json()).catch(() => []),
      fetch('/api/report-builder/generations').then((r) => r.json()).catch(() => []),
    ])
      .then(([defsData, viewsData, gensData]) => {
        if (!isMounted) return;
        const defs = Array.isArray(defsData) ? defsData : defsData.definitions ?? [];
        setDefinitions(defs);
        setTemplates(Array.isArray(viewsData) ? viewsData : []);
        setRecentGenerations(Array.isArray(gensData) ? gensData : []);

        if (defs.length > 0) {
          setSelectedReport(defs[0]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getAuthorityBadge = (key: string) => {
    if (key.startsWith('planning.lookahead') || key.includes('delay') || key.includes('plan_vs_actual')) {
      return { label: 'M12 Execution Authority', color: 'bg-amber-100 text-amber-800' };
    }
    if (key.includes('critical') || key.includes('health') || key.includes('schedule')) {
      return { label: 'M11 CPM Authority', color: 'bg-indigo-100 text-indigo-800' };
    }
    if (key.includes('identical') || key.includes('progress')) {
      return { label: 'M8.13 Progress Authority', color: 'bg-blue-100 text-blue-800' };
    }
    if (key.includes('scurve') || key.includes('executive') || key.includes('spi') || key.includes('cpi')) {
      return { label: 'M8.10 EVM Authority', color: 'bg-emerald-100 text-emerald-800' };
    }
    if (key.includes('readiness')) {
      return { label: 'M10 Readiness Authority', color: 'bg-purple-100 text-purple-800' };
    }
    if (key.includes('control_tower') || key.includes('exception')) {
      return { label: 'M13 Intelligence Authority', color: 'bg-rose-100 text-rose-800' };
    }
    return { label: 'Standard Reporting', color: 'bg-gray-100 text-gray-700' };
  };

  const filteredReports = useMemo(() => {
    if (selectedCategory === 'all') return definitions;
    return definitions.filter((d) => {
      const s = d.category?.slug?.toLowerCase() || '';
      if (selectedCategory === 'executive') return s === 'management' || d.slug.includes('executive') || d.slug.includes('scurve');
      if (selectedCategory === 'progress') return s === 'shutdown' || d.slug.includes('progress') || d.slug.includes('identical');
      if (selectedCategory === 'planning') return s === 'planning' || d.slug.includes('critical') || d.slug.includes('constraint');
      if (selectedCategory === 'execution') return s === 'execution' || d.slug.includes('lookahead') || d.slug.includes('delay');
      if (selectedCategory === 'readiness') return d.slug.includes('readiness');
      if (selectedCategory === 'management') return s === 'management';
      return true;
    });
  }, [definitions, selectedCategory]);

  const handleGeneratePreview = async (asHtml: boolean = false) => {
    if (!selectedReport) return;
    setGenerating(true);
    setPreviewError(null);

    try {
      if (asHtml) {
        const res = await fetch('/api/report-builder/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            definition_id: selectedReport.id,
            parameters: filters,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Preview generation failed' }));
          throw new Error(errData.error || 'Preview generation failed');
        }
        const html = await res.text();
        setHtmlContent(html);
        setViewMode('html');
      } else {
        const res = await fetch('/api/report-builder/preview?as_dataset=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            definition_id: selectedReport.id,
            parameters: filters,
            format: 'dataset',
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Failed to generate dataset' }));
          throw new Error(errData.error || 'Failed to generate dataset');
        }
        const data = await res.json();
        setDataset(data.dataset);
        setViewMode('cards');
      }
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'csv' | 'html') => {
    if (!selectedReport) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/report-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition_id: selectedReport.id,
          output_format: format,
          parameters: filters,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }

      const data = await res.json();
      alert(`Report export created successfully!\nFormat: ${format.toUpperCase()}\nStatus: ${data.status}\nGeneration ID: ${data.generationId}`);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // If in Visual Designer mode, render the full-screen ReportDesigner
  if (viewMode === 'designer' && selectedReport) {
    return (
      <ReportDesigner
        definitionId={selectedReport.id}
        definitionName={selectedReport.name}
        dataset={dataset}
        onClose={() => setViewMode('cards')}
        onSave={async (layout) => {
          await fetch('/api/report-builder/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              definitionId: selectedReport.id,
              name: `${selectedReport.name} Custom Template`,
              parameters: filters,
              selectedSections: layout.sections.map((s) => s.id),
              outputFormat: 'pdf',
            }),
          });
        }}
        onSaveAs={async (newName, layout) => {
          await fetch('/api/report-builder/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              definitionId: selectedReport.id,
              name: newName,
              parameters: filters,
              selectedSections: layout.sections.map((s) => s.id),
              outputFormat: 'pdf',
            }),
          });
        }}
        onExport={handleExport}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-medium">
        Loading Report Center workspace...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-h-[720px] text-gray-900">
      {/* ─── Top Workspace Navigation Bar ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Enterprise Report Center</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Governed reporting, visual layout designer, and multi-format export workspace
          </p>
        </div>

        {/* View Mode & Designer Trigger */}
        <div className="flex items-center gap-2">
          {selectedReport && (
            <button
              type="button"
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs"
              onClick={() => setViewMode('designer')}
            >
              <span>🎨</span>
              <span>Open Visual Designer</span>
            </button>
          )}

          {/* Tab Switcher */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'standard' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('standard')}
            >
              Standard Reports ({definitions.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'templates' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('templates')}
            >
              My Templates ({templates.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'recent' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('recent')}
            >
              Recent Exports ({recentGenerations.length})
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content Layout ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Report / Template List Sidebar */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
          {activeTab === 'standard' && (
            <>
              {/* Category Filter Cards */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                  Report Domains
                </h2>
                <div className="space-y-1">
                  {STANDARD_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg font-medium transition ${
                        selectedCategory === cat.id
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Standard Reports List */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm overflow-auto max-h-[520px]">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                  Available Catalog ({filteredReports.length})
                </h2>
                <div className="space-y-1.5">
                  {filteredReports.map((def) => {
                    const badge = getAuthorityBadge(def.data_source_key);
                    const isSelected = selectedReport?.id === def.id;
                    return (
                      <button
                        key={def.id}
                        type="button"
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 shadow-xs'
                            : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedReport(def);
                          setDataset(null);
                          setHtmlContent(null);
                        }}
                      >
                        <div className="font-semibold text-gray-900 text-xs leading-tight">{def.name}</div>
                        <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">{def.description}</div>
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'templates' && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm overflow-auto max-h-[620px]">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Saved Templates ({templates.length})
              </h2>
              {templates.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No saved templates yet. Open a report in the Visual Designer to create custom templates.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition"
                    >
                      <div className="font-semibold text-xs text-gray-900">{tpl.name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Base: {tpl.definition?.name || 'Standard'}</div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                        <span className="text-[10px] uppercase font-mono text-gray-400">{tpl.output_format}</span>
                        <button
                          type="button"
                          className="text-xs text-blue-600 font-semibold hover:underline"
                          onClick={() => {
                            const match = definitions.find((d) => d.id === tpl.definition_id);
                            if (match) {
                              setSelectedReport(match);
                              setFilters(tpl.parameters || {});
                              setViewMode('designer');
                            }
                          }}
                        >
                          Edit in Designer →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'recent' && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm overflow-auto max-h-[620px]">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Generated Artifacts ({recentGenerations.length})
              </h2>
              {recentGenerations.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No generated report artifacts found.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentGenerations.map((gen) => (
                    <div key={gen.id} className="p-3 rounded-lg border border-gray-200 text-xs">
                      <div className="font-semibold text-gray-900">{gen.definition?.name || 'Report'}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        Format: {gen.output_format?.toUpperCase()} • {gen.status}
                      </div>
                      {gen.dataset_hash && (
                        <div className="text-[10px] font-mono text-gray-400 mt-1 truncate">
                          Hash: {gen.dataset_hash.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Main Pane: Filter Builder + Live Dataset / HTML Preview */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {selectedReport ? (
            <>
              {/* Filter Builder Component */}
              <ReportFilterBuilder
                value={filters}
                onChange={(newFilters) => setFilters(newFilters)}
                disabled={generating}
                onReset={() => setFilters({})}
                showSaveButton={true}
                onSaveTemplate={() => setViewMode('designer')}
              />

              {/* Action Bar */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={generating}
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    onClick={() => handleGeneratePreview(false)}
                  >
                    <span>⚡</span>
                    <span>{generating ? 'Querying...' : 'Generate Dataset & Preview'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={generating}
                    className="px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    onClick={() => handleGeneratePreview(true)}
                  >
                    HTML Print View
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 mr-1">Direct Export:</span>
                  <button
                    type="button"
                    disabled={generating}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                    onClick={() => handleExport('pdf')}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    disabled={generating}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                    onClick={() => handleExport('excel')}
                  >
                    XLSX
                  </button>
                  <button
                    type="button"
                    disabled={generating}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                    onClick={() => handleExport('csv')}
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {previewError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl">
                  <strong>Preview Error:</strong> {previewError}
                </div>
              )}

              {/* Preview Viewport */}
              {viewMode === 'html' && htmlContent ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">HTML Renderer Output</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline font-medium"
                      onClick={() => setViewMode('cards')}
                    >
                      Switch to Card View
                    </button>
                  </div>
                  <iframe
                    title="Report HTML Preview"
                    className="w-full h-[650px] border-0"
                    srcDoc={htmlContent}
                  />
                </div>
              ) : dataset ? (
                <div className="space-y-6">
                  {/* Provenance Header */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                        <span>✓</span>
                        <span>Immutable Dataset</span>
                      </span>
                      <span>
                        Authority: <strong>{dataset.provenance?.authoritySources?.join(', ') || selectedReport.data_source_key}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>Hash: <strong className="text-gray-800">{dataset.datasetHash?.slice(0, 12)}...</strong></span>
                      <span>Data As Of: {dataset.dataAsOf?.slice(0, 10)}</span>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  {dataset.data?.kpis && dataset.data.kpis.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {dataset.data.kpis.map((kpi: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{kpi.label}</div>
                          <div className="text-2xl font-bold mt-1" style={{ color: kpi.color || '#0D2137' }}>
                            {kpi.value}{kpi.unit ? ` ${kpi.unit}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {dataset.data?.summary && (
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
                      <strong>Executive Summary:</strong> {dataset.data.summary}
                    </div>
                  )}

                  {/* Table Records */}
                  {dataset.data?.rows && dataset.data.rows.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900">
                          Dataset Records ({dataset.data.rows.length})
                        </h3>
                        <span className="text-xs text-gray-400">Server-Side Authoritative Query</span>
                      </div>
                      <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              {Object.keys(dataset.data.rows[0])
                                .filter((k) => !['id', 'blocking_reasons', 'progress_visualization'].includes(k))
                                .map((header) => (
                                  <th
                                    key={header}
                                    className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[11px]"
                                  >
                                    {header.replace(/_/g, ' ')}
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {dataset.data.rows.slice(0, 50).map((row: any, rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-gray-50/80 transition">
                                {Object.entries(row)
                                  .filter(([k]) => !['id', 'blocking_reasons', 'progress_visualization'].includes(k))
                                  .map(([k, val], cIdx) => (
                                    <td key={cIdx} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                                      {val === null || val === undefined ? '—' : String(val)}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 shadow-sm">
                  <div className="text-4xl mb-3">📊</div>
                  <div className="font-semibold text-gray-700 text-base">Ready to Generate Report</div>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Select your dimensions and parameters above, then click <strong>Generate Dataset & Preview</strong> or <strong>Open Visual Designer</strong>.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 shadow-sm">
              Select a report from the catalog to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
