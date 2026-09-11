/**
 * M14-R2: Tenant and Event Isolation Automated Test Suite
 *
 * Verifies strict server-side multi-tenant and event isolation boundaries:
 *   1. same tenant + same event → PASS
 *   2. different tenant → DENY
 *   3. same tenant + different event → DENY
 *   4. missing/invalid organization → DENY
 *   5. unauthorized event → DENY
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerationService } from '@/core/report-builder/ReportGenerationService';
import { prisma } from '@/lib/prisma';
import { providerRegistry } from '../ProviderRegistry';
import '../index';

describe('M14-R2 Tenant and Event Isolation Enforcement', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const eventA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eventB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const defPublicId = 'dddddddd-1111-1111-1111-111111111111';
  const defOrgAId = 'dddddddd-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockPublicDefinition = {
    id: defPublicId,
    name: 'Public Lookahead',
    slug: 'public-lookahead',
    data_source_key: 'planning.lookahead_24h',
    organization_id: null, // platform-wide
    default_layout_id: null,
    subject_template: null,
    filename_template: null,
    supports_ai_summary: false,
    category: { name: 'Planning' },
    sections: [
      { id: 'sec-1', key: 'kpis', name: 'KPIs', section_type: 'kpi_cards', is_default: true, is_required: true, sort_order: 1 },
    ],
  };

  const mockOrgADefinition = {
    id: defOrgAId,
    name: 'Org A Custom Report',
    slug: 'org-a-custom',
    data_source_key: 'planning.critical_activities',
    organization_id: orgA, // strictly Org A
    default_layout_id: null,
    subject_template: null,
    filename_template: null,
    supports_ai_summary: false,
    category: { name: 'Planning' },
    sections: [
      { id: 'sec-2', key: 'table', name: 'Table', section_type: 'table', is_default: true, is_required: true, sort_order: 1 },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario 1: same tenant + same event → PASS', async () => {
    const genId = '33333333-3333-3333-3333-333333333333';
    const userId = '44444444-4444-4444-4444-444444444444';
    // Setup Prisma mocks
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockOrgADefinition as any);
    vi.spyOn(prisma.event, 'findFirst').mockResolvedValue({ id: eventA, organization_id: orgA } as any);
    vi.spyOn(prisma.report_generations, 'create').mockResolvedValue({ id: genId } as any);
    vi.spyOn(prisma.report_generations, 'update').mockResolvedValue({ id: genId } as any);
    vi.spyOn(prisma.report_artifacts, 'create').mockResolvedValue({ id: '55555555-5555-5555-5555-555555555555' } as any);
    vi.spyOn(providerRegistry, 'fetch').mockResolvedValue({ rows: [{ activity: 'A-101' }], kpis: [{ label: 'Total', value: 1 }] });

    const result = await ReportGenerationService.generate({
      definitionId: defOrgAId,
      organizationId: orgA,
      generatedBy: userId,
      outputFormat: 'html',
      parameters: { event: eventA },
    });

    expect(result.status).toBe('completed');
    expect(result.error).toBeUndefined();
    expect(result.generationId).toBe(genId);
  });

  it('Scenario 2: different tenant → DENY', async () => {
    // Org B attempts to generate Org A's report definition
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockOrgADefinition as any);

    const result = await ReportGenerationService.generate({
      definitionId: defOrgAId,
      organizationId: orgB,
      generatedBy: 'user-b-1',
      outputFormat: 'html',
      parameters: { event: eventB },
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Unauthorized');
    expect(result.error).toContain('does not have access to report definition');
  });

  it('Scenario 3: same tenant + different event → DENY', async () => {
    // Org A requests Event B (which belongs to Org B)
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockPublicDefinition as any);
    vi.spyOn(prisma.event, 'findFirst').mockResolvedValue(null); // Event B does not belong to Org A

    const result = await ReportGenerationService.generate({
      definitionId: defPublicId,
      organizationId: orgA,
      generatedBy: 'user-a-1',
      outputFormat: 'html',
      parameters: { event: eventB },
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Unauthorized or invalid event');
    expect(result.error).toContain(eventB);
  });

  it('Scenario 4: missing/invalid organization → DENY', async () => {
    const result = await ReportGenerationService.generate({
      definitionId: defPublicId,
      organizationId: '', // Empty organization ID
      generatedBy: 'user-anon',
      outputFormat: 'html',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Missing required organization ID');
  });

  it('Scenario 5: unauthorized event → DENY', async () => {
    // User provides an event that is deleted or does not exist
    vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockPublicDefinition as any);
    vi.spyOn(prisma.event, 'findFirst').mockResolvedValue(null);

    const result = await ReportGenerationService.generate({
      definitionId: defPublicId,
      organizationId: orgA,
      generatedBy: 'user-a-1',
      outputFormat: 'html',
      parameters: { event: 'unauthorized-or-deleted-event' },
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Unauthorized or invalid event');
  });
});
