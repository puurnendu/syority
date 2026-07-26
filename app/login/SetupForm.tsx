'use client';

import { useState } from 'react';
import { createFirstOrganization } from './actions';

export function SetupForm() {
    const [organizationName, setOrganizationName] = useState('');
    const [organizationSlug, setOrganizationSlug] = useState('');
    const [siteName, setSiteName] = useState('Headquarters');
    const [siteCode, setSiteCode] = useState('MAIN');
    const [adminName, setAdminName] = useState('Super Admin');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (adminPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (adminPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setLoading(true);
        try {
            const result = await createFirstOrganization({
                organizationName,
                organizationSlug: organizationSlug || organizationName,
                siteName,
                siteCode,
                adminName,
                adminEmail,
                adminPassword,
            });
            if (result.error) {
                setError(result.error);
                return;
            }
            setSuccess(true);
            setTimeout(() => window.location.reload(), 1500);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mb-4">✓</div>
                <h3 className="text-lg font-bold text-gray-900">Organisation Created!</h3>
                <p className="text-sm text-gray-500 mt-2">Redirecting to login so you can sign in with your new account...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="orgName" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Organisation Name</label>
                    <input
                        id="orgName"
                        type="text"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Acme Global"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="orgSlug" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Slug (Internal ID)</label>
                    <input
                        id="orgSlug"
                        type="text"
                        value={organizationSlug}
                        onChange={(e) => setOrganizationSlug(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="acme-global"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="siteName" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">First Site Name</label>
                <input
                    id="siteName"
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Headquarters"
                />
            </div>

            <div className="pt-4 border-t border-gray-100">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Admin Account</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="adminName" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Full Name</label>
                        <input
                            id="adminName"
                            type="text"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="John Doe"
                        />
                    </div>
                    <div>
                        <label htmlFor="adminEmail" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Email Address</label>
                        <input
                            id="adminEmail"
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="admin@acme-global.com"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="adminPassword" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Password</label>
                            <input
                                id="adminPassword"
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                                minLength={8}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Confirm</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-medium text-red-600 flex items-center gap-2">
                    <span className="text-base">⚠️</span> {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black focus:ring-4 focus:ring-gray-900/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
                {loading ? 'Processing…' : 'Create & Sign In →'}
            </button>
        </form>
    );
}
