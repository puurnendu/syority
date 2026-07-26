import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPlatformApi } from '@/security/apiGuards';
import { sendEmail } from '@/lib/email/emailService';
import { onboardingApprovalEmail } from '@/lib/email/templates';
import { appUrl } from '@/lib/appUrl';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function GET() {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    try {
        const requests = await prisma.onboardingRequest.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(requests);
    } catch (error) {
        console.error('[Admin Onboarding] GET error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const { error } = await guardPlatformApi('nav.admin');
    if (error) return error;

    try {
        const body = await req.json();
        const { id, status, notes } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
        }

        const onboardingRequest = await prisma.onboardingRequest.findUnique({
            where: { id },
        });

        if (!onboardingRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (status === 'APPROVED' && onboardingRequest.status !== 'APPROVED') {
            // 1. Create Organization
            const slug = onboardingRequest.companyName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

            const organization = await prisma.organization.create({
                data: {
                    name: onboardingRequest.companyName,
                    slug: slug,
                    is_active: true,
                },
            });

            // 2. Create Admin User
            const tempPassword = crypto.randomBytes(8).toString('hex');
            const hashedPassword = await bcrypt.hash(tempPassword, 12);

            const user = await prisma.user.create({
                data: {
                    email: onboardingRequest.primaryContactEmail,
                    password: hashedPassword,
                    organization_id: organization.id,
                    role: 'super_admin', // First user is org super admin
                    must_change_password: true,
                    is_active: true,
                },
            });

            // 3. Update Request Status
            await prisma.onboardingRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approved_at: new Date(),
                    notes: notes || onboardingRequest.notes,
                },
            });

            // 4. Send Approval Email
            await sendEmail({
                to: onboardingRequest.primaryContactEmail,
                subject: 'AURIANOA OS — Onboarding Approved',
                html: onboardingApprovalEmail({
                    userName: onboardingRequest.primaryContactEmail.split('@')[0], // Fallback if name not in model
                    orgName: onboardingRequest.companyName,
                    loginUrl: appUrl('/login'),
                    tempPassword: tempPassword,
                }),
            }).catch(err => console.error('[Admin Onboarding] Email error:', err));

            return NextResponse.json({ message: 'Request approved and organization created.' });
        } 
        
        if (status === 'REJECTED') {
            await prisma.onboardingRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    rejected_at: new Date(),
                    notes: notes || onboardingRequest.notes,
                },
            });
            return NextResponse.json({ message: 'Request rejected.' });
        }

        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });

    } catch (error: any) {
        console.error('[Admin Onboarding] PATCH error:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Conflicts exist. Organization or user already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
