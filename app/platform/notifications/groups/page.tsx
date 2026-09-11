'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { NotificationSubNav } from '@/components/platform/NotificationSubNav';

interface Group {
  id: string;
  name: string;
  description: string | null;
  members: Array<{ type: string; value: string; label?: string }>;
  is_active: boolean;
  created_at: string;
}



export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', description: '',
    members: [{ type: 'email', value: '', label: '' }] as Array<{ type: string; value: string; label: string }>,
  });

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/notifications/groups');
      if (res.ok) { const d = await res.json(); setGroups(d.groups || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  function openCreate() {
    setEditId(null); setForm({ name: '', description: '', members: [{ type: 'email', value: '', label: '' }] }); setError(null); setShowModal(true);
  }

  function openEdit(g: Group) {
    setEditId(g.id);
    setForm({
      name: g.name, description: g.description ?? '',
      members: g.members.map((m) => ({ type: m.type, value: m.value, label: m.label ?? '' })),
    });
    setError(null); setShowModal(true);
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const url = editId ? `/api/platform/notifications/groups/${editId}` : '/api/platform/notifications/groups';
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, members: form.members.filter((m) => m.value) }),
      });
      if (res.ok) { setShowModal(false); await fetchGroups(); }
      else { const d = await res.json(); setError(d.error); }
    } catch { setError('Network error'); } finally { setSaving(false); }
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete this group?')) return;
    await fetch(`/api/platform/notifications/groups/${id}`, { method: 'DELETE' });
    await fetchGroups();
  }

  function addMember() { setForm((p) => ({ ...p, members: [...p.members, { type: 'email', value: '', label: '' }] })); }
  function removeMember(i: number) { setForm((p) => ({ ...p, members: p.members.filter((_, idx) => idx !== i) })); }
  function updateMember(i: number, field: string, val: string) {
    setForm((p) => ({ ...p, members: p.members.map((m, idx) => idx === i ? { ...m, [field]: val } : m) }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Distribution Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Create reusable recipient groups for notifications</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]">+ Add Group</button>
      </div>

      <NotificationSubNav />

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading groups…</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-lg font-semibold text-gray-700">No Distribution Groups</h3>
          <p className="text-sm text-gray-500 mt-1">Create groups to easily target notification recipients.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{g.name}</h3>
                  {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(g)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => deleteGroup(g.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
              <div className="space-y-1">
                {(g.members ?? []).map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-xs rounded uppercase font-medium ${
                      m.type === 'user' ? 'bg-blue-50 text-blue-600' : m.type === 'role' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-600'
                    }`}>{m.type}</span>
                    <span className="text-sm text-gray-700">{m.label || m.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-400">{(g.members ?? []).length} member(s)</div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'Edit Group' : 'New Group'}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Planning Team" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase">Members</p>
                <button onClick={addMember} className="text-xs text-blue-600 hover:underline">+ Add Member</button>
              </div>
              {form.members.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={m.type} onChange={(e) => updateMember(i, 'type', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-20">
                    <option value="email">Email</option>
                    <option value="user">User</option>
                    <option value="role">Role</option>
                  </select>
                  <input value={m.value} onChange={(e) => updateMember(i, 'value', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                    placeholder={m.type === 'email' ? 'user@example.com' : m.type === 'role' ? 'e.g. planner' : 'User ID'} />
                  <input value={m.label} onChange={(e) => updateMember(i, 'label', e.target.value)}
                    className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" placeholder="Label" />
                  {form.members.length > 1 && <button onClick={() => removeMember(i)} className="text-red-500 text-xs">✕</button>}
                </div>
              ))}

              {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={save} disabled={saving || !form.name}
                className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50">
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
