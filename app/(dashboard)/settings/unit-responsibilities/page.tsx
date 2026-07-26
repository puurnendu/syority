import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

/**
 * Responsibility Matrix (v1)
 * Backed by unit_responsibilities — Plant/Unit → Role → User + notification channels.
 * Full Discipline / Primary / Backup / Escalation / Approval Sequence is roadmap.
 */
export default async function ResponsibilityMatrixPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const orgId = (session.user as { organization_id?: string })?.organization_id;
  if (!orgId) redirect('/login');

  const units = await prisma.unit.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: {
      id: true,
      name: true,
      code: true,
      Plant: { select: { name: true, code: true } },
      unit_responsibilities: {
        where: { is_active: true },
        include: {
          User: { select: { id: true, name: true, email: true } },
        },
        orderBy: { role: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Organization</p>
          <h1 className="text-2xl font-bold text-slate-900">Responsibility Matrix</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl">
            Maps Plant → Unit → Role → User for notifications, shift reports, and alerts.
            Configure via unit APIs today; full primary/backup/escalation and approval sequences are next.
          </p>
        </div>
        <Link
          href="/planning/units"
          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          Open Units →
        </Link>
      </div>

      <div className="space-y-6">
        {units.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No units found. Create plants and units first, then assign responsibilities.
          </div>
        ) : (
          units.map((unit) => (
            <section key={unit.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {unit.name} {unit.code ? `(${unit.code})` : ''}
                </h2>
                <p className="text-xs text-slate-500">
                  Plant: {unit.Plant?.name || '—'}
                  {unit.Plant?.code ? ` (${unit.Plant.code})` : ''}
                </p>
              </div>

              {unit.unit_responsibilities.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No responsibilities configured for this unit.
                  Use{' '}
                  <code className="text-xs bg-slate-100 px-1 rounded">
                    POST /api/units/{'{unitId}'}/responsibilities
                  </code>{' '}
                  or assign from unit planning screens.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        <th className="py-2 pr-4 font-semibold">Role</th>
                        <th className="py-2 pr-4 font-semibold">Primary user</th>
                        <th className="py-2 font-semibold">Channels</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unit.unit_responsibilities.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-3 pr-4 font-medium text-slate-800">{r.role}</td>
                          <td className="py-3 pr-4 text-slate-700">
                            {r.User?.name ?? r.User?.email ?? '—'}
                            {r.User?.email && r.User?.name ? (
                              <span className="block text-xs text-slate-400">{r.User.email}</span>
                            ) : null}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {r.receives_shift_reports && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded text-xs">
                                  Shift reports
                                </span>
                              )}
                              {r.receives_constraint_alerts && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded text-xs">
                                  Constraint alerts
                                </span>
                              )}
                              {r.receives_daily_briefing && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 rounded text-xs">
                                  Daily briefing
                                </span>
                              )}
                              {r.receives_overdue_alerts && (
                                <span className="px-1.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-100 rounded text-xs">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
