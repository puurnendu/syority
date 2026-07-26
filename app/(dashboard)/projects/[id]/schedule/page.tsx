'use client';

import { useState, useEffect, use } from 'react';
import ScheduleContainer from '@/components/Schedule/ScheduleContainer';

export default function ProjectSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  
  return (
    <div className="p-0 w-full h-full min-h-0 flex-1 flex flex-col bg-gray-50">
      {/* Activities Table & Gantt */}
      <ScheduleContainer projectId={projectId} />
    </div>
  );
}
