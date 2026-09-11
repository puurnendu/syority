import Link from 'next/link';

/**
 * STO → Execution → Punch List
 *
 * Phase 0 (E2E lineage audit P0-8, roadmap item 5): this page previously sent the
 * user to `/projects` — the retired legacy Project chain. Punch is STO execution
 * residue: the live register is `PunchListItem`, scoped to an Event's workpacks
 * and activities. The legacy `punch_items` Project register is quarantined behind
 * the LEGACY_PROJECT_CHAIN feature flag.
 *
 * There is no consolidated punch register UI yet, so this is an honest signpost
 * rather than an invented feature.
 */
export default function PunchListPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Punch List</h1>
      <p className="text-sm text-gray-500 mb-6">
        Punch items are managed within the STO domain, against the workpacks and
        activities of a turnaround Event.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <p className="text-sm text-gray-600">
          A consolidated punch register is not yet available. Punch items are
          currently reached through the work they block:
        </p>
        <ul className="space-y-3 text-sm">
          <li>
            <Link href="/workpacks" className="font-medium text-indigo-600 hover:underline">
              Workpacks
            </Link>
            <span className="text-gray-500">
              {' '}— punch items are raised against a workpack and its activities, and
              category-A items block job completion.
            </span>
          </li>
          <li>
            <Link href="/events" className="font-medium text-indigo-600 hover:underline">
              Events / TAs
            </Link>
            <span className="text-gray-500">
              {' '}— select the turnaround Event whose punch items you need.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
