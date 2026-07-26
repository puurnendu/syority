import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import { convertPdfBase64ToPageImages } from '@/services/ai/PdfProcessor';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { readFileSync } from 'fs';
import { resolveDocumentPath } from '@/lib/ai/documentResolver';

import {
    BLIND_EXTRACTION_PROMPT,
    BLIND_TEXT_PROMPT,
    getStandardBlindsForType,
    type ExtractedBlind,
} from '@/lib/ai/blindExtraction';
import type { BlindType } from '@prisma/client';
import { ItemMatchingService } from '@/services/master-data/ItemMatchingService';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const MAX_PDF_PAGES = parseInt(process.env.MAX_PDF_PAGES ?? '5', 10);

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id: workpackId } = await params;
        const orgId = session.user?.organization_id;
        const userId = session.user?.id;

        const wp = await prisma.workpack.findUnique({
            where: { id: workpackId, organization_id: orgId },
            include: {
                documents: { where: { deleted_at: null } },
                asset: { select: { tag_number: true, name: true } }
            }
        });
        
        if (!wp || !orgId) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });
        await assertTenantAccess('workpack', workpackId, orgId);

        const body = await req.json().catch(() => ({}));
        const autoSave = body.autoSave === true;
        const replaceExisting = body.replaceExisting === true || body.regenerate === true;
        const fileBase64 = body.fileBase64 as string | undefined;
        const fileType = body.fileType as string | undefined;
        const equipmentTag = (body.equipmentTag as string)?.trim() || wp?.asset?.tag_number || '';
        const equipmentType = (body.equipmentType as string)?.trim() || 'Heat Exchanger';
        const equipmentSpec = (body.equipmentSpec as string)?.trim() || '';

        // --- DOCUMENT RESOLUTION ---
        let effectiveFileBase64 = fileBase64;
        let effectiveFileType = fileType;

        if (!effectiveFileBase64 && wp?.documents && wp.documents.length > 0) {
            for (const doc of wp.documents) {
                const resolvedPath = resolveDocumentPath(doc.storage_path);
                if (resolvedPath) {
                    console.log(`[BlindGen] DOCUMENT FOUND: ${doc.original_filename}`);
                    const buffer = readFileSync(resolvedPath);
                    effectiveFileBase64 = buffer.toString('base64');
                    effectiveFileType = doc.original_filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
                    break; 
                }
            }
        }

        function normaliseToExtractedBlind(raw: Record<string, unknown>): ExtractedBlind {
            let bType: BlindType = 'spectacle';
            const rawType = String(raw.blind_type ?? raw.type ?? '').toLowerCase();
            if (rawType.includes('paddle') || rawType.includes('spade')) bType = 'paddle';
            else if (rawType.includes('figure') || rawType.includes('8')) bType = 'figure_8';
            else if (rawType.includes('flange')) bType = 'blind_flange';
            else if (rawType.includes('blank')) bType = 'blanking_disc';

            return {
                blind_number: String(raw.blind_number ?? raw.blind_no ?? raw.tag ?? '').trim(),
                blind_type: bType,
                pipeline_number: (raw.pipeline_number ?? raw.line_number ?? raw.line_no) as string | null,
                location: (raw.location ?? raw.description) as string | null,
                flange_size: (raw.flange_size ?? raw.size) as string | null,
                rating: (raw.rating ?? raw.class) as string | null,
                status: 'pending',
                notes: raw.notes as string | undefined
            };
        }

        let finalExtractedBlinds: ExtractedBlind[] = [];
        let finalExtractionSource: 'text' | 'vision' | 'static' = 'static';

        // TIER 1: Vision
        if (effectiveFileBase64) {
            try {
                console.log(`[BlindGen] TIER 1: PDF Vision Analysis`);
                const pageImages = await convertPdfBase64ToPageImages(effectiveFileBase64, { maxPages: MAX_PDF_PAGES, scale: 3.0 });
                const aiResponse = await callVisionAI({
                    orgId,
                    workpackId,
                    userPrompt: BLIND_EXTRACTION_PROMPT(equipmentTag, equipmentType),
                    images: pageImages,
                    context: { equipmentTag, equipmentType }
                });
                const parsed = parseVisionJson<Record<string, unknown>[]>(aiResponse, { expected: 'array' });
                finalExtractedBlinds = parsed.map(item => normaliseToExtractedBlind(item));
                if (finalExtractedBlinds.length > 0) finalExtractionSource = 'vision';
            } catch (err) {
                console.error('[BlindGen] TIER 1 failed:', err);
            }
        }

        // TIER 2: Text Fallback
        if (finalExtractedBlinds.length === 0) {
            const textParts: string[] = [];
            for (const doc of wp.documents) {
                const resolvedPath = resolveDocumentPath(doc.storage_path);
                if (resolvedPath) {
                    const text = await extractPdfText(resolvedPath);
                    textParts.push(text);
                }
            }
            const combinedText = textParts.join('\n\n');
            if (combinedText) {
                try {
                    console.log('[BlindGen] TIER 2: Text-based Analysis');
                    const aiResponse = await callVisionAI({
                        orgId,
                        workpackId,
                        userPrompt: BLIND_TEXT_PROMPT(equipmentTag, equipmentType, combinedText),
                        context: { equipmentTag, equipmentType }
                    });
                    const parsed = parseVisionJson<Record<string, unknown>[]>(aiResponse, { expected: 'array' });
                    finalExtractedBlinds = parsed.map(item => normaliseToExtractedBlind(item));
                    if (finalExtractedBlinds.length > 0) finalExtractionSource = 'text';
                } catch (err) {
                    console.error('[BlindGen] TIER 2 failed:', err);
                }
            }
        }

        // TIER 3: Static
        if (finalExtractedBlinds.length === 0) {
            console.log(`[BlindGen] TIER 3: Static Fallback`);
            finalExtractedBlinds = getStandardBlindsForType(equipmentType, equipmentTag);
            finalExtractionSource = 'static';
        }

        console.log(`[BlindGen] Extraction Results (Source: \${finalExtractionSource}):`, finalExtractedBlinds.length, 'blinds found');

        if (autoSave && finalExtractedBlinds.length > 0 && wp.site_id) {
            if (replaceExisting) {
                await prisma.blind.deleteMany({
                    where: { workpack_id: workpackId, organization_id: orgId }
                });
            }

            const existing = await prisma.blind.findMany({
                where: { workpack_id: workpackId, organization_id: orgId },
                select: { blind_number: true }
            });
            const existingSet = new Set(existing.map(b => b.blind_number));
            let createdCount = 0;

            for (const b of finalExtractedBlinds) {
                if (!b.blind_number || existingSet.has(b.blind_number)) continue;

                // Match with Master Consumable List
                const { item: catalogItem } = await ItemMatchingService.matchOrCreateItem(orgId, {
                    description: `Blind: ${b.blind_type} ${b.flange_size ?? ''} ${b.rating ?? ''}`.trim(),
                    size: b.flange_size,
                    rating: b.rating,
                    category: 'blind'
                });

                await prisma.blind.create({
                    data: {
                        organization_id: orgId,
                        site_id: wp.site_id,
                        workpack_id: workpackId,
                        blind_number: b.blind_number,
                        blind_type: b.blind_type,
                        pipeline_number: b.pipeline_number,
                        location: b.location,
                        flange_size: b.flange_size,
                        rating: b.rating,
                        status: 'pending',
                        notes: b.notes,
                        created_by: userId,
                        item_catalog_id: catalogItem.id
                    }
                });
                createdCount++;
                existingSet.add(b.blind_number);
            }
            return NextResponse.json({ blinds: finalExtractedBlinds, created: createdCount, count: createdCount, source: finalExtractionSource });
        }

        return NextResponse.json({ blinds: finalExtractedBlinds, count: finalExtractedBlinds.length, source: finalExtractionSource });
    } catch (error: any) {
        console.error('[BlindGen] Unhandled error:', error);
        return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
    }
});
