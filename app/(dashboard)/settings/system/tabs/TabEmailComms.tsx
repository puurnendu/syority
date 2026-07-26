'use client';
import { useState } from 'react';

export default function TabEmailComms({ settings, onSave }: { settings: any; onSave: (s: any) => void }) {
  const [outboundEmail, setOutboundEmail] = useState(settings.outboundEmail || '');
  const [emailFooter, setEmailFooter] = useState(settings.emailFooter || '');
  const [digestFrequency, setDigestFrequency] = useState(settings.digestFrequency || 'daily');
  const [shiftReportRecipients, setShiftReportRecipients] = useState(settings.shiftReportRecipients || '');

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Email & Communications</h2>
      <p className="text-sm text-gray-500">Configure outbound email settings and default communication preferences.</p>

      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Outbound Email Address</label>
          <input
            type="email"
            value={outboundEmail}
            onChange={(e) => setOutboundEmail(e.target.value)}
            placeholder="noreply@yourdomain.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Reply-to address for all system-generated emails.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Footer (HTML)</label>
          <textarea
            value={emailFooter}
            onChange={(e) => setEmailFooter(e.target.value)}
            rows={3}
            placeholder="<p>Confidentiality Notice...</p>"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notification Digest Frequency</label>
          <select
            value={digestFrequency}
            onChange={(e) => setDigestFrequency(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="none">None (Immediate only)</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Shift Report Recipients</label>
          <input
            type="text"
            value={shiftReportRecipients}
            onChange={(e) => setShiftReportRecipients(e.target.value)}
            placeholder="manager1@domain.com, manager2@domain.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={() => onSave({ outboundEmail, emailFooter, digestFrequency, shiftReportRecipients })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Save Email Settings
        </button>
      </div>
    </div>
  );
}
