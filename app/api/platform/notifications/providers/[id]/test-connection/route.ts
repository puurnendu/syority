/**
 * POST /api/platform/notifications/providers/[id]/test-connection — Test SMTP connection
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { testProviderConnection } from '@/core/notifications';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;
  const { id } = await params;

  const result = await testProviderConnection(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
