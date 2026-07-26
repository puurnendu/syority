import Link from 'next/link';
import { requirePlatformContext } from '@/lib/server-context';

import { getSystemReadiness } from '@/lib/system/readiness';
import { SetupActions } from '@/components/admin/SetupActions';

export default async function AdminSetupPage() {
    const session = await requirePlatformContext();
    

    const readiness = await getSystemReadiness();

    // System already bootstrapped — show health status (do not bounce to tenant dashboard).
    if (readiness.isReady) {
        return (
            <div className="max-w-2xl mx-auto p-8">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-gray-900">
                    <h1 className="text-2xl font-bold mb-2">Setup / Health</h1>
                    <p className="text-sm text-gray-600 mb-6">
                        Platform bootstrap is complete. All readiness checks passed.
                    </p>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-medium">
                        System ready
                    </div>
                    <Link
                        href="/platform/tenants"
                        className="inline-block mt-6 text-sm text-blue-600 hover:underline"
                    >
                        ← Back to Tenants
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-8">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-gray-900">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-2">System Setup</h1>
                    <p className="text-sm text-gray-600">
                        Complete the following steps to finish setting up Syority.
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Organization Check */}
                    <Link
                        href="/settings/organization"
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all hover:shadow-md group ${readiness.checks.hasOrganization
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                            }`}
                    >
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${readiness.checks.hasOrganization
                            ? 'bg-green-500'
                            : 'bg-gray-300 group-hover:bg-blue-400'
                            }`}>
                            {readiness.checks.hasOrganization && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-semibold text-sm ${readiness.checks.hasOrganization ? 'text-green-900' : 'text-gray-900 group-hover:text-blue-700'
                                }`}>
                                Organization Configured
                            </h3>
                            <p className={`text-xs mt-1 ${readiness.checks.hasOrganization ? 'text-green-700' : 'text-gray-600'
                                }`}>
                                {readiness.checks.hasOrganization
                                    ? 'At least one organization exists.'
                                    : 'Create at least one organization to continue.'}
                            </p>
                        </div>
                        {!readiness.checks.hasOrganization && (
                            <span className="text-blue-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Configure →</span>
                        )}
                    </Link>

                    {/* Role Check */}
                    <Link
                        href="/settings/roles"
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all hover:shadow-md group ${readiness.checks.hasRole
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                            }`}
                    >
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${readiness.checks.hasRole
                            ? 'bg-green-500'
                            : 'bg-gray-300 group-hover:bg-blue-400'
                            }`}>
                            {readiness.checks.hasRole && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-semibold text-sm ${readiness.checks.hasRole ? 'text-green-900' : 'text-gray-900 group-hover:text-blue-700'
                                }`}>
                                Roles Configured
                            </h3>
                            <p className={`text-xs mt-1 ${readiness.checks.hasRole ? 'text-green-700' : 'text-gray-600'
                                }`}>
                                {readiness.checks.hasRole
                                    ? 'At least one role exists.'
                                    : 'Create at least one role to continue.'}
                            </p>
                        </div>
                        {!readiness.checks.hasRole && (
                            <span className="text-blue-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Configure →</span>
                        )}
                    </Link>

                    {/* User Check */}
                    <Link
                        href="/settings/users"
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all hover:shadow-md group ${readiness.checks.hasUser
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                            }`}
                    >
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${readiness.checks.hasUser
                            ? 'bg-green-500'
                            : 'bg-gray-300 group-hover:bg-blue-400'
                            }`}>
                            {readiness.checks.hasUser && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-semibold text-sm ${readiness.checks.hasUser ? 'text-green-900' : 'text-gray-900 group-hover:text-blue-700'
                                }`}>
                                Users Created
                            </h3>
                            <p className={`text-xs mt-1 ${readiness.checks.hasUser ? 'text-green-700' : 'text-gray-600'
                                }`}>
                                {readiness.checks.hasUser
                                    ? 'At least one active user exists.'
                                    : 'Create at least one active user to continue.'}
                            </p>
                        </div>
                        {!readiness.checks.hasUser && (
                            <span className="text-blue-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Configure →</span>
                        )}
                    </Link>

                    {/* AI Provider (optional custom config) */}
                    <Link
                        href="/settings/ai-config"
                        className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-blue-300 hover:shadow-md group"
                    >
                        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 bg-gray-300 group-hover:bg-blue-400">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm text-gray-900 group-hover:text-blue-700">
                                AI (optional custom provider)
                            </h3>
                            <p className="text-xs mt-1 text-gray-600">
                                AI is enabled by default for all organisations. Configure here to use your own API key or model.
                            </p>
                        </div>
                        <span className="text-blue-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Configure →</span>
                    </Link>
                </div>

                <SetupActions isReady={readiness.isReady} />
            </div>
        </div>
    );
}
