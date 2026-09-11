/**
 * M16-R5 Cross-Channel Parity Test
 *
 * Proves that the same activity/intent resolves to the same
 * authorization, risk, and execution semantics across all 4 channels.
 */

import { describe, it, expect } from 'vitest';
import { classifyRisk, isAllowedOnChannel, getRequiredPermission, isWriteIntent } from '../risk';
import { M16Intent } from '../intents';
import { checkAuthorization } from '../auth/M16AuthorizationBoundary';
import type { M16InteractionContext } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ctx(channel: string, overrides?: Partial<M16InteractionContext>): M16InteractionContext {
  return Object.freeze({
    organizationId: 'org-parity',
    userId: 'user-parity',
    channel: channel as any,
    conversationId: `conv-${channel}`,
    eventId: 'event-parity',
    identitySource: 'session',
    siteId: 'site-1',
    messageId: 'msg-1',
    ...overrides,
  }) as M16InteractionContext;
}

// ══════════════════════════════════════════════════════════════════════════════

describe('M16-R5: Cross-Channel Parity', () => {

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SAME RISK CLASSIFICATION ACROSS ALL CHANNELS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Risk Parity', () => {
    const intents = Object.values(M16Intent);

    for (const intent of intents) {
      it(`${intent} has same risk/confirmation across channels`, () => {
        const risk = classifyRisk(intent);
        // Risk classification is channel-independent
        expect(risk.riskLevel).toBeDefined();
        expect(risk.confirmation).toBeDefined();
        // Permission requirement is channel-independent
        expect(risk.requiredPermission).toBe(getRequiredPermission(intent));
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SAME AUTHORIZATION SEMANTICS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Authorization Parity', () => {
    const channels = ['web', 'whatsapp', 'voice', 'mobile'];

    it('READ intents authorized on all channels with any role', () => {
      for (const channel of channels) {
        const result = checkAuthorization(ctx(channel), M16Intent.GET_PROGRESS, null, 'viewer');
        expect(result.authorized).toBe(true);
      }
    });

    it('GOVERNANCE intents denied on whatsapp/voice', () => {
      for (const channel of ['whatsapp', 'voice']) {
        const result = checkAuthorization(ctx(channel), M16Intent.CHANGE_SCOPE, null, 'admin');
        expect(result.authorized).toBe(false);
      }
    });

    it('execution intent authorized with correct role on all channels', () => {
      for (const channel of channels) {
        const result = checkAuthorization(ctx(channel), M16Intent.START_ACTIVITY, null, 'execution_engineer');
        // All channels should authorize with the correct role
        // (web/mobile don't have channel restrictions; whatsapp/voice are now allowed for execution)
        expect(result.authorized).toBe(true);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. VOICE NOW ALLOWED FOR EXECUTION (R5 POLICY)
  // ──────────────────────────────────────────────────────────────────────────

  describe('R5 Voice Policy', () => {
    it('voice allows all execution intents (R5 change)', () => {
      const executionIntents = [
        M16Intent.START_ACTIVITY,
        M16Intent.COMPLETE_ACTIVITY,
        M16Intent.HOLD_ACTIVITY,
        M16Intent.RESUME_ACTIVITY,
        M16Intent.RELEASE_ACTIVITY,
        M16Intent.VERIFY_ACTIVITY,
        M16Intent.CLOSE_ACTIVITY,
        M16Intent.UPDATE_PROGRESS,
        M16Intent.REPORT_DELAY,
      ];
      for (const intent of executionIntents) {
        expect(isAllowedOnChannel(intent, 'voice')).toBe(true);
      }
    });

    it('voice still blocks governance intents', () => {
      const govIntents = [
        M16Intent.CHANGE_SCOPE,
        M16Intent.CHANGE_SCHEDULE,
        M16Intent.CHANGE_MASTER_DATA,
        M16Intent.CHANGE_CONFIGURATION,
      ];
      for (const intent of govIntents) {
        expect(isAllowedOnChannel(intent, 'voice')).toBe(false);
      }
    });

    it('all execution intents still require confirmation', () => {
      const executionIntents = [
        M16Intent.START_ACTIVITY,
        M16Intent.COMPLETE_ACTIVITY,
        M16Intent.HOLD_ACTIVITY,
        M16Intent.RESUME_ACTIVITY,
        M16Intent.RELEASE_ACTIVITY,
        M16Intent.VERIFY_ACTIVITY,
        M16Intent.CLOSE_ACTIVITY,
      ];
      for (const intent of executionIntents) {
        const risk = classifyRisk(intent);
        expect(risk.confirmation).not.toBe('NONE');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. WRITE INTENT CLASSIFICATION CONSISTENCY
  // ──────────────────────────────────────────────────────────────────────────

  describe('Write Intent Consistency', () => {
    it('execution intents are classified as writes', () => {
      expect(isWriteIntent(M16Intent.START_ACTIVITY)).toBe(true);
      expect(isWriteIntent(M16Intent.COMPLETE_ACTIVITY)).toBe(true);
      expect(isWriteIntent(M16Intent.HOLD_ACTIVITY)).toBe(true);
    });

    it('read intents are NOT classified as writes', () => {
      expect(isWriteIntent(M16Intent.GET_PROGRESS)).toBe(false);
      expect(isWriteIntent(M16Intent.GET_READINESS)).toBe(false);
      expect(isWriteIntent(M16Intent.HELP)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. CROSS-ADAPTER ARCHITECTURAL INVARIANTS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Cross-Adapter Architecture', () => {
    const adaptersDir = path.resolve(__dirname, '../channels');
    const adapterFiles = fs.readdirSync(adaptersDir)
      .filter(f => f.endsWith('Adapter.ts'))
      .map(f => ({
        name: f,
        source: fs.readFileSync(path.join(adaptersDir, f), 'utf-8'),
      }));

    for (const adapter of adapterFiles) {
      it(`${adapter.name}: no VoiceConfirmationGate`, () => {
        expect(adapter.source).not.toContain('VoiceConfirmationGate');
      });

      it(`${adapter.name}: no MobileConfirmationGate`, () => {
        expect(adapter.source).not.toContain('MobileConfirmationGate');
      });

      it(`${adapter.name}: no WhatsAppConfirmationGate`, () => {
        expect(adapter.source).not.toContain('WhatsAppConfirmationGate');
      });

      it(`${adapter.name}: no duplicate entity resolver`, () => {
        expect(adapter.source).not.toContain('VoiceEntityResolver');
        expect(adapter.source).not.toContain('MobileEntityResolver');
      });

      it(`${adapter.name}: no duplicate risk engine`, () => {
        expect(adapter.source).not.toContain('VoiceRiskEngine');
        expect(adapter.source).not.toContain('MobileRiskEngine');
      });

      it(`${adapter.name}: no progress calculation`, () => {
        expect(adapter.source).not.toContain('calculateProgress');
        expect(adapter.source).not.toContain('overall_progress');
      });
    }
  });
});
