'use client';

import { useState } from 'react';

export type ChecklistItemInput = {
    description: string;
    responsible_party?: string;
    is_mandatory?: boolean;
    sequence_number?: number;
};

export function ChecklistPasteModal({
    onImport,
    onClose,
}: {
    onImport: (items: ChecklistItemInput[]) => void;
    onClose: () => void;
}) {
    const [pasteText, setPasteText] = useState('');
    const [parsed, setParsed] = useState<ChecklistItemInput[]>([]);
    const [error, setError] = useState('');

    function handlePaste(text: string) {
        setPasteText(text);
        setError('');

        const lines = text
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        if (lines.length === 0) {
            setError('No content detected. Copy rows from Excel or lines from Word.');
            setParsed([]);
            return;
        }

        const items: ChecklistItemInput[] = lines.map((line, i) => {
            const cols = line.split('\t');
            if (cols.length >= 2) {
                return {
                    description: cols[0].trim(),
                    responsible_party: cols[1].trim() || '',
                    is_mandatory: cols[2]?.trim().toUpperCase() !== 'N',
                    sequence_number: i + 1,
                };
            }
            const desc = line.replace(/^[\d]+[.)]\s*/, '').replace(/^[-•*]\s*/, '');
            return {
                description: desc,
                responsible_party: '',
                is_mandatory: true,
                sequence_number: i + 1,
            };
        });

        setParsed(items);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Paste Checklist from Excel or Word</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Copy rows from Excel (Col A: Description, Col B: Responsible Party, Col C: Y/N Mandatory) then click the box below and press Ctrl+V. Or paste lines from Word/Notepad.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="px-6 py-4">
                    <div
                        className="border-2 border-dashed border-blue-300 rounded-lg p-4 min-h-32 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:border-blue-500"
                        contentEditable
                        suppressContentEditableWarning
                        onPaste={(e) => {
                            e.preventDefault();
                            handlePaste(e.clipboardData.getData('text/plain'));
                        }}
                        onInput={(e) => handlePaste((e.target as HTMLDivElement).innerText)}
                    >
                        {pasteText ? (
                            <span className="text-gray-700 text-sm whitespace-pre-wrap">{pasteText}</span>
                        ) : (
                            <span className="text-gray-400">
                                Click here, then press <kbd className="bg-gray-100 px-1 rounded">Ctrl+V</kbd> to paste from Excel or Word
                            </span>
                        )}
                    </div>

                    {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                </div>

                {parsed.length > 0 && (
                    <div className="px-6 pb-4 flex-1 overflow-hidden flex flex-col">
                        <p className="text-sm font-medium text-gray-700 mb-2">Preview — {parsed.length} items detected:</p>
                        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-500">#</th>
                                        <th className="px-3 py-2 text-left text-gray-500">Description</th>
                                        <th className="px-3 py-2 text-left text-gray-500">Responsible Party</th>
                                        <th className="px-3 py-2 text-left text-gray-500">Mandatory</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsed.map((item, i) => (
                                        <tr key={i} className="border-t border-gray-100">
                                            <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                                            <td className="px-3 py-1.5 text-gray-800">{item.description}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{item.responsible_party || '—'}</td>
                                            <td className="px-3 py-1.5">
                                                {item.is_mandatory !== false ? (
                                                    <span className="text-red-600">Yes</span>
                                                ) : (
                                                    <span className="text-gray-400">No</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="px-6 py-4 border-t flex justify-between items-center">
                    <button
                        type="button"
                        onClick={() => {
                            setPasteText('');
                            setParsed([]);
                            setError('');
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Clear
                    </button>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onImport(parsed);
                                onClose();
                            }}
                            disabled={parsed.length === 0}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
                        >
                            Import {parsed.length > 0 ? `${parsed.length} Items` : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
