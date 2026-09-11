import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { WorkpackService } from './WorkpackService';
import { WorkpackAssetSnapshotService } from '@/core/asset-register';

export class WorkpackVersionService {
    /**
     * Captures a full state snapshot of a workpack (immutable JSON).
     * Section 9: Saved as JSON to workpack_versions table.
     * M8.6: Also creates a WorkpackAssetSnapshot if the workpack has an asset.
     */
    static async autoSnapshot(workpackId: string, organizationId: string, createdBy: string, changeSummary?: string) {
        const wp = await WorkpackService.getWorkpack(workpackId, organizationId);
        if (!wp) throw new Error('Workpack not found for snapshot');

        const latestVersion = await prisma.workpackVersion.findFirst({
            where: { workpack_id: workpackId },
            orderBy: { created_at: 'desc' },
        });

        const versionNum = latestVersion
            ? parseInt(latestVersion.revision.replace('R', '')) + 1
            : 0;

        const revision = `R${versionNum}`;

        const created = await prisma.workpackVersion.create({
            data: {
                id: crypto.randomUUID(),
                organization_id: wp.organization_id,
                workpack_id: workpackId,
                revision,
                status_at_snapshot: wp.status,
                snapshot_json: wp as any,
                change_summary: changeSummary ?? 'Manual snapshot',
                created_by: createdBy,
            },
        });

        // M8.6: Capture Asset Register snapshot if workpack has a primary asset
        if (wp.asset_id) {
            try {
                await WorkpackAssetSnapshotService.createSnapshot({
                    workpack_id: workpackId,
                    asset_id: wp.asset_id,
                    snapshot_revision: revision,
                    snapshotted_by: createdBy,
                });
            } catch (snapErr: any) {
                // Snapshot failure should not break version creation
                console.error('[WorkpackVersionService] Asset snapshot failed (non-fatal):', snapErr.message);
            }
        }

        await AuditService.log({
            organization_id: wp.organization_id,
            user_id: createdBy,
            model_name: 'WorkpackVersion',
            model_id: created.id,
            action: 'created',
            new_values: created,
        });

        return created;
    }
}
