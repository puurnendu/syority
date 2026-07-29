'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Instantiate Wizard — ADR-0012 compliant.
 * Workflow: Select Template → Review → Complete.
 * No strategy selection step — Workpack Templates are the only reusable execution object.
 */

type Template = { id: string; name: string; equipment_type: string; job_type: string; revision: number };

export default function InstantiateWizard() {
  const { scopeItemId } = useParams<{ scopeItemId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Load published templates
  useEffect(() => {
    fetch('/api/templates?status=PUBLISHED&latestOnly=true')
      .then(r => r.json())
      .then(d => setTemplates(d.data || []));
  }, []);

  const selectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setStep(2);
  };

  const instantiate = async () => {
    if (!selectedTemplate) return;
    setLoading(true);
    setError('');

    try {
      // Get a site_id from session or first available
      const siteRes = await fetch('/api/sites');
      const siteData = await siteRes.json();
      const siteId = siteData.data?.[0]?.id;

      const res = await fetch('/api/workpack-intelligence/instantiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope_item_id: scopeItemId,
          template_id: selectedTemplate.id,
          site_id: siteId,
          title: title || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to instantiate');
      setResult(data.data);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const stepStyle = (s: number) => ({
    padding: '0.5rem 1.5rem',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: step >= s ? 700 : 400,
    background: step >= s ? '#6366f1' : '#e2e8f0',
    color: step >= s ? 'white' : '#64748b',
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>⚡ Instantiate Workpack</h1>

      {/* Steps indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', alignItems: 'center' }}>
        <span style={stepStyle(1)}>1. Template</span>
        <span style={{ color: '#d1d5db' }}>→</span>
        <span style={stepStyle(2)}>2. Review</span>
        <span style={{ color: '#d1d5db' }}>→</span>
        <span style={stepStyle(3)}>3. Complete</span>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Step 1: Select Template */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Select Workpack Template</h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
            Choose a published template to create the workpack. Templates contain activities, resources, materials, and certifications.
          </p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {templates.map(t => (
              <div
                key={t.id}
                onClick={() => selectTemplate(t)}
                style={{
                  padding: '1rem', background: selectedTemplate?.id === t.id ? '#eef2ff' : 'white',
                  borderRadius: '8px', border: `1px solid ${selectedTemplate?.id === t.id ? '#6366f1' : '#e2e8f0'}`,
                  cursor: 'pointer', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = selectedTemplate?.id === t.id ? '#6366f1' : '#e2e8f0')}
              >
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{t.equipment_type} — {t.job_type} (Rev {t.revision})</div>
              </div>
            ))}
            {templates.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                No published templates found. Publish templates in the Template Library first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Review & Instantiate */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Review & Instantiate</h2>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Template</div>
              <div style={{ fontWeight: 600 }}>{selectedTemplate?.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{selectedTemplate?.equipment_type} — Rev {selectedTemplate?.revision}</div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Workpack Title (optional)</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Auto-generated from asset + template"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>
          </div>

          <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', border: '1px solid #bbf7d0' }}>
            <strong>The system will:</strong>
            <ul style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.85rem', lineHeight: 1.8 }}>
              <li>Create a workpack from the selected template</li>
              <li>Generate activities from the template activity library</li>
              <li>Materialize resources, materials, and certificates from template sections</li>
              <li>Auto-attach P&IDs, datasheets, OEM manuals, and lessons learned</li>
              <li>Compute readiness and compliance scores</li>
              <li>Create full traceability record</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setStep(1)} style={{ padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              ← Back
            </button>
            <button
              onClick={instantiate}
              disabled={loading}
              style={{ padding: '0.5rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {loading ? 'Instantiating...' : '⚡ Instantiate Workpack'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 3 && result && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginBottom: '1rem' }}>Workpack Created Successfully</h2>

          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0', maxWidth: '500px', margin: '0 auto 1.5rem', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div><span style={{ color: '#6b7280' }}>Activities:</span> <strong>{result.counts.activities}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Resources:</span> <strong>{result.counts.resources}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Materials:</span> <strong>{result.counts.materials}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Certificates:</span> <strong>{result.counts.certificates}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Documents:</span> <strong>{result.counts.documents}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Readiness:</span> <strong>{result.readiness_score}%</strong></div>
              <div><span style={{ color: '#6b7280' }}>Compliance:</span> <strong>{result.compliance_score}%</strong></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => router.push(`/workpacks/${result.workpack_id}`)}
              style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Open Workpack
            </button>
            <button
              onClick={() => router.push('/workpack-intelligence')}
              style={{ padding: '0.5rem 1.5rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
