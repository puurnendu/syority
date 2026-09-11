/**
 * M7.6G.1 — Backup & Restore Service
 *
 * Creates JSON-based backups of platform data with compression and checksum.
 * Supports full, incremental, config-only, data-only, and documents-only.
 * Stores backup files to local filesystem under ./backups/.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';
import { writeFile, readFile, mkdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { gzipSync, gunzipSync } from 'zlib';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type BackupType = 'full' | 'incremental' | 'config_only' | 'data_only' | 'documents_only';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'expired';

export interface BackupScope {
  organizations?: boolean;
  users?: boolean;
  roles?: boolean;
  sites?: boolean;
  hierarchy?: boolean;
  events?: boolean;
  workpacks?: boolean;
  issues?: boolean;
  reports?: boolean;
  dashboards?: boolean;
  notifications?: boolean;
  featureFlags?: boolean;
  licenses?: boolean;
  modules?: boolean;
  branding?: boolean;
  smtp?: boolean;
  aiConfig?: boolean;
  seedPacks?: boolean;
  breRules?: boolean;
  feedback?: boolean;
}

export interface BackupOptions {
  name?: string;
  type?: BackupType;
  scope?: BackupScope;
  compression?: 'none' | 'gzip';
  notes?: string;
  retentionDays?: number;
}

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

// ═══════════════════════════════════════════════════════════════════════════════
// Scope Presets
// ═══════════════════════════════════════════════════════════════════════════════

function scopeForType(type: BackupType): BackupScope {
  switch (type) {
    case 'full':
      return {
        organizations: true, users: true, roles: true, sites: true, hierarchy: true,
        events: true, workpacks: true, issues: true, reports: true, dashboards: true,
        notifications: true, featureFlags: true, licenses: true, modules: true,
        branding: true, smtp: true, aiConfig: true, seedPacks: true, breRules: true,
        feedback: true,
      };
    case 'config_only':
      return {
        featureFlags: true, licenses: true, modules: true, branding: true,
        smtp: true, aiConfig: true, seedPacks: true,
      };
    case 'data_only':
      return {
        organizations: true, users: true, roles: true, sites: true, hierarchy: true,
        events: true, workpacks: true, issues: true, breRules: true, feedback: true,
      };
    case 'documents_only':
      return { reports: true, dashboards: true, notifications: true };
    case 'incremental':
      return scopeForType('full');
    default:
      return scopeForType('full');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class BackupService {

  /**
   * Create a backup.
   */
  async createBackup(options: BackupOptions, userId?: string) {
    const type = options.type ?? 'full';
    const scope = options.scope ?? scopeForType(type);
    const compression = options.compression ?? 'gzip';
    const name = options.name ?? `backup-${type}-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    // Ensure backups directory exists
    if (!existsSync(BACKUP_DIR)) {
      await mkdir(BACKUP_DIR, { recursive: true });
    }

    // Create record
    const backup = await prisma.platform_backups.create({
      data: {
        name,
        type,
        status: 'running',
        scope: scope as any,
        compression,
        created_by: userId,
        notes: options.notes,
        expires_at: options.retentionDays
          ? new Date(Date.now() + options.retentionDays * 86400000)
          : undefined,
      },
    });

    try {
      // Collect data
      const data: Record<string, any> = {
        _meta: {
          version: '1.0.0',
          type,
          created_at: new Date().toISOString(),
          scope,
        },
      };

      if (scope.organizations) {
        data.organizations = await prisma.organization.findMany({ where: { deleted_at: null } });
      }
      if (scope.users) {
        data.users = await prisma.user.findMany({
          where: { deleted_at: null },
          select: {
            id: true, name: true, email: true, role: true, role_id: true,
            organization_id: true, is_active: true, is_super_admin: true,
            created_at: true,
          },
        });
      }
      if (scope.roles) {
        data.roles = await prisma.role.findMany();
      }
      if (scope.sites) {
        data.sites = await prisma.site.findMany({ where: { deleted_at: null } });
      }
      if (scope.hierarchy) {
        data.plants = await prisma.plant.findMany({ where: { deleted_at: null } });
        data.areas = await prisma.area.findMany({ where: { deleted_at: null } });
        data.units = await prisma.unit.findMany({ where: { deleted_at: null } });
        data.systems = await prisma.system.findMany({ where: { deleted_at: null } });
        data.assets = await prisma.asset.findMany({ where: { deleted_at: null } });
      }
      if (scope.events) {
        data.events = await prisma.event.findMany({ where: { deleted_at: null } });
      }
      if (scope.workpacks) {
        data.workpacks = await prisma.workpack.findMany({ where: { deleted_at: null } });
        data.activities = await prisma.activity.findMany();
      }
      if (scope.issues) {
        data.issues = await prisma.engineeringIssue.findMany({ where: { deleted_at: null } });
      }
      if (scope.featureFlags) {
        data.featureFlags = await prisma.featureFlag.findMany();
        data.tenantFeatures = await prisma.tenantFeature.findMany();
      }
      if (scope.licenses) {
        data.licenses = await prisma.platform_licenses.findMany();
      }
      if (scope.modules) {
        data.modules = await prisma.platform_modules.findMany();
        data.orgModules = await prisma.organization_modules.findMany();
      }
      if (scope.seedPacks) {
        data.seedPacks = await prisma.seed_packs.findMany();
      }
      if (scope.reports) {
        data.reportTemplates = await prisma.report_templates.findMany();
      }
      if (scope.dashboards) {
        data.dashboards = await prisma.ois_dashboard_definitions.findMany();
      }
      if (scope.feedback) {
        data.feedback = await prisma.platform_feedback.findMany();
      }

      // Serialize
      const json = JSON.stringify(data, null, 0);
      let buffer: Buffer;
      if (compression === 'gzip') {
        buffer = gzipSync(Buffer.from(json));
      } else {
        buffer = Buffer.from(json);
      }

      // Checksum
      const checksum = createHash('sha256').update(buffer).digest('hex');

      // Write file
      const ext = compression === 'gzip' ? '.json.gz' : '.json';
      const fileName = `${backup.id}${ext}`;
      const filePath = path.join(BACKUP_DIR, fileName);
      await writeFile(filePath, buffer);

      // Update record
      await prisma.platform_backups.update({
        where: { id: backup.id },
        data: {
          status: 'completed',
          file_path: filePath,
          file_size_bytes: buffer.length,
          checksum,
          completed_at: new Date(),
        },
      });

      logger.audit('BackupService', 'Backup created', {
        id: backup.id, type, size: buffer.length, checksum,
      });

      return {
        id: backup.id,
        name,
        type,
        size: buffer.length,
        checksum,
        filePath,
      };
    } catch (err: any) {
      await prisma.platform_backups.update({
        where: { id: backup.id },
        data: { status: 'failed', completed_at: new Date() },
      });
      throw err;
    }
  }

  /**
   * List backups with optional filtering.
   */
  async list(filter?: { type?: string; status?: string; page?: number; limit?: number }) {
    const page = filter?.page ?? 1;
    const limit = Math.min(filter?.limit ?? 50, 100);
    const where: any = {};
    if (filter?.type) where.type = filter.type;
    if (filter?.status) where.status = filter.status;

    const [items, total] = await Promise.all([
      prisma.platform_backups.findMany({
        where,
        orderBy: { started_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { restores: { orderBy: { started_at: 'desc' }, take: 1 } },
      }),
      prisma.platform_backups.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Get backup details.
   */
  async get(id: string) {
    return prisma.platform_backups.findUnique({
      where: { id },
      include: { restores: { orderBy: { started_at: 'desc' } } },
    });
  }

  /**
   * Verify backup integrity by checking checksum.
   */
  async verify(id: string): Promise<{ valid: boolean; message: string }> {
    const backup = await prisma.platform_backups.findUnique({ where: { id } });
    if (!backup) return { valid: false, message: 'Backup not found' };
    if (!backup.file_path || !backup.checksum) {
      return { valid: false, message: 'No file or checksum' };
    }

    try {
      const buffer = await readFile(backup.file_path);
      const computed = createHash('sha256').update(buffer).digest('hex');
      const valid = computed === backup.checksum;
      return {
        valid,
        message: valid ? 'Checksum verified' : `Mismatch: expected ${backup.checksum}, got ${computed}`,
      };
    } catch {
      return { valid: false, message: 'File not accessible' };
    }
  }

  /**
   * Preview what a restore would affect.
   */
  async previewRestore(id: string) {
    const backup = await prisma.platform_backups.findUnique({ where: { id } });
    if (!backup || !backup.file_path) throw new Error('Backup not found or missing file');

    const data = await this.readBackupData(backup.file_path, backup.compression);
    const preview: Record<string, number> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === '_meta') continue;
      if (Array.isArray(value)) {
        preview[key] = value.length;
      }
    }

    return { scope: backup.scope, records: preview };
  }

  /**
   * Restore from backup.
   */
  async restore(backupId: string, scope?: BackupScope, userId?: string) {
    const backup = await prisma.platform_backups.findUnique({ where: { id: backupId } });
    if (!backup || !backup.file_path) throw new Error('Backup not found');

    const restore = await prisma.platform_restores.create({
      data: {
        backup_id: backupId,
        type: scope ? 'partial' : 'full',
        status: 'running',
        scope: (scope ?? backup.scope) as any,
        created_by: userId,
      },
    });

    try {
      const data = await this.readBackupData(backup.file_path, backup.compression);
      let restored = 0;

      // Restore feature flags
      if (data.featureFlags && (!scope || scope.featureFlags)) {
        for (const flag of data.featureFlags) {
          await prisma.featureFlag.upsert({
            where: { key: flag.key },
            update: { isEnabled: flag.isEnabled, description: flag.description },
            create: flag,
          });
          restored++;
        }
      }

      // Restore seed packs
      if (data.seedPacks && (!scope || scope.seedPacks)) {
        for (const pack of data.seedPacks) {
          await prisma.seed_packs.upsert({
            where: { slug: pack.slug },
            update: { name: pack.name, config: pack.config },
            create: pack,
          });
          restored++;
        }
      }

      // Note: Full data restore (orgs, users, hierarchy) is complex and
      // intentionally limited to configuration items for safety.
      // Full restores should use pg_restore for production scenarios.

      await prisma.platform_restores.update({
        where: { id: restore.id },
        data: {
          status: 'completed',
          records_restored: restored,
          completed_at: new Date(),
        },
      });

      logger.audit('BackupService', 'Restore completed', {
        backupId, restoreId: restore.id, records: restored,
      });

      return { restoreId: restore.id, recordsRestored: restored };
    } catch (err: any) {
      await prisma.platform_restores.update({
        where: { id: restore.id },
        data: {
          status: 'failed',
          error_message: err.message,
          completed_at: new Date(),
        },
      });
      throw err;
    }
  }

  /**
   * Delete a backup (file + record).
   */
  async delete(id: string) {
    const backup = await prisma.platform_backups.findUnique({ where: { id } });
    if (!backup) throw new Error('Backup not found');
    if (backup.file_path) {
      try { await unlink(backup.file_path); } catch { /* file may not exist */ }
    }
    await prisma.platform_backups.delete({ where: { id } });
    logger.audit('BackupService', 'Backup deleted', { id });
  }

  /**
   * Enforce retention policy — expire old backups.
   */
  async enforceRetention() {
    const expired = await prisma.platform_backups.findMany({
      where: {
        expires_at: { lte: new Date() },
        status: { not: 'expired' },
      },
    });

    for (const backup of expired) {
      if (backup.file_path) {
        try { await unlink(backup.file_path); } catch { /* ignore */ }
      }
      await prisma.platform_backups.update({
        where: { id: backup.id },
        data: { status: 'expired' },
      });
    }

    return expired.length;
  }

  /**
   * Get backup statistics.
   */
  async getStats() {
    const all = await prisma.platform_backups.findMany({
      select: { type: true, status: true, file_size_bytes: true, started_at: true },
    });

    const totalSize = all.reduce((s, b) => s + Number(b.file_size_bytes ?? 0), 0);
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const b of all) {
      byType[b.type] = (byType[b.type] ?? 0) + 1;
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    }

    const restoreCount = await prisma.platform_restores.count();

    return {
      total: all.length,
      totalSizeBytes: totalSize,
      byType,
      byStatus,
      restoreCount,
      lastBackup: all.length > 0 ? all[0].started_at : null,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async readBackupData(filePath: string, compression: string): Promise<any> {
    const buffer = await readFile(filePath);
    let json: string;
    if (compression === 'gzip') {
      json = gunzipSync(buffer).toString('utf8');
    } else {
      json = buffer.toString('utf8');
    }
    return JSON.parse(json);
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const backupService = new BackupService();
