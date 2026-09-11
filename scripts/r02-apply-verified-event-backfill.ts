/**
 * R0.2 apply — verified event_id backfill only.
 *
 * Reads the dry-run manifest and updates ONLY those Activity rows.
 * Writes event_id. Does not write discipline_id or standard_activity_type_id.
 * Does not guess. Stops on the first failed optimistic lock.
 *
 * Usage:
 *   npx tsx scripts/r02-apply-verified-event-backfill.ts --run-id <id> --confirm
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { prisma, disconnect } from '../prisma/seed-client';
import { R02_SOURCE } from '../src/core/activity/identityBackfillTypes';
import type { ManifestRecord, BackfillRunSummary } from '../src/core/activity/identityBackfillTypes';

const ROOT = join(process.cwd(), 'var', 'r02-identity-backfill');

async function main() {
  const argv = process.argv;
  if (!argv.includes('--confirm')) {
    throw new Error('Refusing to apply without --confirm');
  }
  const runId = argv[argv.indexOf('--run-id') + 1];
  if (!runId || runId.startsWith('--')) {
    throw new Error('Requires --run-id from a completed dry-run');
  }
  const dir = join(ROOT, runId);
  const summaryPath = join(dir, 'summary.json');
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(summaryPath) || !existsSync(manifestPath)) {
    throw new Error(`Missing dry-run artifacts under ${dir}`);
  }

  const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as BackfillRunSummary;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestRecord[];

  if (summary.mode !== 'dry_run') {
    throw new Error(`Run ${runId} is ${summary.mode}, not dry_run`);
  }
  if (summary.unexpectedRelationships.length > 0) {
    throw new Error(`Run ${runId} has unexpected relationships. Apply blocked.`);
  }

  const safe = manifest.filter(
    (m) =>
      m.validationResult === 'AUTO_SAFE'
      && m.fieldsChanged.length === 1
      && m.fieldsChanged[0] === 'event_id'
      && m.oldValues.event_id === null
      && m.newValues.event_id
      && m.oldValues.discipline_id === null
      && m.newValues.discipline_id === null
      && m.oldValues.standard_activity_type_id === null
      && m.newValues.standard_activity_type_id === null
      && m.workpackId
      && m.derivationSource === 'DERIVED_FROM_WORKPACK_EVENT'
  );

  if (safe.length !== 16 || safe.length !== manifest.length) {
    throw new Error(
      `Apply blocked: expected exactly 16 event-only AUTO_SAFE rows, found ${safe.length} of ${manifest.length}`
    );
  }

  const operator = process.env.USER ?? 'r0.2';
  let applied = 0;

  for (const entry of safe) {
    const result = await prisma.$executeRaw`
      UPDATE "Activity" a
      SET event_id = ${entry.newValues.event_id}::uuid, updated_at = NOW()
      WHERE a.id = ${entry.activityId}::uuid
        AND a.organization_id = ${entry.organizationId}::uuid
        AND a.workpack_id = ${entry.workpackId}::uuid
        AND a.event_id IS NULL
        AND a.discipline_id IS NULL
        AND a.standard_activity_type_id IS NULL
        AND a.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM "Workpack" w
          WHERE w.id = a.workpack_id
            AND w.organization_id = a.organization_id
            AND w.event_id = ${entry.newValues.event_id}::uuid
        )
    `;
    if (Number(result) !== 1) {
      throw new Error(`Apply stopped: optimistic lock failed for activity ${entry.activityId}`);
    }

    await prisma.$executeRaw`
      INSERT INTO "AuditLog" (
        id, organization_id, auditable_type, auditable_id, event, old_values, new_values, context, created_at
      ) VALUES (
        ${randomUUID()}::uuid,
        ${entry.organizationId}::uuid,
        'Activity',
        ${entry.activityId}::uuid,
        'updated',
        ${JSON.stringify({
          event_id: null,
          discipline_id: null,
          standard_activity_type_id: null,
          source: R02_SOURCE,
          runId,
          operator,
          derivation_reason: entry.derivationSource,
        })}::jsonb,
        ${JSON.stringify({
          event_id: entry.newValues.event_id,
          discipline_id: null,
          standard_activity_type_id: null,
          source: R02_SOURCE,
          runId,
          operator,
          derivation_reason: entry.derivationSource,
        })}::jsonb,
        ${R02_SOURCE},
        NOW()
      )
    `;

    entry.applied = true;
    entry.runId = runId;
    applied += 1;
  }

  const nextSummary: BackfillRunSummary = {
    ...summary,
    mode: 'apply',
    completedAt: new Date().toISOString(),
    operator,
    applied,
    rolledBack: 0,
  };
  writeFileSync(summaryPath, JSON.stringify(nextSummary, null, 2));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    runId,
    mode: 'apply',
    applied,
    fields: ['event_id'],
    discipline_written: false,
    sat_written: false,
    persisted: dir,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
