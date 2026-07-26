/**
 * Docker migrator — runs in the `migrator` image before the app starts.
 *
 * Greenfield: apply baseline SQL, then mark all migration folders applied
 * (pre-baseline folders FK to Organization/User and cannot run first).
 * Existing DB: prisma migrate deploy.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

function log(msg) {
  console.log(`[migrator] ${msg}`);
}

function fail(msg) {
  console.error(`[migrator] ERROR: ${msg}`);
  process.exit(1);
}

function run(cmd, args) {
  log(`$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: false });
  if (r.error) fail(r.error.message);
  if (r.status !== 0) fail(`${cmd} exited ${r.status}`);
}

async function waitForDb(url) {
  log("Waiting for PostgreSQL...");
  for (let i = 1; i <= 60; i++) {
    const c = new Client({ connectionString: url });
    try {
      await c.connect();
      await c.query("SELECT 1");
      await c.end();
      log("Database is ready");
      return;
    } catch (e) {
      try {
        await c.end();
      } catch {
        /* ignore */
      }
      if (i === 60) fail(`Database not ready: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function probeState(url) {
  const c = new Client({ connectionString: url });
  await c.connect();
  let migRows = 0;
  const tables = await c.query(`
    SELECT
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Organization') AS org_count,
      (SELECT COUNT(*)::int FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations') AS mig_table
  `);
  if (tables.rows[0].mig_table > 0) {
    const m = await c.query(
      `SELECT COUNT(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
    );
    migRows = m.rows[0].n;
  }
  await c.end();
  if (tables.rows[0].org_count > 0 || migRows > 0) return "existing";
  return "empty";
}

function listMigrationNames() {
  const root = "prisma/migrations";
  return readdirSync(root)
    .filter((name) => {
      const p = join(root, name);
      return statSync(p).isDirectory() && existsSync(join(p, "migration.sql"));
    })
    .sort();
}

async function verifyCoreTables(url) {
  const c = new Client({ connectionString: url });
  await c.connect();
  const r = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('Organization', 'User')
    ORDER BY table_name
  `);
  await c.end();
  const names = r.rows.map((x) => x.table_name);
  if (!names.includes("Organization") || !names.includes("User")) {
    fail(`Organization/User missing after migrate. Found: ${names.join(", ") || "(none)"}`);
  }
  log(`Verified tables: ${names.join(", ")}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set");

  await waitForDb(url);
  const state = await probeState(url);
  const baseline = "20260320000000_baseline";
  const baselineSql = join("prisma/migrations", baseline, "migration.sql");

  if (state === "empty") {
    // Prefer schema.prisma over replaying historical migration SQL.
    // The archived baseline has at least one type mismatch
    // (WorkpackAttachment.workpack_id text vs Workpack.id uuid) that
    // prevents a clean `migrate deploy` on a greenfield database.
    log("Empty database detected — syncing schema via prisma db push");
    run("npx", ["prisma", "db", "push", "--accept-data-loss"]);

    log("Recording migration history as applied (incl. baseline)...");
    if (!existsSync(baselineSql)) {
      log(`WARNING: baseline SQL missing at ${baselineSql} (history resolve continues)`);
    }
    for (const name of listMigrationNames()) {
      run("npx", ["prisma", "migrate", "resolve", "--applied", name]);
    }
    log(`Greenfield schema sync complete (baseline name: ${baseline})`);
  } else {
    log("Existing database detected — running prisma migrate deploy");
    run("npx", ["prisma", "migrate", "deploy"]);
    log("migrate deploy complete");
  }

  await verifyCoreTables(url);
  log("Done");
}

main().catch((e) => fail(e?.message || String(e)));
