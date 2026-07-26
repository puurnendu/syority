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
                    <Link
                        href={newWorkpackHref}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        + New Workpack
                    </Link>
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
