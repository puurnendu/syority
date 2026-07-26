'use client';

import { useState } from 'react';

export function EmailConfigSection() {
    const [testing, setTesting] = useState(false);
    const [testTo, setTestTo] = useState('');
    const [result, setResult] = useState<{
        success: boolean;
        messageId?: string;
        error?: string;
        hint?: string;
    } | null>(null);

    async function sendTest() {
        setTesting(true);
        setResult(null);
        try {
            const res = await fetch('/api/admin/email/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: testTo || undefined }),
            });
            const data = await res.json();
            setResult(data);
        } catch {
            setResult({ success: false, error: 'Network error' });
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">
                📧 Email (SMTP) Configuration
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                Configure in .env file. Use Test button to verify.
            </p>

            <div className="flex gap-2">
                <input
                    type="email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="Send test to: your@email.com"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                    onClick={sendTest}
                    disabled={testing}
                    className="px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50"
                >
                    {testing ? 'Sending…' : 'Test Email'}
                </button>
            </div>

            {result && (
                <div
                    className={`mt-3 p-3 rounded-lg text-sm ${
                        result.success
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                >
                    {result.success ? (
                        <>✅ Email sent! ID: {result.messageId ?? '—'}</>
                    ) : (
                        <>
                            ❌ Failed: {result.error}
                            {result.hint && ` — ${result.hint}`}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
