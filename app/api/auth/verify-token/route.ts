import { NextResponse } from 'next/server';

/**
 * GET /api/auth/verify-token
 *
 * TEMPORARILY DISABLED — M7.8.7 Stabilization.
 *
 * The User model does not have reset_password_token, reset_password_expires,
 * invite_token, or invite_expires fields.
 * A schema migration is required before this endpoint can be activated.
 *
 * @see prisma/schema.prisma — model User
 */
export async function GET() {
    return NextResponse.json(
        {
            valid: false,
            error: 'Token verification is not available in this release.',
            code: 'FEATURE_NOT_IMPLEMENTED',
        },
        { status: 501 }
    );
}
