'use client';

import { useState, useEffect } from 'react';

interface Plant {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  _count?: { units: number };
}

export function PlantsSection({ siteId }: { siteId: string }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/settings/sites/${siteId}/plants`)
      .then((r) => r.json())
      .then((d) => setPlants(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [siteId]);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/settings/sites/${siteId}/plants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowAdd(false);
      setForm({ name: '', code: '', description: '' });
      load();
    }
    setSaving(false);
  };

  const update = async (id: string) => {
    await fetch(`/api/settings/sites/${siteId}/plants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    setDeleteError(null);
    if (!confirm('Delete this plant? This cannot be undone.')) return;
    const res = await fetch(`/api/settings/sites/${siteId}/plants/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error ?? 'Delete failed');
      return;
    }
    load();
  };

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Plants</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Process plants at this site — e.g. CDU, FCC, HDS, ARU
          </p>
        </div>
        <button
          onClick={() => {
            setShowAdd(true);
            setDeleteError(null);
          }}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          + Add Plant
        </button>
      </div>

      {deleteError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠ {deleteError}
        </div>
      )}

      {showAdd && (
        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100">
          <p className="text-xs font-semibold text-indigo-700 mb-3">New Plant</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Name *
              </label>
              <input
                autoFocus
                placeholder="CDU, FCC, HDS…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create();
                  if (e.key === 'Escape') setShowAdd(false);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Code
              </label>
              <input
                placeholder="CDU-3"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description
              </label>
              <input
                placeholder="Crude Distillation Unit"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={create}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Plant'}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setForm({ name: '', code: '', description: '' });
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-6 py-8 text-sm text-gray-400 text-center">
          Loading plants…
        </div>
      ) : plants.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-4xl mb-2">🏭</p>
          <p className="text-sm font-medium text-gray-600">No plants yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add plants to organise your units and equipment
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 text-sm text-indigo-500 hover:text-indigo-700"
          >
            + Add first plant
          </button>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Plant Name', 'Code', 'Description', 'Units', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {plants.map((plant) => (
              <tr key={plant.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  {editingId === plant.id ? (
                    <input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') update(plant.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="border border-indigo-400 rounded px-2 py-1 text-sm w-full focus:outline-none"
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{plant.name}</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  {editingId === plant.id ? (
                    <input
                      value={editForm.code ?? ''}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, code: e.target.value }))
                      }
                      className="border border-indigo-400 rounded px-2 py-1 text-sm w-24 focus:outline-none font-mono"
                    />
                  ) : (
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {plant.code ?? '—'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-gray-500">
                  {editingId === plant.id ? (
                    <input
                      value={editForm.description ?? ''}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      className="border border-indigo-400 rounded px-2 py-1 text-sm w-full focus:outline-none"
                    />
                  ) : (
                    plant.description ?? '—'
                  )}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      (plant._count?.units ?? 0) > 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {plant._count?.units ?? 0} unit
                    {(plant._count?.units ?? 0) !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {editingId === plant.id ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => update(plant.id)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingId(plant.id);
                          setEditForm({
                            name: plant.name,
                            code: plant.code ?? '',
                            description: plant.description ?? '',
                          });
                        }}
                        className="text-xs text-indigo-500 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(plant.id)}
                        disabled={(plant._count?.units ?? 0) > 0}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          (plant._count?.units ?? 0) > 0
                            ? 'Remove all units before deleting'
                            : 'Delete plant'
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
