/**
 * M16-R2 — Tool Registry
 *
 * Governed tool definitions for the M16 interaction layer.
 * Every tool declares its contract explicitly.
 *
 * ARCHITECTURE:
 *   - Tools are REGISTERED, not invented by LLM
 *   - Each tool declares: name, authority, permission, risk, event scope
 *   - execute() belongs to application code, not LLM
 *   - LLM can only SELECT from registered tools
 *   - Arguments are VALIDATED before service invocation
 *
 * R2: ALL tools are READ-ONLY. No execution/write tools.
 *
 * DOES NOT:
 *   - Write to domain tables (Activity, Workpack, ProgressLog, etc.)
 *   - Calculate progress/CPM/readiness (delegates to authorities)
 *   - Grant authorization
 */

import { M16Intent } from '../intents';
import { ActionRiskLevel } from '../risk';
import type { M16InteractionContext } from '../types';

// ── Tool Definition ───────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  /** Domain service that owns this data */
  authority: string;
  /** Permission required (null = public read) */
  permission: string | null;
  /** Risk level for this tool invocation */
  riskLevel: ActionRiskLevel;
  /** Whether the tool reads or writes */
  readWrite: 'read' | 'write';
  /** Whether the tool requires event context */
  eventScoped: boolean;
  /** Which intents map to this tool */
  intents: M16Intent[];
  /** Execute the tool against domain services */
  execute: (
    ctx: M16InteractionContext,
    params: ToolParams
  ) => Promise<ToolResult>;
}

export interface ToolParams {
  /** Resolved equipment/asset ID (from M16EntityResolver, NOT from LLM) */
  assetId?: string;
  /** Resolved workpack ID */
  workpackId?: string;
  /** Resolved activity ID */
  activityId?: string;
  /** Equipment tag (for display) */
  equipmentTag?: string;
  /** Workpack number (for display) */
  workpackNumber?: string;
  /** Activity description (for display) */
  activityDescription?: string;
  /** Additional query parameters */
  filter?: Record<string, string>;
  /** Original user text (human message, not LLM identity). Used for what-if/decision parse only. */
  rawUserText?: string;
  /** Application-verified rec ids from this conversation (never LLM-invented). */
  conversationRecommendationIds?: string[];
}

export type ToolResultStatus =
  | 'SUCCESS'
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'DENIED'
  | 'UNAVAILABLE'
  | 'ERROR';

export interface ToolResult {
  status: ToolResultStatus;
  /** The authoritative data from the domain service */
  data: unknown;
  /** Human-readable summary of the result */
  summary: string;
  /** Source authority for attribution */
  authority: string;
  /** Optional navigation link */
  navigationUrl?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (tools.has(tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered`);
  }
  tools.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export function getToolNames(): string[] {
  return Array.from(tools.keys());
}

/**
 * Find the best tool for a given intent.
 * Returns undefined if no tool is registered for this intent.
 */
export function findToolForIntent(intent: M16Intent): ToolDefinition | undefined {
  for (const tool of tools.values()) {
    if (tool.intents.includes(intent)) {
      return tool;
    }
  }
  return undefined;
}

/**
 * Validate that a tool can be executed with the given context.
 * Returns denial reason or null if OK.
 */
export function validateToolExecution(
  tool: ToolDefinition,
  ctx: M16InteractionContext
): string | null {
  // R3: write tools are allowed. Authorization + ConfirmationGate + EWS govern execution.
  // Event-scoped tools (read or write) still require trusted event context.
  if (tool.eventScoped && !ctx.eventId) {
    return `Tool "${tool.name}" requires event context. Please select a turnaround first.`;
  }
  return null;
}

/**
 * Clear registry — for testing only.
 */
export function clearRegistry(): void {
  tools.clear();
}
