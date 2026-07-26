'use client';

export interface ConfirmDeleteDialogProps {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
    dangerous?: boolean;
}

export function ConfirmDeleteDialog({
    title,
    message,
    confirmLabel = 'Delete',
    onConfirm,
    onCancel,
    loading = false,
    dangerous = true,
}: ConfirmDeleteDialogProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-red-600 text-lg">⚠</span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                </div>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`px-4 py-2 text-sm rounded-lg font-medium text-white min-w-[100px] disabled:opacity-50 ${
                            dangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {loading ? 'Deleting...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
