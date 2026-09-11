import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';
import { generateSyorityAI } from '@/lib/ai/universalAiClient';
import { isLegacyProjectChainEnabled, LEGACY_PROJECT_CHAIN_RETIRED } from '@/lib/legacyProjectChain';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('reports.generate');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  // Phase 0 item 5: legacy Project daily-report chain is quarantined.
  // STO shift/daily reporting lives at /shift-reports (M14, Event-scoped).
  if (!(await isLegacyProjectChainEnabled(orgId))) {
    return NextResponse.json(LEGACY_PROJECT_CHAIN_RETIRED, { status: 410 });
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
    select: { id: true, name: true, code: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // OD9.2 §22/§31: the STO safety block was removed from the Project daily report.
  //
  // It read `prisma.safetyLog.findFirst({ where: { event_id: projectId } })` — treating a
  // Project id as an Event id, which the original comment admitted outright ("projectId may
  // be event id when called from events TA dashboard"). That call path was the Project TA
  // Dashboard, retired by R0.4-E. Two rules are broken by it: §22 places Safety exclusively
  // under STO, and §31 forbids fabricated Event mappings. It also carried no
  // `organization_id` filter.
  //
  // STO daily safety reporting is unaffected and remains at /safety and
  // /api/events/[eventId]/safety, which are Event-scoped and tenant-filtered.

  const [recentActivities, openConstraints, punchA] = await Promise.all([
    prisma.activity.findMany({
      where: {
        workpack: { project_id: projectId, organization_id: orgId, deleted_at: null },
        OR: [
          { status: 'in_progress' },
          { actual_end: { gte: yesterday } },
        ],
      },
      include: { workpack: { select: { title: true } } },
      take: 15,
      orderBy: { updated_at: 'desc' },
    }),
    prisma.project_constraints.count({
      where: { project_id: projectId, status: 'Open' },
    }),
    prisma.punch_items.count({
      where: { project_id: projectId, category: 'A', status: 'Open' },
    }),
  ]);

  const prompt = `Write a daily project progress report for ${project.name} dated ${new Date().toLocaleDateString('en-IN')}.

═══ SCHEDULE PROGRESS ═══
Active/Recent Activities (${recentActivities.length}):
${recentActivities.map((a) => `- ${a.activity_number ?? a.activity_id ?? ''}: ${a.description} | ${a.status} | ${a.progress_percent ?? 0}%`).join('\n')}

Open Constraints: ${openConstraints}
Category-A Punch Items: ${punchA}

Write the report with this section order:
1. OVERALL PROGRESS
2. WORK COMPLETED TODAY
3. WORK IN PROGRESS
4. PLANNED FOR TOMORROW
5. CONSTRAINTS / ISSUES

Do not invent or infer safety, incident or permit-to-work figures; none are supplied and
safety reporting is owned by the STO domain. Keep under 300 words. Professional tone. Use
actual activity names.`;

  try {
    const aiConfig = await loadProviderForJob(orgId, 'workpack_generation');
    const results = await generateSyorityAI(
        {
            modelIdentifier: aiConfig.model,
            apiKey: aiConfig.apiKey,
            maxTokens: 800,
        },
        prompt
    );
    
    const report = Array.isArray(results) ? results[0] : results;
    return NextResponse.json({
      report,
      generatedAt: new Date().toISOString(),
      stats: {
        activitiesIncluded: recentActivities.length,
        openConstraints,
        punchA,
      },
    });
  } catch (err: any) {
    console.error('Daily report generation error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to generate report' },
      { status: 500 }
    );
  }
});
