import { prisma } from '@/lib/prisma';

export type NotificationInput = {
    organizationId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    link?: string;
    entityType?: string;
    entityId?: string;
};

/** Creates a notification; deduplicates within 24h for same user + entity to avoid spam. */
export async function createNotification(input: NotificationInput): Promise<void> {
    try {
        if (input.entityId && input.entityType) {
            const recent = await prisma.notification.findFirst({
                where: {
                    user_id: input.userId,
                    type: input.type,
                    notifiable_id: input.entityId,
                    notifiable_type: input.entityType,
                    created_at: {
                        gte: new Date(Date.now() - 86_400_000),
                    },
                },
                select: { id: true },
            });
            if (recent) return;
        }

        await prisma.notification.create({
            data: {
                organization_id: input.organizationId,
                user_id: input.userId,
                type: input.type,
                title: input.title,
                message: input.body,
                action_url: input.link ?? null,
                notifiable_type: input.entityType ?? null,
                notifiable_id: input.entityId ?? null,
            },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Notifications] Create failed:', msg);
    }
}

/** Notify all org admins (users with super_admin or org_admin role in this org). */
export async function notifyOrgAdmins(
    organizationId: string,
    input: Omit<NotificationInput, 'userId' | 'organizationId'>
): Promise<void> {
    try {
        const admins = await prisma.user.findMany({
            where: {
                organization_id: organizationId,
                is_active: true,
                deleted_at: null,
                user_roles: {
                    some: {
                        role: {
                            slug: { in: ['super_admin', 'org_admin'] },
                        },
                    },
                },
            },
            select: { id: true },
        });
        await Promise.all(
            admins.map((u) =>
                createNotification({
                    ...input,
                    organizationId,
                    userId: u.id,
                })
            )
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Notifications] NotifyAdmins failed:', msg);
    }
}
