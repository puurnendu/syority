import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormInstanceService } from '../FormInstanceService';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { eventBus } from '@/lib/eventBus';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        formTemplate: {
            findFirst: vi.fn(),
        },
        formInstance: {
            create: vi.fn(),
            update: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        workpack: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn((cb) => cb(prisma)),
    },
}));

vi.mock('@/lib/audit', () => ({
    AuditService: {
        log: vi.fn(),
    },
}));

vi.mock('@/lib/eventBus', () => ({
    eventBus: {
        emit: vi.fn(),
    },
}));

describe('FormInstanceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockOrgId = '00000000-0000-0000-0000-000000000001';
    const mockUserId = '00000000-0000-0000-0000-000000000002';
    const mockSiteId = '00000000-0000-0000-0000-000000000003';
    const mockWpId = '00000000-0000-0000-0000-000000000004';

    describe('createFromTemplate', () => {
        it('pins instance to current template version', async () => {
            const mockTemplate = {
                id: 'template-1',
                name: 'Safety Checklist',
                current_version: 5,
                is_active: true,
            };

            vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue(mockTemplate as any);
            vi.mocked(prisma.formInstance.create).mockResolvedValue({ id: 'inst-1' } as any);

            await FormInstanceService.createFromTemplate({
                template_id: 'template-1',
                organization_id: mockOrgId,
                user_id: mockUserId,
                site_id: mockSiteId,
                workpack_id: mockWpId,
            });

            expect(prisma.formInstance.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    template_version: 5,
                }),
            }));
        });
    });

    describe('submit', () => {
        it('validates payload against pinned version and transitions status', async () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    score: { type: 'number', minimum: 10 }
                },
                required: ['score']
            };

            const mockInstance = {
                id: 'inst-1',
                status: 'draft',
                template_version: 1,
                FormTemplate: {
                    schema_json: mockSchema,
                    Versions: [
                        { version_number: 1, schema_json: mockSchema }
                    ]
                }
            };

            vi.mocked(prisma.formInstance.findFirst).mockResolvedValue(mockInstance as any);
            vi.mocked(prisma.formInstance.update).mockResolvedValue({ id: 'inst-1', status: 'submitted' } as any);

            // Valid payload
            await FormInstanceService.submit('inst-1', mockOrgId, { score: 15 }, mockUserId);

            expect(prisma.formInstance.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    status: 'submitted',
                }),
            }));
            expect(eventBus.emit).toHaveBeenCalledWith('form.submitted', expect.anything());

            // Invalid payload
            await expect(FormInstanceService.submit('inst-1', mockOrgId, { score: 5 }, mockUserId))
                .rejects.toThrow(/Validation failed/);
        });
    });

    describe('tenancy isolation', () => {
        it('cannot save draft for instance in another organization', async () => {
            vi.mocked(prisma.formInstance.findFirst).mockResolvedValue(null);

            await expect(FormInstanceService.saveDraft('inst-1', 'wrong-org', {}, mockUserId))
                .rejects.toThrow('Form instance not found');
        });
    });
});
