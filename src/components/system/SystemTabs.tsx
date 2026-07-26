'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SystemLayout, type SystemTabId } from './SystemLayout';
import { SystemOverview } from './tabs/SystemOverview';
import { SystemBlindList } from './tabs/SystemBlindList';
import { SystemGasketRegister } from './tabs/SystemGasketRegister';
import { SystemDrawings } from './tabs/SystemDrawings';
import { SystemProcedures } from './tabs/SystemProcedures';
import { SystemLineList } from './tabs/SystemLineList';
import { SystemEquipmentList } from './tabs/SystemEquipmentList';
import { SystemWorkpacks } from './tabs/SystemWorkpacks';
import { SystemScheduleTab } from './tabs/SystemScheduleTab';

export function SystemTabs({ system, canEdit }: { system: any; canEdit: boolean }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SystemTabId>('overview');

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const tab = ['overview', 'blinds', 'gaskets', 'drawings', 'procedures', 'lines', 'equipment', 'workpacks', 'schedule', 'wbs'].includes(hash)
      ? (hash as SystemTabId)
      : 'overview';
    setActiveTab(tab);
  }, []);

  const counts = {
    blinds: system._count?.blinds ?? 0,
    gaskets: system._count?.gaskets ?? 0,
    workpacks: system._count?.workpacks ?? 0,
    lines: system._count?.line_lists ?? 0,
    assets: system._count?.assets ?? 0,
  };

  function renderTabContent() {
    switch (activeTab) {
      case 'overview':
        return <SystemOverview system={system} canEdit={canEdit} />;
      case 'blinds':
        return <SystemBlindList systemId={system.id} canEdit={canEdit} />;
      case 'gaskets':
        return <SystemGasketRegister systemId={system.id} canEdit={canEdit} />;
      case 'drawings':
        return <SystemDrawings systemId={system.id} canEdit={canEdit} />;
      case 'procedures':
        return <SystemProcedures systemId={system.id} canEdit={canEdit} />;
      case 'lines':
        return <SystemLineList systemId={system.id} />;
      case 'equipment':
        return <SystemEquipmentList systemId={system.id} />;
      case 'workpacks':
        return <SystemWorkpacks systemId={system.id} />;
      case 'schedule':
        return <SystemScheduleTab systemId={system.id} />;
      case 'wbs':
        return (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">WBS is managed on a dedicated page.</p>
            <button
              type="button"
              onClick={() => router.push(`/planning/systems/${system.id}/wbs`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Open WBS Manager
            </button>
          </div>
        );
      default:
        return <SystemOverview system={system} canEdit={canEdit} />;
    }
  }

  return (
    <SystemLayout system={system} activeTab={activeTab} onTabChange={setActiveTab} counts={counts}>
      {renderTabContent()}
    </SystemLayout>
  );
}
