import { NextRequest, NextResponse } from 'next/server';
import { orgScope } from '@/lib/apiGuard';
import { guardPlatformApi } from '@/security/apiGuards';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { AuditService } from '@/lib/audit';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { new_password } = body;

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
        return NextResponse.json(
            { error: 'Password must be at least 8 characters' },
            { status: 400 }
        );
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, name: true, organization_id: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const hashedPassword = await bcrypt.hash(new_password, 12);

        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword }
        });

        const { userId: adminId } = orgScope(session!);

        await AuditService.log({
            organization_id: user.organization_id,
            user_id: adminId!,
            action: 'UPDATE', // Using UPDATE as there is no specific RESET_PASSWORD action in the audit logs usually
            model_name: 'User',
            model_id: user.id,
            new_values: { message: 'Password reset by platform admin' }
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err: any) {
        console.error('[AdminPasswordReset]', err);
        return NextResponse.json(
            { error: 'Failed to reset password' },
            { status: 500 }
        );
    }
}
