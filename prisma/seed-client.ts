/**
 * Shared Prisma client for seed & migration scripts.
 *
 * Why not reuse src/lib/prisma.ts?
 *   That module uses `import 'server-only'` (Next.js runtime only).
 *   Seed scripts run via `tsx` outside Next.js, so they need their own
 *   adapter-compatible client with the same Pool → PrismaPg → PrismaClient
 *   pattern, minus the server-only guard.
 *
 * Usage:
 *   import { prisma, verifyDatabase, disconnect } from './seed-client';
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// ── Validate DATABASE_URL ────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString || typeof connectionString !== 'string') {
  console.error('❌ DATABASE_URL is not set or invalid.');
  console.error('   Set it in your .env file or pass via environment.');
  process.exit(1);
}

// ── Create adapter-compatible PrismaClient ───────────────────────────────────

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

// ── Database verification ────────────────────────────────────────────────────

/**
 * Verify database connectivity and that core tables exist.
 * Call this before seeding to fail fast with a descriptive error.
 */
export async function verifyDatabase(): Promise<void> {
  // 1. Connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    console.error('❌ Database connection failed.');
    console.error(`   ${err.message}`);
    console.error('   Check DATABASE_URL and ensure PostgreSQL is running.');
    process.exit(1);
  }

  // 2. Core tables
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('Organization', 'User')
    ORDER BY table_name
  `;
  const names = tables.map((t) => t.table_name);

  if (!names.includes('Organization')) {
    console.error('❌ "Organization" table not found.');
    console.error('   Run migrations first: npx prisma migrate deploy');
    process.exit(1);
  }
  if (!names.includes('User')) {
    console.error('❌ "User" table not found.');
    console.error('   Run migrations first: npx prisma migrate deploy');
    process.exit(1);
  }
}

// ── Disconnect helper ────────────────────────────────────────────────────────

/**
 * Cleanly disconnect Prisma and drain the pg pool.
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}
