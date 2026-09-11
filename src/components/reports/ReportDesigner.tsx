'use client';

/**
 * M14-R5 — Enterprise Report Designer
 *
 * Full visual canvas report designer supporting:
 * - Page/Canvas model with Header, Body Sections, and Footer
 * - Component Catalog integration (Layout, Text, KPI, Charts, Tables, Governance Controls)
 * - Pure client-side state engine (ReportDesignerStateManager) with Undo/Redo
 * - DimensionRegistry + ControlledValueResolver integration
 * - Embedded ReportTableDesigner for table column/grouping customization
 * - Live dataset binding using immutable ReportDataset
 * - Export parity with R4 PDF/XLSX/CSV generation pipeline
 *
 * ZERO independent database queries. ZERO business metric recalculations.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ReportDesignerStateManager,
  ReportLayoutModel,
  DEFAULT_REPORT_LAYOUT,
  PlacedReportComponent,
} from '@/core/report-builder/ReportDesignerStateManager';
import {
  ReportComponentCatalog,
  ReportComponentDefinition,
  ComponentCategory,
} from '@/core/report-builder/ReportComponentCatalog';
import { ReportTableDesigner, TableConfig } from './ReportTableDesigner';
import type { ReportDataset } from '@/core/report-builder/ReportGenerationService';

export interface ReportDesignerProps {
  definitionId: string;
  definitionName: string;
  initialLayout?: Partial<ReportLayoutModel>;
  dataset?: ReportDataset | null;
  onSave?: (layout: ReportLayoutModel) => Promise<void>;
  onSaveAs?: (newName: string, layout: ReportLayoutModel) => Promise<void>;
  onClose?: () => void;
  onExport?: (format: 'pdf' | 'excel' | 'csv' | 'html', layout: ReportLayoutModel) => void;
}

const CATEGORY_TABS: Array<{ id: ComponentCategory; name: string; icon: string }> = [
  { id: 'layout', name: 'Layout', icon: '🔲' },
  { id: 'text', name: 'Text', icon: '📝' },
  { id: 'kpi', name: 'KPIs', icon: '🔢' },
  { id: 'charts', name: 'Charts', icon: '📊' },
  { id: 'tables', name: 'Tables', icon: '📋' },
  { id: 'control', name: 'Governance', icon: '🛡️' },
];

export function ReportDesigner({
  definitionId,
  definitionName,
  initialLayout,
  dataset,
  onSave,
  onSaveAs,
  onClose,
  onExport,
}: ReportDesignerProps) {
  const manager = useMemo(() => new ReportDesignerStateManager(initialLayout), [initialLayout]);
  const [layout, setLayout] = useState<ReportLayoutModel>(manager.getLayout());
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ComponentCategory>('kpi');
  const [previewMode, setPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState(`${definitionName} Custom Template`);

  useEffect(() => {
    const unsub = manager.subscribe((newLayout) => {
      setLayout(newLayout);
    });
    return unsub;
  }, [manager]);

  const selectedComponent = useMemo(() => {
    if (!selectedCompId) return null;
    for (const sec of layout.sections) {
      const comp = sec.components.find((c) => c.id === selectedCompId);
      if (comp) return comp;
    }
    return null;
  }, [layout, selectedCompId]);

  const catalog = useMemo(() => ReportComponentCatalog.getAll(), []);
  const filteredCatalog = useMemo(
    () => catalog.filter((c) => c.category === activeCategory),
    [catalog, activeCategory]
  );

  const handleAddComponent = (def: ReportComponentDefinition) => {
    const targetSec = layout.sections[0] || null;
    if (!targetSec) {
      const newSecId = manager.addSection('Report Section');
      manager.addComponent(newSecId, def.type, def.defaultConfig);
    } else {
      manager.addComponent(targetSec.id, def.type, def.defaultConfig);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(layout);
      alert('Template saved successfully!');
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsSubmit = async () => {
    if (!onSaveAs || !saveAsName.trim()) return;
    setIsSaving(true);
    try {
      await onSaveAs(saveAsName.trim(), layout);
      setSaveAsModalOpen(false);
      alert(`New template "${saveAsName}" created successfully!`);
    } catch (err: any) {
      alert(`Save As error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 overflow-hidden font-sans">
      {/* ─── Top Designer Header & Toolbar ───────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition"
              onClick={onClose}
              title="Return to Report Center"
            >
              ← Back
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gray-900">{definitionName}</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold border border-blue-200">
                Visual Report Designer
              </span>
            </div>
            <div className="text-[11px] text-gray-400">
              Canvas: {layout.pageSettings.size} ({layout.pageSettings.orientation})
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center border border-gray-200 rounded-lg p-0.5 bg-gray-50">
            <button
              type="button"
              disabled={!manager.canUndo()}
              onClick={() => manager.undo()}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-white rounded disabled:opacity-30 transition font-medium"
              title="Undo (Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              disabled={!manager.canRedo()}
              onClick={() => manager.redo()}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-white rounded disabled:opacity-30 transition font-medium"
              title="Redo (Ctrl+Y)"
            >
              ↷ Redo
            </button>
          </div>

          {/* Orientation Toggle */}
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition"
            onClick={() =>
              manager.updatePageSettings({
                orientation: layout.pageSettings.orientation === 'portrait' ? 'landscape' : 'portrait',
              })
            }
          >
            {layout.pageSettings.orientation === 'portrait' ? '📄 Portrait' : '📑 Landscape'}
          </button>

          {/* Reset Baseline */}
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            onClick={() => {
              if (confirm('Reset template layout to platform default baseline?')) {
                manager.reset();
              }
            }}
          >
            Reset
          </button>

          {/* Live Preview Toggle */}
          <button
            type="button"
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              previewMode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? '✏️ Edit Mode' : '👁️ Live Preview'}
          </button>

          {/* Save / Save As */}
          {onSave && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-3.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
            >
              Save Template
            </button>
          )}
          {onSaveAs && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setSaveAsModalOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Save As...
            </button>
          )}

          {/* Quick Export Shortcuts */}
          {onExport && (
            <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
              <button
                type="button"
                className="px-2 py-1 text-[11px] font-medium border border-gray-200 rounded hover:bg-gray-50 text-gray-700"
                onClick={() => onExport('pdf', layout)}
                title="Export PDF"
              >
                PDF
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[11px] font-medium border border-gray-200 rounded hover:bg-gray-50 text-gray-700"
                onClick={() => onExport('excel', layout)}
                title="Export XLSX"
              >
                XLSX
              </button>
              <button
                type="button"
                className="px-2 py-1 text-[11px] font-medium border border-gray-200 rounded hover:bg-gray-50 text-gray-700"
                onClick={() => onExport('csv', layout)}
                title="Export CSV"
              >
                CSV
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Workspace: Palette + Canvas + Property Inspector ────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar: Component Catalog Palette */}
        {!previewMode && (
          <aside className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-10">
            {/* Category Tabs */}
            <div className="grid grid-cols-3 gap-1 p-2 border-b border-gray-100 bg-gray-50">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`flex flex-col items-center justify-center p-1.5 rounded text-[10px] font-medium transition ${
                    activeCategory === tab.id
                      ? 'bg-white text-blue-700 shadow-xs font-bold border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  onClick={() => setActiveCategory(tab.id)}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>

            {/* Component Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                {activeCategory} Components ({filteredCatalog.length})
              </div>
              {filteredCatalog.map((def) => (
                <div
                  key={def.type}
                  className="group p-2.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:shadow-xs transition cursor-pointer"
                  onClick={() => handleAddComponent(def)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-xs text-gray-900">
                      <span>{def.icon}</span>
                      <span>{def.name}</span>
                    </div>
                    <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition font-bold">
                      + Add
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{def.description}</p>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center: Canvas Viewport */}
        <main className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-100">
          <div
            className={`bg-white shadow-md rounded-lg transition-all duration-200 flex flex-col ${
              layout.pageSettings.orientation === 'landscape' ? 'w-[1100px] min-h-[750px]' : 'w-[820px] min-h-[1050px]'
            }`}
            style={{
              paddingTop: `${layout.pageSettings.margins.top}mm`,
              paddingBottom: `${layout.pageSettings.margins.bottom}mm`,
              paddingLeft: `${layout.pageSettings.margins.left}mm`,
              paddingRight: `${layout.pageSettings.margins.right}mm`,
              fontFamily: layout.presentationProfile.fontFamily,
            }}
          >
            {/* ── Document Header ── */}
            {layout.header.show && (
              <div className="pb-4 mb-6 border-b border-gray-200 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-base text-gray-900" style={{ color: layout.presentationProfile.primaryColor }}>
                    {layout.header.companyName || 'Syority Turnaround Platform'}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    EVENT: {dataset?.eventId || 'TA-2028-M01'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    AUTHORITATIVE REPORT
                  </div>
                  <div className="font-mono text-[11px] text-gray-500">
                    DATA AS OF: {dataset?.dataAsOf?.slice(0, 10) || new Date().toISOString().slice(0, 10)}
                  </div>
                </div>
              </div>
            )}

            {/* ── Sections ── */}
            <div className="flex-1 space-y-6">
              {layout.sections.map((sec) => (
                <div
                  key={sec.id}
                  className={`relative p-3 rounded-lg border transition ${
                    previewMode ? 'border-transparent' : 'border-dashed border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {!previewMode && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {sec.title}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="text-[11px] text-red-500 hover:text-red-700 px-1"
                          onClick={() => manager.removeSection(sec.id)}
                          title="Delete Section"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section Components Grid */}
                  <div className="grid grid-cols-12 gap-3">
                    {sec.components.map((comp) => {
                      const isSelected = selectedCompId === comp.id && !previewMode;
                      return (
                        <div
                          key={comp.id}
                          className={`col-span-${comp.position.span || 12} relative p-3 rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCompId(comp.id);
                          }}
                        >
                          {!previewMode && (
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
                              <button
                                type="button"
                                className="p-0.5 text-gray-400 hover:text-gray-700 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  manager.duplicateComponent(comp.id);
                                }}
                                title="Duplicate Component"
                              >
                                📋
                              </button>
                              <button
                                type="button"
                                className="p-0.5 text-gray-400 hover:text-red-600 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  manager.removeComponent(comp.id);
                                  if (selectedCompId === comp.id) setSelectedCompId(null);
                                }}
                                title="Delete Component"
                              >
                                ✕
                              </button>
                            </div>
                          )}

                          {/* Render Component Content */}
                          {renderComponentContent(comp, dataset, layout)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!previewMode && (
                <button
                  type="button"
                  className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:border-blue-300 hover:text-blue-700 transition"
                  onClick={() => manager.addSection('New Content Section')}
                >
                  + Add New Section
                </button>
              )}
            </div>

            {/* ── Document Footer ── */}
            {layout.footer.show && (
              <div className="pt-6 mt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-400 gap-2">
                <div>{layout.footer.confidentiality}</div>
                {layout.footer.showPageNumbers && (
                  <div className="font-mono">Page 1 of 1</div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Contextual Property Inspector */}
        {!previewMode && selectedComponent && (
          <aside className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 p-4 overflow-y-auto z-10 text-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-4">
              <span className="font-bold text-gray-900">Component Properties</span>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-700"
                onClick={() => setSelectedCompId(null)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Type
                </label>
                <div className="font-mono text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">
                  {selectedComponent.type}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Grid Width Span (1–12)
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300"
                  value={selectedComponent.position.span}
                  onChange={(e) =>
                    manager.updateComponentPosition(selectedComponent.id, {
                      span: Math.max(1, Math.min(12, Number(e.target.value))),
                    })
                  }
                />
              </div>

              {/* Text Component Config */}
              {selectedComponent.type.startsWith('text.') && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Text Content
                  </label>
                  <textarea
                    rows={3}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300 text-gray-900"
                    value={selectedComponent.configuration.text || ''}
                    onChange={(e) =>
                      manager.updateComponentConfig(selectedComponent.id, { text: e.target.value })
                    }
                  />
                </div>
              )}

              {/* KPI Component Config */}
              {selectedComponent.type.startsWith('kpi.') && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    KPI Card Label
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300 text-gray-900"
                    value={selectedComponent.configuration.label || ''}
                    onChange={(e) =>
                      manager.updateComponentConfig(selectedComponent.id, { label: e.target.value })
                    }
                  />
                </div>
              )}

              {/* Table Component Embedded Designer */}
              {selectedComponent.type.startsWith('table.') && (
                <div className="pt-2 border-t border-gray-100">
                  <ReportTableDesigner
                    config={{
                      columns: (selectedComponent.configuration.columns || []).map((colKey: any) =>
                        typeof colKey === 'string'
                          ? { key: colKey, label: colKey.replace(/_/g, ' '), visible: true }
                          : colKey
                      ),
                      groupBy: selectedComponent.configuration.groupBy || [],
                      pageSize: selectedComponent.configuration.pageSize || 50,
                      repeatHeaderPdf: selectedComponent.configuration.repeatHeaderPdf !== false,
                      showTotals: selectedComponent.configuration.showTotals || false,
                    }}
                    onChange={(newTblConfig: TableConfig) => {
                      manager.updateComponentConfig(selectedComponent.id, {
                        columns: newTblConfig.columns,
                        groupBy: newTblConfig.groupBy,
                        pageSize: newTblConfig.pageSize,
                        repeatHeaderPdf: newTblConfig.repeatHeaderPdf,
                        showTotals: newTblConfig.showTotals,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ─── Save As Modal ───────────────────────────────────────────────── */}
      {saveAsModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Save Template As</h3>
            <p className="text-xs text-gray-500">
              Create an independent report template preset with this customized layout, without modifying the source definition.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">New Template Name</label>
              <input
                type="text"
                className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 focus:ring-1 focus:ring-blue-500"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                onClick={() => setSaveAsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!saveAsName.trim() || isSaving}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                onClick={handleSaveAsSubmit}
              >
                Save New Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Visual renderer helper for previewing components on the designer canvas.
 */
function renderComponentContent(
  comp: PlacedReportComponent,
  dataset: ReportDataset | null | undefined,
  layout: ReportLayoutModel
) {
  const { type, configuration } = comp;

  if (type === 'text.title') {
    return (
      <div className="font-bold text-lg text-gray-900" style={{ color: layout.presentationProfile.primaryColor }}>
        {configuration.text || 'REPORT TITLE'}
      </div>
    );
  }

  if (type === 'text.subtitle') {
    return <div className="text-xs text-gray-500 font-medium">{configuration.text || 'Subtitle'}</div>;
  }

  if (type === 'text.paragraph') {
    return <p className="text-xs text-gray-700 leading-relaxed">{configuration.text || dataset?.data?.summary || ''}</p>;
  }

  if (type === 'control.confidentiality_banner') {
    return (
      <div
        className="text-[11px] font-bold text-center py-1 px-2 rounded border"
        style={{ color: configuration.color || '#DC2626', borderColor: configuration.color || '#DC2626' }}
      >
        {configuration.label || 'STRICTLY CONFIDENTIAL'}
      </div>
    );
  }

  if (type === 'control.filter_summary') {
    return (
      <div className="bg-gray-50 p-2.5 rounded border border-gray-200 text-[11px] text-gray-600 space-y-1">
        <div className="font-semibold text-gray-800">Filter & Dataset Provenance</div>
        <div className="font-mono text-[10px] truncate">Hash: {dataset?.datasetHash?.slice(0, 16) || 'a8f3b20c...'}</div>
        <div>Data As Of: {dataset?.dataAsOf?.slice(0, 10) || '2026-09-07'}</div>
      </div>
    );
  }

  if (type === 'control.signature_block') {
    const sigs = configuration.signatures || ['Superintendent', 'Planning Lead'];
    return (
      <div className="grid grid-cols-2 gap-4 text-[11px] text-gray-500 pt-2">
        {sigs.map((sig: string, i: number) => (
          <div key={i} className="border-t border-gray-400 pt-1 text-center font-medium">
            {sig}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'kpi.card') {
    const kpis = dataset?.data?.kpis || [];
    const kpi = kpis.find((k: any) => k.label?.toLowerCase().includes(configuration.metricKey || '')) || kpis[0] || {
      label: configuration.label || 'Progress',
      value: '87.75%',
    };
    return (
      <div className="p-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{kpi.label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{kpi.value}</div>
      </div>
    );
  }

  if (type === 'kpi.group') {
    const kpis = dataset?.data?.kpis?.length
      ? dataset.data.kpis
      : [
          { label: 'Overall Progress', value: '87.75%' },
          { label: 'Planned Progress', value: '92.00%' },
          { label: 'SPI', value: '0.95' },
          { label: 'Active Delays', value: 0 },
        ];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kpis.slice(0, 4).map((kpi: any, idx: number) => (
          <div key={idx} className="bg-gray-50 p-2.5 rounded border border-gray-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">{kpi.label}</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{kpi.value}</div>
          </div>
        ))}
      </div>
    );
  }

  if (type.startsWith('chart.')) {
    return (
      <div className="h-32 bg-gray-50 rounded border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-2">
        <span className="text-xl">📊</span>
        <span className="text-xs font-semibold text-gray-600 mt-1">{type.replace('chart.', '').replace(/_/g, ' ').toUpperCase()}</span>
        <span className="text-[10px] text-gray-400">Authoritative Chart Series View</span>
      </div>
    );
  }

  if (type.startsWith('table.')) {
    const rows = dataset?.data?.rows || [
      { activity_number: 'ACT-001', description: 'Bundle Extraction E-101A', discipline: 'MECH', progress_percent: '100%', status: 'completed' },
      { activity_number: 'ACT-002', description: 'Hydrojet Tube Cleaning', discipline: 'CLN', progress_percent: '65%', status: 'in_progress' },
      { activity_number: 'ACT-003', description: 'Tube Inspection & NDT', discipline: 'INSP', progress_percent: '0%', status: 'not_started' },
    ];
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50">
            <tr>
              {Object.keys(rows[0] || {})
                .slice(0, 5)
                .map((col) => (
                  <th key={col} className="px-2 py-1.5 font-semibold text-gray-600 text-[10px] uppercase">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.slice(0, 3).map((r: any, idx: number) => (
              <tr key={idx}>
                {Object.values(r)
                  .slice(0, 5)
                  .map((val: any, cIdx: number) => (
                    <td key={cIdx} className="px-2 py-1 text-gray-700 whitespace-nowrap text-[11px]">
                      {String(val)}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div className="text-xs text-gray-400">Component: {type}</div>;
}
