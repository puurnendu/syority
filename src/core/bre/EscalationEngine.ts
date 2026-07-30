/**
 * M7.6E — Escalation Engine
 *
 * Time-based escalation chain management.
 * Progresses alerts through escalation levels based on:
 *   • Time elapsed since last escalation
 *   • No response
 *   • Business hours / holiday calendar
 *
 * Dispatches notifications via existing NotificationRuleEngine.
 */

import { prisma } from '@/lib/prisma';
import { processEvent } from '@/core/notifications/NotificationRuleEngine';
import { AlertEngine } from './AlertEngine';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EscalationChain {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  category: string;
  respectBusinessHours: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  timezone: string;
  holidayCalendar: string[];
  isActive: boolean;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  id: string;
  chainId: string;
  levelNumber: number;
  name: string;
  escalateAfterMinutes: number;
  recipientType: string;
  recipientValue: string;
  notificationChannel: string;
  notificationTemplateId: string | null;
}

export interface CreateChainInput {
  organizationId: string;
  name: string;
  description?: string;
  category: string;
  respectBusinessHours?: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  timezone?: string;
  holidayCalendar?: string[];
  createdBy: string;
  levels: Array<{
    levelNumber: number;
    name: string;
    escalateAfterMinutes: number;
    recipientType: string;
    recipientValue: string;
    notificationChannel?: string;
    notificationTemplateId?: string;
  }>;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class EscalationEngine {

  /**
   * Create an escalation chain with levels.
   */
  static async createChain(input: CreateChainInput): Promise<EscalationChain> {
    const chain = await prisma.bre_escalation_chains.create({
      data: {
        organization_id: input.organizationId,
        name: input.name,
        description: input.description,
        category: input.category,
        respect_business_hours: input.respectBusinessHours ?? true,
        business_hours_start: input.businessHoursStart ?? '07:00',
        business_hours_end: input.businessHoursEnd ?? '18:00',
        timezone: input.timezone ?? 'UTC',
        holiday_calendar: input.holidayCalendar ?? [],
        is_active: true,
        created_by: input.createdBy,
        levels: {
          create: input.levels.map((l) => ({
            level_number: l.levelNumber,
            name: l.name,
            escalate_after_minutes: l.escalateAfterMinutes,
            recipient_type: l.recipientType,
            recipient_value: l.recipientValue,
            notification_channel: l.notificationChannel ?? 'email',
            notification_template_id: l.notificationTemplateId,
          })),
        },
      },
      include: { levels: { orderBy: { level_number: 'asc' } } },
    });

    return mapChain(chain);
  }

  /**
   * Get an escalation chain by ID.
   */
  static async getChain(id: string): Promise<EscalationChain | null> {
    const chain = await prisma.bre_escalation_chains.findUnique({
      where: { id },
      include: { levels: { orderBy: { level_number: 'asc' } } },
    });
    return chain ? mapChain(chain) : null;
  }

  /**
   * List escalation chains for an organization.
   */
  static async listChains(organizationId: string): Promise<EscalationChain[]> {
    const chains = await prisma.bre_escalation_chains.findMany({
      where: { organization_id: organizationId, is_active: true },
      include: { levels: { orderBy: { level_number: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return chains.map(mapChain);
  }

  /**
   * Process escalations for all open alerts.
   * Call this on a schedule (e.g., every 5 minutes).
   */
  static async processEscalations(organizationId: string): Promise<number> {
    // Find open/acknowledged alerts that have an escalation chain
    const alerts = await prisma.bre_alerts.findMany({
      where: {
        organization_id: organizationId,
        status: { in: ['open', 'acknowledged'] },
        rule: { escalation_chain_id: { not: null } },
      },
      include: {
        rule: {
          include: {
            escalation_chain: {
              include: { levels: { orderBy: { level_number: 'asc' } } },
            },
          },
        },
      },
    });

    let escalated = 0;

    for (const alert of alerts) {
      const chain = alert.rule.escalation_chain;
      if (!chain || !chain.is_active) continue;

      const currentLevel = alert.escalation_level;
      const nextLevel = currentLevel + 1;

      // Find next escalation level
      const levelDef = chain.levels.find((l: any) => l.level_number === nextLevel);
      if (!levelDef) continue; // Already at max level

      // Check if enough time has passed
      const lastEscalation = alert.escalated_at ?? alert.created_at;
      const previousLevelDef = chain.levels.find((l: any) => l.level_number === currentLevel);
      const waitMinutes = previousLevelDef?.escalate_after_minutes ?? levelDef.escalate_after_minutes;
      const elapsedMs = Date.now() - new Date(lastEscalation).getTime();
      const elapsedMinutes = elapsedMs / 60000;

      if (elapsedMinutes < waitMinutes) continue;

      // Check business hours if configured
      if (chain.respect_business_hours && !isWithinBusinessHours(
        chain.business_hours_start,
        chain.business_hours_end,
        chain.timezone,
        (chain.holiday_calendar as string[]) ?? [],
      )) {
        continue;
      }

      // Escalate
      try {
        await AlertEngine.escalate(alert.id, nextLevel);

        // Notify the escalation recipient
        await processEvent('bre.escalation.escalated', {
          organizationId,
          entityType: 'alert',
          entityId: alert.id,
          variables: {
            alert_title: alert.title,
            alert_severity: alert.severity,
            escalation_level: String(nextLevel),
            escalation_name: levelDef.name,
            recipient_name: levelDef.name,
          },
        });

        escalated++;
        logger.info('EscalationEngine', `Alert ${alert.id} escalated to level ${nextLevel} (${levelDef.name})`);
      } catch (err: any) {
        logger.error('EscalationEngine', `Failed to escalate alert ${alert.id}: ${err.message}`);
      }
    }

    return escalated;
  }

  /**
   * Get default escalation chains for seeding.
   */
  static getDefaultChains(): Array<Omit<CreateChainInput, 'organizationId' | 'createdBy'>> {
    return [
      {
        name: 'Planning Escalation',
        description: 'Default escalation for planning alerts',
        category: 'planning',
        levels: [
          { levelNumber: 1, name: 'Planner', escalateAfterMinutes: 60, recipientType: 'role', recipientValue: 'planner', notificationChannel: 'email' },
          { levelNumber: 2, name: 'Planning Lead', escalateAfterMinutes: 120, recipientType: 'role', recipientValue: 'planning_lead', notificationChannel: 'email' },
          { levelNumber: 3, name: 'Shutdown Manager', escalateAfterMinutes: 240, recipientType: 'role', recipientValue: 'shutdown_manager', notificationChannel: 'email' },
          { levelNumber: 4, name: 'Director', escalateAfterMinutes: 480, recipientType: 'role', recipientValue: 'director', notificationChannel: 'email' },
        ],
      },
      {
        name: 'Safety Escalation',
        description: 'Default escalation for safety alerts — faster progression',
        category: 'safety',
        respectBusinessHours: false, // safety escalates 24/7
        levels: [
          { levelNumber: 1, name: 'Safety Officer', escalateAfterMinutes: 15, recipientType: 'role', recipientValue: 'safety_officer', notificationChannel: 'email' },
          { levelNumber: 2, name: 'HSE Lead', escalateAfterMinutes: 30, recipientType: 'role', recipientValue: 'hse_lead', notificationChannel: 'email' },
          { levelNumber: 3, name: 'HSE Manager', escalateAfterMinutes: 60, recipientType: 'role', recipientValue: 'hse_manager', notificationChannel: 'email' },
          { levelNumber: 4, name: 'Site Manager', escalateAfterMinutes: 120, recipientType: 'role', recipientValue: 'site_manager', notificationChannel: 'email' },
        ],
      },
      {
        name: 'Execution Escalation',
        description: 'Default escalation for execution alerts',
        category: 'execution',
        levels: [
          { levelNumber: 1, name: 'Supervisor', escalateAfterMinutes: 60, recipientType: 'role', recipientValue: 'supervisor', notificationChannel: 'email' },
          { levelNumber: 2, name: 'Area Lead', escalateAfterMinutes: 120, recipientType: 'role', recipientValue: 'area_lead', notificationChannel: 'email' },
          { levelNumber: 3, name: 'Shutdown Manager', escalateAfterMinutes: 240, recipientType: 'role', recipientValue: 'shutdown_manager', notificationChannel: 'email' },
        ],
      },
    ];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isWithinBusinessHours(
  startStr: string,
  endStr: string,
  timezone: string,
  holidays: string[],
): boolean {
  const now = new Date();
  // Simple implementation — parse HH:mm
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const currentH = now.getUTCHours(); // simplified — should use timezone
  const currentM = now.getUTCMinutes();
  const currentMinutes = currentH * 60 + currentM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Check weekend
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;

  // Check holidays
  const todayStr = now.toISOString().slice(0, 10);
  if (holidays.includes(todayStr)) return false;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function mapChain(row: any): EscalationChain {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    category: row.category,
    respectBusinessHours: row.respect_business_hours,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
    timezone: row.timezone,
    holidayCalendar: (row.holiday_calendar as string[]) ?? [],
    isActive: row.is_active,
    levels: (row.levels ?? []).map((l: any) => ({
      id: l.id,
      chainId: l.chain_id,
      levelNumber: l.level_number,
      name: l.name,
      escalateAfterMinutes: l.escalate_after_minutes,
      recipientType: l.recipient_type,
      recipientValue: l.recipient_value,
      notificationChannel: l.notification_channel,
      notificationTemplateId: l.notification_template_id,
    })),
  };
}
