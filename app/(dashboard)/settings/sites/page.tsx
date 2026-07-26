'use client';

import { HierarchyCrudPage } from '@/components/hierarchy/HierarchyCrudPage';

/** Legacy path — same as /settings/hierarchy/sites */
export default function SitesSettingsPage() {
  return <HierarchyCrudPage level="sites" />;
}
