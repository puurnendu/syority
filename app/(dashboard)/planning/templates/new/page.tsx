'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewTemplatePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    equipment_type: '',
    job_type: 'Maintenance',
    category: 'Mechanical',
    description: '',
    library_scope: 'TENANT',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/planning/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          activities: [
            {
              sequence_number: 1,
              description: 'Prepare and isolate',
              duration_hours: 4,
              hold_point_type: 'Hold',
            },
            {
              sequence_number: 2,
              description: 'Execute primary scope',
              duration_hours: 8,
            },
            {
              sequence_number: 3,
              description: 'QA/QC clearance and box-up',
              duration_hours: 3,
              hold_point_type: 'Witness',
            },
          ],
          logic_links: [
            { predecessor_seq: 1, successor_seq: 2, link_type: 'FS', lag_hours: 0 },
            { predecessor_seq: 2, successor_seq: 3, link_type: 'FS', lag_hours: 0 },
          ],
          planning_json: { typical_duration_hours: 15, milestones: ['Isolation', 'Box-up'] },
          resources_json: [{ craft: 'Mechanical Fitter', crew_size: 2, manhours: 16 }],
          materials_json: [{ category: 'Gaskets', description: 'Spiral wound gasket set', qty: 1 }],
          safety_json: { permits: ['Hot Work'], loto: true, ppe: ['Gloves', 'Goggles'] },
          qaqc_json: { hold_points: ['Isolation'], witness_points: ['Box-up'] },
          references_json: [{ doc_type: 'SOP', title: 'Isolation procedure' }],
          ai_metadata_json: { keywords: [form.equipment_type, form.job_type], shutdown_type: 'Turnaround' },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Create failed');
      router.push(`/planning/templates/${body.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-slate-900">New template draft</h1>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        {(
          [
            ['name', 'Template name'],
            ['equipment_type', 'Equipment type'],
            ['job_type', 'Job type'],
            ['category', 'Category'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-slate-600">{label}</span>
            <input
              required={key === 'name' || key === 'equipment_type' || key === 'job_type'}
              value={(form as any)[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="text-slate-600">Library</span>
          <select
            value={form.library_scope}
            onChange={(e) => setForm({ ...form, library_scope: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="TENANT">Tenant Library</option>
            <option value="PLATFORM">Platform Library</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            rows={3}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create draft'}
        </button>
      </form>
    </div>
  );
}
