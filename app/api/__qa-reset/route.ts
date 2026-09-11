/**
 * M7.8.8 — Temporary password reset utility for QA.
 * REMOVE AFTER M7.8.8 QA IS COMPLETE.
 *
 * Usage: GET /api/__qa-reset?email=admin@technip.test&password=Admin@123
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const password = searchParams.get('password');

    if (!email || !password) {
        return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    }

    // Safety: only allow test domain emails
    if (!email.endsWith('.test') && !email.endsWith('@syority.dev')) {
        return NextResponse.json({ error: 'Only .test domain emails allowed in QA reset' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
    }

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hash, must_change_password: false },
    });

    return NextResponse.json({
        ok: true,
        message: `Password for ${email} updated successfully`,
        user: { id: user.id, name: user.name, email: user.email },
    });
}
