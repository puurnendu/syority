import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { getPresignedPutUrl, getSignedDownloadUrl, deleteFile } from '@/lib/storage/storageClient';
import crypto from 'crypto';

const ALLOWED_MIMES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'video/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export interface AttachmentParent {
    type: string;
    id: string;
}

export class AttachmentService {
    /**
     * Validate a file upload against allowlist and tenant limits.
     */
    static async validateUpload(organizationId: string, mimeType: string, sizeBytes: number) {
        if (!ALLOWED_MIMES.includes(mimeType)) {
            throw new Error(`Unsupported file type: ${mimeType}`);
        }

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true }
        });
        const settings = (org?.settings as any) || {};
        const maxSize = settings.max_file_size || DEFAULT_MAX_SIZE;

        if (sizeBytes > maxSize) {
            throw new Error(`File too large. Maximum allowed size is ${maxSize / (1024 * 1024)}MB`);
        }
    }

    /**
     * Generate a presigned URL for uploading a file.
     */
    static async getUploadUrl(input: {
        organizationId: string;
        siteId?: string;
        parent: AttachmentParent;
        filename: string;
        mimeType: string;
        sizeBytes: number;
    }) {
        // 1. Validate
        await this.validateUpload(input.organizationId, input.mimeType, input.sizeBytes);

        // 3. Generate Unique Key
        const fileExt = input.filename.split('.').pop()?.toLowerCase() || 'bin';
        const storedFilename = `${crypto.randomUUID()}.${fileExt}`;
        const key = `uploads/${input.organizationId}/${input.parent.type}/${input.parent.id}/${storedFilename}`;

        // 4. Get Presigned URL
        const url = await getPresignedPutUrl(key, input.mimeType);

        return {
            url,
            key,
            expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
            storedFilename,
        };
    }

    /**
     * Confirm upload and persist attachment record.
     */
    static async confirm(input: {
        organizationId: string;
        siteId?: string;
        key: string;
        parent: AttachmentParent;
        originalFilename: string;
        storedFilename: string;
        mimeType: string;
        sizeBytes: number;
        uploadedBy: string;
        category?: string;
        description?: string;
    }) {
        // 1. Antivirus Hook (Stub)
        const isClean = await this.clamavScan(input.key);
        if (!isClean) throw new Error('File failed security scan');

        // 2. Persist Attachment
        const attachment = await prisma.attachment.create({
            data: {
                id: crypto.randomUUID(),
                organization_id: input.organizationId,
                site_id: input.siteId,
                reference_type: input.parent.type,
                reference_id: input.parent.id,
                original_filename: input.originalFilename,
                stored_filename: input.storedFilename,
                storage_path: input.key,
                storage_disk: process.env.STORAGE_PROVIDER || 'local',
                mime_type: input.mimeType,
                file_size_bytes: BigInt(input.sizeBytes),
                file_extension: input.originalFilename.split('.').pop()?.toLowerCase(),
                category: input.category,
                description: input.description,
                created_by: input.uploadedBy,
                updated_at: new Date(),
            }
        });

        // 3. Audit
        await AuditService.log({
            organization_id: input.organizationId,
            user_id: input.uploadedBy,
            action: 'created',
            model_name: 'Attachment',
            model_id: attachment.id,
            new_values: attachment,
            site_id: input.siteId,
        });

        return attachment;
    }

    /**
     * Get a presigned download URL.
     */
    static async getDownloadUrl(id: string, organizationId: string, userId: string) {
        const attachment = await prisma.attachment.findFirst({
            where: { id, organization_id: organizationId, deleted_at: null }
        });

        if (!attachment) throw new Error('Attachment not found');

        const url = await getSignedDownloadUrl(attachment.storage_path);

        // Audit download
        await AuditService.log({
            organization_id: organizationId,
            user_id: userId,
            action: 'downloaded',
            model_name: 'Attachment',
            model_id: id,
            site_id: attachment.site_id || undefined,
        });

        return { url, filename: attachment.original_filename };
    }

    /**
     * Soft delete an attachment.
     */
    static async delete(id: string, organizationId: string, userId: string) {
        const attachment = await prisma.attachment.findFirst({
            where: { id, organization_id: organizationId, deleted_at: null }
        });

        if (!attachment) throw new Error('Attachment not found');

        const updated = await prisma.attachment.update({
            where: { id },
            data: { deleted_at: new Date() }
        });

        // Optional: Physical delete from S3? Usually we keep it for a while.
        // await deleteFile(attachment.storage_path);

        // Audit delete
        await AuditService.log({
            organization_id: organizationId,
            user_id: userId,
            action: 'deleted',
            model_name: 'Attachment',
            model_id: id,
            old_values: attachment,
            site_id: attachment.site_id || undefined,
        });

        return updated;
    }

    /**
     * List attachments by parent.
     */
    static async listByParent(parent: AttachmentParent, organizationId: string) {
        return prisma.attachment.findMany({
            where: {
                reference_type: parent.type,
                reference_id: parent.id,
                organization_id: organizationId,
                deleted_at: null
            },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * Antivirus scan (Stub).
     */
    private static async clamavScan(key: string): Promise<boolean> {
        // Placeholder for real ClamAV/antivirus integration
        console.log(`[Antivirus] Scanning file: ${key} - CLEAN`);
        return true;
    }
}
