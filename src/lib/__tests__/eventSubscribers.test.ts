import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { eventBus } from '../eventBus';
import { randomUUID } from 'crypto';
import { registerEventSubscribers } from '../eventSubscribers';
import { prisma } from '../prisma';

describe('eventSubscribers integration', () => {
    beforeEach(async () => {
        // Need to ensure the subscribers are registered for tests
        registerEventSubscribers(eventBus);
        await prisma.notification.deleteMany();
    });

    it('creates a workpack.submitted notification on submit transition', async () => {
        // Setup mock workpack and users
        const org = await prisma.organization.create({ data: { id: randomUUID(), name: 'Test Org', updated_at: new Date() } });
        const admin = await prisma.user.create({
            data: {
                id: randomUUID(),
                Organization: { connect: { id: org.id } },
                name: 'Admin User',
                email: `admin_${Date.now()}@test.com`,
                is_tenant_admin: true,
                updated_at: new Date(),
                password: 'hash',
            }
        });
        const creator = await prisma.user.create({
            data: {
                id: randomUUID(),
                Organization: { connect: { id: org.id } },
                name: 'Creator User',
                email: `creator_${Date.now()}@test.com`,
                updated_at: new Date(),
                password: 'hash',
            }
        });
        const site = await prisma.site.create({ data: { id: randomUUID(), Organization: { connect: { id: org.id } }, name: 'Test Site', updated_at: new Date() } });
        const wp = await prisma.workpack.create({
            data: {
                id: randomUUID(),
                organization: { connect: { id: org.id } },
                site: { connect: { id: site.id } },
                title: 'Test Submit WP',
                status: 'draft',
                User_Workpack_created_byToUser: { connect: { id: creator.id } },
                updated_at: new Date(),
            }
        });

        // Emit event
        eventBus.emit('WorkflowTransitioned', {
            workpack_id: wp.id,
            from_status: 'draft',
            to_status: 'under_review',
            action: 'submit',
            performed_by: creator.id
        });

        // Wait a short tick for async subscriber to run
        await new Promise(r => setTimeout(r, 200));

        const notifications = await prisma.notification.findMany({
            where: { notifiable_id: wp.id }
        });

        expect(notifications.length).toBeGreaterThan(0);
        expect(notifications[0].type).toBe('workpack.submitted');
        expect(notifications[0].user_id).toBe(admin.id);
    });

    it('creates a workpack.approved notification on approve transition', async () => {
        const org = await prisma.organization.create({ data: { id: randomUUID(), name: 'Test Org 2', updated_at: new Date() } });
        const creator = await prisma.user.create({
            data: {
                id: randomUUID(),
                Organization: { connect: { id: org.id } },
                name: 'Creator User 2',
                email: `creator2_${Date.now()}@test.com`,
                updated_at: new Date(),
                password: 'hash',
            }
        });
        const site = await prisma.site.create({ data: { id: randomUUID(), Organization: { connect: { id: org.id } }, name: 'Test Site', updated_at: new Date() } });
        const wp = await prisma.workpack.create({
            data: {
                id: randomUUID(),
                organization: { connect: { id: org.id } },
                site: { connect: { id: site.id } },
                title: 'Test Approve WP',
                status: 'under_review',
                User_Workpack_created_byToUser: { connect: { id: creator.id } },
                updated_at: new Date(),
            }
        });

        eventBus.emit('WorkflowTransitioned', {
            workpack_id: wp.id,
            from_status: 'under_review',
            to_status: 'approved',
            action: 'approve',
            performed_by: creator.id
        });

        await new Promise(r => setTimeout(r, 200));

        const notifications = await prisma.notification.findMany({
            where: { notifiable_id: wp.id, type: 'workpack.approved' }
        });

        expect(notifications.length).toBe(1);
        expect(notifications[0].user_id).toBe(creator.id);
    });

    it('creates a workpack.rejected notification on reject transition', async () => {
        const org = await prisma.organization.create({ data: { id: randomUUID(), name: 'Test Org 3', updated_at: new Date() } });
        const creator = await prisma.user.create({
            data: {
                id: randomUUID(),
                Organization: { connect: { id: org.id } },
                name: 'Creator User 3',
                email: `creator3_${Date.now()}@test.com`,
                updated_at: new Date(),
                password: 'hash',
            }
        });
        const site = await prisma.site.create({ data: { id: randomUUID(), Organization: { connect: { id: org.id } }, name: 'Test Site', updated_at: new Date() } });
        const wp = await prisma.workpack.create({
            data: {
                id: randomUUID(),
                organization: { connect: { id: org.id } },
                site: { connect: { id: site.id } },
                title: 'Test Reject WP',
                status: 'under_review',
                User_Workpack_created_byToUser: { connect: { id: creator.id } },
                updated_at: new Date(),
            }
        });

        eventBus.emit('WorkflowTransitioned', {
            workpack_id: wp.id,
            from_status: 'under_review',
            to_status: 'draft',
            action: 'reject',
            performed_by: creator.id
        });

        await new Promise(r => setTimeout(r, 200));

        const notifications = await prisma.notification.findMany({
            where: { notifiable_id: wp.id, type: 'workpack.rejected' }
        });

        expect(notifications.length).toBe(1);
        expect(notifications[0].user_id).toBe(creator.id);
    });

    it('creates a workpack.status_changed notification on issue transition', async () => {
        const org = await prisma.organization.create({ data: { id: randomUUID(), name: 'Test Org 4', updated_at: new Date() } });
        const creator = await prisma.user.create({
            data: {
                id: randomUUID(),
                Organization: { connect: { id: org.id } },
                name: 'Creator User 4',
                email: `creator4_${Date.now()}@test.com`,
                updated_at: new Date(),
                password: 'hash',
            }
        });
        const site = await prisma.site.create({ data: { id: randomUUID(), Organization: { connect: { id: org.id } }, name: 'Test Site', updated_at: new Date() } });
        const wp = await prisma.workpack.create({
            data: {
                id: randomUUID(),
                organization: { connect: { id: org.id } },
                site: { connect: { id: site.id } },
                title: 'Test Issue WP',
                status: 'approved',
                User_Workpack_created_byToUser: { connect: { id: creator.id } },
                updated_at: new Date(),
            }
        });

        eventBus.emit('WorkflowTransitioned', {
            workpack_id: wp.id,
            from_status: 'approved',
            to_status: 'issued',
            action: 'issue',
            performed_by: creator.id
        });

        await new Promise(r => setTimeout(r, 200));

        const notifications = await prisma.notification.findMany({
            where: { notifiable_id: wp.id, type: 'workpack.status_changed' }
        });

        expect(notifications.length).toBe(1);
        expect(notifications[0].user_id).toBe(creator.id);
    });
});
