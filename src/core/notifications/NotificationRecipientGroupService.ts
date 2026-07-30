/**
 * NotificationRecipientGroupService — CRUD for distribution groups.
 *
 * Groups are reusable recipient collections: "Planning Team", "Shutdown Management", etc.
 * Members can be users, roles, or external email addresses.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface GroupMember {
  type: 'user' | 'role' | 'email';
  value: string; // userId | role slug | email address
  label?: string; // Display name (optional)
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  organization_id?: string;
  members: GroupMember[];
  created_by?: string;
}

export interface UpdateGroupInput extends Partial<CreateGroupInput> {
  updated_by?: string;
  is_active?: boolean;
}

export class NotificationRecipientGroupService {
  /**
   * List groups, optionally filtered by organization.
   */
  static async list(filters?: { organization_id?: string; is_active?: boolean }) {
    return prisma.notification_recipient_groups.findMany({
      where: {
        ...(filters?.organization_id !== undefined ? { organization_id: filters.organization_id } : {}),
        ...(filters?.is_active !== undefined ? { is_active: filters.is_active } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a group by ID.
   */
  static async getById(id: string) {
    return prisma.notification_recipient_groups.findUnique({ where: { id } });
  }

  /**
   * Create a new distribution group.
   */
  static async create(input: CreateGroupInput) {
    const group = await prisma.notification_recipient_groups.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        organization_id: input.organization_id ?? null,
        members: input.members,
        created_by: input.created_by,
      },
    });

    logger.info('RecipientGroup', `Created group: ${group.name}`, { id: group.id });
    return group;
  }

  /**
   * Update a distribution group.
   */
  static async update(id: string, input: UpdateGroupInput) {
    const existing = await prisma.notification_recipient_groups.findUnique({ where: { id } });
    if (!existing) throw new Error('Group not found');

    const group = await prisma.notification_recipient_groups.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.members !== undefined && { members: input.members }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
        updated_by: input.updated_by,
      },
    });

    logger.info('RecipientGroup', `Updated group: ${group.name}`, { id: group.id });
    return group;
  }

  /**
   * Delete a distribution group.
   */
  static async delete(id: string) {
    // Check if any rules reference this group
    const ruleCount = await prisma.notification_rule_recipients.count({
      where: { recipient_type: 'group', recipient_value: id },
    });
    if (ruleCount > 0) {
      throw new Error(`Cannot delete group: ${ruleCount} notification rule(s) still reference it.`);
    }

    await prisma.notification_recipient_groups.delete({ where: { id } });
    logger.info('RecipientGroup', `Deleted group`, { id });
  }

  /**
   * Resolve all email addresses in a group.
   */
  static async resolveEmails(id: string, organizationId?: string): Promise<Array<{ email: string; name?: string }>> {
    const group = await prisma.notification_recipient_groups.findUnique({ where: { id } });
    if (!group || !group.is_active) return [];

    const members = group.members as GroupMember[];
    const results: Array<{ email: string; name?: string }> = [];
    const seen = new Set<string>();

    for (const member of members) {
      if (member.type === 'email') {
        if (!seen.has(member.value)) {
          results.push({ email: member.value, name: member.label });
          seen.add(member.value);
        }
      } else if (member.type === 'user') {
        const user = await prisma.user.findUnique({
          where: { id: member.value },
          select: { email: true, name: true, is_active: true },
        });
        if (user?.email && user.is_active && !seen.has(user.email)) {
          results.push({ email: user.email, name: user.name });
          seen.add(user.email);
        }
      } else if (member.type === 'role' && organizationId) {
        const users = await prisma.user.findMany({
          where: {
            organization_id: organizationId,
            is_active: true,
            deleted_at: null,
            user_roles: { some: { role: { slug: member.value } } },
          },
          select: { email: true, name: true },
        });
        for (const u of users) {
          if (u.email && !seen.has(u.email)) {
            results.push({ email: u.email, name: u.name });
            seen.add(u.email);
          }
        }
      }
    }

    return results;
  }
}
