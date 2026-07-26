import { redirect } from 'next/navigation';

/** Legacy Coming Soon route — hierarchy Assets CRUD is live. */
export default function AssetsSettingsPage() {
  redirect('/settings/hierarchy/assets');
}
