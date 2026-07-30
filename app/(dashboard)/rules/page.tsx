/**
 * M7.6E — Rules & Formula Library Page
 *
 * Tabbed page: Rules Library | Formula Library | KPIs | Escalation Chains
 */

'use client';

import React, { useState, useEffect } from 'react';
import RuleBuilder from '@/components/bre/RuleBuilder';
import FormulaBuilder from '@/components/bre/FormulaBuilder';

type Tab = 'rules' | 'formulas' | 'kpis' | 'escalations';

export default function RulesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const [showBuilder, setShowBuilder] = useState<'rule' | 'formula' | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [formulas, setFormulas] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [chains, setChains] = useState<any[]>([]);

  const fetchData = async () => {
    const [rulesRes, formulasRes, kpisRes, chainsRes] = await Promise.all([
      fetch('/api/bre/rules').then((r) => r.json()),
      fetch('/api/bre/formulas').then((r) => r.json()),
      fetch('/api/bre/kpis').then((r) => r.json()),
      fetch('/api/bre/escalations').then((r) => r.json()),
    ]);
    setRules(rulesRes.rules ?? []);
    setFormulas(formulasRes.formulas ?? []);
    setKpis(kpisRes.kpis ?? []);
    setChains(chainsRes.chains ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: 'rules', label: 'Business Rules', icon: '📐', count: rules.length },
    { key: 'formulas', label: 'Formulas', icon: '🧮', count: formulas.length },
    { key: 'kpis', label: 'KPIs', icon: '📊', count: kpis.length },
    { key: 'escalations', label: 'Escalation Chains', icon: '📈', count: chains.length },
  ];

  const severityIcon = (s: string) => s === 'emergency' ? '🚨' : s === 'critical' ? '🔴' : s === 'warning' ? '🟡' : '🔵';

  if (showBuilder === 'rule') {
    return (
      <div style={{ padding: '24px' }}>
        <RuleBuilder onSave={() => { setShowBuilder(null); fetchData(); }} onCancel={() => setShowBuilder(null)} />
      </div>
    );
  }

  if (showBuilder === 'formula') {
    return (
      <div style={{ padding: '24px' }}>
        <FormulaBuilder onSave={() => { setShowBuilder(null); fetchData(); }} onCancel={() => setShowBuilder(null)} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>⚡ Business Rules Engine</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowBuilder('formula')} style={btn('#8B5CF6')}>+ New Formula</button>
          <button onClick={() => setShowBuilder('rule')} style={btn('#3B82F6')}>+ New Rule</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
              fontSize: '14px', fontWeight: activeTab === tab.key ? 700 : 500,
              background: activeTab === tab.key ? 'rgba(59,130,246,0.1)' : 'transparent',
              color: activeTab === tab.key ? '#3B82F6' : '#9CA3AF',
            }}
          >
            {tab.icon} {tab.label}
            <span style={{ marginLeft: '6px', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', background: 'rgba(255,255,255,0.06)' }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.length === 0 ? (
            <Empty icon="📐" message="No rules defined yet. Create your first business rule." />
          ) : rules.map((rule: any) => (
            <div key={rule.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>
                    {severityIcon(rule.severity)} {rule.name}
                    <span style={{ ...badge, background: rule.isEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)', color: rule.isEnabled ? '#10B981' : '#6B7280', marginLeft: '8px' }}>
                      {rule.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                    {rule.category} • {rule.evaluationMode} • Priority {rule.priority}
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6B7280', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rule.conditionExpression}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'formulas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {formulas.length === 0 ? (
            <Empty icon="🧮" message="No formulas defined yet. Create your first calculation formula." />
          ) : formulas.map((formula: any) => (
            <div key={formula.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>
                    {formula.name}
                    <span style={{ ...badge, background: formula.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: formula.status === 'active' ? '#10B981' : '#F59E0B', marginLeft: '8px' }}>
                      {formula.status} v{formula.version}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                    {formula.category} • {formula.returnType}{formula.unit ? ` (${formula.unit})` : ''}
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#93C5FD', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formula.expression}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'kpis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {kpis.length === 0 ? (
            <Empty icon="📊" message="No KPIs defined yet. KPIs are derived from formulas." />
          ) : kpis.map((kpi: any) => (
            <div key={kpi.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>
                    {kpi.icon} {kpi.name}
                    <span style={{ ...badge, marginLeft: '8px' }}>{kpi.providerKey}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                    {kpi.category} • Target: {kpi.targetValue ?? 'N/A'} • Format: {kpi.displayFormat}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', fontSize: '12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>🟢 ≥{kpi.thresholdGreen}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>🟡 ≥{kpi.thresholdAmber}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(220,38,38,0.15)', color: '#DC2626' }}>🔴 &lt;{kpi.thresholdRed}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'escalations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {chains.length === 0 ? (
            <Empty icon="📈" message="No escalation chains defined yet." />
          ) : chains.map((chain: any) => (
            <div key={chain.id} style={cardStyle}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{chain.name}</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                {chain.category} • {chain.levels?.length ?? 0} levels • {chain.respectBusinessHours ? 'Business hours' : '24/7'}
              </div>
              {chain.levels && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {chain.levels.map((l: any, i: number) => (
                    <React.Fragment key={l.id}>
                      <span style={{ padding: '3px 10px', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#A78BFA', fontSize: '12px' }}>
                        L{l.levelNumber}: {l.name} ({l.escalateAfterMinutes}m)
                      </span>
                      {i < chain.levels.length - 1 && <span style={{ color: '#4B5563', alignSelf: 'center' }}>→</span>}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#6B7280' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>{icon}</div>
      <div>{message}</div>
    </div>
  );
}

const btn = (bg: string): React.CSSProperties => ({
  padding: '8px 16px', border: 'none', borderRadius: '8px',
  background: `${bg}20`, color: bg, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
});

const cardStyle: React.CSSProperties = {
  padding: '14px 18px', background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
  transition: 'all 0.2s',
};

const badge: React.CSSProperties = {
  fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
  background: 'rgba(255,255,255,0.06)', color: '#9CA3AF',
};
