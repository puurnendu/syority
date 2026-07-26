'use client';
import { useState } from 'react';

export default function TabMaintenance({ settings, onSave }: { settings: any; onSave: (s: any) => void }) {
  const [maintenanceBanner, setMaintenanceBanner] = useState(settings.maintenanceBanner || '');
  const [readOnlyMode, setReadOnlyMode] = useState(settings.readOnlyMode || false);
  const [scheduledDowntime, setScheduledDowntime] = useState(settings.scheduledDowntime || '');

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">System Maintenance</h2>
        <p className="text-sm text-gray-500">Manage tenant downtime, banners, and read-only locks.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <span className="text-amber-600 text-xl">⚠️</span>
          <div>
            <h3 className="text-sm font-bold text-amber-800">Caution</h3>
            <p className="text-xs text-amber-700 mt-1">
              Changes here can lock users out of the system or prevent data entry. Ensure you coordinate with your team before enabling Read-Only mode.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Global Maintenance Banner</label>
          <input
            type="text"
            value={maintenanceBanner}
            onChange={(e) => setMaintenanceBanner(e.target.value)}
            placeholder="e.g. System will be down for maintenance this Sunday at 2 AM UTC."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">This message will be displayed at the top of the screen for all users.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Downtime Window</label>
          <input
            type="datetime-local"
            value={scheduledDowntime}
            onChange={(e) => setScheduledDowntime(e.target.value)}
            className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="readOnlyMode"
            checked={readOnlyMode}
            onChange={(e) => setReadOnlyMode(e.target.checked)}
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <label htmlFor="readOnlyMode" className="text-sm font-bold text-gray-800">
            Enable Read-Only Mode
          </label>
        </div>
        <p className="text-xs text-gray-500 ml-6">Blocks all POST, PATCH, and DELETE requests across the tenant.</p>

        <div className="pt-4">
          <button
            onClick={() => onSave({ maintenanceBanner, readOnlyMode, scheduledDowntime })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Save Maintenance Settings
          </button>
        </div>
      </div>
    </div>
  );
}
