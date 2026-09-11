'use client';

/**
 * M7.7.1 — Provisioning Jobs Dashboard
 *
 * Live view of all provisioning jobs with status, progress, and actions.
 */

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  queued:       { label: 'Queued',       color: '#6b7280', bg: '#f3f4f6', icon: '⏳' },
  starting:     { label: 'Starting',     color: '#3b82f6', bg: '#dbeafe', icon: '🔄' },
  running:      { label: 'Running',      color: '#3b82f6', bg: '#dbeafe', icon: '⚙️' },
  completed:    { label: 'Completed',    color: '#10b981', bg: '#dcfce7', icon: '✅' },
  failed:       { label: 'Failed',       color: '#ef4444', bg: '#fef2f2', icon: '❌' },
  cancelled:    { label: 'Cancelled',    color: '#9ca3af', bg: '#f9fafb', icon: '⏹️' },
  rolling_back: { label: 'Rolling Back', color: '#f59e0b', bg: '#fef3c7', icon: '🔙' },
  rolled_back:  { label: 'Rolled Back',  color: '#6b7280', bg: '#f3f4f6', icon: '↩️' },
};

export default function ProvisioningJobsPage() {
  const [filter, setFilter] = useState<string>('');
  const { data: jobs, error, mutate } = useSWR(
    `/api/admin/tenants/provision?jobs=1${filter ? `&status=${filter}` : ''}`,
    fetcher,
    { refreshInterval: 5000 },
  );

  const handleAction = async (jobId: string, action: string) => {
    try {
      await fetch(`/api/admin/tenants/provision/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      mutate();
    } catch {}
  };

  if (error) return <div className="p-8 text-red-500 font-medium">Failed to load provisioning jobs.</div>;
  if (!jobs) return <div className="p-8 text-gray-500 animate-pulse font-medium">Loading jobs...</div>;

  const jobList = Array.isArray(jobs) ? jobs : [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provisioning Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{jobList.length} jobs · Auto-refreshes every 5s</p>
        </div>
        <Link
          href="/platform/tenants/new"
          className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]"
        >
          + New Tenant
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'queued', 'running', 'completed', 'failed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
              filter === s
                ? 'bg-[#0D2137] text-white border-[#0D2137]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {s === '' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      {jobList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">⚙️</div>
          <h3 className="text-lg font-semibold text-gray-700">No Provisioning Jobs</h3>
          <p className="text-sm text-gray-500 mt-1">Jobs will appear here when tenants are provisioned.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobList.map((job: any) => {
            const statusConf = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.queued;
            const request = job.request as any;
            const companyName = request?.company?.name ?? '—';
            const completedSteps = Array.isArray(job.completed_steps) ? job.completed_steps : [];
            const elapsed = job.started_at && job.completed_at
              ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
              : null;

            return (
              <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{statusConf.icon}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{companyName}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(job.created_at).toLocaleString()}
                        {elapsed ? ` · ${elapsed}s` : ''}
                        {job.organization?.slug ? ` · ${job.organization.slug}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Progress */}
                    {['running', 'starting'].includes(job.status) && (
                      <div className="w-24">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${job.progress_pct}%` }} />
                        </div>
                        <div className="text-xs text-gray-500 text-center mt-0.5">{job.progress_pct}%</div>
                      </div>
                    )}

                    {/* Status Badge */}
                    <span
                      className="px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap"
                      style={{ backgroundColor: statusConf.bg, color: statusConf.color }}
                    >
                      {statusConf.label}
                    </span>

                    {/* Actions */}
                    {job.status === 'failed' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAction(job.id, 'retry')}
                          className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => handleAction(job.id, 'rollback')}
                          className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                        >
                          Rollback
                        </button>
                      </div>
                    )}
                    {['running', 'starting', 'queued'].includes(job.status) && (
                      <button
                        onClick={() => handleAction(job.id, 'cancel')}
                        className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {job.error && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {job.failed_step && <span className="font-medium">Step: {job.failed_step} — </span>}
                    {job.error}
                  </div>
                )}

                {/* Steps progress */}
                {completedSteps.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {completedSteps.map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 text-[10px] bg-green-50 text-green-600 rounded">
                        ✓ {s}
                      </span>
                    ))}
                    {job.current_step && !completedSteps.includes(job.current_step) && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded animate-pulse">
                        ⏳ {job.current_step}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
