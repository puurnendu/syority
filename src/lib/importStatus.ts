import { redis } from './redis';

/**
 * Project Import Status Reporting
 * 
 * Simple key-value status tracking in Redis for long-running imports.
 */

const KEY_PREFIX = 'import_status:';

export async function setImportStatus(projectId: string, userId: string, message: string) {
    const key = `${KEY_PREFIX}${projectId}:${userId}`;
    // Set status with a 5-minute expiration (it's temporary anyway)
    await redis.set(key, message, 'EX', 300);
}

export async function getImportStatus(projectId: string, userId: string): Promise<string | null> {
    const key = `${KEY_PREFIX}${projectId}:${userId}`;
    return await redis.get(key);
}

export async function clearImportStatus(projectId: string, userId: string) {
    const key = `${KEY_PREFIX}${projectId}:${userId}`;
    await redis.del(key);
}
