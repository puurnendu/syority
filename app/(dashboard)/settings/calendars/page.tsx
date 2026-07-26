'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
interface CalendarException {
    date: string;       // YYYY-MM-DD
    label: string;      // e.g. "National Day", "Ramadan"
    type: 'holiday' | 'non_working' | 'special_shift';
    hours?: number;     // optional: override hours for special_shift
}

interface ScheduleCalendar {
    id: string;
    name: string;
    work_days: number[];       // 0=Sun, 1=Mon … 6=Sat
    hours_per_day: number;
    exceptions: CalendarException[];
    is_default: boolean;
    created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
    holiday: '🎉 Holiday',
    non_working: '🚫 Non-Working',
    special_shift: '⏰ Special Shift',
};

// ── Empty form ───────────────────────────────────────────────────────────────
const EMPTY_FORM: Omit<ScheduleCalendar, 'id' | 'created_at'> = {
    name: '',
    work_days: [1, 2, 3, 4, 5],
    hours_per_day: 10,
    exceptions: [],
    is_default: false,
};

// ── Component ────────────────────────────────────────────────────────────────
export default function CalendarsPage() {
    const [calendars, setCalendars] = useState<ScheduleCalendar[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM, exceptions: [] as CalendarException[] });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Exception add form
    const [newExc, setNewExc] = useState<CalendarException>({
        date: '', label: '', type: 'holiday',
    });

    const fetchCalendars = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings/calendars');
            const data = await res.json();
            setCalendars(Array.isArray(data) ? data : []);
        } catch {
            setError('Failed to load calendars');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCalendars(); }, [fetchCalendars]);
    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(null), 3000);
        return () => clearTimeout(t);
    }, [success]);

    // Open drawer for create or edit
    const openCreate = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM, exceptions: [] });
        setDrawerOpen(true);
    };
    const openEdit = (cal: ScheduleCalendar) => {
        setEditingId(cal.id);
        setForm({
            name: cal.name,
            work_days: cal.work_days,
            hours_per_day: cal.hours_per_day,
            exceptions: Array.isArray(cal.exceptions) ? cal.exceptions : [],
            is_default: cal.is_default,
        });
        setDrawerOpen(true);
    };

    // Toggle work day
    const toggleDay = (day: number) => {
        setForm(f => ({
            ...f,
            work_days: f.work_days.includes(day)
                ? f.work_days.filter(d => d !== day)
                : [...f.work_days, day].sort((a, b) => a - b),
        }));
    };

    // Add exception
    const addException = () => {
        if (!newExc.date || !newExc.label) { setError('Exception date and label are required'); return; }
        setForm(f => ({
            ...f,
            exceptions: [...f.exceptions, { ...newExc }],
        }));
        setNewExc({ date: '', label: '', type: 'holiday' });
    };

    // Remove exception
    const removeException = (idx: number) => {
        setForm(f => ({ ...f, exceptions: f.exceptions.filter((_, i) => i !== idx) }));
    };

    // Save
    const handleSave = async () => {
        setError(null);
        if (!form.name.trim()) { setError('Calendar name is required'); return; }
        if (form.work_days.length === 0) { setError('At least one working day must be selected'); return; }
        setSaving(true);
        try {
            const url = editingId ? `/api/settings/calendars/${editingId}` : '/api/settings/calendars';
            const method = editingId ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error ?? 'Save failed');
            }
            setDrawerOpen(false);
            setSuccess(editingId ? 'Calendar updated' : 'Calendar created');
            fetchCalendars();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // Delete
    const handleDelete = async (cal: ScheduleCalendar) => {
        if (!confirm(`Delete calendar "${cal.name}"? This cannot be undone.`)) return;
        setDeletingId(cal.id);
        setError(null);
        try {
            const res = await fetch(`/api/settings/calendars/${cal.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error ?? 'Delete failed');
            }
            setSuccess('Calendar deleted');
            setCalendars(prev => prev.filter(c => c.id !== cal.id));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDeletingId(null);
        }
    };

    // Set default
    const setAsDefault = async (cal: ScheduleCalendar) => {
        try {
            const res = await fetch(`/api/settings/calendars/${cal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_default: true }),
            });
            if (!res.ok) throw new Error('Failed to set default');
            setSuccess(`"${cal.name}" is now the default calendar`);
            fetchCalendars();
        } catch (e: any) {
            setError(e.message);
        }
    };

    const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Working Calendars</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Define working days, hours per day, and public holiday exceptions used by the schedule engine.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl
                               hover:bg-[#1a3a5c] shadow-md active:scale-95 transition-all"
                >
                    + New Calendar
                </button>
            </div>

            {/* Toasts */}
            {success && (
                <div className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl shadow-xl">
                    ✓ {success}
                </div>
            )}
            {error && !drawerOpen && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <span>⚠</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            {/* Calendar list */}
            {loading ? (
                <div className="text-sm text-gray-400 py-12 text-center">Loading calendars…</div>
            ) : calendars.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                    <div className="text-4xl mb-3">📅</div>
                    <h3 className="text-base font-semibold text-gray-700 mb-1">No calendars yet</h3>
                    <p className="text-sm text-gray-400 mb-4">
                        Create a working calendar to control which days count as working days in your schedule.
                    </p>
                    <button onClick={openCreate} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
                        Create First Calendar
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {calendars.map(cal => {
                        const excByType = {
                            holiday: cal.exceptions?.filter(e => e.type === 'holiday').length ?? 0,
                            non_working: cal.exceptions?.filter(e => e.type === 'non_working').length ?? 0,
                            special_shift: cal.exceptions?.filter(e => e.type === 'special_shift').length ?? 0,
                        };
                        return (
                            <div
                                key={cal.id}
                                className={`bg-white border rounded-2xl p-5 flex items-center gap-5 transition-all ${
                                    cal.is_default ? 'border-blue-300 ring-1 ring-blue-200 shadow-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {/* Calendar icon */}
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                                    cal.is_default ? 'bg-blue-50' : 'bg-gray-50'
                                }`}>
                                    📅
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-semibold text-gray-900">{cal.name}</h3>
                                        {cal.is_default && (
                                            <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                                ⭐ Default
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                        {/* Work days */}
                                        <div className="flex items-center gap-0.5">
                                            {DAYS_OF_WEEK.map(d => (
                                                <span
                                                    key={d.value}
                                                    className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                                                        cal.work_days.includes(d.value)
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-300'
                                                    }`}
                                                >
                                                    {d.label}
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-xs text-gray-500">{cal.hours_per_day}h/day</span>
                                        {excByType.holiday > 0 && (
                                            <span className="text-xs text-gray-500">
                                                🎉 {excByType.holiday} holiday{excByType.holiday !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {excByType.non_working > 0 && (
                                            <span className="text-xs text-gray-500">
                                                🚫 {excByType.non_working} non-working
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {!cal.is_default && (
                                        <button
                                            onClick={() => setAsDefault(cal)}
                                            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                        >
                                            Set Default
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEdit(cal)}
                                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                    >
                                        ✏ Edit
                                    </button>
                                    <button
                                        disabled={deletingId === cal.id || cal.is_default}
                                        onClick={() => handleDelete(cal)}
                                        className="text-xs px-3 py-1.5 border border-red-100 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title={cal.is_default ? 'Cannot delete the default calendar' : 'Delete'}
                                    >
                                        {deletingId === cal.id ? '…' : '🗑'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Create / Edit Drawer ─────────────────────────────────────── */}
            {drawerOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/30 z-40"
                        onClick={() => setDrawerOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                            <h2 className="text-base font-semibold text-gray-900">
                                {editingId ? 'Edit Calendar' : 'New Calendar'}
                            </h2>
                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="text-gray-400 hover:text-gray-700 text-xl p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Drawer body */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                                    <span>⚠</span>
                                    <span className="flex-1">{error}</span>
                                    <button onClick={() => setError(null)}>✕</button>
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Calendar Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className={inputCls}
                                    placeholder="e.g. Standard Work Week, Ramadan Schedule"
                                />
                            </div>

                            {/* Working days */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">
                                    Working Days <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    {DAYS_OF_WEEK.map(d => {
                                        const active = form.work_days.includes(d.value);
                                        return (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => toggleDay(d.value)}
                                                className={`w-10 h-10 rounded-lg text-xs font-semibold border transition-all ${
                                                    active
                                                        ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                                                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'
                                                }`}
                                            >
                                                {d.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5">
                                    {form.work_days.length} working day{form.work_days.length !== 1 ? 's' : ''} per week
                                </p>
                            </div>

                            {/* Hours per day */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hours per Day</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={1}
                                        max={24}
                                        step={0.5}
                                        value={form.hours_per_day}
                                        onChange={e => setForm(f => ({ ...f, hours_per_day: parseFloat(e.target.value) || 10 }))}
                                        className={`${inputCls} w-28`}
                                    />
                                    <span className="text-sm text-gray-500">hrs/day</span>
                                    <div className="flex gap-1 ml-auto">
                                        {[8, 10, 12].map(h => (
                                            <button
                                                key={h}
                                                type="button"
                                                onClick={() => setForm(f => ({ ...f, hours_per_day: h }))}
                                                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                                    form.hours_per_day === h
                                                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                                                }`}
                                            >
                                                {h}h
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Default toggle */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="is_default"
                                    checked={form.is_default}
                                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="is_default" className="text-sm text-gray-700 cursor-pointer">
                                    <span className="font-medium">Set as default calendar</span>
                                    <span className="block text-xs text-gray-400">
                                        Used by the schedule engine when no specific calendar is assigned.
                                    </span>
                                </label>
                            </div>

                            {/* Exceptions */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-600">
                                        Exceptions ({form.exceptions.length})
                                    </label>
                                    <span className="text-xs text-gray-400">Holidays, shutdowns, special shifts</span>
                                </div>

                                {/* Add exception form */}
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3 mb-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Date</label>
                                            <input
                                                type="date"
                                                value={newExc.date}
                                                onChange={e => setNewExc(ex => ({ ...ex, date: e.target.value }))}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Type</label>
                                            <select
                                                value={newExc.type}
                                                onChange={e => setNewExc(ex => ({ ...ex, type: e.target.value as any }))}
                                                className={inputCls}
                                            >
                                                <option value="holiday">🎉 Holiday</option>
                                                <option value="non_working">🚫 Non-Working</option>
                                                <option value="special_shift">⏰ Special Shift</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Label</label>
                                            <input
                                                type="text"
                                                value={newExc.label}
                                                onChange={e => setNewExc(ex => ({ ...ex, label: e.target.value }))}
                                                placeholder="e.g. National Day, Plant Shutdown"
                                                className={inputCls}
                                            />
                                        </div>
                                        {newExc.type === 'special_shift' && (
                                            <div className="w-24">
                                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Hours</label>
                                                <input
                                                    type="number"
                                                    min={1} max={24} step={0.5}
                                                    value={newExc.hours ?? ''}
                                                    onChange={e => setNewExc(ex => ({ ...ex, hours: parseFloat(e.target.value) || undefined }))}
                                                    placeholder="hrs"
                                                    className={inputCls}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addException}
                                        className="w-full py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                                    >
                                        + Add Exception
                                    </button>
                                </div>

                                {/* Exception list */}
                                {form.exceptions.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-2">No exceptions defined</p>
                                ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {form.exceptions
                                            .sort((a, b) => a.date.localeCompare(b.date))
                                            .map((exc, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs"
                                                >
                                                    <span className="text-gray-400 font-mono">{exc.date}</span>
                                                    <span className="flex-1 text-gray-700 font-medium">{exc.label}</span>
                                                    <span className="text-gray-400">{EXCEPTION_TYPE_LABELS[exc.type] ?? exc.type}</span>
                                                    {exc.hours && (
                                                        <span className="text-gray-400">{exc.hours}h</span>
                                                    )}
                                                    <button
                                                        onClick={() => removeException(form.exceptions.indexOf(exc))}
                                                        className="text-gray-300 hover:text-red-500 ml-1"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Drawer footer */}
                        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl
                                           hover:bg-[#1a3a5c] disabled:opacity-50 disabled:cursor-not-allowed
                                           transition-all active:scale-95 shadow-md"
                            >
                                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Calendar'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
