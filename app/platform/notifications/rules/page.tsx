'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Rule {
  id: string;
  name: string;
  event_type: string;
  channel: string;
  is_enabled: boolean;
  template: { name: string; slug: string } | null;
  recipients: Array<{ id: string; recipient_type: string; recipient_value: string }>;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  slug: string;
}

const NAV_ITEMS = [
  { href: '/platform/notifications', label: 'Dashboard', icon: '📊' },
  { href: '/platform/notifications/providers', label: 'Providers', icon: '🔌' },
  { href: '/platform/notifications/templates', label: 'Templates', icon: '📝' },
  { href: '/platform/notifications/rules', label: 'Rules', icon: '⚡' },
  { href: '/platform/notifications/groups', label: 'Groups', icon: '👥' },
  { href: '/platform/notifications/queue', label: 'Queue', icon: '📬' },
];

const EVENT_TYPES = [
  'password.reset', 'user.invited', 'user.welcome',
  'workpack.submitted', 'workpack.approved', 'workpack.rejected', 'workpack.issued',
  'scope.approved', 'event.created', 'event.approved',
  'qa.assigned', 'qa.passed', 'punch.assigned',
  'report.daily', 'report.shift', 'report.weekly',
  'system.backup_failed', 'system.queue_failure', 'system.alert',
];

const CHANNELS = ['email', 'sms', 'whatsapp', 'teams', 'slack', 'push', 'webhook'];
const RECIPIENT_TYPES = ['user', 'role', 'group', 'email', 'actor'];

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', event_type: 'workpack.submitted', channel: 'email', template_id: '', is_enabled: true,
    recipients: [{ recipient_type: 'role', recipient_value: '' }] as Array<{ recipient_type: string; recipient_value: string }>,
  });

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, templatesRes] = await Promise.all([
        fetch('/api/platform/notifications/rules'),
        fetch('/api/platform/notifications/templates'),
      ]);
      if (rulesRes.ok) { const d = await rulesRes.json(); setRules(d.rules || []); }
      if (templatesRes.ok) { const d = await templatesRes.json(); setTemplates(d.templates || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditId(null);
    setForm({ name: '', event_type: 'workpack.submitted', channel: 'email', template_id: templates[0]?.id ?? '', is_enabled: true, recipients: [{ recipient_type: 'role', recipient_value: '' }] });
    setError(null);
    setShowModal(true);
  }

  function openEdit(r: Rule) {
    setEditId(r.id);
    setForm({
      name: r.name, event_type: r.event_type, channel: r.channel,
      template_id: (r.template as any)?.id ?? '', is_enabled: r.is_enabled,
      recipients: r.recipients.map((rr) => ({ recipient_type: rr.recipient_type, recipient_value: rr.recipient_value })),
    });
    setError(null);
    setShowModal(true);
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const url = editId ? `/api/platform/notifications/rules/${editId}` : '/api/platform/notifications/rules';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { setShowModal(false); await fetchData(); }
      else { const d = await res.json(); setError(d.error || 'Save failed'); }
    } catch { setError('Network error'); } finally { setSaving(false); }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    await fetch(`/api/platform/notifications/rules/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_enabled: !enabled }),
    });
    await fetchData();
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return;
    await fetch(`/api/platform/notifications/rules/${id}`, { method: 'DELETE' });
    await fetchData();
  }

  function addRecipient() {
    setForm((prev) => ({ ...prev, recipients: [...prev.recipients, { recipient_type: 'role', recipient_value: '' }] }));
  }

  function removeRecipient(idx: number) {
    setForm((prev) => ({ ...prev, recipients: prev.recipients.filter((_, i) => i !== idx) }));
  }

  function updateRecipient(idx: number, field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      recipients: prev.recipients.map((r, i) => i === idx ? { ...r, [field]: value } : r),
    }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notification Rules</h1>
          <p className="text-sm text-gray-500 mt-1">Configure event → template → channel → recipient mappings</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]">
          + Add Rule
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
              item.href === '/platform/notifications/rules' ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}><span>{item.icon}</span>{item.label}</Link>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading rules…</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">⚡</div>
          <h3 className="text-lg font-semibold text-gray-700">No Rules Configured</h3>
          <p className="text-sm text-gray-500 mt-1">Create rules to automate notifications on business events.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{r.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs font-mono">{r.event_type}</span>
                    <span>→</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{r.template?.name ?? 'Unknown'}</span>
                    <span>→</span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-xs uppercase">{r.channel}</span>
                    <span>→</span>
                    <span className="text-xs text-gray-400">{r.recipients.length} recipient(s)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEnabled(r.id, r.is_enabled)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                    {r.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => openEdit(r)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                  <button onClick={() => deleteRule(r.id)} className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'Edit Rule' : 'New Rule'}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rule Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Workpack Approved → Email Planner" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
                  <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {EVENT_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
                  <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase">
                    {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Template</label>
                <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select template…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
                </select>
              </div>

              <hr className="border-gray-200" />
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase">Recipients</p>
                <button onClick={addRecipient} className="text-xs text-blue-600 hover:underline">+ Add Recipient</button>
              </div>
              {form.recipients.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={r.recipient_type} onChange={(e) => updateRecipient(i, 'recipient_type', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-24">
                    {RECIPIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={r.recipient_value} onChange={(e) => updateRecipient(i, 'recipient_value', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" placeholder={r.recipient_type === 'role' ? 'e.g. planner' : r.recipient_type === 'email' ? 'user@example.com' : 'value'} />
                  {form.recipients.length > 1 && (
                    <button onClick={() => removeRecipient(i)} className="text-red-500 text-xs">✕</button>
                  )}
                </div>
              ))}

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} className="rounded border-gray-300" />
                Enabled
              </label>

              {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.template_id}
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
