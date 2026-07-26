'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  code: string | null;
}

interface AssetCreateFormProps {
  sites: Site[];
}

export function AssetCreateForm({ sites }: AssetCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    site_id: sites[0]?.id ?? '',
    tag_number: '',
    name: '',
    asset_type: '',
  });

  useEffect(() => {
    if (sites[0]?.id && !formData.site_id) setFormData((p) => ({ ...p, site_id: sites[0].id }));
  }, [sites, formData.site_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.site_id || !formData.tag_number.trim() || !formData.name.trim()) {
      setError('Site, Tag number and Name are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: formData.site_id,
          tag_number: formData.tag_number.trim(),
          name: formData.name.trim(),
          asset_type: formData.asset_type.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Failed to create asset');
        return;
      }
      if (data?.data?.id) router.push(`/asset-register/${data.data.id}`);
      else router.push('/asset-register');
    } catch {
      setError('Request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/asset-register" className="text-sm text-gray-500 hover:text-gray-700">← Asset Register</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Asset</h1>
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        {error && <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site *</label>
          <select name="site_id" value={formData.site_id} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required>
            <option value="">Select site</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tag number *</label>
          <input type="text" name="tag_number" value={formData.tag_number} onChange={handleChange} placeholder="e.g. E-101A" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Feed Effluent Exchanger" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asset type</label>
          <input type="text" name="asset_type" value={formData.asset_type} onChange={handleChange} placeholder="e.g. heat_exchanger" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? 'Creating…' : 'Create asset'}
          </button>
          <Link href="/asset-register" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
