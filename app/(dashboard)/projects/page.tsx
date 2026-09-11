'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * OD9.2 §15 — This shape now matches what `/api/projects` actually returns. It previously
 * used pre-OD9 camelCase aliases (`plannedSdDate`, `plantName`, `_count.workpacks`), so
 * dates, plant and workpack counts silently rendered as blank/zero, and the create form
 * posted keys the route never read — planned dates were never saved.
 */
interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
  planned_sd_date: string | null;
  planned_su_date: string | null;
  client: string | null;
  plant_name: string | null;
  _count: { Workpack: number };
}

const STATUS_COLORS: Record<string, string> = {
  Planning: 'bg-blue-100 text-blue-800',
  Active: 'bg-green-100 text-green-800',
  'Mechanical Completion': 'bg-purple-100 text-purple-800',
  Closed: 'bg-gray-100 text-gray-800',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    client: '',
    plant_name: '',
    planned_sd_date: '',
    planned_su_date: '',
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => {
        setProjects(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => {
        setProjects([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setSaving(true);
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowCreate(false);
    setForm({
      name: '',
      code: '',
      client: '',
      plant_name: '',
      planned_sd_date: '',
      planned_su_date: '',
    });
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Portfolio &amp; project management
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          + New Project
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-4xl mb-3">🏭</p>
          <p className="font-semibold text-gray-700">No projects yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first project to get started
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-indigo-700">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {p.code}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                {p.client && <p>Client: {p.client}</p>}
                {p.plant_name && <p>Plant: {p.plant_name}</p>}
                {p.planned_sd_date && (
                  <p>
                    Start:{' '}
                    {new Date(p.planned_sd_date).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>📦 {p._count?.Workpack || 0} workpacks</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">New Project</h3>
            <div className="space-y-3">
              {[
                {
                  key: 'name',
                  label: 'Project Name *',
                  type: 'text',
                  placeholder: 'CDU-3 Turnaround 2026',
                },
                {
                  key: 'code',
                  label: 'Project Code *',
                  type: 'text',
                  placeholder: 'CDU3-STO-2026',
                },
                {
                  key: 'client',
                  label: 'Client',
                  type: 'text',
                  placeholder: 'HMEL / IOCL / BPCL',
                },
                {
                  key: 'plant_name',
                  label: 'Site / Location',
                  type: 'text',
                  placeholder: 'Guru Gobind Singh Refinery',
                },
                // OD9.2 §5/§28: Project is a general-purpose portfolio/project domain, so
                // its own fields are not labelled in shutdown terms.
                {
                  key: 'planned_sd_date',
                  label: 'Planned Start',
                  type: 'date',
                  placeholder: '',
                },
                {
                  key: 'planned_su_date',
                  label: 'Planned Finish',
                  type: 'date',
                  placeholder: '',
                },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={saving || !form.name || !form.code}
                className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
