import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/workpacks/[id]/materials/auto-fill-gaskets
 * Body: { joint_ids?: string[] }  — optional; if omitted, processes ALL joints in the workpack
 *
 * Strategy A (preferred): If a joint has gasket_item_id / bolt_item_id already set,
 *   create material lines directly from those catalog IDs.
 * Strategy B (fallback): If a joint has flange_size + rating + flange_type,
 *   look up GasketBoltLookup for matching entry.
 *
 * All operations are idempotent — existing (source_type='joint', source_id, item_catalog_id)
 * combinations are skipped.
 *
 * Returns: { created, skipped, no_data, lines }
 */
export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id: workpackId } = await params;
        const orgId = session.user.organization_id;

        await assertTenantAccess('workpack', workpackId, orgId);

        const body = await req.json().catch(() => ({}));
        const jointIdFilter: string[] | undefined =
            Array.isArray(body?.joint_ids) && body.joint_ids.length > 0
                ? body.joint_ids
                : undefined;

        // Fetch relevant joints with gasket/bolt data
        const joints = await prisma.jointIntegrityItem.findMany({
            where: {
                workpack_id: workpackId,
                organization_id: orgId,
                deleted_at: null,
                ...(jointIdFilter ? { id: { in: jointIdFilter } } : {}),
            },
        });

        if (joints.length === 0) {
            return NextResponse.json({
                created: 0, skipped: 0, no_data: 0, lines: [],
                message: 'No joints found to process',
            });
        }

        // Get the workpack site info
        const workpack = await prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId, deleted_at: null },
            select: { site_id: true },
        });
        if (!workpack) return NextResponse.json({ error: 'Workpack not found' }, { status: 404 });

        // Get existing material lines from joints (for dedup)
        const existingLines = await prisma.workpackMaterialLine.findMany({
            where: {
                workpack_id: workpackId,
                source_type: 'joint',
                source_id: { in: joints.map((j) => j.id) },
                deleted_at: null,
            },
            select: { source_id: true, item_catalog_id: true },
        });
        const existingSet = new Set(
            existingLines.map((l) => `${l.source_id}::${l.item_catalog_id ?? 'none'}`)
        );

        let created = 0;
        let skipped = 0;
        let noData = 0;
        const createdLineIds: string[] = [];

        for (const joint of joints) {
            // Build candidate items from the joint's own catalog references
            type CatalogCandidate = {
                item_catalog_id: string | null;
                fallback_description: string;
                qty: number;
                role: string;
            };

            const candidates: CatalogCandidate[] = [];

            if (joint.gasket_item_id) {
                candidates.push({
                    item_catalog_id: joint.gasket_item_id,
                    fallback_description: joint.gasket_material ?? 'Gasket',
                    qty: 1,
                    role: 'gasket',
                });
            }

            if (joint.bolt_item_id) {
                const boltQty = joint.bolt_quantity ?? 4;
                candidates.push({
                    item_catalog_id: joint.bolt_item_id,
                    fallback_description: `Bolt ${joint.bolt_material ?? ''}`.trim(),
                    qty: boltQty,
                    role: 'bolt',
                });
                // Nuts — same catalog item as bolt with 'nut' description if no separate entry
                candidates.push({
                    item_catalog_id: null, // no separate nut catalog id on joint
                    fallback_description: `Nut ${joint.bolt_material ?? ''}`.trim(),
                    qty: boltQty,
                    role: 'nut',
                });
            }

            // Strategy B: GasketBoltLookup fallback when joint has flange_size + rating + flange_type
            if (candidates.length === 0 && joint.flange_size && joint.rating && joint.flange_type) {
                const lookup = await prisma.gasketBoltLookup.findFirst({
                    where: {
                        organization_id: orgId,
                        pipe_size: joint.flange_size,
                        pressure_class: joint.rating,
                        flange_type: joint.flange_type,
                        is_active: true,
                    },
                });
                if (lookup) {
                    if (lookup.gasket_item_id) {
                        candidates.push({ item_catalog_id: lookup.gasket_item_id, fallback_description: lookup.gasket_description ?? 'Gasket', qty: 1, role: 'gasket' });
                    }
                    if (lookup.bolt_item_id) {
                        const boltQty = lookup.bolt_count * 2;
                        candidates.push({ item_catalog_id: lookup.bolt_item_id, fallback_description: lookup.bolt_description ?? 'Bolt', qty: boltQty, role: 'bolt' });
                    }
                    if (lookup.nut_item_id) {
                        candidates.push({ item_catalog_id: lookup.nut_item_id, fallback_description: lookup.nut_description ?? 'Nut', qty: lookup.bolt_count * 2, role: 'nut' });
                    }
                    if (lookup.washer_item_id) {
                        candidates.push({ item_catalog_id: lookup.washer_item_id, fallback_description: lookup.washer_description ?? 'Washer', qty: lookup.bolt_count * 4, role: 'washer' });
                    }
                }
            }

            if (candidates.length === 0) {
                noData++;
                continue;
            }

            for (const cand of candidates) {
                const dedupeKey = `${joint.id}::${cand.item_catalog_id ?? 'none'}`;

                // For null catalog items (e.g. nut with no catalog ID), use role as dedup suffix
                const dedupeFull = cand.item_catalog_id
                    ? dedupeKey
                    : `${joint.id}::${cand.role}`;

                if (existingSet.has(dedupeFull)) { skipped++; continue; }

                let description = cand.fallback_description;
                let itemCode: string | null = null;
                let sapNumber: string | null = null;

                if (cand.item_catalog_id) {
                    const catalog = await prisma.itemCatalog.findUnique({
                        where: { id: cand.item_catalog_id },
                        select: { description: true, item_code: true, sap_material_number: true },
                    });
                    if (catalog) {
                        description = catalog.description;
                        itemCode = catalog.item_code;
                        sapNumber = catalog.sap_material_number ?? null;
                    }
                }

                const line = await prisma.workpackMaterialLine.create({
                    data: {
                        organization_id: orgId,
                        workpack_id: workpackId,
                        source_type: 'joint',
                        source_id: joint.id,
                        linked_to: `Joint ${joint.joint_number}`,
                        item_catalog_id: cand.item_catalog_id,
                        item_code: itemCode,
                        sap_material_number: sapNumber,
                        description,
                        unit_of_measure: 'EA',
                        material_category: 'mechanical',
                        quantity_required: cand.qty,
                        procurement_status: 'not_requested',
                        is_critical: false,
                    },
                    select: { id: true },
                });

                createdLineIds.push(line.id);
                existingSet.add(dedupeFull);
                created++;
            }
        }

        return NextResponse.json({
            created,
            skipped,
            no_data: noData,
            lines: createdLineIds,
            message: `Created ${created} material line(s). ${skipped} duplicate(s) skipped. ${noData} joint(s) had no gasket/bolt data.`,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Auto-fill failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
});
