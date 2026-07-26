import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/health/db
 * Check database connection and organization count.
 * Open in browser: /api/health/db
 */
export async function GET() {
    try {
        const count = await prisma.organization.count({
            where: {
                deleted_at: null,
                OR: [{ is_active: true }, { is_active: null }],
            },
        });
        return NextResponse.json({
            ok: true,
            database: 'connected',
            organizationCount: count,
            message:
                count === 0
                    ? 'Database is connected but no organizations found. Create one via First-time setup on /login or run npm run seed.'
                    : `${count} organization(s) found. You can sign in on /login.`,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Database unavailable';
        return NextResponse.json(
            {
                ok: false,
                database: 'error',
                error: message,
                hint: 'Check DATABASE_URL in .env (project root) and that PostgreSQL is running. Run: npx prisma db push',
            },
            { status: 503 }
        );
    }
}
