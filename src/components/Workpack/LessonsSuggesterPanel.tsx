'use client';

import { useState } from 'react';

type Suggestion = {
    title: string;
    description: string;
    recommendation: string;
    category: string;
    impact: 'high' | 'medium' | 'low';
    ai_reasoning: string;
};

type SuggestionResult = {
    job_id: string;
    suggestions: Suggestion[];
    context_summary: string;
};

const IMPACT_STYLE = {
    high: 'bg-red-50 border-red-200 text-red-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    low: 'bg-gray-50 border-gray-200 text-gray-600',
};

const CATEGORY_LABEL: Record<string, string> = {
    what_went_well: '✅ What went well',
    what_went_wrong: '⚠️ What went wrong',
    process_improvement: '🔄 Process improvement',
    near_miss: '🔴 Near miss',
    safety: '🦺 Safety',
    technical: '🔧 Technical',
    commercial: '💰 Commercial',
};

export function LessonsSuggesterPanel({
    workpackId,
    canEdit,
    onLessonsCreated,
}: {
    workpackId: string;
    canEdit: boolean;
    onLessonsCreated: () => void;
}) {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<SuggestionResult | null>(null);
    const [accepted, setAccepted] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function runSuggestion() {
        setRunning(true);
        setError(null);
        setResult(null);
        setSaved(false);

        const res = await fetch(
            `/api/workpacks/${workpackId}/suggest-lessons`,
            { method: 'POST' }
        );
        const d = await res.json();
        if (!res.ok) {
            setError(d.error ?? 'AI suggestion failed');
            setRunning(false);
            return;
        }

        setResult(d);
        setAccepted(
            new Set(d.suggestions.map((_: unknown, i: number) => i))
        );
        setRunning(false);
    }

    async function saveAccepted() {
        if (!result || accepted.size === 0) return;
        setSaving(true);
        setError(null);

        const res = await fetch(
            `/api/workpacks/${workpackId}/suggest-lessons/${result.job_id}/accept`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accepted_indices: [...accepted],
                }),
            }
        );
        const d = await res.json();
        if (!res.ok) {
            setError(d.error ?? 'Failed to save lessons');
            setSaving(false);
            return;
        }

        setSaved(true);
        setSaving(false);
        onLessonsCreated();
    }

    if (saved)
        return (
            <div className="text-center py-8 bg-green-50 border border-green-200 rounded-2xl">
                <p className="text-2xl mb-2">💡</p>
                <p className="text-sm font-semibold text-green-800">
                    {accepted.size} lesson
                    {accepted.size !== 1 ? 's' : ''} saved as draft
                </p>
                <p className="text-xs text-green-600 mt-1">
                    An admin must publish them to the central lessons register.
                </p>
            </div>
        );

    return (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                    <h3 className="text-sm font-bold text-gray-900">
                        AI Lessons Suggester
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                        Analyse this workpack&apos;s constraints, activities and
                        notes to suggest lessons learned entries for review.
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
                <button
                    type="button"
                    onClick={() => void runSuggestion()}
                    disabled={!canEdit}
                    className="w-full py-3 bg-purple-700 text-white text-sm font-semibold rounded-xl hover:bg-purple-800 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                    💡 Generate Lesson Suggestions
                </button>
            )}

            {running && (
                <div className="text-center py-10">
                    <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                        Analysing workpack...
                    </p>
                </div>
            )}

            {result && !running && (
                <div className="space-y-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-600">
                        {result.context_summary}
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                            {result.suggestions.length} suggestions
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setAccepted(
                                        new Set(
                                            result.suggestions.map((_, i) => i)
                                        )
                                    )
                                }
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Select all
                            </button>
                            <button
                                type="button"
                                onClick={() => setAccepted(new Set())}
                                className="text-xs text-gray-400 hover:underline"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {result.suggestions.map((s, idx) => (
                            <div
                                key={idx}
                                className={`border rounded-xl p-3 cursor-pointer transition-all ${
                                    accepted.has(idx)
                                        ? 'bg-white border-purple-300'
                                        : 'bg-gray-50 border-gray-200'
                                }`}
                                onClick={() => {
                                    const n = new Set(accepted);
                                    accepted.has(idx)
                                        ? n.delete(idx)
                                        : n.add(idx);
                                    setAccepted(n);
                                }}
                            >
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        checked={accepted.has(idx)}
                                        onChange={() => {}}
                                        className="mt-0.5 rounded flex-none"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {s.title}
                                            </p>
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full border flex-none ${IMPACT_STYLE[s.impact]}`}
                                            >
                                                {s.impact}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {CATEGORY_LABEL[s.category] ??
                                                    s.category}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                            {s.description}
                                        </p>
                                        <p className="text-xs text-green-700 mt-1 font-medium">
                                            → {s.recommendation}
                                        </p>
                                        <p className="text-xs text-purple-500 mt-1 italic">
                                            AI: {s.ai_reasoning}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                            Saved as draft — admin review required before
                            publishing
                        </p>
                        <button
                            type="button"
                            onClick={() => void saveAccepted()}
                            disabled={accepted.size === 0 || saving}
                            className="px-5 py-2.5 bg-purple-700 text-white text-sm font-semibold rounded-xl hover:bg-purple-800 disabled:opacity-40 flex items-center gap-2"
                        >
                            {saving
                                ? 'Saving...'
                                : `Save ${accepted.size} Lesson${accepted.size !== 1 ? 's' : ''} as Draft`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
