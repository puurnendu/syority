'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type ReadinessData = {
  score: number;
  detail: Record<string, { passed: boolean; weight: number; label: string }>;
};

type ComplianceData = {
  score: number;
  critical: Array<{ category: string; description: string }>;
  minor: Array<{ category: string; description: string }>;
  totalDeviations: number;
};

type MissingDoc = { type: string; label: string; suggestion: string };

export default function WorkpackReadinessDetail() {
  const { workpackId } = useParams<{ workpackId: string }>();
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [missingDocs, setMissingDocs] = useState<MissingDoc[]>([]);
  const [docCoverage, setDocCoverage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workpackId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/workpack-intelligence/workpacks/${workpackId}/readiness`).then(r => r.json()),
      fetch(`/api/workpack-intelligence/workpacks/${workpackId}/compliance`).then(r => r.json()),
      fetch(`/api/workpack-intelligence/workpacks/${workpackId}/documents/missing`).then(r => r.json()),
    ]).then(([rData, cData, dData]) => {
      setReadiness(rData.data);
      setCompliance(cData.data);
      setMissingDocs(dData.data?.missing || []);
      setDocCoverage(dData.data?.coverage || 0);
      setLoading(false);
    });
  }, [workpackId]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading readiness data...</div>;

  const scoreColor = (s: number) => s >= 80 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Workpack Readiness & Compliance</h1>
        <Link href="/workpack-intelligence" style={{ padding: '0.5rem 1rem', background: '#e2e8f0', borderRadius: '6px', textDecoration: 'none', color: '#374151', fontSize: '0.875rem' }}>
          ← Back to Dashboard
        </Link>
      </div>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Readiness Score</div>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: scoreColor(readiness?.score || 0) }}>{readiness?.score ?? 0}%</div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Compliance Score</div>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: scoreColor(compliance?.score || 0) }}>{compliance?.score ?? 100}%</div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Document Coverage</div>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: scoreColor(docCoverage) }}>{docCoverage}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Readiness checklist */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>📋 Readiness Checklist</h2>
          {readiness && Object.entries(readiness.detail).map(([key, item]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{item.passed ? '✅' : '⬜'}</span>
                <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{item.weight}%</span>
            </div>
          ))}
        </div>

        {/* Compliance deviations */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>🔍 Compliance Deviations</h2>
          {compliance && compliance.totalDeviations === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#10b981' }}>
              ✅ No deviations detected. Full template compliance.
            </div>
          )}
          {compliance?.critical.map((d, i) => (
            <div key={`c-${i}`} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: '#fef2f2', borderRadius: '6px', borderLeft: '3px solid #ef4444' }}>
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>{d.category}</div>
              <div style={{ fontSize: '0.85rem' }}>{d.description}</div>
            </div>
          ))}
          {compliance?.minor.map((d, i) => (
            <div key={`m-${i}`} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: '#fffbeb', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>{d.category}</div>
              <div style={{ fontSize: '0.85rem' }}>{d.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing documents */}
      {missingDocs.length > 0 && (
        <div style={{ marginTop: '1.5rem', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>📄 Missing Documents</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {missingDocs.map(d => (
              <div key={d.type} style={{ padding: '0.75rem', background: '#fefce8', borderRadius: '6px', border: '1px solid #fef08a' }}>
                <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{d.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{d.suggestion}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
