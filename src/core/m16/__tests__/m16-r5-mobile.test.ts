/**
 * M16-R5 Mobile Test Suite
 *
 * Tests MobileChannelAdapter:
 *   1. Authentication
 *   2. Tenant isolation
 *   3. Event isolation
 *   4. All execution actions via EWS
 *   5. Authorization (fail-closed)
 *   6. Stale/duplicate/concurrent actions
 *   7. Architectural invariants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMobileExecution, getMobileReadiness, _clearMobileIdempotencyStore } from '../channels/MobileChannelAdapter';
import type { MobileSession, MobileExecutionRequest } from '../channels/MobileChannelAdapter';
import * as fs from 'fs';
import * as path from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'user-r5-mobile';
const TEST_ORG_ID = 'org-r5-mobile';
const TEST_EVENT_ID = 'event-r5-mobile';
const TEST_ACTIVITY_ID = 'act-r5-mobile';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sess(overrides?: Partial<MobileSession>): MobileSession {
  return {
    userId: TEST_USER_ID,
    userName: 'Mobile User',
    organizationId: TEST_ORG_ID,
    ...overrides,
  };
}

function execReq(action: string, overrides?: Partial<MobileExecutionRequest>): MobileExecutionRequest {
  return {
    activityId: TEST_ACTIVITY_ID,
    action: action as any,
    eventId: TEST_EVENT_ID,
    requestId: `mob-${Date.now()}`,
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockApplyAction,
  mockEvaluateReadiness,
  mockCheckAuthorization,
  mockPrisma,
} = vi.hoisted(() => ({
  mockApplyAction: vi.fn(),
  mockEvaluateReadiness: vi.fn(),
  mockCheckAuthorization: vi.fn(),
  mockPrisma: {
    organizationMembership: { findFirst: vi.fn() },
    activity: { findFirst: vi.fn() },
  },
}));

vi.mock('@/core/execution/ExecutionWriteService', () => ({
  ExecutionWriteService: {
    applyAction: (...args: any[]) => mockApplyAction(...args),
  },
}));

vi.mock('@/core/execution/ExecutionReadinessService', () => ({
  ExecutionReadinessService: {
    evaluateReadiness: (...args: any[]) => mockEvaluateReadiness(...args),
  },
}));

vi.mock('../auth/M16AuthorizationBoundary', () => ({
  checkAuthorization: (...args: any[]) => mockCheckAuthorization(...args),
}));

vi.mock('../context/InteractionContextBuilder', () => ({
  buildInteractionContext: vi.fn((params: any) => Object.freeze({
    organizationId: params.identity.organizationId,
    userId: params.identity.userId,
    channel: params.channel,
    conversationId: params.conversationId,
    eventId: params.eventId,
  })),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

// ══════════════════════════════════════════════════════════════════════════════

describe('M16-R5: Mobile Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearMobileIdempotencyStore();

    // Default: authorized
    mockCheckAuthorization.mockReturnValue({ authorized: true, permission: 'execution.start' });

    // Default: activity found
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: TEST_ACTIVITY_ID, status: 'not_started', activity_number: 'HX-204',
    });

    // Default: user has role
    mockPrisma.organizationMembership.findFirst.mockResolvedValue({ role: 'execution_engineer' });

    // Default: EWS success
    mockApplyAction.mockResolvedValue({ newStatus: 'in_progress' });

    // Default: readiness
    mockEvaluateReadiness.mockResolvedValue({ is_ready: true, blockers: [] });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION
  // ──────────────────────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('rejects unauthenticated session', async () => {
      const result = await processMobileExecution(execReq('START'), sess({ userId: '' }));
      expect(result.status).toBe('denied');
      expect(result.reason).toContain('Authentication');
    });

    it('rejects missing organizationId', async () => {
      const result = await processMobileExecution(execReq('START'), sess({ organizationId: '' }));
      expect(result.status).toBe('denied');
    });

    it('rejects missing required fields', async () => {
      const result = await processMobileExecution(execReq('START', { activityId: '' }), sess());
      expect(result.status).toBe('denied');
      expect(result.reason).toContain('Missing');
    });

    it('rejects unknown action', async () => {
      const result = await processMobileExecution(execReq('DESTROY' as any), sess());
      expect(result.status).toBe('denied');
      expect(result.reason).toContain('Unknown action');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TENANT ISOLATION
  // ──────────────────────────────────────────────────────────────────────────

  describe('Tenant Isolation', () => {
    it('rejects activity from different org', async () => {
      mockPrisma.activity.findFirst.mockResolvedValueOnce(null);
      const result = await processMobileExecution(execReq('START'), sess());
      expect(result.status).toBe('denied');
      expect(result.reason).toContain('not found');
    });

    it('scopes activity lookup to session org', async () => {
      await processMobileExecution(execReq('START'), sess());
      expect(mockPrisma.activity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: TEST_ORG_ID,
            event_id: TEST_EVENT_ID,
          }),
        })
      );
    });

    it('denies activity that does not belong to the requested event', async () => {
      mockPrisma.activity.findFirst.mockResolvedValueOnce(null);
      const result = await processMobileExecution(
        execReq('COMPLETE', { eventId: 'event-other' }),
        sess(),
      );
      expect(result.status).toBe('denied');
      expect(result.reason).toContain('not found');
      expect(mockApplyAction).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. AUTHORIZATION
  // ──────────────────────────────────────────────────────────────────────────

  describe('Authorization', () => {
    it('denies COMPLETE without permission', async () => {
      mockCheckAuthorization.mockReturnValueOnce({
        authorized: false, deniedReason: 'Missing execution.complete permission',
      });
      const result = await processMobileExecution(execReq('COMPLETE'), sess());
      expect(result.status).toBe('denied');
      expect(mockApplyAction).not.toHaveBeenCalled();
    });

    it('denies COMPLETE when role is missing (fail-closed)', async () => {
      mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null);
      mockCheckAuthorization.mockReturnValueOnce({
        authorized: false, deniedReason: 'No role assigned',
      });
      const result = await processMobileExecution(execReq('COMPLETE'), sess());
      expect(result.status).toBe('denied');
      expect(mockApplyAction).not.toHaveBeenCalled();
    });

    it('requires requestId for COMPLETE (destructive tactile policy)', async () => {
      const result = await processMobileExecution(
        execReq('COMPLETE', { requestId: undefined }),
        sess(),
      );
      expect(result.status).toBe('denied');
      expect(result.reason).toContain('requestId');
      expect(mockApplyAction).not.toHaveBeenCalled();
    });

    it('denies START without permission', async () => {
      mockCheckAuthorization.mockReturnValueOnce({
        authorized: false, deniedReason: 'Missing execution.start permission',
      });
      const result = await processMobileExecution(execReq('START'), sess());
      expect(result.status).toBe('denied');
      expect(result.reason).toContain('execution.start');
    });

    it('denies when user has no role (fail-closed)', async () => {
      mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null);
      mockCheckAuthorization.mockReturnValueOnce({
        authorized: false, deniedReason: 'No role assigned',
      });
      const result = await processMobileExecution(execReq('START'), sess());
      expect(result.status).toBe('denied');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. EXECUTION ACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Execution Actions', () => {
    const actions = ['START', 'UPDATE_PROGRESS', 'COMPLETE', 'HOLD', 'RESUME', 'RELEASE', 'VERIFY', 'CLOSE', 'REPORT_DELAY'];

    for (const action of actions) {
      it(`executes ${action} through EWS`, async () => {
        const result = await processMobileExecution(execReq(action), sess());
        expect(result.status).toBe('executed');
        expect(mockApplyAction).toHaveBeenCalledWith(
          TEST_ORG_ID,
          TEST_USER_ID,
          expect.objectContaining({ activityId: TEST_ACTIVITY_ID, action }),
          expect.objectContaining({ source_channel: 'mobile' }),
        );
      });
    }

    it('passes progress value for UPDATE_PROGRESS', async () => {
      await processMobileExecution(execReq('UPDATE_PROGRESS', { progress: 50 }), sess());
      expect(mockApplyAction).toHaveBeenCalledWith(
        TEST_ORG_ID, TEST_USER_ID,
        expect.objectContaining({ progress: 50 }),
        expect.any(Object),
      );
    });

    it('passes hold_reason for HOLD', async () => {
      await processMobileExecution(execReq('HOLD', { hold_reason: 'Material shortage' }), sess());
      expect(mockApplyAction).toHaveBeenCalledWith(
        TEST_ORG_ID, TEST_USER_ID,
        expect.objectContaining({ hold_reason: 'Material shortage' }),
        expect.any(Object),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ERROR HANDLING
  // ──────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('does not expose Prisma errors', async () => {
      mockApplyAction.mockRejectedValueOnce(new Error('Prisma P2025: Record not found'));
      const result = await processMobileExecution(execReq('START'), sess());
      expect(result.status).toBe('error');
      expect(result.reason).not.toContain('Prisma');
      expect(result.reason).not.toContain('P2025');
    });

    it('returns user-friendly error messages', async () => {
      mockApplyAction.mockRejectedValueOnce(new Error('Activity is currently on hold'));
      const result = await processMobileExecution(execReq('START'), sess());
      expect(result.status).toBe('error');
      expect(result.reason).toContain('on hold');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. READINESS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Readiness', () => {
    it('returns readiness from authoritative service', async () => {
      const result = await getMobileReadiness(TEST_ACTIVITY_ID, sess());
      expect(result.is_ready).toBe(true);
      expect(mockEvaluateReadiness).toHaveBeenCalledWith(TEST_ORG_ID, TEST_ACTIVITY_ID);
    });

    it('returns blockers when not ready', async () => {
      mockEvaluateReadiness.mockResolvedValueOnce({
        is_ready: false, blockers: ['Permit pending', 'Material not available'],
      });
      const result = await getMobileReadiness(TEST_ACTIVITY_ID, sess());
      expect(result.is_ready).toBe(false);
      expect(result.blockers).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. CONCURRENCY, RETRIES, AND STALE COMMANDS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Concurrency, Retries, and Stale Commands', () => {
    it('returns cached execution result for duplicate requestId (idempotency)', async () => {
      const req = execReq('START', { requestId: 'req-dup-101' });
      const firstResult = await processMobileExecution(req, sess());
      expect(firstResult.status).toBe('executed');
      expect(mockApplyAction).toHaveBeenCalledTimes(1);

      // Duplicate retry with same requestId
      const secondResult = await processMobileExecution(req, sess());
      expect(secondResult.status).toBe('executed');
      expect(secondResult).toEqual(firstResult);
      // EWS is NOT called again
      expect(mockApplyAction).toHaveBeenCalledTimes(1);
    });

    it('rejects stale UPDATE_PROGRESS on completed activity', async () => {
      mockPrisma.activity.findFirst.mockResolvedValueOnce({
        id: TEST_ACTIVITY_ID, status: 'completed', activity_number: 'HX-204',
      });
      const result = await processMobileExecution(
        execReq('UPDATE_PROGRESS', { progress: 40 }), sess()
      );
      expect(result.status).toBe('error');
      expect(result.reason).toContain('Cannot update progress on an activity that is already completed');
      expect(mockApplyAction).not.toHaveBeenCalled();
    });

    it('rejects stale UPDATE_PROGRESS on verified or closed activity', async () => {
      mockPrisma.activity.findFirst.mockResolvedValueOnce({
        id: TEST_ACTIVITY_ID, status: 'verified', activity_number: 'HX-204',
      });
      const result = await processMobileExecution(
        execReq('UPDATE_PROGRESS', { progress: 60 }), sess()
      );
      expect(result.status).toBe('error');
      expect(result.reason).toContain('Cannot update progress on an activity that is already verified');
      expect(mockApplyAction).not.toHaveBeenCalled();
    });

    it('rejects stale START on already completed activity', async () => {
      mockPrisma.activity.findFirst.mockResolvedValueOnce({
        id: TEST_ACTIVITY_ID, status: 'completed', activity_number: 'HX-204',
      });
      const result = await processMobileExecution(execReq('START'), sess());
      expect(result.status).toBe('error');
      expect(result.reason).toContain('Cannot execute START on an activity that is already completed');
      expect(mockApplyAction).not.toHaveBeenCalled();
    });

    it('handles two simultaneous operator START requests without double transition', async () => {
      // Operator A runs first: succeeds
      const resA = await processMobileExecution(
        execReq('START', { requestId: 'op-a-start' }), sess({ userId: 'operator-a' })
      );
      expect(resA.status).toBe('executed');

      // Operator B runs second on already in_progress activity: EWS state machine rejects
      mockApplyAction.mockRejectedValueOnce(
        new Error('Cannot start activity: Activity must be not_started or released (current: in_progress)')
      );
      const resB = await processMobileExecution(
        execReq('START', { requestId: 'op-b-start' }), sess({ userId: 'operator-b' })
      );
      expect(resB.status).toBe('error');
      expect(resB.reason).toContain('must be not_started or released');
    });

    it('Promise.all duplicate COMPLETE: one success and one conflict or idempotent replay', async () => {
      let calls = 0;
      mockApplyAction.mockImplementation(async () => {
        const n = ++calls;
        await new Promise((r) => setImmediate(r));
        if (n === 1) {
          return { success: true, activity: { status: 'completed' } };
        }
        throw new Error('Execution conflict: activity was modified concurrently');
      });

      const [a, b] = await Promise.all([
        processMobileExecution(execReq('COMPLETE', { requestId: 'complete-a' }), sess()),
        processMobileExecution(execReq('COMPLETE', { requestId: 'complete-b' }), sess()),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toContain('executed');
      expect(statuses).toContain('error');
      const err = a.status === 'error' ? a : b;
      expect(err.reason).toMatch(/conflict|already|concurrent/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. ARCHITECTURAL INVARIANTS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Architectural Invariants', () => {
    const adapterSource = fs.readFileSync(
      path.resolve(__dirname, '../channels/MobileChannelAdapter.ts'), 'utf-8'
    );

    it('adapter uses EWS.applyAction for execution', () => {
      expect(adapterSource).toContain('ExecutionWriteService.applyAction');
    });

    it('adapter does NOT contain direct Prisma domain mutations', () => {
      expect(adapterSource).not.toContain('prisma.activity.update');
      expect(adapterSource).not.toContain('prisma.activity.create');
      expect(adapterSource).not.toContain('prisma.workpack.update');
    });

    it('adapter does NOT calculate progress/CPM/readiness', () => {
      expect(adapterSource).not.toContain('calculateProgress');
      expect(adapterSource).not.toContain('critical_path');
      expect(adapterSource).not.toContain('calculateCPM');
      expect(adapterSource).not.toContain('calculateReadiness');
    });

    it('adapter does NOT create alternate auth/confirmation', () => {
      expect(adapterSource).not.toContain('MobileConfirmationGate');
      expect(adapterSource).not.toContain('MobileAuthorizationService');
      expect(adapterSource).not.toContain('MobileExecutionService');
      expect(adapterSource).not.toContain('MobileRiskEngine');
    });

    it('adapter executes classifyRisk for every action (tactile confirmation policy)', () => {
      expect(adapterSource).toContain('classifyRisk(intent)');
      expect(adapterSource).toContain('tactile UI confirmation');
    });

    it('destructive actions require requestId', () => {
      expect(adapterSource).toContain('requestId is required for this action');
    });

    it('readiness uses ExecutionReadinessService (authoritative)', () => {
      expect(adapterSource).toContain('ExecutionReadinessService.evaluateReadiness');
    });

    it('identity from resolveWebIdentity (session-based)', () => {
      expect(adapterSource).toContain('resolveWebIdentity');
    });

    it('authorization via checkAuthorization (R3 boundary)', () => {
      expect(adapterSource).toContain('checkAuthorization');
    });
  });
});
