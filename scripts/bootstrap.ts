#!/usr/bin/env tsx
/**
 * Aurianoa OS — Deployment Bootstrap
 *
 * Single command to bring a fresh or existing database to a fully seeded state.
 *
 *   npm run bootstrap
 *
 * Steps:
 *   1. prisma migrate deploy
 *   2. prisma generate
 *   3. npm run seed
 *   4. npm run seed:superadmin
 *   5. npm run seed:platform-admin
 *   6. npm run seed:syority
 *   7. Verify Organization exists
 *   8. Verify User exists
 *   9. Print login credentials
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { Pool } from 'pg';

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[bootstrap] ${msg}`);
}

function fail(msg: string): never {
  console.error(`[bootstrap] ❌ ${msg}`);
  process.exit(1);
}

function run(cmd: string) {
  log(`$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', env: process.env });
  } catch (err: any) {
    fail(`Command failed: ${cmd}\n${err.message || err}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail('DATABASE_URL is not set. Add it to .env or pass via environment.');
  }

  log('═══════════════════════════════════════════');
  log('  Aurianoa OS — Deployment Bootstrap');
  log('═══════════════════════════════════════════\n');

  // Step 1: Migrate
  log('Step 1/6: Applying database migrations...');
  run('npx prisma migrate deploy');

  // Step 2: Generate
  log('Step 2/6: Generating Prisma client...');
  run('npx prisma generate');

  // Step 3: Main seed (creates platform org + admin + notification templates + report builder)
  log('Step 3/6: Running main seed...');
  run('npm run seed');

  // Step 4: Superadmin
  log('Step 4/6: Seeding superadmin...');
  run('npm run seed:superadmin');

  // Step 5: Platform admin
  log('Step 5/6: Seeding platform admin...');
  run('npm run seed:platform-admin');

  // Step 6: SYORITY Corporation
  log('Step 6/6: Seeding SYORITY Corporation...');
  run('npm run seed:syority');

  // ── Verification ─────────────────────────────────────────────────────────

  log('\nVerifying deployment...');

  const pool = new Pool({ connectionString: url });

  try {
    // Check Organization
    const orgResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM "Organization" WHERE deleted_at IS NULL`
    );
    const orgCount = orgResult.rows[0]?.count ?? 0;
    if (orgCount === 0) {
      fail('No organizations found after seeding. Check seed output above.');
    }
    log(`✅ Organizations: ${orgCount}`);

    // Check User
    const userResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM "User" WHERE is_active = true`
    );
    const userCount = userResult.rows[0]?.count ?? 0;
    if (userCount === 0) {
      fail('No users found after seeding. Check seed output above.');
    }
    log(`✅ Users: ${userCount}`);

    // Print credentials
    const email = process.env.PLATFORM_ADMIN_EMAIL || 'info@syority.com';
    const password = process.env.PLATFORM_ADMIN_PASSWORD || 'Admin@123';

    log('\n═══════════════════════════════════════════');
    log('  ✅ Bootstrap Complete');
    log('═══════════════════════════════════════════');
    log(`  Organizations: ${orgCount}`);
    log(`  Active Users:  ${userCount}`);
    log('');
    log('  Platform Admin Login:');
    log(`    Email:    ${email}`);
    log(`    Password: ${password}`);
    log('    ⚠️  Password change required on first login.');
    log('');
    log('  Superadmin Login:');
    log('    Email:    superadmin@aurianoa.com');
    log('    Password: Admin@123');
    log('═══════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[bootstrap] Fatal error:', err);
  process.exit(1);
});
