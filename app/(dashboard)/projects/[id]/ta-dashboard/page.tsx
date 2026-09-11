import Link from 'next/link';

/**
 * R0.4-E — the Project TA Dashboard is RETIRED.
 *
 * This surface was a duplicate of the canonical Event campaign dashboard at
 * /events/{eventId}/ta-dashboard. It read the `/projects/[id]` URL segment and
 * used that same identifier as an Event key against Event progress, constraint,
 * punch, lookahead and safety APIs — letting a deprecated campaign identifier
 * establish Event identity. Several of those fallback endpoints do not exist,
 * so the surface was also partly dead.
 *
 * Event is the sole STO operational campaign container, so this page no longer
 * interprets the URL segment as a campaign at all. It renders a controlled
 * retired state (never a 404 dead end) and routes operators to Events.
 */
export default function RetiredProjectTADashboardPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          TA Dashboard has moved to Events
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          Turnaround campaigns are managed as Events. The turnaround dashboard is
          now available per Event, where schedule, progress and earned value all
          resolve from a single campaign container.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/events"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go to Events
          </Link>
          <Link
            href="/workpacks"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View Workpacks
          </Link>
        </div>
        <p className="mt-6 text-xs text-gray-400">
          Select an Event, then open its TA Dashboard.
        </p>
      </div>
    </div>
  );
}
