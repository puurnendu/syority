import Link from 'next/link';

/**
 * STO → Safety & Permits → Permits / PTW
 *
 * OD9.2 §22/§28: this page previously read "Select a project to view permits" and linked to
 * `/projects`, so the STO Permits menu entry sent the user into the Project domain. That
 * inverts the frozen boundary (Permit Management is STO-only) and, once
 * `/projects/[id]/permits` was redirected here, formed a navigation loop.
 *
 * Permits are genuinely STO-scoped: `PermitService` resolves them by `workpack_id` /
 * `activity_id` within an organisation, and permit-to-work counts are recorded on the
 * Event-scoped daily safety log. There is no dedicated permit register UI yet, so per §10
 * this remains an honest signpost rather than an invented feature.
 */
export default function PermitsPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Permits / PTW</h1>
      <p className="text-sm text-gray-500 mb-6">
        Permit to Work is managed within the STO domain, against the workpacks and activities
        of a turnaround Event.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <p className="text-sm text-gray-600">
          A consolidated permit register is not yet available. Permits are currently reached
          through the work they authorise:
        </p>
        <ul className="space-y-3 text-sm">
          <li>
            <Link href="/workpacks" className="font-medium text-indigo-600 hover:underline">
              Workpacks
            </Link>
            <span className="text-gray-500">
              {' '}— permits are validated against a workpack and its activities before
              execution is released.
            </span>
          </li>
          <li>
            <Link href="/safety" className="font-medium text-indigo-600 hover:underline">
              Safety
            </Link>
            <span className="text-gray-500">
              {' '}— daily permit-to-work counts (issued, closed, suspended) are recorded on
              the Event safety log.
            </span>
          </li>
          <li>
            <Link href="/events" className="font-medium text-indigo-600 hover:underline">
              Events / TAs
            </Link>
            <span className="text-gray-500">
              {' '}— select the turnaround Event whose permits you need.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
