'use client';

import { useState, useEffect, FormEvent } from 'react';

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5";

export function WhatsAppConfigForm() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/whatsapp-config')
      .then(res => res.json())
      .then(data => {
        if (data.data) setConfig(data.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);

    const body = {
      whatsapp_business_id: form.get('whatsapp_business_id'),
      whatsapp_phone_number_id: form.get('whatsapp_phone_number_id'),
      whatsapp_verify_token: form.get('whatsapp_verify_token'),
      whatsapp_access_token: form.get('whatsapp_access_token') || undefined,
    };

    try {
      const res = await fetch('/api/whatsapp-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      setMessage({ type: 'success', text: 'WhatsApp configuration saved successfully!' });
      // update local state
      setConfig((prev: any) => ({
        ...prev,
        ...body,
        has_access_token: !!body.whatsapp_access_token || prev?.has_access_token,
      }));
      // Clear token field
      (e.currentTarget.elements.namedItem('whatsapp_access_token') as HTMLInputElement).value = '';
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-500 py-8">Loading configuration...</div>;

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '';

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Cloud API Credentials</h2>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>WhatsApp Business Account ID</label>
              <input name="whatsapp_business_id" defaultValue={config?.whatsapp_business_id || ''} placeholder="e.g. 1029384756" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Found in your Meta App Dashboard.</p>
            </div>
            <div>
              <label className={labelCls}>Phone Number ID</label>
              <input name="whatsapp_phone_number_id" defaultValue={config?.whatsapp_phone_number_id || ''} placeholder="e.g. 10293847561029" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">The specific ID of the sending phone number.</p>
            </div>
          </div>

          <div>
            <label className={labelCls}>Permanent Access Token</label>
            <input 
              name="whatsapp_access_token" 
              type="password" 
              placeholder={config?.has_access_token ? "•••••••• (Token configured, leave blank to keep)" : "EAA..."} 
              className={inputCls} 
            />
            <p className="text-xs text-gray-400 mt-1">Generate a System User token in Meta Business Settings with `whatsapp_business_messaging` permissions.</p>
          </div>

          <div>
            <label className={labelCls}>Webhook Verify Token</label>
            <input name="whatsapp_verify_token" defaultValue={config?.whatsapp_verify_token || 'syority_webhook_v1'} className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Custom string used to verify webhook setup in Meta Developer portal.</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </form>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Webhook Configuration Details</h3>
        <p className="text-xs text-blue-700 mb-4">When configuring your webhook in the Meta Developer Portal, use the following URL:</p>
        <div className="bg-white px-3 py-2 rounded border border-blue-100 font-mono text-xs text-gray-800 break-all select-all">
          {webhookUrl}
        </div>
        <p className="text-xs text-blue-700 mt-3">Ensure you subscribe to the `messages` webhook field.</p>
      </div>
    </div>
  );
}
