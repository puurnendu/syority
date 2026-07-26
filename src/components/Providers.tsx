'use client';

import { SessionProvider } from 'next-auth/react';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <UserPreferencesProvider>
                {children}
            </UserPreferencesProvider>
        </SessionProvider>
    );
}
