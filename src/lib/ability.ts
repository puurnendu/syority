/**
 * @deprecated CASL is NOT used by runtime authorization.
 * Use `@/lib/permissions` hasPermission + `@/security` guards instead.
 * This file is retained only to avoid breaking accidental imports; do not extend it.
 */
import { AbilityBuilder, PureAbility } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma';

export interface SessionUser {
    id: string;
    organization_id: string;
    site_id?: string | null;
    roles?: string[];
}

export type AppActions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'submit' | 'approve' | 'reject' | 'issue' | 'close';
export type AppSubjects = 'all' | 'Workpack' | 'Activity' | 'User' | 'ItemCatalog' | 'JointIntegrityItem' | 'Blind' | 'Constraint' | 'PunchListItem';
export type AppAbility = PureAbility<[AppActions, AppSubjects]>;

/** @deprecated Prefer hasPermission / guardTenantApi / guardPlatformApi */
export function buildAbility(user: SessionUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);
    // Minimal stub — deny-by-default for anything not explicitly granted via permissions.ts
    console.warn('[ability.ts] DEPRECATED: buildAbility() called. Migrate to @/lib/permissions.');
    can('read', 'Workpack');
    void user;
    return build();
}
