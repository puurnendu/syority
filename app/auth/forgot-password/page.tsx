'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                setStatus('error');
                setMessage(data.error || 'Something went wrong.');
            } else {
                setStatus('success');
                setMessage(data.message || 'If an account exists with this email, a reset link has been sent.');
            }
        } catch (err) {
            setStatus('error');
            setMessage('Failed to connect to the server.');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 text-center">
                <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
                    <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-full">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
                    <p className="text-gray-600 mb-8">{message}</p>
                    <Link
                        href="/login"
                        className="inline-block w-full py-3 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-700/20"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black tracking-tighter text-blue-700">SYORITY</h1>
                    <p className="text-sm text-gray-500 mt-4 font-medium uppercase tracking-wider">Password Recovery</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-blue-900/5 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
                        <h2 className="text-xl font-bold text-gray-900">Forgot Password</h2>
                        <p className="text-xs text-gray-500 mt-1">Enter your email and we'll send you a link to reset your password.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {status === 'error' && (
                            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r">
                                {message}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                Email Address
                            </label>
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 font-medium"
                                placeholder="john@example.com"
                            />
                        </div>

                        <button
                            disabled={status === 'loading'}
                            type="submit"
                            className="w-full py-4 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
                        >
                            {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        <div className="pt-2 text-center">
                            <Link href="/login" className="text-sm text-gray-500 hover:text-blue-700 font-medium transition-colors">
                            ← Back to Sign In
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
