import React from 'react';
import { Metadata } from 'next';
import { MobileExecutionView } from '@/components/execution/MobileExecutionView';

export const metadata: Metadata = {
  title: 'Mobile Execution | STO',
};

export default function MobileExecutionPage() {
  return (
    <div className="w-full h-full pb-20">
      <MobileExecutionView />
    </div>
  );
}
