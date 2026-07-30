/**
 * NotificationRuleEngine — Event-driven notification dispatch.
 *
 * When a business event fires, the rule engine:
 * 1. Finds matching enabled rules for the event type
 * 2. Resolves recipients (users, roles, groups, actors, raw emails)
 * 3. Renders the template with provided variables
 * 4. Enqueues notifications for delivery
 */

import { prisma } from '@/lib/prisma';
import { NotificationTemplateService, renderTemplate, getBaseEmailWrapper } from './NotificationTemplateService';
import { logger } from '@/lib/logger';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface EventContext {
  organizationId?: string;
  triggeredBy?: string;        // User ID of the person who triggered the event
  entityType?: string;         // "Workpack", "User", "Event", etc.
  entityId?: string;           // Entity UUID
  variables: Record<string, string>;  // Template variable values
}

interface ResolvedRecipient {
  email: string;
  name?: string;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Process a business event: find rules → resolve recipients → enqueue notifications.
 *
 * @param eventType - e.g. "workpack.approved", "password.reset", "qa.assigned"
 * @param context   - event metadata and template variables
 */
export async function processEvent(eventType: string, context: EventContext): Promise<number> {
  try {
    const rules = await findMatchingRules(eventType, context.organizationId);

    if (rules.length === 0) {
      logger.debug('RuleEngine', `No rules for event: ${eventType}`);
      return 0;
    }

    let enqueued = 0;

    for (const rule of rules) {
      try {
        const recipients = await resolveRecipients(rule.recipients, context);
        if (recipients.length === 0) {
          logger.debug('RuleEngine', `No recipients resolved for rule: ${rule.name}`);
          continue;
        }

        const template = await prisma.notification_templates.findUnique({
          where: { id: rule.template_id },
        });
        if (!template || !template.is_active) {
          logger.warn('RuleEngine', `Template not found/inactive for rule: ${rule.name}`, { templateId: rule.template_id });
          continue;
        }

        // Render template
        const subject = renderTemplate(template.subject, context.variables);
        const htmlContent = renderTemplate(template.html_body, context.variables);
        const html = getBaseEmailWrapper(htmlContent, context.variables.company);
        const text = renderTemplate(
          template.text_body ?? template.html_body.replace(/<[^>]*>/g, ' ').trim(),
          context.variables
        );

        // Get default provider
        const defaultProvider = await prisma.notification_providers.findFirst({
          where: { is_default: true, is_enabled: true },
          select: { id: true },
        });

        // Enqueue per recipient
        for (const recipient of recipients) {
          await prisma.notification_queue.create({
            data: {
              provider_id: defaultProvider?.id ?? null,
              template_id: template.id,
              channel: rule.channel,
              recipient_email: recipient.email,
              recipient_name: recipient.name,
              subject,
              html_body: html,
              text_body: text,
              variables: context.variables,
              status: 'pending',
              priority: 5,
              max_attempts: 3,
              organization_id: context.organizationId ?? null,
              triggered_by: context.triggeredBy ?? null,
              event_type: eventType,
              entity_type: context.entityType ?? null,
              entity_id: context.entityId ?? null,
            },
          });
          enqueued++;
        }

        logger.info('RuleEngine', `Enqueued ${recipients.length} notification(s) for rule: ${rule.name}`, {
          eventType,
          ruleId: rule.id,
        });
      } catch (ruleErr: unknown) {
        const msg = ruleErr instanceof Error ? ruleErr.message : String(ruleErr);
        logger.error('RuleEngine', `Error processing rule: ${rule.name}`, { error: msg });
      }
    }

    return enqueued;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('RuleEngine', `Failed to process event: ${eventType}`, { error: msg });
    return 0;
  }
}

// ─── Internals ─────────────────────────────────────────────────────────────────

/**
 * Find enabled rules matching an event type.
 * Includes both platform-wide (orgId=null) and org-specific rules.
 */
async function findMatchingRules(eventType: string, organizationId?: string) {
  return prisma.notification_rules.findMany({
    where: {
      event_type: eventType,
      is_enabled: true,
      OR: [
        { organization_id: null },        // platform-wide rules
        ...(organizationId ? [{ organization_id: organizationId }] : []),
      ],
    },
    include: {
      recipients: true,
    },
  });
}

/**
 * Resolve rule recipients to actual email addresses.
 *
 * Supports:
 * - "user" → direct user ID lookup
 * - "role" → all users with that role in the organization
 * - "group" → expand notification_recipient_groups
 * - "email" → raw email address
 * - "actor" → context actor (e.g. "triggered_by", "created_by")
 */
async function resolveRecipients(
  ruleRecipients: Array<{ recipient_type: string; recipient_value: string }>,
  context: EventContext
): Promise<ResolvedRecipient[]> {
  const recipients: ResolvedRecipient[] = [];
  const seen = new Set<string>(); // Deduplicate by email

  for (const rr of ruleRecipients) {
    try {
      switch (rr.recipient_type) {
        case 'user': {
          const user = await prisma.user.findUnique({
            where: { id: rr.recipient_value },
            select: { email: true, name: true, is_active: true },
          });
          if (user?.email && user.is_active && !seen.has(user.email)) {
            recipients.push({ email: user.email, name: user.name });
            seen.add(user.email);
          }
          break;
        }

        case 'role': {
          if (!context.organizationId) break;
          const users = await prisma.user.findMany({
            where: {
              organization_id: context.organizationId,
              is_active: true,
              deleted_at: null,
              user_roles: {
                some: { role: { slug: rr.recipient_value } },
              },
            },
            select: { email: true, name: true },
          });
          for (const u of users) {
            if (u.email && !seen.has(u.email)) {
              recipients.push({ email: u.email, name: u.name });
              seen.add(u.email);
            }
          }
          break;
        }

        case 'group': {
          const group = await prisma.notification_recipient_groups.findUnique({
            where: { id: rr.recipient_value },
          });
          if (!group || !group.is_active) break;

          const members = group.members as Array<{ type: string; value: string }>;
          for (const member of members) {
            if (member.type === 'email' && !seen.has(member.value)) {
              recipients.push({ email: member.value });
              seen.add(member.value);
            } else if (member.type === 'user') {
              const u = await prisma.user.findUnique({
                where: { id: member.value },
                select: { email: true, name: true, is_active: true },
              });
              if (u?.email && u.is_active && !seen.has(u.email)) {
                recipients.push({ email: u.email, name: u.name });
                seen.add(u.email);
              }
            } else if (member.type === 'role' && context.organizationId) {
              const roleUsers = await prisma.user.findMany({
                where: {
                  organization_id: context.organizationId,
                  is_active: true,
                  deleted_at: null,
                  user_roles: { some: { role: { slug: member.value } } },
                },
                select: { email: true, name: true },
              });
              for (const ru of roleUsers) {
                if (ru.email && !seen.has(ru.email)) {
                  recipients.push({ email: ru.email, name: ru.name });
                  seen.add(ru.email);
                }
              }
            }
          }
          break;
        }

        case 'email': {
          if (!seen.has(rr.recipient_value)) {
            recipients.push({ email: rr.recipient_value });
            seen.add(rr.recipient_value);
          }
          break;
        }

        case 'actor': {
          // Resolve special actor references (e.g. "triggered_by")
          const actorId = rr.recipient_value === 'triggered_by' ? context.triggeredBy : undefined;
          if (actorId) {
            const actor = await prisma.user.findUnique({
              where: { id: actorId },
              select: { email: true, name: true, is_active: true },
            });
            if (actor?.email && actor.is_active && !seen.has(actor.email)) {
              recipients.push({ email: actor.email, name: actor.name });
              seen.add(actor.email);
            }
          }
          break;
        }

        default:
          logger.warn('RuleEngine', `Unknown recipient type: ${rr.recipient_type}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('RuleEngine', `Failed to resolve recipient: ${rr.recipient_type}/${rr.recipient_value}`, { error: msg });
    }
  }

  return recipients;
}

// ─── Rule CRUD ─────────────────────────────────────────────────────────────────

export interface CreateRuleInput {
  name: string;
  event_type: string;
  channel?: string;
  template_id: string;
  is_enabled?: boolean;
  organization_id?: string;
  conditions?: Record<string, unknown>;
  recipients: Array<{ recipient_type: string; recipient_value: string }>;
  created_by?: string;
}

export interface UpdateRuleInput extends Partial<Omit<CreateRuleInput, 'recipients'>> {
  recipients?: Array<{ recipient_type: string; recipient_value: string }>;
  updated_by?: string;
}

export class NotificationRuleService {
  static async list(filters?: { event_type?: string; organization_id?: string }) {
    return prisma.notification_rules.findMany({
      where: {
        ...(filters?.event_type ? { event_type: filters.event_type } : {}),
        ...(filters?.organization_id !== undefined ? { organization_id: filters.organization_id } : {}),
      },
      include: { recipients: true, template: { select: { name: true, slug: true } } },
      orderBy: [{ event_type: 'asc' }, { name: 'asc' }],
    });
  }

  static async getById(id: string) {
    return prisma.notification_rules.findUnique({
      where: { id },
      include: { recipients: true, template: true },
    });
  }

  static async create(input: CreateRuleInput) {
    const rule = await prisma.notification_rules.create({
      data: {
        name: input.name,
        event_type: input.event_type,
        channel: input.channel ?? 'email',
        template_id: input.template_id,
        is_enabled: input.is_enabled ?? true,
        organization_id: input.organization_id ?? null,
        conditions: input.conditions ?? null,
        created_by: input.created_by,
        recipients: {
          create: input.recipients.map((r) => ({
            recipient_type: r.recipient_type,
            recipient_value: r.recipient_value,
          })),
        },
      },
      include: { recipients: true },
    });

    logger.info('NotificationRule', `Created rule: ${rule.name}`, { id: rule.id });
    return rule;
  }

  static async update(id: string, input: UpdateRuleInput) {
    const existing = await prisma.notification_rules.findUnique({ where: { id } });
    if (!existing) throw new Error('Rule not found');

    // If recipients are updated, replace them
    if (input.recipients) {
      await prisma.notification_rule_recipients.deleteMany({ where: { rule_id: id } });
    }

    const rule = await prisma.notification_rules.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.event_type !== undefined && { event_type: input.event_type }),
        ...(input.channel !== undefined && { channel: input.channel }),
        ...(input.template_id !== undefined && { template_id: input.template_id }),
        ...(input.is_enabled !== undefined && { is_enabled: input.is_enabled }),
        ...(input.conditions !== undefined && { conditions: input.conditions }),
        updated_by: input.updated_by,
        ...(input.recipients && {
          recipients: {
            create: input.recipients.map((r) => ({
              recipient_type: r.recipient_type,
              recipient_value: r.recipient_value,
            })),
          },
        }),
      },
      include: { recipients: true },
    });

    logger.info('NotificationRule', `Updated rule: ${rule.name}`, { id: rule.id });
    return rule;
  }

  static async delete(id: string) {
    await prisma.notification_rules.delete({ where: { id } });
    logger.info('NotificationRule', `Deleted rule`, { id });
  }
}
