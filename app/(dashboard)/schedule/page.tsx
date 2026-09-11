'use client';

import React, { useState } from 'react';
import { ScheduleGantt } from '@/components/schedule/ScheduleGantt';
import ScheduleContainer from '@/components/Schedule/ScheduleContainer';

export default function GlobalSchedulePage() {
  const [activeTab, setActiveTab] = useState<'gantt' | 'execution'>('gantt');

  return (
    <div className="p-0 w-full h-full min-h-0 flex-1 flex flex-col bg-white">
      {/* Sub-header Mode Toggle */}
      <div className="px-6 py-2 border-b border-gray-200 bg-gray-100/60 flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-200/80 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('gantt')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'gantt'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Interactive CPM Gantt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('execution')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'execution'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Shift Execution Tracking
          </button>
        </div>
      </div>

      {/* Tab Views */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'gantt' ? <ScheduleGantt /> : <ScheduleContainer />}
      </div>
    </div>
  );
}
