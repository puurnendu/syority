import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
import { AttachmentService } from '../AttachmentService';
import { prisma } from '@/lib/prisma';
import * as storageClient from '@/lib/storage/storageClient';
import { randomUUID } from 'crypto';

vi.mock('@/lib/storage/storageClient', () => ({
    getPresignedPutUrl: vi.fn(),
    getSignedDownloadUrl: vi.fn(),
    deleteFile: vi.fn(),
    BUCKET: 'test-bucket'
}));

describe('AttachmentService', () => {
    const orgId = randomUUID();
    const userId = randomUUID();
    const parentId = randomUUID();

    beforeEach(async () => {
        vi.clearAllMocks();
        // Ensure org exists for settings check
        await prisma.organization.upsert({
            where: { id: orgId },
            create: { id: orgId, name: 'Test Org', updated_at: new Date() },
            update: {}
        });
    });

    it('runs the full attachment lifecycle', async () => {
        // 1. Get Upload URL
        vi.mocked(storageClient.getPresignedPutUrl).mockResolvedValue('http://mock-s3.com/upload');
        
        const uploadResult = await AttachmentService.getUploadUrl({
            organizationId: orgId,
            parent: { type: 'workpack', id: parentId },
            filename: 'test.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
        });

        expect(uploadResult.url).toBe('http://mock-s3.com/upload');
        expect(uploadResult.key).toContain(parentId);

        // 2. Confirm Upload
        const attachment = await AttachmentService.confirm({
            organizationId: orgId,
            key: uploadResult.key,
            parent: { type: 'workpack', id: parentId },
            originalFilename: 'test.pdf',
            storedFilename: uploadResult.storedFilename,
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            uploadedBy: userId,
        });

        expect(attachment.original_filename).toBe('test.pdf');
        expect(attachment.reference_id).toBe(parentId);

        // 3. Get Download URL
        vi.mocked(storageClient.getSignedDownloadUrl).mockResolvedValue('http://mock-s3.com/download');
        const downloadResult = await AttachmentService.getDownloadUrl(attachment.id, orgId, userId);
        expect(downloadResult.url).toBe('http://mock-s3.com/download');

        // 4. List
        const list = await AttachmentService.listByParent({ type: 'workpack', id: parentId }, orgId);
        expect(list.length).toBe(1);

        // 5. Delete
        await AttachmentService.delete(attachment.id, orgId, userId);
        const deleted = await prisma.attachment.findUnique({ where: { id: attachment.id } });
        expect(deleted?.deleted_at).not.toBeNull();
    });

    it('rejects unsupported mime types', async () => {
        await expect(AttachmentService.getUploadUrl({
            organizationId: orgId,
            parent: { type: 'workpack', id: parentId },
            filename: 'test.exe',
            mimeType: 'application/x-msdownload',
            sizeBytes: 1024,
        })).rejects.toThrow('Unsupported file type');
    });

    it('rejects oversized files', async () => {
        await expect(AttachmentService.getUploadUrl({
            organizationId: orgId,
            parent: { type: 'workpack', id: parentId },
            filename: 'huge.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 100 * 1024 * 1024, // 100MB
        })).rejects.toThrow('File too large');
    });
});
