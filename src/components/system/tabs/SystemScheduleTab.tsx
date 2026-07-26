'use client';

export function SystemScheduleTab({ systemId }: { systemId: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-gray-600 text-sm">
        Mini schedule view for HO/WP/TO phases for this system. Link to open full P6 schedule filtered to this system can be added here.
      </p>
      <p className="text-gray-500 text-xs mt-2">
        System ID: {systemId}
      </p>
    </div>
  );
}
