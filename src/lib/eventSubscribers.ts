import { eventBus } from './eventBus';
import { NotificationService } from './notifications';
import { processEvent } from '@/core/notifications';
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
                select: { created_by: true, title: true, organization_id: true, workpack_number: true },
            });
            if (!workpack) return;

            const actionUrl = `/workpacks/${data.workpack_id}`;
            const wpIdentifier = workpack.workpack_number || workpack.title || data.workpack_id;

            // Look up the org name for template variables
            const org = await prisma.organization.findUnique({
                where: { id: workpack.organization_id },
                select: { name: true },
            });

            if (data.action === 'submit') {
                const approvers = await prisma.user.findMany({
                    where: { organization_id: workpack.organization_id, is_tenant_admin: true },
                    select: { id: true },
                });

                // In-app notifications (preserved)
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
                }

                // Email via notification platform rule engine
                await processEvent('workpack.submitted', {
                    organizationId: workpack.organization_id,
                    triggeredBy: data.performed_by,
                    entityType: 'Workpack',
                    entityId: data.workpack_id,
                    variables: {
                        user_name: data.performed_by,
                        company: org?.name ?? 'AURIANOA OS',
                        workpack_number: wpIdentifier,
                        workpack_title: workpack.title ?? '',
                        approval_link: appUrl(actionUrl),
                        app_url: appUrl('/'),
                    },
                }).catch(err => console.error('[EventSubscriber] Notification platform error:', err));

            } else if (data.action === 'approve') {
                if (workpack.created_by) {
                    // In-app notification (preserved)
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

                    // Email via notification platform rule engine
                    await processEvent('workpack.approved', {
                        organizationId: workpack.organization_id,
                        triggeredBy: data.performed_by,
                        entityType: 'Workpack',
                        entityId: data.workpack_id,
                        variables: {
                            user_name: data.performed_by,
                            company: org?.name ?? 'AURIANOA OS',
                            workpack_number: wpIdentifier,
                            workpack_title: workpack.title ?? '',
                            changed_by: data.performed_by,
                            notes: (data as any).notes ?? '',
                            app_url: appUrl(actionUrl),
                        },
                    }).catch(err => console.error('[EventSubscriber] Notification platform error:', err));
                }
            } else if (data.action === 'reject') {
                if (workpack.created_by) {
                    // In-app notification (preserved)
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

                    // Email via notification platform rule engine
                    await processEvent('workpack.rejected', {
                        organizationId: workpack.organization_id,
                        triggeredBy: data.performed_by,
                        entityType: 'Workpack',
                        entityId: data.workpack_id,
                        variables: {
                            user_name: data.performed_by,
                            company: org?.name ?? 'AURIANOA OS',
                            workpack_number: wpIdentifier,
                            workpack_title: workpack.title ?? '',
                            changed_by: data.performed_by,
                            notes: (data as any).notes ?? '',
                            app_url: appUrl(actionUrl),
                        },
                    }).catch(err => console.error('[EventSubscriber] Notification platform error:', err));
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
