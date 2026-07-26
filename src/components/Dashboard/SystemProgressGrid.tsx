'use client';

import Link from 'next/link';
import { SystemProgressCard, type SystemProgressItem } from './SystemProgressCard';

export function SystemProgressGrid({ items }: { items: SystemProgressItem[] }) {
  const sorted = [...items].sort((a, b) => {
    const statusOrder = (s: string) => (s === 'Not Started' ? 0 : s === 'In Planning' ? 1 : 2);
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    return a.planningProgress - b.planningProgress;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">System Planning Progress</h3>
        <Link
          href="/planning/systems"
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          View all systems →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((item) => (
          <SystemProgressCard key={item.systemId} item={item} />
        ))}
      </div>
    </div>
  );
}
