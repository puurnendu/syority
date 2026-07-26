'use client';

import React from 'react';
import { 
  FiFileText, 
  FiClock, 
  FiUsers, 
  FiDownload, 
  FiUpload, 
  FiCalendar, 
  FiGrid, 
  FiFilter,
  FiZoomIn,
  FiMaximize
} from 'react-icons/fi';
import { ViewMode } from 'gantt-task-react';

interface ScheduleRibbonProps {
  projectId: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onExport: () => void;
  onImport: () => void;
}

export const ScheduleRibbon: React.FC<ScheduleRibbonProps> = ({
  viewMode,
  setViewMode,
  onExport,
  onImport,
}) => {
  return (
    <div className="bg-[#2b7344] text-white select-none">
      {/* Top Tabs (Visual only) */}
      <div className="flex text-[11px] px-4 space-x-6 pt-1 tracking-tight font-medium opacity-90">
        <div className="border-b-2 border-white pb-1 cursor-default">Task</div>
        <div className="hover:text-green-100 cursor-pointer pb-1 transition-colors">Resource</div>
        <div className="hover:text-green-100 cursor-pointer pb-1 transition-colors">Report</div>
        <div className="hover:text-green-100 cursor-pointer pb-1 transition-colors">Project</div>
        <div className="hover:text-green-100 cursor-pointer pb-1 transition-colors">View</div>
        <div className="hover:text-green-100 cursor-pointer pb-1 transition-colors">Help</div>
      </div>

      {/* Main Ribbon Area */}
      <div className="bg-[#f3f2f1] text-[#323130] p-1 flex items-stretch space-x-1 border-b border-[#edebe9]">
        
        {/* Actions Group */}
        <div className="px-2 border-r border-[#dadada] flex flex-col items-center">
            <div className="flex space-x-3 flex-1 items-center pb-1">
                <button 
                  onClick={onImport}
                  className="flex flex-col items-center justify-center hover:bg-[#eaeaea] p-1 rounded transition-colors group"
                >
                    <FiUpload className="text-[#2b7344] text-lg mb-1" />
                    <span className="text-[10px] leading-tight text-center">Import<br/>Schedule</span>
                </button>
                <button 
                  onClick={onExport}
                  className="flex flex-col items-center justify-center hover:bg-[#eaeaea] p-1 rounded transition-colors group"
                >
                    <FiDownload className="text-[#2b7344] text-lg mb-1" />
                    <span className="text-[10px] leading-tight text-center">Export<br/>Excel</span>
                </button>
            </div>
            <div className="text-[9px] text-[#605e5c] font-medium uppercase tracking-wider mt-auto">Actions</div>
        </div>

        {/* View Group */}
        <div className="px-2 border-r border-[#dadada] flex flex-col items-center">
            <div className="flex space-x-1 flex-1 items-center pb-1">
                 <div className="bg-white border border-[#dadada] rounded flex overflow-hidden">
                    <button 
                        onClick={() => setViewMode(ViewMode.Day)}
                        className={`px-3 py-1 text-[11px] font-medium transition-colors ${viewMode === ViewMode.Day ? 'bg-[#2b7344] text-white' : 'hover:bg-[#eaeaea]'}`}
                    >
                        Days
                    </button>
                    <button 
                        onClick={() => setViewMode(ViewMode.Week)}
                        className={`px-3 py-1 text-[11px] font-medium border-l border-[#dadada] transition-colors ${viewMode === ViewMode.Week ? 'bg-[#2b7344] text-white' : 'hover:bg-[#eaeaea]'}`}
                    >
                        Weeks
                    </button>
                    <button 
                        onClick={() => setViewMode(ViewMode.Month)}
                        className={`px-3 py-1 text-[11px] font-medium border-l border-[#dadada] transition-colors ${viewMode === ViewMode.Month ? 'bg-[#2b7344] text-white' : 'hover:bg-[#eaeaea]'}`}
                    >
                        Months
                    </button>
                 </div>
            </div>
            <div className="text-[9px] text-[#605e5c] font-medium uppercase tracking-wider mt-auto">Timescale</div>
        </div>

        {/* Data Group */}
        <div className="px-2 border-r border-[#dadada] flex flex-col items-center">
            <div className="flex space-x-3 flex-1 items-center pb-1">
                <div className="flex flex-col items-center opacity-40 grayscale cursor-not-allowed px-1">
                    <FiGrid className="text-lg mb-1" />
                    <span className="text-[10px]">WBS</span>
                </div>
                <div className="flex flex-col items-center opacity-40 grayscale cursor-not-allowed px-1">
                    <FiFilter className="text-lg mb-1" />
                    <span className="text-[10px]">Filter</span>
                </div>
                <div className="flex flex-col items-center opacity-40 grayscale cursor-not-allowed px-1">
                    <FiMaximize className="text-lg mb-1" />
                    <span className="text-[10px]">Critical</span>
                </div>
            </div>
            <div className="text-[9px] text-[#605e5c] font-medium uppercase tracking-wider mt-auto">Data</div>
        </div>

      </div>
    </div>
  );
};
