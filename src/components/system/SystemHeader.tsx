'use client';

import Link from 'next/link';

export function SystemHeader({
  system,
  showBreadcrumb = true,
}: {
  system: { id: string; code: string | null; name: string; unit?: { name: string }; site?: { name: string }; criticality?: string | null; status: string; p_and_id_ref?: string | null };
  showBreadcrumb?: boolean;
}) {
  return (
    <div className="mb-4">
      {showBreadcrumb && (
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/planning/systems" className="hover:text-gray-700">
            Planning
          </Link>
          {' > '}
          <Link href="/planning/systems" className="hover:text-gray-700">
            Systems
          </Link>
          {' > '}
          <span className="text-gray-900">{system.name}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">{system.name}</h1>
        {system.code && (
          <span className="font-mono text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{system.code}</span>
        )}
        {system.criticality && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              system.criticality === 'High' ? 'bg-red-100 text-red-700' : system.criticality === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {system.criticality}
          </span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{system.status}</span>
        {system.p_and_id_ref && (
          <span className="text-xs text-gray-500">P&ID: {system.p_and_id_ref}</span>
        )}
      </div>
      {(system.unit?.name || system.site?.name) && (
        <p className="text-sm text-gray-500 mt-1">
          {system.unit?.name ?? '—'} · {system.site?.name ?? '—'}
        </p>
      )}
    </div>
  );
}
