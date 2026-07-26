import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { equipment_technical_data: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  const techData = workpack.equipment_technical_data ?? null;
  console.log('[TechData GET] workpackId:', id);
  console.log('[TechData GET] Has data:', !!techData);
  console.log('[TechData GET] Data keys:', techData && typeof techData === 'object' ? Object.keys(techData) : 'none');
  
  return NextResponse.json({ data: techData });
}

function getConfirmedBy(session: { user?: any } | null): string {
  const u = session?.user;
  if (!u) return 'Planner';
  return (u.name ?? u.email ?? 'Planner') as string;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { equipment_technical_data: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { path, value, action } = body as {
    path?: string;
    value?: unknown;
    action?: 'confirm' | 'edit';
  };
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'path required' }, { status: 400 });
  }

  const data = structuredClone(
    (workpack.equipment_technical_data ?? {}) as Record<string, unknown>
  );

  const parts = path.split('.');
  let cursor: Record<string, unknown> = data;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
      cursor[parts[i]] = {};
    }
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }

  const lastKey = parts[parts.length - 1];
  const existing = cursor[lastKey] as Record<string, unknown> | undefined;
  const aiOriginal = existing?.aiOriginal ?? (existing && 'value' in existing ? existing.value : existing) ?? null;

  cursor[lastKey] = {
    value,
    confirmed: true,
    editedBy: getConfirmedBy(session),
    editedAt: new Date().toISOString(),
    aiOriginal,
    wasEdited: action === 'edit' && value !== aiOriginal,
  };

  await prisma.workpack.update({
    where: { id },
    data: { equipment_technical_data: data as object },
  });

  return NextResponse.json({ success: true });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const workpack = await prisma.workpack.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: { equipment_technical_data: true },
  });
  if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { section } = body as { section?: string };
  if (!section) {
    return NextResponse.json({ error: 'section required' }, { status: 400 });
  }

  const data = structuredClone(
    (workpack.equipment_technical_data ?? {}) as Record<string, unknown>
  );

  const now = new Date().toISOString();
  const confirmedBy = getConfirmedBy(session);

  function confirmAll(obj: Record<string, unknown>) {
    for (const key of Object.keys(obj)) {
      const field = obj[key];
      if (
        field &&
        typeof field === 'object' &&
        'value' in (field as object) &&
        !(field as Record<string, unknown>).confirmed
      ) {
        (field as Record<string, unknown>).confirmed = true;
        (field as Record<string, unknown>).editedBy = confirmedBy;
        (field as Record<string, unknown>).editedAt = now;
      } else if (
        field &&
        typeof field === 'object' &&
        !Array.isArray(field) &&
        !('value' in (field as object))
      ) {
        confirmAll(field as Record<string, unknown>);
      }
    }
  }

  if (section === 'all') {
    confirmAll(data);
  } else if (data[section] && typeof data[section] === 'object') {
    confirmAll(data[section] as Record<string, unknown>);
  }

  await prisma.workpack.update({
    where: { id },
    data: { equipment_technical_data: data as object },
  });

  return NextResponse.json({ success: true });
}
