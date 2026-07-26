'use client';

import { useState, useEffect } from 'react';
import { UnitLayout, type UnitTabId } from './UnitLayout';
import { UnitOverview } from './tabs/UnitOverview';
import { UnitSystems } from './tabs/UnitSystems';
import { UnitEquipment } from './tabs/UnitEquipment';
import { UnitWorkpacks } from './tabs/UnitWorkpacks';
import { UnitScheduleSummary } from './tabs/UnitScheduleSummary';
import { UnitConstraints } from './tabs/UnitConstraints';

export function UnitTabs({
  unitId,
  initialUnit,
  initialKpi,
  initialEvent,
  canEdit,
  canManage,
}: {
  unitId: string;
  initialUnit: any;
  initialKpi: {
    systems_count: number;
    equipment_count: number;
    workpacks_count: number;
    blinds_count: number;
    open_constraints_count: number;
  };
  initialEvent?: { id: string; name: string; code: string | null } | null;
  canEdit: boolean;
  canManage: boolean;
}) {
  const [activeTab, setActiveTab] = useState<UnitTabId>('overview');

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const tab = ['overview', 'systems', 'equipment', 'workpacks', 'schedule', 'constraints'].includes(hash)
      ? (hash as UnitTabId)
      : 'overview';
    setActiveTab(tab);
  }, []);

  function renderTabContent() {
    switch (activeTab) {
      case 'overview':
        return <UnitOverview unitId={unitId} initialUnit={initialUnit} canEdit={canEdit} />;
      case 'systems':
        return <UnitSystems unitId={unitId} canManage={canManage} />;
      case 'equipment':
        return <UnitEquipment unitId={unitId} />;
      case 'workpacks':
        return <UnitWorkpacks unitId={unitId} />;
      case 'schedule':
        return <UnitScheduleSummary unitId={unitId} />;
      case 'constraints':
        return <UnitConstraints unitId={unitId} />;
      default:
        return <UnitOverview unitId={unitId} initialUnit={initialUnit} canEdit={canEdit} />;
    }
  }

  return (
    <UnitLayout
      unit={initialUnit}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      kpi={initialKpi}
      event={initialEvent}
    >
      {renderTabContent()}
    </UnitLayout>
  );
}
