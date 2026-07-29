'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HierarchySelector } from '@/components/hierarchy/HierarchySelector';

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  site_name: string;
  plant_name: string;
  unit_name: string;
  total_documents: number;
  total_candidates: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-600',
};

export default function DigitalPlantDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create form state
  const [hierarchy, setHierarchy] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/digital-plant/projects?${params}`);
    const data = await res.json();
    setProjects(data.data || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCreate = async () => {
    if (!hierarchy.site_id || !hierarchy.plant_id || !hierarchy.unit_id || !newName.trim()) return;
    setCreating(true);
    await fetch('/api/digital-plant/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: hierarchy.site_id,
        plant_id: hierarchy.plant_id,
        area_id: hierarchy.area_id,
        unit_id: hierarchy.unit_id,
        system_id: hierarchy.system_id,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      }),
    });
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    setHierarchy({});
    setCreating(false);
    fetchProjects();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🏭 Digital Plant Builder
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Engineering Asset Register — AI extracts, planner validates, platform stores
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Projects', value: total, color: 'text-gray-900' },
          { label: 'Documents', value: projects.reduce((s, p) => s + p.total_documents, 0), color: 'text-blue-600' },
          { label: 'Pending Review', value: projects.reduce((s, p) => s + p.pending_count, 0), color: 'text-amber-600' },
          { label: 'Approved Assets', value: projects.reduce((s, p) => s + p.approved_count, 0), color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Project Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏗️</div>
          <p className="text-gray-600 font-medium">No Digital Plant projects yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first project to start building the asset register</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/digital-plant/${p.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {p.name}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                {p.site_name} → {p.plant_name} → {p.unit_name}
              </p>

              {p.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{p.description}</p>
              )}

              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-600">{p.total_documents}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Docs</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-500">{p.pending_count}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Pending</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{p.approved_count}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Approved</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-400">{p.rejected_count}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Rejected</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Digital Plant Project</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. CDU-A Asset Register Build"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hierarchy Scope *</label>
                <HierarchySelector
                  value={hierarchy}
                  onChange={setHierarchy}
                  requiredLevels={['site_id', 'plant_id', 'unit_id']}
                  optionalLevels={['area_id', 'system_id']}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || !hierarchy.site_id || !hierarchy.plant_id || !hierarchy.unit_id || creating}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
