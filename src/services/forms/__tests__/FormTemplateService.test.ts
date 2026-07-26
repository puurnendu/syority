import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormTemplateService } from '../FormTemplateService';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        formTemplate: {
            create: vi.fn(),
            update: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        formTemplateVersion: {
            create: vi.fn(),
            findFirst: vi.fn(),
        },
        $transaction: vi.fn((cb) => cb(prisma)),
    },
}));

vi.mock('@/lib/audit', () => ({
    AuditService: {
        log: vi.fn(),
    },
}));

describe('FormTemplateService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockOrgId = '00000000-0000-0000-0000-000000000001';
    const mockUserId = '00000000-0000-0000-0000-000000000002';

    describe('create', () => {
        it('creates a template and initial version with valid schema', async () => {
            const input = {
                organization_id: mockOrgId,
                name: 'Test Form',
                slug: 'test-form',
                form_type: 'checklist',
                schema_json: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    }
                },
                created_by: mockUserId,
            };

            const mockTemplate = { id: 'template-1', ...input, current_version: 1 };
            vi.mocked(prisma.formTemplate.create).mockResolvedValue(mockTemplate as any);

            const result = await FormTemplateService.create(input);

            expect(result).toEqual(mockTemplate);
            expect(prisma.formTemplate.create).toHaveBeenCalled();
            expect(prisma.formTemplateVersion.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    version_number: 1,
                })
            }));
            expect(AuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'created',
                model_name: 'FormTemplate',
            }));
        });

        it('throws error for invalid JSON Schema', async () => {
            const input = {
                organization_id: mockOrgId,
                name: 'Test Form',
                slug: 'test-form',
                form_type: 'checklist',
                schema_json: {
                    type: 'invalid-type' // Invalid JSON Schema type
                },
                created_by: mockUserId,
            };

            await expect(FormTemplateService.create(input as any)).rejects.toThrow(/Invalid JSON Schema/);
        });
    });

    describe('update', () => {
        it('increments version and creates new Version record', async () => {
            const currentTemplate = {
                id: 'template-1',
                organization_id: mockOrgId,
                current_version: 1,
                schema_json: {},
            };

            vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue(currentTemplate as any);
            vi.mocked(prisma.formTemplate.update).mockResolvedValue({ ...currentTemplate, current_version: 2 } as any);

            const result = await FormTemplateService.update('template-1', mockOrgId, { name: 'New Name' }, mockUserId);

            expect(result.current_version).toBe(2);
            expect(prisma.formTemplateVersion.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    version_number: 2,
                })
            }));
        });
    });

    describe('tenancy isolation', () => {
        it('cannot update a template from another organization', async () => {
            vi.mocked(prisma.formTemplate.findFirst).mockResolvedValue(null); // Not found in this org

            await expect(FormTemplateService.update('template-1', 'other-org', {}, mockUserId))
                .rejects.toThrow('Form template not found');
        });
    });
});
