/**
 * NotificationProviderService — CRUD for notification providers.
 *
 * Handles creation, update, deletion, encryption of credentials,
 * and ensuring only one default provider exists.
 */

import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

export interface CreateProviderInput {
  name: string;
  provider_type: string;
  is_default?: boolean;
  is_enabled?: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_username?: string;
  smtp_password?: string; // Plain text — will be encrypted
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  timeout_ms?: number;
  max_retries?: number;
  api_key?: string; // Plain text — will be encrypted
  oauth_config?: Record<string, unknown>;
  created_by?: string;
}

export interface UpdateProviderInput extends Partial<CreateProviderInput> {
  updated_by?: string;
}

export class NotificationProviderService {
  /**
   * List all providers.
   */
  static async list() {
    const providers = await prisma.notification_providers.findMany({
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });

    // Mask sensitive fields for API responses
    return providers.map((p) => ({
      ...p,
      smtp_password_enc: p.smtp_password_enc ? '••••••••' : null,
      api_key_enc: p.api_key_enc ? '••••••••' : null,
    }));
  }

  /**
   * Get a single provider by ID (masked).
   */
  static async getById(id: string) {
    const provider = await prisma.notification_providers.findUnique({ where: { id } });
    if (!provider) return null;
    return {
      ...provider,
      smtp_password_enc: provider.smtp_password_enc ? '••••••••' : null,
      api_key_enc: provider.api_key_enc ? '••••••••' : null,
    };
  }

  /**
   * Create a new notification provider.
   */
  static async create(input: CreateProviderInput) {
    // If setting as default, clear other defaults first
    if (input.is_default) {
      await prisma.notification_providers.updateMany({
        where: { is_default: true },
        data: { is_default: false },
      });
    }

    const provider = await prisma.notification_providers.create({
      data: {
        name: input.name,
        provider_type: input.provider_type,
        is_default: input.is_default ?? false,
        is_enabled: input.is_enabled ?? true,
        smtp_host: input.smtp_host,
        smtp_port: input.smtp_port ?? 587,
        smtp_secure: input.smtp_secure ?? false,
        smtp_username: input.smtp_username,
        smtp_password_enc: input.smtp_password ? encrypt(input.smtp_password) : null,
        from_name: input.from_name ?? 'AURIANOA OS',
        from_email: input.from_email,
        reply_to: input.reply_to,
        timeout_ms: input.timeout_ms ?? 30000,
        max_retries: input.max_retries ?? 3,
        api_key_enc: input.api_key ? encrypt(input.api_key) : null,
        oauth_config: input.oauth_config ?? undefined,
        created_by: input.created_by,
      },
    });

    logger.info('NotificationProvider', `Created provider: ${provider.name} (${provider.provider_type})`, { id: provider.id });

    return {
      ...provider,
      smtp_password_enc: provider.smtp_password_enc ? '••••••••' : null,
      api_key_enc: provider.api_key_enc ? '••••••••' : null,
    };
  }

  /**
   * Update an existing provider.
   * Only updates fields that are explicitly provided.
   */
  static async update(id: string, input: UpdateProviderInput) {
    const existing = await prisma.notification_providers.findUnique({ where: { id } });
    if (!existing) throw new Error('Provider not found');

    // If setting as default, clear other defaults
    if (input.is_default === true) {
      await prisma.notification_providers.updateMany({
        where: { is_default: true, id: { not: id } },
        data: { is_default: false },
      });
    }

    const data: Record<string, unknown> = { updated_by: input.updated_by };

    if (input.name !== undefined) data.name = input.name;
    if (input.provider_type !== undefined) data.provider_type = input.provider_type;
    if (input.is_default !== undefined) data.is_default = input.is_default;
    if (input.is_enabled !== undefined) data.is_enabled = input.is_enabled;
    if (input.smtp_host !== undefined) data.smtp_host = input.smtp_host;
    if (input.smtp_port !== undefined) data.smtp_port = input.smtp_port;
    if (input.smtp_secure !== undefined) data.smtp_secure = input.smtp_secure;
    if (input.smtp_username !== undefined) data.smtp_username = input.smtp_username;
    if (input.smtp_password !== undefined) data.smtp_password_enc = input.smtp_password ? encrypt(input.smtp_password) : null;
    if (input.from_name !== undefined) data.from_name = input.from_name;
    if (input.from_email !== undefined) data.from_email = input.from_email;
    if (input.reply_to !== undefined) data.reply_to = input.reply_to;
    if (input.timeout_ms !== undefined) data.timeout_ms = input.timeout_ms;
    if (input.max_retries !== undefined) data.max_retries = input.max_retries;
    if (input.api_key !== undefined) data.api_key_enc = input.api_key ? encrypt(input.api_key) : null;
    if (input.oauth_config !== undefined) data.oauth_config = input.oauth_config;

    const provider = await prisma.notification_providers.update({ where: { id }, data });

    logger.info('NotificationProvider', `Updated provider: ${provider.name}`, { id: provider.id });

    return {
      ...provider,
      smtp_password_enc: provider.smtp_password_enc ? '••••••••' : null,
      api_key_enc: provider.api_key_enc ? '••••••••' : null,
    };
  }

  /**
   * Delete a provider.
   */
  static async delete(id: string) {
    const provider = await prisma.notification_providers.findUnique({ where: { id } });
    if (!provider) throw new Error('Provider not found');

    if (provider.is_default) {
      throw new Error('Cannot delete the default provider. Set another provider as default first.');
    }

    await prisma.notification_providers.delete({ where: { id } });
    logger.info('NotificationProvider', `Deleted provider: ${provider.name}`, { id });
  }

  /**
   * Set a provider as the default. Clears all other defaults.
   */
  static async setDefault(id: string) {
    const provider = await prisma.notification_providers.findUnique({ where: { id } });
    if (!provider) throw new Error('Provider not found');
    if (!provider.is_enabled) throw new Error('Cannot set a disabled provider as default');

    await prisma.$transaction([
      prisma.notification_providers.updateMany({
        where: { is_default: true },
        data: { is_default: false },
      }),
      prisma.notification_providers.update({
        where: { id },
        data: { is_default: true },
      }),
    ]);

    logger.info('NotificationProvider', `Set default provider: ${provider.name}`, { id });
    return { success: true };
  }

  /**
   * Get the currently active default provider (for delivery service).
   */
  static async getDefaultProvider() {
    return prisma.notification_providers.findFirst({
      where: { is_default: true, is_enabled: true },
    });
  }
}
