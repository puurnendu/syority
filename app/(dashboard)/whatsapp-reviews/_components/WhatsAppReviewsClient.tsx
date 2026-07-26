'use client';

import { useState, useEffect, useCallback } from 'react';

type Update = {
  id: string;
  phone_number: string;
  message_type: 'text' | 'voice';
  raw_message_text: string | null;
  detected_language: string | null;
  extracted_unit: string | null;
  extracted_tag: string | null;
  extracted_description: string | null;
  extracted_progress: number | null;
  confidence_breakdown: Record<
    string,
    { score: number; flag: null | 'amber' | 'red' }
  > | null;
  final_confidence: number | null;
  matched_workpack_id: string | null;
  match_candidates: Array<{
    workpack_id: string;
    workpack_code: string;
    activity_id: string | null;
    activity_desc: string | null;
    db_confidence: number;
  }> | null;
  status: string;
  audio_storage_path: string | null;
  audio_duration_secs: number | null;
  user: { name: string } | null;
  created_at: string;
};

function ConfidenceBar({ score, flag }: { score: number; flag: null | 'amber' | 'red' }) {
  const pct = Math.round(score * 100);
  const col = flag === 'red' ? 'bg-red-500' : flag === 'amber' ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${col}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`text-xs font-mono w-8 text-right ${
          flag === 'red' ? 'text-red-600' : flag === 'amber' ? 'text-amber-600' : 'text-green-700'
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}

export function WhatsAppReviewsClient() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'parked_review' | 'all'>('parked_review');
  const [selected, setSelected] = useState<Update | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [notes, setNotes] = useState('');
  const [overrideActivity, setOverrideActivity] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, today: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/whatsapp/updates?status=${filter}&page_size=50`);
    if (res.ok) {
      const d = await res.json();
      setUpdates(d.data ?? []);
      setCounts({ pending: d.pending_count ?? 0, today: d.today_count ?? 0 });
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function approve() {
    if (!selected) return;
    setReviewing(true);
    const res = await fetch(`/api/whatsapp/updates/${selected.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: overrideActivity ?? undefined, review_notes: notes || undefined }),
    });
    if (res.ok) { setSelected(null); setNotes(''); setOverrideActivity(null); void load(); }
    setReviewing(false);
  }

  async function reject() {
    if (!selected || !notes.trim()) return;
    setReviewing(true);
    const res = await fetch(`/api/whatsapp/updates/${selected.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_notes: notes }),
    });
    if (res.ok) { setSelected(null); setNotes(''); void load(); }
    setReviewing(false);
  }

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* ── LEFT PANEL: list ─────────────────────────────────────────── */}
      <div className="w-96 flex-none bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-sm font-black text-[#0D2137] uppercase tracking-tight">WhatsApp Reviews</h1>
            <button onClick={() => void load()} className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-widest">
              Refresh
            </button>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
              {counts.pending} pending
            </span>
            <span className="text-gray-400 font-medium">{counts.today} today</span>
          </div>
          <div className="flex gap-1 mt-3">
            {(['parked_review', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition-colors uppercase tracking-tight ${
                  filter === f ? 'bg-[#0D2137] text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f === 'parked_review' ? 'Pending Review' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400 text-xs gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              Loading…
            </div>
          )}
          {!loading && updates.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-2xl mb-2">📱</p>
              <p className="text-xs font-bold text-gray-500">No updates to review</p>
            </div>
          )}
          {updates.map((u) => {
            const conf = u.final_confidence ?? 1;
            const isLowConf = conf < 0.7;
            return (
              <button
                key={u.id}
                onClick={() => { setSelected(u); setNotes(''); setOverrideActivity(null); }}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-blue-50 transition-colors ${
                  selected?.id === u.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                } ${isLowConf ? 'border-l-2 border-l-amber-400' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-gray-900">{u.user?.name ?? u.phone_number}</span>
                  <div className="flex items-center gap-1">
                    {u.message_type === 'voice' && <span className="text-[10px]">🎤</span>}
                    <span className="text-[10px] text-gray-400">
                      {new Date(u.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {u.extracted_unit && (
                  <p className="text-[10px] font-bold text-blue-700 mb-0.5">📍 {u.extracted_unit}</p>
                )}
                <p className="text-[10px] text-gray-500 line-clamp-2">{u.raw_message_text ?? '—'}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      u.status === 'parked_review'
                        ? 'bg-amber-100 text-amber-700'
                        : u.status === 'auto_updated'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {u.status.replace('_', ' ')}
                  </span>
                  {u.final_confidence !== null && (
                    <span className={`text-[10px] font-mono font-bold ${isLowConf ? 'text-amber-600' : 'text-gray-400'}`}>
                      {Math.round(conf * 100)}% conf
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL: detail ───────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Detail Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-[#0D2137]">{selected.user?.name ?? selected.phone_number}</h2>
                <p className="text-xs text-gray-500">
                  {selected.phone_number} ·{' '}
                  {new Date(selected.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{selected.detected_language?.toUpperCase() ?? 'EN'}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            {/* Voice note player */}
            {selected.message_type === 'voice' && selected.audio_storage_path && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-black text-gray-600 mb-2">
                  🎤 Voice note{selected.audio_duration_secs ? ` (${selected.audio_duration_secs}s)` : ''}
                </p>
                <audio controls preload="metadata" className="w-full h-8" src={`/api/whatsapp/audio/${selected.id}`}>
                  <source src={`/api/whatsapp/audio/${selected.id}`} type="audio/ogg" />
                </audio>
              </div>
            )}

            {/* Transcript */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5">Transcript</p>
              <p className="text-sm text-blue-900 leading-relaxed">&ldquo;{selected.raw_message_text}&rdquo;</p>
            </div>

            {/* Extracted fields */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Extracted Fields</p>
              <div className="space-y-3">
                {[
                  ['Unit', 'unit_name', selected.extracted_unit],
                  ['Tag', 'equipment_tag', selected.extracted_tag],
                  ['Job', 'job_description', selected.extracted_description],
                  ['Progress', 'progress_percent', selected.extracted_progress !== null ? `${selected.extracted_progress}%` : null],
                ].map(([label, key, val]) => {
                  const cb = selected.confidence_breakdown?.[key as string];
                  return (
                    <div key={key as string} className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-xs text-gray-400 font-bold">{label as string}</span>
                      <span
                        className={`text-sm font-bold ${
                          cb?.flag === 'red' ? 'text-red-700' : cb?.flag === 'amber' ? 'text-amber-700' : 'text-gray-900'
                        }`}
                      >
                        {(val as string) ?? <span className="text-gray-300 italic">—</span>}
                      </span>
                      {cb && <ConfidenceBar score={cb.score} flag={cb.flag} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Match candidates */}
            {selected.match_candidates && selected.match_candidates.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                  Best Match{selected.match_candidates.length > 1 ? ` (${selected.match_candidates.length} candidates)` : ''}
                </p>
                <div className="space-y-2">
                  {selected.match_candidates.slice(0, 4).map((c, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        (overrideActivity ?? selected.match_candidates?.[0]?.activity_id) === c.activity_id
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="activity"
                        checked={(overrideActivity ?? selected.match_candidates?.[0]?.activity_id) === c.activity_id}
                        onChange={() => setOverrideActivity(c.activity_id ?? null)}
                        className="flex-none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-800">{c.workpack_code}</p>
                        <p className="text-[10px] text-gray-400 truncate">{c.activity_desc ?? 'No specific activity'}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-none font-mono">{Math.round(c.db_confidence * 100)}%</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Review notes */}
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                Review Notes
                {selected.status === 'parked_review' ? ' (required to reject)' : ''}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none transition-all"
              />
            </div>

            {/* Actions */}
            {selected.status === 'parked_review' && (
              <div className="flex gap-3">
                <button
                  onClick={() => void approve()}
                  disabled={reviewing}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-black rounded-xl disabled:opacity-40 transition-colors uppercase tracking-tight"
                >
                  {reviewing ? '…' : '✓ Approve'}
                </button>
                <button
                  onClick={() => void reject()}
                  disabled={reviewing || !notes.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-black rounded-xl disabled:opacity-40 transition-colors uppercase tracking-tight"
                >
                  {reviewing ? '…' : '✕ Reject'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm flex-col gap-2">
          <p className="text-3xl">📱</p>
          <p className="font-medium">Select an update to review</p>
        </div>
      )}
    </div>
  );
}
