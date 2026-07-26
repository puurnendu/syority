import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    context: { params: Promise<{ siteId: string }> }
) {
    const { session, error } = await guardApi('settings.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { siteId } = await context.params;

    const site = await prisma.site.findFirst({
        where: { id: siteId, organization_id: orgId },
        select: {
            id: true,
            name: true,
            pressure_test_standard: true,
            hydrotest_multiplier: true,
            pneumatic_test_multiplier: true,
            torque_standard: true,
            test_standard_notes: true,
        },
    });
    if (!site)
        return NextResponse.json(
            { error: 'Site not found' },
            { status: 404 }
        );
    return NextResponse.json(site);
}

export async function PATCH(
    req: Request,
    context: { params: Promise<{ siteId: string }> }
) {
    const { session, error } = await guardApi('settings.org.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { siteId } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body)
        return NextResponse.json(
            { error: 'Invalid body' },
            { status: 400 }
        );

    if (body.hydrotest_multiplier !== undefined) {
        const m = parseFloat(body.hydrotest_multiplier);
        if (isNaN(m) || m < 1.0 || m > 2.0) {
            return NextResponse.json(
                {
                    error:
                        'hydrotest_multiplier must be between 1.0 and 2.0',
                },
                { status: 400 }
            );
        }
    }

    const existing = await prisma.site.findFirst({
        where: { id: siteId, organization_id: orgId },
    });
    if (!existing)
        return NextResponse.json(
            { error: 'Site not found' },
            { status: 404 }
        );

    const updated = await prisma.site.update({
        where: { id: siteId },
        data: {
            pressure_test_standard:
                body.pressure_test_standard ?? undefined,
            hydrotest_multiplier:
                body.hydrotest_multiplier !== undefined
                    ? parseFloat(body.hydrotest_multiplier)
                    : undefined,
            pneumatic_test_multiplier:
                body.pneumatic_test_multiplier !== undefined
                    ? parseFloat(body.pneumatic_test_multiplier)
                    : undefined,
            torque_standard: body.torque_standard ?? undefined,
            test_standard_notes:
                body.test_standard_notes ?? undefined,
        },
        select: {
            id: true,
            name: true,
            pressure_test_standard: true,
            hydrotest_multiplier: true,
            pneumatic_test_multiplier: true,
            torque_standard: true,
            test_standard_notes: true,
        },
    });
    return NextResponse.json(updated);
}
