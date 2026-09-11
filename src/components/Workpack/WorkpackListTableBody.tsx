'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUS_COLOR: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending_ai_review: 'bg-purple-100 text-purple-700',
    under_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    issued: 'bg-blue-100 text-blue-800',
    closed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-700',
};

const ROLES_CAN_DELETE = ['super_admin', 'org_admin', 'tenant_admin'];

interface WorkpackListItem {
    id: string;
    workpack_number: string | null;
    workpack_id_code?: string | null;
    title: string;
    status: string;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    overall_progress?: number | null;
    open_constraints?: number;
    site?: { id: string; name: string } | null;
    discipline?: { id: string; name: string; code: string; color: string | null } | null;
    _count?: { activities: number };
}

export function WorkpackListTableBody({
    workpacks,
    userRole,
    onRequestDelete,
    selected,
    onToggle,
}: {
    workpacks: WorkpackListItem[];
    userRole: string | undefined;
    onRequestDelete: (wp: WorkpackListItem) => void;
    selected?: Set<string>;
    onToggle?: (id: string) => void;
}) {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const canDelete = userRole ? ROLES_CAN_DELETE.includes(userRole) : false;

    return (
        <tbody className="divide-y divide-gray-100">
                {workpacks.map((wp) => {
                    const showMenu = menuOpenId === wp.id;
                    return (
                        <tr key={wp.id} className="hover:bg-gray-50 transition-colors">
                            {onToggle && (
                                <td className="px-4 py-4">
                                    <input
                                        type="checkbox"
                                        checked={selected?.has(wp.id) ?? false}
                                        onChange={() => onToggle(wp.id)}
                                        aria-label={`Select ${wp.title}`}
                                    />
                                </td>
                            )}
                            <td className="px-6 py-4">
                                {wp.workpack_id_code ? (
                                    <Link
                                        href={`/workpacks/${wp.id}`}
                                        className="font-mono text-xs text-[#0D2137] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-semibold hover:bg-blue-100"
                                    >
                                        {wp.workpack_id_code}
                                    </Link>
                                ) : (
                                    <Link
                                        href={`/workpacks/${wp.id}`}
                                        className="font-mono text-xs text-blue-600 hover:text-blue-800 font-semibold"
                                    >
                                        {wp.workpack_number ?? 'DRAFT'}
                                    </Link>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-gray-900 font-medium max-w-xs truncate block">{wp.title}</span>
                                <div className="mt-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-400">Progress</span>
                                        <span className="text-xs font-medium text-gray-700">
                                            {Math.round((wp.overall_progress ?? 0) as number)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                        <div
                                            className={`h-1.5 rounded-full transition-all ${
                                                ((wp.overall_progress ?? 0) as number) >= 100
                                                    ? 'bg-green-500'
                                                    : ((wp.overall_progress ?? 0) as number) > 50
                                                      ? 'bg-blue-500'
                                                      : 'bg-blue-400'
                                            }`}
                                            style={{
                                                width: `${Math.min(100, (wp.overall_progress ?? 0) as number)}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                {(wp.planned_start_date || wp.planned_end_date) && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        📅{' '}
                                        {wp.planned_start_date
                                            ? new Date(wp.planned_start_date).toLocaleDateString('en-GB')
                                            : '—'}
                                        {' → '}
                                        {wp.planned_end_date
                                            ? new Date(wp.planned_end_date).toLocaleDateString('en-GB')
                                            : '—'}
                                    </p>
                                )}
                            </td>
                            <td className="px-6 py-4 text-gray-500">{wp.site?.name ?? '—'}</td>
                            <td className="px-6 py-4">
                                {wp.discipline ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: wp.discipline.color ?? '#ccc' }}
                                        />
                                        <span className="text-gray-700">{wp.discipline.code}</span>
                                    </span>
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <span
                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[wp.status] ?? 'bg-gray-100 text-gray-700'}`}
                                >
                                    {wp.status.replace(/_/g, ' ')}
                                </span>
                                {(wp.open_constraints ?? 0) > 0 && (
                                    <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full ml-2">
                                        ⚠ {wp.open_constraints} constraint{wp.open_constraints !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right text-gray-500">
                                {wp._count?.activities ?? 0}
                            </td>
                            <td className="px-4 py-4 text-right w-12">
                                <div className="relative inline-block">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setMenuOpenId(showMenu ? null : wp.id);
                                        }}
                                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                                        aria-label="Actions"
                                    >
                                        ⋮
                                    </button>
                                    {showMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setMenuOpenId(null)}
                                            />
                                            <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                                                <Link
                                                    href={`/workpacks/${wp.id}`}
                                                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                                                    onClick={() => setMenuOpenId(null)}
                                                >
                                                    Open
                                                </Link>
                                                <a
                                                    href={`/workpacks/new?duplicate=${wp.id}`}
                                                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700"
                                                    onClick={() => setMenuOpenId(null)}
                                                >
                                                    Duplicate
                                                </a>
                                                {canDelete && (
                                                    <>
                                                        <div className="my-1 border-t border-gray-100" />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMenuOpenId(null);
                                                                onRequestDelete(wp);
                                                            }}
                                                            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })}
        </tbody>
    );
}
