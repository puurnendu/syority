/**
 * M7.6G.1 — Organization Reset API
 *
 * POST /api/admin/reset { action: 'preview' | 'execute', organizationId, options }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resetService } from '@/core/Platform/ResetService';
import { hasPermission } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  const role = user.role ?? '';
  if (!hasPermission(role, 'nav.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { action, organizationId, options = {} } = body;

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId required' }, { status: 422 });
  }

  switch (action) {
    case 'preview': {
      const preview = await resetService.preview(organizationId, options);
      return NextResponse.json(preview);
    }

    case 'execute': {
      const result = await resetService.execute(organizationId, options, user.id);
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
