import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';
import { generateSyorityAI } from '@/lib/ai/universalAiClient';

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('reports.generate');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true, name: true, code: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Safety first: try event-scoped safety log (projectId may be event id when called from events TA dashboard)
  const todaySafety = await prisma.safetyLog.findFirst({
    where: { eventId: projectId },
    orderBy: { logDate: 'desc' },
    include: { incidents: { where: { status: { not: 'Closed' } } } },
  }).catch(() => null);

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
    prisma.projectConstraint.count({
      where: { projectId, status: 'Open' },
    }),
    prisma.punchItem.count({
      where: { projectId, category: 'A', status: 'Open' },
    }),
  ]);

  const safetyBlock = todaySafety
    ? `═══ SAFETY (ALWAYS FIRST) ═══
LTI: ${todaySafety.lti ?? 0} | Near Miss: ${todaySafety.nearMiss ?? 0} | First Aid: ${todaySafety.firstAid ?? 0}
Manpower: ${todaySafety.manpowerActual ?? 0} on site | Manhours: ${Number(todaySafety.manhoursWorked ?? 0)}
PTW: ${todaySafety.ptwIssued ?? 0} issued / ${todaySafety.ptwClosed ?? 0} closed
Toolbox Talks: ${todaySafety.toolboxTalks ?? 0}
Open Incidents: ${todaySafety.incidents?.length ?? 0}
${todaySafety.safetyNotes ? `Safety Notes: ${todaySafety.safetyNotes}` : ''}

`
    : '';

  const prompt = `Write a daily turnaround progress report for ${project.name} dated ${new Date().toLocaleDateString('en-IN')}.

${safetyBlock}═══ SCHEDULE PROGRESS ═══
Active/Recent Activities (${recentActivities.length}):
${recentActivities.map((a) => `- ${a.activity_number ?? a.activity_id ?? ''}: ${a.description} | ${a.status} | ${a.progress_percent ?? 0}%`).join('\n')}

Open Constraints: ${openConstraints}
Category-A Punch Items: ${punchA}

Write the report with this section order:
1. SAFETY STATUS (first — always)
2. OVERALL PROGRESS
3. WORK COMPLETED TODAY
4. WORK IN PROGRESS
5. PLANNED FOR TOMORROW
6. CONSTRAINTS / ISSUES

If LTI > 0, flag it prominently at the top. Keep under 300 words. Professional tone. Use actual activity names.`;

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
