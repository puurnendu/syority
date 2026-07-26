import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const integrations = await prisma.integrationConfig.findMany({
      where: { organization_id: orgId },
    });

    return NextResponse.json({ integrations });
  } catch (err: any) {
    console.error('[Integrations GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const body = await req.json();
    const { provider, config, status } = body;

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (config !== undefined) dataToUpdate.config = config;
    if (status !== undefined) dataToUpdate.status = status;

    const integration = await prisma.integrationConfig.upsert({
      where: {
        organization_id_provider: {
          organization_id: orgId,
          provider,
        },
      },
      create: {
        id: uuidv4(),
        organization_id: orgId,
        provider,
        config: config || {},
        status: status || 'disconnected',
      },
      update: dataToUpdate,
    });

    return NextResponse.json({ success: true, integration });
  } catch (err: any) {
    console.error('[Integrations PATCH] Error:', err);
    return NextResponse.json({ error: 'Failed to update integration config' }, { status: 500 });
  }
}
