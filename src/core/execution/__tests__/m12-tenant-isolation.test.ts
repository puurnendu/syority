import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionWriteService } from '../ExecutionWriteService';
import prisma from '@/lib/prisma';
import { RequestContext } from '@/core/auth/RequestContext';
import { ExecutionActionPayload } from '../types';

vi.mock('@/lib/prisma', () => ({
  default: {
    activity: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
  },
  prisma: {
    activity: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
  }
}));

describe('M12 Phase 3: Tenant Isolation Tests (Negative Tests)', () => {
  const tenantAContext: RequestContext = {
    user: { id: 'user-a', email: 'a@a.com', role: 'tenant_administrator', organization: { id: 'tenant-a' }, currentOrganizationId: 'tenant-a' },
    organization: { id: 'tenant-a', name: 'Tenant A' },
    permissions: [],
    ipAddress: '127.0.0.1',
    userAgent: 'test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = () => {
    (prisma.activity.findFirst as any).mockResolvedValue(null);
    (prisma.activity.findUnique as any).mockResolvedValue(null);
  };

  const assertThrowsUnauthorized = async (promise: Promise<any>) => {
    await expect(promise).rejects.toThrowError(/not found/);
  };

  it('Tenant A cannot RELEASE Tenant B activity', async () => {
    setupMock();
    await assertThrowsUnauthorized(
      ExecutionWriteService.applyAction('tenant-a', 'user-a', { activityId: 'activity-b', action: 'RELEASE' }, { source_channel: 'web' })
    );
  });

  it('Tenant A cannot START Tenant B activity', async () => {
    setupMock();
    await assertThrowsUnauthorized(
      ExecutionWriteService.applyAction('tenant-a', 'user-a', { activityId: 'activity-b', action: 'START' }, { source_channel: 'web' })
    );
  });

  it('Tenant A cannot HOLD/RESUME Tenant B activity', async () => {
    setupMock();
    await assertThrowsUnauthorized(
      ExecutionWriteService.applyAction('tenant-a', 'user-a', { activityId: 'activity-b', action: 'HOLD', hold_reason: 'Testing' }, { source_channel: 'web' })
    );

    await assertThrowsUnauthorized(
      ExecutionWriteService.applyAction('tenant-a', 'user-a', { activityId: 'activity-b', action: 'RESUME' }, { source_channel: 'web' })
    );
  });

  it('Tenant A cannot COMPLETE Tenant B activity', async () => {
    setupMock();
    await assertThrowsUnauthorized(
      ExecutionWriteService.applyAction('tenant-a', 'user-a', { activityId: 'activity-b', action: 'COMPLETE' }, { source_channel: 'web' })
    );
  });

  it('Tenant A cannot VERIFY or CLOSE Tenant B activity', async () => {
    setupMock();
    await assertThrowsUnauthorized(
      ExecutionWriteService.applyAction('tenant-a', 'user-a', { activityId: 'activity-b', action: 'VERIFY' }, { source_channel: 'web' })
    );
    await assertThrowsUnauthorized(
      ExecutionWriteService.applyAction('tenant-a', 'user-a', { activityId: 'activity-b', action: 'CLOSE' }, { source_channel: 'web' })
    );
  });

  it('Tenant A cannot bulk-execute Tenant B activities', async () => {
    setupMock();
    const result = await ExecutionWriteService.bulkApplyAction(
      'tenant-a',
      'user-a',
      [
        { activityId: 'activity-b', action: 'RELEASE' },
        { activityId: 'activity-c', action: 'RELEASE' }
      ],
      { source_channel: 'api' }
    );

    expect(result).toHaveLength(2);
    expect(result[0].success).toBe(false);
    expect(result[0].error).toMatch(/not found/);
    expect(result[1].success).toBe(false);
    expect(result[1].error).toMatch(/not found/);
  });
});
