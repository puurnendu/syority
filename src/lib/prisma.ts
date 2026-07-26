import 'server-only';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set in environment variables');
    }

    const pool = new Pool({
        connectionString,
        max: 20, // Increased to prevent pool exhaustion 
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000, // Increased from 5000 to 30000 to survive Next.js dev compilation pauses
    });

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
}

function getPrisma(): PrismaClient {
    // Always cache on globalThis — including production.
    // The Proxy below calls getPrisma() on every property access; without a
    // singleton each call opens a new pg Pool (max 20) → P2037 connection exhaustion.
    if (globalForPrisma.prisma !== undefined) return globalForPrisma.prisma;
    const client = createPrismaClient();
    globalForPrisma.prisma = client;
    return client;
}

/** Lazy singleton: DB connection created on first use (faster dev startup). */
export const prisma = new Proxy({} as PrismaClient, {
    get(_, prop: string) {
        return (getPrisma() as unknown as Record<string, unknown>)[prop];
    },
});

// ── Soft Delete Convention (Section 5) ──────────────────────────────────────
// Prisma v7 removed the $use() middleware API. Soft-delete is enforced at the
// SERVICE LAYER: every findMany/findFirst must include { deleted_at: null }.
// Every delete must set { deleted_at: new Date() } instead of hard-deleting.
// AuditLog is EXEMPT (append-only, no deleted_at column).

// ⚠️  Never call `new PrismaClient()` anywhere else in the codebase.
//     Always import from this file: import { prisma } from '@/lib/prisma'
