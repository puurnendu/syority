import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getEnabledFeatures } from '@/lib/features';
import Link from 'next/link';

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function statusBadge(status: string | null | undefined) {
  const s = (status || 'unknown').toLowerCase();
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    past_due: 'bg-amber-50 text-amber-800 border-amber-200',
    suspended: 'bg-red-50 text-red-800 border-red-200',
    trial: 'bg-blue-50 text-blue-800 border-blue-200',
  };
  const cls = styles[s] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status || 'Unknown'}
    </span>
  );
}

export default async function SubscriptionLicensePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const orgId = (session.user as { organization_id?: string }).organization_id;
  if (!orgId) redirect('/login');

  const [org, userCount, siteCount, workpackCount, activityCount, projectCount, eventCount, featureKeys] =
    await Promise.all([
      prisma.organization.findFirst({
        where: { id: orgId, deleted_at: null },
      }),
      prisma.user.count({ where: { organization_id: orgId, deleted_at: null, is_active: true } }),
      prisma.site.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.workpack.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.activity.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.project.count({ where: { org_id: orgId } }).catch(() => 0),
      prisma.event.count({ where: { organization_id: orgId } }).catch(() => 0),
      getEnabledFeatures(orgId),
    ]);

  if (!org) redirect('/login');

  const maxUsers = org.max_users ?? 0;
  const maxSites = org.max_sites ?? 0;
  const userPct = maxUsers > 0 ? Math.min(100, Math.round((userCount / maxUsers) * 100)) : 0;
  const sitePct = maxSites > 0 ? Math.min(100, Math.round((siteCount / maxSites) * 100)) : 0;
  const settings = (org.settings as Record<string, unknown> | null) ?? {};
  const accountManager =
    (typeof settings.account_manager === 'string' && settings.account_manager) ||
    (typeof settings.accountManager === 'string' && settings.accountManager) ||
    'Contact SYORITY Support';
  const supportLevel =
    (typeof settings.support_level === 'string' && settings.support_level) ||
    (typeof settings.supportLevel === 'string' && settings.supportLevel) ||
    (org.plan_tier === 'enterprise' ? 'Premium' : 'Standard');

  const usageCards = [
    { label: 'Licensed Users', value: `${userCount} / ${maxUsers || '∞'}`, hint: `${userPct}% of license` },
    { label: 'Sites', value: `${siteCount} / ${maxSites || '∞'}`, hint: `${sitePct}% of license` },
    { label: 'Projects / Events', value: `${projectCount + eventCount}`, hint: `${eventCount} events · ${projectCount} projects` },
    { label: 'Workpacks', value: String(workpackCount), hint: 'Active + archived in tenant' },
    { label: 'Activities', value: String(activityCount), hint: 'Across all workpacks' },
    { label: 'Plan Tier', value: (org.plan_tier || 'professional').toUpperCase(), hint: org.billing_cycle || 'annual' },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Organization</p>
        <h1 className="text-2xl font-bold text-slate-900">License & Subscription</h1>
        <p className="text-sm text-slate-600 mt-2 max-w-2xl">
          View your current Aurianoa OS license entitlement. Plans are assigned by SYORITY — tenants cannot purchase or change billing here.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{org.name}</h2>
            <p className="text-sm text-slate-500 mt-1">Tenant slug: {org.slug || '—'}</p>
          </div>
          <div className="text-right space-y-2">
            {statusBadge(org.payment_status)}
            <p className="text-xs text-slate-500">
              Renewal / contract end: <span className="font-medium text-slate-800">{formatDate(org.contract_end_date)}</span>
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Contract start</dt>
            <dd className="font-semibold text-slate-900 mt-1">{formatDate(org.contract_start_date)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Support level</dt>
            <dd className="font-semibold text-slate-900 mt-1">{supportLevel}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Account manager</dt>
            <dd className="font-semibold text-slate-900 mt-1">{accountManager}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-slate-500">Currency</dt>
            <dd className="font-semibold text-slate-900 mt-1">{org.currency || 'USD'}</dd>
          </div>
        </dl>
      </div>

      <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">Usage</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {usageCards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.hint}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">Enabled modules</h3>
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-8 shadow-sm">
        {featureKeys.length === 0 ? (
          <p className="text-sm text-slate-500">
            No modules currently flagged as enabled for this tenant. Contact SYORITY if this looks incorrect.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {featureKeys.map((key) => (
              <li
                key={key}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-xs font-semibold border border-indigo-100"
              >
                {key}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={`mailto:support@syority.com?subject=${encodeURIComponent(`Upgrade request — ${org.name}`)}`}
          className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
        >
          Request upgrade
        </a>
        <Link
          href="/settings/organization"
          className="inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
          Organization profile
        </Link>
        <Link
          href="/settings/users"
          className="inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
          Manage users
        </Link>
      </div>
    </div>
  );
}
