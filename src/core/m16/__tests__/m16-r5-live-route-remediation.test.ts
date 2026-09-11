/**
 * M16-R5 live-route remediation tests.
 *
 * Asserts the files Next.js actually serves (./app over ./src/app) match
 * the governed M16/R3 architecture. Also covers conversational COMPLETE
 * confirmation + activity/event binding through the real pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const mockApplyAction = vi.hoisted(() => vi.fn());

vi.mock('@/core/execution/ExecutionWriteService', () => ({
  ExecutionWriteService: {
    applyAction: (...args: unknown[]) => mockApplyAction(...args),
  },
}));

import { processInteraction } from '../pipeline/M16InteractionPipeline';
import type { PipelineDependencies } from '../pipeline/M16InteractionPipeline';
import { registerR3WriteTools } from '../tools/writeTools';
import { clearRegistry } from '../tools/ToolRegistry';
import { clearAllPendingConfirmations, getPendingConfirmation } from '../pipeline/ConfirmationGate';
import { clearAllConversations } from '../pipeline/ConversationContext';
import type { M16InteractionContext } from '../types';

function waCtx(overrides?: Partial<M16InteractionContext>): M16InteractionContext {
  return {
    organizationId: 'org-live-r5',
    userId: 'user-live-r5',
    channel: 'whatsapp',
    conversationId: 'wa-+919876543210',
    eventId: 'event-live-r5',
    identitySource: 'phone_number',
    siteId: 'site-1',
    messageId: 'msg-1',
    ...overrides,
  };
}

function voiceCtx(overrides?: Partial<M16InteractionContext>): M16InteractionContext {
  return waCtx({
    channel: 'voice',
    conversationId: 'voice-user-live-r5-event-live-r5',
    identitySource: 'session_cookie',
    ...overrides,
  });
}

function pipelineDeps(activityId = 'act-A'): PipelineDependencies {
  return {
    llmCaller: vi.fn().mockResolvedValue(JSON.stringify({
      intent: 'COMPLETE_ACTIVITY',
      confidence: 0.96,
      equipment_tag: null,
      workpack_number: null,
      activity_description: 'Bundle pullout',
      event_code: null,
      unit_name: null,
      discipline: null,
      contractor: null,
      navigation_target: null,
    })),
    resolveEntities: vi.fn().mockResolvedValue({
      equipment: null,
      workpack: null,
      activity: { activityId, description: 'Bundle pullout' },
    }),
    logInteraction: vi.fn().mockResolvedValue(undefined),
  };
}

describe('M16-R5 live Next.js route tree', () => {
  it('Next.js prefers ./app over ./src/app', () => {
    const findPages = read('node_modules/next/dist/lib/find-pages-dir.js');
    expect(findPages).toContain('prioritize ./${name} over ./src/${name}');
    expect(exists('app/api/webhooks/whatsapp/route.ts')).toBe(true);
    expect(exists('app/api/voice/process/route.ts')).toBe(true);
    expect(exists('app/api/mobile/execute/route.ts')).toBe(true);
  });

  it('duplicate M16 API routes under src/app are gone', () => {
    expect(exists('src/app/api/webhooks/whatsapp/route.ts')).toBe(false);
    expect(exists('src/app/api/whatsapp/webhook/route.ts')).toBe(false);
    expect(exists('src/app/api/voice/process/route.ts')).toBe(false);
    expect(exists('src/app/api/mobile/execute/route.ts')).toBe(false);
  });
});

describe('1. Live WhatsApp webhook uses M16 adapter', () => {
  const src = read('app/api/webhooks/whatsapp/route.ts');

  it('delegates to processWhatsAppWebhook', () => {
    expect(src).toContain('processWhatsAppWebhook');
    expect(src).toContain("from '@/core/m16/channels/WhatsAppChannelAdapter'");
  });

  it('does not call MessageProcessor / processInboundMessage', () => {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('processInboundMessage');
    expect(code).not.toContain('MessageProcessor');
    expect(code).not.toContain('applyProgressUpdate');
  });

  it('uses governed pipeline dependencies', () => {
    expect(src).toContain('createGovernedPipelineDependencies');
  });
});

describe('2. WhatsApp invalid HMAC denied', () => {
  it('live route verifies Meta HMAC before processing', () => {
    const src = read('app/api/webhooks/whatsapp/route.ts');
    expect(src).toContain('verifyMetaWebhookSignature');
    expect(src).toContain("Unauthorized");
  });
});

describe('8. MessageProcessor cannot auto-execute', () => {
  const src = read('src/services/whatsapp/MessageProcessor.ts');

  it('applyProgressUpdate does not call EWS', () => {
    const fnMatch = src.match(/async function applyProgressUpdate[\s\S]*?^}/m);
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).toContain('auto-execution is disabled');
    expect(body).not.toMatch(/ExecutionWriteService/);
    expect(body).not.toContain('applyAction');
  });
});

describe('9-10. test-phase2c removed (unauthenticated and production denied)', () => {
  it('production HTTP route does not exist → 404', () => {
    expect(exists('app/api/test-phase2c/route.ts')).toBe(false);
    expect(exists('src/app/api/test-phase2c/route.ts')).toBe(false);
  });
});

describe('11-15. Live Voice route is governed', () => {
  const src = read('app/api/voice/process/route.ts');
  const adapter = read('src/core/m16/channels/VoiceChannelAdapter.ts');
  const deps = read('src/core/m16/pipeline/governedPipelineDeps.ts');

  it('unauthenticated POST is denied', () => {
    expect(src).toContain('getToken');
    expect(src).toContain('Authentication required');
    expect(src).toContain('401');
  });

  it('authenticated request uses real pipeline deps factory', () => {
    expect(src).toContain('createGovernedPipelineDependencies');
    expect(src).toContain('processVoiceInteraction');
  });

  it('entity resolver is not a stub', () => {
    expect(src).not.toContain('equipment: null');
    expect(deps).toContain('resolveEntityChain');
    expect(deps).not.toMatch(/resolveEntities:\s*async\s*\(\)\s*=>\s*\(\{\s*equipment:\s*null/);
  });

  it('audit is real M16InteractionAuditService', () => {
    expect(src).not.toContain('logInteraction: async () => {}');
    expect(deps).toContain('logInteraction');
    expect(deps).toContain("from '../audit/M16InteractionAuditService'");
  });

  it('llmCaller matches two-arg pipeline contract and callTextAi(ProviderConfig, prompt)', () => {
    expect(deps).toContain('llmCaller: async (systemPrompt: string, userPrompt: string)');
    expect(deps).toContain('loadProviderForJob');
    expect(deps).toContain('callTextAi(config, combined');
  });

  it('PromptInjectionBoundary executes on transcript', () => {
    expect(adapter).toContain('detectInjectionPatterns');
    expect(adapter).toContain('PromptInjectionBoundary');
  });
});

describe('P1-2 Mobile confirmation policy (tactile / web-button parity)', () => {
  const adapter = read('src/core/m16/channels/MobileChannelAdapter.ts');
  const route = read('app/api/mobile/execute/route.ts');

  it('does not invent MobileConfirmationGate', () => {
    expect(adapter).not.toContain('MobileConfirmationGate');
  });

  it('requires JWT on the live route', () => {
    expect(route).toContain('getToken');
    expect(route).toContain('Authentication required');
  });

  it('classifies risk and requires requestId for destructive actions', () => {
    expect(adapter).toContain('classifyRisk(intent)');
    expect(adapter).toContain('requestId is required for this action');
    expect(adapter).toContain('tactile UI confirmation');
  });
});

describe('Conversational COMPLETE confirmation + binding (WhatsApp/Voice pipeline)', () => {
  beforeEach(() => {
    clearRegistry();
    clearAllPendingConfirmations();
    clearAllConversations();
    registerR3WriteTools();
    mockApplyAction.mockReset();
    mockApplyAction.mockResolvedValue({
      success: true,
      activity: { status: 'completed', progress_percent: 100 },
    });
  });

  afterEach(() => {
    clearRegistry();
    clearAllPendingConfirmations();
    clearAllConversations();
  });

  it('3-4. WhatsApp unauthorized COMPLETE is denied and authorized COMPLETE requires confirmation', async () => {
    const denied = await processInteraction(
      { text: 'complete the bundle pullout', context: waCtx(), projectId: 'org-live-r5', userRole: 'viewer' },
      pipelineDeps(),
    );
    expect(denied.pendingConfirmation).toBe(false);
    expect(denied.toolExecuted).toBe(false);
    expect(denied.response.text.toLowerCase()).toMatch(/permission|denied|not authorized/);
    expect(mockApplyAction).not.toHaveBeenCalled();

    const pending = await processInteraction(
      { text: 'complete the bundle pullout', context: waCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps(),
    );
    expect(pending.pendingConfirmation).toBe(true);
    expect(pending.toolExecuted).toBe(false);
    expect(mockApplyAction).not.toHaveBeenCalled();
    expect(getPendingConfirmation('wa-+919876543210')?.securityBinding.activityId).toBe('act-A');
  });

  it('5. WhatsApp confirmation succeeds only with correct binding', async () => {
    await processInteraction(
      { text: 'complete the bundle pullout', context: waCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps(),
    );
    const confirmed = await processInteraction(
      { text: 'yes', context: waCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps(),
    );
    expect(confirmed.toolExecuted).toBe(true);
    expect(mockApplyAction).toHaveBeenCalledWith(
      'org-live-r5',
      'user-live-r5',
      expect.objectContaining({ activityId: 'act-A', action: 'COMPLETE' }),
      expect.objectContaining({ source_channel: 'ai' }),
    );
  });

  it('6. WhatsApp activity substitution is denied and Activity B does not execute', async () => {
    await processInteraction(
      { text: 'complete the bundle pullout', context: waCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps('act-A'),
    );
    const pending = getPendingConfirmation('wa-+919876543210')!;
    pending.toolParams.activityId = 'act-B';

    const result = await processInteraction(
      { text: 'yes', context: waCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps('act-B'),
    );
    expect(result.toolExecuted).toBe(false);
    expect(result.response.text).toMatch(/Security context changed|activityId/i);
    expect(mockApplyAction).not.toHaveBeenCalled();
  });

  it('7. WhatsApp event substitution is denied', async () => {
    await processInteraction(
      { text: 'complete the bundle pullout', context: waCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps(),
    );
    const result = await processInteraction(
      {
        text: 'yes',
        context: waCtx({ eventId: 'event-ATTACKER' }),
        projectId: 'org-live-r5',
        userRole: 'execution_engineer',
      },
      pipelineDeps(),
    );
    expect(result.toolExecuted).toBe(false);
    expect(result.response.text).toMatch(/Security context changed|eventId/i);
    expect(mockApplyAction).not.toHaveBeenCalled();
  });

  it('16. Voice COMPLETE requires confirmation then executes on YES', async () => {
    const pending = await processInteraction(
      { text: 'complete the bundle pullout', context: voiceCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps(),
    );
    expect(pending.pendingConfirmation).toBe(true);
    expect(mockApplyAction).not.toHaveBeenCalled();

    const confirmed = await processInteraction(
      { text: 'yes', context: voiceCtx(), projectId: 'org-live-r5', userRole: 'execution_engineer' },
      pipelineDeps(),
    );
    expect(confirmed.toolExecuted).toBe(true);
    expect(mockApplyAction).toHaveBeenCalledTimes(1);
  });
});

describe('Governed pipeline deps factory', () => {
  it('resolveEntities is organization and event scoped', () => {
    const src = read('src/core/m16/pipeline/governedPipelineDeps.ts');
    expect(src).toContain('resolveEntities: async (organizationId, eventId, hints)');
    expect(src).toContain('resolveEntityChain');
  });
});
