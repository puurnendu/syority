import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';

/**
 * Legacy bootstrap helper — DISABLED for unauthenticated use.
 * Platform role assignment must go through controlled seed / support tooling.
 */
export async function GET() {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    return NextResponse.json(
        {
            error: 'This endpoint is disabled. Use prisma seed scripts for platform role bootstrap.',
        },
        { status: 410 }
    );
}
