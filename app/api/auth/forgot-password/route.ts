import { NextResponse } from 'next/server';

/**
 * POST /api/auth/forgot-password
 *
 * TEMPORARILY DISABLED — M7.8.7 Stabilization.
 *
 * The User model does not have reset_password_token or reset_password_expires fields.
 * A schema migration is required before this endpoint can be activated.
 *
 * @see prisma/schema.prisma — model User
 */
export async function POST() {
    return NextResponse.json(
        {
            error: 'Password reset is not available in this release.',
            code: 'FEATURE_NOT_IMPLEMENTED',
        },
        { status: 501 }
    );
}
