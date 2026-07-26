import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callVisionAI, parseVisionJson } from '@/services/ai/VisionAiService';
import { extractPdfText } from '@/lib/ai/aiHelpers';
import { convertPdfBase64ToPageImages } from '@/services/ai/PdfProcessor';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

export const runtime = 'nodejs';
// Allow up to 120s for large PDFs (rendering + AI call)
export const maxDuration = 120;
// Raise body size limit for this route: PDF base64 can be 10-15 MB
export const dynamic = 'force-dynamic';

import {
    JOINT_EXTRACTION_PROMPT,
    JOINT_TEXT_PROMPT,
    getStandardJointsForType,
    type ExtractedJoint,
} from '@/lib/ai/jointExtraction';
import type { TighteningMethod, JointStatus } from '@prisma/client';

import { resolveDocumentPath } from '@/lib/ai/documentResolver';
import { ItemMatchingService } from '@/services/master-data/ItemMatchingService';

/** Max PDF pages to render for Vision AI (configurable via env). */
const MAX_PDF_PAGES = parseInt(process.env.MAX_PDF_PAGES ?? '5', 10);

function mapTighteningMethod(s: string | null | undefined): TighteningMethod | undefined {
    if (!s) return undefined;
    const v = s.toLowerCase();
    if (v.includes('tension')) return 'tensioning';
    if (v.includes('hand') || v.includes('manual')) return 'manual';
    return 'torque';
}

function mapStatus(s: string | null | undefined): JointStatus {
    if (!s) return 'pending';
    const v = s.toLowerCase();
    if (v === 'assembled' || v === 'closed') return 'assembled';
    if (v === 'inspected' || v === 'tested') return 'inspected';
    if (v === 'signed_off') return 'signed_off';
    if (v === 'dismantled') return 'dismantled';
    return 'pending';
}

function deriveTypeFromRating(ratingStr: string): string {
    if (!ratingStr?.trim()) return 'Raised Face';
    const lower = ratingStr.toLowerCase();
    if (lower.includes('2500') || lower.includes('1500') || lower.includes('900')) {
        return 'Ring Type Joint';
    }
    if (lower.includes('150') || lower.includes('300') || lower.includes('600')) {
        return 'Raised Face';
    }
    return 'Raised Face';
}

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
        
        if (!wp) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });
        await assertTenantAccess('workpack', workpackId, orgId);

        const body = await req.json().catch(() => ({}));
        const autoSave = body.autoSave === true;
        const replaceExisting = body.replaceExisting === true || body.regenerate === true;
        const fileBase64 = body.fileBase64 as string | undefined;
        const fileType = body.fileType as string | undefined;
        const equipmentTag = (body.equipmentTag as string)?.trim() || wp?.asset?.tag_number || '';
        const equipmentType = (body.equipmentType as string)?.trim() || 'Heat Exchanger';
        const equipmentSpec = (body.equipmentSpec as string)?.trim() || '';

        // Aggregate text from documents for Tier 2 fallback
        const textParts: string[] = [];
        if (wp?.documents) {
            for (const doc of wp.documents) {
                const resolvedPath = resolveDocumentPath(doc.storage_path);
                if (resolvedPath) {
                    const text = await extractPdfText(resolvedPath);
                    textParts.push(`\n=== DOCUMENT: ${doc.original_filename} ===\n${text.substring(0, 15000)}`);
                }
            }
        }
        const documentText = textParts.join('\n\n');
        const effectiveSpec = equipmentSpec || documentText || '';

        // --- DOCUMENT RESOLUTION ---
        let effectiveFileBase64 = fileBase64;
        let effectiveFileType = fileType;

        if (!effectiveFileBase64 && wp?.documents && wp.documents.length > 0) {
            console.log(`[JointGen] Investigating ${wp.documents.length} attached documents...`);
            for (const doc of wp.documents) {
                const resolvedPath = resolveDocumentPath(doc.storage_path);
                
                if (resolvedPath) {
                    console.log(`[JointGen] DOCUMENT FOUND: ${doc.original_filename}`);
                    const buffer = readFileSync(resolvedPath);
                    effectiveFileBase64 = buffer.toString('base64');
                    effectiveFileType = doc.original_filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
                    break; 
                }
            }
        }

        function normaliseToExtractedJoint(raw: Record<string, unknown>): ExtractedJoint {
            return {
                jointNo: (String((raw.joint_number ?? raw.jointNo ?? raw.joint_no ?? raw.joint_tag) ?? '').trim() || undefined) ?? '',
                lineNumber: (raw.line_number ?? raw.lineNumber ?? raw.line_no ?? raw.pipeline_number ?? raw.pipeline) as string | null | undefined,
                size: (raw.flange_size ?? raw.size ?? raw.nominal_size ?? raw.nb ?? raw.bore_size) as string | null | undefined,
                pipeSpec: (raw.specification ?? raw.pipe_spec ?? raw.pipeSpec ?? raw.spec ?? raw.spec_ref) as string | null | undefined,
                flangeRating: (raw.flange_rating ?? raw.flangeRating ?? raw.rating ?? raw.class ?? raw.pressure_class) as string | null | undefined,
                flangeType: (raw.flange_type ?? raw.flangeType ?? raw.type ?? raw.facing ?? raw.face_type) as string | null | undefined,
                location: (raw.location ?? raw.description ?? raw.service) as string | null | undefined,
                gasketType: (raw.gasket_type ?? raw.gasketType) as string | null | undefined,
                gasketMaterial: raw.gasketMaterial as string | null | undefined,
                boltSpec: raw.boltSpec as string | null | undefined,
                tighteningMethod: (raw.tightening_method ?? raw.tighteningMethod ?? raw.tightening) as string | null | undefined,
                torqueValue: typeof (raw.torque_value ?? raw.torqueValue) === 'number' ? (raw.torque_value ?? raw.torqueValue) as number : parseFloat(String(raw.torque_value ?? raw.torqueValue ?? 'NaN')) || undefined,
                status: (raw.status as string) || 'pending',
            };
        }

        if (!orgId) return NextResponse.json({ error: 'Unauthorized: Missing organization ID' }, { status: 401 });

        let finalExtractedJoints: ExtractedJoint[] = [];
        let finalExtractionSource: 'text' | 'vision' | 'static' = 'static';

        // --- TIERED EXTRACTION PIPELINE ---
        
        // TIER 1: Vision-based Extraction (PDF or Image)
        if (effectiveFileBase64) {
            try {
                if (effectiveFileType === 'pdf') {
                    console.log(`[JointGen] TIER 1: PDF Vision Analysis`);
                    const pageImages = await convertPdfBase64ToPageImages(effectiveFileBase64, {
                        maxPages: MAX_PDF_PAGES,
                        scale: 3.0,
                    });
                    
                    const aiResponse = await callVisionAI({
                        orgId,
                        workpackId,
                        userPrompt: JOINT_EXTRACTION_PROMPT(equipmentTag, equipmentType),
                        images: pageImages,
                        context: { equipmentTag, equipmentType },
                    });
                    
                    const parsed = parseVisionJson<Record<string, unknown>[]>(aiResponse, { expected: 'array' });
                    finalExtractedJoints = parsed.map((item) => normaliseToExtractedJoint(item));
                    if (finalExtractedJoints.length > 0) finalExtractionSource = 'vision';
                } else {
                    console.log('[JointGen] TIER 1: Image Vision Analysis');
                    const base64Data = effectiveFileBase64.replace(/^data:image\/\w+;base64,/, '');
                    const aiResponse = await callVisionAI({
                        orgId,
                        workpackId,
                        userPrompt: JOINT_EXTRACTION_PROMPT(equipmentTag, equipmentType),
                        images: [{ base64: base64Data, mimeType: 'image/png' }],
                        context: { equipmentTag, equipmentType }
                    });
                    const parsed = parseVisionJson<Record<string, unknown>[]>(aiResponse, { expected: 'array' });
                    finalExtractedJoints = parsed.map((item) => normaliseToExtractedJoint(item));
                    if (finalExtractedJoints.length > 0) finalExtractionSource = 'vision';
                }
            } catch (err) {
                console.error('[JointGen] TIER 1 (Vision) failed:', err);
            }
        }

        // TIER 2: Text-based Extraction (if Vision failed or was not possible)
        if (finalExtractedJoints.length === 0 && effectiveSpec) {
            try {
                console.log('[JointGen] TIER 2: Text-based Analysis');
                const aiResponse = await callVisionAI({
                    orgId,
                    workpackId,
                    userPrompt: JOINT_TEXT_PROMPT(equipmentTag, equipmentType, effectiveSpec),
                    context: { equipmentTag, equipmentType }
                });
                const parsed = parseVisionJson<Record<string, unknown>[]>(aiResponse, { expected: 'array' });
                finalExtractedJoints = parsed.map((item) => normaliseToExtractedJoint(item));
                if (finalExtractedJoints.length > 0) finalExtractionSource = 'text';
            } catch (err) {
                console.error('[JointGen] TIER 2 (Text) failed:', err);
            }
        }

        // TIER 3: Static Engineering Fallback
        if (finalExtractedJoints.length === 0) {
            console.log(`[JointGen] TIER 3: Static Fallback for ${equipmentTag}`);
            finalExtractedJoints = getStandardJointsForType(equipmentType, equipmentTag);
            finalExtractionSource = 'static';
        }

        // --- PERSISTENCE & LOGGING ---

        if (finalExtractedJoints.length > 0) {
            const first = finalExtractedJoints[0];
            console.log(`[JointGen] Extraction Results (Source: ${finalExtractionSource}):`, {
                joint_number: first.jointNo,
                line_number: first.lineNumber ?? null,
                flange_size: first.size ?? null,
                specification: first.pipeSpec ?? null,
            });
        }

        if (autoSave && finalExtractedJoints.length > 0 && wp?.site_id) {
            // Replace mode
            if (replaceExisting) {
                await prisma.jointIntegrityItem.deleteMany({
                    where: {
                        workpack_id: workpackId,
                        organization_id: orgId,
                        ai_generated: true,
                        deleted_at: null,
                    },
                });
            }

            const existing = await prisma.jointIntegrityItem.findMany({
                where: { workpack_id: workpackId, organization_id: orgId, deleted_at: null },
                select: { joint_number: true },
            });
            const existingSet = new Set(existing.map((j) => j.joint_number));
            let createdCount = 0;
            
            const getDerivedType = (j: ExtractedJoint) =>
                j.flangeType?.trim() || j.gasketType?.trim() || deriveTypeFromRating([j.flangeRating, j.pipeSpec].filter(Boolean).join(' ') || '');
            
            for (const j of finalExtractedJoints) {
                const jointNo = (j.jointNo ?? '').trim();
                // Ensure joint number is not empty and not a duplicate
                if (!jointNo || existingSet.has(jointNo)) continue;
                
                // Match Gasket and Bolts with Master Consumable List
                const { item: gasketItem } = await ItemMatchingService.matchOrCreateItem(orgId, {
                    description: `Gasket: ${j.gasketMaterial ?? 'Spiral Wound'} ${j.size ?? ''} ${j.flangeRating ?? ''}`.trim(),
                    size: j.size,
                    rating: j.flangeRating,
                    category: 'gasket'
                });

                const { item: boltItem } = await ItemMatchingService.matchOrCreateItem(orgId, {
                    description: `Bolt: ${j.boltSpec ?? 'A193 B7'} ${j.size ?? ''}`.trim(),
                    size: j.size,
                    category: 'bolt'
                });

                await prisma.jointIntegrityItem.create({
                    data: {
                        workpack_id: workpackId,
                        organization_id: orgId,
                        site_id: wp.site_id,
                        joint_number: jointNo,
                        line_number: j.lineNumber ?? null,
                        specification: j.pipeSpec ?? null,
                        rating: j.flangeRating ?? null,
                        flange_size: j.size ?? null,
                        location: j.location ?? null,
                        flange_type: getDerivedType(j),
                        gasket_material: j.gasketMaterial ?? null,
                        bolt_reference_standard: j.boltSpec ?? null,
                        tightening_method: mapTighteningMethod(j.tighteningMethod),
                        torque_tightening_value: j.torqueValue != null && !isNaN(j.torqueValue) ? j.torqueValue : undefined,
                        status: mapStatus(j.status),
                        ai_generated: true,
                        created_by: userId || undefined,
                        updated_by: userId || undefined,
                        gasket_item_id: gasketItem.id,
                        bolt_item_id: boltItem.id
                    },
                });
                createdCount++;
                existingSet.add(jointNo);
            }
            return NextResponse.json({ joints: finalExtractedJoints, created: createdCount, count: createdCount, source: finalExtractionSource });
        }

        return NextResponse.json({ joints: finalExtractedJoints, count: finalExtractedJoints.length, source: finalExtractionSource });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[JointGen] Unhandled error:', msg, error);
        // Surface the real error for debugging; still safe since it's a server-side log
        const isKnownSafe = msg.startsWith('[PDF]') || msg.startsWith('AI ') || msg.includes('configuration');
        return NextResponse.json(
            { error: isKnownSafe ? msg : 'AI extraction service is temporarily unavailable. Please try again.' },
            { status: 400 }
        );
    }
});
