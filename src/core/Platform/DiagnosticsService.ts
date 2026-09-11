/**
 * M7.6H — Platform Diagnostics Service (Enhanced)
 *
 * Comprehensive system diagnostics for application health, infrastructure,
 * database, Redis, BullMQ, SMTP, storage, memory, and AI providers.
 *
 * SMTP now checks DB notification_providers FIRST, then falls back to env vars.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface DiagnosticResult {
  application: ApplicationInfo;
  infrastructure: InfrastructureInfo;
  database: ComponentStatus;
  redis: ComponentStatus;
  queues: QueueStatus;
  smtp: ComponentStatus;
  storage: StorageInfo;
  memory: MemoryInfo;
  ai: AIProviderInfo;
  os: OsInfo;
  provisioning: ProvisioningStatus;
  health: HealthSummary;
  timestamp: string;
}

interface OsInfo {
  cpuCount: number;
  cpuModel: string;
  totalMemMB: number;
  freeMemMB: number;
  memUsagePercent: number;
  loadAvg: number[];
}

interface ProvisioningStatus {
  workerRunning: boolean;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
}

interface ApplicationInfo {
  name: string;
  version: string;
  environment: string;
  nodeEnv: string;
  gitCommit: string;
  gitBranch: string;
  buildNumber: string;
  buildDate: string;
  dockerImage: string;
  uptime: number;
}

interface InfrastructureInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  prismaVersion: string;
}

interface ComponentStatus {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyMs?: number;
  details?: Record<string, any>;
  error?: string;
}

interface QueueStatus {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  queues: Array<{
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>;
}

interface StorageInfo {
  uploadDir: string;
  totalDocuments: number;
  totalAttachments: number;
}

interface MemoryInfo {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  heapUsagePercent: number;
}

interface AIProviderInfo {
  configured: boolean;
  provider: string | null;
  model: string | null;
  fallbackModel: string | null;
}

interface HealthSummary {
  overall: 'healthy' | 'degraded' | 'down';
  components: Record<string, 'healthy' | 'degraded' | 'down' | 'unknown'>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class DiagnosticsService {

  /**
   * Run a complete diagnostic scan.
   */
  async runDiagnostics(): Promise<DiagnosticResult> {
    const [database, redis, queues, smtp, storage, ai, provisioning] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkSMTP(),
      this.checkStorage(),
      this.checkAI(),
      this.checkProvisioning(),
    ]);

    const application = this.getApplicationInfo();
    const infrastructure = this.getInfrastructureInfo();
    const memory = this.getMemoryInfo();
    const os = this.getOsInfo();

    const components: Record<string, any> = {
      database: database.status,
      redis: redis.status,
      queues: queues.status,
      smtp: smtp.status,
    };

    const statuses = Object.values(components);
    let overall: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (statuses.includes('down')) overall = 'down';
    else if (statuses.includes('degraded') || statuses.includes('unknown')) overall = 'degraded';

    return {
      application,
      infrastructure,
      database,
      redis,
      queues,
      smtp,
      storage,
      memory,
      ai,
      os,
      provisioning,
      health: { overall, components },
      timestamp: new Date().toISOString(),
    };
  }

  private getApplicationInfo(): ApplicationInfo {
    let version = '1.0.0';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('@/../package.json');
      version = pkg.version ?? version;
    } catch { /* ignore */ }

    return {
      name: 'Aurianoa OS',
      version,
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      nodeEnv: process.env.NODE_ENV ?? 'development',
      gitCommit: process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
      gitBranch: process.env.GIT_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
      buildNumber: process.env.BUILD_NUMBER ?? 'local',
      buildDate: process.env.BUILD_DATE ?? new Date().toISOString().split('T')[0],
      dockerImage: process.env.DOCKER_IMAGE ?? 'local',
      uptime: Math.floor(process.uptime()),
    };
  }

  private getInfrastructureInfo(): InfrastructureInfo {
    let prismaVersion = 'unknown';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const prismaPkg = require('@prisma/client/package.json');
      prismaVersion = prismaPkg.version ?? 'unknown';
    } catch {
      prismaVersion = '7.x';
    }

    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      prismaVersion,
    };
  }

  private getMemoryInfo(): MemoryInfo {
    const mem = process.memoryUsage();
    const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024);
    return {
      heapUsedMB: toMB(mem.heapUsed),
      heapTotalMB: toMB(mem.heapTotal),
      rssMB: toMB(mem.rss),
      externalMB: toMB(mem.external),
      heapUsagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    };
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;

      // Get migration status
      const migrations: any[] = await prisma.$queryRaw`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        ORDER BY finished_at DESC 
        LIMIT 3
      `;

      // Get database size
      let databaseSize = 'unknown';
      try {
        const sizeResult: any[] = await prisma.$queryRaw`
          SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `;
        databaseSize = sizeResult[0]?.size ?? 'unknown';
      } catch { /* permission denied on some hosts */ }

      // Get connection count
      let connectionCount = 0;
      try {
        const connResult: any[] = await prisma.$queryRaw`
          SELECT count(*) as count FROM pg_stat_activity 
          WHERE datname = current_database()
        `;
        connectionCount = Number(connResult[0]?.count ?? 0);
      } catch { /* ignore */ }

      return {
        status: latencyMs < 500 ? 'healthy' : 'degraded',
        latencyMs,
        details: {
          lastMigration: migrations[0]?.migration_name ?? 'none',
          totalMigrations: migrations.length,
          databaseSize,
          connectionCount,
        },
      };
    } catch (err: any) {
      return { status: 'down', error: err.message };
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    const start = Date.now();
    try {
      const { getRedis } = await import('@/lib/redis');
      const redis = getRedis();
      await redis.ping();
      const latencyMs = Date.now() - start;

      const info = await redis.info('memory');
      const usedMemory = info.match(/used_memory_human:(.+)/)?.[1]?.trim() ?? 'unknown';

      return {
        status: latencyMs < 200 ? 'healthy' : 'degraded',
        latencyMs,
        details: { usedMemory },
      };
    } catch (err: any) {
      return { status: 'down', error: err.message };
    }
  }

  private async checkQueues(): Promise<QueueStatus> {
    try {
      const { getReportQueue, getScheduledDeliveryQueue, getNotificationQueue } = await import('@/lib/queues');

      const queueChecks = [
        { name: 'report-delivery', queue: getScheduledDeliveryQueue() },
        { name: 'report-generation', queue: getReportQueue() },
        { name: 'notifications', queue: getNotificationQueue() },
      ];

      const queues = [];
      for (const { name, queue } of queueChecks) {
        try {
          const counts = await queue.getJobCounts();
          queues.push({
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
          });
        } catch {
          queues.push({ name, waiting: 0, active: 0, completed: 0, failed: -1 });
        }
      }

      const totalFailed = queues.reduce((sum, q) => sum + (q.failed > 0 ? q.failed : 0), 0);
      return {
        status: totalFailed > 100 ? 'degraded' : 'healthy',
        queues,
      };
    } catch (err: any) {
      return { status: 'unknown', queues: [] };
    }
  }

  /**
   * Check SMTP configuration.
   * Priority: DB notification_providers (default SMTP) → env vars → not configured.
   */
  private async checkSMTP(): Promise<ComponentStatus> {
    // 1. Check DB for a configured notification provider
    try {
      const dbProvider = await prisma.notification_providers.findFirst({
        where: {
          provider_type: 'smtp',
          is_enabled: true,
        },
        orderBy: [
          { is_default: 'desc' },
          { created_at: 'asc' },
        ],
        select: {
          name: true,
          smtp_host: true,
          smtp_port: true,
          smtp_username: true,
          is_default: true,
        },
      });

      if (dbProvider?.smtp_host) {
        return {
          status: 'healthy',
          details: {
            configured: true,
            source: 'database',
            provider: dbProvider.name,
            host: dbProvider.smtp_host,
            port: dbProvider.smtp_port ?? 587,
            username: dbProvider.smtp_username ?? '—',
            isDefault: dbProvider.is_default,
          },
        };
      }
    } catch {
      // notification_providers table may not exist yet — fall through
    }

    // 2. Fall back to env vars
    const host = process.env.SMTP_HOST ?? process.env.EMAIL_SERVER_HOST;
    if (host) {
      return {
        status: 'healthy',
        details: {
          configured: true,
          source: 'environment',
          host,
          port: process.env.SMTP_PORT ?? process.env.EMAIL_SERVER_PORT ?? '587',
          username: process.env.SMTP_USERNAME ?? process.env.EMAIL_SERVER_USER ?? '—',
        },
      };
    }

    // 3. Not configured
    return {
      status: 'unknown',
      details: {
        configured: false,
        source: 'none',
        hint: 'Configure via Platform → Notifications → Providers, or set SMTP_HOST in .env',
      },
    };
  }

  private async checkStorage(): Promise<StorageInfo> {
    const [totalDocuments, totalAttachments] = await Promise.all([
      prisma.docLibrary.count().catch(() => 0),
      prisma.attachment.count({ where: { deleted_at: null } }).catch(() => 0),
    ]);

    return {
      uploadDir: process.env.UPLOAD_DIR ?? './uploads',
      totalDocuments,
      totalAttachments,
    };
  }

  private async checkAI(): Promise<AIProviderInfo> {
    try {
      const settings = await prisma.aiProviderSetting.findFirst();
      return {
        configured: !!settings,
        provider: settings?.provider ?? null,
        model: settings?.model ?? null,
        fallbackModel: settings?.fallback_model ?? null,
      };
    } catch {
      return { configured: false, provider: null, model: null, fallbackModel: null };
    }
  }

  private getOsInfo(): OsInfo {
    const os = require('os');
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return {
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model ?? 'unknown',
      totalMemMB: Math.round(totalMem / 1024 / 1024),
      freeMemMB: Math.round(freeMem / 1024 / 1024),
      memUsagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      loadAvg: os.loadavg(),
    };
  }

  private async checkProvisioning(): Promise<ProvisioningStatus> {
    try {
      const { provisioningWorker } = await import('@/core/Platform/ProvisioningWorker');
      const [queued, running, completed, failed] = await Promise.all([
        prisma.provisioning_jobs.count({ where: { status: 'queued' } }),
        prisma.provisioning_jobs.count({ where: { status: 'running' } }),
        prisma.provisioning_jobs.count({ where: { status: 'completed' } }),
        prisma.provisioning_jobs.count({ where: { status: 'failed' } }),
      ]);
      return {
        workerRunning: provisioningWorker.isRunning,
        queuedJobs: queued,
        runningJobs: running,
        completedJobs: completed,
        failedJobs: failed,
      };
    } catch {
      return { workerRunning: false, queuedJobs: 0, runningJobs: 0, completedJobs: 0, failedJobs: 0 };
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const diagnosticsService = new DiagnosticsService();
