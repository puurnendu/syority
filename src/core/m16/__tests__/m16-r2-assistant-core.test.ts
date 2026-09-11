/**
 * M16-R2 — Comprehensive Test Suite
 *
 * Tests cover:
 *   1. Intent classification (deterministic + LLM-based)
 *   2. Tool registry governance
 *   3. Pipeline E2E
 *   4. Conversation context
 *   5. Navigation registry
 *   6. Security / adversarial
 *   7. Authority boundary (source scan)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  classifyUserIntent,
  tryDeterministicClassification,
  isQueryIntent,
  isNavigationIntent,
  isExecutionIntent,
  isGovernanceIntent,
} from '../intent/IntentClassifier';
import type { ClassificationResult, ConversationTurn } from '../intent/IntentClassifier';
import {
  registerTool,
  getTool,
  findToolForIntent,
  getAllTools,
  validateToolExecution,
  clearRegistry,
} from '../tools/ToolRegistry';
import type { ToolDefinition, ToolResult } from '../tools/ToolRegistry';
import { registerR2ReadTools } from '../tools/readTools';
import {
  getConversation,
  addConversationTurn,
  updateConversationEntities,
  getLastEntities,
  getConversationHistory,
  clearConversation,
  clearAllConversations,
} from '../pipeline/ConversationContext';
import {
  resolveNavigation,
  getAvailableNavigations,
} from '../navigation/NavigationRegistry';
import {
  formatHelpResponse,
  formatExecutionNotAvailable,
} from '../response/ResponseFormatter';
import { processInteraction } from '../pipeline/M16InteractionPipeline';
import type { PipelineDependencies } from '../pipeline/M16InteractionPipeline';
import { M16Intent, M16IntentCategory, INTENT_METADATA } from '../intents';
import { ActionRiskLevel } from '../risk';
import type { M16InteractionContext } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

function mockContext(overrides?: Partial<M16InteractionContext>): M16InteractionContext {
  return Object.freeze({
    organizationId: 'org-001',
    userId: 'user-001',
    channel: 'web' as const,
    conversationId: `test-conv-${Date.now()}`,
    eventId: 'event-001',
    identitySource: 'session_cookie' as const,
    siteId: 'site-001',
    messageId: null,
    ...overrides,
  });
}

function mockLlmCaller(response: Record<string, unknown>) {
  return vi.fn().mockResolvedValue(JSON.stringify(response));
}

function mockDeps(llmResponse?: Record<string, unknown>): PipelineDependencies {
  return {
    llmCaller: mockLlmCaller(llmResponse ?? {
      intent: 'GET_PROGRESS',
      confidence: 0.95,
      equipment_tag: null,
      workpack_number: null,
      activity_description: null,
      event_code: null,
      unit_name: null,
      discipline: null,
      contractor: null,
      navigation_target: null,
    }),
    resolveEntities: vi.fn().mockResolvedValue({
      equipment: null,
      workpack: null,
      activity: null,
    }),
    logInteraction: vi.fn().mockResolvedValue(undefined),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. INTENT CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Intent Classification', () => {
  describe('Deterministic classification', () => {
    it('classifies "help" as HELP', () => {
      const result = tryDeterministicClassification('help');
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(M16Intent.HELP);
      expect(result!.confidence).toBe(1.0);
    });

    it('classifies "?" as HELP', () => {
      const result = tryDeterministicClassification('?');
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(M16Intent.HELP);
    });

    it('classifies "/help" as HELP', () => {
      const result = tryDeterministicClassification('/help');
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(M16Intent.HELP);
    });

    it('classifies "open control tower" as OPEN_CONTROL_TOWER', () => {
      const result = tryDeterministicClassification('open control tower');
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(M16Intent.OPEN_CONTROL_TOWER);
    });

    it('classifies "show the control tower" as OPEN_CONTROL_TOWER', () => {
      const result = tryDeterministicClassification('show the control tower');
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(M16Intent.OPEN_CONTROL_TOWER);
    });

    it('returns null for ambiguous text', () => {
      const result = tryDeterministicClassification('what is the status of HX-204?');
      expect(result).toBeNull();
    });
  });

  describe('LLM-based classification', () => {
    it('classifies valid LLM response', async () => {
      const llm = mockLlmCaller({
        intent: 'GET_PROGRESS',
        confidence: 0.92,
        equipment_tag: null,
        workpack_number: null,
        activity_description: null,
        event_code: null,
        unit_name: 'CDU',
        discipline: null,
        contractor: null,
        navigation_target: null,
      });

      const result = await classifyUserIntent('what is CDU progress?', [], llm);
      expect(result.intent).toBe(M16Intent.GET_PROGRESS);
      expect(result.confidence).toBeCloseTo(0.92, 1);
      expect(result.entityHints.unitName).toBe('CDU');
      expect(result.intentRecognized).toBe(true);
    });

    it('falls back to UNKNOWN for unrecognized intent string', async () => {
      const llm = mockLlmCaller({
        intent: 'INVENTED_INTENT',
        confidence: 0.8,
      });

      const result = await classifyUserIntent('do something weird', [], llm);
      expect(result.intent).toBe(M16Intent.UNKNOWN);
      expect(result.intentRecognized).toBe(false);
      expect(result.rawLlmIntent).toBe('INVENTED_INTENT');
    });

    it('falls back to UNKNOWN for invalid JSON', async () => {
      const llm = vi.fn().mockResolvedValue('not valid json {{{');
      const result = await classifyUserIntent('random', [], llm);
      expect(result.intent).toBe(M16Intent.UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    it('extracts entity hints', async () => {
      const llm = mockLlmCaller({
        intent: 'GET_ACTIVITY_STATUS',
        confidence: 0.88,
        equipment_tag: 'HX-204',
        workpack_number: 'WP-042',
        activity_description: 'bundle pullout',
        event_code: 'TA-2027',
        unit_name: 'CDU',
        discipline: 'mechanical',
        contractor: 'Worley',
        navigation_target: null,
      });

      const result = await classifyUserIntent('status of bundle pullout on HX-204', [], llm);
      expect(result.entityHints.equipmentTag).toBe('HX-204');
      expect(result.entityHints.workpackNumber).toBe('WP-042');
      expect(result.entityHints.activityDescription).toBe('bundle pullout');
      expect(result.entityHints.unitName).toBe('CDU');
    });

    it('clamps confidence to 0-1', async () => {
      const llm = mockLlmCaller({ intent: 'HELP', confidence: 5.0 });
      const result = await classifyUserIntent('help me', [], llm);
      // Deterministic kicks in for "help" alone, but not "help me"
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Intent category helpers', () => {
    it('identifies query intents', () => {
      expect(isQueryIntent(M16Intent.GET_PROGRESS)).toBe(true);
      expect(isQueryIntent(M16Intent.GET_ACTIVITY_STATUS)).toBe(true);
      expect(isQueryIntent(M16Intent.HELP)).toBe(true);
      expect(isQueryIntent(M16Intent.RELEASE_ACTIVITY)).toBe(false);
    });

    it('identifies navigation intents', () => {
      expect(isNavigationIntent(M16Intent.OPEN_EQUIPMENT)).toBe(true);
      expect(isNavigationIntent(M16Intent.OPEN_CONTROL_TOWER)).toBe(true);
      expect(isNavigationIntent(M16Intent.GET_PROGRESS)).toBe(false);
    });

    it('identifies execution intents', () => {
      expect(isExecutionIntent(M16Intent.START_ACTIVITY)).toBe(true);
      expect(isExecutionIntent(M16Intent.COMPLETE_ACTIVITY)).toBe(true);
      expect(isExecutionIntent(M16Intent.GET_PROGRESS)).toBe(false);
    });

    it('identifies governance intents', () => {
      expect(isGovernanceIntent(M16Intent.CHANGE_SCOPE)).toBe(true);
      expect(isGovernanceIntent(M16Intent.CHANGE_SCHEDULE)).toBe(true);
      expect(isGovernanceIntent(M16Intent.GET_PROGRESS)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Tool Registry', () => {
  beforeEach(() => clearRegistry());

  it('registers and retrieves tools', () => {
    const tool: ToolDefinition = {
      name: 'testTool',
      description: 'Test tool',
      authority: 'TestService',
      permission: null,
      riskLevel: ActionRiskLevel.READ,
      readWrite: 'read',
      eventScoped: true,
      intents: [M16Intent.GET_PROGRESS],
      execute: vi.fn().mockResolvedValue({ status: 'SUCCESS', data: {}, summary: 'ok', authority: 'TestService' }),
    };

    registerTool(tool);
    expect(getTool('testTool')).toBe(tool);
  });

  it('prevents duplicate registration', () => {
    const tool: ToolDefinition = {
      name: 'duplicateTool',
      description: 'Test',
      authority: 'TestService',
      permission: null,
      riskLevel: ActionRiskLevel.READ,
      readWrite: 'read',
      eventScoped: false,
      intents: [],
      execute: vi.fn().mockResolvedValue({ status: 'SUCCESS', data: {}, summary: 'ok', authority: 'TestService' }),
    };

    registerTool(tool);
    expect(() => registerTool(tool)).toThrow('already registered');
  });

  it('finds tool for intent', () => {
    const tool: ToolDefinition = {
      name: 'progressTool',
      description: 'Get progress',
      authority: 'M8.13',
      permission: null,
      riskLevel: ActionRiskLevel.READ,
      readWrite: 'read',
      eventScoped: true,
      intents: [M16Intent.GET_PROGRESS],
      execute: vi.fn().mockResolvedValue({ status: 'SUCCESS', data: {}, summary: 'ok', authority: 'M8.13' }),
    };

    registerTool(tool);
    expect(findToolForIntent(M16Intent.GET_PROGRESS)).toBe(tool);
    expect(findToolForIntent(M16Intent.GET_DELAY)).toBeUndefined();
  });

  it('validates event-scoped tool requires event context', () => {
    const tool: ToolDefinition = {
      name: 'eventTool',
      description: 'Needs event',
      authority: 'TestService',
      permission: null,
      riskLevel: ActionRiskLevel.READ,
      readWrite: 'read',
      eventScoped: true,
      intents: [],
      execute: vi.fn().mockResolvedValue({ status: 'SUCCESS', data: {}, summary: 'ok', authority: 'TestService' }),
    };

    const ctxNoEvent = mockContext({ eventId: null });
    const ctxWithEvent = mockContext({ eventId: 'event-001' });

    expect(validateToolExecution(tool, ctxNoEvent)).toContain('requires event context');
    expect(validateToolExecution(tool, ctxWithEvent)).toBeNull();
  });

  it('write tools require event context (R3 writes go through ConfirmationGate + EWS)', () => {
    const tool: ToolDefinition = {
      name: 'writeTool',
      description: 'Writes',
      authority: 'TestService',
      permission: 'execution.start',
      riskLevel: ActionRiskLevel.HIGH_RISK_WRITE,
      readWrite: 'write',
      eventScoped: true,
      intents: [],
      execute: vi.fn().mockResolvedValue({ status: 'SUCCESS', data: {}, summary: 'ok', authority: 'TestService' }),
    };

    const ctxNoEvent = mockContext({ eventId: null });
    const ctxWithEvent = mockContext();
    expect(validateToolExecution(tool, ctxNoEvent)).toContain('requires event context');
    expect(validateToolExecution(tool, ctxWithEvent)).toBeNull();
  });
});

describe('M16-R2: R2 Read Tools Registration', () => {
  beforeEach(() => clearRegistry());

  it('registers all expected read tools', () => {
    registerR2ReadTools();
    const tools = getAllTools();
    expect(tools.length).toBeGreaterThanOrEqual(10);

    const names = tools.map(t => t.name);
    expect(names).toContain('getProgress');
    expect(names).toContain('getActivityStatus');
    expect(names).toContain('getWorkpackStatus');
    expect(names).toContain('getReadiness');
    expect(names).toContain('getConstraints');
    expect(names).toContain('getControlTowerSummary');
    expect(names).toContain('getLookahead');
    expect(names).toContain('getDelays');
    expect(names).toContain('getEquipmentDetails');
  });

  it('all R2 tools are read-only', () => {
    registerR2ReadTools();
    const tools = getAllTools();
    for (const tool of tools) {
      expect(tool.readWrite).toBe('read');
      expect(tool.riskLevel).toBe(ActionRiskLevel.READ);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CONVERSATION CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Conversation Context', () => {
  afterEach(() => clearAllConversations());

  it('creates fresh conversation', () => {
    const state = getConversation('test-conv-1');
    expect(state.conversationId).toBe('test-conv-1');
    expect(state.turns).toEqual([]);
  });

  it('tracks conversation turns', () => {
    addConversationTurn('conv-1', 'user', 'Show HX-204');
    addConversationTurn('conv-1', 'assistant', 'Here is HX-204 status');
    const history = getConversationHistory('conv-1');
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  it('stores resolved entities', () => {
    updateConversationEntities('conv-2', {
      assetId: 'asset-001',
      equipmentTag: 'HX-204',
    }, 'event-001');

    const entities = getLastEntities('conv-2');
    expect(entities.assetId).toBe('asset-001');
    expect(entities.equipmentTag).toBe('HX-204');
  });

  it('resets entities on event change', () => {
    updateConversationEntities('conv-3', {
      assetId: 'asset-001',
    }, 'event-001');

    // Change event — entities should reset
    updateConversationEntities('conv-3', {
      workpackId: 'wp-001',
    }, 'event-002');

    const entities = getLastEntities('conv-3');
    expect(entities.assetId).toBeUndefined();
    expect(entities.workpackId).toBe('wp-001');
  });

  it('limits turn history to MAX_TURNS', () => {
    for (let i = 0; i < 15; i++) {
      addConversationTurn('conv-4', 'user', `Message ${i}`);
    }
    const history = getConversationHistory('conv-4');
    expect(history.length).toBeLessThanOrEqual(10);
  });

  it('clears conversation', () => {
    addConversationTurn('conv-5', 'user', 'Hello');
    clearConversation('conv-5');
    const history = getConversationHistory('conv-5');
    expect(history).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. NAVIGATION REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Navigation Registry', () => {
  it('resolves equipment navigation', () => {
    const route = resolveNavigation('equipment', {
      eventId: 'evt-1',
      assetId: 'asset-001',
    });
    expect(route).not.toBeNull();
    expect(route!.path).toBe('/asset-register/asset-001');
    expect(route!.requiresEntity).toBe(true);
  });

  it('resolves control tower navigation', () => {
    const route = resolveNavigation('control_tower', {
      eventId: 'evt-1',
    });
    expect(route).not.toBeNull();
    expect(route!.path).toBe('/events/evt-1/control-tower');
    expect(route!.requiresEntity).toBe(false);
  });

  it('returns null for equipment without assetId', () => {
    const route = resolveNavigation('equipment', {
      projectId: 'proj-1',
    });
    expect(route).toBeNull();
  });

  it('returns null for unknown target', () => {
    const route = resolveNavigation('nonexistent_page', {
      projectId: 'proj-1',
    });
    expect(route).toBeNull();
  });

  it('lists available navigations', () => {
    const navs = getAvailableNavigations();
    expect(navs).toContain('equipment');
    expect(navs).toContain('control_tower');
    expect(navs).toContain('dashboard');
    expect(navs).toContain('schedule');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PIPELINE E2E
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Interaction Pipeline', () => {
  beforeEach(() => {
    clearRegistry();
    clearAllConversations();
    registerR2ReadTools();
  });

  it('processes HELP intent', async () => {
    const ctx = mockContext();
    const deps = mockDeps();

    const result = await processInteraction(
      { text: 'help', context: ctx, projectId: 'proj-1' },
      deps
    );

    expect(result.intent).toBe(M16Intent.HELP);
    expect(result.toolExecuted).toBe(false);
    expect(result.response.text).toContain('help');
    expect(deps.logInteraction).toHaveBeenCalled();
  });

  it('processes UNKNOWN intent', async () => {
    const ctx = mockContext();
    const deps = mockDeps({ intent: 'UNKNOWN', confidence: 0 });

    const result = await processInteraction(
      { text: 'qwertyuiop', context: ctx, projectId: 'proj-1' },
      deps
    );

    expect(result.intent).toBe(M16Intent.UNKNOWN);
    expect(result.toolExecuted).toBe(false);
    expect(result.response.suggestions.length).toBeGreaterThan(0);
  });

  it('handles execution intents through R3 pipeline (no longer blocked)', async () => {
    const ctx = mockContext();
    const deps = mockDeps({ intent: 'START_ACTIVITY', confidence: 0.9 });

    const result = await processInteraction(
      { text: 'start activity A-001', context: ctx, projectId: 'proj-1' },
      deps
    );

    expect(result.intent).toBe(M16Intent.START_ACTIVITY);
    // R3: execution intents go through auth + confirmation gate (or tool exec)
    // They are no longer blocked with "Execution actions will be available"
    expect(result.response.text).not.toContain('Execution actions will be available');
  });

  it('blocks governance intents in R2', async () => {
    const ctx = mockContext();
    const deps = mockDeps({ intent: 'CHANGE_SCOPE', confidence: 0.9 });

    const result = await processInteraction(
      { text: 'change the scope', context: ctx, projectId: 'proj-1' },
      deps
    );

    expect(result.intent).toBe(M16Intent.CHANGE_SCOPE);
    expect(result.toolExecuted).toBe(false);
    expect(result.response.text).toContain('Governance actions');
  });

  it('requires event context for event-scoped queries', async () => {
    const ctx = mockContext({ eventId: null });
    const deps = mockDeps({ intent: 'GET_PROGRESS', confidence: 0.95 });

    const result = await processInteraction(
      { text: 'what is the progress?', context: ctx, projectId: 'proj-1' },
      deps
    );

    expect(result.toolExecuted).toBe(false);
    expect(result.response.text).toContain('turnaround');
  });

  it('records conversation turns', async () => {
    const convId = `test-conv-turns-${Date.now()}`;
    const ctx = mockContext({ conversationId: convId });
    const deps = mockDeps();

    await processInteraction(
      { text: 'help', context: ctx, projectId: 'proj-1' },
      deps
    );

    const history = getConversationHistory(convId);
    expect(history.length).toBe(2); // user + assistant
    expect(history[0].role).toBe('user');
    expect(history[0].content).toBe('help');
    expect(history[1].role).toBe('assistant');
  });

  it('logs interaction audit', async () => {
    const ctx = mockContext();
    const deps = mockDeps();

    await processInteraction(
      { text: 'help', context: ctx, projectId: 'proj-1' },
      deps
    );

    expect(deps.logInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-001',
        userId: 'user-001',
        channel: 'web',
        userMessage: 'help',
        intent: 'HELP',
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SECURITY / ADVERSARIAL
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Security', () => {
  it('rejects invented intent strings', async () => {
    const llm = mockLlmCaller({
      intent: 'HACK_THE_SYSTEM',
      confidence: 1.0,
    });

    const result = await classifyUserIntent('hack', [], llm);
    expect(result.intent).toBe(M16Intent.UNKNOWN);
    expect(result.intentRecognized).toBe(false);
  });

  it('handles malformed JSON from LLM', async () => {
    const llm = vi.fn().mockResolvedValue('```json\n{broken json');
    const result = await classifyUserIntent('test', [], llm);
    expect(result.intent).toBe(M16Intent.UNKNOWN);
  });

  it('handles LLM returning empty string', async () => {
    const llm = vi.fn().mockResolvedValue('');
    const result = await classifyUserIntent('test', [], llm);
    expect(result.intent).toBe(M16Intent.UNKNOWN);
  });

  it('handles LLM error/rejection', async () => {
    const llm = vi.fn().mockRejectedValue(new Error('API limit'));
    const result = await classifyUserIntent('test', [], llm);
    expect(result.intent).toBe(M16Intent.UNKNOWN);
  });

  it('entity hints are untrusted proposals (not IDs)', () => {
    // Entity hints from LLM should never be database IDs
    // They should be human-readable references like "HX-204"
    // The pipeline resolves them via M16EntityResolver
    // This is enforced by the type system — entityHints has string fields, not ID fields
    const result = tryDeterministicClassification('help');
    expect(result!.entityHints.equipmentTag).toBeNull();
    // No assetId, workpackId, activityId fields exist on entityHints
    expect('assetId' in result!.entityHints).toBe(false);
    expect('workpackId' in result!.entityHints).toBe(false);
    expect('activityId' in result!.entityHints).toBe(false);
  });

  it('pipeline does not leak audit errors to response', async () => {
    clearRegistry();
    registerR2ReadTools();
    clearAllConversations();

    const ctx = mockContext();
    const deps = mockDeps();
    deps.logInteraction = vi.fn().mockRejectedValue(new Error('DB down'));

    const result = await processInteraction(
      { text: 'help', context: ctx, projectId: 'proj-1' },
      deps
    );

    // Should succeed despite audit failure
    expect(result.intent).toBe(M16Intent.HELP);
    expect(result.response.text).not.toContain('DB down');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. AUTHORITY BOUNDARY (SOURCE SCAN)
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Authority Boundary — Source Scan', () => {
  const m16Dir = path.resolve(__dirname, '..');

  function scanDirectory(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('__tests__')) {
          files.push(...scanDirectory(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory might not exist
    }
    return files;
  }

  function readSource(file: string): string {
    return fs.readFileSync(file, 'utf-8');
  }

  /** Strip comment lines (// and * lines) to avoid matching JSDoc documentation */
  function readSourceCode(file: string): string {
    return readSource(file)
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**');
      })
      .join('\n');
  }

  const sourceFiles = scanDirectory(m16Dir);

  it('has source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('ZERO prisma.activity.update in M16 tools', () => {
    for (const file of sourceFiles) {
      if (file.includes('tools') || file.includes('pipeline') || file.includes('response') || file.includes('intent') || file.includes('navigation')) {
        const src = readSourceCode(file);
        expect(src).not.toMatch(/prisma\.activity\.(update|create|delete|upsert)/);
      }
    }
  });

  it('ZERO prisma.workpack.update in M16 tools', () => {
    for (const file of sourceFiles) {
      if (file.includes('tools') || file.includes('pipeline') || file.includes('response') || file.includes('intent') || file.includes('navigation')) {
        const src = readSourceCode(file);
        expect(src).not.toMatch(/prisma\.workpack\.(update|create|delete|upsert)/);
      }
    }
  });

  it('ZERO prisma.progressLog.create in M16 tools', () => {
    for (const file of sourceFiles) {
      if (file.includes('tools') || file.includes('pipeline')) {
        const src = readSourceCode(file);
        expect(src).not.toMatch(/prisma\.progressLog\.(create|update)/);
      }
    }
  });

  it('ZERO direct calculateProgressMetrics in M16 tools', () => {
    for (const file of sourceFiles) {
      if (file.includes('tools') && !file.includes('readTools.ts')) {
        const src = readSource(file);
        expect(src).not.toContain('calculateProgressMetrics');
      }
    }
  });

  it('ZERO direct fetch to OpenAI in M16 (uses ProviderLoader)', () => {
    for (const file of sourceFiles) {
      if (!file.includes('__tests__')) {
        const src = readSource(file);
        expect(src).not.toMatch(/fetch\(['"]https:\/\/api\.openai\.com/);
      }
    }
  });

  it('all R2 tools are read-only (readWrite === read)', () => {
    clearRegistry();
    registerR2ReadTools();
    const tools = getAllTools();
    for (const tool of tools) {
      expect(tool.readWrite).toBe('read');
    }
  });

  it('all R2 tools have riskLevel READ', () => {
    clearRegistry();
    registerR2ReadTools();
    const tools = getAllTools();
    for (const tool of tools) {
      expect(tool.riskLevel).toBe(ActionRiskLevel.READ);
    }
  });

  it('no tool name contains "write" or "update" or "delete"', () => {
    clearRegistry();
    registerR2ReadTools();
    const names = getAllTools().map(t => t.name.toLowerCase());
    for (const name of names) {
      expect(name).not.toContain('write');
      expect(name).not.toContain('update');
      expect(name).not.toContain('delete');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. RESPONSE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

describe('M16-R2: Response Formatting', () => {
  it('help response has capabilities', () => {
    const resp = formatHelpResponse();
    expect(resp.card).not.toBeNull();
    expect(resp.card!.type).toBe('list');
    expect(resp.card!.fields.length).toBeGreaterThan(5);
    expect(resp.suggestions.length).toBeGreaterThan(0);
    expect(resp.grounded).toBe(true);
  });

  it('execution not available response has suggestions', () => {
    const resp = formatExecutionNotAvailable('start an activity');
    expect(resp.text).toContain('Execution actions');
    expect(resp.suggestions.length).toBeGreaterThan(0);
    expect(resp.grounded).toBe(false);
  });
});
