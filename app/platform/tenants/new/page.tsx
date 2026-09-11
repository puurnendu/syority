'use client';

/**
 * M7.7 — Tenant Provisioning Wizard
 *
 * 7-step wizard for provisioning a complete tenant:
 * 1. Company Information
 * 2. License
 * 3. Organization Structure
 * 4. Primary Site
 * 5. Administrator
 * 6. Configuration
 * 7. Review & Provision
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

// ─── Defaults from config ────────────────────────────────────────────────────

const INDUSTRIES = [
  'Oil & Gas Refinery', 'Petrochemical', 'Chemical Processing', 'Power Generation',
  'LNG / Gas Processing', 'Mining & Minerals', 'Pharmaceutical', 'Water & Wastewater',
  'Pulp & Paper', 'Steel & Metals', 'Fertilizer', 'Cement', 'Food & Beverage', 'Other',
];

const TIMEZONES = [
  'UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Houston', 'Australia/Sydney',
  'Australia/Perth', 'Africa/Lagos', 'Africa/Johannesburg',
];

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar' }, { code: 'EUR', label: 'Euro' }, { code: 'GBP', label: 'British Pound' },
  { code: 'INR', label: 'Indian Rupee' }, { code: 'AED', label: 'UAE Dirham' }, { code: 'SAR', label: 'Saudi Riyal' },
  { code: 'SGD', label: 'Singapore Dollar' }, { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' }, { code: 'JPY', label: 'Japanese Yen' },
];

const LICENSE_TYPES = [
  { value: 'professional', label: 'Professional', desc: 'Up to 50 users, 10 shutdowns, 50 GB storage', seats: 50 },
  { value: 'enterprise', label: 'Enterprise', desc: 'Up to 200 users, 50 shutdowns, 200 GB storage', seats: 200 },
  { value: 'unlimited', label: 'Unlimited', desc: 'No limits on users, shutdowns, or storage', seats: 999999 },
];

const MODULES = [
  { slug: 'shutdown_scope', label: 'Shutdown Scope' }, { slug: 'planner_workspace', label: 'Planning' },
  { slug: 'digital_plant', label: 'Digital Plant' }, { slug: 'engineering_issues', label: 'Engineering Issues' },
  { slug: 'knowledge_engine', label: 'Knowledge Engine' }, { slug: 'ois', label: 'OIS' },
  { slug: 'bre', label: 'Business Rules Engine' }, { slug: 'report_builder', label: 'Report Builder' },
  { slug: 'report_engine', label: 'Report Engine' }, { slug: 'notification_platform', label: 'Notifications' },
  { slug: 'safety', label: 'Safety Management' }, { slug: 'asset_register', label: 'Asset Register' },
  { slug: 'workpack_intelligence', label: 'Workpack Intelligence' },
];

const DEFAULT_DISCIPLINES = [
  'MECH', 'ELEC', 'INST', 'PIPE', 'CIVL', 'HVAC', 'ROTG', 'SCAF', 'INSU', 'PNTG',
];

const DISC_LABELS: Record<string, string> = {
  MECH: 'Mechanical', ELEC: 'Electrical', INST: 'Instrumentation', PIPE: 'Piping',
  CIVL: 'Civil', HVAC: 'HVAC', ROTG: 'Rotating Equipment', SCAF: 'Scaffolding',
  INSU: 'Insulation', PNTG: 'Painting / Coating',
};

const STEPS = [
  'Company', 'License', 'Structure', 'Site', 'Admin', 'Config', 'Review',
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlantDef {
  name: string;
  code: string;
  units: UnitDef[];
}
interface UnitDef {
  name: string;
  code: string;
  systems: { name: string; code: string }[];
}

interface WizardData {
  company: {
    name: string; shortName: string; slug: string; industry: string;
    country: string; timezone: string; currency: string; language: string;
    primaryColor: string; platformName: string;
  };
  license: {
    type: string; seatCount: number; expiresAt: string;
    enabledModules: string[]; aiCredits: number; storageQuotaGb: number; documentQuota: number;
  };
  hierarchy: { plants: PlantDef[]; disciplines: string[] };
  site: { name: string; code: string; address: string; country: string; timezone: string };
  admin: {
    name: string; email: string; phone: string; tempPassword: string;
    mustChangePassword: boolean; sendWelcomeEmail: boolean;
  };
  config: { smtpHost: string; aiProvider: string; storageProvider: string; reportTheme: string };
}

const initialData: WizardData = {
  company: {
    name: '', shortName: '', slug: '', industry: 'Oil & Gas Refinery',
    country: '', timezone: 'UTC', currency: 'USD', language: 'en',
    primaryColor: '#4F46E5', platformName: '',
  },
  license: {
    type: 'professional', seatCount: 50, expiresAt: '',
    enabledModules: MODULES.map((m) => m.slug), aiCredits: 5000,
    storageQuotaGb: 50, documentQuota: 2000,
  },
  hierarchy: {
    plants: [{ name: '', code: '', units: [{ name: '', code: '', systems: [] }] }],
    disciplines: [...DEFAULT_DISCIPLINES],
  },
  site: { name: '', code: '', address: '', country: '', timezone: 'UTC' },
  admin: { name: '', email: '', phone: '', tempPassword: '', mustChangePassword: true, sendWelcomeEmail: true },
  config: { smtpHost: '', aiProvider: '', storageProvider: '', reportTheme: '' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 40);
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

export default function TenantProvisioningWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialData);
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-generate slug from company name
  useEffect(() => {
    if (data.company.name && !data.company.slug) {
      setData((d) => ({ ...d, company: { ...d.company, slug: slugify(d.company.name) } }));
    }
  }, [data.company.name, data.company.slug]);

  // Check slug availability
  const checkSlug = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) { setSlugAvailable(null); return; }
    try {
      const res = await fetch(`/api/admin/tenants/provision?check=slug&value=${encodeURIComponent(slug)}`);
      const d = await res.json();
      setSlugAvailable(d.available);
    } catch { setSlugAvailable(null); }
  }, []);

  // Check email availability
  const checkEmail = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) { setEmailAvailable(null); return; }
    try {
      const res = await fetch(`/api/admin/tenants/provision?check=email&value=${encodeURIComponent(email)}`);
      const d = await res.json();
      setEmailAvailable(d.available);
    } catch { setEmailAvailable(null); }
  }, []);

  function updateCompany(field: string, value: string) {
    setData((d) => {
      const updated = { ...d, company: { ...d.company, [field]: value } };
      if (field === 'name') {
        updated.company.slug = slugify(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => checkSlug(slugify(value)), 500);
      }
      if (field === 'slug') {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => checkSlug(value), 500);
      }
      return updated;
    });
  }

  function updateLicense(field: string, value: any) {
    setData((d) => {
      const updated = { ...d, license: { ...d.license, [field]: value } };
      if (field === 'type') {
        const lt = LICENSE_TYPES.find((t) => t.value === value);
        if (lt) updated.license.seatCount = lt.seats;
      }
      return updated;
    });
  }

  function toggleModule(slug: string) {
    setData((d) => {
      const mods = d.license.enabledModules.includes(slug)
        ? d.license.enabledModules.filter((m) => m !== slug)
        : [...d.license.enabledModules, slug];
      return { ...d, license: { ...d.license, enabledModules: mods } };
    });
  }

  function toggleDiscipline(code: string) {
    setData((d) => {
      const discs = d.hierarchy.disciplines.includes(code)
        ? d.hierarchy.disciplines.filter((c) => c !== code)
        : [...d.hierarchy.disciplines, code];
      return { ...d, hierarchy: { ...d.hierarchy, disciplines: discs } };
    });
  }

  // ─── Plant / Unit / System CRUD ────────────────────────────────────────────

  function addPlant() {
    setData((d) => ({
      ...d,
      hierarchy: {
        ...d.hierarchy,
        plants: [...d.hierarchy.plants, { name: '', code: '', units: [] }],
      },
    }));
  }

  function removePlant(idx: number) {
    setData((d) => ({
      ...d,
      hierarchy: {
        ...d.hierarchy,
        plants: d.hierarchy.plants.filter((_, i) => i !== idx),
      },
    }));
  }

  function updatePlant(idx: number, field: string, value: string) {
    setData((d) => {
      const plants = [...d.hierarchy.plants];
      plants[idx] = { ...plants[idx], [field]: value };
      return { ...d, hierarchy: { ...d.hierarchy, plants } };
    });
  }

  function addUnit(plantIdx: number) {
    setData((d) => {
      const plants = [...d.hierarchy.plants];
      plants[plantIdx] = {
        ...plants[plantIdx],
        units: [...plants[plantIdx].units, { name: '', code: '', systems: [] }],
      };
      return { ...d, hierarchy: { ...d.hierarchy, plants } };
    });
  }

  function removeUnit(plantIdx: number, unitIdx: number) {
    setData((d) => {
      const plants = [...d.hierarchy.plants];
      plants[plantIdx] = {
        ...plants[plantIdx],
        units: plants[plantIdx].units.filter((_, i) => i !== unitIdx),
      };
      return { ...d, hierarchy: { ...d.hierarchy, plants } };
    });
  }

  function updateUnit(plantIdx: number, unitIdx: number, field: string, value: string) {
    setData((d) => {
      const plants = [...d.hierarchy.plants];
      const units = [...plants[plantIdx].units];
      units[unitIdx] = { ...units[unitIdx], [field]: value };
      plants[plantIdx] = { ...plants[plantIdx], units };
      return { ...d, hierarchy: { ...d.hierarchy, plants } };
    });
  }

  function addSystem(plantIdx: number, unitIdx: number) {
    setData((d) => {
      const plants = [...d.hierarchy.plants];
      const units = [...plants[plantIdx].units];
      units[unitIdx] = {
        ...units[unitIdx],
        systems: [...units[unitIdx].systems, { name: '', code: '' }],
      };
      plants[plantIdx] = { ...plants[plantIdx], units };
      return { ...d, hierarchy: { ...d.hierarchy, plants } };
    });
  }

  function removeSystem(plantIdx: number, unitIdx: number, sysIdx: number) {
    setData((d) => {
      const plants = [...d.hierarchy.plants];
      const units = [...plants[plantIdx].units];
      units[unitIdx] = {
        ...units[unitIdx],
        systems: units[unitIdx].systems.filter((_, i) => i !== sysIdx),
      };
      plants[plantIdx] = { ...plants[plantIdx], units };
      return { ...d, hierarchy: { ...d.hierarchy, plants } };
    });
  }

  function updateSystem(plantIdx: number, unitIdx: number, sysIdx: number, field: string, value: string) {
    setData((d) => {
      const plants = [...d.hierarchy.plants];
      const units = [...plants[plantIdx].units];
      const systems = [...units[unitIdx].systems];
      systems[sysIdx] = { ...systems[sysIdx], [field]: value };
      units[unitIdx] = { ...units[unitIdx], systems };
      plants[plantIdx] = { ...plants[plantIdx], units };
      return { ...d, hierarchy: { ...d.hierarchy, plants } };
    });
  }

  // ─── Provision ─────────────────────────────────────────────────────────────

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  async function handleProvision() {
    setProvisioning(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setJobProgress(null);
    try {
      const res = await fetch('/api/admin/tenants/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, mode: 'async' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || json.details || 'Failed to start provisioning');
        setProvisioning(false);
        return;
      }
      if (json.jobId) {
        setJobId(json.jobId);
        // Start polling
        progressInterval.current = setInterval(async () => {
          try {
            const pRes = await fetch(`/api/admin/tenants/provision/${json.jobId}`);
            const pJson = await pRes.json();
            setJobProgress(pJson);
            if (['completed', 'failed', 'cancelled', 'rolled_back'].includes(pJson.status)) {
              if (progressInterval.current) clearInterval(progressInterval.current);
              setProvisioning(false);
              if (pJson.status === 'completed') {
                setResult(pJson);
              }
            }
          } catch {
            // Ignore poll errors
          }
        }, 2000);
      } else {
        // Legacy sync mode fallback
        if (json.success) {
          setResult(json);
        } else {
          setError(json.error || 'Provisioning failed');
        }
        setProvisioning(false);
      }
    } catch (err: any) {
      setError(err.message);
      setProvisioning(false);
    }
  }

  async function handleJobAction(action: string) {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/admin/tenants/provision/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // ─── Step Validation ───────────────────────────────────────────────────────

  function canProceed(): boolean {
    switch (step) {
      case 0: return !!data.company.name.trim() && !!data.company.slug.trim();
      case 1: return !!data.license.type;
      case 2: return true; // hierarchy is optional
      case 3: return !!data.site.name.trim() && !!data.site.code.trim();
      case 4: return !!data.admin.name.trim() && !!data.admin.email.trim() && data.admin.tempPassword.length >= 8;
      case 5: return true; // config is optional
      case 6: return true;
      default: return false;
    }
  }

  // ─── Input helper ──────────────────────────────────────────────────────────

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1';
  const sectionCls = 'space-y-4';

  // Provisioning step labels
  const STEP_LABELS: Record<string, string> = {
    organization: '🏢 Organization',
    site: '🏭 Site',
    roles: '🔑 Roles',
    users: '👤 Admin User',
    hierarchy: '🏗️ Hierarchy',
    disciplines: '📐 Disciplines',
    equipment_types: '🔧 Equipment Types',
    calendars: '📅 Calendars',
    templates: '📋 Templates',
    seed_packs: '🌱 Seed Packs',
    modules: '📦 Modules',
    license: '💳 License',
    notifications: '📧 Notifications',
  };
  const ALL_PROV_STEPS = ['organization', 'site', 'roles', 'users', 'hierarchy', 'disciplines', 'equipment_types', 'calendars', 'templates', 'seed_packs', 'modules', 'license', 'notifications'];

  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════

  // Live provisioning dashboard
  if (jobId && jobProgress && !result) {
    const jp = jobProgress;
    const completedSteps = jp.completedSteps ?? [];
    const elapsed = jp.startedAt ? Math.round((Date.now() - new Date(jp.startedAt).getTime()) / 1000) : 0;

    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">{jp.status === 'failed' ? '❌' : jp.status === 'cancelled' ? '⏹️' : '⚙️'}</div>
            <h1 className="text-xl font-bold text-gray-900">
              {jp.status === 'failed' ? 'Provisioning Failed' :
               jp.status === 'cancelled' ? 'Provisioning Cancelled' :
               'Provisioning in Progress...'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {jp.status === 'running' || jp.status === 'starting'
                ? `Step: ${STEP_LABELS[jp.currentStep] ?? jp.currentStep ?? 'Starting...'}`
                : jp.status === 'failed'
                ? jp.error
                : `Status: ${jp.status}`}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                jp.status === 'failed' ? 'bg-red-500' :
                jp.status === 'cancelled' ? 'bg-gray-400' : 'bg-blue-600'
              }`}
              style={{ width: `${jp.progressPct}%` }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-gray-900">{jp.progressPct}%</div>
              <div className="text-xs text-gray-500">Progress</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-gray-900">{elapsed}s</div>
              <div className="text-xs text-gray-500">Elapsed</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-black text-gray-900">{completedSteps.length}/{ALL_PROV_STEPS.length}</div>
              <div className="text-xs text-gray-500">Steps</div>
            </div>
          </div>

          {/* Step checklist */}
          <div className="space-y-1.5 mb-6">
            {ALL_PROV_STEPS.map((s) => {
              const isCompleted = completedSteps.includes(s);
              const isCurrent = jp.currentStep === s && !isCompleted;
              const isFailed = jp.failedStep === s;
              return (
                <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  isFailed ? 'bg-red-50 text-red-700' :
                  isCurrent ? 'bg-blue-50 text-blue-700 font-medium' :
                  isCompleted ? 'bg-green-50 text-green-700' : 'text-gray-400'
                }`}>
                  <span className="w-5 text-center">
                    {isFailed ? '❌' : isCompleted ? '✔' : isCurrent ? '⏳' : '○'}
                  </span>
                  {STEP_LABELS[s] ?? s}
                </div>
              );
            })}
          </div>

          {/* Log viewer */}
          {jp.logs && jp.logs.length > 0 && (
            <details className="mb-6">
              <summary className="text-sm font-medium text-gray-600 cursor-pointer">View Logs ({jp.logs.length})</summary>
              <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-1 text-xs font-mono text-gray-600 max-h-48 overflow-y-auto">
                {jp.logs.map((log: any, i: number) => (
                  <div key={i} className={log.status === 'failed' ? 'text-red-600' : ''}>
                    [{log.step}] {log.status} — {log.message ?? ''} {log.durationMs ? `(${log.durationMs}ms)` : ''}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            {(jp.status === 'running' || jp.status === 'starting') && (
              <button
                onClick={() => handleJobAction('cancel')}
                className="px-5 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100"
              >
                Cancel
              </button>
            )}
            {jp.status === 'failed' && (
              <>
                <button
                  onClick={() => { handleJobAction('retry'); setProvisioning(true); if (!progressInterval.current) progressInterval.current = setInterval(async () => { try { const r = await fetch(`/api/admin/tenants/provision/${jobId}`); const j = await r.json(); setJobProgress(j); if (['completed','failed','cancelled','rolled_back'].includes(j.status)) { if (progressInterval.current) clearInterval(progressInterval.current); setProvisioning(false); if (j.status==='completed') setResult(j); } } catch {} }, 2000); }}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
                <button
                  onClick={() => handleJobAction('resume')}
                  className="px-5 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100"
                >
                  Resume
                </button>
                <button
                  onClick={() => handleJobAction('rollback')}
                  className="px-5 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100"
                >
                  Rollback
                </button>
              </>
            )}
            <Link
              href="/platform/tenants"
              className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
            >
              Back to Tenants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success screen
  if (result) {
    const summary = result.summary ?? {};
    const isAsync = !!result.organizationId;
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Provisioned</h1>
          <p className="text-gray-500 mt-2">
            <strong>{summary.organization ?? data.company.name}</strong> is ready for use.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            {[
              { label: 'Plants', value: summary.plants ?? 0 },
              { label: 'Units', value: summary.units ?? 0 },
              { label: 'Systems', value: summary.systems ?? 0 },
              { label: 'Roles', value: summary.roles ?? 0 },
              { label: 'Disciplines', value: summary.disciplines ?? 0 },
              { label: 'Equipment Types', value: summary.equipmentTypes ?? 0 },
              { label: 'Modules', value: summary.modules ?? 0 },
              { label: 'Steps', value: (result.completedSteps ?? result.auditLog ?? []).length },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xl font-black text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Logs */}
          {(result.logs ?? result.auditLog ?? []).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 mt-6 text-left">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Provisioning Log</h3>
              <div className="space-y-1 text-xs text-gray-600 font-mono max-h-48 overflow-y-auto">
                {(result.logs ?? result.auditLog ?? []).map((line: any, i: number) => (
                  <div key={i}>{typeof line === 'string' ? line : `[${line.step}] ${line.status} — ${line.message ?? ''}`}</div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center mt-8">
            {(result.organizationId) && (
              <Link
                href={`/platform/tenants/${result.organizationId}`}
                className="px-6 py-2.5 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]"
              >
                Open Tenant
              </Link>
            )}
            <Link
              href="/platform/tenants"
              className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
            >
              Back to Tenants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href="/platform/tenants" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Tenants
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mt-3">Provision New Tenant</h1>
      <p className="text-sm text-gray-500 mt-1">Complete the wizard to create a fully isolated tenant.</p>

      {/* ─── Progress Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mt-6 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
                ${i === step ? 'bg-[#0D2137] text-white scale-110' : ''}
                ${i < step ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600' : ''}
                ${i > step ? 'bg-gray-200 text-gray-400' : ''}
              `}
            >
              {i < step ? '✓' : i + 1}
            </button>
            <span className={`ml-1.5 text-xs font-medium hidden sm:inline ${i === step ? 'text-gray-900' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── Step Content ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-[400px]">

        {/* Step 1: Company */}
        {step === 0 && (
          <div className={sectionCls}>
            <h2 className="text-lg font-bold text-gray-900">Company Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Company Name *</label>
                <input className={inputCls} value={data.company.name} placeholder="Acme Refinery Corp"
                  onChange={(e) => updateCompany('name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Short Name</label>
                <input className={inputCls} value={data.company.shortName} placeholder="ARC"
                  onChange={(e) => updateCompany('shortName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Slug *</label>
                <div className="relative">
                  <input className={inputCls} value={data.company.slug} placeholder="acme-refinery"
                    onChange={(e) => updateCompany('slug', slugify(e.target.value))} />
                  {slugAvailable !== null && (
                    <span className={`absolute right-3 top-2 text-sm ${slugAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      {slugAvailable ? '✓ available' : '✕ taken'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Industry</label>
                <select className={inputCls} value={data.company.industry}
                  onChange={(e) => updateCompany('industry', e.target.value)}>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input className={inputCls} value={data.company.country} placeholder="Saudi Arabia"
                  onChange={(e) => updateCompany('country', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Timezone</label>
                <select className={inputCls} value={data.company.timezone}
                  onChange={(e) => updateCompany('timezone', e.target.value)}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <select className={inputCls} value={data.company.currency}
                  onChange={(e) => updateCompany('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Brand Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={data.company.primaryColor}
                    onChange={(e) => updateCompany('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
                  <input className={inputCls} value={data.company.primaryColor}
                    onChange={(e) => updateCompany('primaryColor', e.target.value)}
                    style={{ flex: 1 }} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Platform Name Override</label>
                <input className={inputCls} value={data.company.platformName} placeholder="SYORITY (default)"
                  onChange={(e) => updateCompany('platformName', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: License */}
        {step === 1 && (
          <div className={sectionCls}>
            <h2 className="text-lg font-bold text-gray-900">License</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LICENSE_TYPES.map((lt) => (
                <button key={lt.value}
                  onClick={() => updateLicense('type', lt.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    data.license.type === lt.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-gray-900">{lt.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{lt.desc}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div>
                <label className={labelCls}>Seat Count</label>
                <input type="number" className={inputCls} value={data.license.seatCount}
                  onChange={(e) => updateLicense('seatCount', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className={labelCls}>Expiry Date</label>
                <input type="date" className={inputCls} value={data.license.expiresAt}
                  onChange={(e) => updateLicense('expiresAt', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>AI Credits</label>
                <input type="number" className={inputCls} value={data.license.aiCredits}
                  onChange={(e) => updateLicense('aiCredits', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className={labelCls}>Storage (GB)</label>
                <input type="number" className={inputCls} value={data.license.storageQuotaGb}
                  onChange={(e) => updateLicense('storageQuotaGb', parseInt(e.target.value) || 0)} />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Enabled Modules</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {MODULES.map((m) => (
                  <label key={m.slug} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={data.license.enabledModules.includes(m.slug)}
                      onChange={() => toggleModule(m.slug)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                    <span className="text-sm text-gray-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Organization Structure */}
        {step === 2 && (
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Organization Structure</h2>
              <button onClick={addPlant}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100">
                + Add Plant
              </button>
            </div>

            {data.hierarchy.plants.map((plant, pi) => (
              <div key={pi} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">Plant {pi + 1}</span>
                  {data.hierarchy.plants.length > 1 && (
                    <button onClick={() => removePlant(pi)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Plant Name</label>
                    <input className={inputCls} value={plant.name} placeholder="CDU Plant"
                      onChange={(e) => updatePlant(pi, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Plant Code</label>
                    <input className={inputCls} value={plant.code} placeholder="CDU"
                      onChange={(e) => updatePlant(pi, 'code', e.target.value.toUpperCase())} />
                  </div>
                </div>

                {/* Units */}
                {plant.units.map((unit, ui) => (
                  <div key={ui} className="ml-4 border-l-2 border-blue-200 pl-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400">Unit {ui + 1}</span>
                      <button onClick={() => removeUnit(pi, ui)} className="text-xs text-red-400 hover:text-red-600">×</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input className={inputCls} value={unit.name} placeholder="Distillation Unit"
                        onChange={(e) => updateUnit(pi, ui, 'name', e.target.value)} />
                      <input className={inputCls} value={unit.code} placeholder="DU-01"
                        onChange={(e) => updateUnit(pi, ui, 'code', e.target.value.toUpperCase())} />
                    </div>

                    {/* Systems */}
                    {unit.systems.map((sys, si) => (
                      <div key={si} className="ml-4 flex gap-2 items-center">
                        <input className={`${inputCls} flex-1`} value={sys.name} placeholder="System name"
                          onChange={(e) => updateSystem(pi, ui, si, 'name', e.target.value)} />
                        <input className={`${inputCls} w-28`} value={sys.code} placeholder="Code"
                          onChange={(e) => updateSystem(pi, ui, si, 'code', e.target.value.toUpperCase())} />
                        <button onClick={() => removeSystem(pi, ui, si)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                      </div>
                    ))}
                    <button onClick={() => addSystem(pi, ui)}
                      className="ml-4 text-xs text-gray-400 hover:text-gray-600">+ System</button>
                  </div>
                ))}
                <button onClick={() => addUnit(pi)}
                  className="ml-4 text-xs text-blue-500 hover:text-blue-700">+ Add Unit</button>
              </div>
            ))}

            {/* Disciplines */}
            <div className="mt-4">
              <label className={labelCls}>Disciplines</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1">
                {DEFAULT_DISCIPLINES.map((code) => (
                  <label key={code} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={data.hierarchy.disciplines.includes(code)}
                      onChange={() => toggleDiscipline(code)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                    <span className="text-xs text-gray-700">{DISC_LABELS[code]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Site */}
        {step === 3 && (
          <div className={sectionCls}>
            <h2 className="text-lg font-bold text-gray-900">Primary Site</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Site Name *</label>
                <input className={inputCls} value={data.site.name} placeholder="Yanbu Refinery"
                  onChange={(e) => setData((d) => ({ ...d, site: { ...d.site, name: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Site Code *</label>
                <input className={inputCls} value={data.site.code} placeholder="YNB"
                  onChange={(e) => setData((d) => ({ ...d, site: { ...d.site, code: e.target.value.toUpperCase() } }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Address</label>
                <input className={inputCls} value={data.site.address} placeholder="Yanbu Industrial City, Saudi Arabia"
                  onChange={(e) => setData((d) => ({ ...d, site: { ...d.site, address: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input className={inputCls} value={data.site.country} placeholder="Saudi Arabia"
                  onChange={(e) => setData((d) => ({ ...d, site: { ...d.site, country: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Timezone</label>
                <select className={inputCls} value={data.site.timezone}
                  onChange={(e) => setData((d) => ({ ...d, site: { ...d.site, timezone: e.target.value } }))}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Admin */}
        {step === 4 && (
          <div className={sectionCls}>
            <h2 className="text-lg font-bold text-gray-900">Platform Administrator</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input className={inputCls} value={data.admin.name} placeholder="John Smith"
                  onChange={(e) => setData((d) => ({ ...d, admin: { ...d.admin, name: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <div className="relative">
                  <input className={inputCls} type="email" value={data.admin.email} placeholder="admin@acme.com"
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({ ...d, admin: { ...d.admin, email: v } }));
                      if (debounceRef.current) clearTimeout(debounceRef.current);
                      debounceRef.current = setTimeout(() => checkEmail(v), 500);
                    }} />
                  {emailAvailable !== null && (
                    <span className={`absolute right-3 top-2 text-sm ${emailAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      {emailAvailable ? '✓ available' : '✕ taken'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={data.admin.phone} placeholder="+1 555 123 4567"
                  onChange={(e) => setData((d) => ({ ...d, admin: { ...d.admin, phone: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Temporary Password *</label>
                <div className="flex gap-2">
                  <input className={`${inputCls} flex-1 font-mono`} value={data.admin.tempPassword}
                    onChange={(e) => setData((d) => ({ ...d, admin: { ...d.admin, tempPassword: e.target.value } }))} />
                  <button onClick={() => setData((d) => ({ ...d, admin: { ...d.admin, tempPassword: generatePassword() } }))}
                    className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 whitespace-nowrap">
                    Generate
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2 flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={data.admin.mustChangePassword}
                    onChange={(e) => setData((d) => ({ ...d, admin: { ...d.admin, mustChangePassword: e.target.checked } }))}
                    className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Must change password on first login</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={data.admin.sendWelcomeEmail}
                    onChange={(e) => setData((d) => ({ ...d, admin: { ...d.admin, sendWelcomeEmail: e.target.checked } }))}
                    className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Send welcome email</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Configuration */}
        {step === 5 && (
          <div className={sectionCls}>
            <h2 className="text-lg font-bold text-gray-900">Platform Configuration</h2>
            <p className="text-sm text-gray-500">All fields are optional. These can be configured later.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className={labelCls}>SMTP Host</label>
                <input className={inputCls} value={data.config.smtpHost} placeholder="smtp.sendgrid.net"
                  onChange={(e) => setData((d) => ({ ...d, config: { ...d.config, smtpHost: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>AI Provider</label>
                <select className={inputCls} value={data.config.aiProvider}
                  onChange={(e) => setData((d) => ({ ...d, config: { ...d.config, aiProvider: e.target.value } }))}>
                  <option value="">None (default)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Storage Provider</label>
                <select className={inputCls} value={data.config.storageProvider}
                  onChange={(e) => setData((d) => ({ ...d, config: { ...d.config, storageProvider: e.target.value } }))}>
                  <option value="">Local (default)</option>
                  <option value="s3">Amazon S3</option>
                  <option value="gcs">Google Cloud Storage</option>
                  <option value="azure">Azure Blob</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Report Theme</label>
                <select className={inputCls} value={data.config.reportTheme}
                  onChange={(e) => setData((d) => ({ ...d, config: { ...d.config, reportTheme: e.target.value } }))}>
                  <option value="">Default</option>
                  <option value="corporate">Corporate</option>
                  <option value="minimal">Minimal</option>
                  <option value="engineering">Engineering</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Review */}
        {step === 6 && (
          <div className={sectionCls}>
            <h2 className="text-lg font-bold text-gray-900">Review & Provision</h2>
            <p className="text-sm text-gray-500">Review the configuration below. Click Provision to create the tenant.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Company Card */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">🏢 Company</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-500">Name:</span> <span className="font-medium">{data.company.name}</span></div>
                  <div><span className="text-gray-500">Slug:</span> <span className="font-mono text-xs">{data.company.slug}</span></div>
                  <div><span className="text-gray-500">Industry:</span> {data.company.industry || '—'}</div>
                  <div><span className="text-gray-500">Country:</span> {data.company.country || '—'}</div>
                  <div><span className="text-gray-500">Timezone:</span> {data.company.timezone}</div>
                  <div><span className="text-gray-500">Currency:</span> {data.company.currency}</div>
                </div>
              </div>

              {/* License Card */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">📋 License</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{data.license.type}</span></div>
                  <div><span className="text-gray-500">Seats:</span> {data.license.seatCount.toLocaleString()}</div>
                  <div><span className="text-gray-500">Expiry:</span> {data.license.expiresAt || 'No expiry'}</div>
                  <div><span className="text-gray-500">Modules:</span> {data.license.enabledModules.length}</div>
                  <div><span className="text-gray-500">AI Credits:</span> {data.license.aiCredits.toLocaleString()}</div>
                  <div><span className="text-gray-500">Storage:</span> {data.license.storageQuotaGb} GB</div>
                </div>
              </div>

              {/* Hierarchy Card */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">🏭 Structure</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-500">Plants:</span> {data.hierarchy.plants.filter((p) => p.name).length}</div>
                  <div><span className="text-gray-500">Units:</span> {data.hierarchy.plants.reduce((s, p) => s + p.units.filter((u) => u.name).length, 0)}</div>
                  <div><span className="text-gray-500">Systems:</span> {data.hierarchy.plants.reduce((s, p) => s + p.units.reduce((su, u) => su + u.systems.filter((sys) => sys.name).length, 0), 0)}</div>
                  <div><span className="text-gray-500">Disciplines:</span> {data.hierarchy.disciplines.length}</div>
                  <div><span className="text-gray-500">Roles:</span> 10 (default)</div>
                  <div><span className="text-gray-500">Equipment Types:</span> 22 (default)</div>
                </div>
              </div>

              {/* Site Card */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">📍 Site</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-500">Name:</span> <span className="font-medium">{data.site.name}</span></div>
                  <div><span className="text-gray-500">Code:</span> <span className="font-mono">{data.site.code}</span></div>
                  <div><span className="text-gray-500">Address:</span> {data.site.address || '—'}</div>
                  <div><span className="text-gray-500">Country:</span> {data.site.country || '—'}</div>
                  <div><span className="text-gray-500">Timezone:</span> {data.site.timezone}</div>
                </div>
              </div>

              {/* Admin Card */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">👤 Administrator</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-500">Name:</span> <span className="font-medium">{data.admin.name}</span></div>
                  <div><span className="text-gray-500">Email:</span> {data.admin.email}</div>
                  <div><span className="text-gray-500">Phone:</span> {data.admin.phone || '—'}</div>
                  <div><span className="text-gray-500">Must Change Password:</span> {data.admin.mustChangePassword ? 'Yes' : 'No'}</div>
                  <div><span className="text-gray-500">Welcome Email:</span> {data.admin.sendWelcomeEmail ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {/* Config Card */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">⚙️ Configuration</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-500">SMTP:</span> {data.config.smtpHost || 'Not configured'}</div>
                  <div><span className="text-gray-500">AI:</span> {data.config.aiProvider || 'Not configured'}</div>
                  <div><span className="text-gray-500">Storage:</span> {data.config.storageProvider || 'Local'}</div>
                  <div><span className="text-gray-500">Report Theme:</span> {data.config.reportTheme || 'Default'}</div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mt-4">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Navigation ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canProceed()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#0D2137] rounded-lg hover:bg-[#1a3a5c] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleProvision}
            disabled={provisioning}
            className="px-6 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {provisioning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Provisioning…
              </>
            ) : (
              '🚀 Provision Tenant'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
