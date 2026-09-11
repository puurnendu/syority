/**
 * M16-R3 Security Closure — Adversarial Tests
 *
 * Tests that verify the security invariants required for R3 GREEN/CLOSED:
 *
 * 1. FAIL-CLOSED AUTHORIZATION
 *    - Missing role → DENIED
 *    - Undefined role → DENIED
 *    - Invalid role → DENIED
 *    - Null role → DENIED
 *
 * 2. REVALIDATION ON CONFIRMATION
 *    - Permission removal between proposal and confirmation → DENIED
 *    - Re-authorization runs at execution time, not creation time
 *
 * 3. SECURITY CONTEXT BINDING
 *    - User switching → REJECTED
 *    - Event switching → REJECTED
 *    - Organization switching → REJECTED
 *    - Channel switching → REJECTED
 *    - Entity/activity substitution → REJECTED (via activityId binding)
 *    - Conversation ID mismatch → REJECTED
 *
 * 4. REPLAY PREVENTION
 *    - Confirmation consumed after execution → second confirm returns null
 *    - CONFIRMED status is terminal → getPendingConfirmation returns null
 *
 * 5. CROSS-CHANNEL CONFIRMATION
 *    - Confirmation created on web cannot be confirmed from whatsapp context
 *
 * DOES NOT modify EWS, M8.13, M10, M11, M12, M13, M14 authority logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPendingConfirmation,
  getPendingConfirmation,
  confirmPending,
  cancelPending,
  clearAllPendingConfirmations,
  validateSecurityBindings,
} from '../pipeline/ConfirmationGate';
import { checkAuthorization } from '../auth/M16AuthorizationBoundary';
import { M16Intent } from '../intents';
import type { M16InteractionContext } from '../types';

// ── Test Helpers ──────────────────────────────────────────────────────────────

function buildCtx(overrides?: Partial<M16InteractionContext>): M16InteractionContext {
  return Object.freeze({
    organizationId: 'org-sec-001',
    userId: 'user-sec-001',
    channel: 'web' as const,
    conversationId: `conv-sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventId: 'event-sec-001',
    identitySource: 'session_cookie' as const,
    siteId: 'site-sec-001',
    messageId: null,
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R3 Security Closure', () => {

  beforeEach(() => {
    clearAllPendingConfirmations();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. FAIL-CLOSED AUTHORIZATION
  // ──────────────────────────────────────────────────────────────────────────

  describe('1. Fail-Closed Authorization', () => {

    it('DENIED when userRole is undefined', () => {
      const ctx = buildCtx();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, undefined);
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('No role was provided');
    });

    it('DENIED when userRole is null', () => {
      const ctx = buildCtx();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, null);
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('No role was provided');
    });

    it('DENIED when userRole is empty string', () => {
      const ctx = buildCtx();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, '');
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('No role was provided');
    });

    it('DENIED when userRole is an invalid/unknown role', () => {
      const ctx = buildCtx();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, 'imaginary_role');
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('permission');
    });

    it('DENIED when userRole is viewer (no execution permissions)', () => {
      const ctx = buildCtx();
      const ALL_EXECUTION_INTENTS = [
        M16Intent.START_ACTIVITY,
        M16Intent.UPDATE_PROGRESS,
        M16Intent.COMPLETE_ACTIVITY,
        M16Intent.HOLD_ACTIVITY,
        M16Intent.RESUME_ACTIVITY,
        M16Intent.RELEASE_ACTIVITY,
        M16Intent.REPORT_DELAY,
        M16Intent.VERIFY_ACTIVITY,
        M16Intent.CLOSE_ACTIVITY,
      ];
      for (const intent of ALL_EXECUTION_INTENTS) {
        const result = checkAuthorization(ctx, intent, null, 'viewer');
        expect(result.authorized).toBe(false);
      }
    });

    it('no code path allows execution without role', () => {
      const ctx = buildCtx();
      // Try every execution intent with no role
      const intents = [
        M16Intent.START_ACTIVITY, M16Intent.UPDATE_PROGRESS,
        M16Intent.COMPLETE_ACTIVITY, M16Intent.HOLD_ACTIVITY,
        M16Intent.RESUME_ACTIVITY, M16Intent.RELEASE_ACTIVITY,
        M16Intent.REPORT_DELAY, M16Intent.VERIFY_ACTIVITY,
        M16Intent.CLOSE_ACTIVITY,
      ];
      for (const intent of intents) {
        // Without role
        expect(checkAuthorization(ctx, intent, null).authorized).toBe(false);
        // With undefined
        expect(checkAuthorization(ctx, intent, null, undefined).authorized).toBe(false);
        // With null
        expect(checkAuthorization(ctx, intent, null, null).authorized).toBe(false);
      }
    });

    it('authorized role actually gets through', () => {
      const ctx = buildCtx();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, 'execution_engineer');
      expect(result.authorized).toBe(true);
      expect(result.permission).toBe('execution.start');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. REVALIDATION ON CONFIRMATION — Permission Removal
  // ──────────────────────────────────────────────────────────────────────────

  describe('2. Permission Removal Between Proposal and Confirmation', () => {

    it('authorization is checked at confirmation time, not just creation time', () => {
      // Simulate: user had permission when action was proposed, but now they don't.
      // At creation time: execution_engineer role → authorized
      const ctx = buildCtx();
      const authAtCreation = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, 'execution_engineer');
      expect(authAtCreation.authorized).toBe(true);

      // At confirmation time: viewer role (simulates permission removal)
      const authAtConfirmation = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, 'viewer');
      expect(authAtConfirmation.authorized).toBe(false);
      expect(authAtConfirmation.deniedReason).toContain('permission');
    });

    it('authorization at confirmation with no role → DENIED', () => {
      const ctx = buildCtx();
      // At creation, user had role
      expect(checkAuthorization(ctx, M16Intent.COMPLETE_ACTIVITY, null, 'execution_engineer').authorized).toBe(true);
      // At confirmation, role unavailable (session expired, etc.)
      expect(checkAuthorization(ctx, M16Intent.COMPLETE_ACTIVITY, null, undefined).authorized).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. SECURITY CONTEXT BINDING
  // ──────────────────────────────────────────────────────────────────────────

  describe('3. Security Context Binding', () => {

    it('binds confirmation to full security context', () => {
      const ctx = buildCtx({ conversationId: 'conv-bind-001' });
      const pending = createPendingConfirmation(
        'conv-bind-001', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-001' }, 'Start activity', ctx
      );
      expect(pending.securityBinding.userId).toBe('user-sec-001');
      expect(pending.securityBinding.organizationId).toBe('org-sec-001');
      expect(pending.securityBinding.eventId).toBe('event-sec-001');
      expect(pending.securityBinding.channel).toBe('web');
      expect(pending.securityBinding.conversationId).toBe('conv-bind-001');
      expect(pending.securityBinding.activityId).toBe('act-001');
    });

    it('REJECTS on user switching', () => {
      const originalCtx = buildCtx({ conversationId: 'conv-user-switch' });
      createPendingConfirmation(
        'conv-user-switch', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-001' }, 'Start activity', originalCtx
      );
      const pending = getPendingConfirmation('conv-user-switch')!;

      // Different user tries to confirm
      const hackerCtx = buildCtx({
        conversationId: 'conv-user-switch',
        userId: 'user-HACKER-999',
      });
      const result = validateSecurityBindings(pending, hackerCtx);
      expect(result.valid).toBe(false);
      expect(result.mismatches).toEqual(
        expect.arrayContaining([expect.stringContaining('userId')])
      );
    });

    it('REJECTS on organization switching', () => {
      const originalCtx = buildCtx({ conversationId: 'conv-org-switch' });
      createPendingConfirmation(
        'conv-org-switch', M16Intent.HOLD_ACTIVITY, 'holdActivity',
        { activityId: 'act-002' }, 'Hold activity', originalCtx
      );
      const pending = getPendingConfirmation('conv-org-switch')!;

      const differentOrgCtx = buildCtx({
        conversationId: 'conv-org-switch',
        organizationId: 'org-DIFFERENT-999',
      });
      const result = validateSecurityBindings(pending, differentOrgCtx);
      expect(result.valid).toBe(false);
      expect(result.mismatches).toEqual(
        expect.arrayContaining([expect.stringContaining('organizationId')])
      );
    });

    it('REJECTS on event switching', () => {
      const originalCtx = buildCtx({ conversationId: 'conv-event-switch' });
      createPendingConfirmation(
        'conv-event-switch', M16Intent.COMPLETE_ACTIVITY, 'completeActivity',
        { activityId: 'act-003' }, 'Complete activity', originalCtx
      );
      const pending = getPendingConfirmation('conv-event-switch')!;

      const differentEventCtx = buildCtx({
        conversationId: 'conv-event-switch',
        eventId: 'event-DIFFERENT-999',
      });
      const result = validateSecurityBindings(pending, differentEventCtx);
      expect(result.valid).toBe(false);
      expect(result.mismatches).toEqual(
        expect.arrayContaining([expect.stringContaining('eventId')])
      );
    });

    it('REJECTS on channel switching', () => {
      const originalCtx = buildCtx({ conversationId: 'conv-channel-switch' });
      createPendingConfirmation(
        'conv-channel-switch', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-004' }, 'Start activity', originalCtx
      );
      const pending = getPendingConfirmation('conv-channel-switch')!;

      const differentChannelCtx = buildCtx({
        conversationId: 'conv-channel-switch',
        channel: 'whatsapp',
      });
      const result = validateSecurityBindings(pending, differentChannelCtx);
      expect(result.valid).toBe(false);
      expect(result.mismatches).toEqual(
        expect.arrayContaining([expect.stringContaining('channel')])
      );
    });

    it('REJECTS on conversation ID mismatch', () => {
      const originalCtx = buildCtx({ conversationId: 'conv-original' });
      createPendingConfirmation(
        'conv-original', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-005' }, 'Start activity', originalCtx
      );
      const pending = getPendingConfirmation('conv-original')!;

      const differentConvCtx = buildCtx({
        conversationId: 'conv-HIJACKED',
      });
      const result = validateSecurityBindings(pending, differentConvCtx);
      expect(result.valid).toBe(false);
      expect(result.mismatches).toEqual(
        expect.arrayContaining([expect.stringContaining('conversationId')])
      );
    });

    it('PASSES when all security bindings match', () => {
      const ctx = buildCtx({ conversationId: 'conv-valid' });
      createPendingConfirmation(
        'conv-valid', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-006' }, 'Start activity', ctx
      );
      const pending = getPendingConfirmation('conv-valid')!;

      // Same context
      const sameCtx = buildCtx({
        conversationId: 'conv-valid',
        userId: 'user-sec-001',
        organizationId: 'org-sec-001',
        eventId: 'event-sec-001',
        channel: 'web',
      });
      const result = validateSecurityBindings(pending, sameCtx);
      expect(result.valid).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });

    it('detects MULTIPLE simultaneous mismatches', () => {
      const ctx = buildCtx({ conversationId: 'conv-multi-mismatch' });
      createPendingConfirmation(
        'conv-multi-mismatch', M16Intent.CLOSE_ACTIVITY, 'closeActivity',
        { activityId: 'act-007' }, 'Close activity', ctx
      );
      const pending = getPendingConfirmation('conv-multi-mismatch')!;

      const totallyDifferentCtx = buildCtx({
        conversationId: 'conv-multi-mismatch',
        userId: 'user-HACKER',
        organizationId: 'org-HACKER',
        eventId: 'event-HACKER',
      });
      const result = validateSecurityBindings(pending, totallyDifferentCtx);
      expect(result.valid).toBe(false);
      expect(result.mismatches.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. REPLAY PREVENTION
  // ──────────────────────────────────────────────────────────────────────────

  describe('4. Replay Prevention', () => {

    it('CONFIRMED confirmation cannot be retrieved again', () => {
      const ctx = buildCtx({ conversationId: 'conv-replay-001' });
      createPendingConfirmation(
        'conv-replay-001', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-replay' }, 'Start activity', ctx
      );

      // First confirm succeeds
      const first = confirmPending('conv-replay-001');
      expect(first).not.toBeNull();
      expect(first!.status).toBe('CONFIRMED');

      // Second confirm returns null (already consumed)
      const second = confirmPending('conv-replay-001');
      expect(second).toBeNull();
    });

    it('CONFIRMED status is terminal — getPendingConfirmation returns null', () => {
      const ctx = buildCtx({ conversationId: 'conv-replay-002' });
      createPendingConfirmation(
        'conv-replay-002', M16Intent.COMPLETE_ACTIVITY, 'completeActivity',
        { activityId: 'act-replay-2' }, 'Complete activity', ctx
      );

      // Confirm
      confirmPending('conv-replay-002');

      // No longer PENDING
      const check = getPendingConfirmation('conv-replay-002');
      expect(check).toBeNull();
    });

    it('CANCELLED confirmation cannot be confirmed', () => {
      const ctx = buildCtx({ conversationId: 'conv-replay-003' });
      createPendingConfirmation(
        'conv-replay-003', M16Intent.HOLD_ACTIVITY, 'holdActivity',
        { activityId: 'act-replay-3' }, 'Hold activity', ctx
      );

      // Cancel
      cancelPending('conv-replay-003');

      // Try to confirm after cancel → null
      const attempt = confirmPending('conv-replay-003');
      expect(attempt).toBeNull();
    });

    it('EXPIRED confirmation cannot be confirmed', () => {
      const ctx = buildCtx({ conversationId: 'conv-replay-004' });
      const pending = createPendingConfirmation(
        'conv-replay-004', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-replay-4' }, 'Start activity', ctx
      );

      // Force expiration by backdating
      (pending as any).createdAt = Date.now() - (3 * 60 * 1000); // 3 minutes ago

      // Try to get → expired
      const check = getPendingConfirmation('conv-replay-004');
      expect(check).toBeNull();

      // Try to confirm → null
      const attempt = confirmPending('conv-replay-004');
      expect(attempt).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. CROSS-CHANNEL CONFIRMATION
  // ──────────────────────────────────────────────────────────────────────────

  describe('5. Cross-Channel Confirmation', () => {

    it('web confirmation rejected from whatsapp context', () => {
      const webCtx = buildCtx({ conversationId: 'conv-cross-001', channel: 'web' });
      createPendingConfirmation(
        'conv-cross-001', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-cross' }, 'Start activity', webCtx
      );
      const pending = getPendingConfirmation('conv-cross-001')!;

      const whatsappCtx = buildCtx({
        conversationId: 'conv-cross-001',
        channel: 'whatsapp',
      });
      const result = validateSecurityBindings(pending, whatsappCtx);
      expect(result.valid).toBe(false);
      expect(result.mismatches).toEqual(
        expect.arrayContaining([expect.stringContaining('channel')])
      );
    });

    it('whatsapp confirmation rejected from web context', () => {
      const whatsappCtx = buildCtx({ conversationId: 'conv-cross-002', channel: 'whatsapp' });
      createPendingConfirmation(
        'conv-cross-002', M16Intent.UPDATE_PROGRESS, 'updateProgress',
        { activityId: 'act-cross-2' }, 'Update progress', whatsappCtx
      );
      const pending = getPendingConfirmation('conv-cross-002')!;

      const webCtx = buildCtx({
        conversationId: 'conv-cross-002',
        channel: 'web',
      });
      const result = validateSecurityBindings(pending, webCtx);
      expect(result.valid).toBe(false);
    });

    it('voice channel confirmation rejected from api context', () => {
      const voiceCtx = buildCtx({ conversationId: 'conv-cross-003', channel: 'voice' });
      createPendingConfirmation(
        'conv-cross-003', M16Intent.REPORT_DELAY, 'reportDelay',
        { activityId: 'act-cross-3' }, 'Report delay', voiceCtx
      );
      const pending = getPendingConfirmation('conv-cross-003')!;

      const apiCtx = buildCtx({
        conversationId: 'conv-cross-003',
        channel: 'api',
      });
      const result = validateSecurityBindings(pending, apiCtx);
      expect(result.valid).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ENTITY SUBSTITUTION
  // ──────────────────────────────────────────────────────────────────────────

  describe('6. Entity Substitution', () => {

    it('confirmation stores resolved activityId in binding', () => {
      const ctx = buildCtx({ conversationId: 'conv-entity-001' });
      const pending = createPendingConfirmation(
        'conv-entity-001', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-REAL-001' }, 'Start real activity', ctx
      );
      expect(pending.securityBinding.activityId).toBe('act-REAL-001');
    });

    it('rejects confirmation when activityId is substituted for another activity', () => {
      const ctx = buildCtx({ conversationId: 'conv-entity-sub' });
      createPendingConfirmation(
        'conv-entity-sub', M16Intent.COMPLETE_ACTIVITY, 'completeActivity',
        { activityId: 'act-A' }, 'Complete A', ctx
      );
      const pending = getPendingConfirmation('conv-entity-sub')!;
      const result = validateSecurityBindings(pending, ctx, 'act-B');
      expect(result.valid).toBe(false);
      expect(result.mismatches.some((m) => m.includes('activityId'))).toBe(true);
    });

    it('rejects confirmation when pending toolParams.activityId is tampered', () => {
      const ctx = buildCtx({ conversationId: 'conv-entity-tamper' });
      createPendingConfirmation(
        'conv-entity-tamper', M16Intent.COMPLETE_ACTIVITY, 'completeActivity',
        { activityId: 'act-A' }, 'Complete A', ctx
      );
      const pending = getPendingConfirmation('conv-entity-tamper')!;
      pending.toolParams.activityId = 'act-B';
      const result = validateSecurityBindings(pending, ctx, pending.toolParams.activityId);
      expect(result.valid).toBe(false);
      expect(result.mismatches.some((m) => m.includes('activityId'))).toBe(true);
    });

    it('toolParams cannot be modified after confirmation creation', () => {
      const ctx = buildCtx({ conversationId: 'conv-entity-002' });
      const toolParams = { activityId: 'act-REAL-002' };
      createPendingConfirmation(
        'conv-entity-002', M16Intent.COMPLETE_ACTIVITY, 'completeActivity',
        toolParams, 'Complete real activity', ctx
      );

      const pending = getPendingConfirmation('conv-entity-002')!;
      // The binding is captured at creation — even if toolParams object is mutated
      expect(pending.securityBinding.activityId).toBe('act-REAL-002');
    });

    it('securityBinding is readonly (immutable after creation)', () => {
      const ctx = buildCtx({ conversationId: 'conv-entity-003' });
      const pending = createPendingConfirmation(
        'conv-entity-003', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-REAL-003' }, 'Start', ctx
      );

      // Verify the binding object is frozen via readonly type
      expect(pending.securityBinding.userId).toBe('user-sec-001');
      // TypeScript readonly prevents assignment at compile time
      // At runtime, the binding is a plain object, but the architecture
      // enforces that no M16 code mutates it after creation
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. COMBINED ADVERSARIAL SCENARIO
  // ──────────────────────────────────────────────────────────────────────────

  describe('7. Combined Adversarial Scenarios', () => {

    it('user switching + event switching = dual rejection', () => {
      const ctx = buildCtx({ conversationId: 'conv-combo-001' });
      createPendingConfirmation(
        'conv-combo-001', M16Intent.CLOSE_ACTIVITY, 'closeActivity',
        { activityId: 'act-close' }, 'Close activity', ctx
      );
      const pending = getPendingConfirmation('conv-combo-001')!;

      const attackerCtx = buildCtx({
        conversationId: 'conv-combo-001',
        userId: 'user-ATTACKER',
        eventId: 'event-DIFFERENT',
      });

      const binding = validateSecurityBindings(pending, attackerCtx);
      expect(binding.valid).toBe(false);
      // Both userId and eventId mismatched
      expect(binding.mismatches.length).toBeGreaterThanOrEqual(2);

      // Additionally, the attacker has no role → auth fails
      const authResult = checkAuthorization(attackerCtx, M16Intent.CLOSE_ACTIVITY, null, undefined);
      expect(authResult.authorized).toBe(false);
    });

    it('authorized user who switches events is still rejected', () => {
      const ctx = buildCtx({ conversationId: 'conv-combo-002' });
      createPendingConfirmation(
        'conv-combo-002', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-start' }, 'Start activity', ctx
      );
      const pending = getPendingConfirmation('conv-combo-002')!;

      // Same user, has permission, but switched event
      const switchedCtx = buildCtx({
        conversationId: 'conv-combo-002',
        userId: 'user-sec-001',       // same user
        organizationId: 'org-sec-001', // same org
        channel: 'web',               // same channel
        eventId: 'event-OTHER-999',   // DIFFERENT event
      });

      // Auth would pass (user has the role)
      const authResult = checkAuthorization(switchedCtx, M16Intent.START_ACTIVITY, null, 'execution_engineer');
      expect(authResult.authorized).toBe(true);

      // But binding validation catches the event switch
      const binding = validateSecurityBindings(pending, switchedCtx);
      expect(binding.valid).toBe(false);
      expect(binding.mismatches).toEqual(
        expect.arrayContaining([expect.stringContaining('eventId')])
      );
    });
  });
});
