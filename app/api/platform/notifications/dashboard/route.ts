/**
 * GET /api/platform/notifications/dashboard — Dashboard statistics
 */
import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { getDashboardStats } from '@/core/notifications';

export async function GET() {
  const { error } = await guardPlatformApi('nav.admin');
  if (error) return error;

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
