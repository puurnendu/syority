'use client';

import { signOutToLogin } from '@/lib/authClient';

export function SignOutButton() {
    return (
        <button
            type="button"
            onClick={() => signOutToLogin()}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
        >
            Sign out
        </button>
    );
}
