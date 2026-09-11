/**
 * M16-R1 Audit Tests (AU1–AU5)
 *
 * Tests interaction audit record creation, required fields,
 * failed authorization logging, ambiguous resolution logging,
 * and confirmation state logging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    m16_interaction_logs: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { logInteraction } from '../audit/M16InteractionAuditService';
import type { M16InteractionContext } from '../types';
import { M16Intent, M16IntentCategory } from '../intents';
import { ActionRiskLevel } from '../risk';

const TEST_CTX: M16InteractionContext = Object.freeze({
  organizationId: 'org-A',
  userId: 'user-1',
  channel: 'whatsapp' as const,
  conversationId: 'conv-1',
  eventId: 'event-1',
  identitySource: 'phone_number' as const,
  siteId: 'site-1',
  messageId: 'wamid.test',
});

describe('M16-R1 Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.m16_interaction_logs.create as any).mockResolvedValue({ id: 'log-1' });
  });

  // AU1: Interaction creates audit record
  it('AU1 — interaction creates audit record with correct table', async () => {
    await logInteraction({
      ctx: TEST_CTX,
      intent: M16Intent.GET_PROGRESS,
      intentCategory: M16IntentCategory.QUERY,
      rawMessage: 'What is progress?',
      resolvedEntities: null,
      riskLevel: ActionRiskLevel.READ,
      authorization: 'not_required',
      deniedReason: null,
      confirmation: null,
      result: 'success',
      resultDetail: null,
    });

    expect(prisma.m16_interaction_logs.create).toHaveBeenCalledTimes(1);
  });

  // AU2: Required fields populated
  it('AU2 — required fields are populated in audit record', async () => {
    await logInteraction({
      ctx: TEST_CTX,
      intent: M16Intent.START_ACTIVITY,
      intentCategory: M16IntentCategory.EXECUTION,
      rawMessage: 'Start bundle pullout on HX-204',
      resolvedEntities: {
        equipment: { outcome: 'RESOLVED', assetId: 'asset-1', tagNumber: 'HX-204' },
        workpack: { outcome: 'RESOLVED', workpackId: 'wp-042', workpackNumber: 'WP-042' },
        activity: { outcome: 'RESOLVED', activityId: 'act-1', activityNumber: 'ACT-001' },
      },
      riskLevel: ActionRiskLevel.HIGH_RISK_WRITE,
      authorization: 'authorized',
      deniedReason: null,
      confirmation: 'confirmed',
      result: 'success',
      resultDetail: null,
    });

    const call = (prisma.m16_interaction_logs.create as any).mock.calls[0][0];
    const data = call.data;

    // Verify all required fields
    expect(data.organization_id).toBe('org-A');
    expect(data.user_id).toBe('user-1');
    expect(data.event_id).toBe('event-1');
    expect(data.channel).toBe('whatsapp');
    expect(data.conversation_id).toBe('conv-1');
    expect(data.message_id).toBe('wamid.test');
    expect(data.intent).toBe('START_ACTIVITY');
    expect(data.intent_category).toBe('EXECUTION');
    expect(data.raw_message).toBe('Start bundle pullout on HX-204');
    expect(data.resolved_entity).toBeDefined();
    expect(data.action_risk_level).toBe('HIGH_RISK_WRITE');
    expect(data.authorization).toBe('authorized');
    expect(data.confirmation).toBe('confirmed');
    expect(data.result).toBe('success');
    expect(data.identity_source).toBe('phone_number');
  });

  // AU3: Failed authorization logged
  it('AU3 — failed authorization is logged with denial reason', async () => {
    await logInteraction({
      ctx: TEST_CTX,
      intent: M16Intent.CHANGE_SCOPE,
      intentCategory: M16IntentCategory.GOVERNANCE,
      rawMessage: 'Change the scope of TA-2027',
      resolvedEntities: null,
      riskLevel: ActionRiskLevel.GOVERNANCE,
      authorization: 'denied',
      deniedReason: 'Governance operations not allowed via WhatsApp',
      confirmation: null,
      result: 'rejected',
      resultDetail: 'Channel restriction',
    });

    const call = (prisma.m16_interaction_logs.create as any).mock.calls[0][0];
    expect(call.data.authorization).toBe('denied');
    expect(call.data.denied_reason).toBe('Governance operations not allowed via WhatsApp');
    expect(call.data.result).toBe('rejected');
  });

  // AU4: Ambiguous resolution logged
  it('AU4 — ambiguous resolution is logged', async () => {
    await logInteraction({
      ctx: TEST_CTX,
      intent: M16Intent.GET_WORKPACK_STATUS,
      intentCategory: M16IntentCategory.QUERY,
      rawMessage: 'Status of HX-204?',
      resolvedEntities: {
        equipment: { outcome: 'RESOLVED', assetId: 'asset-1' },
        workpack: {
          outcome: 'AMBIGUOUS',
          candidates: [
            { id: 'wp-1', number: 'WP-042', title: 'Bundle Pullout' },
            { id: 'wp-2', number: 'WP-043', title: 'Tube Inspection' },
          ],
        },
        activity: null,
      },
      riskLevel: ActionRiskLevel.READ,
      authorization: 'not_required',
      deniedReason: null,
      confirmation: null,
      result: 'ambiguous',
      resultDetail: 'Multiple workpacks found for HX-204',
    });

    const call = (prisma.m16_interaction_logs.create as any).mock.calls[0][0];
    expect(call.data.result).toBe('ambiguous');
    expect(call.data.resolved_entity.workpack.outcome).toBe('AMBIGUOUS');
  });

  // AU5: Confirmation state logged
  it('AU5 — confirmation state is logged', async () => {
    await logInteraction({
      ctx: TEST_CTX,
      intent: M16Intent.COMPLETE_ACTIVITY,
      intentCategory: M16IntentCategory.EXECUTION,
      rawMessage: 'Complete the activity',
      resolvedEntities: null,
      riskLevel: ActionRiskLevel.DESTRUCTIVE,
      authorization: 'authorized',
      deniedReason: null,
      confirmation: 'pending',
      result: 'success',
      resultDetail: 'Awaiting user confirmation',
    });

    const call = (prisma.m16_interaction_logs.create as any).mock.calls[0][0];
    expect(call.data.confirmation).toBe('pending');
    expect(call.data.action_risk_level).toBe('DESTRUCTIVE');
  });
});
