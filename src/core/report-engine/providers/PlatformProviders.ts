/**
 * M7.6B — Platform Data Providers
 *
 * 4 providers: user_activity, audit_log, notification_statistics, login_history.
 */

import { prisma } from '@/lib/prisma';
import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';

function toDateFilter(params: Record<string, any>) {
  const filters: any = {};
  if (params.date_from) filters.gte = new Date(params.date_from);
  if (params.date_to) filters.lte = new Date(params.date_to);
  return Object.keys(filters).length ? filters : undefined;
}

export class UserActivityProvider extends BaseProvider {
  readonly key = 'platform.user_activity';
  readonly category = 'platform';
  readonly name = 'User Activity Report';
  readonly description = 'User action counts and activity summary.';
  readonly optionalParams = ['date_from', 'date_to'];
  readonly maxRows = 500;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const dateFilter = toDateFilter(params);
    const logs = await prisma.auditLog.findMany({
      where: { organization_id: ctx.organizationId, ...(dateFilter ? { created_at: dateFilter } : {}) },
      select: { user_id: true, action: true, model_name: true, created_at: true },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    const userMap = new Map<string, number>();
    (logs as any[]).forEach((l) => { userMap.set(l.user_id ?? 'system', (userMap.get(l.user_id ?? 'system') ?? 0) + 1); });
    return {
      rows: Array.from(userMap.entries()).map(([userId, count]) => ({ user_id: userId, action_count: count })),
      kpis: [{ label: 'Total Actions', value: logs.length }, { label: 'Active Users', value: userMap.size }],
      metadata: { recordCount: logs.length },
    };
  }
}

export class AuditLogProvider extends BaseProvider {
  readonly key = 'platform.audit_log';
  readonly category = 'platform';
  readonly name = 'Audit Log Report';
  readonly description = 'Detailed audit log entries.';
  readonly optionalParams = ['date_from', 'date_to'];
  readonly maxRows = 200;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const dateFilter = toDateFilter(params);
    const logs = await prisma.auditLog.findMany({
      where: { organization_id: ctx.organizationId, ...(dateFilter ? { created_at: dateFilter } : {}) },
      select: { action: true, model_name: true, model_id: true, user: { select: { name: true } }, created_at: true },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    return {
      rows: (logs as any[]).map((l) => ({
        action: l.action, model: l.model_name ?? '—', model_id: l.model_id?.slice(0, 8) ?? '—',
        user: l.user?.name ?? 'System', time: l.created_at?.toISOString().slice(0, 19).replace('T', ' ') ?? '—',
      })),
      kpis: [{ label: 'Log Entries', value: logs.length }],
      metadata: { recordCount: logs.length },
    };
  }
}

export class NotificationStatisticsProvider extends BaseProvider {
  readonly key = 'platform.notification_statistics';
  readonly category = 'platform';
  readonly name = 'Notification Statistics';
  readonly description = 'Notification delivery statistics — sent, failed, pending.';
  readonly optionalParams = ['date_from', 'date_to'];

  async fetch(_ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const dateFilter = toDateFilter(params);
    const [total, sent, failed, pending] = await Promise.all([
      prisma.notification_delivery_logs.count({ where: dateFilter ? { sent_at: dateFilter } : {} }).catch(() => 0),
      prisma.notification_delivery_logs.count({ where: { status: 'sent', ...(dateFilter ? { sent_at: dateFilter } : {}) } }).catch(() => 0),
      prisma.notification_delivery_logs.count({ where: { status: 'failed', ...(dateFilter ? { sent_at: dateFilter } : {}) } }).catch(() => 0),
      prisma.notification_queue.count({ where: { status: 'pending' } }).catch(() => 0),
    ]);
    return {
      kpis: [
        { label: 'Total Sent', value: total },
        { label: 'Delivered', value: sent, color: '#059669' },
        { label: 'Failed', value: failed, color: '#DC2626' },
        { label: 'Pending', value: pending, color: '#F59E0B' },
      ],
    };
  }
}

export class LoginHistoryProvider extends BaseProvider {
  readonly key = 'platform.login_history';
  readonly category = 'platform';
  readonly name = 'Login History';
  readonly description = 'User login events.';
  readonly optionalParams = ['date_from', 'date_to'];
  readonly maxRows = 200;

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const dateFilter = toDateFilter(params);
    const logs = await prisma.auditLog.findMany({
      where: { organization_id: ctx.organizationId, action: 'LOGIN', ...(dateFilter ? { created_at: dateFilter } : {}) },
      select: { user: { select: { name: true, email: true } }, created_at: true },
      orderBy: { created_at: 'desc' }, take: this.maxRows,
    }).catch(() => []);
    return {
      rows: (logs as any[]).map((l) => ({
        user: l.user?.name ?? '—', email: l.user?.email ?? '—',
        time: l.created_at?.toISOString().slice(0, 19).replace('T', ' ') ?? '—',
      })),
      kpis: [{ label: 'Login Events', value: logs.length }],
      metadata: { recordCount: logs.length },
    };
  }
}

export const platformProviders = [
  new UserActivityProvider(),
  new AuditLogProvider(),
  new NotificationStatisticsProvider(),
  new LoginHistoryProvider(),
];
