'use client';

import { useState, useEffect } from 'react';

type PageRangeInput = {
    id: string;
    label: string;
    from: string;
    to: string;
};

type Parameter = {
    key: string;
    label: string;
    value: string | number | null;
    unit: string | null;
    source_text: string | null;
    page_number: number | null;
    confidence: 'high' | 'medium' | 'low';
    calculated: boolean;
    calculation_basis: string | null;
    ambiguous: boolean;
    candidates: Array<{
        value: string | number;
        context: string;
        page_number: number | null;
    }>;
    field_path: string;
    field_section: string;
};

type ExtractionResult = {
    job_id: string;
    parameters: Parameter[];
    document_summary: string;
    equipment_identified: string[];
    warnings_found: string[];
};

const CONFIDENCE_STYLE = {
    high: 'bg-green-50 border-green-300 text-green-800',
    medium: 'bg-amber-50 border-amber-300 text-amber-800',
    low: 'bg-red-50 border-red-300 text-red-700',
};

const CONFIDENCE_ICON = {
    high: '✓',
    medium: '⚠',
    low: '!',
};

const PARAM_LABELS: Record<string, string> = {
    hydrotest: '🔵 Hydrotest / Pressure Test',
    torque: '🔧 Torque Specification',
    cleaning: '🧹 Cleaning Procedure',
    preparation: '📋 Preparation / Pre-work',
};

export function DocumentExtractionPanel({
    workpackId,
    document,
    canEdit,
    onExtractionComplete,
}: {
    workpackId: string;
    document: {
        id: string;
        title: string | null;
        original_filename: string;
    };
    canEdit: boolean;
    onExtractionComplete: () => void;
}) {
    const [pageCount, setPageCount] = useState<number | null>(null);
    const [pageRanges, setPageRanges] = useState<PageRangeInput[]>([
        { id: '1', label: '', from: '', to: '' },
    ]);
    const [parameters, setParameters] = useState<string[]>(['hydrotest', 'torque']);
    const [customInstruction, setCustomInstruction] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<ExtractionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [accepted, setAccepted] = useState<Set<string>>(new Set());
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [importing, setImporting] = useState(false);
    const [importDone, setImportDone] = useState(false);

    useEffect(() => {
        fetch(
            `/api/workpacks/${workpackId}/documents/${document.id}/page-count`
        )
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d?.page_count) setPageCount(d.page_count);
            })
            .catch(() => {});
    }, [workpackId, document.id]);

    useEffect(() => {
        if (!result) return;
        const highConf = new Set(
            result.parameters
                .filter((p) => p.confidence === 'high')
                .map((p) => p.key)
        );
        setAccepted(highConf);
    }, [result]);

    async function runExtraction() {
        const validRanges = pageRanges.filter(
            (r) =>
                r.label.trim() &&
                r.from &&
                r.to &&
                parseInt(r.from, 10) <= parseInt(r.to, 10)
        );
        if (validRanges.length === 0) {
            setError(
                'Add at least one page range with a label and valid from/to pages'
            );
            return;
        }
        if (parameters.length === 0) {
            setError('Select at least one parameter type');
            return;
        }

        setRunning(true);
        setError(null);
        setResult(null);
        setImportDone(false);

        const res = await fetch(
            `/api/workpacks/${workpackId}/extract-document`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_document_id: document.id,
                    page_ranges: validRanges.map((r) => ({
                        label: r.label.trim(),
                        from: parseInt(r.from, 10),
                        to: parseInt(r.to, 10),
                    })),
                    parameters,
                    custom_instruction:
                        customInstruction.trim() || undefined,
                }),
            }
        );

        const d = await res.json();
        if (!res.ok) {
            setError(d.error ?? 'Extraction failed');
            setRunning(false);
            return;
        }

        setResult(d);
        setRunning(false);
    }

    async function importAccepted() {
        if (!result || accepted.size === 0) return;
        setImporting(true);
        setError(null);

        const res = await fetch(
            `/api/workpacks/${workpackId}/extract-document/${result.job_id}/accept`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accepted_keys: [...accepted],
                    overrides,
                }),
            }
        );

        const d = await res.json();
        if (!res.ok) {
            setError(d.error ?? 'Import failed');
            setImporting(false);
            return;
        }

        setImportDone(true);
        setImporting(false);
        onExtractionComplete();
    }

    if (importDone)
        return (
            <div className="text-center py-10 bg-green-50 border-2 border-green-200 rounded-2xl">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-semibold text-green-800">
                    {accepted.size} parameter
                    {accepted.size !== 1 ? 's' : ''} imported successfully
                </p>
                <p className="text-xs text-green-600 mt-1">
                    Certificates, cleaning instructions and preparation
                    checklists have been updated.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setResult(null);
                        setImportDone(false);
                        setAccepted(new Set());
                    }}
                    className="mt-4 text-xs text-green-700 underline"
                >
                    Run another extraction
                </button>
            </div>
        );

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-5">
            <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                    <h3 className="text-sm font-bold text-gray-900">
                        AI Parameter Extraction
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                        Extract test pressures, torque values, cleaning
                        requirements from{' '}
                        <strong>
                            {document.title || document.original_filename}
                        </strong>
                        {pageCount ? ` (${pageCount} pages)` : ''}
                    </p>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <span>⚠</span>
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)}>
                        ✕
                    </button>
                </div>
            )}

            {!result && !running && (
                <>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">
                            Page Ranges
                            <span className="font-normal text-gray-400 ml-1">
                                (specify which pages contain each type of data)
                            </span>
                        </label>
                        <div className="space-y-2">
                            {pageRanges.map((range) => (
                                <div
                                    key={range.id}
                                    className="flex items-center gap-2 flex-wrap"
                                >
                                    <input
                                        type="text"
                                        value={range.label}
                                        onChange={(e) =>
                                            setPageRanges((prev) =>
                                                prev.map((r) =>
                                                    r.id === range.id
                                                        ? {
                                                              ...r,
                                                              label: e.target
                                                                  .value,
                                                          }
                                                        : r
                                                )
                                            )}
                                        placeholder="e.g. Torque Specification"
                                        className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                                    />
                                    <span className="text-xs text-gray-500">
                                        Pages
                                    </span>
                                    <input
                                        type="number"
                                        value={range.from}
                                        onChange={(e) =>
                                            setPageRanges((prev) =>
                                                prev.map((r) =>
                                                    r.id === range.id
                                                        ? {
                                                              ...r,
                                                              from: e.target
                                                                  .value,
                                                          }
                                                        : r
                                                )
                                            )
                                        }
                                        placeholder="From"
                                        min={1}
                                        max={pageCount ?? 999}
                                        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none"
                                    />
                                    <span className="text-xs text-gray-400">–</span>
                                    <input
                                        type="number"
                                        value={range.to}
                                        onChange={(e) =>
                                            setPageRanges((prev) =>
                                                prev.map((r) =>
                                                    r.id === range.id
                                                        ? {
                                                              ...r,
                                                              to: e.target
                                                                  .value,
                                                          }
                                                        : r
                                                )
                                            )
                                        }
                                        placeholder="To"
                                        min={1}
                                        max={pageCount ?? 999}
                                        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none"
                                    />
                                    {pageRanges.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPageRanges((prev) =>
                                                    prev.filter(
                                                        (r) => r.id !== range.id
                                                    )
                                                )
                                            }
                                            className="text-gray-300 hover:text-red-500 text-sm"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                setPageRanges((prev) => [
                                    ...prev,
                                    {
                                        id: Date.now().toString(),
                                        label: '',
                                        from: '',
                                        to: '',
                                    },
                                ])
                            }
                            className="mt-2 text-xs text-blue-600 hover:underline"
                        >
                            + Add page range
                        </button>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">
                            Parameters to Extract
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(PARAM_LABELS).map(([key, label]) => (
                                <label
                                    key={key}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${
                                        parameters.includes(key)
                                            ? 'bg-blue-50 border-blue-400 text-blue-800'
                                            : 'bg-white border-gray-200 text-gray-600'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={parameters.includes(key)}
                                        onChange={(e) =>
                                            setParameters((prev) =>
                                                e.target.checked
                                                    ? [...prev, key]
                                                    : prev.filter((p) => p !== key)
                                            )
                                        }
                                        className="rounded"
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">
                            Additional Instructions
                            <span className="font-normal text-gray-400 ml-1">
                                (optional)
                            </span>
                        </label>
                        <textarea
                            value={customInstruction}
                            onChange={(e) =>
                                setCustomInstruction(e.target.value)
                            }
                            rows={2}
                            placeholder="e.g. Focus on shell side only. The torque table is on page 62."
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => void runExtraction()}
                        disabled={running || !canEdit}
                        className="w-full py-3 bg-[#0D2137] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        🤖 Run AI Extraction
                    </button>
                </>
            )}

            {running && (
                <div className="text-center py-12">
                    <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-700">
                        Analysing document pages...
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        This may take 15–45 seconds
                    </p>
                </div>
            )}

            {result && !running && (
                <div className="space-y-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-sm text-gray-700">
                            {result.document_summary}
                        </p>
                        {result.equipment_identified.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                                Equipment identified:{' '}
                                {result.equipment_identified.join(', ')}
                            </p>
                        )}
                        {result.warnings_found.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {result.warnings_found.map((w, i) => (
                                    <p
                                        key={i}
                                        className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1"
                                    >
                                        ⚠ {w}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                            {result.parameters.length} parameters found
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                setAccepted(
                                    new Set(result.parameters.map((p) => p.key))
                                )
                            }
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Accept all
                        </button>
                        <button
                            type="button"
                            onClick={() => setAccepted(new Set())}
                            className="text-xs text-gray-500 hover:underline"
                        >
                            Clear all
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setResult(null);
                                setAccepted(new Set());
                                setOverrides({});
                            }}
                            className="text-xs text-gray-400 hover:text-gray-700 ml-auto"
                        >
                            ← Re-configure
                        </button>
                    </div>

                    <div className="space-y-2">
                        {result.parameters.map((param) => {
                            const isAccepted = accepted.has(param.key);
                            const override = overrides[param.key];
                            const dispVal =
                                override ?? String(param.value ?? '');

                            return (
                                <div
                                    key={param.key}
                                    className={`border rounded-xl p-3 transition-all ${
                                        isAccepted
                                            ? 'bg-white border-blue-300'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={isAccepted}
                                                onChange={(e) => {
                                                    const n = new Set(accepted);
                                                    e.target.checked
                                                        ? n.add(param.key)
                                                        : n.delete(param.key);
                                                    setAccepted(n);
                                                }}
                                                className="mt-0.5 rounded flex-none"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-gray-700">
                                                    {param.label}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <input
                                                        type="text"
                                                        value={dispVal}
                                                        onChange={(e) =>
                                                            setOverrides(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [param.key]:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm font-mono w-32 focus:outline-none focus:border-blue-500"
                                                    />
                                                    {param.unit && (
                                                        <span className="text-xs text-gray-400">
                                                            {param.unit}
                                                        </span>
                                                    )}
                                                    {param.calculated && (
                                                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                                                            calculated
                                                        </span>
                                                    )}
                                                </div>
                                                {param.source_text && (
                                                    <p className="text-xs text-gray-400 mt-1 italic line-clamp-2">
                                                        &quot;
                                                        {param.source_text}
                                                        &quot;
                                                        {param.page_number
                                                            ? ` — p.${param.page_number}`
                                                            : ''}
                                                    </p>
                                                )}
                                                {param.calculated &&
                                                    param.calculation_basis && (
                                                        <p className="text-xs text-purple-600 mt-1">
                                                            {
                                                                param.calculation_basis
                                                            }
                                                        </p>
                                                    )}
                                                {param.ambiguous &&
                                                    param.candidates.length >
                                                        1 && (
                                                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                                            <p className="text-xs font-medium text-amber-800 mb-1">
                                                                Multiple values
                                                                found — select the
                                                                correct one:
                                                            </p>
                                                            {param.candidates.map(
                                                                (c, ci) => (
                                                                    <button
                                                                        key={ci}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setOverrides(
                                                                                (
                                                                                    prev
                                                                                ) => ({
                                                                                    ...prev,
                                                                                    [param.key]:
                                                                                        String(
                                                                                            c.value
                                                                                        ),
                                                                                })
                                                                            )
                                                                        }
                                                                        className={`block w-full text-left text-xs px-2 py-1 rounded mb-1 hover:bg-amber-100 ${
                                                                            String(
                                                                                c.value
                                                                            ) ===
                                                                            dispVal
                                                                                ? 'bg-amber-200'
                                                                                : 'bg-white'
                                                                        }`}
                                                                    >
                                                                        <strong>
                                                                            {
                                                                                c.value
                                                                            }
                                                                        </strong>
                                                                        {param.unit
                                                                            ? ` ${param.unit}`
                                                                            : ''}{' '}
                                                                        —{' '}
                                                                        <span className="text-gray-500">
                                                                            {
                                                                                c.context
                                                                            }
                                                                        </span>
                                                                        {c.page_number
                                                                            ? ` (p.${c.page_number})`
                                                                            : ''}
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-none ${CONFIDENCE_STYLE[param.confidence]}`}
                                        >
                                            {CONFIDENCE_ICON[param.confidence]}{' '}
                                            {param.confidence}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                            {accepted.size} of {result.parameters.length}{' '}
                            selected for import
                        </p>
                        <button
                            type="button"
                            onClick={() => void importAccepted()}
                            disabled={
                                accepted.size === 0 || importing
                            }
                            className="px-5 py-2.5 bg-[#0D2137] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40 flex items-center gap-2"
                        >
                            {importing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                `Import ${accepted.size} Parameter${accepted.size !== 1 ? 's' : ''}`
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
