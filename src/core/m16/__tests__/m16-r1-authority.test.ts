/**
 * M16-R1 Authority Tests (A1–A5)
 *
 * Verifies M16 does not create unauthorized calculation engines,
 * does not directly mutate Prisma domain tables, and routes
 * execution through EWS.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { INTENT_METADATA, M16Intent } from '../intents';

const M16_DIR = path.resolve(__dirname, '..');

/**
 * Recursively find all .ts files in a directory, excluding __tests__
 */
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') {
      files.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Read all M16 source code, stripping single-line doc comments.
 * This prevents false positives from documentation mentioning
 * prohibited patterns in "Do NOT" style warnings.
 */
function readAllM16Source(): string {
  const files = findTsFiles(M16_DIR);
  return files.map((f) => {
    const content = fs.readFileSync(f, 'utf-8');
    // Strip single-line comments and JSDoc comment blocks
    return content
      .replace(/\/\*\*[\s\S]*?\*\//g, '')  // Strip /** ... */ blocks
      .replace(/\/\/.*$/gm, '');           // Strip // comments
  }).join('\n\n');
}

describe('M16-R1 Authority', () => {
  const allSource = readAllM16Source();

  // A1: Zero AI → Prisma mutation on domain tables
  it('A1 — zero AI → Prisma domain mutations (only m16_interaction_logs.create and whatsapp_sessions.update allowed)', () => {
    // Prohibited domain mutations
    const prohibitedMutations = [
      'prisma.activity.create',
      'prisma.activity.update',
      'prisma.activity.delete',
      'prisma.workpack.create',
      'prisma.workpack.update',
      'prisma.workpack.delete',
      'prisma.asset.create',
      'prisma.asset.update',
      'prisma.asset.delete',
      'prisma.progress_log.create',
      'prisma.progress_log.update',
      'prisma.execution_log.create',
      'prisma.$executeRaw',
      'prisma.$queryRaw',
    ];

    for (const mutation of prohibitedMutations) {
      expect(allSource).not.toContain(mutation);
    }
  });

  // A1b: Only allowed Prisma writes are audit and session
  it('A1b — only allowed Prisma writes are m16_interaction_logs.create and whatsapp_sessions.update', () => {
    // Read raw source (with comments) for positive assertions
    const rawFiles = findTsFiles(M16_DIR);
    const rawSource = rawFiles.map((f) => fs.readFileSync(f, 'utf-8')).join('\n\n');
    // These SHOULD exist
    expect(rawSource).toContain('prisma.m16_interaction_logs.create');
    expect(rawSource).toContain('prisma.whatsapp_sessions.update');
  });

  // A2: Zero AI progress calculation
  // M16 may READ progress results from domain authorities (e.g., result.metrics.weightedProgress)
  // but must NOT CALCULATE progress values itself.
  it('A2 — zero AI progress calculation in M16 code', () => {
    const progressPatterns = [
      'calculateProgress',
      'computeProgress',
      'progressPercent =',       // Assignment (calculation)
      'completed / total',        // Division formula
      'actual_percent',           // Self-calculated field
    ];

    for (const pattern of progressPatterns) {
      expect(allSource).not.toContain(pattern);
    }
  });

  // A3: Zero AI CPM calculation
  // M16 may READ schedule/CPM data from domain authorities but must NOT calculate CPM.
  it('A3 — zero AI CPM/schedule calculation in M16 code', () => {
    const cpmPatterns = [
      'calculateFloat',
      'forwardPass',
      'backwardPass',
      'early_start',
      'late_finish',
      'free_float',
    ];

    for (const pattern of cpmPatterns) {
      expect(allSource).not.toContain(pattern);
    }
  });

  // A4: Zero AI readiness calculation
  it('A4 — zero AI readiness calculation in M16 code', () => {
    const readinessPatterns = [
      'calculateReadiness',
      'readinessScore',
      'readiness_percent',
      'computeReadiness',
      'checkReadiness',
    ];

    for (const pattern of readinessPatterns) {
      expect(allSource).not.toContain(pattern);
    }
  });

  // A5: Execution architecture terminates at EWS
  it('A5 — execution intents map to ExecutionWriteService', () => {
    const executionIntents = [
      M16Intent.RELEASE_ACTIVITY,
      M16Intent.START_ACTIVITY,
      M16Intent.UPDATE_PROGRESS,
      M16Intent.HOLD_ACTIVITY,
      M16Intent.RESUME_ACTIVITY,
      M16Intent.REPORT_DELAY,
      M16Intent.COMPLETE_ACTIVITY,
      M16Intent.VERIFY_ACTIVITY,
      M16Intent.CLOSE_ACTIVITY,
    ];

    for (const intent of executionIntents) {
      const meta = INTENT_METADATA[intent];
      expect(meta.domainOwner).toContain('ExecutionWriteService');
    }
  });

  // A5b: Only writeTools.ts and MobileChannelAdapter.ts import ExecutionWriteService
  // writeTools.ts = R3 delegate for pipeline-mediated execution
  // MobileChannelAdapter.ts = R5 direct execution via EWS (authorized + channel-scoped)
  it('A5b — only writeTools.ts and MobileChannelAdapter.ts import ExecutionWriteService', () => {
    const M16_DIR = path.resolve(__dirname, '..');
    const files = findTsFiles(M16_DIR);
    const ewsImporters: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes("from '@/core/execution/ExecutionWriteService'") ||
          content.includes('from "@/core/execution/ExecutionWriteService"')) {
        ewsImporters.push(path.basename(file));
      }
    }
    // R3: writeTools delegates pipeline writes to EWS
    // R5: MobileChannelAdapter routes direct mobile execution through EWS
    expect(ewsImporters.sort()).toEqual(['MobileChannelAdapter.ts', 'writeTools.ts']);
  });

  // A extra: No legacy matcher import in executable code
  it('A_extra — M16 executable code does not import legacy database matcher', () => {
    // Checks comment-stripped source
    expect(allSource).not.toContain('DbMatcher');
    expect(allSource).not.toContain('matchToDatabase');
  });
});
