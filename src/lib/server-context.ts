import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export interface SessionContext {
    user_id: string;
    role: string;
    mode: 'platform' | 'platform_data' | 'tenant';
    active_tenant_id: string | null;
    is_proxy: boolean;
}

export async function getSessionContext(): Promise<SessionContext | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const user = session.user as any;
    const role = user.role;
    
    // Check if the user is a platform admin
    const isPlatformAdmin = role === 'platform_super_admin' || role === 'platform_admin';

    if (isPlatformAdmin) {
        // Read proxy cookie
        const cookieStore = await cookies();
        const proxyCookie = cookieStore.get('syority_proxy')?.value;
        
        if (proxyCookie) {
            // Validate proxy payload
            try {
                const proxyData = JSON.parse(proxyCookie);
                if (proxyData.tenant_id) {
                    return {
                        user_id: user.id,
                        role: role,
                        mode: 'tenant',
                        active_tenant_id: proxyData.tenant_id,
                        is_proxy: true
                    };
                }
            } catch (e) {
                // Invalid cookie format, ignore and fall through
            }
        }
        
        return {
            user_id: user.id,
            role: role,
            mode: 'platform',
            active_tenant_id: null,
            is_proxy: false
        };
    } else {
        // Standard org_admin or user
        return {
            user_id: user.id,
            role: role,
            mode: 'tenant',
            active_tenant_id: user.organization_id || null, // from auth.ts
            is_proxy: false
        };
    }
}

export async function requirePlatformContext(): Promise<SessionContext> {
    const context = await getSessionContext();
    if (!context || context.mode !== 'platform') {
        redirect('/dashboard');
    }
    return context;
}

/** Resolve the org used for global Platform Master Data (platform org). */
export async function getPlatformOrganizationId(): Promise<string | null> {
    const org = await prisma.organization.findFirst({
        where: {
            deleted_at: null,
            OR: [{ slug: 'syority-platform' }, { tenant_type: 'platform' }],
        },
        select: { id: true },
        orderBy: { created_at: 'asc' },
    });
    return org?.id ?? null;
}

export async function requireDataAdminContext(): Promise<SessionContext> {
    const context = await getSessionContext();
    // A platform admin or a specific data_admin role can access this.
    // For now, if getSessionContext resolves to platform mode, we allow it.
    // Realistically data_admin is a subset of platform permissions.
    if (!context || (context.mode !== 'platform' && context.mode !== 'platform_data')) {
        redirect('/dashboard');
    }

    // Platform Master Data pages need an organization_id. Without proxy,
    // bind to the platform organization so pages do not bounce to /platform/tenants.
    let active_tenant_id = context.active_tenant_id;
    if (!active_tenant_id) {
        active_tenant_id = await getPlatformOrganizationId();
    }

    return { ...context, mode: 'platform_data', active_tenant_id };
}

export async function requireTenantContext(): Promise<SessionContext> {
    const context = await getSessionContext();
    if (!context || context.mode !== 'tenant' || !context.active_tenant_id) {
        // Redirect logic based on role
        if (context?.role === 'platform_super_admin' || context?.role === 'platform_admin') {
            redirect('/platform/tenants');
        } else {
            redirect('/login'); 
        }
    }
    
    // Existence and Status Validation
    const org = await prisma.organization.findUnique({
        where: { id: context.active_tenant_id },
        select: { is_active: true }
    });
    
    if (!org) {
        // Tenant doesn't exist
        redirect('/login');
    }

    if (org.is_active === false && !context.is_proxy) {
        redirect('/suspended');
    }
    
    return context;
}

export function canAccessTenant(session: SessionContext, tenantId: string): boolean {
    if (session.is_proxy) return true; // platform admin via proxy
    return session.active_tenant_id === tenantId;
}
