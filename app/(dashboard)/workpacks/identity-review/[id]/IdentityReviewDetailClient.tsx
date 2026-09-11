'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Detail = {
  workpack_id: string;
  classification: string;
  review_state: string;
  version: number;
  identity: Record<string, unknown>;
  paths: { key: string; label: string; status: string; eventCodes: string[]; detail: string }[];
  candidates: {
    eventId: string;
    code: string;
    name: string;
    siteName: string | null;
    plannedStart: string | null;
    plannedEnd: string | null;
    status: string;
    sources: string[];
    strength: string;
    activityRefs: string[];
  }[];
  conflicting_event_ids: string[];
  permissions: { canAssign: boolean; canQuarantine: boolean; canResolveConflict: boolean; canRollback: boolean };
  assign_blocked: boolean;
  org_events: { id: string; code: string; name: string; status: string; site_name: string | null }[];
  history: { event: string; decision: string; reason: string; when: string; who: string }[];
};

export default function IdentityReviewDetailClient({ workpackId }: { workpackId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventId, setEventId] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [conflict, setConflict] = useState(false);

  const load = () => {
    fetch(`/api/workpacks/${workpackId}/identity-review`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j.data);
      })
      .catch(() => setError('Unable to load review'));
  };

  useEffect(load, [workpackId]);

  const apply = async (decision: string, extra: Record<string, unknown> = {}) => {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/workpacks/${workpackId}/identity-review/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        confirm,
        eventId: eventId || null,
        reason,
        evidence,
        expected_version: data?.version ?? 0,
        conflict_resolution: conflict,
        ...extra,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || 'Request failed');
      return;
    }
    setMessage(j.data?.applied ? 'Event assigned and audited.' : `Review updated: ${j.data?.review_state || decision}`);
    if (j.data?.child_mismatches?.length) {
      setMessage((m) => `${m} Child Event mismatches were reported and not rewritten.`);
    }
    load();
  };

  if (!data && !error) return <div className="p-6 text-sm text-gray-500">Loading Event review…</div>;
  if (!data) return <div className="p-6 text-sm text-red-600">{error}</div>;

  const isConflict = data.classification === 'CONFLICTING_CHILD_EVENT';
  const isNonSto = data.classification === 'NON_STO';
  const isInsufficient = data.classification === 'INSUFFICIENT';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Link href="/workpacks/identity-review" className="text-sm text-blue-700 hover:underline">← Event Review queue</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Event Review</h1>
        <p className="text-sm text-gray-500">Classification: {data.classification} · Review: {data.review_state}</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <section className="bg-white shadow rounded-lg p-4">
        <h2 className="font-semibold mb-3">Identity</h2>
        <dl className="grid md:grid-cols-2 gap-2 text-sm">
          {Object.entries(data.identity).map(([k, v]) => (
            <div key={k}><dt className="text-gray-500">{k}</dt><dd className="text-gray-900">{String(v)}</dd></div>
          ))}
        </dl>
      </section>

      <section className="bg-white shadow rounded-lg p-4">
        <h2 className="font-semibold mb-3">Event evidence</h2>
        <ul className="space-y-2 text-sm">
          {data.paths.map((p) => (
            <li key={p.key}>
              <span className="font-medium">{p.label}:</span>{' '}
              <span className={p.status === 'CONFLICTING' ? 'text-red-700' : p.status === 'FOUND' ? 'text-green-700' : 'text-gray-500'}>
                {p.status}
              </span>
              {p.eventCodes.length > 0 && <span> — {p.eventCodes.join(', ')}</span>}
              <div className="text-gray-500">{p.detail}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white shadow rounded-lg p-4">
        <h2 className="font-semibold mb-3">Candidate Events</h2>
        <p className="text-xs text-gray-500 mb-2">Candidate is not an assignment. No Event is pre-selected as authoritative.</p>
        {data.candidates.length === 0 ? (
          <p className="text-sm text-gray-600">{isInsufficient ? 'INSUFFICIENT DATA — no Event candidate.' : isNonSto ? 'NON-STO CANDIDATE — no Event candidate.' : 'No governed Event candidate.'}</p>
        ) : data.candidates.map((c) => (
          <div key={c.eventId} className="border rounded p-3 mb-2 text-sm">
            <div className="font-medium">{c.code} — {c.name} <span className="text-gray-500">({c.strength})</span></div>
            <div className="text-gray-500">Site {c.siteName || '—'} · {c.status}</div>
            <div>Evidence: {c.sources.join(', ')}</div>
            {c.activityRefs.map((a) => <div key={a}>✓ Activity {a}</div>)}
            {isConflict && <div className="text-red-700 mt-1">⚠ Other children belong to different Events</div>}
          </div>
        ))}
      </section>

      {isConflict && (
        <section className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-red-800">CONFLICTING CHILD EVENTS</h2>
          <p className="text-sm text-red-700 mt-1">Normal Event assignment is blocked. Review the conflict explicitly. Approval is required.</p>
        </section>
      )}

      <section className="bg-white shadow rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Human decision</h2>
        {!isNonSto && (
          <label className="block text-sm">
            Event
            <select className="border rounded w-full mt-1 px-2 py-1" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Select a Turnaround / Event</option>
              {data.org_events.map((e) => (
                <option key={e.id} value={e.id}>{e.code} — {e.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">Reason
          <textarea className="border rounded w-full mt-1 px-2 py-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <label className="block text-sm">Evidence
          <textarea className="border rounded w-full mt-1 px-2 py-1" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          I confirm this human decision
        </label>
        {isConflict && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={conflict} onChange={(e) => setConflict(e.target.checked)} />
            I explicitly resolve the identity conflict
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          {isConflict ? (
            <button className="px-3 py-2 bg-red-700 text-white rounded text-sm" disabled={!data.permissions.canResolveConflict} onClick={() => apply('ASSIGN')}>
              Review Conflict
            </button>
          ) : isNonSto ? null : (
            <button className="px-3 py-2 bg-blue-700 text-white rounded text-sm" disabled={!data.permissions.canAssign} onClick={() => apply('ASSIGN')}>
              Assign to Event
            </button>
          )}
          {(isInsufficient || isNonSto || isConflict) && (
            <button className="px-3 py-2 bg-gray-800 text-white rounded text-sm" disabled={!data.permissions.canQuarantine} onClick={() => apply('QUARANTINE')}>
              {isNonSto ? 'Quarantine Review' : 'Quarantine'}
            </button>
          )}
          {isInsufficient && (
            <button className="px-3 py-2 border rounded text-sm" onClick={() => apply('DEFER')}>Defer</button>
          )}
          {data.permissions.canRollback && data.review_state === 'APPLIED' && (
            <button className="px-3 py-2 border rounded text-sm" onClick={() => apply('ROLLBACK')}>Rollback assignment</button>
          )}
        </div>
      </section>

      {data.history.length > 0 && (
        <section className="bg-white shadow rounded-lg p-4">
          <h2 className="font-semibold mb-2">Review history</h2>
          <ul className="text-sm space-y-1">
            {data.history.map((h, i) => (
              <li key={i}>{h.decision || h.event} — {h.reason} — {h.when ? String(h.when) : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
