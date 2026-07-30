'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  slug: string;
  category: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: string[];
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const NAV_ITEMS = [
  { href: '/platform/notifications', label: 'Dashboard', icon: '📊' },
  { href: '/platform/notifications/providers', label: 'Providers', icon: '🔌' },
  { href: '/platform/notifications/templates', label: 'Templates', icon: '📝' },
  { href: '/platform/notifications/rules', label: 'Rules', icon: '⚡' },
  { href: '/platform/notifications/groups', label: 'Groups', icon: '👥' },
  { href: '/platform/notifications/queue', label: 'Queue', icon: '📬' },
];

const CATEGORIES = ['authentication', 'planning', 'execution', 'reports', 'platform'];

const AVAILABLE_VARIABLES = [
  'user_name', 'company', 'event', 'unit', 'system', 'asset', 'workpack',
  'contractor', 'planner', 'approval_link', 'reset_link', 'date', 'time',
  'logo', 'app_url', 'workpack_number', 'workpack_title', 'reviewer_name',
  'changed_by', 'notes', 'equipment', 'planned_start', 'planned_end',
];

const emptyForm = {
  slug: '', category: 'authentication', name: '', subject: '', html_body: '', text_body: '', variables: [] as string[],
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const url = activeCategory
        ? `/api/platform/notifications/templates?category=${activeCategory}`
        : '/api/platform/notifications/templates';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [activeCategory]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setPreviewHtml(null);
    setError(null);
    setShowModal(true);
  }

  function openEdit(t: Template) {
    setEditId(t.id);
    setForm({
      slug: t.slug, category: t.category, name: t.name, subject: t.subject,
      html_body: t.html_body, text_body: t.text_body ?? '', variables: t.variables ?? [],
    });
    setPreviewHtml(null);
    setError(null);
    setShowModal(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = editId ? `/api/platform/notifications/templates/${editId}` : '/api/platform/notifications/templates';
      const method = editId ? 'PUT' : 'POST';
      const body = { ...form };
      if (editId) delete (body as any).slug; // Can't change slug on update
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { setShowModal(false); await fetchTemplates(); }
      else { const data = await res.json(); setError(data.error || 'Save failed'); }
    } catch { setError('Network error'); } finally { setSaving(false); }
  }

  async function preview() {
    if (!editId) { setPreviewHtml('<p style="color:#666;">Save the template first to preview.</p>'); return; }
    try {
      const res = await fetch(`/api/platform/notifications/templates/${editId}/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      if (res.ok) { const data = await res.json(); setPreviewHtml(data.html); }
    } catch { /* ignore */ }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await fetch(`/api/platform/notifications/templates/${id}`, { method: 'DELETE' });
      await fetchTemplates();
    } catch { /* ignore */ }
  }

  function toggleVariable(v: string) {
    setForm((prev) => ({
      ...prev,
      variables: prev.variables.includes(v) ? prev.variables.filter((x) => x !== v) : [...prev.variables, v],
    }));
  }

  function insertVariable(v: string) {
    setForm((prev) => ({ ...prev, html_body: prev.html_body + `{{${v}}}` }));
  }

  const filtered = templates;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Manage notification templates with variable substitution</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]">
          + Add Template
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
              item.href === '/platform/notifications/templates' ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          ><span>{item.icon}</span>{item.label}</Link>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors ${!activeCategory ? 'bg-[#0D2137] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 text-xs rounded-full capitalize transition-colors ${activeCategory === cat ? 'bg-[#0D2137] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="text-lg font-semibold text-gray-700">No Templates</h3>
          <p className="text-sm text-gray-500 mt-1">Create your first notification template.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Variables</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ver</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{t.category}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{(t.variables ?? []).length}</td>
                  <td className="px-4 py-3 text-gray-500">v{t.version}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(t)} className="text-xs text-blue-600 hover:underline mr-3">Edit</button>
                    <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Template Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'Edit Template' : 'New Template'}</h2>
              {editId && <button onClick={preview} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">👁 Preview</button>}
            </div>
            <div className="p-5 grid grid-cols-3 gap-6">
              {/* Left: Form */}
              <div className="col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Template Name</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Password Reset" />
                  </div>
                  {!editId && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Slug (unique)</label>
                      <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="password-reset" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm capitalize">
                      {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Reset your password for {{company}}" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">HTML Body</label>
                  <textarea value={form.html_body} onChange={(e) => setForm({ ...form, html_body: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono h-48 resize-y"
                    placeholder="<h2>Hello {{user_name}}</h2>" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Plain Text Body (optional)</label>
                  <textarea value={form.text_body} onChange={(e) => setForm({ ...form, text_body: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 resize-y"
                    placeholder="Hello {{user_name}}" />
                </div>
                {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
              </div>

              {/* Right: Variables + Preview */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Template Variables</h3>
                  <p className="text-xs text-gray-400 mb-2">Click to add. Selected = declared.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_VARIABLES.map((v) => (
                      <button key={v} onClick={() => { toggleVariable(v); insertVariable(v); }}
                        className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                          form.variables.includes(v) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}>
                        {'{{' + v + '}}'}
                      </button>
                    ))}
                  </div>
                </div>

                {previewHtml && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Preview</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 max-h-[400px] overflow-y-auto">
                      <iframe srcDoc={previewHtml} className="w-full h-80 border-0" title="Template Preview" sandbox="" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || (!editId && !form.slug)}
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
