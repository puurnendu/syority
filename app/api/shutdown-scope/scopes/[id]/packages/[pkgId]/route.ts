import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopePackageService } from '@/core/shutdown-scope';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; pkgId: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { pkgId } = await params;
  const body = await req.json();
  const result = await ScopePackageService.updatePackage(orgId, pkgId, body);
  return NextResponse.json(result);
}
