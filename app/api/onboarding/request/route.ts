import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/emailService';
import { onboardingSubmissionEmail } from '@/lib/email/templates';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { organization_name, admin_email, admin_name, notes } = body;

        if (!organization_name || !admin_email || !admin_name) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 1. Check if email already exists in User table
        const existingUser = await prisma.user.findUnique({
            where: { email: admin_email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists.' },
                { status: 409 }
            );
        }

        // 2. Check for existing PENDING onboarding request
        const existingRequest = await prisma.onboardingRequest.findFirst({
            where: {
                admin_email,
                status: 'PENDING',
            },
        });

        if (existingRequest) {
            return NextResponse.json(
                { error: 'An onboarding request for this email is already pending review.' },
                { status: 409 }
            );
        }

        // 3. Create the request
        const onboardingRequest = await prisma.onboardingRequest.create({
            data: {
                organization_name,
                admin_email,
                notes: notes || `Request from ${admin_name}`,
                status: 'PENDING',
            },
        });

        // 4. Send confirmation email to the user
        await sendEmail({
            to: admin_email,
            subject: 'AURIANOA OS — Onboarding Request Received',
            html: onboardingSubmissionEmail({
                userName: admin_name,
                orgName: organization_name,
            }),
        }).catch((err) => {
            console.error('[Onboarding] Failed to send confirmation email:', err);
        });

        return NextResponse.json(
            {
                message: 'Onboarding request submitted successfully.',
                id: onboardingRequest.id,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[Onboarding] Submission error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
