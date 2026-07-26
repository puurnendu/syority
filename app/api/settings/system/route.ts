import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        settings: true,
        feature_flags: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      settings: org.settings || {},
      feature_flags: org.feature_flags || {},
    });
  } catch (err: any) {
    console.error('[SystemSettings GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const body = await req.json();
    const { settings, feature_flags } = body;

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(settings !== undefined && { settings }),
        ...(feature_flags !== undefined && { feature_flags }),
      },
      select: {
        settings: true,
        feature_flags: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: org.settings,
      feature_flags: org.feature_flags,
    });
  } catch (err: any) {
    console.error('[SystemSettings PATCH] Error:', err);
    return NextResponse.json({ error: 'Failed to update system settings' }, { status: 500 });
  }
}
