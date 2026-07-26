import './globals.css';
import { Providers } from '@/components/Providers';
import { PwaRegistry } from '@/components/PwaRegistry';
import { NetworkProvider } from '@/components/NetworkProvider';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Syority',
    description: 'Multi-tenant industrial operations platform',
    manifest: '/manifest.json',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <PwaRegistry />
                <NetworkProvider />
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
