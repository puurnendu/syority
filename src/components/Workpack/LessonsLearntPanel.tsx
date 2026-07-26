'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LessonsSuggesterPanel } from './LessonsSuggesterPanel';

interface Props {
    workpack: any;
    canEdit?: boolean;
}

const CATEGORIES = ['general', 'safety', 'technical', 'scheduling', 'resources', 'procurement', 'quality', 'hse'];
const IMPACTS = ['high', 'medium', 'low'];

export function LessonsLearntPanel({ workpack, canEdit = true }: Props) {
    const [lessons, setLessons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'general',
        impact: 'medium',
        recommendation: '',
    });

    useEffect(() => {
        fetchLessons();
    }, [workpack.id]);

    const fetchLessons = async () => {
        const res = await fetch(`/api/workpacks/${workpack.id}/lessons`);
        if (res.ok) {
            const data = await res.json();
            setLessons(Array.isArray(data) ? data : []);
        } else {
            setLessons([]);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title || 'Untitled lesson',
                    description: form.description,
                    category: form.category,
                    impact: form.impact,
                    recommendation: form.recommendation || undefined,
                    is_in_central_register: false,
                    status: 'draft',
                }),
            });
            if (res.ok) {
                setShowForm(false);
                setForm({ title: '', description: '', category: 'general', impact: 'medium', recommendation: '' });
                fetchLessons();
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canEdit) return;
        if (!confirm('Remove this lesson?')) return;
        await fetch(`/api/workpacks/${workpack.id}/lessons/${id}`, { method: 'DELETE' });
        fetchLessons();
    };

    if (loading) return <div className="p-8">Loading lessons learned…</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Lessons Learned</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Capture insights for future operational excellence</p>
                    <p className="text-xs text-gray-500 mt-2">
                        Lessons can be published to the{' '}
                        <Link href="/lessons" className="text-blue-600 hover:underline font-medium">Central Lessons Register</Link>
                        {' '}for project closure reporting.
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-6 py-3 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                    >
                        + Log New Lesson
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Title</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Short title for this lesson"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Category</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}
                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c.replace(/\b\w/g, l => l.toUpperCase())}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Impact</label>
                                <select
                                    value={form.impact}
                                    onChange={e => setForm({ ...form, impact: e.target.value })}
                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {IMPACTS.map(i => (
                                        <option key={i} value={i}>{i}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Observed Issue / Success</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium shadow-inner outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="Describe what happened..."
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Future Recommendation</label>
                            <textarea
                                value={form.recommendation}
                                onChange={e => setForm({ ...form, recommendation: e.target.value })}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium shadow-inner outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="How to improve or repeat this in the future?"
                            />
                        </div>
                        <div className="flex justify-end gap-4 pt-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 text-xs font-bold text-gray-400 hover:text-gray-600 transition-all uppercase tracking-widest">Discard</button>
                            <button type="submit" disabled={saving} className="px-10 py-3 bg-blue-600 text-white text-xs font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 uppercase tracking-[0.2em]">
                                {saving ? 'LOGGING…' : 'LOG LESSON'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-6">
                {lessons.length === 0 && !showForm && (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center text-gray-500 text-sm">
                        No lessons logged yet. Log a lesson to capture insights and optionally publish to the Central Lessons Register.
                    </div>
                )}
                {lessons.map(ls => (
                    <div key={ls.id} className="relative bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl group overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${(ls.impact || '').toLowerCase() === 'high' ? 'bg-red-500' : (ls.impact || '').toLowerCase() === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />

                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4 flex-wrap">
                                <span className="px-3 py-1 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full">{ls.category || 'general'}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${(ls.impact || '').toLowerCase() === 'high' ? 'text-red-500' : 'text-gray-400'}`}>{(ls.impact || 'medium')} impact</span>
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{ls.status || 'draft'}</span>
                                {ls.is_in_central_register ? (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">In central register</span>
                                ) : (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Not in central register</span>
                                )}
                            </div>
                            {canEdit && (
                                <button
                                    onClick={() => handleDelete(ls.id)}
                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            {ls.title && (
                                <p className="text-sm font-bold text-gray-900">{ls.title}</p>
                            )}
                            <div>
                                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1 italic">The Observation</p>
                                <p className="text-sm font-medium text-gray-800 leading-relaxed">{ls.description}</p>
                            </div>
                            {ls.recommendation && (
                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-50">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 italic">Recommendation</p>
                                    <p className="text-xs text-blue-900 font-medium italic">&quot;{ls.recommendation}&quot;</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex justify-between items-center text-[9px] text-gray-300 font-bold uppercase tracking-widest">
                            <span>View all in <Link href="/lessons" className="text-blue-500 hover:underline">Central Lessons Register</Link></span>
                            <span>{ls.created_at ? new Date(ls.created_at).toLocaleDateString() : ''}</span>
                        </div>
                    </div>
                ))}
            </div>

            {((workpack.status === 'complete' ||
                ((workpack.overall_progress ?? 0) as number) >= 90) &&
                canEdit) && (
                    <div className="mt-8">
                        <LessonsSuggesterPanel
                            workpackId={workpack.id}
                            canEdit={canEdit}
                            onLessonsCreated={fetchLessons}
                        />
                    </div>
                )}
        </div>
    );
}
