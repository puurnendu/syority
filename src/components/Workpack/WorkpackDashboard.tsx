import React from 'react';
import Link from 'next/link';
import { WorkpackSummaryBar } from './WorkpackSummaryBar';
import { WorkpackListTable } from './WorkpackListTable';

/** Site subset returned by getWorkpacks include */
interface WorkpackListItemSiteDTO {
    id: string;
    name: string;
}

/** Discipline subset returned by getWorkpacks include */
interface WorkpackListItemDisciplineDTO {
    id: string;
    name: string;
    code: string;
    color: string | null;
}

/** Counts returned by getWorkpacks _count */
interface WorkpackListItemCountDTO {
    activities: number;
}

/** Workpack list item shape (after JSON serialization from getWorkpacks) */
export interface WorkpackListItemDTO {
    id: string;
    workpack_number: string | null;
    workpack_id_code?: string | null;
    title: string;
    status: string;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    overall_progress?: number | null;
    open_constraints?: number;
    site: WorkpackListItemSiteDTO | null;
    discipline: WorkpackListItemDisciplineDTO | null;
    _count: WorkpackListItemCountDTO;
}

interface WorkpackDashboardProps {
    workpacks: WorkpackListItemDTO[];
    title?: string;
    projectId?: string;
    userRole?: string;
}

export function WorkpackDashboard({ 
    workpacks, 
    title = "Workpacks", 
    projectId, 
    userRole 
}: WorkpackDashboardProps) {
    const newWorkpackHref = projectId 
        ? `/workpacks/new?project_id=${projectId}` 
        : "/workpacks/new";

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {workpacks.length} workpack{workpacks.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex gap-3">
                    <a
                        href="/api/exports?type=workpacks"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        📥 Export CSV
                    </a>
                    <div className="relative group">
                        <button
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors peer"
                        >
                            + New Workpack
                            <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <Link
                                href={newWorkpackHref}
                                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                            >
                                📝 Blank Workpack
                            </Link>
                            <Link
                                href="/planning/templates?mode=select"
                                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg border-t border-gray-100"
                            >
                                📋 Create from Template
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <WorkpackSummaryBar workpacks={workpacks} />

            {workpacks.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-sm font-medium">No workpacks yet</p>
                    <p className="text-xs mt-1">Click "New Workpack" to create the first one.</p>
                </div>
            ) : (
                <WorkpackListTable
                    workpacks={workpacks}
                    userRole={userRole}
                >
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discipline</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12" />
                    </tr>
                </WorkpackListTable>
            )}
        </div>
    );
}
