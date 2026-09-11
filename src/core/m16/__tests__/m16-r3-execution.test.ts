/**
 * M16-R3 — Governed Execution Actions Tests
 *
 * Verifies:
 * 1. Write tool registration + governance
 * 2. Confirmation gate state machine
 * 3. Authorization enforcement
 * 4. Pipeline E2E with confirmation
 * 5. Channel restrictions
 * 6. Source scan: all writes → EWS.applyAction()
 * 7. Security: no direct prisma mutations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { M16Intent, INTENT_METADATA, M16IntentCategory, getIntentCategory } from '../intents';
import { ActionRiskLevel, classifyRisk, ConfirmationRequirement, isAllowedOnChannel } from '../risk';
import {
  requiresExplicitConfirmation,
  canAutoConfirm,
  createPendingConfirmation,
  getPendingConfirmation,
  isConfirmationResponse,
  confirmPending,
  cancelPending,
  clearAllPendingConfirmations,
  buildConfirmationPrompt,
} from '../pipeline/ConfirmationGate';
import {
  formatConfirmationPrompt,
  formatConfirmationCancelled,
  formatExecutionSuccess,
  formatPermissionDenied,
} from '../response/ResponseFormatter';
import { checkAuthorization, getRequiredPermissionForIntent } from '../auth/M16AuthorizationBoundary';
import type { M16InteractionContext, M16ResolvedEntities } from '../types';
import type { ToolResult, ToolParams } from '../tools/ToolRegistry';

// ── Test Context Builders ─────────────────────────────────────────────────────

function buildTestContext(overrides?: Partial<M16InteractionContext>): M16InteractionContext {
  return Object.freeze({
    organizationId: 'org-test-001',
    userId: 'user-test-001',
    channel: 'web' as const,
    conversationId: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventId: 'event-test-001',
    identitySource: 'session_cookie' as const,
    siteId: 'site-test-001',
    messageId: null,
    ...overrides,
  });
}

// ── Source Scanner ─────────────────────────────────────────────────────────────

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

function readSourceStrippingComments(dir: string): string {
  const files = findTsFiles(dir);
  return files.map((f) => {
    const content = fs.readFileSync(f, 'utf-8');
    return content
      .replace(/\/\*\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
  }).join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R3 Governed Execution Actions', () => {

  beforeEach(() => {
    clearAllPendingConfirmations();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Write Tool Registration + Governance
  // ──────────────────────────────────────────────────────────────────────────

  describe('Write Tool Governance', () => {
    const EXECUTION_INTENTS = [
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

    it('every execution intent has a risk classification', () => {
      for (const intent of EXECUTION_INTENTS) {
        const risk = classifyRisk(intent);
        expect(risk).toBeDefined();
        expect(risk.riskLevel).not.toBe(ActionRiskLevel.READ);
      }
    });

    it('every execution intent has a required permission', () => {
      for (const intent of EXECUTION_INTENTS) {
        const perm = getRequiredPermissionForIntent(intent);
        expect(perm).not.toBeNull();
        expect(perm).toMatch(/^execution\./);
      }
    });

    it('DESTRUCTIVE actions require EXPLICIT confirmation', () => {
      const destructiveIntents = [
        M16Intent.COMPLETE_ACTIVITY,
        M16Intent.VERIFY_ACTIVITY,
        M16Intent.CLOSE_ACTIVITY,
      ];
      for (const intent of destructiveIntents) {
        const risk = classifyRisk(intent);
        expect(risk.riskLevel).toBe(ActionRiskLevel.DESTRUCTIVE);
        expect(risk.confirmation).toBe(ConfirmationRequirement.EXPLICIT);
      }
    });

    it('HIGH_RISK_WRITE actions require EXPLICIT confirmation', () => {
      const highRiskIntents = [
        M16Intent.START_ACTIVITY,
        M16Intent.HOLD_ACTIVITY,
        M16Intent.RESUME_ACTIVITY,
        M16Intent.RELEASE_ACTIVITY,
      ];
      for (const intent of highRiskIntents) {
        const risk = classifyRisk(intent);
        expect(risk.riskLevel).toBe(ActionRiskLevel.HIGH_RISK_WRITE);
        expect(risk.confirmation).toBe(ConfirmationRequirement.EXPLICIT);
      }
    });

    it('LOW_RISK_WRITE actions use IMPLICIT confirmation (no gate)', () => {
      const lowRiskIntents = [
        M16Intent.UPDATE_PROGRESS,
        M16Intent.REPORT_DELAY,
      ];
      for (const intent of lowRiskIntents) {
        const risk = classifyRisk(intent);
        expect(risk.riskLevel).toBe(ActionRiskLevel.LOW_RISK_WRITE);
        expect(risk.confirmation).toBe(ConfirmationRequirement.IMPLICIT);
      }
    });

    // R5 POLICY CHANGE: Voice now allowed for ALL execution intents.
    // R3 ConfirmationGate enforces EXPLICIT confirmation for HIGH_RISK/DESTRUCTIVE
    // actions — the confirmation gate IS the safety boundary, not the channel filter.
    // Governance intents remain voice-blocked.
    it('voice channel allows all execution intents (R5 policy)', () => {
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

    it('voice channel still blocks governance intents', () => {
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
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Confirmation Gate State Machine
  // ──────────────────────────────────────────────────────────────────────────

  describe('Confirmation Gate', () => {
    it('creates a pending confirmation', () => {
      const pending = createPendingConfirmation(
        'conv-1', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-1' }, 'Start Bundle Pullout'
      );
      expect(pending.status).toBe('PENDING');
      expect(pending.intent).toBe(M16Intent.START_ACTIVITY);
    });

    it('retrieves pending confirmation', () => {
      createPendingConfirmation(
        'conv-2', M16Intent.HOLD_ACTIVITY, 'holdActivity',
        { activityId: 'act-2' }, 'Hold activity'
      );
      const result = getPendingConfirmation('conv-2');
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(M16Intent.HOLD_ACTIVITY);
    });

    it('returns null for non-existent conversation', () => {
      const result = getPendingConfirmation('conv-nonexistent');
      expect(result).toBeNull();
    });

    it('cancels old confirmation when new one is created', () => {
      const first = createPendingConfirmation(
        'conv-3', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-1' }, 'Start activity'
      );
      const second = createPendingConfirmation(
        'conv-3', M16Intent.HOLD_ACTIVITY, 'holdActivity',
        { activityId: 'act-2' }, 'Hold activity'
      );
      expect(first.status).toBe('CANCELLED');
      expect(second.status).toBe('PENDING');

      const result = getPendingConfirmation('conv-3');
      expect(result!.intent).toBe(M16Intent.HOLD_ACTIVITY);
    });

    it('confirms a pending action', () => {
      createPendingConfirmation(
        'conv-4', M16Intent.COMPLETE_ACTIVITY, 'completeActivity',
        { activityId: 'act-1' }, 'Complete activity'
      );
      const confirmed = confirmPending('conv-4');
      expect(confirmed).not.toBeNull();
      expect(confirmed!.status).toBe('CONFIRMED');

      // After confirmation, no more pending
      const result = getPendingConfirmation('conv-4');
      expect(result).toBeNull();
    });

    it('cancels a pending action', () => {
      createPendingConfirmation(
        'conv-5', M16Intent.START_ACTIVITY, 'startActivity',
        { activityId: 'act-1' }, 'Start activity'
      );
      const cancelled = cancelPending('conv-5');
      expect(cancelled).toBe(true);

      const result = getPendingConfirmation('conv-5');
      expect(result).toBeNull();
    });

    it('cancel returns false for non-existent', () => {
      expect(cancelPending('conv-nonexistent')).toBe(false);
    });

    it('correctly identifies confirmation responses', () => {
      expect(isConfirmationResponse('yes')).toBe('confirm');
      expect(isConfirmationResponse('YES')).toBe('confirm');
      expect(isConfirmationResponse('y')).toBe('confirm');
      expect(isConfirmationResponse('confirm')).toBe('confirm');
      expect(isConfirmationResponse('proceed')).toBe('confirm');
      expect(isConfirmationResponse('go ahead')).toBe('confirm');

      expect(isConfirmationResponse('no')).toBe('cancel');
      expect(isConfirmationResponse('cancel')).toBe('cancel');
      expect(isConfirmationResponse('abort')).toBe('cancel');
      expect(isConfirmationResponse('never mind')).toBe('cancel');

      expect(isConfirmationResponse('what is progress?')).toBe('other');
      expect(isConfirmationResponse('start HX-204')).toBe('other');
    });

    it('requiresExplicitConfirmation correctly classifies intents', () => {
      expect(requiresExplicitConfirmation(M16Intent.START_ACTIVITY)).toBe(true);
      expect(requiresExplicitConfirmation(M16Intent.COMPLETE_ACTIVITY)).toBe(true);
      expect(requiresExplicitConfirmation(M16Intent.UPDATE_PROGRESS)).toBe(false);
      expect(requiresExplicitConfirmation(M16Intent.GET_PROGRESS)).toBe(false);
    });

    it('canAutoConfirm correctly classifies intents', () => {
      expect(canAutoConfirm(M16Intent.UPDATE_PROGRESS)).toBe(true);
      expect(canAutoConfirm(M16Intent.REPORT_DELAY)).toBe(true);
      expect(canAutoConfirm(M16Intent.GET_PROGRESS)).toBe(true);
      expect(canAutoConfirm(M16Intent.START_ACTIVITY)).toBe(false);
      expect(canAutoConfirm(M16Intent.COMPLETE_ACTIVITY)).toBe(false);
    });

    it('builds confirmation prompt with risk warning', () => {
      const prompt = buildConfirmationPrompt(M16Intent.COMPLETE_ACTIVITY, 'Complete Bundle Pullout on HX-204');
      expect(prompt).toContain('Bundle Pullout');
      expect(prompt).toContain('YES');
      expect(prompt).toContain('NO');
      expect(prompt).toContain('reverse'); // Destructive warning
    });

    it('builds confirmation prompt for HIGH_RISK without destructive warning', () => {
      const prompt = buildConfirmationPrompt(M16Intent.START_ACTIVITY, 'Start Bundle Pullout');
      expect(prompt).toContain('Bundle Pullout');
      expect(prompt).toContain('YES');
      expect(prompt).not.toContain('reverse');
      expect(prompt).toContain('significant state change');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Authorization Enforcement
  // ──────────────────────────────────────────────────────────────────────────

  describe('Authorization Enforcement', () => {
    it('query intents always pass authorization', () => {
      const ctx = buildTestContext();
      const result = checkAuthorization(ctx, M16Intent.GET_PROGRESS, null);
      expect(result.authorized).toBe(true);
    });

    it('execution intent without event context is denied', () => {
      const ctx = buildTestContext({ eventId: null });
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null);
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('event context');
    });

    it('governance intents are blocked in R3', () => {
      const ctx = buildTestContext();
      const result = checkAuthorization(ctx, M16Intent.CHANGE_SCOPE, null);
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('not yet available');
    });

    it('voice channel blocks governance intents', () => {
      const ctx = buildTestContext({ channel: 'voice' });
      const result = checkAuthorization(ctx, M16Intent.CHANGE_SCOPE, null);
      expect(result.authorized).toBe(false);
    });

    it('whatsapp channel blocks governance intents', () => {
      const ctx = buildTestContext({ channel: 'whatsapp' });
      const result = checkAuthorization(ctx, M16Intent.CHANGE_SCHEDULE, null);
      expect(result.authorized).toBe(false);
    });

    it('execution intent with event context but NO role → DENIED (fail-closed)', () => {
      const ctx = buildTestContext();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null);
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('No role was provided');
    });

    it('viewer role is denied execution permissions', () => {
      const ctx = buildTestContext();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, 'viewer');
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('permission');
    });

    it('execution_engineer role has execution.start permission', () => {
      const ctx = buildTestContext();
      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null, 'execution_engineer');
      expect(result.authorized).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Response Formatting
  // ──────────────────────────────────────────────────────────────────────────

  describe('R3 Response Formatting', () => {
    it('formats confirmation prompt', () => {
      const response = formatConfirmationPrompt('Start activity?', M16Intent.START_ACTIVITY);
      expect(response.text).toContain('Start activity');
      expect(response.suggestions).toContain('YES');
      expect(response.suggestions).toContain('NO');
      expect(response.grounded).toBe(true);
    });

    it('formats cancellation response', () => {
      const response = formatConfirmationCancelled();
      expect(response.text).toContain('cancelled');
      expect(response.grounded).toBe(true);
    });

    it('formats successful execution', () => {
      const toolResult: ToolResult = {
        status: 'SUCCESS',
        data: { activity: { status: 'in_progress', progress_percent: 10 }, success: true },
        summary: 'Activity started',
        authority: 'ExecutionWriteService',
      };
      const response = formatExecutionSuccess(toolResult, M16Intent.START_ACTIVITY);
      expect(response.text).toContain('✅');
      expect(response.text).toContain('Activity started');
      expect(response.card).not.toBeNull();
    });

    it('formats failed execution', () => {
      const toolResult: ToolResult = {
        status: 'ERROR',
        data: null,
        summary: 'Cannot start: prerequisites not met',
        authority: 'ExecutionWriteService',
      };
      const response = formatExecutionSuccess(toolResult, M16Intent.START_ACTIVITY);
      expect(response.text).toContain('⚠️');
      expect(response.text).toContain('prerequisites');
    });

    it('formats permission denied', () => {
      const response = formatPermissionDenied('You need execution.start permission');
      expect(response.text).toContain('🔒');
      expect(response.text).toContain('execution.start');
      expect(response.authority).toBe('M16 Authorization');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Source Scan: All Writes → EWS
  // ──────────────────────────────────────────────────────────────────────────

  describe('Source Scan: Write Tool Governance', () => {
    const M16_DIR = path.resolve(__dirname, '..');
    const writeToolsPath = path.resolve(M16_DIR, 'tools', 'writeTools.ts');

    it('writeTools.ts exists', () => {
      expect(fs.existsSync(writeToolsPath)).toBe(true);
    });

    it('writeTools.ts contains source_channel: ai', () => {
      const src = fs.readFileSync(writeToolsPath, 'utf-8');
      expect(src).toContain("source_channel: 'ai'");
    });

    it('writeTools.ts delegates to ExecutionWriteService', () => {
      const src = fs.readFileSync(writeToolsPath, 'utf-8');
      expect(src).toContain('ExecutionWriteService');
      expect(src).toContain('applyAction');
    });

    it('writeTools.ts does NOT contain direct prisma.activity mutations', () => {
      const src = readSourceStrippingComments(path.resolve(M16_DIR, 'tools'));
      expect(src).not.toContain('prisma.activity.update');
      expect(src).not.toContain('prisma.activity.create');
      expect(src).not.toContain('prisma.activity.delete');
      expect(src).not.toContain('prisma.workpack.update');
      expect(src).not.toContain('prisma.workpack.create');
      expect(src).not.toContain('prisma.workpack.delete');
    });

    it('ConfirmationGate.ts does NOT execute domain actions', () => {
      const gatePath = path.resolve(M16_DIR, 'pipeline', 'ConfirmationGate.ts');
      const src = fs.readFileSync(gatePath, 'utf-8');
      expect(src).not.toContain('prisma.');
      expect(src).not.toContain('ExecutionWriteService');
      expect(src).not.toContain('applyAction');
    });

    it('all writeTools declare readWrite: write', () => {
      const src = fs.readFileSync(writeToolsPath, 'utf-8');
      // Count how many readWrite: 'write' we find
      const writeMatches = src.match(/readWrite:\s*'write'/g);
      // Must have exactly 9 (one per write tool)
      expect(writeMatches).not.toBeNull();
      expect(writeMatches!.length).toBe(9);
    });

    it('all writeTools pass source_channel as ai', () => {
      const src = fs.readFileSync(writeToolsPath, 'utf-8');
      // The only source_channel in writeTools should be 'ai'
      const sourceChannels = src.match(/source_channel:\s*'[^']+'/g) || [];
      for (const sc of sourceChannels) {
        expect(sc).toContain("'ai'");
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Authority Boundary — No new domain engines
  // ──────────────────────────────────────────────────────────────────────────

  describe('Authority Boundary', () => {
    const M16_DIR = path.resolve(__dirname, '..');
    const allSource = readSourceStrippingComments(M16_DIR);

    it('zero prisma.activity.(update|create|delete) in M16 pipeline or tools', () => {
      expect(allSource).not.toContain('prisma.activity.update');
      expect(allSource).not.toContain('prisma.activity.create');
      expect(allSource).not.toContain('prisma.activity.delete');
    });

    it('zero prisma.workpack.(update|create|delete) in M16', () => {
      expect(allSource).not.toContain('prisma.workpack.update');
      expect(allSource).not.toContain('prisma.workpack.create');
      expect(allSource).not.toContain('prisma.workpack.delete');
    });

    it('zero prisma.progress_log.create in M16', () => {
      expect(allSource).not.toContain('prisma.progress_log.create');
    });

    it('zero calculateProgressMetrics in M16', () => {
      expect(allSource).not.toContain('calculateProgressMetrics');
    });

    it('zero direct fetch to OpenAI in M16', () => {
      expect(allSource).not.toContain("fetch('https://api.openai.com");
      expect(allSource).not.toContain('fetch("https://api.openai.com');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Pipeline Integration
  // ──────────────────────────────────────────────────────────────────────────

  describe('Pipeline Integration', () => {
    it('pipeline output includes pendingConfirmation field', () => {
      // Verify the type contract includes pendingConfirmation
      const pipelinePath = path.resolve(__dirname, '..', 'pipeline', 'M16InteractionPipeline.ts');
      const src = fs.readFileSync(pipelinePath, 'utf-8');
      expect(src).toContain('pendingConfirmation');
    });

    it('pipeline imports confirmation gate', () => {
      const pipelinePath = path.resolve(__dirname, '..', 'pipeline', 'M16InteractionPipeline.ts');
      const src = fs.readFileSync(pipelinePath, 'utf-8');
      expect(src).toContain('ConfirmationGate');
      expect(src).toContain('getPendingConfirmation');
      expect(src).toContain('isConfirmationResponse');
    });

    it('pipeline imports authorization boundary', () => {
      const pipelinePath = path.resolve(__dirname, '..', 'pipeline', 'M16InteractionPipeline.ts');
      const src = fs.readFileSync(pipelinePath, 'utf-8');
      expect(src).toContain('checkAuthorization');
    });

    it('pipeline uses EWS delegation for execution (never direct prisma)', () => {
      const pipelinePath = path.resolve(__dirname, '..', 'pipeline', 'M16InteractionPipeline.ts');
      const src = fs.readFileSync(pipelinePath, 'utf-8');
      // Pipeline should NOT contain prisma mutations
      const stripped = src
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(stripped).not.toContain('prisma.activity.update');
    });
  });
});
