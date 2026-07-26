'use client';

import { useState } from 'react';
import { AiConfigForm } from './AiConfigForm';
import AiPromptsTab from './AiPromptsTab';
import AiLogsTab from './AiLogsTab';
import AiDiagnosticsTab from './AiDiagnosticsTab';
import AiWhatsAppTab from './AiWhatsAppTab';

type Tab = 'provider' | 'prompts' | 'logs' | 'diagnostics' | 'whatsapp';

const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'provider', label: 'Provider Setup', icon: '⚙️' },
    { key: 'whatsapp', label: 'WhatsApp API', icon: '📱' },
    { key: 'prompts', label: 'Prompt Templates', icon: '📝' },
    { key: 'diagnostics', label: 'Diagnostics', icon: '🛡️' },
    { key: 'logs', label: 'AI Logs', icon: '🔍' },
];

export function AiConfigPage({ existing, orgId }: { existing: any; orgId: string }) {
    const [activeTab, setActiveTab] = useState<Tab>('provider');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Manage AI providers, customise prompts, and inspect execution logs.
                </p>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 border-b border-gray-200">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            activeTab === tab.key
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'provider' && (
                <AiConfigForm existing={existing} orgId={orgId} />
            )}
            {activeTab === 'prompts' && (
                <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                        Each AI feature has its own prompt template. Changes take effect immediately for all future jobs.
                        Use <code className="bg-gray-100 px-1 rounded text-gray-700">{`{{variable}}`}</code> placeholders — they are replaced at runtime.
                    </p>
                    <AiPromptsTab />
                </div>
            )}
            {activeTab === 'logs' && (
                <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                        Every AI call is logged here. Click <strong>View</strong> on any row to inspect the full prompt and response.
                    </p>
                    <AiLogsTab />
                </div>
            )}
            {activeTab === 'whatsapp' && (
                <AiWhatsAppTab existing={existing} orgId={orgId} />
            )}
            {activeTab === 'diagnostics' && (
                <AiDiagnosticsTab />
            )}
        </div>
    );
}
