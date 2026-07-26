'use client';

import { useState, useEffect } from 'react';

type UserMe = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp_number: string | null;
  whatsapp_verified: boolean;
  whatsapp_opt_in: boolean;
  preferred_language: string | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setUser(d);
          setWhatsappNumber(d.whatsapp_number ?? '');
          setWhatsappOptIn(d.whatsapp_opt_in ?? false);
          setPreferredLanguage(d.preferred_language ?? 'en');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whatsapp_number: whatsappNumber.trim() || null,
        whatsapp_opt_in: whatsappOptIn,
        preferred_language: preferredLanguage,
      }),
    });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Profile updated.' });
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage({ type: 'error', text: d?.error ?? 'Failed to update.' });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-2">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-2">Could not load profile.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
      <p className="text-sm text-gray-500 mt-1">Your account and WhatsApp preferences.</p>

      <div className="mt-6 space-y-6">
        <div>
          <p className="text-sm font-medium text-gray-700">Name</p>
          <p className="text-gray-900">{user.name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Email</p>
          <p className="text-gray-900">{user.email}</p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-base font-semibold text-gray-900">WhatsApp Integration</h2>
          <p className="text-sm text-gray-500 mt-1">
            Used to receive field updates and shift reports. E.164 format (e.g. +91XXXXXXXXXX).
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp number
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="whatsapp_opt_in"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="whatsapp_opt_in" className="text-sm text-gray-700">
                Opt in to receive WhatsApp messages (shift reports, overdue alerts)
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred language for replies
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="gu">Gujarati</option>
                <option value="ta">Tamil</option>
                <option value="ml">Malayalam</option>
              </select>
            </div>
          </div>
        </div>

        {message && (
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
