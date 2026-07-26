import { eventBus } from './eventBus';
import { NotificationService } from './notifications';
import { prisma } from './prisma';
import { appUrl } from './appUrl';

let isRegistered = false;

export function registerEventSubscribers(bus: typeof eventBus): void {
    if (isRegistered) return;
    isRegistered = true;

    bus.on('WorkflowTransitioned', async (data) => {
        try {
            const workpack = await prisma.workpack.findUnique({
                where: { id: data.workpack_id },
                select: { created_by: true, title: true, organization_id: true, workpack_number: true }
            });
            if (!workpack) return;

            const actionUrl = `/workpacks/${data.workpack_id}`;
            const wpIdentifier = workpack.workpack_number || workpack.title || data.workpack_id;

            if (data.action === 'submit') {
                // TODO: Get real approver list when implemented. Defaulting to notifying the organization admins for now, or just logging if no specific approvers.
                // For acceptance criteria: we'll simulate sending to an approver chain if we had one.
                // Since we don't have role-based lookup implemented yet, we might skip the actual user_id for approver or send to a dummy if needed.
                // We will query users with admin/approver role if possible, but let's notify the originator as well for now so there's an actual notification sent.
                const approvers = await prisma.user.findMany({
                    where: { organization_id: workpack.organization_id, is_tenant_admin: true },
                    select: { id: true }
                });

                for (const approver of approvers) {
                    await NotificationService.create({
                        organizationId: workpack.organization_id,
                        userId: approver.id,
                        type: 'workpack.submitted',
                        title: `Workpack Submitted: ${wpIdentifier}`,
                        message: `Workpack has been submitted for review by ${data.performed_by}`,
                        notifiableType: 'Workpack',
                        notifiableId: data.workpack_id,
                        actionUrl,
                        triggeredBy: data.performed_by,
                    });

                    // Trigger Email
                    await NotificationService.sendEmail(
                        workpack.organization_id,
                        approver.id,
                        'workpack.submitted',
                        {
                            plannerName: data.performed_by,
                            workpackNumber: wpIdentifier,
                            workpackTitle: workpack.title,
                            reviewUrl: appUrl(actionUrl),
                        },
                        { subject: `Review Required: Workpack ${wpIdentifier}` }
                    );
                }
            } else if (data.action === 'approve') {
                if (workpack.created_by) {
                    await NotificationService.create({
                        organizationId: workpack.organization_id,
                        userId: workpack.created_by,
                        type: 'workpack.approved',
                        title: `Workpack Approved: ${wpIdentifier}`,
                        message: `Your workpack was approved.`,
                        notifiableType: 'Workpack',
                        notifiableId: data.workpack_id,
                        actionUrl,
                        triggeredBy: data.performed_by,
                    });

                    // Trigger Email
                    await NotificationService.sendEmail(
                        workpack.organization_id,
                        workpack.created_by,
                        'workpack.approved',
                        {
                            workpackNumber: wpIdentifier,
                            workpackTitle: workpack.title,
                            changedBy: data.performed_by,
                            workpackUrl: appUrl(actionUrl),
                            notes: (data as any).notes,
                        },
                        { subject: `Workpack Approved: ${wpIdentifier}` }
                    );
                }
            } else if (data.action === 'reject') {
                if (workpack.created_by) {
                    await NotificationService.create({
                        organizationId: workpack.organization_id,
                        userId: workpack.created_by,
                        type: 'workpack.rejected',
                        title: `Workpack Rejected: ${wpIdentifier}`,
                        message: `Your workpack was rejected.`,
                        notifiableType: 'Workpack',
                        notifiableId: data.workpack_id,
                        actionUrl,
                        triggeredBy: data.performed_by,
                    });

                    // Trigger Email
                    await NotificationService.sendEmail(
                        workpack.organization_id,
                        workpack.created_by,
                        'workpack.rejected',
                        {
                            workpackNumber: wpIdentifier,
                            workpackTitle: workpack.title,
                            changedBy: data.performed_by,
                            workpackUrl: appUrl(actionUrl),
                            notes: (data as any).notes,
                        },
                        { subject: `Workpack Rejected: ${wpIdentifier}` }
                    );
                }
            } else {
                // fallback for 'issue', 'close' etc.
                if (workpack.created_by) {
                    await NotificationService.create({
                        organizationId: workpack.organization_id,
                        userId: workpack.created_by,
                        type: 'workpack.status_changed',
                        title: `Workpack Status Changed: ${wpIdentifier}`,
                        message: `Workpack transitioned to ${data.to_status}.`,
                        notifiableType: 'Workpack',
                        notifiableId: data.workpack_id,
                        actionUrl,
                        triggeredBy: data.performed_by,
                    });
                }
            }
        } catch (error) {
            console.error('[EventSubscriber] Error handling WorkflowTransitioned:', error);
        }
    });
}
