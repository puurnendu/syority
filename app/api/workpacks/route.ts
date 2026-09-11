import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { guardApi } from '@/lib/apiGuard';
import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateWorkpackIdCode } from '@/lib/workpackId';
import { autoAttachCertificates } from '@/lib/certificates/autoAttach';
import { triggerAiAutoFill } from '@/lib/ai/workpackAutoFill';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { isWorkpackIdentityError } from '@/modules/Workpack/WorkpackIdentityError';

export const GET = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('workpacks.view');
        if (error) return error;
        
        const orgId = session.user.organization_id;
        const { searchParams } = new URL(req.url);
        
        const workpacks = await WorkpackService.getWorkpacks(orgId, {
            site_id: searchParams.get('site_id') ?? undefined,
            system_id: searchParams.get('system_id') ?? undefined,
            event_id: searchParams.get('event_id') ?? undefined,
            status: searchParams.get('status') as any ?? undefined,
            search: searchParams.get('search') ?? undefined,
        });
        return NextResponse.json({ data: workpacks });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { error } = await guardApi('workpacks.create');
        if (error) return error;
        const user = session.user as { id: string; organization_id: string };
        const body = await req.json();

        const unit_code = body.unit_code?.trim() ?? null;
        const primary_discipline = body.primary_discipline?.trim() ?? null;
        const portfolio_id = body.portfolio_id ?? null;
        const project_id = body.project_id ?? null;

        const { sap_work_order: _sapWo, ...restBody } = body;
        
        // Auto-resolve site_id if missing (essential for inline schedule creation)
        const siteId = body.site_id || (session.user as any).site_id;
        
        if (!siteId) {
            // Last resort: find the first available site in this organization
            const firstSite = await prisma.site.findFirst({
                where: { organization_id: user.organization_id, is_active: true },
                select: { id: true }
            });
            if (firstSite) (restBody as any).site_id = firstSite.id;
        } else {
            (restBody as any).site_id = siteId;
        }

        // ── Resolve or Generate Workpack ID Code ──────────────────
        let workpack_id_code = body.workpack_id_code?.trim() || null;
        if (!workpack_id_code) {
            try {
                workpack_id_code = await generateWorkpackIdCode(
                    user.organization_id,
                    unit_code || 'GEN',
                    primary_discipline || 'GEN'
                );
            } catch (idErr: unknown) {
                const msg = idErr instanceof Error ? idErr.message : String(idErr);
                console.error('[WorkpackID] Generation failed:', msg);
            }
        }

        // M8.14-R1: Validate asset exists in this org AND is active
        if (restBody.asset_id) {
            const asset = await prisma.asset.findFirst({
                where: { id: restBody.asset_id, organization_id: user.organization_id },
                select: { id: true, status: true, tag_number: true },
            });
            if (!asset) {
                return NextResponse.json(
                    { error: 'Asset not found or does not belong to your organization' },
                    { status: 403 },
                );
            }
            if (asset.status !== 'active') {
                return NextResponse.json(
                    { error: `Asset "${asset.tag_number}" is in ${asset.status} status — only active assets can be assigned to workpacks` },
                    { status: 400 },
                );
            }
        }

        let workpack = await WorkpackService.createWorkpack({
            ...restBody,
            organization_id: user.organization_id,
            created_by: user.id,
            unit_code: unit_code ?? undefined,
            portfolio_id: portfolio_id ?? undefined,
            project_id: project_id ?? undefined,
            workpack_id_code,
        });

        if (body.equipment_type) {
            await autoAttachCertificates(workpack.id, user.organization_id, body.equipment_type).catch((e) =>
                console.error('[Certs] Auto-attach failed:', (e as Error).message)
            );
        }

        // ── Hierarchy fields + scope from asset register ────────────────────
        const hierarchyUpdate: { event_id?: string | null; plant_id?: string | null; system_id?: string | null } = {};
        if (body.event_id !== undefined) hierarchyUpdate.event_id = body.event_id ?? null;
        if (body.plant_id !== undefined) hierarchyUpdate.plant_id = body.plant_id ?? null;
        if (body.system_id !== undefined) hierarchyUpdate.system_id = body.system_id ?? null;
        if (Object.keys(hierarchyUpdate).length > 0) {
            await prisma.workpack.update({
                where: { id: workpack.id },
                data: hierarchyUpdate,
            });
            workpack = { ...workpack, ...hierarchyUpdate };
        }

        if (Array.isArray(body.selected_joint_master_ids) && body.selected_joint_master_ids.length > 0) {
            const masterIds = body.selected_joint_master_ids as string[];
            const masters = await prisma.joint_masters.findMany({
                where: { id: { in: masterIds }, organization_id: user.organization_id },
                include: { nozzle: true, line: true },
            });
            if (masters.length > 0 && workpack.site_id) {
                await prisma.jointIntegrityItem.createMany({
                    data: masters.map((jm) => ({
                        organization_id: user.organization_id,
                        site_id: workpack.site_id,
                        workpack_id: workpack.id,
                        joint_number: jm.joint_number,
                        joint_master_id: jm.id,
                        line_number: jm.line?.line_number ?? null,
                        tag_id: jm.asset_id ?? null,
                        pipeline_number: jm.line?.line_number ?? null,
                        specification: jm.default_gasket_type ?? null,
                        rating: jm.pressure_rating ?? null,
                        flange_size: jm.nominal_size_inches != null ? `${jm.nominal_size_inches}"` : null,
                        gasket_material: jm.default_gasket_material ?? null,
                        bolt_material: jm.default_bolt_spec ?? null,
                        bolt_quantity: jm.default_bolt_count ?? null,
                        torque_tightening_value: jm.default_torque_nm != null ? new Prisma.Decimal(jm.default_torque_nm) : null,
                        status: 'pending',
                        created_by: user.id,
                    })),
                });
            }
        }

        // Background AI auto-fill for empty tabs (fire-and-forget)
        triggerAiAutoFill(workpack.id, {
            joints: true,
            materials: true,
            tools: true,
            constraints: true,
        }).catch((err) => console.error('[AutoFill]', err));

        return NextResponse.json({ data: workpack }, { status: 201 });
    } catch (error: any) {
        if (isWorkpackIdentityError(error)) {
            return NextResponse.json(
                { error: error.message, code: error.identityCode },
                { status: error.statusCode }
            );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
});
