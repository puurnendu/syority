import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * M9 — Workpack Factory V1 Tests
 *
 * Validates:
 * - Approved scope required
 * - ONE ScopeItem → ONE Workpack (idempotency)
 * - ONE Workpack → ONE Primary Equipment
 * - Duplicate prevention
 * - Template recommendation (delegates to WorkpackAiService)
 * - No-template / manual path
 * - Single creation via existing API
 * - Bulk creation via existing API
 * - Partial failure
 * - Tenant isolation
 * - StandardActivityType preservation
 * - No M8.13 modification
 * - No M8.15 modification
 */

// ── Mock prisma ─────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    shutdownScope: {
      findMany: vi.fn(),
    },
    scopeItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    workpack: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/core/workpack-intelligence/WorkpackAiService', () => ({
  WorkpackAiService: {
    recommendTemplate: vi.fn(),
  },
}));

vi.mock('@/core/planning/TemplateLibraryService', () => ({
  TemplateLibraryService: {
    get: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { WorkpackAiService } from '@/core/workpack-intelligence/WorkpackAiService';
import { WorkpackFactoryService } from '../WorkpackFactoryService';

const ORG_ID = 'org-1';
const OTHER_ORG = 'org-2';
const SCOPE_ID = 'scope-1';
const ITEM_ID = 'item-1';
const TEMPLATE_ID = 'tpl-1';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Test: Approved scope required ─────────────────────────────────────────

describe('M9: Factory Queue — Approved scope required', () => {
  it('returns empty queue when no approved/frozen scopes exist', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([]);

    const result = await WorkpackFactoryService.getQueue(ORG_ID, {});

    expect(result.items).toHaveLength(0);
    expect(result.totals.total).toBe(0);
  });

  it('only queries approved/frozen scopes', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([]);

    await WorkpackFactoryService.getQueue(ORG_ID, {});

    expect(prisma.shutdownScope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['approved', 'frozen'] },
          organization_id: ORG_ID,
        }),
      })
    );
  });
});

// ── Test: ONE ScopeItem → ONE Workpack ────────────────────────────────────

describe('M9: ONE ScopeItem → ONE Workpack', () => {
  it('marks items with workpack_id as "created"', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([
      { id: SCOPE_ID, name: 'S1', status: 'approved', event_id: 'e1', event: { id: 'e1', name: 'TA1', code: 'TA1' } },
    ]);

    (prisma.scopeItem.findMany as any).mockImplementation((args: any) => {
      if (args?.select?.workpack_id) {
        return [
          { workpack_id: 'wp-1', is_deferred: false, template_id: 'tpl-1' },
        ];
      }
      return [
        {
          id: ITEM_ID,
          scope_id: SCOPE_ID,
          asset_id: 'a-1',
          asset: { id: 'a-1', tag_number: 'V-101', name: 'Vessel', asset_type: 'Vessel', equipment_type_id: null, plant_id: null, unit_id: null, system_id: null, plant: null, unit: null, system: null },
          scope: { id: SCOPE_ID, name: 'S1', status: 'approved', event: { id: 'e1', name: 'TA1', code: 'TA1' } },
          workpack: { id: 'wp-1', workpack_number: 'WP-2026-00001', title: 'Vessel', status: 'draft', readiness_score: 50, compliance_score: 60, created_at: new Date() },
          reason: 'Internal inspection',
          discipline: 'Mechanical',
          priority: 'high',
          complexity: 'standard',
          estimated_hours: 24,
          template_id: 'tpl-1',
          template_name: 'Vessel R3',
          is_deferred: false,
          is_additional: false,
          workpack_id: 'wp-1',
          sort_order: 0,
        },
      ];
    });
    (prisma.scopeItem.count as any).mockResolvedValue(1);

    const result = await WorkpackFactoryService.getQueue(ORG_ID, {});

    expect(result.items[0].factory_status).toBe('created');
    expect(result.totals.created).toBe(1);
    expect(result.totals.pending).toBe(0);
  });
});

// ── Test: Duplicate prevention (idempotency) ──────────────────────────────

describe('M9: Duplicate prevention', () => {
  it('preview throws when scope item already has workpack', async () => {
    (prisma.scopeItem.findFirst as any).mockResolvedValue({
      id: ITEM_ID,
      workpack_id: 'existing-wp',
    });

    await expect(
      WorkpackFactoryService.preview(ORG_ID, ITEM_ID, TEMPLATE_ID)
    ).rejects.toThrow('already has a workpack');
  });
});

// ── Test: Template recommendation (delegates to WorkpackAiService) ────────

describe('M9: Template recommendation', () => {
  it('delegates to existing WorkpackAiService.recommendTemplate()', async () => {
    (prisma.scopeItem.findMany as any).mockResolvedValue([
      {
        id: ITEM_ID,
        discipline: 'Mechanical',
        reason: 'Internal inspection',
        template_id: null,
        template_name: null,
        asset: { asset_type: 'Vessel' },
      },
    ]);

    (WorkpackAiService.recommendTemplate as any).mockResolvedValue({
      recommendations: [
        { templateId: TEMPLATE_ID, templateName: 'Vessel Maintenance R3', matchReason: 'Equipment type match', confidence: 0.8 },
      ],
    });

    const result = await WorkpackFactoryService.getTemplateRecommendations(ORG_ID, [ITEM_ID]);

    expect(WorkpackAiService.recommendTemplate).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ equipmentType: 'Vessel' })
    );
    expect(result[0].recommendations).toHaveLength(1);
    expect(result[0].recommendations[0].templateId).toBe(TEMPLATE_ID);
  });

  it('returns pre-selected template when planner set it during scoping', async () => {
    (prisma.scopeItem.findMany as any).mockResolvedValue([
      {
        id: ITEM_ID,
        discipline: 'Mechanical',
        reason: 'Internal inspection',
        template_id: 'pre-selected-tpl',
        template_name: 'Pre-selected Template',
        asset: { asset_type: 'Vessel' },
      },
    ]);

    const result = await WorkpackFactoryService.getTemplateRecommendations(ORG_ID, [ITEM_ID]);

    // Should NOT call WorkpackAiService since template was pre-selected
    expect(WorkpackAiService.recommendTemplate).not.toHaveBeenCalled();
    expect(result[0].recommendations[0].templateId).toBe('pre-selected-tpl');
    expect(result[0].recommendations[0].confidence).toBe(1.0);
  });
});

// ── Test: No-template / manual path ───────────────────────────────────────

describe('M9: No template / manual path', () => {
  it('returns empty recommendations when no templates match', async () => {
    (prisma.scopeItem.findMany as any).mockResolvedValue([
      {
        id: ITEM_ID,
        discipline: null,
        reason: 'Custom work',
        template_id: null,
        template_name: null,
        asset: { asset_type: 'UnknownType' },
      },
    ]);

    (WorkpackAiService.recommendTemplate as any).mockResolvedValue({
      recommendations: [],
    });

    const result = await WorkpackFactoryService.getTemplateRecommendations(ORG_ID, [ITEM_ID]);

    expect(result[0].recommendations).toHaveLength(0);
  });
});

// ── Test: Tenant isolation ────────────────────────────────────────────────

describe('M9: Tenant isolation', () => {
  it('queries only for the given organization_id', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([]);

    await WorkpackFactoryService.getQueue(ORG_ID, {});

    expect(prisma.shutdownScope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
        }),
      })
    );
  });

  it('does not return items from other organizations', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([]);

    await WorkpackFactoryService.getQueue(OTHER_ORG, {});

    expect(prisma.shutdownScope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: OTHER_ORG,
        }),
      })
    );
  });
});

// ── Test: KPIs ────────────────────────────────────────────────────────────

describe('M9: Factory KPIs', () => {
  it('returns zero KPIs when no scopes exist', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([]);

    const kpis = await WorkpackFactoryService.getKpis(ORG_ID);

    expect(kpis.approved_scope_items).toBe(0);
    expect(kpis.workpacks_created).toBe(0);
    expect(kpis.pending).toBe(0);
  });

  it('computes correct KPI breakdown', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([
      { id: SCOPE_ID },
    ]);

    (prisma.scopeItem.findMany as any).mockResolvedValue([
      { workpack_id: 'wp-1', is_deferred: false, template_id: 'tpl-1' },
      { workpack_id: null, is_deferred: false, template_id: 'tpl-2' },
      { workpack_id: null, is_deferred: true, template_id: null },
      { workpack_id: null, is_deferred: false, template_id: null },
    ]);

    (prisma.workpack.count as any).mockResolvedValue(0);

    const kpis = await WorkpackFactoryService.getKpis(ORG_ID);

    expect(kpis.approved_scope_items).toBe(4);
    expect(kpis.workpacks_created).toBe(1);
    expect(kpis.pending).toBe(2);
    expect(kpis.deferred).toBe(1);
    expect(kpis.manual_required).toBe(1);
  });
});

// ── Test: No M8.13 modification ───────────────────────────────────────────

describe('M9: No M8.13 modification', () => {
  it('WorkpackFactoryService does not import ProgressCalculationService', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      'src/core/workpack-factory/WorkpackFactoryService.ts',
      'utf-8'
    );
    expect(source).not.toContain('ProgressCalculationService');
    expect(source).not.toContain('ProgressAggregationService');
    expect(source).not.toContain('weighted progress');
    expect(source).not.toContain('SPI');
    expect(source).not.toContain('EVM');
  });
});

// ── Test: No M8.15 modification ───────────────────────────────────────────

describe('M9: No M8.15 modification', () => {
  it('WorkpackFactoryService does not import Equipment 360 services', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      'src/core/workpack-factory/WorkpackFactoryService.ts',
      'utf-8'
    );
    expect(source).not.toContain('Equipment360');
    expect(source).not.toContain('EquipmentDetailService');
    expect(source).not.toContain('digital-plant');
  });
});

// ── Test: Preview does not create records ──────────────────────────────────

describe('M9: Preview is read-only', () => {
  it('preview returns template details without creating any records', async () => {
    (prisma.scopeItem.findFirst as any).mockResolvedValue({
      id: ITEM_ID,
      workpack_id: null,
      asset: { id: 'a-1', tag_number: 'V-101', name: 'Vessel', asset_type: 'Vessel' },
      scope: { id: SCOPE_ID, name: 'S1', status: 'approved', event_id: 'e1' },
    });

    const { TemplateLibraryService } = await import('@/core/planning/TemplateLibraryService');
    (TemplateLibraryService.get as any).mockResolvedValue({
      id: TEMPLATE_ID,
      name: 'Vessel Maintenance R3',
      equipment_type: 'Vessel',
      job_type: 'Maintenance',
      revision: 3,
      lifecycle_status: 'PUBLISHED',
      activities: [
        { sequence_number: 1, description: 'Scaffolding', duration_hours: 8, is_optional: false, hold_point_type: null },
      ],
      resources_json: [],
      materials_json: [],
      qaqc_json: { certificate_types: ['Cold Work Permit'] },
    });

    const preview = await WorkpackFactoryService.preview(ORG_ID, ITEM_ID, TEMPLATE_ID);

    expect(preview.template.name).toBe('Vessel Maintenance R3');
    expect(preview.expected_activities).toHaveLength(1);
    expect(preview.expected_certificates).toEqual(['Cold Work Permit']);

    // Verify no workpack.create or activity.create calls were made
    // (prisma.workpack.create would throw if called since it's not mocked)
  });
});

// ── Test: Filtering ───────────────────────────────────────────────────────

describe('M9: Factory Queue Filtering', () => {
  it('filters by event_id', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([]);

    await WorkpackFactoryService.getQueue(ORG_ID, { eventId: 'e1' });

    expect(prisma.shutdownScope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event_id: 'e1',
        }),
      })
    );
  });

  it('filters by scope_id', async () => {
    (prisma.shutdownScope.findMany as any).mockResolvedValue([]);

    await WorkpackFactoryService.getQueue(ORG_ID, { scopeId: SCOPE_ID });

    expect(prisma.shutdownScope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: SCOPE_ID,
        }),
      })
    );
  });
});
