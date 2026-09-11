import { prisma } from '@/lib/prisma';
import { RelationshipType } from '@prisma/client';

export class ProjectBranchingService {
  /**
   * Creates a deep-copy of a project as a baseline.
   * This includes all activities, relationships, and secondary data.
   *
   * ⚠️ NON-FUNCTIONAL — pre-dates the R0.4 Event architecture and does not compile.
   * It reads `Project.activities` and writes `Project.orgId` / `plantName` / `isBaseline`,
   * none of which exist on the model. OD9.1 removed its retired `Activity.project_id`
   * write but deliberately did not rebuild the feature: under R0.4 the Event is the STO
   * campaign container and `ScheduleBaseline` is the baseline mechanism M11 actually uses,
   * so reviving project branching is a product decision, not schema reconciliation.
   * Recorded as OD9-035. Its only callers are app/api/projects/[id]/baselines/route.ts.
   */
  static async createBaseline(projectId: string, baselineName: string, userId: string): Promise<string> {
    const sourceProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        activities: {
          include: {
            udf_values: true,
            resources: true,
          }
        }
      }
    });

    if (!sourceProject) throw new Error('Source project not found');

    return await prisma.$transaction(async (tx) => {
      // 1. Create the Baseline Project record
      const baseline = await tx.project.create({
        data: {
          orgId:          sourceProject.orgId,
          name:           baselineName,
          code:           `${sourceProject.code}-B-${Date.now().toString().slice(-4)}`,
          client:         sourceProject.client,
          location:       sourceProject.location,
          plantName:      sourceProject.plantName,
          status:         'Baseline',
          isBaseline:     true,
          parentProjectId: sourceProject.id,
          createdBy:      userId,
        }
      });

      // 2. Clone Activities and maintain a mapping of Old ID -> New ID
      const activityMapping = new Map<string, string>();
      
      for (const act of sourceProject.activities) {
        const { id: oldId, udf_values, resources, ...actData } = act;
        
        const newAct = await tx.activity.create({
          data: {
            ...actData as any,
            // OD9.1: `project_id: baseline.id` removed — Activity.project_id was retired
            // and never existed in the database, so this write would always have failed.
            // Nothing replaces it: cloned activities are reached through the Workpack.
            // Detach from workpacks to avoid confusion in baseline snapshots
            workpack_id: null,
            // Re-clone UDF values
            udf_values: {
              create: udf_values.map(u => ({
                organization_id: u.organization_id,
                field_id: u.field_id,
                value_string: u.value_string,
                value_number: u.value_number,
                value_date: u.value_date,
              }))
            },
            // Re-clone resources
            resources: {
              create: resources.map(r => ({
                organization_id: r.organization_id,
                resource_id: r.resource_id,
                planned_units: r.planned_units,
                actual_units: r.actual_units,
                cost_per_unit: r.cost_per_unit,
              }))
            }
          }
        });
        
        activityMapping.set(oldId, newAct.id);
      }

      // 3. Clone Relationships with re-mapped IDs
      const sourceRels = await tx.activityRelationship.findMany({
        where: {
          OR: [
            { predecessor_id: { in: Array.from(activityMapping.keys()) } },
            { successor_id:   { in: Array.from(activityMapping.keys()) } }
          ]
        }
      });

      // Filter to only those where BOTH ends are within the project
      // (Cross-project relationships are rare and arguably shouldn't be in a internal baseline snapshot)
      const internalRels = sourceRels.filter(r => 
        activityMapping.has(r.predecessor_id) && activityMapping.has(r.successor_id)
      );

      if (internalRels.length > 0) {
        await tx.activityRelationship.createMany({
          data: internalRels.map(r => ({
            organization_id: r.organization_id,
            predecessor_id:  activityMapping.get(r.predecessor_id)!,
            successor_id:    activityMapping.get(r.successor_id)!,
            relationship_type: r.relationship_type,
            lag_days:        r.lag_days,
            created_by:      userId,
          }))
        });
      }

      return baseline.id;
    }, {
      timeout: 120000, // 2 mins for large copies
    });
  }

  /**
   * Restores a baseline as a NEW standalone project.
   */
  static async restoreBaseline(baselineId: string, userId: string): Promise<string> {
    const baseline = await prisma.project.findUnique({
      where: { id: baselineId },
    });

    if (!baseline) throw new Error('Baseline not found');

    const restoreName = `Restored: ${baseline.name} (${new Date().toLocaleDateString()})`;
    const newProjectId = await this.createBaseline(baselineId, restoreName, userId);
    
    // Mark the newly created one as a non-baseline (standalone)
    await prisma.project.update({
      where: { id: newProjectId },
      data: { isBaseline: false, parentProjectId: null, status: 'Restored' }
    });

    return newProjectId;
  }
}
