/**
 * M12 final balance — execution mutations through EWS; planning mutations remain outside.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  listedExecutionFields,
  mapTargetStatusToAction,
  mapGridFieldToExecution,
  EXECUTION_FIELD_REJECT_MESSAGE,
} from '../executionFieldGuard';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('M12 field classification', () => {
  it('lists execution-sensitive fields on a generic body', () => {
    expect(listedExecutionFields({ duration_hours: 8, status: 'in_progress', progress_percent: 40 })).toEqual([
      'status',
      'progress_percent',
    ]);
    expect(listedExecutionFields({ planned_start: '2026-09-01', duration_hours: 8 })).toEqual([]);
  });

  it('maps target statuses to EWS actions without guessing reverse transitions', () => {
    expect(mapTargetStatusToAction('released', 'not_started')).toEqual({ action: 'RELEASE' });
    expect(mapTargetStatusToAction('in_progress', 'released')).toEqual({ action: 'START' });
    expect(mapTargetStatusToAction('in_progress', 'on_hold')).toEqual({ action: 'RESUME' });
    expect(mapTargetStatusToAction('on_hold', 'in_progress')).toEqual({ action: 'HOLD' });
    expect(mapTargetStatusToAction('completed', 'in_progress')).toEqual({ action: 'COMPLETE' });
    expect(mapTargetStatusToAction('verified', 'completed')).toEqual({ action: 'VERIFY' });
    expect(mapTargetStatusToAction('closed', 'verified')).toEqual({ action: 'CLOSE' });
    expect(mapTargetStatusToAction('not_started', 'in_progress')).toMatchObject({ error: expect.any(String) });
  });

  it('maps grid progress to UPDATE_PROGRESS', () => {
    expect(mapGridFieldToExecution('progress_percent', 55)).toEqual({ action: 'UPDATE_PROGRESS', progress: 55 });
  });
});

describe('M12 planning endpoints do not persist execution fields', () => {
  it('GET/PUT /api/activities/[id] rejects execution fields', () => {
    const src = read('app/api/activities/[id]/route.ts');
    expect(src).toContain('EXECUTION_FIELD_REJECT_MESSAGE');
    expect(src).toContain('listedExecutionFields');
    expect(src).not.toContain('ExecutionWriteService');
    expect(src).not.toMatch(/updates\[field\] = body\[field\].*status/);
  });

  it('schedule activity PUT is M11-owned planned fields only', () => {
    const src = read('app/api/projects/[id]/schedule/activities/[activityId]/route.ts');
    expect(src).toContain('planned_start');
    // R0.4: the route is an adapter. It delegates recalculation through the Event
    // enqueue boundary, which reaches ScheduleOrchestrationService via the worker.
    expect(src).toContain('enqueueEventScheduleRecalculate');
    expect(src).not.toContain('calculateEventSchedule');
    expect(src).toContain('EXECUTION_FIELD_REJECT_MESSAGE');
    expect(src).not.toContain("'status'");
    expect(src).not.toContain("'progress_percent'");
    expect(src).not.toContain("'actual_start'");
    expect(src).not.toContain('ExecutionWriteService');
  });

  it('activities bulk rejects execution updates and forces create at not_started', () => {
    const src = read('app/api/activities/bulk/route.ts');
    expect(src).toContain('createActivity');
    expect(src).toContain('cannot be changed through planning bulk');
    expect(src).not.toContain('data.status = item.status');
    expect(src).not.toContain('data.progress_percent');
    const command = read('src/core/activity/ActivityCreationCommand.ts');
    expect(command).toContain("status: 'not_started'");
    expect(command).toContain('progress_percent: 0');
  });

  it('workpack activities bulk routes execution through EWS with per-row results', () => {
    const src = read('app/api/workpacks/[id]/activities/bulk/route.ts');
    expect(src).toContain('ExecutionWriteService.bulkApplyAction');
    expect(src).toContain('mapTargetStatusToAction');
    expect(src).toContain('eventId: workpack.event_id');
    expect(src).toContain('results');
  });

  it('ActivityService.updateActivity rejects execution fields and updateProgress delegates to EWS', () => {
    const src = read('src/modules/Activity/Services/ActivityService.ts');
    expect(src).toContain('listedExecutionFields');
    const progressFn = src.match(/static async updateProgress\([\s\S]*?return result\.activity;\s*\}/)?.[0] ?? '';
    expect(progressFn).toContain('ExecutionWriteService.applyAction');
    expect(progressFn).not.toContain('prisma.activity.update');
  });
});

describe('M12 Excel event-safe resolution', () => {
  it('requires eventId and scopes activity_number lookup to org+event', () => {
    const src = read('src/core/execution/ExecutionExcelAdapter.ts');
    expect(src).toContain('eventId is required');
    expect(src).toContain('event_id: eventId');
    expect(src).toContain('ambiguous within this event');
    expect(src).toContain("source_channel: 'excel'");
    expect(src).toContain('eventId,');
  });

  it('bulk-upload API requires event_id', () => {
    const src = read('app/api/execution/bulk-upload/route.ts');
    expect(src).toContain('event_id is required');
    expect(src).toContain('importExecutionUpdate(orgId, userId, buffer, eventId)');
  });
});

describe('M12 EWS remains the execution command boundary', () => {
  it('applyAction can bind event_id on the write', () => {
    const src = read('src/core/execution/ExecutionWriteService.ts');
    expect(src).toContain('does not belong to the specified event');
    expect(src).toContain('...(options.eventId ? { event_id: options.eventId } : {})');
    expect(src).toContain('ProgressAggregationService');
    expect(src).not.toContain('calculateProgressMetrics');
  });

  it('web activity-action accepts UPDATE_PROGRESS', () => {
    const src = read('app/api/execution/activity-action/route.ts');
    expect(src).toContain("UPDATE_PROGRESS: 'execution.update'");
    expect(src).toContain("body.action === 'REPORT_PROGRESS' ? 'UPDATE_PROGRESS'");
  });

  it('M11 SOS still persists only CPM fields', () => {
    const src = read('src/core/schedule/ScheduleOrchestrationService.ts');
    const persist = src.match(/if \(persist && result\.success\) \{[\s\S]*?\n    \}/)?.[0] ?? '';
    expect(persist).toContain('early_start');
    expect(persist).toContain('total_float');
    expect(persist).not.toContain('progress_percent');
    expect(persist).not.toContain('actual_start');
  });
});

describe('M12 Excel adapter event isolation (runtime)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does not resolve an activity number from another event', async () => {
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        activity: {
          findMany: vi.fn().mockResolvedValue([{ id: 'act-event-a', activity_number: 'HX-204' }]),
        },
      },
    }));
    vi.doMock('../ExecutionWriteService', () => ({
      ExecutionWriteService: {
        bulkApplyAction: vi.fn().mockResolvedValue([{ activityId: 'act-event-a', success: true }]),
      },
    }));

    const ExcelJS = await import('exceljs');
    const { ExecutionExcelAdapter } = await import('../ExecutionExcelAdapter');
    const { prisma } = await import('@/lib/prisma');
    const { ExecutionWriteService } = await import('../ExecutionWriteService');

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('exec');
    sheet.addRow(['Activity Number', 'Action']);
    sheet.addRow(['HX-204', 'START']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    await ExecutionExcelAdapter.importExecutionUpdate('org-a', 'user-1', buffer, 'event-ta-2027');

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-a',
          event_id: 'event-ta-2027',
          activity_number: { in: ['HX-204'] },
        }),
      })
    );
    expect(ExecutionWriteService.bulkApplyAction).toHaveBeenCalledWith(
      'org-a',
      'user-1',
      expect.any(Array),
      expect.objectContaining({ source_channel: 'excel', eventId: 'event-ta-2027' })
    );
  });
});

describe('M12 final source scan — remaining Activity writers are classified', () => {
  it('does not introduce a second execution engine', () => {
    const ews = read('src/core/execution/ExecutionWriteService.ts');
    expect(ews).toContain('THE SINGLE COMMAND BOUNDARY');
    const guard = read('src/core/execution/executionFieldGuard.ts');
    expect(guard).toContain(EXECUTION_FIELD_REJECT_MESSAGE.slice(0, 40));
  });
});
