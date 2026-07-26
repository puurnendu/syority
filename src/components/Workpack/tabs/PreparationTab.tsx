'use client';

import { DroppingBoxupPanel } from '../DroppingBoxupPanel';

interface PreparationTabProps {
    workpack: any;
}

export function PreparationTab({ workpack }: PreparationTabProps) {
    const handleOemUpload = (title: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        form.append('document_type', 'oem_manual');
        form.append('title', title);
        fetch(`/api/workpacks/${workpack.id}/documents`, {
            method: 'POST',
            body: form,
        }).catch(console.error);
        e.target.value = '';
    };

    return (
        <div className="space-y-8">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">
                            Dropping / Pre-work Checklist
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Tasks required before work begins.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-600 flex items-center gap-1">
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                className="hidden"
                                onChange={handleOemUpload('OEM Manual — Dropping Procedure')}
                            />
                            Attach OEM Manual
                        </label>
                        <button
                            type="button"
                            title="Coming in Phase 3"
                            className="text-xs px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100"
                        >
                            AI Generate
                        </button>
                    </div>
                </div>
                <DroppingBoxupPanel workpack={workpack} />
            </div>

            <div className="border-t-2 border-dashed border-gray-200" />

            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">
                            Box-up / Reinstatement Checklist
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Tasks required to reinstate equipment after maintenance.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-600 flex items-center gap-1">
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                className="hidden"
                                onChange={handleOemUpload('OEM Manual — Box-up Procedure')}
                            />
                            Attach OEM Manual
                        </label>
                        <button
                            type="button"
                            title="Coming in Phase 3"
                            className="text-xs px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100"
                        >
                            AI Generate
                        </button>
                    </div>
                </div>
                <p className="text-sm text-gray-500">
                    Box-up checklist uses the same checklist engine when templates are available.
                </p>
            </div>
        </div>
    );
}
