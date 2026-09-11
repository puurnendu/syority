/**
 * M8.11 — Seed Script for Scope Change & Discovery Work
 *
 * Creates test data for the scope change workflow using existing
 * organization, event, and user IDs from the database.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('M8.11 Seed — Starting...');

  // Get first org/event/user
  const org = await prisma.organization.findFirst();
  if (!org) { console.error('No organization found'); process.exit(1); }

  const event = await prisma.event.findFirst({ where: { organization_id: org.id } });
  if (!event) { console.error('No event found'); process.exit(1); }

  const user = await prisma.user.findFirst({ where: { organization_id: org.id } });
  if (!user) { console.error('No user found'); process.exit(1); }

  console.log(`Org: ${org.name} (${org.id})`);
  console.log(`Event: ${event.name} (${event.id})`);
  console.log(`User: ${user.name} (${user.id})`);

  // ── Discovery Work Records ────────────────────────────────────────
  const discoveries = [
    {
      id: randomUUID(),
      organization_id: org.id,
      event_id: event.id,
      title: 'Corroded pipe section discovered on P-101',
      description: 'During walkdown of Unit 2, significant corrosion was found on P-101 discharge piping. Wall thickness below minimum. Requires pipe replacement.',
      discovery_type: 'inspection_finding',
      source: 'Field Inspection — Unit 2 Walkdown',
      location: 'Unit 2, Pipe Rack Level 3',
      discipline: 'Mechanical',
      priority: 'high',
      estimated_hours: 120,
      estimated_cost: 35000,
      status: 'discovered',
      discovered_by: user.id,
    },
    {
      id: randomUUID(),
      organization_id: org.id,
      event_id: event.id,
      title: 'Emergency valve repair — PSV-205',
      description: 'Pressure safety valve PSV-205 failed bench test. Must be replaced during turnaround window.',
      discovery_type: 'emergency',
      source: 'Safety Team Report',
      location: 'Unit 1, Reactor Section',
      discipline: 'Instrumentation',
      priority: 'critical',
      estimated_hours: 40,
      estimated_cost: 15000,
      status: 'assessed',
      assessed_by: user.id,
      assessed_at: new Date(),
      assessment_notes: 'Critical safety item. Must be included in current TA scope.',
      discovered_by: user.id,
    },
    {
      id: randomUUID(),
      organization_id: org.id,
      event_id: event.id,
      title: 'Heat exchanger bundle replacement opportunity',
      description: 'E-301 heat exchanger showing reduced performance. Opportunity to replace bundle during TA.',
      discovery_type: 'opportunity',
      source: 'Process Engineering Review',
      location: 'Unit 3, Heat Recovery Section',
      discipline: 'Mechanical',
      priority: 'medium',
      estimated_hours: 80,
      estimated_cost: 45000,
      status: 'discovered',
      discovered_by: user.id,
    },
    {
      id: randomUUID(),
      organization_id: org.id,
      event_id: event.id,
      title: 'Electrical cable tray replacement — Area B',
      description: 'Cable tray supports show fatigue damage. Regulatory requirement to replace before next inspection cycle.',
      discovery_type: 'regulatory',
      source: 'Regulatory Compliance Audit',
      location: 'Area B, Cable Gallery',
      discipline: 'Electrical',
      priority: 'high',
      estimated_hours: 60,
      estimated_cost: 22000,
      status: 'discovered',
      discovered_by: user.id,
    },
    {
      id: randomUUID(),
      organization_id: org.id,
      event_id: event.id,
      title: 'Foundation bolt replacement — Compressor C-102',
      description: 'Vibration analysis indicates loose foundation bolts on C-102. Field team confirms 4 bolts need replacement.',
      discovery_type: 'field_discovery',
      source: 'Vibration Analyst',
      location: 'Unit 1, Compressor House',
      discipline: 'Mechanical',
      priority: 'low',
      estimated_hours: 16,
      estimated_cost: 3000,
      status: 'rejected',
      assessed_by: user.id,
      assessed_at: new Date(),
      assessment_notes: 'Can be done during normal maintenance. Not TA scope.',
      discovered_by: user.id,
    },
  ];

  for (const d of discoveries) {
    await prisma.discoveryWork.upsert({
      where: { id: d.id },
      create: d as any,
      update: {},
    });
  }
  console.log(`Created ${discoveries.length} discovery records`);

  // ── Scope Change Proposals ────────────────────────────────────────
  const sc1Id = randomUUID();
  const sc2Id = randomUUID();
  const sc3Id = randomUUID();

  const scopeChanges = [
    {
      id: sc1Id,
      organization_id: org.id,
      event_id: event.id,
      discovery_id: discoveries[1].id, // Emergency valve
      change_number: 'SCH-001',
      title: 'Emergency PSV-205 Replacement',
      description: 'Add emergency valve replacement activities for PSV-205',
      change_category: 'scope_addition',
      justification: 'Safety-critical item that failed bench test',
      status: 'approved',
      priority: 'critical',
      discipline: 'Instrumentation',
      schedule_impact_days: 2.5,
      cost_impact: 15000,
      resource_impact_hours: 40,
      critical_path_affected: false,
      impact_analysis: {
        schedule_impact_days: 2.5,
        cost_impact: 15000,
        resource_impact_hours: 40,
        critical_path_affected: false,
        details: {
          new_activities: 3,
          modified_activities: 0,
          removed_activities: 0,
          new_workpacks: 1,
          total_estimated_hours: 40,
          total_estimated_cost: 15000,
          baseline_exists: true,
          event_duration_days: 21,
          impact_percentage: 11.9,
        },
      },
      submitted_by: user.id,
      submitted_at: new Date(Date.now() - 3600000),
      approved_by: user.id,
      approved_at: new Date(Date.now() - 1800000),
      review_notes: 'Approved — safety-critical item',
      created_by: user.id,
    },
    {
      id: sc2Id,
      organization_id: org.id,
      event_id: event.id,
      change_number: 'SCH-002',
      title: 'Add Heat Exchanger E-301 Bundle Replacement',
      description: 'Scope addition for heat exchanger bundle replacement — performance improvement',
      change_category: 'scope_addition',
      justification: 'Opportunity to improve unit performance during existing TA window',
      status: 'proposed',
      priority: 'medium',
      discipline: 'Mechanical',
      schedule_impact_days: 5,
      cost_impact: 45000,
      resource_impact_hours: 80,
      critical_path_affected: true,
      impact_analysis: {
        schedule_impact_days: 5,
        cost_impact: 45000,
        resource_impact_hours: 80,
        critical_path_affected: true,
      },
      submitted_by: user.id,
      submitted_at: new Date(),
      created_by: user.id,
    },
    {
      id: sc3Id,
      organization_id: org.id,
      event_id: event.id,
      discovery_id: discoveries[0].id, // Corroded pipe
      change_number: 'SCH-003',
      title: 'P-101 Pipe Replacement — Corrosion Repair',
      description: 'Add pipe replacement activities for corroded section of P-101',
      change_category: 'scope_addition',
      justification: 'Wall thickness below minimum — integrity risk',
      status: 'draft',
      priority: 'high',
      discipline: 'Mechanical',
      created_by: user.id,
    },
  ];

  for (const sc of scopeChanges) {
    await prisma.scheduleScopeChange.upsert({
      where: { id: sc.id },
      create: sc as any,
      update: {},
    });
  }
  console.log(`Created ${scopeChanges.length} scope changes`);

  // Mark discovery[1] as converted (linked to SCH-001)
  await prisma.discoveryWork.update({
    where: { id: discoveries[1].id },
    data: { status: 'converted', scope_change_id: sc1Id },
  });

  // ── Scope Change Items ────────────────────────────────────────────
  const items = [
    // SCH-001 items (approved)
    {
      id: randomUUID(), scope_change_id: sc1Id, item_type: 'new_workpack',
      description: 'Emergency PSV-205 Replacement Work Package',
      discipline: 'Instrumentation', estimated_hours: 0, estimated_cost: 0,
      sort_order: 1,
    },
    {
      id: randomUUID(), scope_change_id: sc1Id, item_type: 'new_activity',
      description: 'Remove PSV-205 from service',
      discipline: 'Instrumentation', estimated_hours: 8, estimated_cost: 2500,
      resource_type: 'labor', crew_size: 2, sort_order: 2,
    },
    {
      id: randomUUID(), scope_change_id: sc1Id, item_type: 'new_activity',
      description: 'Install replacement PSV-205 and bench test',
      discipline: 'Instrumentation', estimated_hours: 16, estimated_cost: 8000,
      resource_type: 'labor', crew_size: 2, sort_order: 3,
    },
    {
      id: randomUUID(), scope_change_id: sc1Id, item_type: 'new_activity',
      description: 'PSV-205 re-commissioning and function test',
      discipline: 'Instrumentation', estimated_hours: 16, estimated_cost: 4500,
      resource_type: 'labor', crew_size: 3, sort_order: 4,
    },
    // SCH-002 items (proposed)
    {
      id: randomUUID(), scope_change_id: sc2Id, item_type: 'new_workpack',
      description: 'E-301 Bundle Replacement Work Package',
      discipline: 'Mechanical', estimated_hours: 0, estimated_cost: 0,
      sort_order: 1,
    },
    {
      id: randomUUID(), scope_change_id: sc2Id, item_type: 'new_activity',
      description: 'Unbolt and remove E-301 channel cover',
      discipline: 'Mechanical', estimated_hours: 24, estimated_cost: 8000,
      resource_type: 'labor', crew_size: 4, sort_order: 2,
    },
    {
      id: randomUUID(), scope_change_id: sc2Id, item_type: 'new_activity',
      description: 'Extract existing bundle and install replacement',
      discipline: 'Mechanical', estimated_hours: 32, estimated_cost: 25000,
      resource_type: 'labor', crew_size: 6, sort_order: 3,
    },
    {
      id: randomUUID(), scope_change_id: sc2Id, item_type: 'new_activity',
      description: 'Reassemble, pressure test and leak check',
      discipline: 'Mechanical', estimated_hours: 24, estimated_cost: 12000,
      resource_type: 'labor', crew_size: 4, sort_order: 4,
    },
    // SCH-003 items (draft)
    {
      id: randomUUID(), scope_change_id: sc3Id, item_type: 'new_activity',
      description: 'Cut and remove corroded pipe section P-101',
      discipline: 'Mechanical', estimated_hours: 40, estimated_cost: 12000,
      resource_type: 'labor', crew_size: 3, sort_order: 1,
    },
    {
      id: randomUUID(), scope_change_id: sc3Id, item_type: 'new_activity',
      description: 'Weld new pipe spool and hydro test',
      discipline: 'Mechanical', estimated_hours: 48, estimated_cost: 15000,
      resource_type: 'labor', crew_size: 4, sort_order: 2,
    },
    {
      id: randomUUID(), scope_change_id: sc3Id, item_type: 'new_activity',
      description: 'Insulation and painting',
      discipline: 'Mechanical', estimated_hours: 32, estimated_cost: 8000,
      resource_type: 'labor', crew_size: 2, sort_order: 3,
    },
  ];

  for (const item of items) {
    await prisma.scheduleScopeChangeItem.upsert({
      where: { id: item.id },
      create: item as any,
      update: {},
    });
  }
  console.log(`Created ${items.length} scope change items`);

  // ── Verify ────────────────────────────────────────────────────────
  const dCount = await prisma.discoveryWork.count();
  const scCount = await prisma.scheduleScopeChange.count();
  const itemCount = await prisma.scheduleScopeChangeItem.count();

  console.log('\n=== M8.11 SEED VERIFICATION ===');
  console.log(`Discovery work records: ${dCount}`);
  console.log(`Scope change proposals: ${scCount}`);
  console.log(`Scope change items: ${itemCount}`);
  console.log('M8.11 SEED COMPLETE');

  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
