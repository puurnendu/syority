'use client';

import { useState, useRef } from 'react';
import type { ExtractedJoint } from '@/lib/ai/jointExtraction';

const EQUIPMENT_TYPES = [
    { value: 'heat_exchanger', label: 'Heat Exchanger' },
    { value: 'pressure_vessel', label: 'Pressure Vessel' },
    { value: 'pump', label: 'Pump' },
];

type DocOption = { id: string; title: string; original_filename?: string };

interface GenerateTechnicalDataModalProps {
    open: boolean;
    onClose: () => void;
    workpackId: string;
    mode: 'joint' | 'blind';
    equipmentType?: string | null;
    attachedDocuments?: DocOption[];
    onGenerated: (data: any[]) => void;
}

export function GenerateJointsModal({
    open,
    onClose,
    workpackId,
    mode,
    equipmentType = '',
    attachedDocuments = [],
    onGenerated,
}: GenerateTechnicalDataModalProps) {
    const [source, setSource] = useState<'upload' | 'attached'>('upload');
    const [selectedDocId, setSelectedDocId] = useState('');
    const [equipmentTag, setEquipmentTag] = useState('');
    const [equipmentTypeLocal, setEquipmentTypeLocal] = useState(
        (equipmentType || 'heat_exchanger').toString().replace(/\s+/g, '_').toLowerCase() || 'heat_exchanger'
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isBlindMode = mode === 'blind';
    const titleText = isBlindMode ? 'Generate Blind Register' : 'Generate Joint Register';
    const buttonText = isBlindMode ? 'Generate Blinds →' : 'Generate Joints →';
    const endpoint = isBlindMode 
        ? `/api/workpacks/${workpackId}/blinds/generate-from-drawing`
        : `/api/workpacks/${workpackId}/joints/generate-from-drawing`;

    const effectiveType = EQUIPMENT_TYPES.find((t) => t.value === equipmentTypeLocal)?.value ?? 'heat_exchanger';

    const handleGenerate = async () => {
        setError('');
        setLoading(true);
        try {
            let body: Record<string, unknown> = {
                equipmentTag: equipmentTag.trim() || undefined,
                equipmentType: effectiveType,
                autoSave: true,
                replaceExisting: true,
            };
            if (source === 'attached' && selectedDocId) {
                body.documentId = selectedDocId;
            }
            if (source === 'upload' && fileInputRef.current?.files?.[0]) {
                const file = fileInputRef.current.files[0];
                const isImage = file.type.startsWith('image/');
                const isPdf = file.type === 'application/pdf';
                if (!isImage && !isPdf) {
                    setError('Please upload a PNG, JPEG, or PDF file.');
                    setLoading(false);
                    return;
                }
                const base64 = await fileToBase64(file);
                body.fileBase64 = base64;
                body.fileType = isPdf ? 'pdf' : 'image';
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Request failed (${res.status})`);
            }
            const data = await res.json();
            const results = isBlindMode 
                ? (Array.isArray(data.blinds) ? data.blinds : [])
                : (Array.isArray(data.joints) ? data.joints : []);
            onGenerated(results);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Generation failed');
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto font-sans">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">{titleText} from Drawing</h3>
                    <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Source document:</p>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="source" checked={source === 'upload'} onChange={() => setSource('upload')} className="rounded" />
                                <span className="text-sm text-gray-700">Upload P&ID / Isometric drawing now</span>
                            </label>
                            {source === 'upload' && (
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                                    className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700"
                                />
                            )}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="source" checked={source === 'attached'} onChange={() => setSource('attached')} className="rounded" />
                                <span className="text-sm text-gray-700">Use document already attached to this workpack</span>
                            </label>
                            {source === 'attached' && (
                                <select
                                    value={selectedDocId}
                                    onChange={(e) => setSelectedDocId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                >
                                    <option value="">Select from attached documents</option>
                                    {attachedDocuments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.title || d.original_filename || d.id}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Equipment tag (optional)</label>
                        <input
                            type="text"
                            value={equipmentTag}
                            onChange={(e) => setEquipmentTag(e.target.value)}
                            placeholder="e.g. E-435 Heat Exchanger"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Equipment type</label>
                        <select
                            value={equipmentTypeLocal}
                            onChange={(e) => setEquipmentTypeLocal(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                            {EQUIPMENT_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
                        <span className="mt-0.5 text-base leading-none">⚠</span>
                        <span>
                            AI will extract {isBlindMode ? 'isolation point tags, blind types, and sizes' : 'nozzle sizes, pressure ratings, and locations'}. Review the register after generation.
                        </span>
                    </p>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
                    )}
                </div>
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {loading
                            ? (fileInputRef.current?.files?.[0]?.type === 'application/pdf'
                                ? 'Uploading PDF... converting pages'
                                : 'Analysing drawing…')
                            : buttonText
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.includes(',') ? result.split(',')[1]! : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
