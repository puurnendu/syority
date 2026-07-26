'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [verifying, setVerifying] = useState(true);
    const [valid, setValid] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    
    const [formData, setFormData] = useState({
        password: '',
        confirm_password: '',
    });

    useEffect(() => {
        if (!token) {
            setVerifying(false);
            setValid(false);
            return;
        }

        const verifyToken = async () => {
            try {
                const res = await fetch(`/api/auth/verify-token?token=${token}&type=reset`);
                const data = await res.json();
                setValid(data.valid);
                if (data.error) setError(data.error);
            } catch (err) {
                setError('Failed to verify token.');
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match.');
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: formData.password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to reset password.');
            } else {
                setSuccess(true);
            }
        } catch (err) {
            setError('Failed to connect to the server.');
        } finally {
            setSubmitting(false);
        }
    };

    if (verifying) {
        return <div className="p-8 text-center text-gray-500 italic">Verifying your request...</div>;
    }

    if (!valid && !success) {
        return (
            <div className="p-8 text-center">
                <div className="mb-4 text-red-500 text-4xl">⚠️</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
                <p className="text-gray-600 mb-6">{error || 'This password reset link is no longer valid.'}</p>
                <Link href="/auth/forgot-password" title="Request new link" className="text-blue-700 font-bold hover:underline">
                    Request a new link
                </Link>
            </div>
        );
    }

    if (success) {
        return (
            <div className="p-8 text-center">
                <div className="mb-4 text-green-500 text-4xl">✅</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h2>
                <p className="text-gray-600 mb-8">Your password has been reset successfully. You can now sign in with your new password.</p>
                <Link
                    href="/login"
                    className="inline-block w-full py-3 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-700/20"
                >
                    Sign In
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                        New Password
                    </label>
                    <input
                        required
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 font-medium"
                        placeholder="••••••••"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                        Confirm New Password
                    </label>
                    <input
                        required
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-900 font-medium"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button
                disabled={submitting}
                type="submit"
                className="w-full py-4 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20 active:scale-[0.98] disabled:opacity-50"
            >
                {submitting ? 'Updating...' : 'Reset Password'}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black tracking-tighter text-blue-700">SYORITY</h1>
                    <p className="text-sm text-gray-500 mt-4 font-medium uppercase tracking-wider">Secure Reset</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-blue-900/5 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
                        <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
                        <p className="text-xs text-gray-500 mt-1">Please enter a strong password to secure your account.</p>
                    </div>

                    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading form...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
