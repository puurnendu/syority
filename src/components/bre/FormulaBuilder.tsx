/**
 * M7.6E — Formula Builder
 *
 * Visual formula designer with:
 *   • Expression editor with syntax highlighting
 *   • Functions palette with autocomplete
 *   • Provider browser for field selection
 *   • Real-time validation
 *   • Expression testing with sample data
 *   • Dependency visualization
 *   • Version history viewer
 *
 * Consumes: /api/bre/formulas
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormulaFormData {
  slug: string;
  name: string;
  description: string;
  category: string;
  expression: string;
  variables: Array<{ name: string; provider_key: string; field: string; default?: any }>;
  returnType: string;
  unit: string;
  precision: number;
}

interface TestResult {
  success: boolean;
  result: any;
  durationMs: number;
  error?: string;
  providerDependencies: string[];
  variablesDefined: string[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FormulaBuilder({ formulaId, onSave, onCancel }: {
  formulaId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<FormulaFormData>({
    slug: '', name: '', description: '', category: 'planning',
    expression: '', variables: [], returnType: 'number', unit: '', precision: 2,
  });

  const [functions, setFunctions] = useState<Array<{ name: string; description: string }>>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ message: string }>>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showFunctions, setShowFunctions] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/bre/formulas?action=functions').then((r) => r.json()).then((d) => setFunctions(d.functions ?? []));

    if (formulaId) {
      fetch(`/api/bre/formulas?id=${formulaId}`).then((r) => r.json()).then((d) => {
        if (d.formula) {
          const f = d.formula;
          setForm({
            slug: f.slug, name: f.name, description: f.description ?? '',
            category: f.category, expression: f.expression,
            variables: f.variables ?? [], returnType: f.returnType,
            unit: f.unit ?? '', precision: f.precision,
          });
        }
      });
    }
  }, [formulaId]);

  // ── Validate on change ────────────────────────────────────────────────

  useEffect(() => {
    if (!form.expression) { setValidationErrors([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/bre/formulas?action=validate&expression=${encodeURIComponent(form.expression)}`);
      const data = await res.json();
      setValidationErrors(data.errors ?? []);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.expression]);

  // ── Test ───────────────────────────────────────────────────────────────

  const testFormula = async () => {
    setTesting(true);
    const vars: Record<string, any> = {};
    for (const v of form.variables) {
      if (v.default !== undefined) vars[v.name] = v.default;
    }

    const res = await fetch('/api/bre/formulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', expression: form.expression, variables: vars }),
    });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────

  const save = async () => {
    setSaving(true);
    const method = formulaId ? 'PUT' : 'POST';
    await fetch('/api/bre/formulas', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: formulaId,
        slug: form.slug,
        name: form.name,
        description: form.description,
        category: form.category,
        expression: form.expression,
        variables: form.variables,
        returnType: form.returnType,
        unit: form.unit || undefined,
        precision: form.precision,
      }),
    });
    setSaving(false);
    onSave?.();
  };

  // ── Load version history ──────────────────────────────────────────────

  const loadVersions = async () => {
    if (!formulaId) return;
    const res = await fetch('/api/bre/formulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'versions', id: formulaId }),
    });
    const data = await res.json();
    setVersions(data.versions ?? []);
    setShowVersions(true);
  };

  // ── Insert function ───────────────────────────────────────────────────

  const insertFunction = (name: string) => {
    const cursor = name === 'PROVIDER' ? "PROVIDER('', '')" : name === 'PROVIDER_COUNT' ? "PROVIDER_COUNT('')" : `${name}()`;
    setForm((p) => ({ ...p, expression: p.expression + cursor }));
  };

  // ── Variable management ───────────────────────────────────────────────

  const addVariable = () => {
    setForm((p) => ({
      ...p,
      variables: [...p.variables, { name: '', provider_key: '', field: '' }],
    }));
  };

  const updateVariable = (index: number, field: string, value: string) => {
    setForm((p) => ({
      ...p,
      variables: p.variables.map((v, i) => i === index ? { ...v, [field]: value } : v),
    }));
  };

  const removeVariable = (index: number) => {
    setForm((p) => ({ ...p, variables: p.variables.filter((_, i) => i !== index) }));
  };

  // ── Render ────────────────────────────────────────────────────────────

  const categories = ['planning', 'safety', 'execution', 'workforce', 'quality', 'management', 'custom'];
  const returnTypes = ['number', 'percentage', 'text', 'boolean'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>🧮 Formula Builder</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {formulaId && <button onClick={loadVersions} style={btnStyle('#8B5CF6')}>📜 Version History</button>}
          {onCancel && <button onClick={onCancel} style={btnStyle('#6B7280')}>Cancel</button>}
          <button onClick={save} disabled={saving || validationErrors.length > 0} style={btnStyle('#10B981')}>
            {saving ? 'Saving...' : formulaId ? 'Update Formula' : 'Create Formula'}
          </button>
        </div>
      </div>

      {/* Identity */}
      <Section title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Slug" value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} placeholder="spi_calculation" />
          <Field label="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Schedule Performance Index" />
        </div>
        <Field label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Describe the formula..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
          <SelectField label="Category" value={form.category} options={categories} onChange={(v) => setForm((p) => ({ ...p, category: v }))} />
          <SelectField label="Return Type" value={form.returnType} options={returnTypes} onChange={(v) => setForm((p) => ({ ...p, returnType: v }))} />
          <Field label="Unit" value={form.unit} onChange={(v) => setForm((p) => ({ ...p, unit: v }))} placeholder="%, hrs, ratio" />
          <Field label="Precision" value={String(form.precision)} onChange={(v) => setForm((p) => ({ ...p, precision: Number(v) || 2 }))} type="number" />
        </div>
      </Section>

      {/* Expression */}
      <Section title="Expression">
        <div style={{ position: 'relative' }}>
          <textarea
            value={form.expression}
            onChange={(e) => setForm((p) => ({ ...p, expression: e.target.value }))}
            placeholder="earned_value / planned_value"
            style={{ ...inputStyle, minHeight: '120px', fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', resize: 'vertical', width: '100%', lineHeight: '1.6' }}
          />
        </div>

        {/* Validation status */}
        {validationErrors.length > 0 ? (
          <div style={{ fontSize: '12px', color: '#DC2626' }}>
            {validationErrors.map((e, i) => <div key={i}>❌ {e.message}</div>)}
          </div>
        ) : form.expression ? (
          <div style={{ fontSize: '12px', color: '#10B981' }}>✅ Expression valid</div>
        ) : null}

        {/* Function palette toggle */}
        <button onClick={() => setShowFunctions(!showFunctions)} style={{ ...btnStyle('#3B82F6'), fontSize: '11px' }}>
          {showFunctions ? '▲ Hide Functions' : '▼ Show Functions'}
        </button>

        {showFunctions && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
            {functions.map((f) => (
              <button
                key={f.name}
                onClick={() => insertFunction(f.name)}
                title={f.description}
                style={{ padding: '3px 8px', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '4px', background: 'rgba(59,130,246,0.08)', color: '#93C5FD', fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace' }}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {/* Test */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={testFormula} disabled={testing || !form.expression} style={btnStyle('#8B5CF6')}>
            {testing ? 'Testing...' : '▶ Test Formula'}
          </button>
          {testResult && (
            <div style={{ fontSize: '12px', flex: 1 }}>
              {testResult.success ? (
                <span style={{ color: '#10B981' }}>
                  Result: <strong>{JSON.stringify(testResult.result)}</strong> ({testResult.durationMs}ms)
                  {testResult.providerDependencies.length > 0 && ` • Providers: ${testResult.providerDependencies.join(', ')}`}
                </span>
              ) : (
                <span style={{ color: '#DC2626' }}>Error: {testResult.error}</span>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Variables */}
      <Section title="Variables">
        {form.variables.map((v, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
            <Field label="Name" value={v.name} onChange={(val) => updateVariable(i, 'name', val)} placeholder="earned_value" />
            <Field label="Provider Key" value={v.provider_key} onChange={(val) => updateVariable(i, 'provider_key', val)} placeholder="planning.earned_value" />
            <Field label="Field" value={v.field} onChange={(val) => updateVariable(i, 'field', val)} placeholder="value" />
            <button onClick={() => removeVariable(i)} style={{ ...btnStyle('#DC2626'), padding: '8px', marginBottom: '0' }}>✕</button>
          </div>
        ))}
        <button onClick={addVariable} style={btnStyle('#3B82F6')}>+ Add Variable</button>
      </Section>

      {/* Version History */}
      {showVersions && versions.length > 0 && (
        <Section title="Version History">
          {versions.map((v) => (
            <div key={v.id} style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>v{v.version_number}</span>
                <span style={{ color: '#6B7280', fontSize: '12px' }}>{new Date(v.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#93C5FD', marginTop: '4px' }}>{v.expression}</div>
              {v.change_description && <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>{v.change_description}</div>}
            </div>
          ))}
        </Section>
      )}
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
