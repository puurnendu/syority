/**
 * R0.4-D — Event evidence for an Event-less Workpack.
 * Computes classification from existing FKs only.
 * Never infers Event from Project, dates, plant, unit-as-identity, title, or UUID.
 * Does not write. Does not copy Activity Event onto Workpack.
 */
import type {
  Classification,
  EventCandidateView,
  EvidencePath,
  EvidenceStrength,
} from './types';

export function looksNonSto(title?: string | null, number?: string | null): boolean {
  const parts = [title, number].filter(Boolean).join(' ').toLowerCase();
  if (!parts) return false;
  return (
    /\btest\b/.test(parts) ||
    /\bdemo\b/.test(parts) ||
    /\bseed\b/.test(parts) ||
    /\bvalidat/.test(parts) ||
    /\bdummy\b/.test(parts) ||
    /\bobsolete\b/.test(parts) ||
    /\blegacy\b/.test(parts) ||
    /\bsample\b/.test(parts)
  );
}

export function reviewPriority(classification: Classification): 'P0' | 'P1' | 'P2' {
  if (classification === 'CONFLICTING_CHILD_EVENT') return 'P0';
  if (classification === 'INSUFFICIENT' || classification === 'DIRECT' || classification === 'STRONG') {
    return 'P1';
  }
  return 'P2';
}

export interface LinkedEvent {
  eventId: string;
  code: string;
  name: string;
  siteName: string | null;
  plannedStart: Date | string | null;
  plannedEnd: Date | string | null;
  status: string;
  orgMatch: boolean;
}

export interface EvidenceInput {
  title: string;
  workpackNumber: string | null;
  scopeItemEvents: LinkedEvent[];
  instantiationEvents: LinkedEvent[];
  activityEvents: Array<LinkedEvent & { activityLabel: string }>;
  baselineEvents: LinkedEvent[];
  unitEvents: LinkedEvent[];
  systemEvents: LinkedEvent[];
  assetScopeEvents: LinkedEvent[];
}

function uniq(events: LinkedEvent[]): LinkedEvent[] {
  const map = new Map<string, LinkedEvent>();
  for (const e of events) {
    if (!e.eventId || !e.orgMatch) continue;
    if (!map.has(e.eventId)) map.set(e.eventId, e);
  }
  return [...map.values()];
}

function pathStatus(events: LinkedEvent[]): { status: EvidencePath['status']; codes: string[] } {
  const u = uniq(events);
  if (u.length === 0) return { status: 'NOT_FOUND', codes: [] };
  if (u.length > 1) return { status: 'CONFLICTING', codes: u.map((e) => e.code) };
  return { status: 'FOUND', codes: [u[0].code] };
}

export function classifyEvidence(input: EvidenceInput): {
  classification: Classification;
  category: string;
  candidates: EventCandidateView[];
  paths: EvidencePath[];
  conflictingEventIds: string[];
} {
  const scope = uniq(input.scopeItemEvents);
  const inst = uniq(input.instantiationEvents);
  const acts = uniq(input.activityEvents);
  const bases = uniq(input.baselineEvents);
  const units = uniq(input.unitEvents);
  const systems = uniq(input.systemEvents);
  const assets = uniq(input.assetScopeEvents);

  const governed = new Map<string, { event: LinkedEvent; sources: string[]; activityRefs: string[] }>();
  const add = (list: LinkedEvent[], source: string) => {
    for (const e of list) {
      if (!governed.has(e.eventId)) {
        governed.set(e.eventId, { event: e, sources: [], activityRefs: [] });
      }
      governed.get(e.eventId)!.sources.push(source);
    }
  };
  add(scope, 'SCOPE');
  add(inst, 'INSTANTIATION');
  add(acts, 'ACTIVITY');
  add(bases, 'BASELINE');
  for (const a of input.activityEvents) {
    if (!a.orgMatch || !a.eventId) continue;
    governed.get(a.eventId)?.activityRefs.push(a.activityLabel);
  }

  const weak = new Map<string, { event: LinkedEvent; sources: string[] }>();
  const addW = (list: LinkedEvent[], source: string) => {
    for (const e of list) {
      if (!weak.has(e.eventId)) weak.set(e.eventId, { event: e, sources: [] });
      weak.get(e.eventId)!.sources.push(source);
    }
  };
  addW(units, 'EVENT_UNIT');
  addW(systems, 'EVENT_SYSTEM');
  addW(assets, 'ASSET_SCOPE_ITEM');

  const governedIds = [...governed.keys()];
  const weakOnlyIds = [...weak.keys()].filter((id) => !governed.has(id));
  const conflictingChild = acts.length > 1;
  const conflictingGoverned = governedIds.length > 1;

  let classification: Classification;
  let category: string;
  if (conflictingChild || conflictingGoverned) {
    classification = 'CONFLICTING_CHILD_EVENT';
    category = 'MULTIPLE_EVENTS';
  } else if (scope.length === 1 || inst.length === 1) {
    classification = 'DIRECT';
    category = 'DIRECT_SINGLE_EVENT';
  } else if (governedIds.length === 1) {
    classification = 'STRONG';
    category = 'MULTI_SOURCE_CONVERGENCE';
  } else if (weakOnlyIds.length > 1) {
    classification = 'AMBIGUOUS';
    category = 'MULTIPLE_EVENTS';
  } else if (weakOnlyIds.length === 1) {
    classification = 'WEAK';
    category = 'SINGLE_WEAK_HINT';
  } else if (looksNonSto(input.title, input.workpackNumber)) {
    classification = 'NON_STO';
    category = 'NON_STO';
  } else {
    classification = 'INSUFFICIENT';
    category = 'NO_EVENT_EVIDENCE';
  }

  const candidates: EventCandidateView[] = [];
  for (const [id, g] of governed) {
    const w = weak.get(id);
    const strength: EvidenceStrength =
      g.sources.includes('SCOPE') || g.sources.includes('INSTANTIATION') ? 'DIRECT' : 'STRONG';
    candidates.push({
      eventId: id,
      code: g.event.code,
      name: g.event.name,
      siteName: g.event.siteName,
      plannedStart: g.event.plannedStart,
      plannedEnd: g.event.plannedEnd,
      status: g.event.status,
      sources: [...g.sources, ...(w?.sources ?? [])],
      strength,
      activityRefs: [...new Set(g.activityRefs)],
    });
  }
  for (const [id, w] of weak) {
    if (governed.has(id)) continue;
    candidates.push({
      eventId: id,
      code: w.event.code,
      name: w.event.name,
      siteName: w.event.siteName,
      plannedStart: w.event.plannedStart,
      plannedEnd: w.event.plannedEnd,
      status: w.event.status,
      sources: w.sources,
      strength: 'WEAK',
      activityRefs: [],
    });
  }

  const paths: EvidencePath[] = [
    { key: 'scope', label: 'Scope item → Shutdown scope → Event', ...toPath(scope, 'Scope') },
    { key: 'instantiation', label: 'Workpack instantiation → Event', ...toPath(inst, 'Instantiation') },
    { key: 'activity', label: 'Activities → Event', ...toPath(acts, 'Activity') },
    { key: 'baseline', label: 'Baseline activity → Schedule baseline → Event', ...toPath(bases, 'Baseline') },
    { key: 'unit', label: 'Unit → Event unit → Event', ...toPath(units, 'Unit') },
    { key: 'system', label: 'System → Event system → Event', ...toPath(systems, 'System') },
    { key: 'asset_scope', label: 'Equipment → Scope item → Event', ...toPath(assets, 'Equipment scope') },
  ];

  return {
    classification,
    category,
    candidates,
    paths,
    conflictingEventIds: conflictingChild || conflictingGoverned ? governedIds : [],
  };
}

function toPath(events: LinkedEvent[], label: string): Pick<EvidencePath, 'status' | 'eventCodes' | 'detail'> {
  const p = pathStatus(events);
  if (p.status === 'NOT_FOUND') return { status: p.status, eventCodes: [], detail: `${label} path not found` };
  if (p.status === 'CONFLICTING') {
    return { status: p.status, eventCodes: p.codes, detail: `${label} path points at more than one Event` };
  }
  return { status: p.status, eventCodes: p.codes, detail: `${label} path found` };
}

export function displayReviewState(
  persisted: string | null | undefined,
  classification: Classification
): string {
  if (persisted && persisted !== 'UNREVIEWED') return persisted;
  if (classification === 'CONFLICTING_CHILD_EVENT') return 'UNREVIEWED';
  if (
    classification === 'DIRECT' ||
    classification === 'STRONG' ||
    classification === 'WEAK' ||
    classification === 'AMBIGUOUS'
  ) {
    return 'CANDIDATE';
  }
  return 'UNREVIEWED';
}
