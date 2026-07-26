'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OnboardingPage() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [formData, setFormData] = useState({
        organization_name: '',
        admin_name: '',
        admin_email: '',
        notes: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/onboarding/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                setStatus('error');
                setMessage(data.error || 'Something went wrong. Please try again.');
            } else {
                setStatus('success');
                setMessage('Your request has been submitted successfully! We will review it and get back to you via email.');
            }
        } catch (err) {
            setStatus('error');
            setMessage('Failed to connect to the server. Please check your internet connection.');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 text-center">
                <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
                    <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h1>
                    <p className="text-gray-600 mb-8">{message}</p>
                    <Link
                        href="/login"
                        className="inline-block w-full py-3 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-700/20"
                    >
                        Return to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black tracking-tighter text-blue-700 leading-none">SYORITY</h1>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">ONBOARDING</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-4 font-medium uppercase tracking-wider italic">Request a New Organization Account</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-blue-900/5 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
                        <h2 className="text-xl font-bold text-gray-900">Registration</h2>
                        <p className="text-xs text-gray-500 mt-1">Submit your details for administrator review.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {status === 'error' && (
                            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r">
                                {message}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Organization Name
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.organization_name}
                                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 font-medium"
                                    placeholder="e.g. Acme Corp"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Your Full Name
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.admin_name}
                                    onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 font-medium"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Business Email
                                </label>
                                <input
                                    required
                                    type="email"
                                    value={formData.admin_email}
                                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 font-medium"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Additional Notes (Optional)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 font-medium resize-none h-24"
                                    placeholder="Any specific requirements..."
                                />
                            </div>
                        </div>

                        <button
                            disabled={status === 'loading'}
                            type="submit"
                            className="w-full py-4 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
                        >
                            {status === 'loading' ? 'Submitting...' : 'Request Onboarding'}
                        </button>

                        <div className="pt-2 text-center">
                            <Link href="/login" className="text-sm text-gray-500 hover:text-blue-700 font-medium transition-colors">
                            ← Back to Sign In
                            </Link>
                        </div>
                    </form>
                </div>

                <p className="text-center text-xs text-gray-400 mt-8 font-medium">
                    © 2026 SYORITY Technologies. All rights reserved.
                </p>
            </div>
        </div>
    );
}
