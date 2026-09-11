import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest, getUserIdFromRequest } from '@/lib/apiAuth';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { generateWorkpack, AiWorkpackGeneratorError } from '@/services/ai/AiWorkpackGenerator';
import type { AiWorkpackResponse } from '@/lib/ai/workpackSchema';
import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';
import { guardApi } from '@/lib/apiGuard';
import { ItemMatchingService } from '@/services/master-data/ItemMatchingService';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { AuditService } from '@/lib/audit';
import type { Priority } from '@prisma/client';
import { extractRequestMeta } from '@/lib/requestMeta';

import { uploadFile } from '@/lib/storage/storageClient';
import { createActivity } from '@/core/activity/ActivityCreationCommand';

const UPLOAD_DIR = 'workpacks'; // Relative to storage root

/** Form key → WorkpackDocument.document_type */
const UPLOAD_DOCUMENT_TYPE_MAP: Record<string, string> = {
    gadFile: 'GA_DRAWING',
    equipmentDrawingFile: 'EQUIPMENT_DRAWING',
    riggingPlanFile: 'RINGGING_PLAN',
    additionalFiles: 'SUPPORTING_DOCUMENT',
};

const STRUCTURED_DOCUMENT_TYPES: { document_type: string; tab_title: string }[] = [
    { document_type: 'MICRO_SCHEDULE', tab_title: 'Micro Schedule' },
    { document_type: 'WPS_DRAFT', tab_title: 'WPS Draft' },
    { document_type: 'ITP_DRAFT', tab_title: 'ITP Draft' },
    { document_type: 'QAP_DRAFT', tab_title: 'QAP Draft' },
    { document_type: 'SAFETY_PLAN_DRAFT', tab_title: 'Safety Plan Draft' },
];

function mapSeverityToPriority(severity: string): Priority {
    const s = severity?.toLowerCase() || '';
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'medium') return 'medium';
    if (s === 'low') return 'low';
    return 'high';
}

export async function POST(req: NextRequest) {
    try {
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = await getUserIdFromRequest(req);
        const meta = extractRequestMeta(req);

        const formData = await req.formData();
        const uuid = randomUUID();

        const filePaths: string[] = [];
        const uploadedFiles: { formKey: string; relativePath: string; originalName: string; fileSize: number; mimeType: string | null }[] = [];
        const formPayload: Record<string, string> = {};

        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                const buffer = Buffer.from(await value.arrayBuffer());
                const ext = (value.name.split('.').pop() || 'pdf').toLowerCase();
                const filename = `${randomUUID()}.${ext}`;
                
                const { key: storage_path } = await uploadFile(
                    buffer,
                    filename,
                    `${UPLOAD_DIR}/${uuid}`,
                    value.type
                );

                filePaths.push(storage_path);
                uploadedFiles.push({
                    formKey: key,
                    relativePath: storage_path,
                    originalName: value.name || filename,
                    fileSize: buffer.length,
                    mimeType: value.type || null,
                });
            } else {
                formPayload[key] = typeof value === 'string' ? value : String(value);
            }
        }

        const title = formPayload.title?.trim();
        const site_id = formPayload.site_id?.trim();
        const event_id = formPayload.event_id?.trim();
        if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        if (!site_id) return NextResponse.json({ error: 'Site is required' }, { status: 400 });
        if (!event_id) {
            return NextResponse.json(
                { error: 'STO Workpack create requires Event context', code: 'EVENT_REQUIRED' },
                { status: 400 }
            );
        }

        // Ensure site belongs to organization (multi-tenant)
        const site = await prisma.site.findFirst({
            where: { id: site_id, organization_id: orgId },
            select: { id: true },
        });
        if (!site) return NextResponse.json({ error: 'Site not found or access denied' }, { status: 400 });

        const drawingsDescription = filePaths.length > 0
            ? `Uploaded documents: ${filePaths.join(', ')}. Use these as context for scope and technical details.`
            : undefined;

        let aiData: AiWorkpackResponse;
        try {
            aiData = await generateWorkpack({
                organization_id: orgId,
                title,
                scope_of_work: formPayload.scope_of_work?.trim(),
                work_type: formPayload.work_type?.trim(),
                drawings_description: drawingsDescription,
                operational_context: 'Site and discipline from form; prioritize safety and execution sequence.',
            });
        } catch (err) {
            if (err instanceof AiWorkpackGeneratorError) {
                const status = err.code === 'NO_PROVIDER' || err.code === 'NO_API_KEY' ? 400 : 422;
                return NextResponse.json({ error: err.message }, { status });
            }
            throw err;
        }

        const scopeOfWork = aiData.qa_requirements
            ? `${aiData.scope_of_work}\n\nQA requirements: ${aiData.qa_requirements}`
            : aiData.scope_of_work;

        const workpack = await WorkpackService.createWorkpack({
            organization_id: orgId,
            site_id,
            title,
            created_by: userId,
            event_id,
            sap_work_order: formPayload.sap_work_order || undefined,
            sap_notification: formPayload.sap_notification || undefined,
            discipline_id: formPayload.discipline_id || undefined,
            work_type: formPayload.work_type || undefined,
            priority: formPayload.priority || undefined,
            scope_of_work: scopeOfWork,
            planned_start_date: formPayload.planned_start_date ? new Date(formPayload.planned_start_date) : undefined,
            planned_end_date: formPayload.planned_end_date ? new Date(formPayload.planned_end_date) : undefined,
            estimated_manhours: aiData.estimated_total_manhours ?? 0,
            status: 'draft',
        });

        if (aiData.activities.length > 0) {
            for (let i = 0; i < aiData.activities.length; i++) {
                const a = aiData.activities[i];
                const toolsNote = a.tools_required?.length ? `Tools: ${a.tools_required.join(', ')}` : '';
                const safetyNote = a.safety_requirements?.length ? `Safety: ${a.safety_requirements.join(', ')}` : '';
                const noteParts = [toolsNote, safetyNote].filter(Boolean);

                await createActivity(
                    {
                        organizationId: orgId,
                        userId,
                        sourceChannel: 'ai',
                        eventId: workpack.event_id,
                    },
                    {
                        workpackId: workpack.id,
                        description: a.description || a.title,
                        activityId: a.activity_id || `A-${String(i + 1).padStart(3, '0')}`,
                        sequenceNumber: a.sequence ?? (i + 1),
                        discipline: a.discipline || undefined,
                        durationHours: a.estimated_manhours,
                        notes: noteParts.length > 0 ? noteParts.join('\n') : null,
                        siteId: site_id,
                    }
                );
            }
        }

        if (aiData.materials.length > 0) {
            for (const m of aiData.materials) {
                const { item: catalogItem } = await ItemMatchingService.matchOrCreateItem(orgId, {
                    description: m.item,
                    specification: m.specification || null,
                    category: 'consumable' // Default for generic materials
                });

                await prisma.workpack_material_lines.create({
                    data: {
                        organization_id: orgId,
                        workpack_id: workpack.id,
                        source_type: 'ai',
                        description: m.item,
                        specification: m.specification || null,
                        unit_of_measure: m.unit || 'EA',
                        quantity_required: m.quantity,
                        material_category: 'mechanical',
                        item_catalog_id: catalogItem.id
                    }
                });
            }
        }

        if (aiData.constraints.length > 0) {
            await prisma.constraint.createMany({
                data: aiData.constraints.map(c => ({
                    organization_id: orgId,
                    site_id,
                    workpack_id: workpack.id,
                    title: c.description.slice(0, 255) || 'Constraint',
                    description: c.description,
                    priority: mapSeverityToPriority(c.severity ?? 'high'),
                    status: 'open',
                    raised_by: userId,
                })),
            });
        }

        if (aiData.blinds.length > 0) {
            for (let i = 0; i < aiData.blinds.length; i++) {
                const b = aiData.blinds[i];
                const blindNumber = b.tag_no || b.line_number || `BL-${i + 1}`;
                
                const { item: catalogItem } = await ItemMatchingService.matchOrCreateItem(orgId, {
                    description: `Blind: ${b.size ?? ''} ${b.rating ?? ''}`.trim(),
                    size: b.size,
                    rating: b.rating,
                    category: 'blind'
                });

                await prisma.blind.create({
                    data: {
                        organization_id: orgId,
                        site_id,
                        workpack_id: workpack.id,
                        blind_number: blindNumber,
                        location: b.location ?? null,
                        flange_size: b.size ?? null,
                        rating: b.rating ?? null,
                        status: 'pending',
                        created_by: userId,
                        item_catalog_id: catalogItem.id
                    }
                });
            }
        }

        // STEP 1 — Create WorkpackDocument for each uploaded file (organization_id, site_id, workpack_id enforced)
        for (const file of uploadedFiles) {
            const document_type = UPLOAD_DOCUMENT_TYPE_MAP[file.formKey] ?? 'SUPPORTING_DOCUMENT';
            await prisma.workpackDocument.create({
                data: {
                    organization_id: orgId,
                    site_id,
                    workpack_id: workpack.id,
                    document_type,
                    original_filename: file.originalName,
                    storage_path: file.relativePath,
                    mime_type: file.mimeType,
                    file_size_bytes: BigInt(file.fileSize),
                    created_by: userId,
                },
            });
        }

        // STEP 2 — Create DocumentInstance entries for structured drafts (MICRO_SCHEDULE, WPS_DRAFT, ITP_DRAFT, QAP_DRAFT, SAFETY_PLAN_DRAFT)
        for (let i = 0; i < STRUCTURED_DOCUMENT_TYPES.length; i++) {
            const { document_type, tab_title } = STRUCTURED_DOCUMENT_TYPES[i];
            await prisma.documentInstance.create({
                data: {
                    organization_id: orgId,
                    site_id,
                    workpack_id: workpack.id,
                    document_type,
                    tab_title,
                    sequence_number: i + 1,
                    content_json: aiData as object,
                    revision: 'R0',
                    created_by: userId,
                },
            });
        }

        await AuditService.log({
            organization_id: orgId,
            user_id: userId,
            action: 'created',
            model_name: 'Workpack',
            model_id: workpack.id,
            new_values: { source: 'ai-generate', workpack_id: workpack.id },
            site_id: site_id ?? undefined,
            ip_address: meta.ip,
            user_agent: meta.userAgent,
        });

        // Always redirect by UUID. Slug/workpack_number is for display only; DB and routes use id.
        const redirectUrl = `/workpacks/${workpack.id}`;

        return NextResponse.json({
            success: true,
            workpack_id: workpack.id,
            workpack_number: workpack.workpack_number,
            redirect: redirectUrl,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
