import { requirePlatformContext } from '@/lib/server-context';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

/**
 * M7.6H — Platform Audit Logs
 *
 * Replaces Coming Soon with a real audit log viewer.
 * Queries SystemAuditLog for platform-level operations.
 */

export default async function PlatformLogsPage() {
  await requirePlatformContext();

  const logs = await prisma.systemAuditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      User: {
        select: { name: true, email: true },
      },
    },
  });

  const actionColors: Record<string, string> = {
    'tenant.create': 'bg-green-100 text-green-700',
    'tenant.update': 'bg-blue-100 text-blue-700',
    'tenant.delete': 'bg-red-100 text-red-700',
    'user.create': 'bg-green-100 text-green-700',
    'user.update': 'bg-blue-100 text-blue-700',
    'backup.create': 'bg-violet-100 text-violet-700',
    'backup.restore': 'bg-amber-100 text-amber-700',
    'config.update': 'bg-cyan-100 text-cyan-700',
    'seed.execute': 'bg-emerald-100 text-emerald-700',
    'reset.execute': 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          System-level audit trail — last 100 entries
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📜</div>
          <h3 className="text-lg font-semibold text-gray-700">No Audit Logs</h3>
          <p className="text-sm text-gray-500 mt-1">Platform operations will be logged here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const colorClass = actionColors[log.action] ?? 'bg-gray-100 text-gray-700';
                const meta = log.metadata as Record<string, any> | null;
                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{log.User?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{log.User?.email ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {meta ? JSON.stringify(meta).substring(0, 120) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
