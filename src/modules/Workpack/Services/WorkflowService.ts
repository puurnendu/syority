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

/**
 * Authoritative Workpack Lifecycle:
 *
 * DRAFT → UNDER_REVIEW → APPROVED → ISSUED → IN_EXECUTION → COMPLETED → CLOSED
 *
 * During IN_EXECUTION, the following operate concurrently:
 * - Activity execution (not_started → in_progress → completed)
 * - QA/QC hold point clearance
 * - Materials, Tools, Safety, Punch, Documents
 *
 * QA/QC inspection is NOT a sequential lifecycle phase.
 * It is a concurrent execution control layer under IN_EXECUTION.
 */
const VALID_TRANSITIONS: Record<WorkpackStatus, WorkpackStatus[]> = {
    pending_ai_review: ['draft', 'cancelled'],
    draft: ['under_review', 'cancelled'],
    under_review: ['approved', 'draft'],
    approved: ['issued', 'draft'],
    issued: ['in_execution'],
    in_execution: ['completed'],
    completed: ['closed', 'in_execution'],
    closed: ['draft'],
    cancelled: ['draft'],
};

export class WorkflowService {
    static canTransition(from: WorkpackStatus, to: WorkpackStatus): boolean {
        return VALID_TRANSITIONS[from]?.includes(to) ?? false;
    }

    /**
     * Submit for review.
     * Preconditions: workpack must have a title and at least 1 activity.
     */
    static async submit(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'under_review')) {
            throw new WorkflowError(`Cannot submit from status '${wp.status}'`);
        }
        // Precondition: title must exist
        if (!wp.title?.trim()) {
            throw new WorkflowError('Workpack must have a title before submission');
        }
        // Precondition: at least 1 activity
        const activityCount = await prisma.activity.count({
            where: { workpack_id: workpackId, organization_id: organizationId, deleted_at: null },
        });
        if (activityCount === 0) {
            throw new WorkflowError('Workpack must have at least 1 activity before submission');
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
        if (!wp.event_id) {
            throw new WorkflowError('Workpack must be attached to an Event before it can be issued to the field');
        }
        const hasSnapshot = await prisma.workpackAssetSnapshot.count({
            where: { workpack_id: workpackId, organization_id: organizationId }
        });
        if (hasSnapshot === 0) {
            throw new WorkflowError('Workpack must have an established Engineering Snapshot before it can be issued');
        }

        await this._transition(workpackId, organizationId, wp.status, 'issued', 'issue', userId);

        eventBus.emit('WorkpackIssuedToField', {
            workpack_id: workpackId,
            event_id: wp.event_id,
            issued_by: userId,
            issued_at: new Date(),
        });
    }

    /**
     * Start execution — transitions issued workpack to active field execution.
     * issued → in_execution
     */
    static async startExecution(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'in_execution')) {
            throw new WorkflowError(`Cannot start execution from status '${wp.status}'`);
        }
        await this._transition(workpackId, organizationId, wp.status, 'in_execution', 'submit', userId);
    }

    /**
     * Complete workpack — all execution work is done.
     * in_execution → completed
     *
     * Completion gates (must all pass):
     * 1. All mandatory QA hold points must be cleared
     * 2. All Category A punch items must be closed
     * 3. All blinds must be removed
     */
    static async complete(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'completed')) {
            throw new WorkflowError(`Cannot complete from status '${wp.status}'`);
        }

        const blockers: string[] = [];

        // GATE 1: All mandatory QA hold points must be cleared
        const activitiesWithHoldPoints = await prisma.activity.findMany({
            where: {
                workpack_id: workpackId,
                organization_id: organizationId,
                hold_point_type: { not: null },
                deleted_at: null,
            },
            select: { id: true, activity_number: true, description: true },
        });

        if (activitiesWithHoldPoints.length > 0) {
            const actIds = activitiesWithHoldPoints.map((a) => a.id);
            const clearedRecords = await prisma.qa_clearance_records.findMany({
                where: {
                    workpack_id: workpackId,
                    organization_id: organizationId,
                    activity_id: { in: actIds },
                },
                select: { activity_id: true },
            });
            const clearedSet = new Set(clearedRecords.map((c) => c.activity_id));
            const uncleared = activitiesWithHoldPoints.filter((a) => !clearedSet.has(a.id));
            if (uncleared.length > 0) {
                blockers.push(`${uncleared.length} QA hold point(s) uncleared (e.g. ${uncleared[0].activity_number || uncleared[0].description})`);
            }
        }

        // GATE 2: All Category A punch items must be closed
        const openCatA = await prisma.punchListItem.count({
            where: { workpack_id: workpackId, organization_id: organizationId, category: 'A', status: { not: 'closed' }, deleted_at: null },
        });
        if (openCatA > 0) {
            blockers.push(`${openCatA} open Category A punch item(s)`);
        }

        // GATE 3: All blinds must be removed
        const insertedBlinds = await prisma.blind.count({
            where: { workpack_id: workpackId, organization_id: organizationId, status: { in: ['inserted', 'pressure_tested'] }, deleted_at: null },
        });
        if (insertedBlinds > 0) {
            blockers.push(`${insertedBlinds} blind(s) still inserted`);
        }

        if (blockers.length > 0) {
            throw new WorkflowError(`Cannot complete workpack. Reasons: ${blockers.join('; ')}`);
        }

        await this._transition(workpackId, organizationId, wp.status, 'completed', 'close', userId);
    }

    /**
     * Close workpack — administrative closeout after completion.
     * completed → closed
     */
    static async close(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'closed')) {
            throw new WorkflowError(`Cannot close from status '${wp.status}'`);
        }
        await this._transition(workpackId, organizationId, wp.status, 'closed', 'close', userId);
    }

    /**
     * Cancel workpack.
     * Allowed from: draft, under_review, approved, pending_ai_review
     * NOT allowed from issued or in_execution without a formal waiver.
     */
    static async cancel(workpackId: string, userId: string, organizationId: string, comment?: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'cancelled')) {
            throw new WorkflowError(`Cannot cancel from status '${wp.status}'. Cancellation from active execution requires a formal waiver.`);
        }
        await this._transition(workpackId, organizationId, wp.status, 'cancelled', 'cancel', userId, comment);
        // Unlock on cancellation
        await prisma.workpack.update({
            where: { id: workpackId, organization_id: organizationId },
            data: { is_locked: false, locked_at: null, locked_by: null },
        });
    }

    static async reopen(workpackId: string, userId: string, organizationId: string): Promise<void> {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId } });
        if (!wp) throw new WorkflowError('Workpack not found');
        if (!this.canTransition(wp.status, 'draft')) {
            throw new WorkflowError(`Cannot reopen from status '${wp.status}'`);
        }
        const target = 'draft';
        await this._transition(workpackId, organizationId, wp.status, target, 'reopen', userId);
        await prisma.workpack.update({
            where: { id: workpackId, organization_id: organizationId },
            data: { is_locked: false, locked_at: null, locked_by: null },
        });
    }

    static async getTransitionHistory(workpackId: string, organizationId: string) {
        const wp = await prisma.workpack.findFirst({ where: { id: workpackId, organization_id: organizationId }, select: { id: true } });
        if (!wp) throw new WorkflowError('Workpack not found');
        return prisma.workflowTransition.findMany({
            where: { workpack_id: workpackId },
            orderBy: { performed_at: 'desc' },
        });
    }

    /**
     * Compute the current execution condition for a workpack.
     * Derived from ConstraintLog, not stored as a persistent field.
     *
     * Returns: WORKING | QA_HOLD | MATERIAL_HOLD | SAFETY_HOLD | TECHNICAL_HOLD | OTHER_HOLD | BLOCKED
     */
    static async getExecutionCondition(workpackId: string, organizationId: string): Promise<{
        condition: string;
        activeConstraints: number;
        details: Array<{ category: string; title: string; severity: string; raisedAt: Date | null; targetResolution: Date | null }>;
    }> {
        const openConstraints = await prisma.constraintLog.findMany({
            where: {
                workpack_id: workpackId,
                organization_id: organizationId,
                status: { in: ['open', 'in_progress'] },
                deleted_at: null,
            },
            select: { category: true, title: true, severity: true, raised_date: true, target_resolution: true },
            orderBy: { raised_date: 'asc' },
        });

        if (openConstraints.length === 0) {
            return { condition: 'WORKING', activeConstraints: 0, details: [] };
        }

        const details = openConstraints.map((c) => ({
            category: c.category,
            title: c.title,
            severity: c.severity,
            raisedAt: c.raised_date,
            targetResolution: c.target_resolution,
        }));

        // Determine primary condition from constraint categories
        const categories = new Set(openConstraints.map((c) => c.category));
        const hasCritical = openConstraints.some((c) => c.severity === 'critical');

        if (hasCritical || openConstraints.length >= 3) {
            return { condition: 'BLOCKED', activeConstraints: openConstraints.length, details };
        }
        if (categories.has('inspection')) {
            return { condition: 'QA_HOLD', activeConstraints: openConstraints.length, details };
        }
        if (categories.has('material')) {
            return { condition: 'MATERIAL_HOLD', activeConstraints: openConstraints.length, details };
        }
        if (categories.has('permit')) {
            return { condition: 'SAFETY_HOLD', activeConstraints: openConstraints.length, details };
        }
        if (categories.has('equipment') || categories.has('vendor') || categories.has('document')) {
            return { condition: 'TECHNICAL_HOLD', activeConstraints: openConstraints.length, details };
        }

        return { condition: 'OTHER_HOLD', activeConstraints: openConstraints.length, details };
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

        const isKnownAction = ['submit', 'approve', 'reject', 'issue', 'close', 'cancel', 'reopen'].includes(action);
        const [transition, updatedWorkpack] = await prisma.$transaction([
            prisma.workflowTransition.create({
                data: {
                    id: crypto.randomUUID(),
                    organization_id: workpack.organization_id,
                    workpack_id: workpackId,
                    from_status: from,
                    to_status: to,
                    action: isKnownAction ? (action as any) : null,
                    comment: comment ?? (isKnownAction ? null : `Action: ${action}`),
                    comment_required: action === 'reject',
                    performed_by: performedBy,
                    performed_at: new Date(),
                    updated_at: new Date(),
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
