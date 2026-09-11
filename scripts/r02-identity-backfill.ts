/**
 * R0.2 identity backfill CLI.
 *
 *   npx tsx scripts/r02-identity-backfill.ts census
 *   npx tsx scripts/r02-identity-backfill.ts dry-run
 *   npx tsx scripts/r02-identity-backfill.ts apply --run-id <id> --confirm
 *   npx tsx scripts/r02-identity-backfill.ts rollback --run-id <id> --confirm
 *
 * Apply never runs unless --confirm is present. Dry-run never writes Activity rows.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { prisma, disconnect } from '../prisma/seed-client';
import { ActivityIdentityBackfillService } from '../src/core/activity/ActivityIdentityBackfillService';
import { PrismaIdentityBackfillStore } from '../src/core/activity/identityBackfillPrismaStore';
import type { BackfillRunState } from '../src/core/activity/ActivityIdentityBackfillService';

const ROOT = join(process.cwd(), 'var', 'r02-identity-backfill');

function parseArgs(argv: string[]) {
  const mode = argv[2] ?? 'census';
  const confirm = argv.includes('--confirm');
  const runIdIdx = argv.indexOf('--run-id');
  const runId = runIdIdx >= 0 ? argv[runIdIdx + 1] : undefined;
  return { mode, confirm, runId };
}

function persist(run: BackfillRunState) {
  const dir = join(ROOT, run.summary.runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(run.summary, null, 2));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(run.manifest, null, 2));
  writeFileSync(
    join(dir, 'proposals.json'),
    JSON.stringify(
      run.proposals.map((p) => ({
        activityId: p.activityId,
        workpackId: p.workpackId,
        organizationId: p.organizationId,
        old_event_id: p.old_event_id,
        proposed_event_id: p.proposed_event_id,
        old_discipline_id: p.old_discipline_id,
        proposed_discipline_id: p.proposed_discipline_id,
        old_standard_activity_type_id: p.old_standard_activity_type_id,
        proposed_standard_activity_type_id: p.proposed_standard_activity_type_id,
        derivation_reason: p.derivation_reason,
        validation_result: p.validation_result,
        classification: p.classification,
        fields: 'fields' in p ? p.fields : undefined,
        excluded: 'excluded' in p ? p.excluded : undefined,
        excludeReason: 'excludeReason' in p ? p.excludeReason : undefined,
      })),
      null,
      2
    )
  );
  writeFileSync(join(ROOT, 'latest-run-id.txt'), run.summary.runId);
  return dir;
}

function loadRun(runId: string): BackfillRunState {
  const dir = join(ROOT, runId);
  if (!existsSync(join(dir, 'summary.json'))) {
    throw new Error(`No persisted run ${runId} under ${dir}`);
  }
  return {
    summary: JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')),
    manifest: JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')),
    proposals: JSON.parse(readFileSync(join(dir, 'proposals.json'), 'utf8')),
  };
}

async function main() {
  const { mode, confirm, runId } = parseArgs(process.argv);
  const store = new PrismaIdentityBackfillStore(prisma, process.env.NODE_ENV ?? 'development');
  const svc = new ActivityIdentityBackfillService(store);

  if (mode === 'census') {
    const { counts, proposals } = await svc.census();
    const out = {
      read_only: true,
      database: await store.databaseName(),
      counts,
      quarantined: proposals.filter((p) => p.validation_result === 'QUARANTINED').length,
      auto_safe: proposals.filter((p) => p.validation_result === 'AUTO_SAFE').length,
    };
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(join(ROOT, 'latest-census.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (mode === 'dry-run') {
    const run = await svc.dryRun(process.env.USER ?? 'r0.2');
    const dir = persist(run);
    console.log(JSON.stringify({ ...run.summary, persisted: dir, wrote_activities: false }, null, 2));
    if (run.summary.unexpectedRelationships.length > 0) {
      console.error('STOP: unexpected relationships. Apply is blocked until reviewed.');
      process.exitCode = 2;
    }
    return;
  }

  if (mode === 'apply') {
    if (!confirm) {
      throw new Error('Refusing to apply without --confirm. Run dry-run first.');
    }
    const priorId = runId ?? (existsSync(join(ROOT, 'latest-run-id.txt'))
      ? readFileSync(join(ROOT, 'latest-run-id.txt'), 'utf8').trim()
      : '');
    if (!priorId) throw new Error('apply requires --run-id from a completed dry-run');
    const prior = loadRun(priorId);
    if (prior.summary.mode !== 'dry_run') {
      throw new Error(`Run ${priorId} is ${prior.summary.mode}, not dry_run`);
    }
    if (prior.summary.unexpectedRelationships.length > 0) {
      throw new Error(`Run ${priorId} has unexpected relationships. Apply blocked.`);
    }
    const applied = await svc.apply(process.env.USER ?? 'r0.2', {
      onlyActivityIds: prior.manifest.map((m) => m.activityId),
    });
    applied.summary.runId = prior.summary.runId;
    for (const entry of applied.manifest) entry.runId = prior.summary.runId;
    const dir = persist(applied);
    console.log(JSON.stringify({ ...applied.summary, persisted: dir }, null, 2));
    return;
  }

  if (mode === 'rollback') {
    if (!confirm) throw new Error('Refusing to rollback without --confirm');
    if (!runId) throw new Error('rollback requires --run-id');
    const prior = loadRun(runId);
    const rolled = await svc.rollback(prior, process.env.USER ?? 'r0.2');
    persist(rolled);
    console.log(JSON.stringify(rolled.summary, null, 2));
    return;
  }

  throw new Error(`Unknown mode ${mode}. Use census | dry-run | apply | rollback`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
