/**
 * M8.10 — Create EvmSnapshot table
 *
 * This script creates the EvmSnapshot table for EVM time-phased cost persistence.
 * Follows the same direct-SQL pattern used for M8.8/M8.9 tables.
 *
 * Usage: npx tsx --env-file=.env prisma/create-evm-snapshot-table.ts
 */

import { prisma, verifyDatabase, disconnect } from './seed-client';

async function main() {
  console.log('🔧 M8.10 — Creating EvmSnapshot table...');
  await verifyDatabase();

  // Check if table already exists
  const exists = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'EvmSnapshot'`
  );

  if (exists.length > 0) {
    console.log('✅ EvmSnapshot table already exists — skipping creation.');
    await disconnect();
    return;
  }

  // Create the EvmSnapshot table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "EvmSnapshot" (
      "id"              UUID        NOT NULL PRIMARY KEY,
      "organization_id" UUID        NOT NULL,
      "event_id"        UUID        NOT NULL,
      "snapshot_date"   TIMESTAMP   NOT NULL,
      "snapshot_type"   TEXT        NOT NULL,
      "curve_data"      JSONB       NOT NULL DEFAULT '{}',
      "summary"         JSONB       NOT NULL DEFAULT '{}',
      "created_at"      TIMESTAMP   NOT NULL DEFAULT NOW()
    );
  `);
  console.log('  ✅ Table created.');

  // Create indexes
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "EvmSnapshot_event_id_snapshot_date_idx" ON "EvmSnapshot" ("event_id", "snapshot_date");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "EvmSnapshot_organization_id_idx" ON "EvmSnapshot" ("organization_id");
  `);
  console.log('  ✅ Indexes created.');

  console.log('');
  console.log('✅ M8.10 EvmSnapshot table created successfully.');

  await disconnect();
}

main().catch(async (e) => {
  console.error('❌ Failed to create EvmSnapshot table:', e);
  await disconnect();
  process.exit(1);
});
