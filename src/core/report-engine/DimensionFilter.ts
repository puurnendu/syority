import { DimensionRegistry } from '@/core/dimensions/DimensionRegistry';

/**
 * Builds Prisma `where` clause filters using the DimensionRegistry.
 * Translates report parameters into Prisma filters based on standard and UDF definitions.
 */
export async function buildDimensionFilters(organizationId: string, params: Record<string, any>): Promise<any> {
  const where: any = {};
  
  // 1. Always restrict to organization
  where.organization_id = organizationId;

  // 2. Event is standard
  if (params.event) {
    where.event_id = params.event;
  }

  // 3. Load all dimensions available for this tenant
  const definitions = await DimensionRegistry.getDefinitions(organizationId);

  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;

    // Skip special keys used for non-dimension filtering or internal opts
    if (['event', 'date', 'limit', 'page', 'search'].includes(key)) {
      continue;
    }

    const def = definitions.find(d => d.id === key || d.systemCode === key || d.dbField === key);
    
    if (def) {
      if (def.isUdf && def.dbField) {
        // e.g. customText1
        where[def.dbField] = value;
      } else if (def.dbField) {
        // e.g. site_id, unit_id, discipline_id
        where[def.dbField] = value;
      }
    }
  }

  return where;
}
