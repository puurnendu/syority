/**
 * Organization scope helper for API routes.
 * Use in every route that queries tenant-scoped data.
 */

export function getOrgScope(session: { user?: { organization_id?: string; role?: string; id?: string } }) {
    const orgId = session?.user?.organization_id;
    const role = session?.user?.role ?? '';
    const userId = session?.user?.id;

    if (!orgId) {
        throw new Error('No organization in session');
    }

    return {
        orgId,
        role,
        userId: userId as string | undefined,
        isSuperAdmin: role === 'super_admin' || (session?.user as any)?.is_super_admin === true,
        /** Use in where clauses: where: { ...whereOrg } */
        whereOrg: { organization_id: orgId, deleted_at: null } as const,
    };
}
