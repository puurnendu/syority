'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const inputCls  = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all';
const labelCls  = 'block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2';
const cardCls   = 'bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6';
const hintCls   = 'p-4 rounded-xl text-xs bg-blue-50 text-blue-800 border border-blue-100 leading-relaxed';

export default function AiWhatsAppTab({ existing, orgId }: { existing: any; orgId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [testLoading, setTestLoading] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    async function handleTestMessage() {
        if (!testPhone) {
            setTestMessage({ type: 'error', text: 'Please enter a recipient phone number.' });
            return;
        }
        
        setTestLoading(true);
        setTestMessage(null);

        try {
            const res = await fetch('/api/whatsapp/test-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_phone: testPhone }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to send test message');
            
            setTestMessage({ type: 'success', text: 'Message sent successfully' });
            setTestPhone('');
        } catch (err) {
            setTestMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
        } finally {
            setTestLoading(false);
        }
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const fd = new FormData(e.currentTarget);
        const submitData = Object.fromEntries(fd.entries());
        
        // Merge with existing configuration so we don't wipe out provider settings
        const data = {
            ...(existing || {}),
            ...submitData
        };

        try {
            const res = await fetch('/api/ai-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) throw new Error('Failed to save settings');
            
            setMessage({ type: 'success', text: 'WhatsApp API configuration saved successfully!' });
            router.refresh();
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
        } finally {
            setLoading(false);
        }
    }

    const hasToken = !!existing?.whatsapp_access_token_encrypted;

    return (
        <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
            <form onSubmit={handleSubmit}>
            <div className={cardCls}>
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">
                        📱
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Meta WhatsApp API Configuration</h2>
                        <p className="text-sm text-gray-500">Configure your Meta Cloud API credentials to enable WhatsApp reporting.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className={labelCls}>Phone Number ID</label>
                            <input
                                name="whatsapp_phone_number_id"
                                defaultValue={existing?.whatsapp_phone_number_id ?? ''}
                                placeholder="e.g. 106554874457..."
                                className={inputCls}
                                required
                            />
                            <p className="text-[10px] text-gray-400 mt-2">Found in Meta App Settings under WhatsApp &gt; API Setup.</p>
                        </div>

                        <div>
                            <label className={labelCls}>WhatsApp Business ID</label>
                            <input
                                name="whatsapp_business_id"
                                defaultValue={existing?.whatsapp_business_id ?? ''}
                                placeholder="e.g. 25487745..."
                                className={inputCls}
                            />
                            <p className="text-[10px] text-gray-400 mt-2">Optional. Use if multiple businesses are under your Meta account.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className={labelCls}>Permanent Access Token</label>
                            <div className="relative group">
                                <input
                                    name="whatsapp_access_token"
                                    type="password"
                                    defaultValue={hasToken ? '••••••••••••••••' : ''}
                                    placeholder={hasToken ? 'Leave unchanged to keep existing token' : 'Paste your system user access token'}
                                    className={`${inputCls} pr-10`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none group-hover:text-gray-400">
                                    🔒
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">Stored using AES-256-GCM encryption. Use a <strong>System User</strong> token for long-term stability.</p>
                        </div>

                        <div>
                            <label className={labelCls}>Webhook Verify Token</label>
                            <input
                                name="whatsapp_verify_token"
                                defaultValue={existing?.whatsapp_verify_token ?? ''}
                                placeholder="e.g. syority_webhook_v1"
                                className={inputCls}
                            />
                            <p className="text-[10px] text-gray-400 mt-2">Enter the same string you chose in the Meta Webhook configuration.</p>
                        </div>
                    </div>
                </div>

                <div className={hintCls}>
                    <p className="font-semibold mb-1 flex items-center gap-1.5">
                        💡 Setup Checklist:
                    </p>
                    <ul className="list-disc ml-4 space-y-1 opacity-90">
                        <li>Register a test number or production number in <strong>Meta Developers Portal</strong>.</li>
                        <li>Add your Webhook URL: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-900 border border-blue-200">https://your-domain.com/api/webhooks/whatsapp</code></li>
                        <li>Subscribe to <strong>messages</strong> and <strong>message_echoes</strong> webhook events.</li>
                    </ul>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl text-sm font-medium border animate-in zoom-in-95 duration-200 ${
                        message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                        {message.type === 'success' ? '✅' : '❌'} {message.text}
                    </div>
                )}

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                    >
                        {loading ? 'Saving Integration…' : 'Save WhatsApp Configuration →'}
                    </button>
                </div>
            </div>
            </form>

            <div className={cardCls}>
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">
                        🧪
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Test WhatsApp Integration</h2>
                        <p className="text-sm text-gray-500">Send a test message to verify the API credentials are working correctly.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full relative">
                        <label className={labelCls}>Recipient Phone Number</label>
                        <input
                            type="text"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="+91XXXXXXXXXX"
                            className={inputCls}
                        />
                        <p className="text-[10px] text-gray-400 mt-2">Include country code (e.g., +91 for India).</p>
                    </div>
                    <div className="pb-[22px]">
                        <button
                            type="button"
                            onClick={handleTestMessage}
                            disabled={testLoading || !testPhone}
                            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-500/20 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                            {testLoading ? 'Sending...' : 'Send Test Message'}
                        </button>
                    </div>
                </div>

                {testMessage && (
                    <div className={`p-4 rounded-xl text-sm font-medium border animate-in zoom-in-95 duration-200 ${
                        testMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                        {testMessage.type === 'success' ? '✅' : '❌'} {testMessage.text}
                    </div>
                )}
            </div>
        </div>
    );
}
