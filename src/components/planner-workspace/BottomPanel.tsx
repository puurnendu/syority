'use client';

/**
 * M7.5 — BottomPanel Component
 *
 * Five tabs: Validation, AI Advisor, Messages, Documents, Lessons Learned.
 * Validation panel shows issues from ValidationEngineService with click-to-navigate.
 */
import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { ValidationIssue, ValidationSeverity } from '@/core/planner-workspace';

const BOTTOM_TABS = [
  { key: 'validation', label: 'Validation', icon: '🔍' },
  { key: 'ai', label: 'AI Advisor', icon: '🤖' },
  { key: 'messages', label: 'Messages', icon: '💬' },
  { key: 'documents', label: 'Documents', icon: '📎' },
  { key: 'lessons', label: 'Lessons', icon: '📖' },
] as const;

type BottomTabKey = typeof BOTTOM_TABS[number]['key'];

const SEVERITY_COLORS: Record<ValidationSeverity, string> = {
  error: 'bg-red-100 text-red-700 border-red-300',
  warning: 'bg-amber-100 text-amber-700 border-amber-300',
  info: 'bg-blue-100 text-blue-700 border-blue-300',
};

const SEVERITY_ICONS: Record<ValidationSeverity, string> = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

export function BottomPanel() {
  const { validationIssues, selectWorkpack, selectActivity } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<BottomTabKey>('validation');

  // ── Issue counts ──────────────────────────────────────────────────────

  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;
  const infoCount = validationIssues.filter((i) => i.severity === 'info').length;

  // ── Click-to-navigate ─────────────────────────────────────────────────

  const handleIssueClick = (issue: ValidationIssue) => {
    if (issue.workpackId) {
      selectWorkpack(issue.workpackId);
    }
    if (issue.entityType === 'activity') {
      selectActivity(issue.entityId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-t border-gray-300">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-gray-200 bg-gray-50 px-2">
        {BOTTOM_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium
              border-b-2 transition-colors mr-1
              ${activeTab === tab.key
                ? 'border-blue-500 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.key === 'validation' && validationIssues.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-600">
                {validationIssues.length}
              </span>
            )}
          </button>
        ))}

        {/* Summary badges */}
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          {errorCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">
              {errorCount} errors
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-semibold">
              {warningCount} warnings
            </span>
          )}
          {infoCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold">
              {infoCount} info
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'validation' && (
          <ValidationTab issues={validationIssues} onIssueClick={handleIssueClick} />
        )}
        {activeTab === 'ai' && (
          <div className="p-4 text-sm text-gray-500 text-center">
            <p className="text-2xl mb-2">🤖</p>
            <p className="font-medium">AI Advisory Panel</p>
            <p className="text-xs mt-1">Suggestions appear here when workpacks are selected.</p>
            <p className="text-xs text-amber-600 mt-2">Advisory only — planner decides.</p>
          </div>
        )}
        {activeTab === 'messages' && (
          <div className="p-4 text-sm text-gray-400 text-center">No messages</div>
        )}
        {activeTab === 'documents' && (
          <div className="p-4 text-sm text-gray-400 text-center">No documents preview</div>
        )}
        {activeTab === 'lessons' && (
          <div className="p-4 text-sm text-gray-400 text-center">No lessons loaded</div>
        )}
      </div>
    </div>
  );
}

// ── Validation Tab ────────────────────────────────────────────────────────────

function ValidationTab({
  issues,
  onIssueClick,
}: {
  issues: ValidationIssue[];
  onIssueClick: (issue: ValidationIssue) => void;
}) {
  const [filterSeverity, setFilterSeverity] = useState<ValidationSeverity | 'all'>('all');
  const [filterRule, setFilterRule] = useState<string>('all');

  const filtered = issues.filter((i) => {
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false;
    if (filterRule !== 'all' && i.ruleId !== filterRule) return false;
    return true;
  });

  const uniqueRules = [...new Set(issues.map((i) => i.ruleId))].sort();

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        <span className="mr-2">✅</span>
        No validation issues. Run validation from the toolbar.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as any)}
          className="text-xs border border-gray-300 rounded px-1.5 py-0.5"
        >
          <option value="all">All Severities</option>
          <option value="error">Errors</option>
          <option value="warning">Warnings</option>
          <option value="info">Info</option>
        </select>
        <select
          value={filterRule}
          onChange={(e) => setFilterRule(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1.5 py-0.5"
        >
          <option value="all">All Rules</option>
          {uniqueRules.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} issues</span>
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-auto">
        {filtered.map((issue) => (
          <div
            key={issue.id}
            className={`flex items-start gap-2 px-3 py-1.5 border-b border-gray-100 cursor-pointer
              hover:bg-gray-50 text-xs ${SEVERITY_COLORS[issue.severity]}`}
            onClick={() => onIssueClick(issue)}
          >
            <span className="flex-shrink-0 mt-0.5">{SEVERITY_ICONS[issue.severity]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[10px] px-1 rounded bg-gray-200/60">
                  {issue.ruleId}
                </span>
                {issue.workpackNumber && (
                  <span className="text-gray-600">{issue.workpackNumber}</span>
                )}
                {issue.activityIdDisplay && (
                  <span className="text-gray-500">→ {issue.activityIdDisplay}</span>
                )}
              </div>
              <div className="mt-0.5 text-gray-700">{issue.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
