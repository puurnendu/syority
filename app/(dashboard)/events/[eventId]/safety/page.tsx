'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

// ── Types ──────────────────────────────────────────────────────────
interface Incident {
  id: string;
  safety_id: string;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  root_cause: string;
  lesson_learned: string;
  location: string;
  unit_area: string;
  contractor: string;
  status: string;
  photos: { public_url: string }[];
}

function toIncident(api: any): Incident {
  return {
    id: api.id,
    safety_id: api.safetyId ?? api.safety_id ?? '',
    incident_type: api.incidentType ?? api.incident_type ?? 'Near Miss',
    severity: api.severity ?? 'Low',
    title: api.title ?? '',
    description: api.description ?? '',
    root_cause: api.rootCause ?? api.root_cause ?? '',
    lesson_learned: api.lessonLearned ?? api.lesson_learned ?? '',
    location: api.location ?? '',
    unit_area: api.unitArea ?? api.unit_area ?? '',
    contractor: api.contractor ?? '',
    status: api.status ?? 'Open',
    photos: (api.photos ?? []).map((p: any) => ({ public_url: p.publicUrl ?? p.public_url })),
  };
}

const INCIDENT_TYPES = [
  { value: 'LTI', label: 'LTI — Lost Time Incident', prefix: 'LTI', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'Near Miss', label: 'Near Miss', prefix: 'NM', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'First Aid', label: 'First Aid', prefix: 'FA', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'Medical Treatment', label: 'Medical Treatment Case', prefix: 'MTC', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'Dangerous Occurrence', label: 'Dangerous Occurrence', prefix: 'DO', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'Property Damage', label: 'Property Damage', prefix: 'PD', color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const typeColor = (type: string) =>
  INCIDENT_TYPES.find((t) => t.value === type)?.color ?? 'bg-gray-100 text-gray-600 border-gray-200';

// ── Counter field ──────────────────────────────────────────────────
function Counter({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
          className="w-16 text-center text-xl font-bold border border-gray-200 rounded-lg py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Incident Form Modal ─────────────────────────────────────────────
function IncidentModal({
  eventId,
  logId,
  existingIncidents,
  incident,
  onSaved,
  onClose,
}: {
  eventId: string;
  logId: string;
  existingIncidents: Incident[];
  incident?: Incident | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    safety_id: incident?.safety_id ?? '',
    incident_type: incident?.incident_type ?? 'Near Miss',
    severity: incident?.severity ?? 'Low',
    title: incident?.title ?? '',
    description: incident?.description ?? '',
    root_cause: incident?.root_cause ?? '',
    lesson_learned: incident?.lesson_learned ?? '',
    location: incident?.location ?? '',
    unit_area: incident?.unit_area ?? '',
    contractor: incident?.contractor ?? '',
  });
  const [photos, setPhotos] = useState<string[]>(incident?.photos?.map((p) => p.public_url) ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (incident) return;
    const prefix = INCIDENT_TYPES.find((t) => t.value === form.incident_type)?.prefix ?? 'INC';
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const count = existingIncidents.filter((i) => i.incident_type === form.incident_type).length + 1;
    const seq = String(count).padStart(2, '0');
    setForm((f) => ({ ...f, safety_id: `${prefix}-${dateStr}-${seq}` }));
  }, [form.incident_type, incident, existingIncidents]);

  const set = (k: string, v: string) => {
    setShowValidationErrors(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('photo_type', 'incident');
    if (logId) fd.append('log_id', logId);
    const res = await fetch(`/api/events/${eventId}/safety/photos`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.photo?.publicUrl) setPhotos((p) => [...p, data.photo.publicUrl]);
    setUploading(false);
  };

  const save = async () => {
    if (!form.title.trim()) {
      setShowValidationErrors(true);
      document.getElementById('incident-title')?.focus();
      document.getElementById('incident-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!form.description.trim()) {
      setShowValidationErrors(true);
      document.getElementById('incident-description')?.focus();
      document.getElementById('incident-description')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setShowValidationErrors(false);
    setSaving(true);
    const url = incident
      ? `/api/events/${eventId}/safety/incidents/${incident.id}`
      : `/api/events/${eventId}/safety/incidents`;
    const method = incident ? 'PATCH' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, safety_log_id: logId }),
    });
    setSaving(false);
    onSaved();
  };

  const selectedType = INCIDENT_TYPES.find((t) => t.value === form.incident_type);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div
          className={`px-6 py-4 rounded-t-2xl flex items-center justify-between ${
            form.incident_type === 'LTI'
              ? 'bg-red-600'
              : form.incident_type === 'Near Miss'
                ? 'bg-amber-500'
                : 'bg-gray-800'
          }`}
        >
          <div>
            <h3 className="text-base font-bold text-white">
              {incident ? 'Edit Incident' : '+ Log New Incident'}
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              {form.safety_id || 'Safety ID will be generated automatically'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                Incident Type *
              </label>
              <select
                value={form.incident_type}
                onChange={(e) => set('incident_type', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                Severity
              </label>
              <select
                value={form.severity}
                onChange={(e) => set('severity', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SEVERITY_LEVELS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Safety ID (Auto-generated)
              </p>
              <p className="text-base font-mono font-bold text-indigo-600 mt-0.5">{form.safety_id}</p>
            </div>
            <div className="ml-auto">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${selectedType?.color}`}>
                {form.incident_type}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                Incident Title *
              </label>
              <input
                id="incident-title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Brief one-line description"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  showValidationErrors && !form.title.trim()
                    ? 'border-red-400 bg-red-50 placeholder-red-300'
                    : 'border-gray-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                Location
              </label>
              <input
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. CDU area, near E-301"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                Unit / Area
              </label>
              <input
                value={form.unit_area}
                onChange={(e) => set('unit_area', e.target.value)}
                placeholder="e.g. CDU, HDS"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                Contractor / Person
              </label>
              <input
                value={form.contractor}
                onChange={(e) => set('contractor', e.target.value)}
                placeholder="Company or name"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {[
            {
              key: 'description',
              label: 'What Happened *',
              icon: '📋',
              placeholder:
                'Describe exactly what happened, in sequence. Include time, activity being performed, and how the incident occurred.',
              required: true,
            },
            {
              key: 'root_cause',
              label: 'Root Cause Analysis',
              icon: '🔍',
              placeholder:
                'What was the underlying cause? Include immediate cause, basic cause, and any contributing factors such as equipment condition, procedure gaps, or human factors.',
              required: false,
            },
            {
              key: 'lesson_learned',
              label: 'Lesson Learned',
              icon: '💡',
              placeholder:
                'What can be learned from this incident? What corrective or preventive actions should be taken to prevent recurrence?',
              required: false,
            },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                {f.icon} {f.label}
              </label>
              <textarea
                id={f.key === 'description' ? 'incident-description' : undefined}
                value={form[f.key as keyof typeof form]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className={`w-full border rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${
                  (f.required && !form[f.key as keyof typeof form]) ||
                  (f.key === 'description' && showValidationErrors && !form.description.trim())
                    ? 'border-red-200 bg-red-50 placeholder-red-300'
                    : 'border-gray-300'
                }`}
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              📷 Photos / Evidence
            </label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              {uploading ? (
                <p className="text-sm text-indigo-600 animate-pulse">⟳ Uploading…</p>
              ) : (
                <>
                  <p className="text-2xl mb-1">📷</p>
                  <p className="text-sm text-gray-500">
                    <span className="text-indigo-600 font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP, PDF · Max 10MB</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
                e.target.value = '';
              }}
            />
            {photos.length > 0 && (
              <div className="flex gap-3 flex-wrap mt-3">
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    <img
                      src={url}
                      alt=""
                      className="w-20 h-20 object-cover rounded-xl border border-gray-200 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400">
            {form.incident_type === 'LTI' && '⚠ LTI requires immediate notification to management'}
            {form.incident_type === 'Near Miss' && '✓ Reporting near misses prevents future incidents'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={`px-6 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 flex items-center gap-2 ${
                form.incident_type === 'LTI'
                  ? 'bg-red-600 hover:bg-red-700'
                  : form.incident_type === 'Near Miss'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {saving ? (
                <>
                  <span className="animate-spin">⟳</span> Saving…
                </>
              ) : (
                `💾 Save ${form.incident_type}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN SAFETY PAGE
// ══════════════════════════════════════════════════════════════════
export default function SafetyPage() {
  const params = useParams<{ eventId: string }>();
  const { data: session } = useSession();
  const eventId = (params?.eventId as string) ?? '';

  const [tab, setTab] = useState<'log' | 'history' | 'incidents' | 'trends'>('log');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [todayIncidents, setTodayIncidents] = useState<Incident[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [logId, setLogId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    manpower_planned: 0,
    manpower_actual: 0,
    manhours_planned: 0,
    manhours_worked: 0,
    ptw_issued: 0,
    ptw_closed: 0,
    ptw_suspended: 0,
    toolbox_talks: 0,
    safety_notes: '',
  });

  const loadTodayLog = async () => {
    if (!eventId) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`/api/events/${eventId}/safety?date=${today}&latest=true`);
      const data = await res.json();
      console.log('[Safety] today log:', data.log);
      if (data.log) {
        const l = data.log;
        setLogId(l.id);
        setForm((f) => ({
          ...f,
          log_date: l.logDate ? new Date(l.logDate).toISOString().split('T')[0] : f.log_date,
          manpower_planned: l.manpowerPlanned ?? 0,
          manpower_actual: l.manpowerActual ?? 0,
          manhours_planned: Number(l.manhoursPlanned ?? 0),
          manhours_worked: Number(l.manhoursWorked ?? 0),
          ptw_issued: l.ptwIssued ?? 0,
          ptw_closed: l.ptwClosed ?? 0,
          ptw_suspended: l.ptwSuspended ?? 0,
          toolbox_talks: l.toolboxTalks ?? 0,
          safety_notes: l.safetyNotes ?? '',
        }));
        setPhotos((l.photos ?? []).map((p: any) => p.publicUrl ?? p.public_url));
        setTodayIncidents((l.incidents ?? []).map(toIncident));
      }
    } catch (e) {
      console.error(e);
    }
    loadAllIncidents();
  };

  const loadAllIncidents = async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/safety/incidents`);
      const data = await res.json();
      setAllIncidents(Array.isArray(data) ? data.map(toIncident) : []);
    } catch {
      // ignore
    }
  };

  const loadHistory = async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/safety`);
      const data = await res.json();
      setHistory(data.logs ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!eventId) return;
    loadTodayLog();
    loadAllIncidents();
    loadHistory();
  }, [eventId]);

  const incidentCounts = INCIDENT_TYPES.map((t) => ({
    ...t,
    count: todayIncidents.filter((i) => i.incident_type === t.value).length,
  }));

  const totalIncidentsToday = todayIncidents.length;
  const hasLTI = incidentCounts.find((t) => t.value === 'LTI')?.count ?? 0;

  const totalManhours = history.reduce((s, l) => s + Number(l.manhoursWorked ?? 0), 0);
  const totalLTI = allIncidents.filter((i) => i.incident_type === 'LTI').length;
  const ltiRate = totalManhours > 0 ? (totalLTI * 1_000_000) / totalManhours : 0;

  const saveLog = async () => {
    if (!eventId) return;
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        lti: todayIncidents.filter((i) => i.incident_type === 'LTI').length,
        near_miss: todayIncidents.filter((i) => i.incident_type === 'Near Miss').length,
        first_aid: todayIncidents.filter((i) => i.incident_type === 'First Aid').length,
        medical_treatment: todayIncidents.filter((i) => i.incident_type === 'Medical Treatment').length,
        dangerous_occurrence: todayIncidents.filter((i) => i.incident_type === 'Dangerous Occurrence').length,
      }),
    });
    const data = await res.json();
    if (data.log?.id) setLogId(data.log.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    loadHistory();
  };

  const uploadPhoto = async (file: File) => {
    if (!eventId) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('photo_type', 'general');
    if (logId) fd.append('log_id', logId);
    const res = await fetch(`/api/events/${eventId}/safety/photos`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.photo?.publicUrl) setPhotos((p) => [...p, data.photo.publicUrl]);
  };

  const setField = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));

  if (!eventId) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px] text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🦺 Safety Management</h1>
            <p className="text-xs text-gray-400">
              Cumulative statistics — safety data appears first in all progress reports
            </p>
          </div>
          {hasLTI > 0 && (
            <span className="animate-pulse px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-full">
              🚨 LTI REPORTED TODAY
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 divide-x divide-gray-100">
          {[
            {
              label: 'Cumulative LTI',
              value: totalLTI,
              color: totalLTI > 0 ? 'text-red-600' : 'text-green-600',
              sub: 'Target: 0',
            },
            {
              label: 'Total Manhours',
              value: totalManhours.toLocaleString(),
              color: 'text-indigo-600',
              sub: `${history.length} days logged`,
            },
            {
              label: 'LTI Frequency Rate',
              value: ltiRate.toFixed(2),
              color: ltiRate > 0 ? 'text-red-600' : 'text-green-600',
              sub: 'Per million manhours',
            },
            {
              label: 'Safe Days (No LTI)',
              value: history.filter((l) => (l.lti ?? 0) === 0).length,
              color: 'text-green-600',
              sub: `of ${history.length} days`,
            },
          ].map((k) => (
            <div key={k.label} className="px-5 py-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-gray-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'log', label: "Today's Log" },
          {
            id: 'incidents',
            label: `All Incidents (${allIncidents.filter((i) => i.status !== 'Closed').length} open)`,
          },
          { id: 'history', label: `History (${history.length} days)` },
          { id: 'trends', label: 'Trends' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Log Date</label>
                <input
                  type="date"
                  value={form.log_date}
                  onChange={(e) => setField('log_date', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {new Date(form.log_date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div
            className={`bg-white border-2 rounded-xl p-5 ${
              totalIncidentsToday > 0 ? 'border-red-300' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">🚨 Safety Incidents</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Counts are calculated automatically from individual incident records
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingIncident(null);
                  setShowIncidentModal(true);
                }}
                className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 flex items-center gap-2 transition-colors"
              >
                + Log Incident
              </button>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
              {incidentCounts.map((t) => (
                <div
                  key={t.value}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    t.count > 0
                      ? `${t.color} ring-2 ring-offset-1 ring-red-300 shadow-sm`
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <p className={`text-3xl font-bold ${t.count > 0 ? '' : 'text-gray-300'}`}>
                    {t.count}
                  </p>
                  <p
                    className={`text-[10px] font-bold mt-1 leading-tight ${
                      t.count > 0 ? '' : 'text-gray-400'
                    }`}
                  >
                    {t.value}
                  </p>
                  {t.count > 0 && <p className="text-[9px] mt-0.5 opacity-70">reported</p>}
                </div>
              ))}
            </div>

            {todayIncidents.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-green-200 bg-green-50 rounded-xl">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm font-semibold text-green-700">No incidents recorded today</p>
                <p className="text-xs text-green-600 mt-1">
                  Click &quot;+ Log Incident&quot; if an incident occurs
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className={`rounded-xl border p-4 ${
                      inc.incident_type === 'LTI'
                        ? 'border-red-300 bg-red-50'
                        : inc.incident_type === 'Near Miss'
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono font-bold text-gray-500">
                            {inc.safety_id}
                          </span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeColor(inc.incident_type)}`}
                          >
                            {inc.incident_type}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              inc.status === 'Closed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {inc.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{inc.title}</p>
                        {inc.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{inc.description}</p>
                        )}
                        {inc.lesson_learned && (
                          <p className="text-xs text-indigo-600 mt-1">
                            💡 {inc.lesson_learned.slice(0, 100)}
                            {inc.lesson_learned.length > 100 ? '…' : ''}
                          </p>
                        )}
                        {inc.photos?.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {inc.photos.map((p, i) => (
                              <img
                                key={i}
                                src={p.public_url}
                                alt=""
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIncident(inc);
                          setShowIncidentModal(true);
                        }}
                        className="flex-shrink-0 text-xs text-indigo-500 hover:text-indigo-700 font-medium border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
              👷 Manpower & Manhours
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Planned Manpower
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">Enter planned headcount</p>
                <input
                  type="number"
                  min={0}
                  max={99999}
                  value={form.manpower_planned || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    if (val <= 99999) setField('manpower_planned', val);
                  }}
                  placeholder="e.g. 342"
                  className="w-full mt-2 text-2xl font-bold border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider"
                />
                <p className="text-[9px] text-gray-400 mt-1.5">
                  Max 5 digits · Future: auto-fill from attendance system
                </p>
              </div>
              <Counter
                label="Actual Manpower"
                sub="On-site today"
                value={form.manpower_actual}
                onChange={(v) => setField('manpower_actual', v)}
              />
              <div className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Planned Manhours
                </p>
                <input
                  type="number"
                  min={0}
                  value={form.manhours_planned}
                  onChange={(e) => setField('manhours_planned', parseFloat(e.target.value) || 0)}
                  className="w-full mt-2 text-xl font-bold border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Actual Manhours
                </p>
                <input
                  type="number"
                  min={0}
                  value={form.manhours_worked}
                  onChange={(e) => setField('manhours_worked', parseFloat(e.target.value) || 0)}
                  className="w-full mt-2 text-xl font-bold border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {form.manpower_planned > 0 && (
              <div
                className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                  form.manpower_actual >= form.manpower_planned
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {form.manpower_actual >= form.manpower_planned
                  ? `✓ On plan (+${form.manpower_actual - form.manpower_planned})`
                  : `▼ ${form.manpower_planned - form.manpower_actual} below plan`}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                🔏 PTW & Activities
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Counter
                  label="PTW Issued"
                  value={form.ptw_issued}
                  onChange={(v) => setField('ptw_issued', v)}
                />
                <Counter
                  label="PTW Closed"
                  value={form.ptw_closed}
                  onChange={(v) => setField('ptw_closed', v)}
                />
                <Counter
                  label="PTW Suspended"
                  value={form.ptw_suspended}
                  onChange={(v) => setField('ptw_suspended', v)}
                />
                <Counter
                  label="Toolbox Talks"
                  value={form.toolbox_talks}
                  onChange={(v) => setField('toolbox_talks', v)}
                />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  📝 Safety Notes
                </h3>
                <textarea
                  value={form.safety_notes}
                  onChange={(e) => setField('safety_notes', e.target.value)}
                  rows={3}
                  placeholder="Observations, weather, access issues, positive moments..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  📷 Photos
                </h3>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-indigo-300 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-xs text-gray-400">
                    <span className="text-indigo-600 font-medium">Upload photo</span> · JPG, PNG, PDF
                    · Max 10MB
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f);
                    e.target.value = '';
                  }}
                />
                {photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Logged by: {(session?.user as { name?: string })?.name ?? 'You'} · Incident counts
              are auto-calculated
            </p>
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
              <button
                type="button"
                onClick={saveLog}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin">⟳</span> Saving…
                  </>
                ) : (
                  '💾 Save Safety Log'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              {INCIDENT_TYPES.map((t) => {
                const count = allIncidents.filter((i) => i.incident_type === t.value).length;
                return count > 0 ? (
                  <span
                    key={t.value}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border ${t.color}`}
                  >
                    {t.prefix}: {count}
                  </span>
                ) : null;
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingIncident(null);
                setShowIncidentModal(true);
              }}
              className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700"
            >
              + Log Incident
            </button>
          </div>

          {allIncidents.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-green-200 bg-green-50 rounded-xl p-16 text-center">
              <p className="text-4xl mb-3">🟢</p>
              <p className="text-green-700 font-bold text-base">Zero incidents recorded</p>
              <p className="text-xs text-green-600 mt-1">Excellent safety performance</p>
            </div>
          ) : (
            allIncidents.map((inc) => (
              <div
                key={inc.id}
                className={`bg-white border rounded-xl p-5 ${
                  inc.incident_type === 'LTI'
                    ? 'border-red-300'
                    : inc.incident_type === 'Near Miss'
                      ? 'border-amber-300'
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono text-xs font-bold text-gray-400">
                        {inc.safety_id}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border ${typeColor(inc.incident_type)}`}
                      >
                        {inc.incident_type}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          inc.status === 'Closed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 mb-1">{inc.title}</p>
                    {inc.description && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                          What Happened
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">{inc.description}</p>
                      </div>
                    )}
                    {inc.root_cause && (
                      <div className="bg-orange-50 rounded-lg p-3 mb-2">
                        <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">
                          Root Cause
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">{inc.root_cause}</p>
                      </div>
                    )}
                    {inc.lesson_learned && (
                      <div className="bg-indigo-50 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">
                          Lesson Learned
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {inc.lesson_learned}
                        </p>
                      </div>
                    )}
                    {inc.photos?.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {inc.photos.map((p, i) => (
                          <img
                            key={i}
                            src={p.public_url}
                            alt=""
                            className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIncident(inc);
                      setShowIncidentModal(true);
                    }}
                    className="flex-shrink-0 text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {history.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-gray-500 font-medium">No logs yet</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Date',
                    'Manpower\nPlan/Actual',
                    'Manhours',
                    'Incidents',
                    'PTW\nIssued/Closed',
                    'Toolbox',
                    'Logged By',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-pre-line"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((log: any) => (
                  <tr key={log.id} className={(log.lti ?? 0) > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {new Date(log.logDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-gray-400">{log.manpowerPlanned ?? 0}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="font-semibold text-gray-900">
                        {log.manpowerActual ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {Number(log.manhoursWorked ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(log.lti ?? 0) > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            LTI: {log.lti}
                          </span>
                        )}
                        {(log.nearMiss ?? 0) > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            NM: {log.nearMiss}
                          </span>
                        )}
                        {(log.firstAid ?? 0) > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                            FA: {log.firstAid}
                          </span>
                        )}
                        {(log.lti ?? 0) === 0 && (log.nearMiss ?? 0) === 0 && (log.firstAid ?? 0) === 0 && (
                          <span className="text-xs text-green-600 font-medium">✓ Clear</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {log.ptwIssued ?? 0}/{log.ptwClosed ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {log.toolboxTalks ?? 0}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {log.submittedByName ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'trends' && (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500 font-medium">Safety Trends</p>
          <p className="text-xs text-gray-400 mt-1">
            Log at least 7 days of data to see trend charts
          </p>
        </div>
      )}

      {showIncidentModal && (
        <IncidentModal
          eventId={eventId}
          logId={logId}
          existingIncidents={todayIncidents}
          incident={editingIncident}
          onSaved={() => {
            setShowIncidentModal(false);
            setEditingIncident(null);
            loadTodayLog();
            loadAllIncidents();
          }}
          onClose={() => {
            setShowIncidentModal(false);
            setEditingIncident(null);
          }}
        />
      )}
    </div>
  );
}
