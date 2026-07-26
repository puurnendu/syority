'use client';

import { useState, useEffect } from 'react';

export default function TabApiAccess({ settings, onSave }: { settings: any; onSave: (s: any) => void }) {
  const [ipWhitelist, setIpWhitelist] = useState(settings.ipWhitelist || '');
  const [webhookConfig, setWebhookConfig] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    loadWebhooks();
    loadApiKeys();
  }, []);

  async function loadWebhooks() {
    const res = await fetch('/api/settings/system/webhooks');
    const data = await res.json();
    if (data.config) setWebhookConfig(data.config);
    else setWebhookConfig({ url: '', secret: '', events: [], is_active: false });
  }

  async function loadApiKeys() {
    const res = await fetch('/api/settings/system/api-keys');
    const data = await res.json();
    if (data.keys) setApiKeys(data.keys);
  }

  async function generateKey() {
    if (!newKeyName.trim()) return;
    const res = await fetch('/api/settings/system/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName, expiresInDays: 365 }),
    });
    const data = await res.json();
    if (data.success) {
      setGeneratedKey(data.raw_key);
      setNewKeyName('');
      loadApiKeys();
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    const res = await fetch(`/api/settings/system/api-keys/${id}`, { method: 'DELETE' });
    if (res.ok) loadApiKeys();
  }

  async function saveWebhook() {
    await fetch('/api/settings/system/webhooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookConfig),
    });
    alert('Webhook saved.');
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">API Access & Webhooks</h2>
        <p className="text-sm text-gray-500">Manage programmatic access to your tenant data.</p>
      </div>

      {/* IP Whitelist */}
      <div className="max-w-2xl">
        <h3 className="text-md font-medium text-gray-800 mb-2">IP Whitelist</h3>
        <textarea
          value={ipWhitelist}
          onChange={(e) => setIpWhitelist(e.target.value)}
          rows={2}
          placeholder="192.168.1.1, 10.0.0.0/24"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono mb-2"
        />
        <button
          onClick={() => onSave({ ipWhitelist })}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
        >
          Save Whitelist
        </button>
      </div>

      <hr className="border-gray-200" />

      {/* API Keys */}
      <div className="max-w-4xl">
        <h3 className="text-md font-medium text-gray-800 mb-4">API Keys</h3>
        
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. SAP Integration Key"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={generateKey}
            disabled={!newKeyName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Generate New Key
          </button>
        </div>

        {generatedKey && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-bold text-amber-800 mb-1">Store this key safely! It will not be shown again.</p>
            <code className="text-sm bg-white px-2 py-1 rounded border border-amber-300 break-all">{generatedKey}</code>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">No API keys found.</td></tr>
              ) : (
                apiKeys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-gray-900">{k.name}</td>
                    <td className="px-4 py-2 text-gray-500">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-500">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => revokeKey(k.id)} className="text-red-600 hover:text-red-800 font-medium">
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Webhooks */}
      {webhookConfig && (
        <div className="max-w-2xl">
          <h3 className="text-md font-medium text-gray-800 mb-4">Outbound Webhook</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="webhook_active"
                checked={webhookConfig.is_active}
                onChange={(e) => setWebhookConfig({ ...webhookConfig, is_active: e.target.checked })}
              />
              <label htmlFor="webhook_active" className="text-sm font-medium text-gray-700">Enable Outbound Webhook</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payload URL</label>
              <input
                type="url"
                value={webhookConfig.url}
                onChange={(e) => setWebhookConfig({ ...webhookConfig, url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret (Optional)</label>
              <input
                type="password"
                value={webhookConfig.secret || ''}
                onChange={(e) => setWebhookConfig({ ...webhookConfig, secret: e.target.value })}
                placeholder="Webhook signature secret"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={saveWebhook}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Save Webhook
            </button>
          </div>
        </div>
      )}

      {/* OAuth Client Credentials Placeholder */}
      <div className="max-w-2xl bg-gray-50 border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-center mt-8">
        <span className="text-3xl mb-2">🔐</span>
        <h3 className="text-lg font-semibold text-gray-900">OAuth Client Credentials</h3>
        <p className="text-sm text-gray-500 max-w-md mt-2">
          Create OAuth Apps for Single Sign-On integrations and 3rd party delegated access.
        </p>
        <span className="mt-4 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">COMING SOON</span>
      </div>

    </div>
  );
}
