/**
 * M12 V1 Phase 2 — HOLD / RESUME Verification Tests
 *
 * Architectural tests verifying:
 *   - HOLD action implementation and state machine
 *   - RESUME action implementation and state machine
 *   - Invalid transition rejections
 *   - AuditLog and ProgressLog creation
 *   - EventBus emission
 *   - M8.13 boundary preservation
 *
 * These are source-level architectural verification tests, NOT integration tests.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../../..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), 'utf-8');
}

// ============================================================================
// HOLD / RESUME TYPE DEFINITION
// ============================================================================

describe('ExecutionAction type includes HOLD and RESUME', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('ExecutionAction type includes HOLD', () => {
    expect(ewsSource).toContain("'HOLD'");
  });

  test('ExecutionAction type includes RESUME', () => {
    expect(ewsSource).toContain("'RESUME'");
  });

  test('ExecutionAction type is a union with all 6 actions', () => {
    expect(ewsSource).toMatch(/ExecutionAction\s*=\s*'START'\s*\|\s*'UPDATE_PROGRESS'\s*\|\s*'COMPLETE'\s*\|\s*'REPORT_DELAY'\s*\|\s*'HOLD'\s*\|\s*'RESUME'/);
  });
});

// ============================================================================
// HOLD STATE MACHINE
// ============================================================================

describe('HOLD — state machine guards', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('HOLD requires in_progress status', () => {
    // Must check current status and only allow HOLD from in_progress
    expect(ewsSource).toContain("params.action === 'HOLD'");
    expect(ewsSource).toContain("Activity must be in progress");
  });

  test('HOLD requires a reason (hold_reason or notes)', () => {
    expect(ewsSource).toContain('hold_reason');
    expect(ewsSource).toContain('A hold reason is required');
  });

  test('HOLD sets status to on_hold', () => {
    // Extract the HOLD handler block
    const holdBlock = ewsSource.match(/params\.action === 'HOLD'\)[\s\S]*?status:\s*'on_hold'/);
    expect(holdBlock).not.toBeNull();
  });

  test('HOLD creates ProgressLog (within $transaction block)', () => {
    // The $transaction block creates progressLog for ALL actions that set updates
    expect(ewsSource).toContain('tx.progressLog.create');
  });

  test('HOLD emits ActivityHeld event (post-transaction)', () => {
    expect(ewsSource).toContain("'ActivityHeld'");
  });
});

// ============================================================================
// RESUME STATE MACHINE
// ============================================================================

describe('RESUME — state machine guards', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('RESUME requires on_hold status', () => {
    expect(ewsSource).toContain("params.action === 'RESUME'");
    expect(ewsSource).toContain("Activity must be on hold");
  });

  test('RESUME sets status to in_progress', () => {
    // Find the RESUME handler
    const resumeBlock = ewsSource.match(/params\.action === 'RESUME'\)[\s\S]*?status:\s*'in_progress'/);
    expect(resumeBlock).not.toBeNull();
  });

  test('RESUME emits ActivityResumed event (post-transaction)', () => {
    expect(ewsSource).toContain("'ActivityResumed'");
  });

  test('RESUME also emits ActivityProgressUpdated (for M8.13 sync)', () => {
    // After RESUME, must also trigger progress update for M8.13 to re-sync
    const resumeEmitBlock = ewsSource.match(
      /params\.action === 'RESUME'\)[\s\S]*?ActivityResumed[\s\S]*?ActivityProgressUpdated/
    );
    expect(resumeEmitBlock).not.toBeNull();
  });
});

// ============================================================================
// INVALID TRANSITION REJECTIONS
// ============================================================================

describe('Invalid transition rejections', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('COMPLETE while on_hold is rejected', () => {
    expect(ewsSource).toContain("Cannot complete a held activity");
  });

  test('UPDATE_PROGRESS while on_hold is rejected', () => {
    expect(ewsSource).toContain("Cannot update progress on a held activity");
  });

  test('START while on_hold is rejected', () => {
    expect(ewsSource).toContain("Cannot start a held activity: Use RESUME instead");
  });
});

// ============================================================================
// HOLD_REASON FIELD
// ============================================================================

describe('hold_reason parameter', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('ExecutionActionParams includes hold_reason field', () => {
    expect(ewsSource).toContain('hold_reason');
  });

  test('HOLD handler uses hold_reason for ProgressLog remarks', () => {
    // Verify hold_reason flows to progressLogRemarks
    const holdRemarksMatch = ewsSource.match(/params\.hold_reason\s*\|\|\s*params\.notes\s*\|\|\s*'Activity placed on hold'/);
    expect(holdRemarksMatch).not.toBeNull();
  });
});

// ============================================================================
// SCHEMA SUPPORT
// ============================================================================

describe('Prisma schema supports on_hold status', () => {
  const schema = readFile('prisma/schema.prisma');

  test('ActivityStatus enum includes on_hold', () => {
    const enumBlock = schema.match(/enum ActivityStatus\s*\{[\s\S]*?\}/);
    expect(enumBlock).not.toBeNull();
    expect(enumBlock![0]).toContain('on_hold');
  });

  test('ActivityStatus enum includes in_progress', () => {
    const enumBlock = schema.match(/enum ActivityStatus\s*\{[\s\S]*?\}/);
    expect(enumBlock![0]).toContain('in_progress');
  });
});

// ============================================================================
// M8.13 BOUNDARY PRESERVATION
// ============================================================================

describe('M8.13 boundary — HOLD/RESUME do not calculate progress', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('EWS never imports ProgressAggregationService', () => {
    // The comment block mentions M8.13 in the architecture diagram,
    // but there must be no actual import statement
    expect(ewsSource).not.toMatch(/^import.*ProgressAggregationService/m);
  });

  test('EWS never calls calculateWeightedProgress', () => {
    expect(ewsSource).not.toContain('calculateWeightedProgress');
  });

  test('EWS never calls calculateProgress', () => {
    expect(ewsSource).not.toContain('calculateProgress');
  });

  test('HOLD preserves progress_percent (does not recalculate)', () => {
    // The HOLD handler should NOT set progress_percent
    // Extract specifically the HOLD else-if block
    const holdHandler = ewsSource.match(/else if \(params\.action === 'HOLD'\) \{[\s\S]*?\} else if/g);
    expect(holdHandler).not.toBeNull();
    if (holdHandler) {
      // The HOLD block should only set status and updated_by, NOT progress_percent
      expect(holdHandler[0]).not.toMatch(/progress_percent\s*:/);
    }
  });
});

// ============================================================================
// EXECUTION WRITE BOUNDARY — NO BYPASS
// ============================================================================

describe('HOLD/RESUME flow through ExecutionWriteService boundary', () => {
  const routeSource = readFile('app/api/execution/action/route.ts');

  test('API route calls ExecutionWriteService.applyAction for all actions', () => {
    expect(routeSource).toContain('ExecutionWriteService.applyAction');
  });

  test('API route does NOT contain direct prisma.activity.update', () => {
    expect(routeSource).not.toContain('prisma.activity.update');
  });
});

// ============================================================================
// AUDIT LOG — HOLD/RESUME ARE AUDITED
// ============================================================================

describe('HOLD/RESUME produce AuditLog entries', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('AuditService.log is called within $transaction', () => {
    // The $transaction block calls AuditService.log for ALL state-changing actions
    // (HOLD and RESUME both set updates, so they flow through the transaction)
    expect(ewsSource).toContain('AuditService.log');
    // Verify it's inside the transaction
    const txBlock = ewsSource.match(/prisma\.\$transaction\(async \(tx\)[\s\S]*?AuditService\.log/);
    expect(txBlock).not.toBeNull();
  });

  test('Audit records include execution_action', () => {
    expect(ewsSource).toContain('execution_action: params.action');
  });

  test('Audit records include source_channel', () => {
    expect(ewsSource).toContain('source_channel: options.source_channel');
  });
});

// ============================================================================
// FULL STATE MACHINE LIFECYCLE
// ============================================================================

describe('Full execution lifecycle: not_started → in_progress → on_hold → in_progress → completed', () => {
  const ewsSource = readFile('src/core/execution/ExecutionWriteService.ts');

  test('START sets status to in_progress', () => {
    expect(ewsSource).toMatch(/action === 'START'[\s\S]*?status:\s*'in_progress'/);
  });

  test('HOLD sets status to on_hold', () => {
    expect(ewsSource).toMatch(/action === 'HOLD'[\s\S]*?status:\s*'on_hold'/);
  });

  test('RESUME sets status to in_progress', () => {
    expect(ewsSource).toMatch(/action === 'RESUME'[\s\S]*?status:\s*'in_progress'/);
  });

  test('COMPLETE sets status to completed', () => {
    expect(ewsSource).toMatch(/action === 'COMPLETE'[\s\S]*?status:\s*'completed'/);
  });

  test('All 4 lifecycle transitions exist in the EWS', () => {
    // Verify the complete lifecycle is supported
    expect(ewsSource).toContain("status: 'in_progress'"); // START + RESUME
    expect(ewsSource).toContain("status: 'on_hold'");     // HOLD
    expect(ewsSource).toContain("status: 'completed'");    // COMPLETE
  });
});
