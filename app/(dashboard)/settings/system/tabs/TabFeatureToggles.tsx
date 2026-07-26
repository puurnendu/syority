'use client';
import { useState } from 'react';

const FEATURES = [
  { id: 'safety', label: 'Safety Incidents & Observations', desc: 'Enable safety logging and dashboards.' },
  { id: 'whatsapp', label: 'WhatsApp Integration', desc: 'Enable WhatsApp shift reports and notifications.' },
  { id: 'permits', label: 'Digital Permits', desc: 'Enable electronic permit to work system.' },
  { id: 'ai', label: 'AI Suite', desc: 'Enable generative AI extraction, suggestions, and auto-fills.' },
  { id: 'mobileApp', label: 'Mobile App Access', desc: 'Allow field crew to login via the SYORITY Mobile App.' },
  { id: 'experimental', label: 'Experimental Features', desc: 'Opt-in to beta features before General Availability.' },
];

export default function TabFeatureToggles({ featureFlags, onSave }: { featureFlags: any; onSave: (f: any) => void }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({
    safety: featureFlags.safety ?? true,
    whatsapp: featureFlags.whatsapp ?? true,
    permits: featureFlags.permits ?? false,
    ai: featureFlags.ai ?? true,
    mobileApp: featureFlags.mobileApp ?? false,
    experimental: featureFlags.experimental ?? false,
  });

  const toggleFlag = (id: string) => {
    setFlags((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Feature Toggles</h2>
        <p className="text-sm text-gray-500">Enable or disable entire modules for your organization.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {FEATURES.map((feat) => (
          <div key={feat.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{feat.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{feat.desc}</p>
            </div>
            <button
              onClick={() => toggleFlag(feat.id)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                flags[feat.id] ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={flags[feat.id]}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  flags[feat.id] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onSave(flags)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        Save Feature Toggles
      </button>
    </div>
  );
}
