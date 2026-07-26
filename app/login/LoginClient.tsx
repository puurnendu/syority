'use client';

import { useState, Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { SetupForm } from './SetupForm';

type Org = { id: string; name: string; slug: string | null };

export function LoginClient({ organizations }: { organizations: Org[] }) {
    const [isSetupExpanded, setIsSetupExpanded] = useState(organizations.length === 0);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black tracking-tighter text-blue-700">SYORITY</h1>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">PLATFORM</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-4 font-medium uppercase tracking-wider">Refinery Turnaround Management</p>
                </div>

                <div className="space-y-4">
                    {/* Sign In Card */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-blue-900/5 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-900">Sign In</h2>
                        </div>
                        <div className="p-8">
                            <Suspense fallback={<div className="h-48 flex items-center justify-center text-sm text-gray-400">Loading components...</div>}>
                                <LoginForm />

                            </Suspense>
                        </div>
                    </div>

                    {/* Create Organisation Card — Only shown for bootstrap */}
                    {organizations.length === 0 && (
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-blue-900/5 overflow-hidden">
                            <button
                                onClick={() => setIsSetupExpanded(!isSetupExpanded)}
                                className="w-full px-8 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-lg font-bold text-gray-900">Create Organisation</span>
                                    <span className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Required for first-time use</span>
                                </div>
                                <span className="text-2xl text-gray-400 group-hover:text-blue-600 transition-colors">
                                    {isSetupExpanded ? '−' : '＋'}
                                </span>
                            </button>

                            {isSetupExpanded && (
                                <div className="p-8 border-t border-gray-100">
                                    <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-gray-400">Loading setup...</div>}>
                                        <SetupForm />
                                    </Suspense>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                <p className="text-center text-xs text-gray-400 mt-8 font-medium">
                    © 2026 SYORITY Technologies. All rights reserved.
                </p>
            </div>
        </div>
    );
}
