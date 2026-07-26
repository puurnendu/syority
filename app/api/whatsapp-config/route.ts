import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const orgId = session.user.organization_id;
  const config = await prisma.aiProviderSetting.findUnique({
    where: { organization_id: orgId },
    select: {
      whatsapp_business_id: true,
      whatsapp_phone_number_id: true,
      whatsapp_verify_token: true,
      whatsapp_access_token_encrypted: true,
    },
  });

  return NextResponse.json({
    data: {
      ...config,
      has_access_token: !!config?.whatsapp_access_token_encrypted,
    },
  });
});

export const PUT = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const orgId = session.user.organization_id;
  const body = await req.json();

  const {
    whatsapp_business_id,
    whatsapp_phone_number_id,
    whatsapp_verify_token,
    whatsapp_access_token,
  } = body;

  const updateData: any = {
    whatsapp_business_id: whatsapp_business_id || null,
    whatsapp_phone_number_id: whatsapp_phone_number_id || null,
    whatsapp_verify_token: whatsapp_verify_token || null,
  };

  if (whatsapp_access_token) {
    updateData.whatsapp_access_token_encrypted = encrypt(whatsapp_access_token);
  }

  const config = await prisma.aiProviderSetting.upsert({
    where: { organization_id: orgId },
    update: updateData,
    create: {
      organization_id: orgId,
      ...updateData,
    },
  });

  return NextResponse.json({ success: true });
});
