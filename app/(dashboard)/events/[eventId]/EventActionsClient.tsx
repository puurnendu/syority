'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';

export default function EventActionsClient({ eventId, currentStatus }: { eventId: string, currentStatus: string }) {
  const router = useRouter();
  const { activeEventId, setActiveShutdown } = useActiveShutdown();
  const [status, setStatus] = useState<'idle' | 'closing' | 'error'>('idle');

  const isActive = activeEventId === eventId;

  const handleClose = async () => {
    if (!confirm('Are you sure you want to close this event? All workpacks must be closed.')) return;
    setStatus('closing');

    try {
      const res = await fetch(`/api/events/${eventId}/close`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to close event');
      }
      
      setStatus('idle');
      router.refresh();
    } catch (e: any) {
      alert(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isActive ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold rounded-lg">
          <span>✓</span> Active Workspace
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setActiveShutdown(eventId)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          🎯 Set as Active Workspace
        </button>
      )}

      {currentStatus.toLowerCase() === 'closed' ? (
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 text-sm font-semibold rounded-lg cursor-not-allowed">
          🔒 Closed
        </span>
      ) : (
        <button
          onClick={handleClose}
          disabled={status === 'closing'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50"
        >
          {status === 'closing' ? 'Closing...' : '🔒 Close Event'}
        </button>
      )}
    </div>
  );
}
