/**
 * M7.6B — Data Providers API
 * GET: List all registered data providers with metadata
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { providerRegistry } from '@/core/report-engine';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const byCategory = providerRegistry.listByCategory();
    const all = providerRegistry.listAll();

    return NextResponse.json({
      total: all.length,
      byCategory,
      providers: all,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
