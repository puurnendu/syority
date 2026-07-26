import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimiter';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
        const { allowed, resetAt } = await checkRateLimit(ip, 'auth');
        if (!allowed) return rateLimitResponse(resetAt);

        const body = await req.json().catch(() => ({}));
        const email = (body.email ?? '').trim().toLowerCase();
        const password = body.password;

        if (!email || password === undefined || password === null) {
            return NextResponse.json({
                ok: false,
                field: 'email' as const,
                error: 'Please enter your email address and password.',
            });
        }

        // Find user globally (email is @unique in schema)
        const user = await prisma.user.findFirst({
            where: { email, deleted_at: null },
            include: { organization: { select: { name: true, is_active: true } } },
        });

        if (!user) {
            return NextResponse.json({
                ok: false,
                field: 'email' as const,
                error: 'No account found with this email address.',
            });
        }

        if (!user.is_active) {
            return NextResponse.json({
                ok: false,
                field: 'email' as const,
                error: 'Your account is deactivated. Please contact your administrator.',
            });
        }

        if (!user.organization || !user.organization.is_active) {
            return NextResponse.json({
                ok: false,
                field: 'email' as const,
                error: `The organisation "${user.organization?.name || 'Unknown'}" is suspended.`,
            });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return NextResponse.json({
                ok: false,
                field: 'password' as const,
                error: 'Incorrect password. Please try again.',
            });
        }


        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[check-login]', e);
        return NextResponse.json({
            ok: false,
            field: null,
            error: 'Something went wrong. Please try again.',
        }, { status: 500 });
    }
}
