import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const ssoConfig = await prisma.ssoConfig.findUnique({
      where: { organization_id: orgId },
    });

    return NextResponse.json({ config: ssoConfig });
  } catch (err: any) {
    console.error('[SSO GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch SSO config' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const body = await req.json();
    const { provider_type, idp_url, client_id, client_secret, certificate, domain_whitelist, is_active } = body;

    const ssoConfig = await prisma.ssoConfig.upsert({
      where: { organization_id: orgId },
      create: {
        id: uuidv4(),
        organization_id: orgId,
        provider_type: provider_type || 'saml',
        idp_url: idp_url || null,
        client_id: client_id || null,
        client_secret: client_secret || null,
        certificate: certificate || null,
        domain_whitelist: domain_whitelist || [],
        is_active: is_active || false,
      },
      update: {
        ...(provider_type !== undefined && { provider_type }),
        ...(idp_url !== undefined && { idp_url }),
        ...(client_id !== undefined && { client_id }),
        ...(client_secret !== undefined && { client_secret }),
        ...(certificate !== undefined && { certificate }),
        ...(domain_whitelist !== undefined && { domain_whitelist }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    return NextResponse.json({ success: true, config: ssoConfig });
  } catch (err: any) {
    console.error('[SSO PATCH] Error:', err);
    return NextResponse.json({ error: 'Failed to update SSO config' }, { status: 500 });
  }
}
