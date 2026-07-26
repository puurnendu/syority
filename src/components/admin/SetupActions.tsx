'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SetupActionsProps {
    isReady: boolean;
}

export function SetupActions({ isReady }: SetupActionsProps) {
    const router = useRouter();

    const handleRefresh = () => {
        router.refresh();
    };

    return (
        <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3">
                Once all items above are checked, refresh this page to continue to workpacks.
            </p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Refresh Status
                </button>
                {isReady ? (
                    <Link
                        href="/workpacks"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Continue to Workpacks
                    </Link>
                ) : (
                    <span
                        className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                        aria-disabled
                    >
                        Continue to Workpacks
                    </span>
                )}
            </div>
        </div>
    );
}
