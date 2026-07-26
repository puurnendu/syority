import { redirect } from 'next/navigation';

/** Breadcrumb parent `/settings/hierarchy` — land on Sites. */
export default function HierarchyIndexPage() {
  redirect('/settings/hierarchy/sites');
}
