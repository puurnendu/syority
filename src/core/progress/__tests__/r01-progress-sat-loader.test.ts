/**
 * R0.1 — M8.13 can read standard_activity_type_id from the activity loader.
 * Does not change progress formulas.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ProgressAggregationService } from '../ProgressAggregationService';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: vi.fn(),
    },
    standardActivityType: {
      findMany: vi.fn(),
    },
    workpack: {
      findMany: vi.fn(),
    },
  },
}));

describe('R0.1 M8.13 standard activity loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps selected standard_activity_type_id into identical-activity grouping', async () => {
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      {
        id: 'act-1',
        description: 'Bundle pullout',
        duration_hours: 16,
        progress_percent: 0,
        status: 'not_started',
        workpack_id: 'wp-1',
        event_id: 'evt-1',
        discipline_id: 'd-mech',
        standard_activity_type_id: 'sat-bpull',
        discipline: { name: 'Mechanical' },
        workpack: {
          contractor_id: null,
          contractor: null,
          unit_id: 'u1',
          unit: { code: 'U1' },
          equipment_type: 'HEX-ST',
          asset_id: 'a1',
          asset: { id: 'a1', name: 'HX-204', tag_number: 'HX-204' },
        },
      },
    ] as any);
    vi.mocked(prisma.standardActivityType.findMany).mockResolvedValue([
      { id: 'sat-bpull', name: 'Bundle Pullout', code: 'BPULL' },
    ] as any);

    const groups = await ProgressAggregationService.getIdenticalActivityProgress('org-1', 'evt-1');

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          standard_activity_type_id: true,
        }),
      })
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].standardActivityTypeCode).toBe('BPULL');
    expect(groups[0].equipmentType).toBe('HEX-ST');
  });
});
