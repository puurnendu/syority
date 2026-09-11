'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import MaintainBaselinesModal from './MaintainBaselinesModal';
import AssignBaselinesModal from './AssignBaselinesModal';
import WbsView from './WbsView';
import DateTimePicker from './DateTimePicker';
import { ResourceHistogram } from './ResourceHistogram';
import { SCurveChart as ProjectSCurveChart } from '@/components/Dashboard/SCurveChart';
import { LayoutGrid, FolderTree, ChevronDown, Settings, Clock, Calendar, Check } from 'lucide-react';
import { mapGridFieldToExecution } from '@/core/execution/executionFieldGuard';
import { PlannedDateOverrideDialog } from './PlannedDateOverrideDialog';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ── Column definitions ────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'activity_number', label: 'ID',           width: 90,  sortable: true,  default: true  },
  { key: 'description',     label: 'Activity Name', width: 320, sortable: true,  default: true  },
  { key: 'status',          label: 'Status',        width: 110, sortable: true,  default: true  },
  { key: 'discipline',      label: 'Discipline',    width: 120, sortable: true,  default: true  },
  { key: 'planned_start',   label: 'Start',         width: 120, sortable: true,  default: true  },
  { key: 'planned_end',     label: 'Finish',        width: 120, sortable: true,  default: true  },
  { key: 'actual_start',    label: 'Actual Start',  width: 120, sortable: true,  default: false },
  { key: 'actual_end',      label: 'Actual Finish', width: 120, sortable: true,  default: false },
  { key: 'duration_hours',  label: 'Duration (h)',  width: 100, sortable: true,  default: true  },
  { key: 'actual_duration', label: 'Actual Dur (h)',width: 100, sortable: true,  default: false },
  { key: 'remaining_duration', label: 'Rem. Dur (h)', width: 100, sortable: true, default: false },
  { key: 'progress_percent',label: '% Complete',   width: 100, sortable: true,  default: true  },
  { key: 'baseline_start',  label: 'BL Start',      width: 120, sortable: true,  default: false },
  { key: 'baseline_end',    label: 'BL Finish',     width: 120, sortable: true,  default: false },
  { key: 'baseline_duration', label: 'BL Dur (h)',  width: 100, sortable: true,  default: false },
  { key: 'variance_start',  label: 'Var Start (d)', width: 100, sortable: true,  default: false },
  { key: 'variance_finish', label: 'Var Finish (d)', width: 100, sortable: true,  default: false },
  { key: 'variance_duration', label: 'Var Dur (h)', width: 100, sortable: true,  default: false },
  { key: 'physical_percent_complete', label: 'Physical %', width: 100, sortable: true, default: false },
  { key: 'duration_percent_complete', label: 'Duration %', width: 100, sortable: true, default: false },
  { key: 'unit_percent_complete',     label: 'Unit %',     width: 100, sortable: true, default: false },
  { key: 'total_float',     label: 'Total Float',   width: 90,  sortable: true,  default: false },
  { key: 'free_float',      label: 'Free Float',    width: 90,  sortable: true,  default: false },
  { key: 'is_critical',     label: 'Critical',      width: 80,  sortable: true,  default: false },
  { key: 'early_start',     label: 'Early Start',   width: 110, sortable: true,  default: false },
  { key: 'early_finish',    label: 'Early Finish',  width: 110, sortable: true,  default: false },
  { key: 'late_start',      label: 'Late Start',    width: 110, sortable: true,  default: false },
  { key: 'late_finish',     label: 'Late Finish',   width: 110, sortable: true,  default: false },
  { key: 'sequence_number', label: 'Seq',           width: 70,  sortable: true,  default: true  },
  { key: 'crew_size',       label: 'Crew',          width: 70,  sortable: true,  default: true  },
  { key: 'responsible',     label: 'Responsible',   width: 140, sortable: true,  default: true  },
  { key: 'workpack',        label: 'Workpack',      width: 180, sortable: true,  default: true  },
  { key: 'notes',           label: 'Notes',         width: 200, sortable: false, default: false },
] as const;

type ColKey = typeof ALL_COLUMNS[number]['key'];

// ── Status badge ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  not_started:  { bg: '#f3f4f6', text: '#374151' },
  in_progress:  { bg: '#dbeafe', text: '#1d4ed8' },
  completed:    { bg: '#d1fae5', text: '#065f46' },
  on_hold:      { bg: '#fef3c7', text: '#92400e' },
  cancelled:    { bg: '#fee2e2', text: '#991b1b' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.not_started;
  return (
    <span
      style={{ background: c.bg, color: c.text }}
      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
    >
      {status?.replace(/_/g, ' ') || '—'}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? '#10b981' : '#3b82f6',
          }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-7 text-right tabular-nums">{pct}%</span>
    </div>
  );
}


// ── Timezone options ──────────────────────────────────────────────────────────
const TIMEZONES = [
  { label: 'Browser Local (auto-detect)', value: 'local'                },
  { label: 'UTC / GMT (±0)',              value: 'UTC'                  },
  { label: 'London (±0/+1)',             value: 'Europe/London'        },
  { label: 'Paris, Berlin (+1/+2)',      value: 'Europe/Paris'         },
  { label: 'Riyadh, Kuwait (+3)',        value: 'Asia/Riyadh'          },
  { label: 'Dubai, Abu Dhabi (+4)',      value: 'Asia/Dubai'           },
  { label: 'Karachi (+5)',               value: 'Asia/Karachi'         },
  { label: 'India IST (+5:30)',          value: 'Asia/Kolkata'         },
  { label: 'Dhaka (+6)',                 value: 'Asia/Dhaka'           },
  { label: 'Bangkok, Jakarta (+7)',      value: 'Asia/Bangkok'         },
  { label: 'Singapore, KL (+8)',         value: 'Asia/Singapore'       },
  { label: 'Tokyo (+9)',                 value: 'Asia/Tokyo'           },
  { label: 'Sydney (+10/+11)',           value: 'Australia/Sydney'     },
  { label: 'New York (−5/−4)',           value: 'America/New_York'     },
  { label: 'Chicago (−6/−5)',            value: 'America/Chicago'      },
  { label: 'Denver (−7/−6)',             value: 'America/Denver'       },
  { label: 'Los Angeles (−8/−7)',        value: 'America/Los_Angeles'  },
] as const;
type SiteTz = typeof TIMEZONES[number]['value'];

/**
 * Decompose a UTC/ISO datetime into the date/time components as seen in a
 * given IANA timezone (or the browser's local timezone when tz === 'local').
 */
function getPartsInTz(isoOrDate: string | Date, tz: SiteTz) {
  const d   = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const res = tz === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;
  try {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: res,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).reduce((acc, x) => ({ ...acc, [x.type]: x.value }), {} as Record<string, string>);
    return {
      year:   parseInt(p.year,   10),
      month:  parseInt(p.month,  10) - 1,   // 0-indexed
      day:    parseInt(p.day,    10),
      hour:   parseInt(p.hour === '24' ? '0' : p.hour,   10),
      minute: parseInt(p.minute, 10),
    };
  } catch {
    // Fallback: UTC
    return {
      year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(),
      hour: d.getUTCHours(),    minute: d.getUTCMinutes(),
    };
  }
}

function fmtDate(d: string | null | undefined, prefs: any, tz: SiteTz): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const p   = getPartsInTz(dt, tz);
  
  const config = prefs?.dates || {
    dateFormat: 'DMY', timeFormat: 'none', timeShowMinutes: true,
    dateOpt4Digit: false, dateOptMonthName: true, dateOptLeadingZero: true, dateSeparator: '-'
  };

  const dy  = config.dateOptLeadingZero ? String(p.day).padStart(2, '0') : String(p.day);
  const moNum = config.dateOptLeadingZero ? String(p.month + 1).padStart(2, '0') : String(p.month + 1);
  const monName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][p.month];
  const mo = config.dateOptMonthName ? monName : moNum;
  
  const yrFull = String(p.year);
  const yrShort = yrFull.slice(2);
  const yr = config.dateOpt4Digit ? yrFull : yrShort;

  let sep = config.dateSeparator || '-';

  let dateStr = '';
  if (config.dateFormat === 'MDY') dateStr = `${mo}${sep}${dy}${sep}${yr}`;
  else if (config.dateFormat === 'DMY') dateStr = `${dy}${sep}${mo}${sep}${yr}`;
  else if (config.dateFormat === 'YMD') dateStr = `${yr}${sep}${mo}${sep}${dy}`;

  if (config.timeFormat === 'none') return dateStr;

  let hh = p.hour;
  let ampm = '';
  if (config.timeFormat === '12h') {
    ampm = hh >= 12 ? ' PM' : ' AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
  }
  
  const hhStr = String(hh).padStart(2, '0');
  
  if (config.timeShowMinutes) {
    const mmStr = String(p.minute).padStart(2, '0');
    return `${dateStr} ${hhStr}:${mmStr}${ampm}`;
  } else {
    return `${dateStr} ${hhStr}${ampm}`;
  }
}


// ── Natural date parser (Excel-style) ────────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/** Parse a time-suffix like "8am", "8:30pm", "14:30", "8 am" → {hour, minute} */
function parseTimeToken(s: string): { hour: number; minute: number } | null {
  // 12-hour with minutes: "8:30am"  "8:30 pm"
  let m = s.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (m) {
    let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    if (m[3].toLowerCase() === 'pm' && h < 12) h += 12;
    if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
    return { hour: h, minute: min };
  }
  // 24-hour: "14:30" (no am/pm following)
  m = s.match(/(\d{1,2}):(\d{2})(?!\s*[ap]m)/i);
  if (m) return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
  // 12-hour no minutes: "8am"  "8 am"  "2pm"
  m = s.match(/(\d{1,2})\s*(am|pm)/i);
  if (m) {
    let h = parseInt(m[1], 10);
    if (m[2].toLowerCase() === 'pm' && h < 12) h += 12;
    if (m[2].toLowerCase() === 'am' && h === 12) h = 0;
    return { hour: h, minute: 0 };
  }
  return null;
}

/**
 * Parse natural-language date strings (like Excel auto-complete).
 * Returns a UTC ISO string, or null if the input cannot be parsed.
 *
 * @param input       The raw text the user typed
 * @param currentYear The year to use when the user omits a year (in site TZ)
 */
function parseNaturalDate(input: string, currentYear: number): string | null {
  const s  = input.trim();
  if (!s) return null;
  const sl = s.toLowerCase();

  // ── Already ISO-ish ───────────────────────────────────────────────────────
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
      // "YYYY-MM-DD HH:mm" → treat as UTC
      const d = new Date(s.replace(' ', 'T') + ':00.000Z');
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(s.includes('T') ? s : `${s}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // ── Build ISO from parts — always UTC midnight (fields are @db.Date, no time stored) ────
  const mkISO = (yr: number, mo: number, dy: number) => {
    const Y = String(yr).padStart(4, '0');
    const M = String(mo + 1).padStart(2, '0');
    const D = String(dy).padStart(2, '0');
    return `${Y}-${M}-${D}T00:00:00.000Z`;
  };

  // ── Strip time tokens from input so they don’t confuse date parsing ──────────

  // Remove the time token from the string so date parsing is cleaner
  let datePart = sl
    .replace(/(\d{1,2}):(\d{2})\s*(am|pm)?/gi, '')   // 14:30, 8:30am
    .replace(/(\d{1,2})\s*(am|pm)/gi, '')              // 8am, 2 pm
    .replace(/\s+/g, ' ')
    .trim();

  // ── Month-name patterns ───────────────────────────────────────────────────
  // Iterate longest names first to avoid "mar" matching inside "march"
  const monthEntries = Object.entries(MONTH_MAP).sort((a, b) => b[0].length - a[0].length);

  for (const [name, moIdx] of monthEntries) {
    // Match whole word
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (!re.test(datePart)) continue;

    const rem  = datePart.replace(re, '').replace(/\s+/g, ' ').trim();
    const nums = rem.match(/\d+/g)?.map(Number) ?? [];

    if (nums.length === 0) {
      // Just "apr" → 1st of April, current year
      return mkISO(currentYear, moIdx, 1);
    }

    if (nums.length === 1) {
      const n = nums[0];
      if (n >= 1 && n <= 31) return mkISO(currentYear, moIdx, n);
      // Large number = year only (e.g., "apr 2026")
      const yr = n < 100 ? 2000 + n : n;
      return mkISO(yr, moIdx, 1);
    }

    // Two numbers: day + year
    const [a, b] = nums;
    if (a > 31) {
      // a is a year
      return mkISO(a < 100 ? 2000 + a : a, moIdx, b);
    }
    if (b > 31) {
      // b is a year
      return mkISO(b < 100 ? 2000 + b : b, moIdx, a);
    }
    // Both ≤ 31: first = day, second = 2-digit year
    return mkISO(2000 + b, moIdx, a);
  }

  // ── Numeric DD/MM[/YY[YY]] ────────────────────────────────────────────────
  const slashM = datePart.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (slashM) {
    const day   = parseInt(slashM[1], 10);
    const month = parseInt(slashM[2], 10) - 1;
    let   year  = slashM[3] ? parseInt(slashM[3], 10) : currentYear;
    if (year < 100) year += 2000;
    return mkISO(year, month, day);
  }

  // ── Fallback: browser Date.parse ─────────────────────────────────────────
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();

  return null;
}

// cellValue logic is moved inside ScheduleContainer to access state

// ── Virtual scroll constants ─────────────────────────────────────────
const HEADER_HEIGHT = 36;
const OVERSCAN = 20;    // extra rows above/below viewport

// ── Main component ────────────────────────────────────────────────────
export default function ScheduleContainer({ projectId }: { projectId?: string }) {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `/api/projects/${projectId}/schedule` : `/api/schedule`, fetcher
  );

  const { data: projectsData } = useSWR('/api/projects', fetcher);
  const projects = projectsData?.projects || [];

  // Identity logic
  const isContractorTenant = (session?.user as any)?.tenant_type === 'contractor';
  const hasAffiliation = !!(session?.user as any)?.contractor_affiliation;
  const isIntegratedContractor = !isContractorTenant && hasAffiliation;

  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState<ColKey>('sequence_number');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc');
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editField, setEditField]   = useState<string>('');
  const [editValue, setEditValueSt] = useState<string>('');
  const [overrideTarget, setOverrideTarget] = useState<{
    activityId: string;
    field: 'planned_start' | 'planned_end';
    label: string;
    currentValue: string | null;
    derivedValue: string | null;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard]   = useState<{ type: 'copy' | 'cut', data: any } | null>(null);
  
  // Expand/Collapse state (default to Collapsed)
  const [expandedWbs, setExpandedWbs] = useState<Set<string>>(new Set());
  const [wbsManagerOpen, setWbsManagerOpen] = useState(false);

  // Row height (P6-style compactness control)
  const [rowHeight, setRowHeight] = useState(24);
  const ROW_HEIGHT = rowHeight;

  // View state: Activities vs WBS Window
  const [currentView, setCurrentView] = useState<'activities' | 'wbs'>('activities');
  const wbsRef = useRef<any>(null); // Ref to trigger WBS view actions

  // Date picker anchor (for calendar popup positioning)
  const [pickerAnchorRect, setPickerAnchorRect] = useState<DOMRect | null>(null);

  // Live date preview while the user types natural-language dates
  const [datePreview, setDatePreview] = useState<string | null>(null);

  // Rect of the currently-editing date cell (used to position the preview chip)
  const [editCellRect, setEditCellRect] = useState<DOMRect | null>(null);

  // Baseline state
  const [maintainBaselinesOpen, setMaintainBaselinesOpen] = useState(false);
  const [assignBaselinesOpen, setAssignBaselinesOpen] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);

  // 12.4 — Resource Histogram toggle
  const [showHistogram, setShowHistogram] = useState(false);
  
  // Sprint 11 — S-Curve toggle
  const [showSCurve, setShowSCurve] = useState(false);

  const { preferences } = useUserPreferences();
  const siteTimezone = (preferences?.dates?.siteTimezone as SiteTz) || 'local';

  // Inner fmtDate that closes over preferences + siteTimezone
  const fmt = (d: string | null | undefined) => fmtDate(d, preferences, siteTimezone);

  const toggleExpand = useCallback((wbs: string) => {
    setExpandedWbs(prev => {
      const next = new Set(prev);
      if (next.has(wbs)) next.delete(wbs);
      else next.add(wbs);
      localStorage.setItem('syority_schedule_expanded_wbs', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // Columns visibility state
  type LayoutDef = { id: string; name: string; cols: ColKey[] };
  
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [layoutsMenuOpen, setLayoutsMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [projSelectorOpen, setProjSelectorOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [activeCols, setActiveCols] = useState<Set<ColKey>>(
    new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  
  const [layouts, setLayouts] = useState<LayoutDef[]>([
     { id: 'classic', name: 'Classic Schedule', cols: ['activity_number', 'description', 'status', 'duration_hours', 'planned_start', 'planned_end', 'progress_percent'] },
     { id: 'progress', name: 'Progress & Actuals', cols: ['activity_number', 'description', 'status', 'progress_percent', 'actual_start', 'actual_end', 'remaining_duration'] },
     { id: 'full', name: 'Detailed View', cols: ALL_COLUMNS.map(c => c.key) },
  ]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>('classic');

  useEffect(() => {
    try {
      const savedLayouts = localStorage.getItem('syority_schedule_layouts');
      if (savedLayouts) setLayouts(JSON.parse(savedLayouts));
      
      const lastCols = localStorage.getItem('syority_schedule_active_cols');
      if (lastCols) {
          const parsed = JSON.parse(lastCols);
          if (Array.isArray(parsed)) setActiveCols(new Set(parsed));
      }

      const lastLayoutId = localStorage.getItem('syority_schedule_active_layout_id');
      if (lastLayoutId) setActiveLayoutId(lastLayoutId);
      
      const lastExpanded = localStorage.getItem('syority_schedule_expanded_wbs');
      if (lastExpanded) {
          const parsed = JSON.parse(lastExpanded);
          if (Array.isArray(parsed)) setExpandedWbs(new Set(parsed));
      }
    } catch {}
  }, []);

  const handleColsChange = (key: ColKey, checked: boolean) => {
      const next = new Set(activeCols);
      if (checked) next.add(key); else next.delete(key);
      setActiveCols(next);
      setActiveLayoutId(null);
      localStorage.setItem('syority_schedule_active_cols', JSON.stringify(Array.from(next)));
      localStorage.removeItem('syority_schedule_active_layout_id');
  };

  const applyLayout = (layout: LayoutDef) => {
      setActiveLayoutId(layout.id);
      setActiveCols(new Set(layout.cols));
      localStorage.setItem('syority_schedule_active_cols', JSON.stringify(layout.cols));
      localStorage.setItem('syority_schedule_active_layout_id', layout.id);
  };

  const saveLayout = () => {
      const name = prompt('Enter a name for this new layout:');
      if (!name || !name.trim()) return;
      const newLayout = { id: Date.now().toString(), name: name.trim(), cols: Array.from(activeCols) };
      const nextLayouts = [...layouts, newLayout];
      setLayouts(nextLayouts);
      setActiveLayoutId(newLayout.id);
      localStorage.setItem('syority_schedule_layouts', JSON.stringify(nextLayouts));
      localStorage.setItem('syority_schedule_active_layout_id', newLayout.id);
  };

  const COLUMNS = useMemo(() => ALL_COLUMNS.filter(c => activeCols.has(c.key)), [activeCols]);

  // Virtual scroll
  const scrollRef     = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Build activity list ───────────────────────────────────────────
  const allActivities = useMemo(() => {
    if (!data) return [];
    const combined = [
      ...(data.workpacks?.flatMap((wp: any) =>
        (wp.activities || []).map((a: any) => ({ ...a, workpack: wp }))
      ) || []),
      ...(data.looseActivities || []),
    ];

    const parentWbsCodes = new Set<string>();
    for (const act of combined) {
        if (!act.wbs_code) continue;
        let p = act.wbs_code;
        while (p.includes('.')) {
            p = p.substring(0, p.lastIndexOf('.'));
            parentWbsCodes.add(p);
        }
    }

    const mapped = combined.map(act => {
      const wbs = act.wbs_code || '';
      const depth = wbs ? (wbs.match(/\./g) || []).length : 0;
      const isSummary = parentWbsCodes.has(wbs);

      let autoStatus = act.status || 'not_started';
      const prog = Number(act.progress_percent) || 0;
      let autoActualStart = act.actual_start;
      let autoActualEnd = act.actual_end;

      if (!isSummary) {
          if (prog === 100 && autoStatus !== 'completed') autoStatus = 'completed';
          else if (prog > 0 && prog < 100 && (autoStatus === 'not_started' || autoStatus === null)) autoStatus = 'in_progress';
          
      // Data fallback: If imported with progress but no actual dates, fallback to planned dates for the view
          if (prog > 0 && !autoActualStart) autoActualStart = act.planned_start;
          if (prog === 100 && !autoActualEnd) autoActualEnd = act.planned_end || act.planned_start;
      }

      const blMap = data.baselineActivities ? new Map(data.baselineActivities.map((b: any) => [b.activity_id, b])) : new Map();
      const bl = blMap.get(act.id);
      
      let variance_start = null;
      let variance_finish = null;
      let variance_duration = null;

      if (bl) {
        const dPlannedStart = new Date(act.planned_start).getTime();
        const dBLStart = new Date(bl.planned_start).getTime();
        variance_start = Math.round((dPlannedStart - dBLStart) / (1000 * 60 * 60 * 24));
        
        if (act.planned_end && bl.planned_finish) {
          const dPlannedEnd = new Date(act.planned_end).getTime();
          const dBLEnd = new Date(bl.planned_finish).getTime();
          variance_finish = Math.round((dPlannedEnd - dBLEnd) / (1000 * 60 * 60 * 24));
        }
        
        variance_duration = act.duration_hours - bl.duration;
      }

      return { 
        ...act, 
        _wbsDepth: depth, 
        _isSummary: isSummary, 
        status: autoStatus,
        actual_start: autoActualStart,
        actual_end: autoActualEnd,
        baseline_start: bl?.planned_start || null,
        baseline_end: bl?.planned_finish || null,
        baseline_duration: bl?.duration || null,
        variance_start,
        variance_finish,
        variance_duration
      };
    });

    const rollupMap = new Map<string, { 
      dur: number, 
      progWg: number, 
      statuses: Set<string>,
      minStart: number | null,
      maxEnd: number | null
    }>();
    for (const leaf of mapped) {
        if (!leaf._isSummary && leaf.wbs_code) {
             const dur = Number(leaf.duration_hours) || 1;
             const prog = Number(leaf.progress_percent) || 0;
             const st = leaf.status || 'not_started';
             
             const actStart = leaf.actual_start ? new Date(leaf.actual_start).getTime() : null;
             const actEnd = leaf.actual_end ? new Date(leaf.actual_end).getTime() : null;

             let p = leaf.wbs_code;
             while (p.includes('.')) {
                 p = p.substring(0, p.lastIndexOf('.'));
                 let acc = rollupMap.get(p);
                 if (!acc) { 
                   acc = { dur: 0, progWg: 0, statuses: new Set(), minStart: null, maxEnd: null }; 
                   rollupMap.set(p, acc); 
                 }
                 acc.dur += dur;
                 acc.progWg += (dur * prog);
                 acc.statuses.add(st);
                 
                 if (actStart && (acc.minStart === null || actStart < acc.minStart)) acc.minStart = actStart;
                 if (actEnd && (acc.maxEnd === null || actEnd > acc.maxEnd)) acc.maxEnd = actEnd;
             }
        }
    }

    for (const act of mapped) {
        if (act._isSummary && act.wbs_code) {
             const acc = rollupMap.get(act.wbs_code);
             if (acc) {
                 act.progress_percent = acc.dur > 0 ? Math.round(acc.progWg / acc.dur) : 0;
                 
                 if (acc.minStart) act.actual_start = new Date(acc.minStart).toISOString();
                 if (acc.maxEnd) act.actual_end = new Date(acc.maxEnd).toISOString();

                 const s = acc.statuses;
                 if (s.size === 0) act.status = 'not_started';
                 else if (s.has('in_progress') || (s.has('completed') && s.has('not_started'))) act.status = 'in_progress';
                 else if (s.has('completed') && s.size === 1) act.status = 'completed';
                 else if (s.has('not_started') && s.size === 1) act.status = 'not_started';
                 else act.status = 'in_progress';
             }
        }
    }

    return mapped;
  }, [data]);

  // ── Filter ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return allActivities;
    const q = search.toLowerCase();
    return allActivities.filter((a: any) =>
      (a.description || '').toLowerCase().includes(q) ||
      (a.activity_number || '').toLowerCase().includes(q) ||
      (a.discipline || '').toLowerCase().includes(q) ||
      (a.status || '').toLowerCase().includes(q) ||
      (a.responsible || '').toLowerCase().includes(q) ||
      (a.workpack?.title || '').toLowerCase().includes(q)
    );
  }, [allActivities, search]);

  // ── Filter visible based on collapse ──────────────────────────────
  const visibleActivities = useMemo(() => {
    return filtered.filter(act => {
      if (!act.wbs_code) return true;
      let current = act.wbs_code;
      while (current.includes('.')) {
        current = current.substring(0, current.lastIndexOf('.'));
        if (!expandedWbs.has(current)) return false;
      }
      return true;
    });
  }, [filtered, expandedWbs]);

  const expandNodesUpToLevel = useCallback((level?: number) => {
     const newExpanded = new Set<string>();
     filtered.forEach(act => {
        if (act.wbs_code) {
           let p = String(act.wbs_code);
           
           // Aggressively build ancestor chain. 
           // This guarantees broken/missing structural parents from imported MS Project XMLs 
           // are fully instantiated into the memory tree so children don't suddenly disappear!
           while (p.includes('.')) {
              p = p.substring(0, p.lastIndexOf('.'));
              let depth = (p.match(/\./g) || []).length;
              if (level === undefined || depth + 1 < level) newExpanded.add(p);
           }
           
           if (act._isSummary) {
              const depth = (String(act.wbs_code).match(/\./g) || []).length;
              if (level === undefined || depth + 1 < level) newExpanded.add(String(act.wbs_code));
           }
        }
     });
     setExpandedWbs(newExpanded);
     localStorage.setItem('syority_schedule_expanded_wbs', JSON.stringify(Array.from(newExpanded)));
  }, [filtered]);

  // ── Sort ─────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...visibleActivities].sort((a, b) => {
      const partsA = a.wbs_code ? String(a.wbs_code).split('.') : [];
      const partsB = b.wbs_code ? String(b.wbs_code).split('.') : [];
      
      // 1. Send loose activities to the very bottom
      if (partsA.length === 0 && partsB.length > 0) return 1;
      if (partsB.length === 0 && partsA.length > 0) return -1;
      
      // 2. WBS Tree Divergence Parsing
      let minLen = Math.min(partsA.length, partsB.length);
      let divergenceIdx = -1;
      for (let i = 0; i < minLen; i++) {
          if (partsA[i] !== partsB[i]) {
              divergenceIdx = i; break;
          }
      }

      if (divergenceIdx === -1 && partsA.length > 0) {
          // One is a strict ancestor of the other. Ancestor MUST ALWAYS come first to preserve optical tree.
          if (partsA.length !== partsB.length) return partsA.length - partsB.length;
      } else if (divergenceIdx !== -1) {
          // They diverged! 
          // Are they true siblings under the exact same parent WBS band?
          const isTrueSiblings = (partsA.length === partsB.length && divergenceIdx === partsA.length - 1);
          
          if (sortKey && isTrueSiblings) {
              // The user requested sorting, AND these are siblings capable of being safely reordered inside their band!
              let av = a[sortKey] ?? '';
              let bv = b[sortKey] ?? '';
              if (sortKey === 'workpack') { av = a.workpack?.title ?? ''; bv = b.workpack?.title ?? ''; }
              
              let cmp = 0;
              if (typeof av === 'number' && typeof bv === 'number') {
                  cmp = av - bv;
              } else {
                  // Use numeric: true for intelligent alphanumeric sorting (e.g., A-2 before A-1733)
                  cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
              }
              
              if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
          }
          
          // STRICT WBS Fallback for different branches, or if sortKey was identical
          const numA = Number(partsA[divergenceIdx]);
          const numB = Number(partsB[divergenceIdx]);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
          return String(partsA[divergenceIdx]).localeCompare(String(partsB[divergenceIdx]), undefined, { numeric: true });
      }
      
      // 3. Fallback for absolutely loose items OR identical duplicates
      if (sortKey) {
        let av = a[sortKey] ?? '';
        let bv = b[sortKey] ?? '';
        if (sortKey === 'workpack') { av = a.workpack?.title ?? ''; bv = b.workpack?.title ?? ''; }
        let cmp = 0;
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      }

      return String(a.activity_number || a.id).localeCompare(String(b.activity_number || b.id), undefined, { numeric: true });
    });
  }, [visibleActivities, sortKey, sortDir]);

  const totalHeight = sorted.length * rowHeight;
  const startIdx    = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endIdx      = Math.min(sorted.length, Math.ceil((scrollTop + viewHeight) / rowHeight) + OVERSCAN);
  const visibleRows = sorted.slice(startIdx, endIdx);

  // ── Sort toggle ───────────────────────────────────────────────────
  function toggleSort(key: ColKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  // ── Inline edit ───────────────────────────────────────────────────
  function startEdit(id: string, field: string, current: any) {
    // Integrated contractors can ONLY edit status and progress
    if (isIntegratedContractor && !['status', 'progress_percent'].includes(field)) {
      console.warn('Integrated contractors cannot edit structural fields');
      return;
    }

    if (field === 'planned_start' || field === 'planned_end') {
      const act = allActivities.find((a: any) => a.id === id);
      setOverrideTarget({
        activityId: id,
        field,
        label: field === 'planned_start' ? 'Plan Start' : 'Plan End',
        currentValue: current ? String(current) : null,
        derivedValue: act?.planned_derived_start && field === 'planned_start'
          ? String(act.planned_derived_start)
          : act?.planned_derived_end && field === 'planned_end'
            ? String(act.planned_derived_end)
            : act?.early_start && field === 'planned_start'
              ? String(act.early_start)
              : act?.early_finish ? String(act.early_finish) : null,
      });
      return;
    }

    setEditingId(id);
    setEditField(field);

    // For date fields: show just YYYY-MM-DD (no time — fields are @db.Date, time can't be stored).
    const DATE_EDIT_FIELDS = ['planned_start', 'planned_end', 'actual_start', 'actual_end'];
    if (DATE_EDIT_FIELDS.includes(field) && current) {
      const d = new Date(String(current));
      if (!isNaN(d.getTime())) {
        // Use UTC date parts to avoid timezone offset in the displayed date
        const yr = d.getUTCFullYear();
        const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dy = String(d.getUTCDate()).padStart(2, '0');
        setEditValueSt(`${yr}-${mo}-${dy}`);
        return;
      }
    }

    setEditValueSt(String(current ?? ''));
  }

  async function commitEdit(actId: string, valueOverride?: string) {
    if (editingId === null) return;

    // Use the override value (from natural-date parsing) if provided
    const rawValue = valueOverride !== undefined ? valueOverride : editValue;

    // For date fields, run through natural-language parser first
    const currentYearInTz = getPartsInTz(new Date(), siteTimezone).year;
    let resolvedValue = rawValue;
    if (['planned_start', 'planned_end', 'actual_start', 'actual_end'].includes(editField)) {
      const parsed = parseNaturalDate(rawValue, currentYearInTz);
      if (parsed) resolvedValue = parsed;
    }

    // Type conversion for numeric fields
    let finalValue: any = resolvedValue;
    if (['progress_percent', 'crew_size', 'duration_hours', 'remaining_duration', 'sequence_number', 'actual_duration', 'physical_percent_complete', 'duration_percent_complete', 'unit_percent_complete'].includes(editField)) {
        finalValue = parseFloat(String(editValue)) || 0;
    }

    // Parse date fields — resolvedValue is already an ISO string from parseNaturalDate
    // or the raw string typed by the user. Convert to proper ISO.
    const DATE_FIELDS = ['planned_start', 'planned_end', 'actual_start', 'actual_end'];
    if (DATE_FIELDS.includes(editField)) {
      const raw    = String(resolvedValue).replace(' ', 'T');
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) finalValue = parsed.toISOString();
    }

    // Build payload — may include linked fields
    const payload: Record<string, any> = { [editField]: finalValue };

    // Clear preview after commit
    setDatePreview(null);
    setEditCellRect(null);

    // Start / Finish / Duration linkage (planned dates only)
    const act = allActivities.find((a: any) => a.id === actId);
    if (act) {
      const durH = editField === 'duration_hours' ? finalValue : (act.duration_hours ?? 0);

      if (editField === 'duration_hours') {
        // Duration is a CPM input. Planned dates are re-derived by M11 — do not write them here.
      }

      // Auto-populate Actuals based on Progress is an execution side-effect of EWS START/COMPLETE.
      // Do not write actuals through the planning PUT.
    }

    const EXECUTION_EDIT_FIELDS = ['status', 'progress_percent', 'actual_start', 'actual_end'];
    if (EXECUTION_EDIT_FIELDS.includes(editField)) {
      const mapped = mapGridFieldToExecution(editField, finalValue, act?.status);
      if ('error' in mapped) {
        alert(mapped.error);
        setEditingId(null);
        setPickerAnchorRect(null);
        return;
      }
      try {
        const res = await fetch('/api/execution/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: actId,
            action: mapped.action,
            progress: mapped.progress,
            execution_date: mapped.execution_date,
            notes: mapped.notes,
            hold_reason: mapped.action === 'HOLD' ? 'Hold from schedule grid' : undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          alert(json.error || 'Execution update blocked');
        } else {
          mutate();
        }
      } catch {
        alert('Execution update failed');
      }
      setEditingId(null);
      setPickerAnchorRect(null);
      return;
    }

    try {
      const url = projectId
        ? `/api/projects/${projectId}/schedule/activities/${actId}`
        : `/api/activities/${actId}`;

      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      mutate();
    } catch { /* silent */ }

    setEditingId(null);
    setPickerAnchorRect(null);
  }

  // ── Action Handlers ──────────────────────────────────────────────────
  async function handleAdd() {
    if (currentView === 'wbs') {
      wbsRef.current?.handleAdd();
      return;
    }
    try {
      const url = projectId ? `/api/projects/${projectId}/schedule/activities` : `/api/activities`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New Activity', status: 'not_started' }),
      });
      if (res.ok) {
        const json = await res.json();
        mutate();
        setSelectedId(json.data?.id || null);
      }
    } catch (err) { console.error('Add failed', err); }
  }

  async function handleDelete() {
    if (!selectedId) return;
    if (!confirm('Are you sure you want to delete this activity?')) return;
    try {
      const res = await fetch(`/api/activities/${selectedId}`, { method: 'DELETE' });
      if (res.ok) {
        mutate();
        setSelectedId(null);
      }
    } catch (err) { console.error('Delete failed', err); }
  }

  function handleCopy() {
    if (!selectedId) return;
    const act = sorted.find(a => a.id === selectedId);
    if (act) setClipboard({ type: 'copy', data: { ...act } });
    setEditMenuOpen(false);
  }

  function handleCut() {
    if (!selectedId) return;
    const act = sorted.find(a => a.id === selectedId);
    if (act) setClipboard({ type: 'cut', data: { ...act } });
    setEditMenuOpen(false);
  }

  async function handlePaste() {
    if (!clipboard) return;
    try {
      if (clipboard.type === 'copy') {
        // Create new
        const url = projectId ? `/api/projects/${projectId}/schedule/activities` : `/api/activities`;
        const { id, created_at, updated_at, ...cleanData } = clipboard.data;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...cleanData, description: `${cleanData.description} (Copy)` }),
        });
      } else {
        // Move (Cut) - Update project_id if switched views
        const actId = clipboard.data.id;
        const url = `/api/activities/${actId}`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId || null }),
        });
        setClipboard(null);
      }
      mutate();
    } catch (err) { console.error('Paste failed', err); }
    setEditMenuOpen(false);
  }

  // ── Keyboard Shortcuts (P6 Style) ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Insert') {
        e.preventDefault();
        handleAdd();
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        if (currentView === 'wbs') wbsRef.current?.startRename?.(selectedId);
        else if (selectedId) { setEditingId(selectedId); setEditField('description'); }
      }
      if (e.ctrlKey) {
        if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleCopy(); }
        if (e.key === 'x' || e.key === 'X') { e.preventDefault(); handleCut(); }
        if (e.key === 'v' || e.key === 'V') { e.preventDefault(); handlePaste(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, clipboard, handleAdd, handleDelete, handleCopy, handleCut, handlePaste]);

  // ── Cell renderer ─────────────────────────────────────────────────────
  const renderCell = (act: any, key: ColKey): React.ReactNode => {
    switch (key) {
      case 'status':          return <StatusBadge status={act.status} />;
      case 'progress_percent':return <ProgressBar value={act.progress_percent} />;
      case 'planned_start':   
      case 'planned_end':     
      case 'actual_start':
      case 'actual_end':
                              return <span className="tabular-nums text-[11px]">{fmt(act[key])}</span>;
      case 'duration_hours':  
      case 'remaining_duration':
      case 'sequence_number': 
      case 'crew_size':       
                              return <span className="tabular-nums">{act[key] ?? '—'}</span>;
      case 'workpack':        return <span className="truncate">{act.workpack?.title ?? '—'}</span>;
      case 'notes':           return <span className="truncate text-gray-400">{act.notes || '—'}</span>;
      case 'description':
        const depth = act._wbsDepth || 0;
        const isSummary = act._isSummary || false;
        const isCollapsed = !expandedWbs.has(act.wbs_code);
        
        return (
          <div className="flex items-center w-full min-w-0" style={{ paddingLeft: depth * 16 }}>
            {isSummary ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(act.wbs_code); }}
                className="mr-1.5 p-0.5 rounded hover:bg-white/20 transition-colors flex-shrink-0 flex items-center justify-center"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : (
              <span className="w-5 flex-shrink-0" />
            )}
            <span className={`truncate ${isSummary ? 'font-bold' : 'text-gray-700'}`}>
              {act.description ?? '—'}
            </span>
          </div>
        );
      default:
        return <span className="truncate">{act[key] ?? '—'}</span>;
    }
  };

  // ── Total header width ────────────────────────────────────────────
  const totalWidth = COLUMNS.reduce((s, c) => s + c.width, 0);

  // ── Bottom Bar Stats ──────────────────────────────────────────────
  const statActivities = useMemo(() => filtered.filter((a: any) => !a._isSummary), [filtered]);
  const completedCount = statActivities.filter((a: any) => a.status === 'completed').length;
  const inProgressCount = statActivities.filter((a: any) => a.status === 'in_progress').length;
  const notStartedCount = statActivities.filter((a: any) => !a.status || a.status === 'not_started').length;

  // ── States ────────────────────────────────────────────────────────
  if (error) return <div className="p-10 text-red-500">Failed to load activities.</div>;
  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 gap-3">
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      Loading activities…
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-56px)] min-h-0 bg-white overflow-hidden shadow-inner">
      {/* ── Consolidated Header & Toolbar ─────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shadow-sm flex-shrink-0 gap-8">
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100/80 transition-all cursor-pointer group"
              onClick={() => setProjSelectorOpen(!projSelectorOpen)}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest leading-none">
                    Portfolio
                  </span>
                  <div className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className={`p-0.5 px-1.5 text-[9px] ${projectId ? 'bg-blue-600/10 text-blue-700' : 'bg-emerald-600/10 text-emerald-700'} rounded font-bold tracking-widest uppercase`}>
                    {projectId ? 'Workpack' : 'Global'}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 leading-tight mt-0.5">
                  <span className="truncate max-w-[320px]">
                    {currentView === 'wbs' ? 'WBS Management' : (projectId ? (data?.project?.name || 'Project Schedule') : 'Global Execution Schedule')}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-all ${projSelectorOpen ? 'rotate-180 text-blue-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </h1>
              </div>
            </div>

            {projSelectorOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProjSelectorOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-gray-50 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Scope</span>
                    <LayoutGrid className="w-3 h-3 text-gray-300" />
                  </div>
                  
                  <button 
                    onClick={() => { window.location.href = '/schedule'; }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between group transition-all ${!projectId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${!projectId ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Global Portfolio</span>
                        <span className="text-[10px] font-normal text-gray-400">Consolidated execution schedule</span>
                      </div>
                    </div>
                    {!projectId && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />}
                  </button>

                  <div className="px-3 py-2 border-t border-gray-50 my-1 bg-gray-50/30">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active Projects</span>
                  </div>

                  <div className="max-h-[320px] overflow-auto custom-scrollbar">
                    {projects.map((p: any) => (
                      <button 
                        key={p.id}
                        onClick={() => { window.location.href = `/projects/${p.id}/schedule`; }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between group transition-all ${projectId === p.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${projectId === p.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                            <FolderTree className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold truncate max-w-[180px]">{p.name}</span>
                            <span className="text-[10px] font-normal text-gray-400">View project workpacks</span>
                          </div>
                        </div>
                        {projectId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />}
                      </button>
                    ))}
                  </div>

                  {projects.length === 0 && (
                    <div className="px-4 py-8 text-center text-gray-400 text-xs italic">
                      No projects found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-1 whitespace-nowrap pl-3 border-l-2 border-blue-500/20">
          {currentView === 'wbs' ? 'Configure project hierarchy, indentation, and rollups' : (projectId ? `Manage activities for ${data?.project?.name || 'this project'}.` : 'Portfolio-wide visibility & progress.')}
        </p>

        {/* Right Side: 2-Row Action Area */}
        <div className="flex flex-col items-end gap-2 flex-1 max-w-2xl">
          {/* Row 1: Small Action Buttons */}
          <div className="flex items-center gap-1.5 ">

            {/* Row height control */}
            <div className="flex items-center border border-gray-200 rounded bg-white overflow-hidden shadow-sm" title="Row height">
              <button
                onClick={() => setRowHeight(h => Math.max(18, h - 2))}
                className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-sm font-bold leading-none transition"
                title="Decrease row height"
              >−</button>
              <span className="text-[10px] text-gray-400 px-1 tabular-nums w-8 text-center">{rowHeight}px</span>
              <button
                onClick={() => setRowHeight(h => Math.min(60, h + 2))}
                className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-sm font-bold leading-none transition"
                title="Increase row height"
              >+</button>
            </div>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <div className="h-4 w-px bg-gray-200 mx-1" />
            
            {/* Project Menu (New consolidated menu) */}
            <div className="relative">
              <button
                onClick={() => { setProjectMenuOpen(!projectMenuOpen); setEditMenuOpen(false); setViewMenuOpen(false); setLayoutsMenuOpen(false); setColumnsMenuOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition shadow-sm group"
              >
                <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <FolderTree className="w-2.5 h-2.5" />
                </div>
                Project
                <svg className={`w-3 h-3 transition-transform ${projectMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {projectMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded shadow-lg border border-gray-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="px-3 py-1 border-b border-gray-100">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Navigation</span>
                    </div>
                    <button 
                      onClick={() => { setCurrentView('activities'); setProjectMenuOpen(false); }} 
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${currentView === 'activities' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                       <LayoutGrid className="w-3.5 h-3.5" />
                       Activities
                       {currentView === 'activities' && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button 
                      onClick={() => { 
                        if (!projectId) {
                          alert('Please select a project first to access WBS Management.');
                        } else {
                          setCurrentView('wbs');
                        }
                        setProjectMenuOpen(false); 
                      }} 
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${currentView === 'wbs' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                       <FolderTree className="w-3.5 h-3.5" />
                       WBS Management
                       {currentView === 'wbs' && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    
                    <div className="h-px bg-gray-100 my-1 mx-2"></div>
                    <div className="px-3 py-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Baselines</span>
                    </div>
                    
                    <button 
                      onClick={() => { setMaintainBaselinesOpen(true); setProjectMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                    >
                       <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                       Maintain Baselines...
                    </button>
                    <button 
                      onClick={() => { setAssignBaselinesOpen(true); setProjectMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                    >
                       <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                       Assign Baselines...
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions (Add/Delete) */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white shadow-sm mr-2 transition-all">
              <button
                onClick={() => handleAdd()}
                className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-all group relative"
                title="Add (INS)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                disabled={!selectedId}
                onClick={() => handleDelete()}
                className={`p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-all group relative ${!selectedId ? 'opacity-20 cursor-not-allowed' : ''}`}
                title="Delete (DEL)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Hierarchy Actions (WBS Only) */}
            {currentView === 'wbs' && (
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white shadow-sm mr-2 transition-all animate-in fade-in slide-in-from-left-2">
                <button
                  disabled={!selectedId}
                  onClick={() => wbsRef.current?.handleShift('up')}
                  className={`p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-all group relative ${!selectedId ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title="Move Up"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  disabled={!selectedId}
                  onClick={() => wbsRef.current?.handleShift('down')}
                  className={`p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-all group relative ${!selectedId ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title="Move Down"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="w-px h-3 bg-gray-200 mx-0.5" />
                <button
                  disabled={!selectedId}
                  onClick={() => wbsRef.current?.handleShift('left')}
                  className={`p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-all group relative ${!selectedId ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title="Outdent"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  disabled={!selectedId}
                  onClick={() => wbsRef.current?.handleShift('right')}
                  className={`p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-all group relative ${!selectedId ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title="Indent"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            <div className="h-4 w-px bg-gray-200 mx-1" />
            
            {/* Unified Edit Menu */}
            <div className="relative">
              <button
                onClick={() => { setEditMenuOpen(!editMenuOpen); setViewMenuOpen(false); setLayoutsMenuOpen(false); setColumnsMenuOpen(false); }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
                <svg className={`w-3 h-3 transition-transform ${editMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {editMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setEditMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded shadow-lg border border-gray-200 py-1.5 z-50">
                    <button onClick={() => { handleAdd(); setEditMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                       <span className="w-4 flex justify-center text-green-600 font-bold items-center">+</span> Add Activity
                    </button>
                    <button onClick={() => { /* startRename(); */ setEditMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                       <span className="w-4 text-center text-[10px] text-gray-400">F2</span> Rename
                    </button>
                    <div className="h-px bg-gray-100 my-1 mx-2"></div>
                    <button onClick={() => { handleCopy(); setEditMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                       <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg> Copy
                    </button>
                    <button onClick={() => { handleCut(); setEditMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-red-600">
                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758L5 19m0-14l5.758 5.758" /></svg> Cut
                    </button>
                    <button onClick={() => { handlePaste(); setEditMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                       <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> Paste
                    </button>
                    <div className="h-px bg-gray-100 my-1 mx-2"></div>
                    <button 
                      onClick={() => { wbsRef.current?.handleShift('left'); setEditMenuOpen(false); }} 
                      disabled={currentView !== 'wbs'}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${currentView === 'wbs' ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-300 cursor-not-allowed uppercase text-[9px]'}`}
                    >
                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg> Outdent
                    </button>
                    <button 
                      onClick={() => { wbsRef.current?.handleShift('right'); setEditMenuOpen(false); }} 
                      disabled={currentView !== 'wbs'}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${currentView === 'wbs' ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-300 cursor-not-allowed uppercase text-[9px]'}`}
                    >
                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg> Indent
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* View Context Menu */}
            <div className="relative">
              <button
                onClick={() => { setViewMenuOpen(!viewMenuOpen); setEditMenuOpen(false); setColumnsMenuOpen(false); setLayoutsMenuOpen(false); }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition shadow-sm"
              >
                <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View
                <svg className={`w-2.5 h-2.5 transition-transform ${viewMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {viewMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setViewMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-3 py-1 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Hierarchy View</span>
                    </div>
                    <div className="py-1">
                       <button onClick={() => { expandNodesUpToLevel(); setViewMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          Expand All
                       </button>
                       <button onClick={() => { expandNodesUpToLevel(1); setViewMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          Collapse All
                        </button>
                    </div>
                    <div className="px-3 py-1 border-y border-gray-100 bg-gray-50/50">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Collapse To...</span>
                    </div>
                    <div className="max-h-48 overflow-auto py-1">
                       {[1,2,3,4,5,6,7,8].map(level => (
                         <button key={level} onClick={() => { expandNodesUpToLevel(level); setViewMenuOpen(false); }} className="w-full text-left px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:text-blue-600 pl-6">
                           WBS Level {level}
                         </button>
                       ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Layouts Menu */}
            <div className="relative">
              <button
                onClick={() => { setLayoutsMenuOpen(!layoutsMenuOpen); setColumnsMenuOpen(false); setViewMenuOpen(false); }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Layouts
              </button>
              {layoutsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLayoutsMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-3 py-1 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Saved Layouts</span>
                    </div>
                    <div className="max-h-40 overflow-auto py-1">
                      {layouts.map(lyt => (
                        <button key={lyt.id} onClick={() => { applyLayout(lyt); setLayoutsMenuOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${activeLayoutId === lyt.id ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-gray-700'}`}>
                          {lyt.name}
                          {activeLayoutId === lyt.id && <svg className="w-3 h-3 ml-auto text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-1 mt-1">
                       <button onClick={() => { saveLayout(); setLayoutsMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[10px] text-green-600 hover:bg-green-50 flex items-center gap-2 font-medium">
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                         Save As...
                       </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Columns Menu */}
            <div className="relative">
              <button
                onClick={() => { setColumnsMenuOpen(!columnsMenuOpen); setLayoutsMenuOpen(false); setViewMenuOpen(false); }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Columns
              </button>
              {columnsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setColumnsMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded shadow-lg border border-gray-200 py-1.5 z-50">
                    <div className="px-3 py-1 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Select Columns</span>
                    </div>
                    <div className="max-h-64 overflow-auto py-1">
                      {ALL_COLUMNS.map(c => (
                        <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={activeCols.has(c.key)} onChange={(e) => handleColsChange(c.key, e.target.checked)} className="rounded border-gray-300 text-blue-600 w-3 h-3 cursor-pointer" />
                          <span className="text-xs text-gray-700">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Histogram Toggle */}
            <button
              onClick={() => setShowHistogram(h => !h)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium border rounded hover:bg-gray-50 transition ${
                showHistogram
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
              title="Toggle Resource Histogram"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Histogram
            </button>

            {/* S-Curve Toggle */}
            <button
              onClick={() => setShowSCurve(s => !s)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium border rounded hover:bg-gray-50 transition ${
                showSCurve
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
              title="Toggle S-Curve"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              S-Curve
            </button>

            {/* Baseline Toggle */}
            <button
              onClick={() => setShowBaseline(b => !b)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium border rounded hover:bg-gray-50 transition ${
                showBaseline
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
              title="Toggle Baseline Comparison"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Baseline
            </button>

            {/* OD9.2 §6/§17: the "Level Resources" control was removed from this
                Project-context toolbar. It rendered only when `projectId` was set and
                passed that Project id straight into `eventId`, so it POSTed to
                /api/events/{projectId}/schedule/level-resources[/apply] — a fabricated
                Event mapping, and a write into STO schedule state driven by a Project
                identity. §31 forbids fabricated Event mappings and §17 forbids wiring
                Project scheduling to Event CPM.

                STO resource levelling is NOT removed: it remains reachable from the
                planner workspace, where ResourcePlanningDashboard renders the same
                LevelingPreviewModal with a genuine `selectedEventId`
                (src/components/planner-workspace/resources/ResourcePlanningDashboard.tsx:330-336). */}

            {/* Export Excel Button */}
            <button
              onClick={() => window.open(projectId ? `/api/projects/${projectId}/schedule/export` : `/api/schedule/export`, '_blank')}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition"
              title="Export to Excel"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Excel
            </button>

            {/* Export XER Button */}
            {projectId && (
              <button
                onClick={() => window.open(`/api/projects/${projectId}/schedule/export/xer`, '_blank')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition"
                title="Export to Primavera P6 (XER)"
              >
                <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                P6 XER
              </button>
            )}

            {/* M11-V1: "Undo Import" button removed — P6/MPP import is permanently retired under M11-R0 */}
          </div>

          {/* Row 2: Search Bar and Quick Stats */}
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                title="Scroll Left"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                title="Scroll Right"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); }}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-gray-50 border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
              )}
            </div>
            
            <div className="flex items-center gap-3 text-[10px] text-gray-400 whitespace-nowrap bg-gray-50 px-3 py-1 rounded border border-gray-100">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                <strong className="text-gray-600">{statActivities.length.toLocaleString()}</strong> activities
              </span>
              <span className="w-px h-3 bg-gray-200" />
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                {/* M8.13 GOVERNANCE: PRESENTATION-ONLY — simple count average for inline schedule tooltip */}
                <strong className="text-gray-600">{Math.round(statActivities.reduce((s: number, a: any) => s + (a.progress_percent || 0), 0) / (statActivities.length || 1))}%</strong> avg.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table / WBS View ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-[#f9fafb]">
        {currentView === 'wbs' ? (
          projectId ? (
            <WbsView ref={wbsRef} projectId={projectId} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 italic">Please select a project first.</div>
          )
        ) : (
          <div className="flex-1 min-h-0 overflow-auto" ref={scrollRef} onScroll={onScroll}>
        <div style={{ minWidth: totalWidth }}>

          {/* Sticky header */}
          {/* Sticky header row */}
          <div
            className="flex text-white text-[11px] font-semibold select-none bg-transparent sticky top-0 z-30"
            style={{ height: HEADER_HEIGHT }}
          >

            {/* Row number col */}
            <div className="sticky top-0 left-0 z-40 flex-shrink-0 w-10 flex items-center justify-center bg-[#1e3a5f] text-white/40 border-r border-white/10 text-[10px]">#</div>



            {COLUMNS.map((col) => {
              // ALL header cells must stick to the top
              const stickyStyle: React.CSSProperties = { top: 0, zIndex: 20 };
              let extraClasses = "sticky bg-[#1e3a5f]";

              // Corner columns also stick to the left and have higher z-index
              if (col.key === 'activity_number') {
                stickyStyle.left = 40;
                stickyStyle.zIndex = 40;
              } else if (col.key === 'description') {
                const hasId = COLUMNS.some(c => c.key === 'activity_number');
                stickyStyle.left = hasId ? 130 : 40; // 40 + 90
                stickyStyle.zIndex = 40;
              }

              return (
                <div
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width, ...stickyStyle }}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  className={`flex items-center gap-1 px-3 border-r border-white/10 flex-shrink-0 overflow-hidden ${col.sortable ? 'cursor-pointer hover:bg-white/10' : ''} ${extraClasses}`}
                >
                  <span className="truncate">{col.label}</span>
                  {col.sortable && sortKey === col.key && (
                    <svg className="w-3 h-3 flex-shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      {sortDir === 'asc'
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* Virtual scroll body */}
          <div style={{ height: totalHeight, position: 'relative' }}>
            {/* Top spacer */}
            <div style={{ height: startIdx * ROW_HEIGHT }} />

            {/* Visible rows */}
            {visibleRows.map((act: any, localIdx: number) => {
              const globalIdx = startIdx + localIdx;
              const isEven = globalIdx % 2 === 0;
              const isEditing = editingId === act.id;
              const isSummary = act._isSummary;
              const depth = act._wbsDepth || 0;

              const isSelected = selectedId === act.id;

              let rowClass = `flex items-center text-[12px] border-b hover:bg-blue-50/40 transition-colors cursor-default ${isSelected ? 'bg-blue-600/10 ring-1 ring-inset ring-blue-600/30 z-30' : ''} `;
              let numColClass = `flex-shrink-0 w-10 flex items-center justify-center text-[10px] tabular-nums `;
              let cellBorderClass = `border-r flex-shrink-0 overflow-hidden h-full `;

              if (isSummary) {
                 if (depth === 0) { rowClass += 'bg-[#98b8d9] text-[#0f2847] border-[#81a1c2]'; cellBorderClass += 'border-[#81a1c2]'; numColClass += 'text-[#3c5a7d] border-[#81a1c2]'; }
                 else if (depth === 1) { rowClass += 'bg-[#b6d1ac] text-[#1c3812] border-[#a0bb96]'; cellBorderClass += 'border-[#a0bb96]'; numColClass += 'text-[#446338] border-[#a0bb96]'; }
                 else if (depth === 2) { rowClass += 'bg-[#d9d598] text-[#3d3a0f] border-[#c2be82]'; cellBorderClass += 'border-[#c2be82]'; numColClass += 'text-[#6e6a32] border-[#c2be82]'; }
                 else if (depth === 3) { rowClass += 'bg-[#e0b894] text-[#4f2a08] border-[#c99f7a]'; cellBorderClass += 'border-[#c99f7a]'; numColClass += 'text-[#855328] border-[#c99f7a]'; }
                 else { rowClass += 'bg-[#d4add9] text-[#3f1945] border-[#be97c4]'; cellBorderClass += 'border-[#be97c4]'; numColClass += 'text-[#733e7a] border-[#be97c4]'; }
              } else {
                 rowClass += (isEven ? 'bg-white text-gray-800 border-gray-100' : 'bg-gray-50/60 text-gray-800 border-gray-100');
                 cellBorderClass += 'border-gray-100';
                 numColClass += 'text-gray-300 border-gray-100';
              }

              return (
                <div
                  key={act.id}
                  className={rowClass}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Row number */}
                  <div className={`sticky left-0 z-10 border-r border-white/5 flex-shrink-0 w-10 flex items-center justify-center text-[10px] tabular-nums ${isSelected ? 'bg-blue-100' : (isSummary ? 'bg-inherit' : (isEven ? 'bg-white' : 'bg-gray-50'))} ${!isSummary ? 'text-gray-300' : ''}`}>
                    {globalIdx + 1}
                  </div>

                  {COLUMNS.map(col => {
                    const isDateField = ['planned_start', 'planned_end', 'actual_start', 'actual_end', 'early_start', 'early_finish', 'late_start', 'late_finish'].includes(col.key);
                    const isNumericValue = ['duration_hours', 'actual_duration', 'remaining_duration', 'crew_size', 'progress_percent', 'physical_percent_complete', 'duration_percent_complete', 'unit_percent_complete', 'sequence_number', 'total_float', 'free_float'].includes(col.key);
                    let editableFields = [
                      'activity_number', 'description', 'responsible', 'discipline', 'notes', 
                      'crew_size', 'duration_hours', 'actual_duration', 'remaining_duration',
                    ];
                    if (isIntegratedContractor) {
                       editableFields = [];
                    }
                    const isEditable = editableFields.includes(col.key);

                    // Sticky style for cells
                    let stickyStyle: React.CSSProperties = {};
                    let stickyClass = "";
                    if (col.key === 'activity_number') {
                      stickyStyle = { left: 40, zIndex: 10 };
                      stickyClass = `sticky ${isSelected ? 'bg-blue-50' : (isSummary ? 'bg-inherit' : (isEven ? 'bg-white' : 'bg-gray-50'))}`;
                    } else if (col.key === 'description') {
                      const hasId = COLUMNS.some(c => c.key === 'activity_number');
                      stickyStyle = { left: hasId ? 40 + 90 : 40, zIndex: 10 };
                      stickyClass = `sticky ${isSelected ? 'bg-blue-50' : (isSummary ? 'bg-inherit' : (isEven ? 'bg-white' : 'bg-gray-50/60'))}`;
                    }

                    return (
                    <div
                      key={col.key}
                      style={{ width: col.width, minWidth: col.width, ...stickyStyle }}
                      className={`relative flex items-center px-3 ${cellBorderClass} ${isEditable && !isSummary ? 'cursor-default' : ''} ${stickyClass}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSummary && (col.key === 'planned_start' || col.key === 'planned_end')) {
                          startEdit(act.id, col.key, act[col.key]);
                          return;
                        }
                        if (selectedId === act.id && isEditable && !isSummary) {
                          startEdit(act.id, col.key, act[col.key]);
                          if (isDateField) setEditCellRect((e.currentTarget as HTMLElement).getBoundingClientRect());
                        } else {
                          setSelectedId(act.id);
                          setEditingId(null);
                          setPickerAnchorRect(null);
                          setEditCellRect(null);
                          setDatePreview(null);
                        }
                      }}
                      onDoubleClick={(e) => {
                        if (!isSummary && (col.key === 'planned_start' || col.key === 'planned_end')) {
                          startEdit(act.id, col.key, act[col.key]);
                          return;
                        }
                        if (!isEditable || isSummary) return;
                        startEdit(act.id, col.key, act[col.key]);
                        if (isDateField) {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setPickerAnchorRect(rect);
                          setEditCellRect(rect);
                        }
                      }}
                    >
                      {/* Always render content behind overlay */}
                      <div className={`w-full overflow-hidden flex items-center ${
                        isEditing && editField === col.key && isDateField ? 'opacity-30' : ''
                      }`}>
                        {renderCell(act, col.key)}
                      </div>

                      {/* Non-date fields: text/number/select overlay */}
                      {isEditing && editField === col.key && !isDateField && (
                        editField === 'status' ? (
                          <select
                            autoFocus
                            className="absolute inset-0 w-full h-full text-[12px] px-3 bg-blue-50 border-0 border-b-2 border-blue-500 outline-none font-medium cursor-pointer z-20"
                            value={editValue}
                            onChange={e => setEditValueSt(e.target.value)}
                            onBlur={() => commitEdit(act.id)}
                            onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }}
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="on_hold">On Hold</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={isNumericValue ? 'number' : 'text'}
                            step="any"
                            className="absolute inset-0 w-full h-full text-[12px] px-3 bg-blue-50 border-0 border-b-2 border-blue-500 outline-none font-medium z-20"
                            value={editValue}
                            onChange={e => setEditValueSt(e.target.value)}
                            onBlur={() => commitEdit(act.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  commitEdit(act.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                        )
                      )}

                      {/* Date fields — Excel-like natural input + calendar companion */}
                      {isEditing && editField === col.key && isDateField && (
                        <input
                          autoFocus
                          type="text"
                          placeholder="2 Apr · 2 Apr 25 · 2/4 · YYYY-MM-DD"
                          className="absolute inset-0 w-full h-full text-[11px] px-2 bg-blue-50 border-0 border-b-2 border-blue-500 outline-none font-mono z-20"
                          onFocus={e => (e.target as HTMLInputElement).select()}
                          value={editValue}
                          onChange={e => setEditValueSt(e.target.value)}
                          onBlur={e => {
                            const raw  = e.target.value.trim();
                            const cyTz = getPartsInTz(new Date(), siteTimezone).year;
                            const parsed = parseNaturalDate(raw, cyTz) ?? raw;
                            commitEdit(act.id, parsed);
                          }}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              const raw  = (e.target as HTMLInputElement).value.trim();
                              const cyTz = getPartsInTz(new Date(), siteTimezone).year;
                              const parsed = parseNaturalDate(raw, cyTz) ?? raw;
                              commitEdit(act.id, parsed);
                            }
                            if (e.key === 'Escape') {
                              setEditingId(null);
                              setPickerAnchorRect(null);
                              setEditCellRect(null);
                            }
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">{search ? 'No activities match your search.' : 'No activities found.'}</p>
            </div>
          )}
          </div>
        </div>
      )}
    </div>

      {/* ── Footer status bar ─────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-1.5 bg-[#1e3a5f] text-white/60 text-[11px] border-t border-gray-200 uppercase tracking-tighter">
        <span>{statActivities.length.toLocaleString()} pure activities</span>
        <span className="mx-1 text-white/20">|</span>
        <span>
          {completedCount} completed ·{' '}
          {inProgressCount} in progress ·{' '}
          {notStartedCount} not started
        </span>
        <span className="ml-auto text-white/30 text-[10px] normal-case tracking-normal">
          {isIntegratedContractor
            ? 'Click status/progress to update your assigned work'
            : 'Double-click any cell to edit · Single-click to select · Click header to sort'}
        </span>
      </div>

      {/* 12.4 — Resource Histogram panel */}
      {showHistogram && (
        <div className="border-t border-gray-200 bg-white">
          <ResourceHistogram />
        </div>
      )}

      {/* Sprint 11 — S-Curve panel */}
      {showSCurve && projectId && (
        <ProjectSCurveChart projectId={projectId} />
      )}

      {/* P6-style Date/Time Picker portal */}
      {/* P6-style Date/Time Picker portal */}
      {overrideTarget && (
        <PlannedDateOverrideDialog
          activityId={overrideTarget.activityId}
          field={overrideTarget.field}
          label={overrideTarget.label}
          currentValue={overrideTarget.currentValue}
          derivedValue={overrideTarget.derivedValue}
          onClose={() => setOverrideTarget(null)}
          onApplied={() => mutate()}
        />
      )}

      {editingId && pickerAnchorRect && ['actual_start', 'actual_end'].includes(editField) && (
        <DateTimePicker
          value={editValue || new Date().toISOString()}
          onChange={(iso) => setEditValueSt(iso)}
          onCommit={() => commitEdit(editingId)}
          onCancel={() => { setEditingId(null); setPickerAnchorRect(null); }}
          anchorRect={pickerAnchorRect}
          siteTimezone={siteTimezone}
        />
      )}

      {/* Modals area (rendered regardless of view) */}
      {maintainBaselinesOpen && (
        <MaintainBaselinesModal
          projectId={projectId || ''}
          projects={projects}
          isOpen={maintainBaselinesOpen}
          onClose={() => setMaintainBaselinesOpen(false)}
        />
      )}

      {assignBaselinesOpen && (
        <AssignBaselinesModal
          projectId={projectId || ''}
          projects={projects}
          isOpen={assignBaselinesOpen}
          onClose={() => setAssignBaselinesOpen(false)}
        />
      )}

      {/* OD9.2 §6: LevelingPreviewModal is intentionally not rendered here. See the
          note on the removed "Level" toolbar button above. */}
    </div>
  );
}
