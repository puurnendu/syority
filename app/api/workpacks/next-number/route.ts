import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { guardApi } from '@/lib/apiGuard';
import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';

export const GET = withTenantGuard(async (req, _ctx, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;

  const orgId = session.user.organization_id;
  const suggested = await WorkpackService.generateWorkpackNumber(orgId);

  return NextResponse.json({ suggested });
});

