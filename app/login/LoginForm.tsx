'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Org = { id: string; name: string; slug: string | null };

export function LoginForm() {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<{
        email?: string;
        password?: string;
        general?: string;
    }>({});
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') ?? '/';
    const passwordChanged = searchParams.get('passwordChanged') === '1';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setLoading(true);
        try {
            const checkRes = await fetch('/api/auth/check-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                }),
            });
            const checkData = await checkRes.json().catch(() => ({}));
            if (!checkData.ok) {
                if (checkData.field) {
                    setFieldErrors({ [checkData.field]: checkData.error });
                } else {
                    setFieldErrors({ general: checkData.error || 'Invalid email or password.' });
                }
                setLoading(false);
                return;
            }
            const res = await signIn('credentials', {
                email: email.trim().toLowerCase(),
                password,
                redirect: false,
            });
            if (res?.error) {
                setFieldErrors({ general: 'Sign-in failed. Please try again.' });
                setLoading(false);
                return;
            }

            // Auth before destination: honor must_change_password before callbackUrl/dashboard
            try {
                const sessionRes = await fetch('/api/auth/session');
                const session = await sessionRes.json().catch(() => null);
                if (session?.user?.must_change_password === true) {
                    window.location.href = '/auth/change-password';
                    return;
                }
            } catch {
                /* fall through to readiness / callback */
            }

            try {
                const readinessRes = await fetch('/api/system/readiness');
                const readiness = await readinessRes.json();
                if (readiness.isReady) {
                    // Prefer dashboard for bare "/" callbacks
                    window.location.href =
                        !callbackUrl || callbackUrl === '/' ? '/dashboard' : callbackUrl;
                } else {
                    window.location.href = '/admin/setup';
                }
            } catch {
                window.location.href =
                    !callbackUrl || callbackUrl === '/' ? '/dashboard' : callbackUrl;
            }
        } catch (err) {
            setFieldErrors({ general: 'Network error. Please check your connection.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {passwordChanged && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-100 text-xs font-medium text-green-800">
                    Password updated successfully.
                    <br />
                    Please sign in with your new password.
                </div>
            )}

            <div>
                <label htmlFor="email" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">
                    Email Address
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="name@syority.com"
                    required
                />
                {fieldErrors.email && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <span>⚠</span> {fieldErrors.email}
                    </p>
                )}
            </div>
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-xs font-bold text-gray-700 uppercase tracking-widest">
                        Password
                    </label>
                    <Link href="/auth/forgot-password" className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tighter transition-colors ring-offset-2">
                        Forgot Password?
                    </Link>
                </div>
                <div className="relative">
                    <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        required
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        )}
                    </button>
                </div>
                {fieldErrors.password && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <span>⚠</span> {fieldErrors.password}
                    </p>
                )}
            </div>
            {fieldErrors.general && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-medium text-red-600 flex items-center gap-2">
                    <span className="text-base">⚠️</span> {fieldErrors.general}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}

                className="w-full py-4 px-6 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
            >
                {loading ? 'Authenticating…' : 'Sign In →'}
            </button>
        </form>
    );
}
