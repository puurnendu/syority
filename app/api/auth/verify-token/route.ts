import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const type = searchParams.get('type') || 'reset'; // 'reset' or 'invite'

    if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    try {
        let user;
        if (type === 'reset') {
            user = await prisma.user.findFirst({
                where: {
                    reset_password_token: token,
                    reset_password_expires: { gt: new Date() },
                },
                select: { id: true, name: true, email: true },
            });
        } else if (type === 'invite') {
            user = await prisma.user.findFirst({
                where: {
                    invite_token: token,
                    invite_expires: { gt: new Date() },
                },
                select: { id: true, name: true, email: true },
            });
        }

        if (!user) {
            return NextResponse.json({ valid: false, error: 'Invalid or expired token' });
        }

        return NextResponse.json({ valid: true, user });
    } catch (error) {
        console.error('[Verify Token] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
