'use client';
import { useState } from 'react';

export default function TabDataStorage({ settings, onSave }: { settings: any; onSave: (s: any) => void }) {
  const [attachmentRetention, setAttachmentRetention] = useState(settings.attachmentRetention || '0');
  const [auditRetention, setAuditRetention] = useState(settings.auditRetention || '365');

  // Simulated storage metrics
  const usedGB = 142;
  const totalGB = 500;
  const percent = Math.round((usedGB / totalGB) * 100);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Data & Storage</h2>
        <p className="text-sm text-gray-500">Manage file storage limits, retention policies, and compliance exports.</p>
      </div>

      {/* Storage Quota */}
      <div className="max-w-2xl bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-md font-medium text-gray-800 mb-2">File Storage Quota</h3>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{usedGB} GB Used</span>
          <span>{totalGB} GB Total</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${percent > 90 ? 'bg-red-500' : 'bg-blue-600'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">Storage includes PDF attachments, shift report images, and P6 XML imports. To increase your quota, please contact support.</p>
      </div>

      <hr className="border-gray-200" />

      {/* Retention Policies */}
      <div className="max-w-2xl space-y-6">
        <h3 className="text-md font-medium text-gray-800">Retention Policies</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attachment Retention (Days)</label>
          <select
            value={attachmentRetention}
            onChange={(e) => setAttachmentRetention(e.target.value)}
            className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="0">Keep forever</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Attachments older than this will be permanently deleted from S3.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Audit Log Retention (Days)</label>
          <select
            value={auditRetention}
            onChange={(e) => setAuditRetention(e.target.value)}
            className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="1825">5 years</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">System audit records will be pruned after this period.</p>
        </div>

        <button
          onClick={() => onSave({ attachmentRetention, auditRetention })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Save Policies
        </button>
      </div>

      <hr className="border-gray-200" />

      {/* Data Export */}
      <div className="max-w-2xl bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-md font-medium text-gray-800 mb-2">GDPR Data Export</h3>
        <p className="text-sm text-gray-600 mb-4">
          Request a complete archive of your tenant's data in JSON and CSV formats. This process may take up to 24 hours. A download link will be emailed to you.
        </p>
        <button
          onClick={() => alert('Export request queued. You will receive an email shortly.')}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300"
        >
          Request Full Data Archive
        </button>
      </div>
    </div>
  );
}
