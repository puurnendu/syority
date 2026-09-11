'use client';

import { SessionProvider } from 'next-auth/react';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';
import { ActiveShutdownProvider } from '../context/ActiveShutdownContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <UserPreferencesProvider>
                <ActiveShutdownProvider>
                    {children}
                </ActiveShutdownProvider>
            </UserPreferencesProvider>
        </SessionProvider>
    );
}
