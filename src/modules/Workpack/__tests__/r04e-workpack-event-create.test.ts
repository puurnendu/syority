/**
 * R0.4-E — future STO Workpacks require Event context.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkpackService } from '../Services/WorkpackService';
import { WorkpackIdentityError } from '../WorkpackIdentityError';
import { prisma } from '@/lib/prisma';

const ORG = '11111111-1111-4111-8111-111111111111';
const SITE = 's1111111-1111-4111-8111-111111111111';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT = 'e2027000-0000-4000-8000-000000002027';
const OTHER_EVENT = 'e9999999-0000-4000-8000-000000009999';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationDocumentSetting: { findUnique: vi.fn() },
    workpack: { findFirst: vi.fn(), create: vi.fn() },
    event: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/audit', () => ({
  AuditService: { log: vi.fn() },
}));

vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

describe('R0.4-E Workpack create Event requirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects STO Workpack create without event_id', async () => {
    await expect(
      WorkpackService.createWorkpack({
        organization_id: ORG,
        site_id: SITE,
        title: 'No Event WP',
        created_by: USER,
      })
    ).rejects.toMatchObject({ identityCode: 'EVENT_REQUIRED' });
    expect(prisma.workpack.create).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant Event with generic not-found', async () => {
    (prisma.event.findFirst as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: OTHER_EVENT });

    await expect(
      WorkpackService.createWorkpack({
        organization_id: ORG,
        site_id: SITE,
        title: 'Foreign Event WP',
        created_by: USER,
        event_id: OTHER_EVENT,
      })
    ).rejects.toMatchObject({ identityCode: 'CROSS_TENANT_EVENT' });
    expect(prisma.workpack.create).not.toHaveBeenCalled();
  });

  it('creates when Event belongs to the organisation', async () => {
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVENT });
    (prisma.organizationDocumentSetting.findUnique as any).mockResolvedValue(null);
    (prisma.workpack.findFirst as any).mockResolvedValue(null);
    (prisma.workpack.create as any).mockResolvedValue({
      id: 'wp-new',
      organization_id: ORG,
      event_id: EVENT,
      title: 'TA WP',
    });

    const created = await WorkpackService.createWorkpack({
      organization_id: ORG,
      site_id: SITE,
      title: 'TA WP',
      created_by: USER,
      event_id: EVENT,
    });

    expect(created.event_id).toBe(EVENT);
    expect(prisma.event.findFirst).toHaveBeenCalledWith({
      where: { id: EVENT, organization_id: ORG, deleted_at: null },
      select: { id: true },
    });
  });
});
