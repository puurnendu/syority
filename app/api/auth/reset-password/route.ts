import { NextResponse } from 'next/server';

/**
 * POST /api/auth/reset-password
 *
 * TEMPORARILY DISABLED — M7.8.7 Stabilization.
 *
 * The User model does not have resetPasswordToken or resetPasswordExpires fields
 * (neither camelCase nor snake_case variants exist in the live schema).
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
