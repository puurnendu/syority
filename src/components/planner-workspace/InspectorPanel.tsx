'use client';

/**
 * M7.5 — InspectorPanel Component
 *
 * Right panel with 9 tabs. Synchronized with grid selection.
 * Displays details, resources, materials, documents, QA/QC, certificates, UDF, history, and AI suggestions.
 */
import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

const TABS = [
  { key: 'details', label: 'Details', icon: '📝' },
  { key: 'resources', label: 'Resources', icon: '👥' },
  { key: 'materials', label: 'Materials', icon: '🔩' },
  { key: 'documents', label: 'Documents', icon: '📄' },
  { key: 'qaqc', label: 'QA/QC', icon: '✅' },
  { key: 'certificates', label: 'Certs', icon: '📜' },
  { key: 'udf', label: 'UDF', icon: '📋' },
  { key: 'history', label: 'History', icon: '🕐' },
  { key: 'ai', label: 'AI', icon: '🤖' },
] as const;

type TabKey = typeof TABS[number]['key'];

export function InspectorPanel() {
  const { selectedWorkpackIds, selectedActivityIds, workpacks, activities } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  // Determine what's selected
  const selectedWpId = [...selectedWorkpackIds][0] ?? null;
  const selectedActId = [...selectedActivityIds][0] ?? null;
  const selectedWp = selectedWpId ? workpacks.find((w) => w.id === selectedWpId) : null;
  const selectedAct = selectedActId ? activities.find((a) => a.id === selectedActId) : null;

  const entity = selectedAct ?? selectedWp;
  const entityType = selectedAct ? 'Activity' : selectedWp ? 'Workpack' : null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium whitespace-nowrap
              border-b-2 transition-colors
              ${activeTab === tab.key
                ? 'border-blue-500 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden xl:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {!entity ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Select a workpack or activity to inspect
          </div>
        ) : (
          <TabContent tab={activeTab} entity={entity} entityType={entityType!} />
        )}
      </div>
    </div>
  );
}

// ── Tab Content ───────────────────────────────────────────────────────────────

function TabContent({
  tab,
  entity,
  entityType,
}: {
  tab: TabKey;
  entity: any;
  entityType: string;
}) {
  switch (tab) {
    case 'details':
      return <DetailsTab entity={entity} entityType={entityType} />;
    case 'resources':
      return <PlaceholderTab label="Resources" icon="👥" locked description="Template-controlled. View resources assigned via the template." />;
    case 'materials':
      return <PlaceholderTab label="Materials" icon="🔩" locked description="Template-controlled. View materials from the workpack template." />;
    case 'documents':
      return <PlaceholderTab label="Documents" icon="📄" description="Attached documents and drawings." />;
    case 'qaqc':
      return <PlaceholderTab label="QA/QC" icon="✅" locked description="Read-only in planner workspace. QA clearances managed via dedicated QA module." />;
    case 'certificates':
      return <PlaceholderTab label="Certificates" icon="📜" locked description="Read-only. Certificate instances from the template." />;
    case 'udf':
      return <UdfTab entity={entity} />;
    case 'history':
      return <PlaceholderTab label="History" icon="🕐" description="Audit trail for this entity." />;
    case 'ai':
      return <AiTab entity={entity} entityType={entityType} />;
    default:
      return null;
  }
}

// ── Details Tab ───────────────────────────────────────────────────────────────

function DetailsTab({ entity, entityType }: { entity: any; entityType: string }) {
  const fields = entityType === 'Workpack'
    ? [
        { label: 'Workpack #', value: entity.workpack_number },
        { label: 'Title', value: entity.title },
        { label: 'Equipment', value: entity.equipment_tag },
        { label: 'Equipment Type', value: entity.equipment_type },
        { label: 'Unit', value: entity.unit_code },
        { label: 'System', value: entity.system_code },
        { label: 'Work Type', value: entity.work_type },
        { label: 'Discipline', value: entity.discipline_name },
        { label: 'Contractor', value: entity.contractor_name },
        { label: 'Planner', value: entity.planner_name },
        { label: 'Priority', value: entity.priority },
        { label: 'Status', value: entity.status },
        { label: 'Readiness', value: `${entity.readiness_score ?? 0}%` },
        { label: 'Compliance', value: `${entity.compliance_score ?? 0}%` },
        { label: 'Duration', value: `${entity.duration_total ?? 0}h` },
        { label: 'Activities', value: entity.activity_count },
      ]
    : [
        { label: 'Activity ID', value: entity.activity_id },
        { label: 'Description', value: entity.description },
        { label: 'Duration', value: `${entity.duration_hours}h` },
        { label: 'Status', value: entity.status },
        { label: 'Discipline', value: entity.discipline_name },
        { label: 'Crew', value: entity.manpower_count },
        { label: 'Crew Type', value: entity.manpower_type },
        { label: 'WBS', value: entity.wbs_code },
        { label: 'Hold Point', value: entity.hold_point_type },
        { label: 'Total Float', value: entity.total_float },
        { label: 'Critical', value: entity.is_critical ? 'Yes' : 'No' },
        { label: 'Notes', value: entity.notes },
      ];

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{entityType} Details</h3>
      {fields.map((f) => (
        <div key={f.label} className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">{f.label}</span>
          <span className="text-gray-800 text-right max-w-[60%] truncate">
            {f.value ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── UDF Tab ───────────────────────────────────────────────────────────────────

function UdfTab({ entity }: { entity: any }) {
  const udfValues = entity.udf_values ?? {};
  const entries = Object.entries(udfValues);

  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-400 text-xs py-8">
        No UDF values defined for this entity.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">User Defined Fields</h3>
      {entries.map(([code, value]) => (
        <div key={code} className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium font-mono">{code}</span>
          <span className="text-gray-800">{String(value ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}

// ── AI Tab ────────────────────────────────────────────────────────────────────

function AiTab({ entity, entityType }: { entity: any; entityType: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">AI Suggestions</h3>
      <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
        <p className="text-xs text-blue-700 font-medium">ℹ️ Advisory Only</p>
        <p className="text-xs text-blue-600 mt-1">
          AI suggestions are informational only. No automatic modifications are made to the plan.
        </p>
      </div>
      <div className="text-xs text-gray-500">
        Select a workpack to load AI suggestions for similar historical workpacks, lessons learned, and planning recommendations.
      </div>
    </div>
  );
}

// ── Placeholder Tab ───────────────────────────────────────────────────────────

function PlaceholderTab({
  label,
  icon,
  description,
  locked = false,
}: {
  label: string;
  icon: string;
  description: string;
  locked?: boolean;
}) {
  return (
    <div className="text-center py-8">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
      {locked && (
        <p className="text-xs text-amber-600 mt-2 font-medium">
          🔒 Read-only in Planner Workspace
        </p>
      )}
    </div>
  );
}
