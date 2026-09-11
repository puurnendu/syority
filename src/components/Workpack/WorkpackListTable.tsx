'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkpackListTableBody } from './WorkpackListTableBody';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

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

export function WorkpackListTable({
    workpacks,
    userRole,
    children,
    selected,
    onToggle,
}: {
    workpacks: WorkpackListItem[];
    userRole: string | undefined;
    children: React.ReactNode;
    selected?: Set<string>;
    onToggle?: (id: string) => void;
}) {
    const router = useRouter();
    const [deleteTarget, setDeleteTarget] = useState<WorkpackListItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    async function handleConfirmDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/workpacks/${deleteTarget.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? 'Delete failed');
            }
            setDeleteTarget(null);
            router.refresh();
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to delete workpack. Please try again.');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        {children}
                    </thead>
                    <WorkpackListTableBody
                        workpacks={workpacks}
                        userRole={userRole}
                        onRequestDelete={setDeleteTarget}
                        selected={selected}
                        onToggle={onToggle}
                    />
                </table>
            </div>
            {deleteTarget && (
                <ConfirmDeleteDialog
                    title="Delete Workpack?"
                    message={`This will permanently delete "${deleteTarget.workpack_id_code ?? deleteTarget.workpack_number ?? 'Workpack'} — ${deleteTarget.title}" and all its data including activities, materials, joints, documents and certificates. This cannot be undone.`}
                    confirmLabel="Delete Workpack"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={deleting}
                    dangerous
                />
            )}
        </>
    );
}
