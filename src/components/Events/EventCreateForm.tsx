'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  code: string | null;
}

interface EventCreateFormProps {
  sites: Site[];
}

export function EventCreateForm({ sites }: EventCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    event_type: 'turnaround',
    site_id: sites[0]?.id ?? '',
    planned_start: '',
    planned_end: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim() || !formData.code.trim() || !formData.site_id) {
      setError('Name, Code and Site are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          event_type: formData.event_type,
          site_id: formData.site_id,
          planned_start: formData.planned_start || null,
          planned_end: formData.planned_end || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Failed to create event');
        return;
      }
      if (data?.data?.id) router.push(`/events/${data.data.id}`);
      else router.push('/events');
    } catch {
      setError('Request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700">← Events</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Event</h1>
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        {error && <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
          <input type="text" name="code" value={formData.code} onChange={handleChange} placeholder="e.g. TA2026" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. 2026 Turnaround" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select name="event_type" value={formData.event_type} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="turnaround">Turnaround</option>
            <option value="shutdown">Shutdown</option>
            <option value="inspection">Inspection</option>
            <option value="campaign">Campaign</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site *</label>
          <select name="site_id" value={formData.site_id} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required>
            <option value="">Select site</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned start</label>
            <input type="date" name="planned_start" value={formData.planned_start} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned end</label>
            <input type="date" name="planned_end" value={formData.planned_end} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? 'Creating…' : 'Create event'}
          </button>
          <Link href="/events" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
