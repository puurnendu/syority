import { prisma } from './prisma';
import { eventBus } from './eventBus';
const crypto = globalThis.crypto;
import { render } from '@react-email/render';
import * as React from 'react';
import { sendEmail as deliveryService } from './email/emailService';

// Import templates
import { WorkpackSubmittedEmail } from '@/emails/WorkpackSubmittedEmail';
import { WorkpackApprovedEmail } from '@/emails/WorkpackApprovedEmail';
import { WorkpackRejectedEmail } from '@/emails/WorkpackRejectedEmail';
import { DailyDigestEmail } from '@/emails/DailyDigestEmail';

const TEMPLATE_MAP = {
    'workpack.submitted': WorkpackSubmittedEmail,
    'workpack.approved': WorkpackApprovedEmail,
    'workpack.rejected': WorkpackRejectedEmail,
    'daily.digest': DailyDigestEmail,
} as const;

export type EmailTemplateType = keyof typeof TEMPLATE_MAP;

/**
 * NotificationService — In-app notification system.
 * 
 * Triggered by workflow events and other module actions.
 * Notifications are tenant-scoped and user-specific.
 */
export interface CreateNotificationInput {
    organizationId: string;
    userId: string;
    type: string; // e.g. 'workpack.submitted', 'workpack.approved', 'workpack.rejected'
    title: string;
    message?: string | null;
    notifiableType?: string | null; // e.g. 'Workpack'
    notifiableId?: string | null; // e.g. workpack.id
    actionUrl?: string | null; // e.g. '/workpacks/WP-2024-00142'
    triggeredBy?: string | null; // user.id who triggered the notification
}

export class NotificationService {
    /**
     * Create a notification for a user.
     */
    static async create(input: CreateNotificationInput): Promise<void> {
        try {
            await prisma.notification.create({
                data: {
                    id: crypto.randomUUID(),
                    organization_id: input.organizationId,
                    user_id: input.userId,
                    type: input.type,
                    title: input.title,
                    message: input.message ?? null,
                    notifiable_type: input.notifiableType ?? null,
                    notifiable_id: input.notifiableId ?? null,
                    action_url: input.actionUrl ?? null,
                    triggered_by: input.triggeredBy ?? null,
                    is_read: false,
                    updated_at: new Date(),
                },
            });
        } catch (error) {
            console.error('[NotificationService] Failed to create notification:', error);
        }
    }

    /**
     * Mark a notification as read.
     */
    static async markRead(notificationId: string, userId: string): Promise<void> {
        await prisma.notification.updateMany({
            where: {
                id: notificationId,
                user_id: userId, // Ensure user can only mark their own notifications as read
            },
            data: {
                is_read: true,
                read_at: new Date(),
            },
        });
    }

    /**
     * Get unread notifications for a user.
     */
    static async getUnreadForUser(userId: string, organizationId: string, limit = 50) {
        return prisma.notification.findMany({
            where: {
                user_id: userId,
                organization_id: organizationId,
                is_read: false,
            },
            orderBy: {
                created_at: 'desc',
            },
            take: limit,
        });
    }

    /**
     * Get all notifications for a user (read + unread).
     */
    static async getAllForUser(userId: string, organizationId: string, limit = 100) {
        return prisma.notification.findMany({
            where: {
                user_id: userId,
                organization_id: organizationId,
            },
            orderBy: {
                created_at: 'desc',
            },
            take: limit,
        });
    }

    /**
     * Send an email notification using a typed template.
     *
     * M7.6: Routes through the notification platform queue for
     * audit logging, retry handling, and provider management.
     */
    static async sendEmail<T extends EmailTemplateType>(
        organizationId: string,
        userId: string,
        templateType: T,
        props: any,
        options: { subject?: string } = {}
    ): Promise<void> {
        try {
            // 1. Resolve User and Organization for branding and preferences
            const [user, org] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { email: true, name: true, is_active: true }
                }),
                prisma.organization.findUnique({
                    where: { id: organizationId },
                    select: { name: true, logo_url: true, primary_color: true }
                })
            ]);

            if (!user || !user.email || !user.is_active) {
                console.warn(`[NotificationService.sendEmail] User ${userId} not eligible for email.`);
                return;
            }

            // 2. Resolve Template
            const TemplateComponent = TEMPLATE_MAP[templateType] as any;
            if (!TemplateComponent) {
                throw new Error(`Unknown email template: ${templateType}`);
            }

            // 3. Inject Branding
            const finalProps = {
                ...props,
                recipientName: user.name,
                orgName: org?.name ?? 'AURIANOA OS',
                logoUrl: org?.logo_url,
                primaryColor: org?.primary_color ?? '#4F46E5',
            };

            // 4. Render HTML and Text
            const html = await render(React.createElement(TemplateComponent, finalProps));
            const text = await render(React.createElement(TemplateComponent, finalProps), {
                plainText: true,
            });

            // 5. Deliver via notification queue (M7.6)
            //    Get default provider for queue entry
            const defaultProvider = await prisma.notification_providers.findFirst({
                where: { is_default: true, is_enabled: true },
                select: { id: true },
            });

            const subject = options.subject ?? `Notification: ${templateType}`;

            await prisma.notification_queue.create({
                data: {
                    provider_id: defaultProvider?.id ?? null,
                    channel: 'email',
                    recipient_email: user.email,
                    recipient_name: user.name,
                    subject,
                    html_body: html,
                    text_body: text,
                    status: 'pending',
                    priority: 5,
                    max_attempts: 3,
                    organization_id: organizationId,
                    triggered_by: userId,
                    event_type: templateType,
                },
            });

        } catch (error) {
            console.error('[NotificationService] Failed to enqueue email:', error);
        }
    }

    /**
     * Compile and send a daily digest for a user based on notifications from the last 24 hours.
     */
    static async sendDailyDigest(organizationId: string, userId: string): Promise<void> {
        try {
            const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const notifications = await prisma.notification.findMany({
                where: {
                    user_id: userId,
                    organization_id: organizationId,
                    created_at: { gte: last24h }
                },
                orderBy: { created_at: 'desc' }
            });

            if (notifications.length === 0) {
                console.log(`[NotificationService.sendDailyDigest] No new activity for user ${userId} in last 24h.`);
                return;
            }

            const { appUrl } = await import('@/lib/appUrl');
            const items = notifications.map((n) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message ?? '',
                actionUrl: n.action_url ? appUrl(n.action_url) : appUrl('/dashboard'),
            }));

            await this.sendEmail(
                organizationId,
                userId,
                'daily.digest',
                {
                    items,
                    dashboardUrl: appUrl('/dashboard'),
                },
                { subject: `Daily Activity Summary: ${notifications.length} updates` }
            );
        } catch (error) {
            console.error('[NotificationService] Failed to send daily digest:', error);
        }
    }
}

