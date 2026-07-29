import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { ScopePackageService } from '@/core/shutdown-scope';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;
  const pkgs = await ScopePackageService.listPackages(orgId, id);
  return NextResponse.json({ data: pkgs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;
  const body = await req.json();

  if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // Check if auto-generate by discipline is requested
  if (body.auto_generate === 'discipline') {
    const result = await ScopePackageService.autoGenerateByDiscipline(orgId, id, userId);
    return NextResponse.json(result);
  }

  const pkg = await ScopePackageService.createPackage({
    organizationId: orgId,
    scopeId: id,
    name: body.name,
    packageType: body.package_type,
    discipline: body.discipline,
    area: body.area,
    contractor: body.contractor,
    riskLevel: body.risk_level,
    description: body.description,
    userId,
  });
  return NextResponse.json(pkg, { status: 201 });
}
