import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

function inferEquipmentAssetType(tag: string): string | null {
  const t = tag.toUpperCase();
  if (/^E-|^EA-|^HE-/.test(t)) return 'heat_exchanger';
  if (/^P-/.test(t)) return 'pump';
  if (/^V-/.test(t)) return 'vessel';
  if (/^T-/.test(t)) return 'tank';
  if (/^K-/.test(t)) return 'compressor';
  if (/^C-/.test(t)) return 'column';
  if (/^FN-/.test(t)) return 'fan';
  return null;
}

function resolveAssetType(tag: string, itemType?: string): string | null {
  if (itemType === 'valve') return 'valve';
  if (itemType === 'instrument') return 'instrument';
  if (itemType === 'equipment') return inferEquipmentAssetType(tag);
  return inferEquipmentAssetType(tag);
}

const REGISTER_ASSET_TYPES = new Set(['equipment', 'valve', 'instrument']);

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { jobId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const accepted_tags: string[] = Array.isArray(body?.accepted_tags) ? body.accepted_tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [];
  const accepted_lines: string[] = Array.isArray(body?.accepted_lines) ? body.accepted_lines.map((l: unknown) => String(l).trim()).filter(Boolean) : [];
  const unit_id = body?.unit_id as string | undefined;
  if (!unit_id) return NextResponse.json({ error: 'unit_id is required' }, { status: 400 });

  const unit = await prisma.unit.findFirst({
    where: { id: unit_id, organization_id: orgId },
    select: { id: true, site_id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const job = await prisma.aiExtractionJob.findFirst({
    where: { id: jobId, organization_id: orgId },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const result = await prisma.aiExtractionResult.findUnique({
    where: { ai_extraction_job_id: jobId },
    select: { extracted_data_json: true },
  });
  if (!result) return NextResponse.json({ error: 'Extraction result not found' }, { status: 404 });

  const data = result.extracted_data_json as { items?: Array<{ item_type: string; tag_number: string; description?: string | null; confidence?: string }> };
  const items = data?.items ?? [];

  let assets_created = 0;
  let lines_created = 0;
  let skipped = 0;
  const skipped_tags: string[] = [];
  const skipped_lines: string[] = [];

  const assetByTag = new Map<string, (typeof items)[0]>();
  const lineByNumber = new Map<string, (typeof items)[0]>();
  for (const it of items) {
    if (REGISTER_ASSET_TYPES.has(it.item_type)) {
      assetByTag.set(it.tag_number, it);
      assetByTag.set(it.tag_number.toUpperCase(), it);
    }
    if (it.item_type === 'line') lineByNumber.set(it.tag_number, it);
  }

  for (const tag of accepted_tags) {
    const it = assetByTag.get(tag) ?? assetByTag.get(tag.trim().toUpperCase());
    const tagNorm = tag.trim().toUpperCase();
    const existing = await prisma.asset.findUnique({
      where: { organization_id_tag_number: { organization_id: orgId, tag_number: tagNorm } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      skipped_tags.push(tagNorm);
      continue;
    }
    await prisma.asset.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        site_id: unit.site_id,
        unit_id: unit.id,
        tag_number: tagNorm,
        name: it?.description ?? tagNorm,
        asset_type: resolveAssetType(tagNorm, it?.item_type),
        data_source: 'p_and_id',
        extraction_confidence: it?.confidence === 'high' ? 1 : it?.confidence === 'medium' ? 0.7 : 0.5,
        created_by: userId,
      },
    });
    assets_created++;
  }

  for (const lineNum of accepted_lines) {
    const it = lineByNumber.get(lineNum);
    const lineNorm = lineNum.trim();
    const existing = await prisma.line_lists.findUnique({
      where: { organization_id_line_number: { organization_id: orgId, line_number: lineNorm } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      skipped_lines.push(lineNorm);
      continue;
    }
    await prisma.line_lists.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        site_id: unit.site_id,
        unit_id: unit.id,
        line_number: lineNorm,
        created_by: userId,
        updated_at: new Date(),
      },
    });
    lines_created++;
  }

  await prisma.aiExtractionResult.update({
    where: { ai_extraction_job_id: jobId },
    data: {
      review_status: 'approved',
      reviewed_by: userId,
      reviewed_at: new Date(),
      updated_at: new Date(),
    },
  });

  return NextResponse.json({
    assets_created,
    lines_created,
    skipped,
    skipped_tags,
    skipped_lines,
  });
}
