import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { DEFAULT_HEADER_ZONES, DEFAULT_FOOTER_ZONES } from '@/types/printSettings.types';
import { enqueueKnowledgeCapture } from '@/core/knowledge-engine/capture';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.user as { organization_id?: string }).organization_id;
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

  try {
    const settings = await prisma.workpack_print_settings.findUnique({
      where: { organization_id: orgId },
    });
    if (!settings) {
      return NextResponse.json({
        cover_show: true,
        cover_title_variable: '{workpack_number} — {title}',
        cover_subtitle_variable: '{org_name} | {site_name}',
        cover_accent_color: '#E8701A',
        cover_bg_color: '#0D2137',
        header_zones: DEFAULT_HEADER_ZONES,
        header_bg_color: '#0D2137',
        header_text_color: '#FFFFFF',
        header_height_mm: 18,
        header_show_border: false,
        header_border_color: '#E8701A',
        footer_zones: DEFAULT_FOOTER_ZONES,
        footer_bg_color: '#0D2137',
        footer_text_color: '#FFFFFF',
        footer_height_mm: 12,
        footer_show_border: true,
        footer_border_color: '#E8701A',
        page_size: 'A4',
        margin_top_mm: 15,
        margin_bottom_mm: 15,
        margin_left_mm: 15,
        margin_right_mm: 15,
        watermark_text: null,
        watermark_draft_only: true,
        logo_library: [],
        cover_page_settings: null,
        last_page_settings: null,
      });
    }
    return NextResponse.json(settings);
  } catch (err: unknown) {
    console.error('[GET print-settings]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load print settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.user as { organization_id?: string }).organization_id;
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

  const userId = session.user.id!;

  try {
    const body = await req.json().catch(() => ({}));

    const headerZones = body.header_zones ?? DEFAULT_HEADER_ZONES;
    const footerZones = body.footer_zones ?? DEFAULT_FOOTER_ZONES;
    const logoLibrary = Array.isArray(body.logo_library) ? body.logo_library : [];
    const coverPageSettings = body.cover_page_settings != null ? body.cover_page_settings : undefined;
    const lastPageSettings = body.last_page_settings != null ? body.last_page_settings : undefined;

    const createData = {
      organization_id: orgId,
      updated_by: userId,
      cover_image_path: body.cover_image_path ?? null,
      cover_image_opacity: body.cover_image_opacity != null ? Number(body.cover_image_opacity) : 1.0,
      cover_show: body.cover_show ?? true,
      cover_title_variable: body.cover_title_variable ?? '{workpack_number} — {title}',
      cover_subtitle_variable: body.cover_subtitle_variable ?? '{org_name} | {site_name}',
      cover_accent_color: body.cover_accent_color ?? '#E8701A',
      cover_bg_color: body.cover_bg_color ?? '#0D2137',
      header_zones: headerZones as object,
      header_bg_color: body.header_bg_color ?? '#0D2137',
      header_text_color: body.header_text_color ?? '#FFFFFF',
      header_height_mm: body.header_height_mm != null ? Number(body.header_height_mm) : 18,
      header_show_border: body.header_show_border ?? false,
      header_border_color: body.header_border_color ?? '#E8701A',
      footer_zones: footerZones as object,
      footer_bg_color: body.footer_bg_color ?? '#0D2137',
      footer_text_color: body.footer_text_color ?? '#FFFFFF',
      footer_height_mm: body.footer_height_mm != null ? Number(body.footer_height_mm) : 12,
      footer_show_border: body.footer_show_border ?? true,
      footer_border_color: body.footer_border_color ?? '#E8701A',
      page_size: body.page_size ?? 'A4',
      margin_top_mm: body.margin_top_mm != null ? Number(body.margin_top_mm) : 15,
      margin_bottom_mm: body.margin_bottom_mm != null ? Number(body.margin_bottom_mm) : 15,
      margin_left_mm: body.margin_left_mm != null ? Number(body.margin_left_mm) : 15,
      margin_right_mm: body.margin_right_mm != null ? Number(body.margin_right_mm) : 15,
      watermark_text: body.watermark_text ?? null,
      watermark_draft_only: body.watermark_draft_only ?? true,
      logo_library: JSON.parse(JSON.stringify(logoLibrary)) as Prisma.InputJsonValue,
      cover_page_settings: coverPageSettings != null ? (JSON.parse(JSON.stringify(coverPageSettings)) as Prisma.InputJsonValue) : undefined,
      last_page_settings: lastPageSettings != null ? (JSON.parse(JSON.stringify(lastPageSettings)) as Prisma.InputJsonValue) : undefined,
    };

    const updateData = {
      updated_by: userId,
      cover_image_path: body.cover_image_path ?? undefined,
      cover_image_opacity: body.cover_image_opacity != null ? Number(body.cover_image_opacity) : undefined,
      cover_show: body.cover_show ?? undefined,
      cover_title_variable: body.cover_title_variable ?? undefined,
      cover_subtitle_variable: body.cover_subtitle_variable ?? undefined,
      cover_accent_color: body.cover_accent_color ?? undefined,
      cover_bg_color: body.cover_bg_color ?? undefined,
      header_zones: headerZones as object,
      header_bg_color: body.header_bg_color ?? undefined,
      header_text_color: body.header_text_color ?? undefined,
      header_height_mm: body.header_height_mm != null ? Number(body.header_height_mm) : undefined,
      header_show_border: body.header_show_border ?? undefined,
      header_border_color: body.header_border_color ?? undefined,
      footer_zones: footerZones as object,
      footer_bg_color: body.footer_bg_color ?? undefined,
      footer_text_color: body.footer_text_color ?? undefined,
      footer_height_mm: body.footer_height_mm != null ? Number(body.footer_height_mm) : undefined,
      footer_show_border: body.footer_show_border ?? undefined,
      footer_border_color: body.footer_border_color ?? undefined,
      page_size: body.page_size ?? undefined,
      margin_top_mm: body.margin_top_mm != null ? Number(body.margin_top_mm) : undefined,
      margin_bottom_mm: body.margin_bottom_mm != null ? Number(body.margin_bottom_mm) : undefined,
      margin_left_mm: body.margin_left_mm != null ? Number(body.margin_left_mm) : undefined,
      margin_right_mm: body.margin_right_mm != null ? Number(body.margin_right_mm) : undefined,
      watermark_text: body.watermark_text ?? undefined,
      watermark_draft_only: body.watermark_draft_only ?? undefined,
      logo_library: JSON.parse(JSON.stringify(logoLibrary)) as Prisma.InputJsonValue,
      cover_page_settings: coverPageSettings != null ? (JSON.parse(JSON.stringify(coverPageSettings)) as Prisma.InputJsonValue) : undefined,
      last_page_settings: lastPageSettings != null ? (JSON.parse(JSON.stringify(lastPageSettings)) as Prisma.InputJsonValue) : undefined,
    };

    const updated = await prisma.workpack_print_settings.upsert({
      where: { organization_id: orgId },
      create: createData,
      update: updateData,
    });
    enqueueKnowledgeCapture({
      organizationId: orgId,
      category: 'PRINT_SETTINGS',
      assetType: 'workpack_print_settings',
      title: 'Workpack Print Settings',
      payload: updated as unknown as Record<string, unknown>,
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error('[POST print-settings]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save print settings' },
      { status: 500 }
    );
  }
}
