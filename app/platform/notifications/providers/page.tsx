'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { NotificationSubNav } from '@/components/platform/NotificationSubNav';

interface Provider {
  id: string;
  name: string;
  provider_type: string;
  is_default: boolean;
  is_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_username: string | null;
  smtp_password_enc: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  timeout_ms: number | null;
  max_retries: number | null;
  created_at: string;
}



const PROVIDER_TYPES = [
  { value: 'smtp', label: 'SMTP' },
  { value: 'ses', label: 'Amazon SES' },
  { value: 'sendgrid', label: 'SendGrid' },
  { value: 'm365', label: 'Microsoft 365' },
  { value: 'mailgun', label: 'Mailgun' },
  { value: 'smtp_relay', label: 'SMTP Relay' },
];

const emptyForm = {
  name: '', provider_type: 'smtp', smtp_host: '', smtp_port: 587, smtp_secure: false,
  smtp_username: '', smtp_password: '', from_name: 'AURIANOA OS', from_email: '',
  reply_to: '', timeout_ms: 30000, max_retries: 3, is_default: false, is_enabled: true,
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ type: string; message: string } | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/notifications/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setTestResult(null);
    setShowModal(true);
  }

  function openEdit(p: Provider) {
    setEditId(p.id);
    setForm({
      name: p.name, provider_type: p.provider_type,
      smtp_host: p.smtp_host ?? '', smtp_port: p.smtp_port ?? 587,
      smtp_secure: p.smtp_secure ?? false, smtp_username: p.smtp_username ?? '',
      smtp_password: '', from_name: p.from_name ?? '', from_email: p.from_email ?? '',
      reply_to: p.reply_to ?? '', timeout_ms: p.timeout_ms ?? 30000,
      max_retries: p.max_retries ?? 3, is_default: p.is_default, is_enabled: p.is_enabled,
    });
    setTestResult(null);
    setShowModal(true);
  }

  async function saveProvider() {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.smtp_password) delete (body as any).smtp_password; // Don't send empty password
      const url = editId ? `/api/platform/notifications/providers/${editId}` : '/api/platform/notifications/providers';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setShowModal(false);
        await fetchProviders();
      } else {
        const data = await res.json();
        setTestResult({ type: 'error', message: data.error || 'Save failed' });
      }
    } catch { setTestResult({ type: 'error', message: 'Network error' }); } finally { setSaving(false); }
  }

  async function testConnection(id: string) {
    setTestResult({ type: 'info', message: 'Testing connection…' });
    try {
      const res = await fetch(`/api/platform/notifications/providers/${id}/test-connection`, { method: 'POST' });
      const data = await res.json();
      setTestResult({ type: data.ok ? 'success' : 'error', message: data.ok ? '✅ Connection successful!' : `❌ ${data.error}` });
    } catch { setTestResult({ type: 'error', message: 'Network error' }); }
  }

  async function sendTest(id: string) {
    const to = prompt('Send test email to:');
    if (!to) return;
    setTestResult({ type: 'info', message: 'Sending test email…' });
    try {
      const res = await fetch(`/api/platform/notifications/providers/${id}/test-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }),
      });
      const data = await res.json();
      setTestResult({ type: data.success ? 'success' : 'error', message: data.success ? `✅ Test email sent! ID: ${data.messageId}` : `❌ ${data.error}` });
    } catch { setTestResult({ type: 'error', message: 'Network error' }); }
  }

  async function setDefault(id: string) {
    try {
      await fetch(`/api/platform/notifications/providers/${id}/set-default`, { method: 'POST' });
      await fetchProviders();
    } catch { /* ignore */ }
  }

  async function deleteProvider(id: string) {
    if (!confirm('Delete this provider?')) return;
    try {
      await fetch(`/api/platform/notifications/providers/${id}`, { method: 'DELETE' });
      await fetchProviders();
    } catch { /* ignore */ }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notification Providers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage email delivery providers (SMTP, SES, SendGrid)</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] transition-colors">
          + Add Provider
        </button>
      </div>

      {/* Sub-nav */}
      <NotificationSubNav />

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading providers…</div>
      ) : providers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📧</div>
          <h3 className="text-lg font-semibold text-gray-700">No Providers Configured</h3>
          <p className="text-sm text-gray-500 mt-1">Add an SMTP provider to start sending notifications.</p>
          <button onClick={openCreate} className="mt-4 px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c]">
            + Add Provider
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className={`bg-white rounded-xl border p-5 ${p.is_default ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${p.is_enabled ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{p.name}</h3>
                      {p.is_default && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Default</span>}
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full uppercase">{p.provider_type}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {p.smtp_host && `${p.smtp_host}:${p.smtp_port}`}
                      {p.from_email && ` · From: ${p.from_email}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => testConnection(p.id)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Test</button>
                  <button onClick={() => sendTest(p.id)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Send Test</button>
                  {!p.is_default && <button onClick={() => setDefault(p.id)} className="px-3 py-1.5 text-xs border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50">Set Default</button>}
                  <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                  {!p.is_default && <button onClick={() => deleteProvider(p.id)} className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50">Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Result Toast */}
      {testResult && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg text-sm max-w-sm z-50 ${
          testResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          testResult.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {testResult.message}
          <button onClick={() => setTestResult(null)} className="ml-3 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'Edit Provider' : 'Add Provider'}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provider Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Corporate SMTP" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provider Type</label>
                <select value={form.provider_type} onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {form.provider_type === 'smtp' && (
                <>
                  <hr className="border-gray-200" />
                  <p className="text-xs font-semibold text-gray-500 uppercase">Connection Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Host</label>
                      <input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="smtp.gmail.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                      <input type="number" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mt-3">Authentication</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                    <input value={form.smtp_username} onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password {editId && '(leave blank to keep current)'}</label>
                    <input type="password" value={form.smtp_password} onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="••••••••" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.smtp_secure} onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked })}
                      className="rounded border-gray-300" />
                    Use SSL/TLS
                  </label>
                </>
              )}

              <hr className="border-gray-200" />
              <p className="text-xs font-semibold text-gray-500 uppercase">Default Sender</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Name</label>
                  <input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Email</label>
                  <input value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="noreply@aurianoa.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reply-To</label>
                <input value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="support@company.com" />
              </div>

              <hr className="border-gray-200" />
              <p className="text-xs font-semibold text-gray-500 uppercase">Retry Policy</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Timeout (ms)</label>
                  <input type="number" value={form.timeout_ms} onChange={(e) => setForm({ ...form, timeout_ms: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Max Retries</label>
                  <input type="number" value={form.max_retries} onChange={(e) => setForm({ ...form, max_retries: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
                    className="rounded border-gray-300" />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                    className="rounded border-gray-300" />
                  Set as Default
                </label>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${testResult.type === 'success' ? 'bg-green-50 text-green-700' : testResult.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                  {testResult.message}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={saveProvider} disabled={saving || !form.name}
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
