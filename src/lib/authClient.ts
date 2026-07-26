'use client';

import { signOut } from 'next-auth/react';

/**
 * Sign out and always return to /login on the current host/port.
 * Uses window.location.origin so a stale NEXTAUTH_URL (wrong port) cannot hijack logout.
 */
export function signOutToLogin(query?: string) {
    const path = query ? `/login?${query.replace(/^\?/, '')}` : '/login';
    const callbackUrl =
        typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : path;
    return signOut({ callbackUrl, redirect: true });
}
