'use client';

import { useState, useEffect } from 'react';

export default function SsoClient() {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/sso')
      .then(r => r.json())
      .then(d => {
        if (d.config) setConfig(d.config);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/sso', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setMessage({ type: 'success', text: 'SSO Configuration saved successfully.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save configuration.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error occurred.' });
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-gray-500">Loading SSO settings...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Single Sign-On (SSO)</h1>
        <p className="text-sm text-gray-500 mt-1">Configure Enterprise Authentication via SAML 2.0 or OIDC.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 space-y-6">
        
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Enable SSO</h3>
            <p className="text-sm text-gray-500">Allow users to log in using your Identity Provider.</p>
          </div>
          <div className="flex items-center h-6">
            <input
              type="checkbox"
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={config.is_active || false}
              onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
            <select
              value={config.provider_type || 'saml'}
              onChange={(e) => setConfig({ ...config, provider_type: e.target.value })}
              className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="saml">SAML 2.0 (Azure AD, Okta)</option>
              <option value="oidc">OpenID Connect (OIDC)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Identity Provider (IdP) URL</label>
            <input
              type="url"
              value={config.idp_url || ''}
              onChange={(e) => setConfig({ ...config, idp_url: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://login.microsoftonline.com/.../saml2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID / Entity ID</label>
            <input
              type="text"
              value={config.client_id || ''}
              onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Application ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret (OIDC Only)</label>
            <input
              type="password"
              value={config.client_secret || ''}
              onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Secret Value"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">X.509 Public Certificate (SAML Only)</label>
            <textarea
              value={config.certificate || ''}
              onChange={(e) => setConfig({ ...config, certificate: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-blue-500 focus:border-blue-500"
              placeholder="-----BEGIN CERTIFICATE-----..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain Whitelist</label>
            <input
              type="text"
              value={(config.domain_whitelist || []).join(', ')}
              onChange={(e) => {
                const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                setConfig({ ...config, domain_whitelist: arr });
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="company.com, subsidiary.com"
            />
            <p className="text-xs text-gray-500 mt-1">Users logging in with these email domains will be automatically redirected to your Identity Provider.</p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
