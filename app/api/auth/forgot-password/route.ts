import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processEvent } from '@/core/notifications';
import { appUrl } from '@/lib/appUrl';
import crypto from 'crypto';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: { organization: true },
        });

        if (!user) {
            // Security: don't reveal if user exists, just return success
            return NextResponse.json({ message: 'If an account exists with this email, a reset link has been sent.' });
        }

        // Generate token and expiry
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                reset_password_token: token,
                reset_password_expires: expires,
            },
        });

        // Send via notification platform
        const resetUrl = appUrl(`/auth/reset-password?token=${token}`);
        
        await processEvent('password.reset', {
            organizationId: user.organization_id ?? undefined,
            triggeredBy: user.id,
            entityType: 'User',
            entityId: user.id,
            variables: {
                user_name: user.name,
                company: user.organization?.name ?? 'AURIANOA OS',
                reset_link: resetUrl,
                expires_in: '1 hour',
                app_url: appUrl('/'),
            },
        }).catch(err => console.error('[Forgot Password] Notification failed:', err));

        return NextResponse.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    } catch (error) {
        console.error('[Forgot Password] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
