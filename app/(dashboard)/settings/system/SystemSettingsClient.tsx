'use client';

import { useState, useEffect } from 'react';
import TabEmailComms from './tabs/TabEmailComms';
import TabApiAccess from './tabs/TabApiAccess';
import TabDataStorage from './tabs/TabDataStorage';
import TabFeatureToggles from './tabs/TabFeatureToggles';
import TabMaintenance from './tabs/TabMaintenance';

const TABS = [
  { id: 'email', label: 'Email & Communications', icon: '✉️' },
  { id: 'api', label: 'API Access', icon: '🔑' },
  { id: 'data', label: 'Data & Storage', icon: '💾' },
  { id: 'features', label: 'Feature Toggles', icon: '⚙️' },
  { id: 'maintenance', label: 'Maintenance', icon: '🛠️' },
];

export default function SystemSettingsClient() {
  const [activeTab, setActiveTab] = useState('email');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({});
  const [featureFlags, setFeatureFlags] = useState<any>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/system')
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setSettings(d.settings || {});
          setFeatureFlags(d.feature_flags || {});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (newSettings: any, newFlags: any) => {
    setMessage(null);
    try {
      const res = await fetch('/api/settings/system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { ...settings, ...newSettings },
          feature_flags: { ...featureFlags, ...newFlags },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setFeatureFlags(data.feature_flags);
        setMessage({ type: 'success', text: 'Settings saved successfully.' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h1>
        <p className="text-gray-500">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage tenant-level configurations, APIs, storage, and maintenance.</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-4">
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'email' && <TabEmailComms settings={settings} onSave={(s) => handleSave(s, {})} />}
          {activeTab === 'api' && <TabApiAccess settings={settings} onSave={(s) => handleSave(s, {})} />}
          {activeTab === 'data' && <TabDataStorage settings={settings} onSave={(s) => handleSave(s, {})} />}
          {activeTab === 'features' && <TabFeatureToggles featureFlags={featureFlags} onSave={(f) => handleSave({}, f)} />}
          {activeTab === 'maintenance' && <TabMaintenance settings={settings} onSave={(s) => handleSave(s, {})} />}
        </div>
      </div>
    </div>
  );
}
