import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';
import { WorkpackVersionService } from './WorkpackVersionService';
import type { WorkpackStatus } from '@prisma/client';

class WorkflowError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WorkflowError';
    }
}

const VALID_TRANSITIONS: Record<WorkpackStatus, WorkpackStatus[]> = {
    pending_ai_review: ['draft', 'cancelled'],
    draft: ['under_review', 'cancelled'],
    under_review: ['approved', 'draft'],
    approved: ['issued', 'draft'],
    issued: ['closed', 'cancelled'],
    closed: [],
    cancelled: [],
};

export class WorkflowService {
    static canTransition(from: WorkpackStatus, to: WorkpackStatus): boolean {
        return VALID_TRANSITIONS[from]?.includes(to) ?? false;
    }

    static async submit(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'under_review')) {
            throw new WorkflowError(`Cannot submit from status '${wp.status}'`);
        }
        await this._transition(workpackId, organizationId, wp.status, 'under_review', 'submit', userId);
    }

    static async approve(workpackId: string, userId: string, organizationId: string, comment?: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'approved')) {
            throw new WorkflowError(`Cannot approve from status '${wp.status}'`);
        }
        await this._transition(workpackId, organizationId, wp.status, 'approved', 'approve', userId, comment);
        // Lock the workpack on approval
        await prisma.workpack.update({
            where: { id: workpackId, organization_id: organizationId },
            data: { is_locked: true, locked_at: new Date(), locked_by: userId },
        });
        // Section 9: Auto-snapshot on approval
        await WorkpackVersionService.autoSnapshot(workpackId, organizationId, userId, 'Snapshot on approval');
    }

    static async reject(workpackId: string, userId: string, organizationId: string, comment: string): Promise<void> {
        if (!comment?.trim()) {
            throw new WorkflowError('A rejection comment is mandatory');
        }
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        const target = 'draft';
        await this._transition(workpackId, organizationId, wp.status, target, 'reject', userId, comment);
        // Unlock on rejection
        await prisma.workpack.update({
            where: { id: workpackId, organization_id: organizationId },
            data: { is_locked: false, locked_at: null, locked_by: null },
        });
    }

    static async issue(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'issued')) {
            throw new WorkflowError(`Cannot issue from status '${wp.status}'`);
        }
        await this._transition(workpackId, organizationId, wp.status, 'issued', 'issue', userId);
    }

    static async close(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'closed')) {
            throw new WorkflowError(`Cannot close from status '${wp.status}'`);
        }
        // GATE 1: Open Category A punch items block closure
        const openCatA = await prisma.punchListItem.count({
            where: { workpack_id: workpackId, organization_id: organizationId, category: 'A', status: { not: 'closed' }, deleted_at: null },
        });
        if (openCatA > 0) {
            throw new WorkflowError(`${openCatA} open Category A punch item(s) must be closed before workpack can be closed`);
        }
        // GATE 2: All blinds must be removed
        const insertedBlinds = await prisma.blind.count({
            where: { workpack_id: workpackId, organization_id: organizationId, status: { in: ['inserted', 'pressure_tested'] }, deleted_at: null },
        });
        if (insertedBlinds > 0) {
            throw new WorkflowError(`${insertedBlinds} blind(s) still inserted. All blinds must be removed before closure.`);
        }
        await this._transition(workpackId, organizationId, wp.status, 'closed', 'close', userId);
    }

    static async getTransitionHistory(workpackId: string, organizationId: string) {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId }, select: { id: true } });
        if (!wp) throw new WorkflowError('Workpack not found');
        return prisma.workflowTransition.findMany({
            where: { workpack_id: workpackId },
            orderBy: { performed_at: 'desc' },
            include: { performer: { select: { id: true, name: true, email: true } } },
        });
    }

    private static async _transition(
        workpackId: string,
        organizationId: string,
        from: WorkpackStatus,
        to: WorkpackStatus,
        action: string,
        performedBy: string,
        comment?: string,
    ) {
        const workpack = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!workpack) throw new WorkflowError('Workpack not found');

        const [transition, updatedWorkpack] = await prisma.$transaction([
            prisma.workflowTransition.create({
                data: {
                    organization_id: workpack.organization_id,
                    workpack_id: workpackId,
                    from_status: from,
                    to_status: to,
                    action: action as any,
                    comment: comment ?? null,
                    comment_required: action === 'reject',
                    performed_by: performedBy,
                    performed_at: new Date(),
                },
            }),
            prisma.workpack.update({
                where: { id: workpackId, organization_id: organizationId },
                data: { status: to },
            }),
        ]);

        await AuditService.log({
            organization_id: workpack.organization_id,
            user_id: performedBy,
            model_name: 'WorkflowTransition',
            model_id: transition.id,
            action: 'created',
            new_values: transition,
        });

        await AuditService.log({
            organization_id: workpack.organization_id,
            site_id: workpack.site_id,
            user_id: performedBy,
            model_name: 'Workpack',
            model_id: workpackId,
            action: 'updated',
            old_values: workpack,
            new_values: updatedWorkpack,
        });

        eventBus.emit('WorkflowTransitioned', {
            workpack_id: workpackId,
            from_status: from,
            to_status: to,
            action,
            performed_by: performedBy,
        });
    }
}
