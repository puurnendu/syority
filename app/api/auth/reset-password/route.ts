import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const { token, new_password } = await req.json();

        if (!token || !new_password) {
            return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: { gt: new Date() },
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(new_password, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null,
                must_change_password: false, // Reset flag if it was set
            },
        });

        return NextResponse.json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('[Reset Password] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
