import path from 'path';
import { existsSync } from 'fs';

/**
 * Resolves a document storage path by checking multiple possible base directories.
 * This handles inconsistencies between database records and physical disk layout (Windows/Linux).
 * 
 * @param storagePath The path stored in the database (e.g., 'workpacks/uuid/file.pdf')
 * @returns The absolute path to the file if found, or null if all checks fail.
 */
export function resolveDocumentPath(storagePath: string | null | undefined): string | null {
    if (!storagePath) return null;

    // Clean up slashes for consistent mapping
    const normalized = storagePath.replace(/\\/g, '/');
    
    const candidatePaths = [
        // 1. Literal path (absolute or relative to process.cwd)
        path.resolve(process.cwd(), normalized),
        
        // 2. Prefixed with /uploads/ (Common in Syority)
        path.resolve(process.cwd(), 'uploads', normalized),
        
        // 3. Prefixed with /public/uploads/ (Common in Next.js public assets)
        path.resolve(process.cwd(), 'public', 'uploads', normalized),
        
        // 4. If path actually starts with 'workpacks/', try stripping it or just checking uploads root
        normalized.startsWith('workpacks/') 
            ? path.resolve(process.cwd(), 'uploads', normalized)
            : null
    ].filter((p): p is string => !!p);

    // Remove duplicates
    const uniqueCandidates = Array.from(new Set(candidatePaths));

    for (const p of uniqueCandidates) {
        console.log(`[DocumentResolver] Attempting: ${p}`);
        if (existsSync(p)) {
            return p;
        }
    }

    return null;
}
