/**
 * M7.6D — Meeting Panel
 *
 * Sidebar for meeting mode with:
 * Notes, Action Register, Decision Log, Comparisons, Export Minutes.
 * Export uses Report Engine → Notification Platform.
 */

'use client';

import React, { useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MeetingAction {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
}

export interface MeetingDecision {
  id: string;
  decision: string;
  madeBy: string;
  timestamp: string;
}

interface MeetingPanelProps {
  meetingId: string;
  dashboardId: string;
  onExportMinutes: () => void;
  onEmailMinutes: () => void;
  onCompare: (compareType: 'previous_shift' | 'previous_day') => void;
}

type PanelTab = 'notes' | 'actions' | 'decisions' | 'compare' | 'summary';

const TABS: { key: PanelTab; label: string; icon: string }[] = [
  { key: 'notes', label: 'Notes', icon: '📝' },
  { key: 'actions', label: 'Actions', icon: '✅' },
  { key: 'decisions', label: 'Decisions', icon: '⚖️' },
  { key: 'compare', label: 'Compare', icon: '🔄' },
  { key: 'summary', label: 'Summary', icon: '🤖' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function MeetingPanel({
  meetingId,
  dashboardId,
  onExportMinutes,
  onEmailMinutes,
  onCompare,
}: MeetingPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('notes');
  const [notes, setNotes] = useState('');
  const [actions, setActions] = useState<MeetingAction[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newDecision, setNewDecision] = useState('');

  const addAction = () => {
    if (!newActionTitle.trim()) return;
    setActions((prev) => [...prev, {
      id: `action_${Date.now()}`,
      title: newActionTitle,
      owner: newActionOwner || 'Unassigned',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'open',
      priority: 'medium',
    }]);
    setNewActionTitle('');
    setNewActionOwner('');
  };

  const addDecision = () => {
    if (!newDecision.trim()) return;
    setDecisions((prev) => [...prev, {
      id: `dec_${Date.now()}`,
      decision: newDecision,
      madeBy: 'Meeting Chair',
      timestamp: new Date().toISOString(),
    }]);
    setNewDecision('');
  };

  const toggleActionStatus = (id: string) => {
    setActions((prev) => prev.map((a) =>
      a.id === id ? { ...a, status: a.status === 'done' ? 'open' : 'done' } : a
    ));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB',
    borderRadius: '6px', fontSize: '13px', outline: 'none',
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
    background: '#FFF', color: '#374151', fontSize: '12px', cursor: 'pointer', fontWeight: 500,
  };

  return (
    <div style={{
      width: '360px',
      height: '100vh',
      background: '#FFFFFF',
      borderLeft: '1px solid #E5E7EB',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>📋 Meeting Mode</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: '8px 2px', border: 'none', background: 'transparent',
            color: activeTab === tab.key ? '#3B82F6' : '#9CA3AF', fontSize: '10px',
            fontWeight: activeTab === tab.key ? 600 : 400, cursor: 'pointer',
            borderBottom: activeTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent',
            textAlign: 'center',
          }}>
            {tab.icon}<br />{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>

        {/* Notes */}
        {activeTab === 'notes' && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Meeting notes..."
            style={{
              ...inputStyle,
              height: '100%',
              resize: 'none',
              lineHeight: 1.6,
            }}
          />
        )}

        {/* Actions */}
        {activeTab === 'actions' && (
          <>
            <div style={{ marginBottom: '12px' }}>
              <input style={{ ...inputStyle, marginBottom: '6px' }} placeholder="Action title" value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)} />
              <div style={{ display: 'flex', gap: '6px' }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Owner" value={newActionOwner} onChange={(e) => setNewActionOwner(e.target.value)} />
                <button onClick={addAction} style={{ ...btnStyle, background: '#3B82F6', color: '#FFF', border: 'none' }}>Add</button>
              </div>
            </div>
            {actions.map((action) => (
              <div key={action.id} style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #F3F4F6',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                <button
                  onClick={() => toggleActionStatus(action.id)}
                  style={{
                    width: '20px', height: '20px', borderRadius: '4px', border: '2px solid',
                    borderColor: action.status === 'done' ? '#10B981' : '#D1D5DB',
                    background: action.status === 'done' ? '#10B981' : 'transparent',
                    cursor: 'pointer', color: '#FFF', fontSize: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: '2px',
                  }}
                >
                  {action.status === 'done' ? '✓' : ''}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, textDecoration: action.status === 'done' ? 'line-through' : 'none', color: action.status === 'done' ? '#9CA3AF' : '#111827' }}>
                    {action.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                    👤 {action.owner} · 📅 {action.dueDate}
                  </div>
                </div>
              </div>
            ))}
            {actions.length === 0 && (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px' }}>No actions yet</div>
            )}
          </>
        )}

        {/* Decisions */}
        {activeTab === 'decisions' && (
          <>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Record decision..." value={newDecision} onChange={(e) => setNewDecision(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDecision()} />
              <button onClick={addDecision} style={{ ...btnStyle, background: '#3B82F6', color: '#FFF', border: 'none' }}>Add</button>
            </div>
            {decisions.map((dec) => (
              <div key={dec.id} style={{
                padding: '10px',
                borderRadius: '8px',
                background: '#F0FDF4',
                borderLeft: '3px solid #10B981',
                marginBottom: '8px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{dec.decision}</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                  👤 {dec.madeBy} · {new Date(dec.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Compare */}
        {activeTab === 'compare' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => onCompare('previous_shift')} style={{ ...btnStyle, padding: '14px', textAlign: 'left' }}>
              🔄 Compare Previous Shift
            </button>
            <button onClick={() => onCompare('previous_day')} style={{ ...btnStyle, padding: '14px', textAlign: 'left' }}>
              📅 Compare Previous Day
            </button>
          </div>
        )}

        {/* AI Summary */}
        {activeTab === 'summary' && (
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0369A1', marginBottom: '8px' }}>
              🤖 AI Meeting Summary
            </div>
            <div style={{ fontSize: '12px', color: '#1E40AF', lineHeight: 1.6 }}>
              Meeting commenced with {actions.length} action items and {decisions.length} decisions recorded.
              {notes ? ` Notes were captured (${notes.length} characters).` : ' No meeting notes captured yet.'}
              {actions.filter((a) => a.status === 'done').length > 0 && ` ${actions.filter((a) => a.status === 'done').length} actions completed during the meeting.`}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        gap: '8px',
      }}>
        <button onClick={onExportMinutes} style={{ ...btnStyle, flex: 1 }}>📄 Export</button>
        <button onClick={onEmailMinutes} style={{ ...btnStyle, flex: 1, background: '#3B82F6', color: '#FFF', border: 'none' }}>📧 Email</button>
      </div>
    </div>
  );
}
