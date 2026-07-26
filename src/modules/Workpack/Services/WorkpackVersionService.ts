import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { WorkpackService } from './WorkpackService';

export class WorkpackVersionService {
    /**
     * Captures a full state snapshot of a workpack (immutable JSON).
     * Section 9: Saved as JSON to workpack_versions table.
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

        const created = await prisma.workpackVersion.create({
            data: {
                organization_id: wp.organization_id,
                workpack_id: workpackId,
                revision: `R${versionNum}`,
                status_at_snapshot: wp.status,
                snapshot_json: wp as any,
                change_summary: changeSummary ?? 'Manual snapshot',
                created_by: createdBy,
            },
        });

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
