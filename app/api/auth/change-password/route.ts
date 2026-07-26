import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string' || password.length < 8) {
        return NextResponse.json(
            { error: 'Password must be at least 8 characters.' },
            { status: 400 }
        );
    }

    const token = await getToken({
        req: req as any,
        secret: process.env.NEXTAUTH_SECRET,
    });

    // NextAuth's canonical subject is token.sub (set from authorize()'s user.id).
    // Prefer sub over session.user.id / token.id — stale cookies after DB recreate
    // can leave session.user.id pointing at a UUID that no longer exists (P2025).
    const candidateId =
        (typeof token?.sub === 'string' && token.sub) ||
        (typeof token?.id === 'string' && token.id) ||
        session.user.id;

    console.log('[change-password] complete session object:', JSON.stringify(session, null, 2));
    console.log('[change-password] session.user:', JSON.stringify(session.user, null, 2));
    console.log('[change-password] userId being used:', candidateId);
    console.log('[change-password] jwt.sub / jwt.id:', { sub: token?.sub, id: token?.id });

    const where = { id: candidateId as string };
    console.log('[change-password] prisma where clause:', JSON.stringify(where));

    const foundById = candidateId
        ? await prisma.user.findUnique({ where })
        : null;
    console.log(
        '[change-password] findUnique result:',
        foundById
            ? { id: foundById.id, email: foundById.email, deleted_at: foundById.deleted_at }
            : null
    );

    // Resolve by email when id misses (stale JWT after volume recreate)
    const user =
        foundById ??
        (session.user.email
            ? await prisma.user.findUnique({ where: { email: session.user.email } })
            : null);

    if (!user) {
        // Do not call update() with a missing id — that is the P2025 root cause.
        console.error(
            '[change-password] No User row for session. Re-login required.',
            { candidateId, email: session.user.email }
        );
        return NextResponse.json(
            { error: 'Your session is out of date. Please sign in again.' },
            { status: 401 }
        );
    }

    const hashed = await bcrypt.hash(password, 12);

    // Update by the verified DB primary key only (never a stale session id)
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashed,
            must_change_password: false,
        },
    });

    return NextResponse.json({ ok: true });
}
