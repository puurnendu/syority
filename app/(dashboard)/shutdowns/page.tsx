import { redirect } from 'next/navigation';

export default function ShutdownsPage() {
  redirect('/events');
}
