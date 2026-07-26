import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/emailService';
import { passwordResetEmail } from '@/lib/email/templates';
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

        // Send email
        const resetUrl = appUrl(`/auth/reset-password?token=${token}`);
        
        await sendEmail({
            to: user.email,
            subject: 'AURIANOA OS — Password Reset Request',
            html: passwordResetEmail({
                userName: user.name,
                orgName: user.organization.name,
                resetUrl: resetUrl,
                expiresIn: '1 hour',
            }),
        }).catch(err => console.error('[Forgot Password] Email failed:', err));

        return NextResponse.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    } catch (error) {
        console.error('[Forgot Password] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
