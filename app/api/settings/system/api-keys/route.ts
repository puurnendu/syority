import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  const { orgId } = orgScope(session!);

  try {
    const keys = await prisma.apiKey.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        last_used_at: true,
        expires_at: true,
        created_at: true,
        created_by: true,
        // NEVER return key_hash to the frontend
      },
    });

    return NextResponse.json({ keys });
  } catch (err: any) {
    console.error('[ApiKeys GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  const { orgId } = orgScope(session!);
  const userId = (session!.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, expiresInDays } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate a secure API key
    const rawKey = `sk_syo_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    let expiresAt: Date | null = null;
    if (expiresInDays && typeof expiresInDays === 'number') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        id: uuidv4(),
        organization_id: orgId,
        name,
        key_hash: keyHash,
        expires_at: expiresAt,
        created_by: userId,
      },
    });

    return NextResponse.json({
      success: true,
      key: {
        id: apiKey.id,
        name: apiKey.name,
        created_at: apiKey.created_at,
        expires_at: apiKey.expires_at,
      },
      raw_key: rawKey, // Send exactly once
    });
  } catch (err: any) {
    console.error('[ApiKeys POST] Error:', err);
    return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 });
  }
}
