/**
 * M16-R1 Entity Resolution Tests (ER1–ER8)
 *
 * Tests equipment, workpack, activity resolution with event scoping,
 * ambiguity detection, and DbMatcher bypass prohibition.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    asset: { findMany: vi.fn() },
    workpack: { findMany: vi.fn() },
    activity: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  resolveEquipment,
  resolveWorkpacks,
  resolveActivity,
  resolveEntityChain,
} from '../entity/M16EntityResolver';
import type { M16InteractionContext } from '../types';

function makeCtx(overrides: Partial<M16InteractionContext> = {}): M16InteractionContext {
  return Object.freeze({
    organizationId: 'org-A',
    userId: 'user-1',
    channel: 'whatsapp' as const,
    conversationId: 'conv-1',
    eventId: 'event-TA2027',
    identitySource: 'phone_number' as const,
    siteId: 'site-1',
    messageId: 'msg-1',
    ...overrides,
  });
}

describe('M16-R1 Entity Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ER1: Equipment resolution
  it('ER1 — resolves equipment by tag number', async () => {
    (prisma.asset.findMany as any).mockResolvedValue([
      { id: 'asset-1', tag_number: 'HX-204', name: 'Heat Exchanger 204', unit_id: 'unit-1' },
    ]);

    const result = await resolveEquipment(makeCtx(), 'HX-204');

    expect(result.outcome).toBe('RESOLVED');
    expect(result.assetId).toBe('asset-1');
    expect(result.tagNumber).toBe('HX-204');
  });

  // ER2: Workpack resolution
  it('ER2 — resolves workpack for asset in correct event', async () => {
    (prisma.workpack.findMany as any).mockResolvedValue([
      { id: 'wp-042', workpack_number: 'WP-042', title: 'Bundle Pullout',
        event_id: 'event-TA2027', event: { code: 'TA-2027' } },
    ]);

    const result = await resolveWorkpacks(makeCtx(), 'asset-1');

    expect(result.outcome).toBe('RESOLVED');
    expect(result.workpackId).toBe('wp-042');

    // Verify event_id was used in query
    expect(prisma.workpack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-A',
          event_id: 'event-TA2027',
          asset_id: 'asset-1',
        }),
      })
    );
  });

  // ER3: Activity resolution
  it('ER3 — resolves single activity in workpack', async () => {
    (prisma.activity.findMany as any).mockResolvedValue([
      { id: 'act-1', activity_number: 'ACT-001', description: 'Bundle Pullout',
        workpack_id: 'wp-042' },
    ]);

    const result = await resolveActivity(makeCtx(), 'wp-042', 'bundle pullout');

    expect(result.outcome).toBe('RESOLVED');
    expect(result.activityId).toBe('act-1');
    expect(result.description).toBe('Bundle Pullout');
  });

  // ER4: Same equipment in two events — must resolve to correct event
  it('ER4 — same equipment in two events resolves to event-scoped workpack', async () => {
    // For TA-2027
    (prisma.workpack.findMany as any).mockResolvedValue([
      { id: 'wp-042', workpack_number: 'WP-042', title: 'Bundle Pullout TA-2027',
        event_id: 'event-TA2027', event: { code: 'TA-2027' } },
    ]);

    const result2027 = await resolveWorkpacks(
      makeCtx({ eventId: 'event-TA2027' }),
      'asset-1'
    );

    expect(result2027.outcome).toBe('RESOLVED');
    expect(result2027.workpackId).toBe('wp-042');

    // Verify it used event-TA2027 in filter
    expect(prisma.workpack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event_id: 'event-TA2027',
        }),
      })
    );

    vi.clearAllMocks();

    // For TA-2028
    (prisma.workpack.findMany as any).mockResolvedValue([
      { id: 'wp-318', workpack_number: 'WP-318', title: 'Bundle Pullout TA-2028',
        event_id: 'event-TA2028', event: { code: 'TA-2028' } },
    ]);

    const result2028 = await resolveWorkpacks(
      makeCtx({ eventId: 'event-TA2028' }),
      'asset-1'
    );

    expect(result2028.outcome).toBe('RESOLVED');
    expect(result2028.workpackId).toBe('wp-318');

    // Verify it used event-TA2028 in filter
    expect(prisma.workpack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event_id: 'event-TA2028',
        }),
      })
    );
  });

  // ER5: Ambiguous workpack
  it('ER5 — ambiguous workpack returns AMBIGUOUS with candidates', async () => {
    (prisma.workpack.findMany as any).mockResolvedValue([
      { id: 'wp-042', workpack_number: 'WP-042', title: 'Bundle Pullout',
        event_id: 'event-TA2027', event: { code: 'TA-2027' } },
      { id: 'wp-043', workpack_number: 'WP-043', title: 'Tube Inspection',
        event_id: 'event-TA2027', event: { code: 'TA-2027' } },
    ]);

    const result = await resolveWorkpacks(makeCtx(), 'asset-1');

    expect(result.outcome).toBe('AMBIGUOUS');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates![0].id).toBe('wp-042');
    expect(result.candidates![1].id).toBe('wp-043');
  });

  // ER6: Ambiguous activity
  it('ER6 — ambiguous activity returns AMBIGUOUS with candidates', async () => {
    (prisma.activity.findMany as any).mockResolvedValue([
      { id: 'act-1', activity_number: 'ACT-001', description: 'Bundle Pullout', workpack_id: 'wp-042' },
      { id: 'act-2', activity_number: 'ACT-002', description: 'Bundle Re-Install', workpack_id: 'wp-042' },
    ]);

    // No description hint → ambiguous
    const result = await resolveActivity(makeCtx(), 'wp-042');

    expect(result.outcome).toBe('AMBIGUOUS');
    expect(result.candidates).toHaveLength(2);
  });

  // ER7: Controlled discipline resolution
  // (This is a contract test — the actual CVR is tested in its own suite)
  it('ER7 — controlled dimension resolution uses separate DimensionResolver', async () => {
    // Import to verify module separation
    const entityResolver = await import('../entity/M16EntityResolver');
    const dimensionResolver = await import('../entity/DimensionResolver');

    // M16EntityResolver should NOT have discipline resolution
    expect((entityResolver as any).resolveDiscipline).toBeUndefined();
    // DimensionResolver should have discipline resolution
    expect(typeof dimensionResolver.resolveDiscipline).toBe('function');
  });

  // ER8: DbMatcher bypass prohibited
  it('ER8 — M16EntityResolver does NOT import or use DbMatcher', async () => {
    // Read the source file and verify no DbMatcher import in executable code
    const fs = await import('fs');
    const path = await import('path');
    const resolverPath = path.resolve(__dirname, '..', 'entity', 'M16EntityResolver.ts');
    const rawSource = fs.readFileSync(resolverPath, 'utf-8');
    // Strip comments to avoid false positives from doc comments
    const source = rawSource
      .replace(/\/\*\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(source).not.toContain('DbMatcher');
    expect(source).not.toContain('matchToDatabase');
  });

  // Additional: Workpack resolution without event context returns NOT_FOUND
  it('ER_extra — workpack resolution without eventId returns NOT_FOUND', async () => {
    const result = await resolveWorkpacks(
      makeCtx({ eventId: null }),
      'asset-1'
    );

    expect(result.outcome).toBe('NOT_FOUND');
    // Prisma should NOT have been called — no event_id means no query
    expect(prisma.workpack.findMany).not.toHaveBeenCalled();
  });
});
