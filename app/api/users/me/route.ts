import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp_number: true,
      whatsapp_verified: true,
      whatsapp_opt_in: true,
      preferred_language: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const updateData: {
    whatsapp_number?: string | null;
    whatsapp_opt_in?: boolean;
    preferred_language?: string | null;
  } = {};

  if (typeof body.whatsapp_number !== 'undefined') {
    const v = (body.whatsapp_number as string)?.trim() || null;
    updateData.whatsapp_number = v;
  }
  if (typeof body.whatsapp_opt_in === 'boolean') {
    updateData.whatsapp_opt_in = body.whatsapp_opt_in;
  }
  if (typeof body.preferred_language !== 'undefined') {
    const v = (body.preferred_language as string)?.trim() || null;
    updateData.preferred_language = v;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      whatsapp_number: true,
      whatsapp_opt_in: true,
      preferred_language: true,
    },
  });

  return NextResponse.json(updated);
}
