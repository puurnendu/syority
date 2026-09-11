/**
 * P&ID extraction — upload → AI job+result → human accept → Asset/LineList records.
 * Mocks Vision AI; uses live Prisma with explicit cleanup.
 */
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { extractFromPAndId } from '@/services/ai/PAndIdExtractor';

vi.mock('@/services/ai/VisionAiService', () => ({
  callVisionAi: vi.fn(async () => ({
    content: JSON.stringify({
      drawing_number: 'DWG-TEST-001',
      drawing_title: 'Test P&ID',
      revision: 'A',
      unit_area: 'U-100',
      items: [
        {
          item_type: 'equipment',
          tag_number: 'E-9001',
          description: 'Test Exchanger',
          confidence: 'high',
          source_page: 1,
        },
        {
          item_type: 'line',
          tag_number: '6"-FW-9001-A1A',
          description: 'Feed line',
          confidence: 'medium',
          source_page: 1,
        },
      ],
    }),
    input_tokens: 100,
    output_tokens: 200,
  })),
  parseVisionJson: (content: string) => JSON.parse(content),
}));

vi.mock('@/services/ai/PdfProcessor', () => ({
  renderPagesAsImages: vi.fn(async () => [
    {
      page_number: 1,
      image_base64: 'iVBORw0KGgo=',
      width: 100,
      height: 100,
    },
  ]),
  getPdfPageCount: vi.fn(async () => 1),
}));

const guardState = vi.hoisted(() => ({
  session: { user: { id: '', organization_id: '' } } as { user: { id: string; organization_id: string } },
}));

vi.mock('@/lib/apiGuard', () => ({
  guardApi: vi.fn(async () => ({ error: null, session: guardState.session })),
  orgScope: (session: { user: { id: string; organization_id: string } }) => ({
    orgId: session.user.organization_id,
    userId: session.user.id,
  }),
}));

import { POST as acceptPOST } from '../app/api/asset-register/extract-pid/[jobId]/accept/route';

let anchor: { orgId: string; siteId: string; userId: string; unitId: string };
const cleanup = {
  jobIds: [] as string[],
  assetIds: [] as string[],
  lineIds: [] as string[],
};

beforeAll(async () => {
  const unit = await prisma.unit.findFirst({
    where: { deleted_at: null },
    select: { id: true, organization_id: true, site_id: true },
    orderBy: { created_at: 'asc' },
  });
  const user = unit
    ? await prisma.user.findFirst({
        where: { organization_id: unit.organization_id },
        select: { id: true },
      })
    : null;
  if (!unit || !user) {
    throw new Error('pid-extraction test requires at least one Unit and User.');
  }
  anchor = {
    orgId: unit.organization_id,
    siteId: unit.site_id,
    userId: user.id,
    unitId: unit.id,
  };
  guardState.session = { user: { id: user.id, organization_id: unit.organization_id } };

  await prisma.asset.deleteMany({
    where: { organization_id: unit.organization_id, tag_number: 'E-9001' },
  });
  await prisma.line_lists.deleteMany({
    where: { organization_id: unit.organization_id, line_number: '6"-FW-9001-A1A' },
  });
});

afterEach(async () => {
  if (cleanup.lineIds.length) {
    await prisma.line_lists.deleteMany({ where: { id: { in: cleanup.lineIds } } });
    cleanup.lineIds = [];
  }
  if (cleanup.assetIds.length) {
    await prisma.asset.deleteMany({ where: { id: { in: cleanup.assetIds } } });
    cleanup.assetIds = [];
  }
  if (cleanup.jobIds.length) {
    await prisma.aiExtractionResult.deleteMany({
      where: { ai_extraction_job_id: { in: cleanup.jobIds } },
    });
    await prisma.aiExtractionJob.deleteMany({ where: { id: { in: cleanup.jobIds } } });
    cleanup.jobIds = [];
  }
});

describe('P&ID extraction E2E', () => {
  it('extract → result row → accept creates Asset and LineList', async () => {
    const dir = join(process.cwd(), 'tests', 'fixtures');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const fixturePath = join(dir, 'sample-pid.png');
    await writeFile(fixturePath, Buffer.from('fake-png-content'));

    const extraction = await extractFromPAndId(
      anchor.orgId,
      anchor.siteId,
      anchor.unitId,
      randomUUID(),
      fixturePath,
      [1],
      anchor.userId,
      'image/png'
    );
    cleanup.jobIds.push(extraction.job_id);

    expect(extraction.items.length).toBe(2);
    expect(extraction.equipment_count).toBe(1);

    const resultRow = await prisma.aiExtractionResult.findUnique({
      where: { ai_extraction_job_id: extraction.job_id },
    });
    expect(resultRow).not.toBeNull();
    const data = resultRow!.extracted_data_json as { items: unknown[] };
    expect(Array.isArray(data.items)).toBe(true);

    const acceptRes = await acceptPOST(
      new Request('http://localhost/api/asset-register/extract-pid/x/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: anchor.unitId,
          accepted_tags: ['E-9001'],
          accepted_lines: ['6"-FW-9001-A1A'],
        }),
      }),
      { params: Promise.resolve({ jobId: extraction.job_id }) }
    );
    const acceptBody = await acceptRes.json();
    expect(acceptRes.status).toBe(200);
    expect(acceptBody.assets_created).toBe(1);
    expect(acceptBody.lines_created).toBe(1);

    const asset = await prisma.asset.findFirst({
      where: { organization_id: anchor.orgId, tag_number: 'E-9001' },
    });
    const line = await prisma.line_lists.findFirst({
      where: { organization_id: anchor.orgId, line_number: '6"-FW-9001-A1A' },
    });
    expect(asset).not.toBeNull();
    expect(line).not.toBeNull();
    if (asset) cleanup.assetIds.push(asset.id);
    if (line) cleanup.lineIds.push(line.id);

    const acceptAgain = await acceptPOST(
      new Request('http://localhost/api/asset-register/extract-pid/x/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: anchor.unitId,
          accepted_tags: ['E-9001'],
          accepted_lines: ['6"-FW-9001-A1A'],
        }),
      }),
      { params: Promise.resolve({ jobId: extraction.job_id }) }
    );
    const againBody = await acceptAgain.json();
    expect(againBody.skipped).toBe(2);
    expect(againBody.skipped_tags).toContain('E-9001');
  });

  it('multi-tile image paths are sent through one extraction job', async () => {
    const dir = join(process.cwd(), 'tests', 'fixtures');
    const tileA = join(dir, 'sample-pid-tile-a.png');
    const tileB = join(dir, 'sample-pid-tile-b.png');
    await writeFile(tileA, Buffer.from('fake-png-a'));
    await writeFile(tileB, Buffer.from('fake-png-b'));

    const { callVisionAi } = await import('@/services/ai/VisionAiService');

    const extraction = await extractFromPAndId(
      anchor.orgId,
      anchor.siteId,
      anchor.unitId,
      randomUUID(),
      [tileA, tileB],
      [1],
      anchor.userId,
      'image/png'
    );
    cleanup.jobIds.push(extraction.job_id);

    expect(vi.mocked(callVisionAi)).toHaveBeenCalled();
    const visionArgs = vi.mocked(callVisionAi).mock.calls.at(-1)?.[0];
    expect(visionArgs?.images?.length).toBe(2);
    expect(extraction.items.length).toBeGreaterThan(0);
  });

  it('accept creates valve assets with asset_type valve', async () => {
    const { callVisionAi } = await import('@/services/ai/VisionAiService');
    vi.mocked(callVisionAi).mockResolvedValueOnce({
      content: JSON.stringify({
        drawing_number: 'DWG-VLV',
        drawing_title: 'Valve test',
        revision: null,
        unit_area: null,
        items: [
          {
            item_type: 'valve',
            tag_number: 'FV-9002',
            description: 'Flow control valve',
            confidence: 'high',
            source_page: 1,
          },
        ],
      }),
      input_tokens: 50,
      output_tokens: 80,
    });

    const dir = join(process.cwd(), 'tests', 'fixtures');
    const fixturePath = join(dir, 'sample-pid-valve.png');
    await writeFile(fixturePath, Buffer.from('fake-valve-png'));

    const extraction = await extractFromPAndId(
      anchor.orgId,
      anchor.siteId,
      anchor.unitId,
      randomUUID(),
      fixturePath,
      [1],
      anchor.userId,
      'image/png'
    );
    cleanup.jobIds.push(extraction.job_id);

    await prisma.asset.deleteMany({
      where: { organization_id: anchor.orgId, tag_number: 'FV-9002' },
    });

    const acceptRes = await acceptPOST(
      new Request('http://localhost/api/asset-register/extract-pid/x/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: anchor.unitId,
          accepted_tags: ['FV-9002'],
          accepted_lines: [],
        }),
      }),
      { params: Promise.resolve({ jobId: extraction.job_id }) }
    );
    const acceptBody = await acceptRes.json();
    expect(acceptRes.status).toBe(200);
    expect(acceptBody.assets_created).toBe(1);

    const asset = await prisma.asset.findFirst({
      where: { organization_id: anchor.orgId, tag_number: 'FV-9002' },
    });
    expect(asset?.asset_type).toBe('valve');
    expect(asset?.data_source).toBe('p_and_id');
    if (asset) cleanup.assetIds.push(asset.id);
  });
});
