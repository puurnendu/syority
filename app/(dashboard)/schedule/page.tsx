'use client';

import ScheduleContainer from '@/components/Schedule/ScheduleContainer';

export default function GlobalSchedulePage() {
  return (
    <div className="p-0 w-full h-full min-h-0 flex-1 flex flex-col bg-gray-50">
      {/* Activities Table */}
      <ScheduleContainer />
    </div>
  );
}
