/**
 * M16-R2 — Response Formatter
 *
 * Formats tool results into channel-appropriate responses.
 * Separates AUTHORITATIVE DATA from INTERPRETATION.
 *
 * DOES NOT:
 *   - Fabricate missing data
 *   - Override domain authority attribution
 *   - Generate ungrounded answers
 */

import type { ToolResult } from '../tools/ToolRegistry';
import type { M16InteractionContext } from '../types';
import type { NavigationRoute } from '../navigation/NavigationRegistry';
import type { M16Intent } from '../intents';

// ── Response Types ────────────────────────────────────────────────────────────

export interface FormattedResponse {
  /** Main text content */
  text: string;
  /** Structured data card (for rich UI) */
  card: ResponseCard | null;
  /** Navigation actions */
  navigation: NavigationRoute[];
  /** Suggested follow-up questions */
  suggestions: string[];
  /** Source authority for this response */
  authority: string;
  /** Whether the response is from authoritative data or interpretation */
  grounded: boolean;
}

export interface ResponseCard {
  type: 'progress' | 'status' | 'readiness' | 'constraints' | 'summary' | 'equipment' | 'list';
  title: string;
  fields: Array<{ label: string; value: string; highlight?: 'success' | 'warning' | 'danger' | 'info' }>;
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format a tool result into a structured response.
 */
export function formatToolResult(
  toolResult: ToolResult,
  toolName: string,
  _ctx: M16InteractionContext
): FormattedResponse {
  if (toolResult.status !== 'SUCCESS') {
    return formatErrorResult(toolResult);
  }

  switch (toolName) {
    case 'getProgress':
      return formatProgressResult(toolResult);
    case 'getActivityStatus':
      return formatActivityResult(toolResult);
    case 'getWorkpackStatus':
      return formatWorkpackResult(toolResult);
    case 'getReadiness':
      return formatReadinessResult(toolResult);
    case 'getConstraints':
      return formatConstraintsResult(toolResult);
    case 'getControlTowerSummary':
      return formatControlTowerResult(toolResult);
    case 'getLookahead':
      return formatLookaheadResult(toolResult);
    case 'getDelays':
      return formatDelaysResult(toolResult);
    default:
      return formatGenericResult(toolResult);
  }
}

function formatErrorResult(result: ToolResult): FormattedResponse {
  const statusMessages: Record<string, string> = {
    NOT_FOUND: 'I could not find what you are looking for.',
    AMBIGUOUS: 'Multiple matches found. Could you be more specific?',
    DENIED: 'You do not have permission to access this information.',
    UNAVAILABLE: 'This information is temporarily unavailable.',
    ERROR: 'An error occurred while retrieving the information.',
  };

  return {
    text: `${statusMessages[result.status] ?? result.summary}`,
    card: null,
    navigation: [],
    suggestions: ['Try asking for help', 'What can you do?'],
    authority: result.authority,
    grounded: false,
  };
}

function formatProgressResult(result: ToolResult): FormattedResponse {
  const data = result.data as Record<string, unknown> | null;
  const metrics = (data?.metrics ?? {}) as Record<string, unknown>;
  const wp = metrics.weightedProgress ?? 0;
  const total = metrics.totalCount ?? 0;
  const completed = metrics.completedCount ?? 0;
  const inProgress = metrics.inProgressCount ?? 0;
  const onHold = metrics.onHoldCount ?? 0;

  return {
    text: result.summary,
    card: {
      type: 'progress',
      title: 'Event Progress',
      fields: [
        { label: 'Overall Progress', value: `${wp}%`, highlight: Number(wp) >= 80 ? 'success' : Number(wp) >= 50 ? 'info' : 'warning' },
        { label: 'Total Activities', value: String(total) },
        { label: 'Completed', value: String(completed), highlight: 'success' },
        { label: 'In Progress', value: String(inProgress), highlight: 'info' },
        { label: 'On Hold', value: String(onHold), highlight: onHold > 0 ? 'warning' : undefined },
      ],
    },
    navigation: [],
    suggestions: [
      'Show delayed activities',
      'Show critical activities',
      'What is contractor performance?',
    ],
    authority: result.authority,
    grounded: true,
  };
}

function formatActivityResult(result: ToolResult): FormattedResponse {
  const data = result.data as Record<string, unknown> | null;
  if (!data) return formatGenericResult(result);

  const status = data.status as string ?? 'unknown';
  const progress = data.progress_percent as number ?? 0;
  const desc = data.description as string ?? 'Activity';
  const actNum = data.activity_number as string ?? '';
  const isCritical = data.is_critical as boolean ?? false;
  const wp = data.workpack as Record<string, unknown> | null;

  return {
    text: result.summary,
    card: {
      type: 'status',
      title: `Activity: ${actNum || desc}`,
      fields: [
        { label: 'Status', value: status, highlight: status === 'completed' ? 'success' : status === 'in_progress' ? 'info' : 'warning' },
        { label: 'Progress', value: `${progress}%` },
        ...(isCritical ? [{ label: 'Critical Path', value: 'Yes', highlight: 'danger' as const }] : []),
        ...(wp ? [{ label: 'Workpack', value: (wp.workpack_number as string) ?? '' }] : []),
        ...(data.delay_reason ? [{ label: 'Delay Reason', value: data.delay_reason as string, highlight: 'danger' as const }] : []),
      ],
    },
    navigation: [],
    suggestions: [
      'Is this activity ready to start?',
      'Show its workpack',
      'What are the constraints?',
    ],
    authority: result.authority,
    grounded: true,
  };
}

function formatWorkpackResult(result: ToolResult): FormattedResponse {
  const data = result.data as Record<string, unknown> | null;
  if (!data) return formatGenericResult(result);

  return {
    text: result.summary,
    card: {
      type: 'status',
      title: `Workpack: ${data.workpack_number ?? 'Unknown'}`,
      fields: [
        { label: 'Title', value: (data.title as string) ?? '' },
        { label: 'Status', value: (data.status as string) ?? '' },
        { label: 'Progress', value: `${data.overall_progress ?? 0}%` },
      ],
    },
    navigation: [],
    suggestions: [
      'Show its activities',
      'Is it ready?',
      'What are the constraints?',
    ],
    authority: result.authority,
    grounded: true,
  };
}

function formatReadinessResult(result: ToolResult): FormattedResponse {
  const data = result.data as Record<string, unknown> | null;
  const isReady = (data?.is_ready as boolean) ?? false;
  const blockers = (data?.blockers as string[]) ?? [];

  return {
    text: result.summary,
    card: {
      type: 'readiness',
      title: 'Execution Readiness',
      fields: [
        { label: 'Status', value: isReady ? 'READY' : 'NOT READY', highlight: isReady ? 'success' : 'danger' },
        ...blockers.map(b => ({ label: 'Blocker', value: b, highlight: 'danger' as const })),
      ],
    },
    navigation: [],
    suggestions: isReady
      ? ['Show its workpack', 'What is the progress?']
      : ['Show open constraints', 'What is blocking it?'],
    authority: result.authority,
    grounded: true,
  };
}

function formatConstraintsResult(result: ToolResult): FormattedResponse {
  const data = (result.data as Array<Record<string, unknown>>) ?? [];

  return {
    text: result.summary,
    card: {
      type: 'constraints',
      title: 'Open Constraints',
      fields: data.slice(0, 5).map(c => ({
        label: (c.severity as string ?? 'unknown').toUpperCase(),
        value: c.title as string ?? 'Unnamed constraint',
        highlight: c.severity === 'critical' ? 'danger' as const : c.severity === 'high' ? 'warning' as const : 'info' as const,
      })),
    },
    navigation: [],
    suggestions: [
      'Show critical constraints only',
      'What is the overall progress?',
      'Show delayed workpacks',
    ],
    authority: result.authority,
    grounded: true,
  };
}

function formatControlTowerResult(result: ToolResult): FormattedResponse {
  return {
    text: result.summary,
    card: {
      type: 'summary',
      title: 'Control Tower',
      fields: [],
    },
    navigation: [],
    suggestions: [
      'Show exceptions',
      'Show critical path',
      'What is delayed?',
    ],
    authority: result.authority,
    grounded: true,
  };
}

function formatLookaheadResult(result: ToolResult): FormattedResponse {
  const data = (result.data as Array<Record<string, unknown>>) ?? [];

  return {
    text: result.summary,
    card: {
      type: 'list',
      title: 'Lookahead',
      fields: data.slice(0, 5).map(a => ({
        label: (a.activity_number as string) ?? '',
        value: (a.description as string) ?? '',
      })),
    },
    navigation: [],
    suggestions: [
      'Show overdue activities',
      'What is today\'s progress?',
    ],
    authority: result.authority,
    grounded: true,
  };
}

function formatDelaysResult(result: ToolResult): FormattedResponse {
  const data = (result.data as Array<Record<string, unknown>>) ?? [];

  return {
    text: result.summary,
    card: {
      type: 'list',
      title: 'Delayed Activities',
      fields: data.slice(0, 5).map(a => ({
        label: (a.activity_number as string) ?? (a.description as string) ?? '',
        value: (a.delay_reason as string) ?? 'Reason not specified',
        highlight: 'danger' as const,
      })),
    },
    navigation: [],
    suggestions: [
      'Show critical path',
      'What are the constraints?',
      'Show overall progress',
    ],
    authority: result.authority,
    grounded: true,
  };
}

function formatGenericResult(result: ToolResult): FormattedResponse {
  return {
    text: result.summary,
    card: null,
    navigation: [],
    suggestions: [],
    authority: result.authority,
    grounded: true,
  };
}

/**
 * Format a help response with available capabilities.
 */
export function formatHelpResponse(): FormattedResponse {
  return {
    text: 'I can help you with your turnaround. Here\'s what I can do:',
    card: {
      type: 'list',
      title: 'Available Commands',
      fields: [
        { label: '📊 Progress', value: '"What is the overall progress?"' },
        { label: '🏭 Equipment', value: '"Show HX-204" or "What is the status of HX-204?"' },
        { label: '📋 Workpacks', value: '"Show workpack WP-042"' },
        { label: '✅ Readiness', value: '"Is HX-204 ready to start?"' },
        { label: '⚠️ Constraints', value: '"Show open constraints"' },
        { label: '⏰ Delays', value: '"What is delayed?"' },
        { label: '📅 Schedule', value: '"Show today\'s schedule" or "24h lookahead"' },
        { label: '🗼 Control Tower', value: '"Open control tower"' },
        { label: '🧭 Management intelligence', value: '"Why is HX-204 a concern?" or "What should we consider?"' },
        { label: '🔮 What-if', value: '"What if we add two crews?" (hypothetical)' },
        { label: '🔍 Navigation', value: '"Show me HX-204" or "Open reports"' },
      ],
    },
    navigation: [],
    suggestions: [
      'What is today\'s progress?',
      'Show delayed activities',
      'Open control tower',
    ],
    authority: 'M16',
    grounded: true,
  };
}

/**
 * Format a response for execution intents that are not yet available (R2 is read-only).
 */
export function formatExecutionNotAvailable(intentDescription: string): FormattedResponse {
  return {
    text: `I understand you want to ${intentDescription}. Execution actions will be available soon. For now, I can help you check status, progress, readiness, and constraints.`,
    card: null,
    navigation: [],
    suggestions: [
      'What is the current status?',
      'Is it ready to start?',
      'Show open constraints',
    ],
    authority: 'M16',
    grounded: false,
  };
}

// ── R3 Response Formatters ────────────────────────────────────────────────────

/**
 * Format a confirmation prompt for an execution action.
 */
export function formatConfirmationPrompt(promptText: string, _intent: M16Intent): FormattedResponse {
  return {
    text: promptText,
    card: null,
    navigation: [],
    suggestions: ['YES', 'NO'],
    authority: 'M16',
    grounded: true,
  };
}

/**
 * Format a cancellation response when user declines confirmation.
 */
export function formatConfirmationCancelled(): FormattedResponse {
  return {
    text: 'Action cancelled. No changes were made.',
    card: null,
    navigation: [],
    suggestions: ['What is the current status?', 'Show progress', 'help'],
    authority: 'M16',
    grounded: true,
  };
}

/**
 * Format a response for a successful execution action.
 */
export function formatExecutionSuccess(toolResult: ToolResult, intent: M16Intent): FormattedResponse {
  if (toolResult.status !== 'SUCCESS') {
    return {
      text: `⚠️ ${toolResult.summary}`,
      card: null,
      navigation: [],
      suggestions: ['What is the current status?', 'Show readiness'],
      authority: toolResult.authority,
      grounded: true,
    };
  }

  const activity = toolResult.data?.activity;
  const card: ResponseCard | null = activity ? {
    type: 'status',
    title: 'Execution Result',
    fields: [
      { label: 'Status', value: activity.status || 'updated', highlight: activity.status === 'completed' ? 'success' : 'info' },
      ...(activity.progress_percent !== undefined ? [{ label: 'Progress', value: `${activity.progress_percent}%` }] : []),
    ],
  } : null;

  return {
    text: `✅ ${toolResult.summary}`,
    card,
    navigation: [],
    suggestions: ['What is the current status?', 'Show progress'],
    authority: toolResult.authority,
    grounded: true,
  };
}

/**
 * Format a response for permission denied.
 */
export function formatPermissionDenied(reason: string): FormattedResponse {
  return {
    text: `🔒 ${reason}`,
    card: null,
    navigation: [],
    suggestions: ['What is the current status?', 'Show progress', 'help'],
    authority: 'M16 Authorization',
    grounded: true,
  };
}
