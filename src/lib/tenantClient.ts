import 'server-only';
import { prisma } from '@/lib/prisma';
import { SessionContext } from '@/lib/server-context';

/**
 * Identify models that do not have an organization_id and are global to the system.
 */
const globalModels = [
  'User', 'Role', 'UserRole', 'Organization', 'OrganizationDocumentSetting',
  'FeatureFlag', 'TenantFeature', 'SystemAuditLog'
];

/**
 * Returns a Prisma Client extension securely bound to the active tenant.
 * Prevents any accidental cross-tenant data leaks and implements Proxy auditing.
 */
export function getTenantClient(session: SessionContext) {
    if (session.mode !== 'tenant' || !session.active_tenant_id) {
        throw new Error('Strict Tenant context required to instantiate getTenantClient.');
    }

    const tenantId = session.active_tenant_id;

    return prisma.$extends({
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    if (globalModels.includes(model)) {
                        // Global models bypass the tenant filter injection
                        return query(args);
                    }

                    const argsObj = (args as any) ?? {};
                    
                    // INJECT TENANT ID ALONG WITH OPERATION
                    if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                        if (operation === 'findUnique') {
                             // findUnique requires exact unique index types, adding a non-unique WHERE might cause TS issues
                             // but Prisma engine supports it on the backend, or we shift to findFirst. Actually Prisma extensions
                             // allow spreading into where. However, findUnique with compound unique + organization_id might be needed.
                        }
                        argsObj.where = { ...(argsObj.where || {}), organization_id: tenantId };
                    }

                    if (['create', 'createMany'].includes(operation)) {
                        if (Array.isArray(argsObj.data)) {
                            argsObj.data = argsObj.data.map((d: any) => ({ ...d, organization_id: tenantId }));
                        } else if (argsObj.data) {
                            argsObj.data = { ...argsObj.data, organization_id: tenantId };
                        }
                    }

                    if (['update', 'upsert', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
                       argsObj.where = { ...(argsObj.where || {}), organization_id: tenantId };
                    }
                    
                    const result = await query(argsObj);

                    // PROXY AUDIT LOGGING FOR ALL WRITE OPERATIONS
                    const mutationOperations = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];
                    if (session.is_proxy && mutationOperations.includes(operation)) {
                        try {
                            const rawPrisma = prisma as any;
                            await rawPrisma.systemAuditLog.create({
                                data: {
                                    user_id: session.user_id,
                                    target_tenant_id: tenantId,
                                    action: `${model}:${operation}`,
                                    metadata: argsObj
                                }
                            });
                        } catch (e) {
                            console.error('[TenantClient] Failed to persist SystemAuditLog:', e);
                        }
                    }

                    return result;
                }
            }
        }
    });
}
