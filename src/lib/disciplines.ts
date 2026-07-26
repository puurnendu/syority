import { prisma } from '@/lib/prisma';

const DEFAULT_DISCIPLINES = [
    { code: 'MECH', name: 'Mechanical', color: '#3B82F6' },
    { code: 'ELEC', name: 'Electrical', color: '#F59E0B' },
    { code: 'INST', name: 'Instrumentation', color: '#8B5CF6' },
    { code: 'CIVIL', name: 'Civil', color: '#10B981' },
    { code: 'PIPING', name: 'Piping', color: '#EF4444' },
    { code: 'STRUCT', name: 'Structural', color: '#6B7280' },
] as const;

/**
 * Ensures the organization has the default disciplines (idempotent).
 * Call before loading disciplines so the Lead Discipline dropdown is always populated.
 */
export async function ensureDefaultDisciplinesForOrg(organizationId: string): Promise<void> {
    try {
        if (!organizationId || organizationId === 'undefined' || organizationId === 'null') {
            console.warn('[Disciplines] Skipping initialization: Invalid organizationId provided.');
            return;
        }

        // Basic UUID format check to avoid Prisma errors before hitting the DB
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(organizationId)) {
            console.error(`[Disciplines] Invalid organizationId format: ${organizationId}`);
            return;
        }

        // Verify organization exists to avoid foreign key violation (Discipline_organization_id_fkey)
        const orgCount = await prisma.organization.count({
            where: { id: organizationId },
        });

        if (orgCount === 0) {
            console.warn(`[Disciplines] Skipping initialization: Organization ${organizationId} not found in database.`);
            return;
        }

        for (const d of DEFAULT_DISCIPLINES) {
            try {
                await prisma.discipline.upsert({
                    where: {
                        organization_id_code: { organization_id: organizationId, code: d.code },
                    },
                    update: { color: d.color, name: d.name, is_active: true },
                    create: {
                        organization_id: organizationId,
                        code: d.code,
                        name: d.name,
                        color: d.color,
                        is_active: true,
                    },
                });
            } catch (upsertErr: any) {
                // Log individual upsert failures but continue with others
                console.error(`[Disciplines] Failed to upsert discipline ${d.code}:`, {
                    code: upsertErr.code,
                    message: upsertErr.message,
                    meta: upsertErr.meta
                });
            }
        }
    } catch (err: any) {
        console.error(`[Disciplines] Critical error ensuring default disciplines for org ${organizationId}:`, {
            name: err.name,
            code: err.code,
            message: err.message,
            stack: err.stack
        });
    }
}
