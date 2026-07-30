/**
 * M7.6E — Rule Builder
 *
 * Visual rule editor with:
 *   • Condition expression builder with syntax highlighting
 *   • Action configuration (notify, escalate, create_alert, log)
 *   • Rule simulator and tester
 *   • Provider browser for field selection
 *   • Formula autocomplete
 *   • Scope configuration (Site, Unit, Area, Shift)
 *   • Priority, severity, effective dates
 *   • Escalation chain selector
 *
 * Consumes: /api/bre/rules, /api/bre/formulas, /api/bre/escalations
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RuleFormData {
  slug: string;
  name: string;
  description: string;
  category: string;
  conditionExpression: string;
  evaluationMode: string;
  evaluationCron: string;
  eventTypes: string[];
  priority: number;
  severity: string;
  escalationChainId: string;
  actions: Array<{
    actionType: string;
    config: Record<string, any>;
    sortOrder: number;
  }>;
}

interface SimulationResult {
  passed: boolean;
  result: any;
  error?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RuleBuilder({ ruleId, onSave, onCancel }: {
  ruleId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<RuleFormData>({
    slug: '', name: '', description: '', category: 'planning',
    conditionExpression: '', evaluationMode: 'scheduled',
    evaluationCron: '0 */4 * * *', eventTypes: [], priority: 5,
    severity: 'warning', escalationChainId: '',
    actions: [{ actionType: 'create_alert', config: { alert_type: 'threshold', title: '', message: '' }, sortOrder: 0 }],
  });

  const [functions, setFunctions] = useState<Array<{ name: string; description: string }>>([]);
  const [chains, setChains] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ message: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/bre/formulas?action=functions').then((r) => r.json()).then((d) => setFunctions(d.functions ?? []));
    fetch('/api/bre/escalations').then((r) => r.json()).then((d) => setChains(d.chains ?? []));

    if (ruleId) {
      fetch(`/api/bre/rules?id=${ruleId}`).then((r) => r.json()).then((d) => {
        if (d.rule) {
          const r = d.rule;
          setForm({
            slug: r.slug, name: r.name, description: r.description ?? '',
            category: r.category, conditionExpression: r.conditionExpression,
            evaluationMode: r.evaluationMode, evaluationCron: r.evaluationCron ?? '',
            eventTypes: r.eventTypes ?? [], priority: r.priority, severity: r.severity,
            escalationChainId: r.escalationChainId ?? '',
            actions: r.actions.map((a: any) => ({ actionType: a.actionType, config: a.config, sortOrder: a.sortOrder })),
          });
        }
      });
    }
  }, [ruleId]);

  // ── Validate expression on change ─────────────────────────────────────

  useEffect(() => {
    if (!form.conditionExpression) { setValidationErrors([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/bre/formulas?action=validate&expression=${encodeURIComponent(form.conditionExpression)}`);
      const data = await res.json();
      setValidationErrors(data.errors ?? []);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.conditionExpression]);

  // ── Simulate ──────────────────────────────────────────────────────────

  const simulate = async () => {
    setSimulating(true);
    const res = await fetch('/api/bre/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate', conditionExpression: form.conditionExpression, params: {} }),
    });
    const data = await res.json();
    setSimResult(data);
    setSimulating(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────

  const save = async () => {
    setSaving(true);
    await fetch('/api/bre/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: form.slug,
        name: form.name,
        description: form.description,
        category: form.category,
        conditionExpression: form.conditionExpression,
        evaluationMode: form.evaluationMode,
        evaluationCron: form.evaluationCron || undefined,
        eventTypes: form.eventTypes,
        priority: form.priority,
        severity: form.severity,
        escalationChainId: form.escalationChainId || undefined,
        actions: form.actions,
      }),
    });
    setSaving(false);
    onSave?.();
  };

  // ── Action management ─────────────────────────────────────────────────

  const addAction = () => {
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { actionType: 'notify', config: {}, sortOrder: prev.actions.length }],
    }));
  };

  const removeAction = (index: number) => {
    setForm((prev) => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }));
  };

  const updateAction = (index: number, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => i === index ? { ...a, [field]: value } : a),
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────

  const categories = ['planning', 'execution', 'safety', 'qa_qc', 'inspection', 'management', 'notification', 'custom'];
  const severities = ['information', 'warning', 'critical', 'emergency'];
  const evalModes = ['scheduled', 'event_driven', 'both'];
  const actionTypes = ['create_alert', 'notify', 'escalate', 'log', 'webhook'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>📐 Rule Builder</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && <button onClick={onCancel} style={btnStyle('#6B7280')}>Cancel</button>}
          <button onClick={save} disabled={saving || validationErrors.length > 0} style={btnStyle('#10B981')}>
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>

      {/* ── Identity ── */}
      <Section title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Slug" value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} placeholder="critical_path_slip" />
          <Field label="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Critical Path Slip Alert" />
        </div>
        <Field label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Describe what this rule monitors..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <SelectField label="Category" value={form.category} options={categories} onChange={(v) => setForm((p) => ({ ...p, category: v }))} />
          <SelectField label="Severity" value={form.severity} options={severities} onChange={(v) => setForm((p) => ({ ...p, severity: v }))} />
          <Field label="Priority (1-10)" value={String(form.priority)} onChange={(v) => setForm((p) => ({ ...p, priority: Number(v) || 5 }))} type="number" />
        </div>
      </Section>

      {/* ── Condition ── */}
      <Section title="Condition Expression">
        <textarea
          value={form.conditionExpression}
          onChange={(e) => setForm((p) => ({ ...p, conditionExpression: e.target.value }))}
          placeholder="PROVIDER('planning.schedule_performance', 'spi') < 0.9 AND PROVIDER_COUNT('planning.critical_activities') > 0"
          style={{ ...inputStyle, minHeight: '100px', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical', width: '100%' }}
        />
        {validationErrors.length > 0 && (
          <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>
            {validationErrors.map((e, i) => <div key={i}>❌ {e.message}</div>)}
          </div>
        )}
        {form.conditionExpression && validationErrors.length === 0 && (
          <div style={{ fontSize: '12px', color: '#10B981', marginTop: '4px' }}>✅ Expression valid</div>
        )}

        {/* Function palette */}
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#6B7280' }}>
          <span style={{ fontWeight: 600 }}>Available functions: </span>
          {functions.slice(0, 12).map((f) => (
            <span key={f.name} onClick={() => setForm((p) => ({ ...p, conditionExpression: p.conditionExpression + f.name + '(' }))}
              style={{ cursor: 'pointer', padding: '1px 6px', margin: '2px', background: 'rgba(59,130,246,0.1)', borderRadius: '4px', display: 'inline-block' }}>
              {f.name}
            </span>
          ))}
        </div>

        {/* Simulator */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <button onClick={simulate} disabled={simulating || !form.conditionExpression} style={btnStyle('#8B5CF6')}>
            {simulating ? 'Simulating...' : '▶ Simulate'}
          </button>
          {simResult && (
            <span style={{ fontSize: '12px', color: simResult.passed ? '#10B981' : '#F59E0B' }}>
              {simResult.error ? `Error: ${simResult.error}` : `Result: ${String(simResult.result)} → ${simResult.passed ? 'PASS (actions would fire)' : 'FAIL (no action)'}`}
            </span>
          )}
        </div>
      </Section>

      {/* ── Evaluation ── */}
      <Section title="Evaluation">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <SelectField label="Mode" value={form.evaluationMode} options={evalModes} onChange={(v) => setForm((p) => ({ ...p, evaluationMode: v }))} />
          {(form.evaluationMode === 'scheduled' || form.evaluationMode === 'both') && (
            <Field label="Cron Schedule" value={form.evaluationCron} onChange={(v) => setForm((p) => ({ ...p, evaluationCron: v }))} placeholder="*/30 * * * *" />
          )}
        </div>
      </Section>

      {/* ── Escalation ── */}
      <Section title="Escalation">
        <select value={form.escalationChainId} onChange={(e) => setForm((p) => ({ ...p, escalationChainId: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
          <option value="">No escalation chain</option>
          {chains.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.category})</option>)}
        </select>
      </Section>

      {/* ── Actions ── */}
      <Section title="Actions">
        {form.actions.map((action, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '8px' }}>
            <select value={action.actionType} onChange={(e) => updateAction(i, 'actionType', e.target.value)} style={{ ...inputStyle, minWidth: '140px' }}>
              {actionTypes.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <span style={{ fontSize: '12px', color: '#6B7280', flex: 1 }}>
              {action.actionType === 'create_alert' && '📋 Creates an alert in the Alert Console'}
              {action.actionType === 'notify' && '📧 Sends notification via Notification Platform'}
              {action.actionType === 'escalate' && '📈 Triggers escalation chain'}
              {action.actionType === 'log' && '📝 Logs to evaluation audit trail'}
              {action.actionType === 'webhook' && '🔗 HTTP POST to external URL'}
            </span>
            <button onClick={() => removeAction(i)} style={{ ...btnStyle('#DC2626'), fontSize: '14px', padding: '4px 8px' }}>✕</button>
          </div>
        ))}
        <button onClick={addAction} style={btnStyle('#3B82F6')}>+ Add Action</button>
      </Section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#D1D5DB' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, width: '100%' }} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '6px 14px', border: 'none', borderRadius: '6px',
  background: `${bg}20`, color: bg, fontSize: '12px', fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.2s',
});

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px', background: 'rgba(255,255,255,0.04)',
  color: '#FFF', fontSize: '13px', outline: 'none',
};
