'use client';

/**
 * M7.7.1 — Provisioning Templates Dashboard
 *
 * Manage industry-specific provisioning templates.
 * Shows built-in and custom templates with preview.
 */

import { useState } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const INDUSTRY_ICONS: Record<string, string> = {
  refinery: '🛢️',
  petrochemical: '⚗️',
  fertilizer: '🌱',
  gas_processing: '💨',
  lng: '❄️',
  pipeline: '🔧',
  tank_farm: '🏗️',
  power_plant: '⚡',
  chemical_plant: '🧪',
  general: '🏭',
};

export default function ProvisioningTemplatesPage() {
  const { data: templates, error, mutate } = useSWR('/api/admin/provisioning-templates', fetcher);
  const [selected, setSelected] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleSeedBuiltins = async () => {
    setSeeding(true);
    try {
      await fetch('/api/admin/provisioning-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      mutate();
    } catch {}
    setSeeding(false);
  };

  if (error) return <div className="p-8 text-red-500 font-medium">Failed to load templates.</div>;
  if (!templates) return <div className="p-8 text-gray-500 animate-pulse font-medium">Loading templates...</div>;

  const templateList = Array.isArray(templates) ? templates : [];
  const selectedTemplate = templateList.find((t: any) => t.id === selected);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provisioning Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            {templateList.length} templates · Industry-specific configurations
          </p>
        </div>
        {templateList.length === 0 && (
          <button
            onClick={handleSeedBuiltins}
            disabled={seeding}
            className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Seed Built-in Templates'}
          </button>
        )}
      </div>

      {templateList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-gray-700">No Templates Yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Click "Seed Built-in Templates" to create the 10 industry-standard templates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template List */}
          <div className="lg:col-span-2 space-y-3">
            {templateList.map((tmpl: any) => {
              const icon = INDUSTRY_ICONS[tmpl.industry] ?? '🏭';
              const isActive = selected === tmpl.id;

              return (
                <button
                  key={tmpl.id}
                  onClick={() => setSelected(isActive ? null : tmpl.id)}
                  className={`w-full text-left p-4 rounded-xl border transition ${
                    isActive
                      ? 'bg-[#0D2137]/5 border-[#0D2137]/30 ring-1 ring-[#0D2137]/20'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{tmpl.name}</span>
                        {tmpl.is_builtin && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded font-medium">
                            BUILT-IN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{tmpl.description ?? '—'}</div>
                    </div>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded capitalize">
                      {tmpl.industry?.replace(/_/g, ' ') ?? 'General'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedTemplate ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-8 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{INDUSTRY_ICONS[selectedTemplate.industry] ?? '🏭'}</span>
                  <h3 className="font-bold text-gray-900">{selectedTemplate.name}</h3>
                </div>

                <p className="text-sm text-gray-500">{selectedTemplate.description}</p>

                <div className="text-xs text-gray-400 space-y-1">
                  <div>Slug: <code className="bg-gray-100 px-1 py-0.5 rounded">{selectedTemplate.slug}</code></div>
                  <div>Industry: {selectedTemplate.industry?.replace(/_/g, ' ') ?? '—'}</div>
                  <div>Created: {new Date(selectedTemplate.created_at).toLocaleString()}</div>
                </div>

                {/* Config Preview */}
                {selectedTemplate.config && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
                      View Configuration
                    </summary>
                    <pre className="mt-2 bg-gray-50 rounded-lg p-3 overflow-auto max-h-80 text-gray-600">
                      {JSON.stringify(selectedTemplate.config, null, 2)}
                    </pre>
                  </details>
                )}

                <button
                  onClick={() => window.location.href = `/platform/tenants/new?templateId=${selectedTemplate.id}`}
                  className="w-full mt-2 px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]"
                >
                  Use This Template
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-3xl mb-2">👈</div>
                <p className="text-sm text-gray-500">Select a template to see details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
