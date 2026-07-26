'use client';

import { HierarchyCrudPage } from '@/components/hierarchy/HierarchyCrudPage';

/** Legacy path — same as /settings/hierarchy/plants */
export default function PlantsSettingsPage() {
  return <HierarchyCrudPage level="plants" />;
}
