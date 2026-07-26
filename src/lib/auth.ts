import { NextAuthOptions } from 'next-auth';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { resolveAuthorization } from '@/security/identity';
import { Scope } from '@/security/scopes';

export const authOptions: NextAuthOptions = {
    session: { strategy: 'jwt' },
    secret: process.env.NEXTAUTH_SECRET,
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                organization_slug: { label: 'Organization', type: 'text' },
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;
                const emailLower = credentials.email.trim().toLowerCase();

                const user = await prisma.user.findFirst({
                    where: {
                        email: emailLower,
                        is_active: true,
                        deleted_at: null,
                    },
                    include: {
                        organization: { select: { name: true, slug: true, is_active: true, tenant_type: true } },
                        user_roles: { include: { role: { select: { id: true, slug: true, name: true } } } },
                    },
                });

                if (!user) {
                    console.log('[Auth] Login failed: no user found for email:', emailLower);
                    return null;
                }

                if (!(user as any).organization || !(user as any).organization.is_active) {
                    console.log('[Auth] Login failed: organization is inactive or missing for:', emailLower);
                    return null;
                }

                const valid = await bcrypt.compare(credentials.password, user.password);
                if (!valid) {
                    console.log('[Auth] Login failed: password mismatch for:', emailLower);
                    return null;
                }

                await prisma.user.update({
                    where: { id: user.id },
                    data: { last_login_at: new Date() },
                });

                const resolved = resolveAuthorization({
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    organizationId: user.organization_id,
                    organizationName: (user as any).organization?.name,
                    siteId: user.site_id,
                    isActive: user.is_active !== false,
                    roleRows: (user as any).user_roles.map((ur: any) => ({
                        id: ur.role.id,
                        slug: ur.role.slug,
                        name: ur.role.name,
                    })),
                });

                const tenantType =
                    (user as any).organization?.tenant_type ||
                    (resolved.authorization.scope === Scope.PLATFORM ? 'platform' : 'refinery');

                return {
                    id: resolved.identity.userId,
                    name: resolved.identity.name,
                    email: resolved.identity.email,
                    // Authorization (role-based SoT)
                    role: resolved.authorization.primaryRole,
                    roles: resolved.authorization.roles,
                    role_ids: resolved.authorization.roleIds,
                    scope: resolved.authorization.scope,
                    // Identity
                    organization_id: resolved.identity.organizationId,
                    organization_name: resolved.identity.organizationName,
                    tenant_type: tenantType,
                    site_id: resolved.identity.siteId ?? undefined,
                    // Derived compatibility flags — NOT read from User.is_* columns
                    is_super_admin: resolved.authorization.derived.is_super_admin,
                    is_tenant_admin: resolved.authorization.derived.is_tenant_admin,
                    must_change_password: (user as any).must_change_password,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
                token.role = (user as any).role;
                token.roles = (user as any).roles;
                token.role_ids = (user as any).role_ids;
                token.scope = (user as any).scope;
                token.organization_id = (user as any).organization_id;
                token.organization_name = (user as any).organization_name ?? undefined;
                token.tenant_type = (user as any).tenant_type;
                token.site_id = (user as any).site_id ?? undefined;
                token.is_super_admin = (user as any).is_super_admin;
                token.is_tenant_admin = (user as any).is_tenant_admin;
                token.must_change_password = (user as any).must_change_password;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = ((token.sub as string) || (token.id as string)) as string;
                session.user.name = (token.name as string) ?? '';
                session.user.email = (token.email as string) ?? '';
                session.user.role = token.role as string;
                (session.user as any).roles = token.roles as string[];
                (session.user as any).role_ids = token.role_ids as string[];
                (session.user as any).scope = token.scope as string;
                session.user.organization_id = token.organization_id as string;
                session.user.organization_name = token.organization_name as string | undefined;
                (session.user as any).tenant_type = token.tenant_type;
                session.user.site_id = token.site_id as string | undefined;
                (session.user as any).is_super_admin = token.is_super_admin as boolean;
                (session.user as any).is_tenant_admin = token.is_tenant_admin as boolean;
                (session.user as any).must_change_password = token.must_change_password as boolean;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
};

/** @deprecated Prefer apiAuth.getOrgIdFromRequest (proxy-aware). */
export async function getOrgIdFromRequest(req: NextRequest): Promise<string | null> {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const orgId = token?.organization_id;
    return typeof orgId === 'string' ? orgId : null;
}

export async function getUserIdFromRequest(req: NextRequest): Promise<string> {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const id = token?.sub ?? token?.id;
    return typeof id === 'string' ? id : 'system';
}
