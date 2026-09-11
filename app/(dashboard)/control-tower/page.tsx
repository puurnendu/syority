'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';

/**
 * STO → Intelligence → Control Tower (M13) — tenant-menu landing.
 *
 * The Control Tower is Event-scoped (`/events/[eventId]/control-tower`). This
 * landing resolves the active workspace Event and forwards to it; without an
 * active Event it offers an Event picker. It holds no authority of its own.
 */
export default function ControlTowerLandingPage() {
  const router = useRouter();
  const { activeEventId, allShutdowns, isLoading, setActiveShutdown } = useActiveShutdown();

  useEffect(() => {
    if (!isLoading && activeEventId) {
      router.replace(`/events/${activeEventId}/control-tower`);
    }
  }, [isLoading, activeEventId, router]);

  if (isLoading || activeEventId) {
    return <div className="p-6 text-gray-400">Opening Control Tower…</div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Control Tower</h1>
      <p className="text-sm text-gray-500 mb-6">
        Control Tower is Event-scoped. Select the turnaround Event to open its
        Control Tower.
      </p>
      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {allShutdowns.length === 0 && (
          <p className="p-5 text-sm text-gray-500">
            No Events found. Create one under{' '}
            <Link href="/events" className="text-indigo-600 hover:underline">
              Events / TAs
            </Link>
            .
          </p>
        )}
        {allShutdowns.map((ev) => (
          <button
            key={ev.id}
            onClick={() => {
              setActiveShutdown(ev.id);
              router.push(`/events/${ev.id}/control-tower`);
            }}
            className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900">
              {ev.code} — {ev.name}
            </span>
            <span className="ml-2 text-xs text-gray-400">{ev.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
