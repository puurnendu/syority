import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

async function importParameterToField(
    fieldPath: string,
    value: string,
    workpackId: string,
    orgId: string,
    userId: string
): Promise<void> {
    const parts = fieldPath.split('.');
    const section = parts[0];
    const subType = parts[1];
    const fieldKey = parts[2];

    if (section === 'certificates' && subType && fieldKey) {
        const cert = await prisma.certificateInstance.findFirst({
            where: {
                workpack_id: workpackId,
                cert_type: subType,
                deleted_at: null,
            },
        });
        if (!cert) return;

        const fieldValues = (cert.field_values as Record<string, unknown>) ?? {};
        await prisma.certificateInstance.update({
            where: { id: cert.id },
            data: {
                field_values: { ...fieldValues, [fieldKey]: value } as object,
            },
        });
        return;
    }

    if (section === 'cleaning_instructions' && fieldKey) {
        const existing = await prisma.cleaningRecord.findFirst({
            where: {
                workpack_id: workpackId,
                deleted_at: null,
            },
            orderBy: { created_at: 'asc' },
        });

        if (existing) {
            const updates: Record<string, unknown> = {};
            if (fieldKey === 'cleaning_method') updates.cleaning_medium = value;
            else if (fieldKey === 'acceptance_criteria')
                updates.before_condition = value;
            else if (fieldKey === 'cleaning_standard')
                updates.notes = (existing.notes ?? '') + `\nStandard: ${value}`;
            else if (fieldKey === 'flush_duration_mins') {
                const mins = parseFloat(value);
                if (!isNaN(mins))
                    updates.duration_hours = mins / 60;
            } else {
                updates.notes =
                    (existing.notes ?? '') + `\n${fieldKey}: ${value}`;
            }
            if (Object.keys(updates).length > 0) {
                await prisma.cleaningRecord.update({
                    where: { id: existing.id },
                    data: updates as Record<string, string | number | null>,
                });
            }
        } else {
            const wp = await prisma.workpack.findFirst({
                where: { id: workpackId },
                select: { site_id: true },
            });
            await prisma.cleaningRecord.create({
                data: {
                    organization_id: orgId,
                    site_id: wp?.site_id ?? null,
                    workpack_id: workpackId,
                    created_by: userId,
                    cleaning_method: 'chemical_flush',
                    cleaning_medium:
                        fieldKey === 'cleaning_method' ? value : null,
                    notes:
                        fieldKey !== 'cleaning_method'
                            ? `${fieldKey}: ${value}`
                            : null,
                },
            });
        }
        return;
    }

    if (section === 'preparation' && fieldKey) {
        const checklist = await prisma.droppingBoxupChecklist.findFirst({
            where: {
                workpack_id: workpackId,
                checklist_type: 'dropping',
            },
        });
        if (!checklist) return;

        const labelMap: Record<string, string> = {
            special_tools: 'Special Tools Required',
            bundle_weight_kg: 'Bundle Weight',
            crane_capacity_t: 'Crane Capacity Required',
            critical_clearances: 'Critical Clearances',
        };

        const count = await prisma.droppingBoxupChecklistItem.count({
            where: { checklist_id: checklist.id },
        });

        await prisma.droppingBoxupChecklistItem.create({
            data: {
                organization_id: orgId,
                checklist_id: checklist.id,
                sequence_number: count + 1,
                description: `${labelMap[fieldKey] ?? fieldKey}: ${value}`,
                notes: 'Extracted from OEM manual by AI',
            },
        });
        return;
    }
}

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string; jobId: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id, jobId } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body?.accepted_keys?.length) {
        return NextResponse.json(
            { error: 'accepted_keys required' },
            { status: 400 }
        );
    }

    const job = await prisma.aiExtractionJob.findFirst({
        where: {
            id: jobId,
            workpack_id: id,
            organization_id: orgId,
        },
        include: { result: true },
    });
    if (!job?.result)
        return NextResponse.json(
            { error: 'Job result not found' },
            { status: 404 }
        );

    const extracted = (
        job.result.extracted_data_json as {
            parameters?: Array<{
                key: string;
                value: string | number | null;
                field_path: string;
            }>;
        }
    ).parameters ?? [];

    const accepted = extracted.filter(
        (p) => body.accepted_keys.includes(p.key) && p.value !== null
    );

    const overrides: Record<string, string> = body.overrides ?? {};

    let imported = 0;

    for (const param of accepted) {
        const finalValue =
            overrides[param.key] ?? String(param.value);

        try {
            await importParameterToField(
                param.field_path,
                finalValue,
                id,
                orgId,
                session!.user.id
            );
            imported++;
        } catch (e: unknown) {
            console.error(
                '[Extract Accept] Failed to import',
                param.key,
                e instanceof Error ? e.message : e
            );
        }
    }

    await prisma.aiExtractionResult.update({
        where: { ai_extraction_job_id: jobId },
        data: {
            planner_review_json: {
                accepted_keys: body.accepted_keys,
                overrides,
                reviewed_at: new Date().toISOString(),
                reviewed_by: session!.user.id,
                imported,
            } as object,
            review_status: 'approved',
            reviewed_by: session!.user.id,
            reviewed_at: new Date(),
        },
    });

    return NextResponse.json({
        imported,
        total: accepted.length,
    });
}
