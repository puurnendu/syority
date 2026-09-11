/**
 * M12 bulk readiness — same formula as evaluateReadiness, set-based queries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    activity: { findMany: vi.fn(), findFirst: vi.fn() },
    constraintLog: { findMany: vi.fn(), count: vi.fn() },
    activityRelationship: { findMany: vi.fn() },
    permit: { findMany: vi.fn() },
    workpack_material_lines: { findMany: vi.fn() },
    blind: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { ExecutionReadinessService } from '../ExecutionReadinessService';

describe('ExecutionReadinessService bulk evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a bounded query set rather than N+1 evaluateReadiness loops', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `act-${i}`);
    (prisma.activity.findMany as any).mockResolvedValue(
      ids.map((id) => ({ id, workpack_id: 'wp-1', activity_number: id, description: id }))
    );
    (prisma.constraintLog.findMany as any).mockResolvedValue([]);
    (prisma.activityRelationship.findMany as any).mockResolvedValue([]);
    (prisma.permit.findMany as any).mockResolvedValue([]);
    (prisma.workpack_material_lines.findMany as any).mockResolvedValue([]);
    (prisma.blind.findMany as any).mockResolvedValue([]);

    const result = await ExecutionReadinessService.evaluateBulkReadiness('org-a', ids);

    expect(prisma.activity.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.constraintLog.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.activityRelationship.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.permit.findMany).toHaveBeenCalledTimes(1);
    // Phase 0 item 6: material + isolation dimensions are also set-based.
    expect(prisma.workpack_material_lines.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.blind.findMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(result)).toHaveLength(50);
    expect(result['act-0'].is_ready).toBe(true);
  });

  it('applies the same constraint/predecessor/permit blocker rules', async () => {
    (prisma.activity.findMany as any).mockResolvedValue([
      { id: 'act-1', workpack_id: 'wp-1', activity_number: 'A-1', description: 'A' },
    ]);
    (prisma.constraintLog.findMany as any).mockResolvedValue([{ workpack_id: 'wp-1' }]);
    (prisma.activityRelationship.findMany as any).mockResolvedValue([
      {
        successor_id: 'act-1',
        predecessor: {
          status: 'in_progress',
          activity_number: 'P-1',
          description: 'Pred',
          organization_id: 'org-a',
        },
      },
    ]);
    (prisma.permit.findMany as any).mockResolvedValue([
      {
        permit_number: 'PTW-1',
        status: 'draft',
        valid_until: null,
        workpack_id: 'wp-1',
        activity_id: null,
      },
    ]);
    (prisma.workpack_material_lines.findMany as any).mockResolvedValue([]);
    (prisma.blind.findMany as any).mockResolvedValue([]);

    const result = await ExecutionReadinessService.evaluateBulkReadiness('org-a', ['act-1']);
    expect(result['act-1'].is_ready).toBe(false);
    expect(result['act-1'].blockers.some((b) => b.includes('critical constraints'))).toBe(true);
    expect(result['act-1'].blockers.some((b) => b.includes('Predecessor'))).toBe(true);
    expect(result['act-1'].blockers.some((b) => b.includes('PTW-1'))).toBe(true);
  });

  it('A10 — a critical material shortfall blocks START', async () => {
    (prisma.activity.findMany as any).mockResolvedValue([
      { id: 'act-1', workpack_id: 'wp-1', activity_number: 'A-1', description: 'A' },
    ]);
    (prisma.constraintLog.findMany as any).mockResolvedValue([]);
    (prisma.activityRelationship.findMany as any).mockResolvedValue([]);
    (prisma.permit.findMany as any).mockResolvedValue([]);
    (prisma.blind.findMany as any).mockResolvedValue([]);
    (prisma.workpack_material_lines.findMany as any).mockResolvedValue([
      {
        id: 'ml-1',
        workpack_id: 'wp-1',
        description: 'Gasket kit',
        is_critical: true,
        quantity_required: 10,
        quantity_available: 0,
        quantity_on_order: 0,
        expected_eta: null,
        supply_records: [],
      },
    ]);

    const result = await ExecutionReadinessService.evaluateBulkReadiness('org-a', ['act-1']);
    expect(result['act-1'].is_ready).toBe(false);
    expect(result['act-1'].blockers.some((b) => /material/i.test(b))).toBe(true);
  });

  it('A11 — unconfirmed safe isolation blocks START, but not the isolating activity', async () => {
    (prisma.activity.findMany as any).mockResolvedValue([
      { id: 'act-work', workpack_id: 'wp-1', activity_number: 'A-1', description: 'Work' },
      { id: 'act-iso', workpack_id: 'wp-1', activity_number: 'A-0', description: 'Insert blinds' },
    ]);
    (prisma.constraintLog.findMany as any).mockResolvedValue([]);
    (prisma.activityRelationship.findMany as any).mockResolvedValue([]);
    (prisma.permit.findMany as any).mockResolvedValue([]);
    (prisma.workpack_material_lines.findMany as any).mockResolvedValue([]);
    (prisma.blind.findMany as any).mockResolvedValue([
      {
        workpack_id: 'wp-1',
        blind_number: 'BL-001',
        safe_isolation_confirmed: false,
        insert_activity_id: 'act-iso',
        remove_activity_id: null,
      },
    ]);

    const result = await ExecutionReadinessService.evaluateBulkReadiness('org-a', ['act-work', 'act-iso']);
    expect(result['act-work'].is_ready).toBe(false);
    expect(result['act-work'].blockers.some((b) => /isolation/i.test(b))).toBe(true);
    // The activity that performs the isolation is not gated by its own blind.
    expect(result['act-iso'].blockers.some((b) => /isolation/i.test(b))).toBe(false);
  });

  it('A11b — confirmed isolation does not block', async () => {
    (prisma.activity.findMany as any).mockResolvedValue([
      { id: 'act-1', workpack_id: 'wp-1', activity_number: 'A-1', description: 'A' },
    ]);
    (prisma.constraintLog.findMany as any).mockResolvedValue([]);
    (prisma.activityRelationship.findMany as any).mockResolvedValue([]);
    (prisma.permit.findMany as any).mockResolvedValue([]);
    (prisma.workpack_material_lines.findMany as any).mockResolvedValue([]);
    (prisma.blind.findMany as any).mockResolvedValue([
      {
        workpack_id: 'wp-1',
        blind_number: 'BL-002',
        safe_isolation_confirmed: true,
        insert_activity_id: null,
        remove_activity_id: null,
      },
    ]);

    const result = await ExecutionReadinessService.evaluateBulkReadiness('org-a', ['act-1']);
    expect(result['act-1'].is_ready).toBe(true);
  });

  it('scopes bulk queries by organizationId', async () => {
    (prisma.activity.findMany as any).mockResolvedValue([]);
    await ExecutionReadinessService.evaluateBulkReadiness('org-a', ['act-x', 'act-y']);
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-a' }),
      })
    );
  });
});
