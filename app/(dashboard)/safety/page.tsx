'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function SafetyPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [form, setForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    manpower_planned: 0,
    manpower_actual: 0,
    manhours_planned: 0,
    manhours_worked: 0,
    lti: 0,
    lti_days_lost: 0,
    near_miss: 0,
    first_aid: 0,
    medical_treatment: 0,
    dangerous_occurrence: 0,
    ptw_issued: 0,
    ptw_closed: 0,
    ptw_suspended: 0,
    toolbox_talks: 0,
    safety_notes: '',
  });
  const [cumulative, setCumulative] = useState({ manhours: 0, lti: 0, ltiRate: 0, days: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logId, setLogId] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load events (try /api/events first, fallback to /api/projects)
  useEffect(() => {
    const load = async () => {
      let list: any[] = [];
      try {
        const r1 = await fetch('/api/events');
        const d1 = await r1.json();
        list = Array.isArray(d1) ? d1 : (d1.data ?? d1.events ?? []);
      } catch {
        // ignore
      }
      if (!list.length) {
        try {
          const r2 = await fetch('/api/projects');
          const d2 = await r2.json();
          list = Array.isArray(d2) ? d2 : (d2.projects ?? d2.data ?? []);
        } catch {
          // ignore
        }
      }
      setEvents(list);
      if (list.length === 1) setSelectedEventId(list[0].id);
    };
    load();
  }, []);

  // Load today's log + cumulative when event changes
  useEffect(() => {
    if (!selectedEventId) return;
    const today = new Date().toISOString().split('T')[0];

    // Today's log (API returns camelCase)
    fetch(`/api/events/${selectedEventId}/safety?date=${today}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.log) {
          const l = d.log;
          setLogId(l.id);
          setForm((f) => ({
            ...f,
            log_date: l.logDate ? new Date(l.logDate).toISOString().split('T')[0] : f.log_date,
            manpower_planned: l.manpowerPlanned ?? 0,
            manpower_actual: l.manpowerActual ?? 0,
            manhours_planned: Number(l.manhoursPlanned ?? 0),
            manhours_worked: Number(l.manhoursWorked ?? 0),
            lti: l.lti ?? 0,
            lti_days_lost: l.ltiDaysLost ?? 0,
            near_miss: l.nearMiss ?? 0,
            first_aid: l.firstAid ?? 0,
            medical_treatment: l.medicalTreatment ?? 0,
            dangerous_occurrence: l.dangerousOccurrence ?? 0,
            ptw_issued: l.ptwIssued ?? 0,
            ptw_closed: l.ptwClosed ?? 0,
            ptw_suspended: l.ptwSuspended ?? 0,
            toolbox_talks: l.toolboxTalks ?? 0,
            safety_notes: l.safetyNotes ?? '',
          }));
          setPhotos((l.photos ?? []).map((p: any) => p.publicUrl ?? p.public_url));
        }
      })
      .catch(() => {});

    // Cumulative stats (API returns logs with camelCase)
    fetch(`/api/events/${selectedEventId}/safety`)
      .then((r) => r.json())
      .then((d) => {
        const logs = d.logs ?? [];
        const totalMH = logs.reduce((s: number, l: any) => s + Number(l.manhoursWorked ?? 0), 0);
        const totalLTI = logs.reduce((s: number, l: any) => s + (l.lti ?? 0), 0);
        const ltiRate = totalMH > 0 ? (totalLTI * 1_000_000) / totalMH : 0;
        setCumulative({
          manhours: totalMH,
          lti: totalLTI,
          ltiRate: Math.round(ltiRate * 100) / 100,
          days: logs.length,
        });
      })
      .catch(() => {});
  }, [selectedEventId]);

  const set = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));
  const inc = (k: string) => set(k, (form[k as keyof typeof form] as number) + 1);
  const dec = (k: string) => set(k, Math.max(0, (form[k as keyof typeof form] as number) - 1));

  const allClear = () =>
    setForm((f) => ({
      ...f,
      lti: 0,
      near_miss: 0,
      first_aid: 0,
      medical_treatment: 0,
      dangerous_occurrence: 0,
    }));

  const save = async () => {
    if (!selectedEventId) return;
    setSaving(true);
    const res = await fetch(`/api/events/${selectedEventId}/safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.log?.id) setLogId(data.log.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const uploadPhoto = async (file: File) => {
    if (!selectedEventId) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('photo_type', 'general');
    if (logId) fd.append('log_id', logId);
    const res = await fetch(`/api/events/${selectedEventId}/safety/photos`, {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (data.photo?.publicUrl) setPhotos((p) => [...p, data.photo.publicUrl]);
  };

  const needsIncident =
    form.lti > 0 ||
    form.near_miss > 0 ||
    form.first_aid > 0 ||
    form.medical_treatment > 0 ||
    form.dangerous_occurrence > 0;

  // Counter component inline
  const Counter = ({
    label,
    k,
    danger = false,
    sub = '',
  }: {
    label: string;
    k: string;
    danger?: boolean;
    sub?: string;
  }) => (
    <div
      className={`rounded-xl border p-3 ${
        danger && (form[k as keyof typeof form] as number) > 0
          ? 'border-red-300 bg-red-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[9px] text-gray-400">{sub}</p>}
      <div className="flex items-center gap-1.5 mt-2">
        <button
          type="button"
          onClick={() => dec(k)}
          className="w-7 h-7 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 font-bold flex items-center justify-center text-base"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={form[k as keyof typeof form] as number}
          onChange={(e) => set(k, Math.max(0, parseInt(e.target.value, 10) || 0))}
          className={`w-14 text-center text-lg font-bold border rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            danger && (form[k as keyof typeof form] as number) > 0
              ? 'text-red-600 border-red-300 bg-red-50'
              : 'text-gray-900 border-gray-200'
          }`}
        />
        <button
          type="button"
          onClick={() => inc(k)}
          className="w-7 h-7 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 font-bold flex items-center justify-center text-base"
        >
          +
        </button>
      </div>
      {danger && (form[k as keyof typeof form] as number) > 0 && (
        <p className="text-[9px] text-red-500 font-bold mt-1">⚠ Report required</p>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* ── HEADER + CUMULATIVE STRIP ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h1 className="text-xl font-bold text-gray-900">🦺 Safety Management</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Daily HSE log — safety data feeds all progress reports
            </p>
          </div>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
          >
            <option value="">— Select Event / STO —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name ?? e.title} ({e.code ?? e.reference ?? 'N/A'})
              </option>
            ))}
          </select>
        </div>

        {/* Cumulative KPI strip */}
        {selectedEventId && (
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            {[
              {
                label: 'Cumulative LTI',
                value: cumulative.lti,
                color: cumulative.lti > 0 ? 'text-red-600' : 'text-green-600',
                target: 'Target: 0',
              },
              {
                label: 'Total Manhours',
                value: cumulative.manhours.toLocaleString(),
                color: 'text-indigo-600',
                target: `${cumulative.days} days logged`,
              },
              {
                label: 'LTI Frequency Rate',
                value: cumulative.ltiRate.toFixed(2),
                color: cumulative.ltiRate > 0 ? 'text-red-600' : 'text-green-600',
                target: 'Per million manhours',
              },
              {
                label: 'Safe Days',
                value: cumulative.lti === 0 ? cumulative.days : '—',
                color: 'text-green-600',
                target: 'Days without LTI',
              },
            ].map((k) => (
              <div key={k.label} className="px-5 py-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{k.target}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── NO EVENT SELECTED ── */}
      {!selectedEventId && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <p className="text-4xl mb-3">🦺</p>
          <p className="text-gray-500 font-medium">Select an event above to start logging safety data</p>
          <p className="text-xs text-gray-400 mt-1">
            Safety data is logged per turnaround / shutdown event
          </p>
        </div>
      )}

      {/* ── DAILY LOG FORM ── */}
      {selectedEventId && (
        <>
          {/* Date + All Clear bar */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Log Date</label>
                <input
                  type="date"
                  value={form.log_date}
                  onChange={(e) => set('log_date', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="text-sm font-medium text-gray-700">
                {new Date(form.log_date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={allClear}
              className="px-4 py-2 border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              ✅ All Clear — Zero Incidents
            </button>
          </div>

          {/* Three-column form grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Column 1 — Manpower & Manhours */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                👷 Manpower & Manhours
              </h3>
              <div className="space-y-4">
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
                      if (val <= 99999) set('manpower_planned', val);
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
                  k="manpower_actual"
                  sub="Actual on-site count"
                />
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Planned Manhours
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={form.manhours_planned}
                    onChange={(e) => set('manhours_planned', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Actual Manhours Worked
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={form.manhours_worked}
                    onChange={(e) => set('manhours_worked', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {form.manpower_planned > 0 && (
                  <div
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      form.manpower_actual >= form.manpower_planned
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {form.manpower_actual >= form.manpower_planned
                      ? `✓ On plan (+${form.manpower_actual - form.manpower_planned} extra)`
                      : `▼ ${form.manpower_planned - form.manpower_actual} below planned`}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2 — Incidents */}
            <div
              className={`bg-white border rounded-xl p-5 ${
                needsIncident ? 'border-red-300' : 'border-gray-200'
              }`}
            >
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                🚨 Safety Incidents{' '}
                <span className="text-gray-400 font-normal normal-case">(Target: 0 each)</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Counter label="LTI" k="lti" danger />
                <Counter label="Near Miss" k="near_miss" danger />
                <Counter label="First Aid" k="first_aid" danger />
                <Counter label="Medical Treatment" k="medical_treatment" danger />
                <Counter label="Dangerous Occurrence" k="dangerous_occurrence" danger />
                {form.lti > 0 && (
                  <div className="bg-white border border-red-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-1">
                      LTI Days Lost
                    </p>
                    <input
                      type="number"
                      min={0}
                      value={form.lti_days_lost}
                      onChange={(e) => set('lti_days_lost', parseInt(e.target.value, 10) || 0)}
                      className="w-full text-center text-lg font-bold border border-red-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                    />
                  </div>
                )}
              </div>
              {needsIncident && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-700 mb-2">⚠ Incident report required</p>
                  <Link
                    href={`/events/${selectedEventId}/safety`}
                    className="block w-full px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 text-center"
                  >
                    + Open Incident Report Form
                  </Link>
                </div>
              )}
            </div>

            {/* Column 3 — PTW & Notes */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                🔏 PTW & Safety Activities
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Counter label="PTW Issued" k="ptw_issued" />
                <Counter label="PTW Closed" k="ptw_closed" />
                <Counter label="PTW Suspended" k="ptw_suspended" />
                <Counter label="Toolbox Talks" k="toolbox_talks" />
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Safety Notes / Observations
                </p>
                <textarea
                  value={form.safety_notes}
                  onChange={(e) => set('safety_notes', e.target.value)}
                  rows={4}
                  placeholder="Any observations, weather conditions, access issues, positive safety moments..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Photo upload */}
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Photos (Toolbox Talk, PTW Log, Site)
                </p>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-indigo-300 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-xl mb-0.5">📷</p>
                  <p className="text-xs text-gray-400">
                    <span className="text-indigo-600 font-medium">Upload photo</span> · JPG, PNG,
                    PDF · Max 10MB
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
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save bar */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Logs are saved per event per day. Multiple team members can update the same
              day&apos;s log.
            </p>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-green-600 font-medium">✓ Saved successfully</span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving || !selectedEventId}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin inline-block">⟳</span> Saving…
                  </>
                ) : (
                  '💾 Save Safety Log'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
