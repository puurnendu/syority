'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchResult {
  type: 'workpack' | 'equipment_type';
  id: string;
  label: string;
  sub: string;
  workpackIds: string[];
  actCount: number;
  equipTypeId?: string;
}

interface ExportItem {
  id: string;
  label: string;
  sub: string;
  workpackIds: string[];
  actCount: number;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

const FORMATS = [
  {
    id: 'csv',
    label: 'Excel / CSV',
    icon: '📊',
    desc: 'Opens in any spreadsheet. Best for review and manual editing.',
    ext: '.csv',
    activeColor: 'border-green-500 bg-green-100',
  },
  {
    id: 'msproject_xml',
    label: 'MS Project XML',
    icon: '📋',
    desc: 'Import directly into Microsoft Project 2010 and later.',
    ext: '.xml',
    activeColor: 'border-blue-500 bg-blue-100',
  },
  {
    id: 'p6_xer',
    label: 'Primavera P6 XER',
    icon: '⚙️',
    desc: 'Native P6 format. Import via File → Import in Primavera P6.',
    ext: '.xer',
    activeColor: 'border-orange-500 bg-orange-100',
  },
  {
    id: 'p6_xml',
    label: 'Primavera P6 XML',
    icon: '🔧',
    desc: 'P6 XML format. Supported by P6 Web and P6 EPPM.',
    ext: '.xml',
    activeColor: 'border-purple-500 bg-purple-100',
  },
];

const UDF_OPTIONS = [
  { key: 'discipline', label: 'Discipline' },
  { key: 'contractor', label: 'Contractor' },
  { key: 'window', label: 'Window (PreSD/OP/etc.)' },
  { key: 'priority', label: 'Priority' },
  { key: 'equipTag', label: 'Equipment Tag' },
  { key: 'equipDesc', label: 'Equipment Description' },
  { key: 'equipType', label: 'Equipment Type' },
  { key: 'plant', label: 'Plant' },
  { key: 'unit', label: 'Unit' },
  { key: 'wpNumber', label: 'Workpack Number' },
  { key: 'manpower', label: 'Manpower Count' },
  { key: 'predecessor', label: 'Predecessor IDs' },
];

export default function ScheduleExportPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [exportItems, setExportItems] = useState<ExportItem[]>([]);
  const [format, setFormat] = useState('csv');
  const [udfConfig, setUdfConfig] = useState<Record<string, boolean>>({
    discipline: true,
    contractor: true,
    window: true,
    priority: true,
    equipTag: true,
    equipDesc: true,
    equipType: true,
    plant: true,
    unit: true,
    wpNumber: true,
    manpower: false,
    predecessor: true,
  });
  const [exporting, setExporting] = useState(false);
  const [showUdf, setShowUdf] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProjects = async () => {
      const r1 = await fetch('/api/projects');
      const d1 = await r1.json();
      const projects = Array.isArray(d1) ? d1 : (d1.projects ?? d1.data ?? []);

      if (projects.length > 0) {
        setProjects(projects);
        return;
      }

      const r2 = await fetch('/api/events');
      if (r2.ok) {
        const d2 = await r2.json();
        const events = Array.isArray(d2) ? d2 : (d2.events ?? d2.data ?? []);
        setProjects(
          events.map((e: { id: string; name?: string; title?: string; code?: string; reference?: string }) => ({
            id: e.id,
            name: e.name ?? e.title ?? 'Event',
            code: e.code ?? e.reference ?? e.id.slice(0, 8),
          }))
        );
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const params = new URLSearchParams({ q: query });
      if (selectedProject) params.set('projectId', selectedProject);
      const res = await fetch(`/api/export/search?${params}`);
      let data: { results?: SearchResult[] } = {};
      try {
        const text = await res.text();
        if (text) data = JSON.parse(text);
      } catch {
        data = {};
      }
      setSearchResults(data.results ?? []);
      setShowDropdown(true);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedProject]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addItem = async (result: SearchResult) => {
    let workpackIds = result.workpackIds;
    let actCount = result.actCount;

    if (result.type === 'equipment_type' && result.equipTypeId) {
      const params = new URLSearchParams({ equipTypeId: result.equipTypeId });
      if (selectedProject) params.set('projectId', selectedProject);
      const res = await fetch(`/api/export/resolve-type?${params}`);
      const data = await res.json();
      const workpacks = data.workpacks ?? [];
      workpackIds = workpacks.map((w: { id: string }) => w.id);
      actCount = workpacks.reduce(
        (s: number, w: { _count?: { activities?: number } }) =>
          s + (w._count?.activities ?? 0),
        0
      );
    }

    const newIds = workpackIds.filter(
      (id) => !exportItems.some((e) => e.workpackIds.includes(id))
    );
    if (!newIds.length) {
      setQuery('');
      setShowDropdown(false);
      return;
    }

    const newItem: ExportItem = {
      id: result.id,
      label: result.label,
      sub:
        result.type === 'equipment_type'
          ? `${newIds.length} workpacks added`
          : result.sub,
      workpackIds: newIds,
      actCount,
    };

    setExportItems((prev) => [...prev, newItem]);
    setQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removeItem = (id: string) =>
    setExportItems((prev) => prev.filter((e) => e.id !== id));

  const totalWorkpacks = [...new Set(exportItems.flatMap((e) => e.workpackIds))]
    .length;
  const totalActivities = exportItems.reduce((s, e) => s + (e.actCount || 0), 0);

  const doExport = async () => {
    if (!exportItems.length) return;
    setExporting(true);
    try {
      const allWorkpackIds = [
        ...new Set(exportItems.flatMap((e) => e.workpackIds)),
      ];
      const res = await fetch('/api/export/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject || null,
          workpackIds: allWorkpackIds,
          format,
          udfConfig,
        }),
      });

      if (!res.ok) {
        alert('Export failed. Please try again.');
        return;
      }

      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const fn =
        cd.match(/filename="?([^"]+)"?/)?.[1] ??
        `export.${format === 'p6_xer' ? 'xer' : 'xml'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fn;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schedule Export</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select workpacks, choose a format, and download for Primavera P6, MS
          Project, or Excel.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center justify-center">
            1
          </span>
          <h2 className="text-sm font-semibold text-gray-900">
            Select Project / STO
          </h2>
          <span className="text-xs text-gray-400 ml-1">
            (optional — filter workpacks by project)
          </span>
        </div>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center justify-center">
            2
          </span>
          <h2 className="text-sm font-semibold text-gray-900">
            Add Workpacks to Export List
          </h2>
        </div>

        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white flex-wrap min-h-[44px]">
            {exportItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-200"
              >
                {item.label}
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-indigo-400 hover:text-indigo-700 font-bold leading-none text-sm"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                exportItems.length === 0
                  ? 'Type equipment tag, workpack no. or type (min 3 chars)…'
                  : 'Add more…'
              }
              className="flex-1 min-w-[200px] outline-none text-sm bg-transparent"
            />
            {searching && (
              <span className="text-gray-400 text-xs animate-pulse">
                Searching…
              </span>
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => addItem(result)}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-0 flex items-center gap-3 transition-colors"
                >
                  <span className="text-lg flex-shrink-0">
                    {result.type === 'equipment_type' ? '📦' : '📋'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {result.label}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {result.sub}
                    </p>
                  </div>
                  <span className="text-xs text-indigo-500 font-medium flex-shrink-0">
                    + Add
                  </span>
                </button>
              ))}
            </div>
          )}

          {showDropdown &&
            searchResults.length === 0 &&
            query.length >= 3 &&
            !searching && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-4 py-6 text-center text-gray-400 text-sm">
                No workpacks found for &quot;{query}&quot;
              </div>
            )}
        </div>

        {exportItems.length > 0 && (
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">
              {totalWorkpacks} workpack{totalWorkpacks !== 1 ? 's' : ''} selected
            </span>
            <span>·</span>
            <span>~{totalActivities} activities</span>
            <button
              onClick={() => setExportItems([])}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              Clear all
            </button>
          </div>
        )}

        {exportItems.length === 0 && (
          <p className="mt-3 text-xs text-gray-400">
            💡 Type &quot;E-&quot; for heat exchangers, &quot;P-&quot; for
            pumps, &quot;Heat Ex&quot; for all heat exchangers, etc.
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center justify-center">
            3
          </span>
          <h2 className="text-sm font-semibold text-gray-900">
            Choose Export Format
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                format === f.id
                  ? f.activeColor + ' border-2'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1.5">{f.icon}</div>
              <div className="text-sm font-bold text-gray-900">{f.label}</div>
              <div className="text-xs text-gray-400 mt-1">{f.desc}</div>
              <div className="text-xs font-mono text-gray-400 mt-1.5">
                {f.ext}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <button
          onClick={() => setShowUdf((v) => !v)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center justify-center">
              4
            </span>
            <h2 className="text-sm font-semibold text-gray-900">
              UDF / Extra Fields
            </h2>
            <span className="text-xs text-gray-400">
              {Object.values(udfConfig).filter(Boolean).length} fields selected
            </span>
          </div>
          <span className="text-gray-400 text-sm">{showUdf ? '▲' : '▼'}</span>
        </button>

        {showUdf && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
            {UDF_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={udfConfig[opt.key] ?? false}
                  onChange={(e) =>
                    setUdfConfig((c) => ({ ...c, [opt.key]: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-indigo-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-5">
        <div>
          {exportItems.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Ready to export {totalWorkpacks} workpack
                {totalWorkpacks !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Format: {FORMATS.find((f) => f.id === format)?.label} ·
                ~{totalActivities} activities
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Add workpacks to the export list to continue
            </p>
          )}
        </div>
        <button
          onClick={doExport}
          disabled={exporting || exportItems.length === 0}
          className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {exporting ? (
            <>
              <span className="animate-spin">⟳</span> Generating…
            </>
          ) : (
            <>📤 Download {FORMATS.find((f) => f.id === format)?.ext}</>
          )}
        </button>
      </div>
    </div>
  );
}
