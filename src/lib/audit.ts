import { prisma } from './prisma';
import crypto from 'crypto';

/**
 * Helper to handle BigInt serialization in JSON.
 */
function serialize(obj: any) {
    if (!obj) return null;
    return JSON.parse(JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
}

/**
 * AuditService — Append-only audit logging for refinery compliance.
 * 
 * This service writes immutable audit logs for all mutations across all modules.
 * audit_logs table has NO updated_at — it is append-only forever.
 * 
 * Usage pattern in every service mutation:
 *   const oldValues = await prisma.model.findUnique({ where: { id } })
 *   const updated = await prisma.model.update({ where: { id }, data })
 *   await AuditService.log({ ... })
 */
export interface AuditLogInput {
    organizationId: string;
    siteId?: string | null;
    userId?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    model: string; // e.g. 'Workpack', 'Activity', 'WorkpackMaterial'
    modelId: string;
    action: 'created' | 'updated' | 'deleted' | 'restored';
    oldValues?: Record<string, any> | null;
    newValues?: Record<string, any> | null;
    changedFields?: string[] | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestUrl?: string | null;
    method?: string | null;
    context?: 'web' | 'api' | 'queue' | 'batch' | null;
    sessionId?: string | null;
}

export class AuditService {
    /**
     * Log an audit event. This is append-only — no updates or deletes.
     */
    static async log(input: {
        organization_id: string;
        user_id: string;
        action: string;
        model_name: string;
        model_id: string;
        old_values?: any;
        new_values?: any;
        site_id?: string;
        ip_address?: string | null;
        user_agent?: string | null;
    }): Promise<void> {
        try {
            await (prisma.auditLog as any).create({
                data: {
                    id: crypto.randomUUID(),
                    organization_id: input.organization_id,
                    user_id: input.user_id,
                    event: input.action,
                    auditable_type: input.model_name,
                    auditable_id: input.model_id,
                    old_values: serialize(input.old_values),
                    new_values: serialize(input.new_values),
                    site_id: input.site_id ?? null,
                    ip_address: input.ip_address ?? null,
                    user_agent: input.user_agent ?? null,
                },
            });
        } catch (error) {
            // Log audit failures to console but don't throw — audit should never break the app
            console.error('[AuditService] Failed to write audit log:', error);
        }
    }

    /**
     * Helper: Extract changed fields by comparing old and new values.
     */
    static getChangedFields(oldValues: Record<string, any> | null, newValues: Record<string, any> | null): string[] {
        if (!oldValues || !newValues) return [];
        const changed: string[] = [];
        for (const key in newValues) {
            if (oldValues[key] !== newValues[key]) {
                changed.push(key);
            }
        }
        return changed;
    }
}
