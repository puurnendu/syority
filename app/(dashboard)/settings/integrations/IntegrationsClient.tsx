'use client';

import { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'sap', name: 'SAP ERP', type: 'Materials & BOM Sync', icon: '📦', color: 'bg-blue-100 text-blue-700' },
  { id: 'p6', name: 'Primavera P6', type: 'Schedule Sync', icon: '⏱️', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'msproject', name: 'MS Project', type: 'Schedule Sync', icon: '📊', color: 'bg-green-100 text-green-700' },
  { id: 'docusign', name: 'DocuSign', type: 'E-Signatures', icon: '✍️', color: 'bg-amber-100 text-amber-700' },
  { id: 'slack', name: 'Slack', type: 'Notifications', icon: '💬', color: 'bg-purple-100 text-purple-700' },
  { id: 'calendars', name: 'MS365 / Outlook', type: 'Calendar Sync', icon: '📅', color: 'bg-cyan-100 text-cyan-700' },
];

export default function IntegrationsClient() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [configForm, setConfigForm] = useState<any>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    setLoading(true);
    const res = await fetch('/api/settings/integrations');
    const data = await res.json();
    if (data.integrations) {
      setIntegrations(data.integrations);
    }
    setLoading(false);
  }

  const getStatus = (providerId: string) => {
    const int = integrations.find(i => i.provider === providerId);
    return int?.status || 'disconnected';
  };

  const getLastSync = (providerId: string) => {
    const int = integrations.find(i => i.provider === providerId);
    return int?.last_sync_at ? new Date(int.last_sync_at).toLocaleString() : 'Never';
  };

  const handleOpenConfig = (provider: any) => {
    const int = integrations.find(i => i.provider === provider.id);
    setConfigForm(int?.config || {});
    setTestResult(null);
    setSelectedProvider(provider);
  };

  const handleSaveConfig = async (status: string = 'connected') => {
    await fetch('/api/settings/integrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: selectedProvider.id,
        config: configForm,
        status,
      }),
    });
    setSelectedProvider(null);
    fetchIntegrations();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.id,
          config: configForm,
        }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
      if (data.success) {
        // Auto-save as connected if test succeeds
        await handleSaveConfig('connected');
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Network error occurred during test.' });
    }
    setTesting(false);
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${selectedProvider.name}?`)) return;
    await fetch('/api/settings/integrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: selectedProvider.id,
        config: {},
        status: 'disconnected',
      }),
    });
    setSelectedProvider(null);
    fetchIntegrations();
  };

  if (loading) return <div className="p-8">Loading integrations...</div>;

  return (
    <div className="max-w-6xl mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Connect SYORITY with your enterprise ecosystem.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROVIDERS.map((provider) => {
          const status = getStatus(provider.id);
          const lastSync = getLastSync(provider.id);
          
          return (
            <div key={provider.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${provider.color}`}>
                  {provider.icon}
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  status === 'connected' ? 'bg-green-100 text-green-800' :
                  status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {status.toUpperCase()}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900">{provider.name}</h3>
              <p className="text-xs text-gray-500 mb-4">{provider.type}</p>
              
              <div className="text-xs text-gray-400 mb-6 flex items-center gap-1">
                <span>🔄</span> Last Sync: {lastSync}
              </div>

              <button
                onClick={() => handleOpenConfig(provider)}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {status === 'connected' ? 'Configure' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Configuration Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>{selectedProvider.icon}</span> Configure {selectedProvider.name}
              </h3>
              <button onClick={() => setSelectedProvider(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {/* Dynamic form fields based on provider type */}
              {selectedProvider.id === 'sap' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SAP API Base URL</label>
                    <input
                      type="url"
                      value={configForm.apiUrl || ''}
                      onChange={(e) => setConfigForm({ ...configForm, apiUrl: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="https://sap-gateway.company.local/api"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Integration API Key</label>
                    <input
                      type="password"
                      value={configForm.apiKey || ''}
                      onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="sk_sap_..."
                    />
                  </div>
                </div>
              )}

              {selectedProvider.id === 'slack' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Incoming Webhook URL</label>
                    <input
                      type="url"
                      value={configForm.webhookUrl || ''}
                      onChange={(e) => setConfigForm({ ...configForm, webhookUrl: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                </div>
              )}

              {(selectedProvider.id === 'p6' || selectedProvider.id === 'msproject') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Server Endpoint (Optional)</label>
                    <input
                      type="url"
                      value={configForm.serverUrl || ''}
                      onChange={(e) => setConfigForm({ ...configForm, serverUrl: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="https://p6.company.local/api"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Alternatively, schedules can be imported manually via the Schedule view without a direct server connection.</p>
                </div>
              )}

              {(selectedProvider.id === 'docusign' || selectedProvider.id === 'calendars') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-bold mb-1">OAuth Integration</p>
                  <p>Click "Connect via Provider" to authenticate with your {selectedProvider.name} account. This will open a secure login window.</p>
                </div>
              )}

              {/* Test Results Banner */}
              {testResult && (
                <div className={`mt-6 p-3 rounded-lg text-sm font-medium ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? '✅ ' : '❌ '}{testResult.message}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              {getStatus(selectedProvider.id) !== 'disconnected' ? (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold"
                >
                  Disconnect
                </button>
              ) : <div></div>}
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : (selectedProvider.id === 'docusign' || selectedProvider.id === 'calendars' ? 'Connect via Provider' : 'Test & Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
