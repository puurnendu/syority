'use client';

import { ClearancePanel } from '../ClearancePanel';

interface QaClearanceTabProps {
    workpack: any;
}

export function QaClearanceTab({ workpack }: QaClearanceTabProps) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                    Hold Points & QA Sign-offs
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Hold points (H) and witness points (W) are managed on the Activities tab. Clear them below or via the activity row.
                </p>
            </div>

            <div className="border-t-2 border-dashed border-gray-200" />

            <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                    Clearance Records
                </h2>
                <ClearancePanel workpack={workpack} />
            </div>
        </div>
    );
}
