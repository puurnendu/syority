'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';

type Rec = {
  recommendationId: string;
  category: string;
  priority: string;
  title: string;
  problem: string;
  implication: string;
  recommendation: string;
  rationale: string;
  expectedConsequence: string;
  calculationType: string;
  status: string;
  affectedEntities: Array<{ entityType: string; entityId: string; label?: string }>;
  evidence: Array<{ layer: string; metric: string; value: unknown; sourceAuthority: string; unit?: string }>;
};

type Bundle = {
  recommendations: Rec[];
  completeness: {
    readinessComplete: boolean;
    exceptionsTruncated: boolean;
    recommendationsTruncated: boolean;
    recommendationsReturned: number;
  };
  asOf: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load management intelligence');
  return res.json();
};

const LAYER_STYLE: Record<string, string> = {
  FACT: 'bg-slate-100 text-slate-800',
  CALCULATION: 'bg-blue-100 text-blue-800',
  INTELLIGENCE: 'bg-violet-100 text-violet-800',
  RECOMMENDATION: 'bg-amber-100 text-amber-900',
  SCENARIO: 'bg-emerald-100 text-emerald-800',
};

export function ManagementIntelligencePanel({ eventId }: { eventId: string }) {
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [whatIfKind, setWhatIfKind] = useState('DURATION_SLIP');
  const [activityId, setActivityId] = useState('');
  const [slipHours, setSlipHours] = useState('12');
  const [durationHours, setDurationHours] = useState('8');
  const [delayDays, setDelayDays] = useState('1');
  const [whatIfResult, setWhatIfResult] = useState<string>('');
  const [whatIfBusy, setWhatIfBusy] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [rationaleById, setRationaleById] = useState<Record<string, string>>({});

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (priority) p.set('priority', priority);
    if (category) p.set('category', category);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [priority, category]);

  const { data, error, isLoading, mutate } = useSWR<{ data: Bundle }>(
    `/api/events/${eventId}/management/recommendations${qs}`,
    fetcher
  );
  const { data: decisionBundle, mutate: mutateDecisions } = useSWR<{
    data: Array<{ decisionId: string; decision: string; recommendationId: string; decidedAt: string; authorizesExecution: boolean }>;
  }>(`/api/events/${eventId}/management/decisions`, fetcher);

  const bundle = data?.data;

  async function runWhatIf(e: React.FormEvent) {
    e.preventDefault();
    setWhatIfBusy(true);
    setWhatIfResult('');
    try {
      const res = await fetch(`/api/events/${eventId}/management/what-if`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: whatIfKind,
          activityId: activityId || undefined,
          ...(whatIfKind === 'DURATION_SLIP' ? { slipHours: Number(slipHours) } : {}),
          ...(whatIfKind === 'DURATION_CHANGE' ? { durationHours: Number(durationHours) } : {}),
          ...(whatIfKind === 'DELAYED_START' ? { delayDays: Number(delayDays) } : {}),
        }),
      });
      const json = await res.json();
      setWhatIfResult(JSON.stringify(json.data ?? json, null, 2));
    } catch (err: any) {
      setWhatIfResult(err.message || 'What-if failed');
    } finally {
      setWhatIfBusy(false);
    }
  }

  async function recordDecision(recommendationId: string, decision: string) {
    setDecisionNote('');
    try {
      const res = await fetch(`/api/events/${eventId}/management/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId,
          decision,
          rationale: rationaleById[recommendationId] || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDecisionNote(json.error || 'Decision was not recorded');
        return;
      }
      setDecisionNote(
        `${json.data.decision} recorded. authorizesExecution=${json.data.authorizesExecution}. This is not M12 execution.`
      );
      await mutate();
      await mutateDecisions();
    } catch (err: any) {
      setDecisionNote(err.message || 'Decision failed');
    }
  }

  if (isLoading) {
    return <div className="text-sm text-gray-500 animate-pulse">Loading management recommendations…</div>;
  }
  if (error || !bundle) {
    return <div className="text-sm text-red-600">Failed to load M15 recommendations.</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Executive summary</h2>
        <p className="mt-2 text-sm text-gray-600">
          {bundle.recommendations.length} advisory recommendations as of {bundle.asOf}. This is M15 decision
          intelligence, not the M13 Control Tower dashboard and not an execution command.
        </p>
        <ul className="mt-3 text-xs text-gray-500 space-y-1">
          <li>Readiness coverage complete: {String(bundle.completeness.readinessComplete)}</li>
          <li>Exceptions truncated: {String(bundle.completeness.exceptionsTruncated)}</li>
          <li>Recommendations truncated: {String(bundle.completeness.recommendationsTruncated)}</li>
        </ul>
        {decisionNote && <p className="mt-2 text-sm text-violet-800">{decisionNote}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.keys(LAYER_STYLE).map((layer) => (
            <span key={layer} className={`px-2 py-0.5 rounded ${LAYER_STYLE[layer]}`}>
              {layer}
            </span>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All priorities</option>
          <option>CRITICAL</option>
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All categories</option>
          <option>SCHEDULE</option>
          <option>RESOURCE</option>
          <option>READINESS</option>
          <option>CONSTRAINT</option>
          <option>EXECUTION</option>
        </select>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">Top management concerns</h2>
        <div className="mt-4 space-y-4">
          {bundle.recommendations.map((rec) => (
            <article key={rec.recommendationId} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded ${LAYER_STYLE.RECOMMENDATION}`}>{rec.calculationType}</span>
                <span className="px-2 py-0.5 rounded bg-gray-100">{rec.priority}</span>
                <span className="px-2 py-0.5 rounded bg-gray-100">{rec.category}</span>
                <span className="px-2 py-0.5 rounded bg-gray-100">{rec.status}</span>
              </div>
              <h3 className="mt-2 font-medium text-gray-900">{rec.title}</h3>
              <dl className="mt-3 space-y-2 text-sm text-gray-700">
                <div>
                  <dt className="font-semibold">Problem</dt>
                  <dd>{rec.problem}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Why it matters</dt>
                  <dd>{rec.implication}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Consider (not an execution order)</dt>
                  <dd>{rec.recommendation}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Forecast consequence</dt>
                  <dd>{rec.expectedConsequence}</dd>
                </div>
                {rec.affectedEntities?.length > 0 && (
                  <div>
                    <dt className="font-semibold">Affected entities</dt>
                    <dd>
                      {rec.affectedEntities
                        .map((e) => `${e.entityType}:${e.label || e.entityId}`)
                        .join(', ')}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-3">
                <h4 className="text-xs font-semibold uppercase text-gray-500">Evidence</h4>
                <ul className="mt-1 space-y-1">
                  {rec.evidence.slice(0, 8).map((ev, i) => (
                    <li key={i} className="text-xs text-gray-600">
                      <span className={`mr-1 px-1 rounded ${LAYER_STYLE[ev.layer] || LAYER_STYLE.FACT}`}>
                        {ev.layer}
                      </span>
                      {ev.sourceAuthority} {ev.metric}={String(ev.value)}
                      {ev.unit ? ` ${ev.unit}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 border-t pt-3">
                <h4 className="text-xs font-semibold uppercase text-gray-500">Management decision</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Recording a decision is not execution. M15 will not start, release, or mutate the activity.
                </p>
                <textarea
                  value={rationaleById[rec.recommendationId] || ''}
                  onChange={(e) =>
                    setRationaleById((prev) => ({ ...prev, [rec.recommendationId]: e.target.value }))
                  }
                  className="mt-2 w-full border rounded p-2 text-sm"
                  rows={2}
                  placeholder="Decision rationale"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {['ACCEPT', 'REJECT', 'DEFER', 'REQUEST_MORE_INFORMATION'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => recordDecision(rec.recommendationId, d)}
                      className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50"
                    >
                      {d.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Execution handoff: ask M16 to START/RELEASE the named activity. Authorization, readiness,
                  confirmation, and M12 EWS are independent of this recommendation.
                </p>
              </div>
            </article>
          ))}
          {bundle.recommendations.length === 0 && (
            <p className="text-sm text-gray-500">No advisory recommendations for this filter.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          What-if <span className={`ml-2 text-xs px-2 py-0.5 rounded ${LAYER_STYLE.SCENARIO}`}>SCENARIO</span>
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Hypothetical only. Does not mutate live Activity, baseline, or call EWS / leveling apply.
          Unsupported kinds return NOT_SUPPORTED.
        </p>
        <form onSubmit={runWhatIf} className="mt-3 flex flex-wrap gap-2 items-end text-sm">
          <label className="flex flex-col">
            Kind
            <select
              value={whatIfKind}
              onChange={(e) => setWhatIfKind(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="DURATION_SLIP">DURATION_SLIP</option>
              <option value="DURATION_CHANGE">DURATION_CHANGE</option>
              <option value="DELAYED_START">DELAYED_START</option>
              <option value="RESOURCE_LEVELING_SIMULATION">RESOURCE_LEVELING_SIMULATION</option>
              <option value="ADDITIONAL_CREWS">ADDITIONAL_CREWS (expect NOT_SUPPORTED)</option>
              <option value="CONSTRAINT_REMOVAL">CONSTRAINT_REMOVAL (expect NOT_SUPPORTED)</option>
              <option value="SCOPE_CHANGE">SCOPE_CHANGE (expect NOT_SUPPORTED)</option>
            </select>
          </label>
          <label className="flex flex-col">
            Activity id
            <input
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="border rounded px-2 py-1 w-64"
              placeholder="UUID"
            />
          </label>
          {whatIfKind === 'DURATION_SLIP' && (
            <label className="flex flex-col">
              Slip hours
              <input
                value={slipHours}
                onChange={(e) => setSlipHours(e.target.value)}
                className="border rounded px-2 py-1 w-24"
              />
            </label>
          )}
          {whatIfKind === 'DURATION_CHANGE' && (
            <label className="flex flex-col">
              Duration hours
              <input
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="border rounded px-2 py-1 w-24"
              />
            </label>
          )}
          {whatIfKind === 'DELAYED_START' && (
            <label className="flex flex-col">
              Delay days
              <input
                value={delayDays}
                onChange={(e) => setDelayDays(e.target.value)}
                className="border rounded px-2 py-1 w-24"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={whatIfBusy}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white disabled:opacity-50"
          >
            {whatIfBusy ? 'Running…' : 'Run hypothetical'}
          </button>
        </form>
        {whatIfResult && (
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-gray-800">Scenario comparison (hypothetical)</h3>
            <pre className="mt-1 max-h-80 overflow-auto text-xs bg-white border rounded p-2">{whatIfResult}</pre>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Decision history</h2>
        <p className="mt-1 text-xs text-gray-500">
          Append-only journal. These rows do not authorize or perform execution.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(decisionBundle?.data ?? []).map((d) => (
            <li key={d.decisionId} className="text-gray-700">
              <span className="font-medium">{d.decision}</span> at {d.decidedAt} — {d.recommendationId}{' '}
              <span className="text-xs text-gray-500">authorizesExecution={String(d.authorizesExecution)}</span>
            </li>
          ))}
          {(decisionBundle?.data ?? []).length === 0 && (
            <li className="text-gray-500">No management decisions recorded for this event.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
