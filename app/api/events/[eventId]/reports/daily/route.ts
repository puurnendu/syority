import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';
import { generateSyorityAI } from '@/lib/ai/universalAiClient';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, error } = await guardApi('reports.generate');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true, name: true, code: true },
  });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const todaySafety = await prisma.safetyLog.findFirst({
    where: { event_id: eventId },
    orderBy: { log_date: 'desc' },
    include: { SafetyIncident: { where: { status: { not: 'Closed' } } } },
  });

  const workpackIds = (
    await prisma.workpack.findMany({
      where: { event_id: eventId, deleted_at: null },
      select: { id: true },
    })
  ).map((w) => w.id);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const [recentActivities, openConstraints, punchA] = await Promise.all([
    workpackIds.length > 0
      ? prisma.activity.findMany({
          where: {
            workpack_id: { in: workpackIds },
            deleted_at: null,
            OR: [
              { status: 'in_progress' },
              { actual_end: { gte: yesterday } },
            ],
          },
          include: { workpack: { select: { title: true } } },
          take: 15,
          orderBy: { updated_at: 'desc' },
        })
      : [],
    workpackIds.length > 0
      ? prisma.constraintLog.count({
          where: { workpack_id: { in: workpackIds }, status: 'open', deleted_at: null },
        })
      : 0,
    workpackIds.length > 0
      ? prisma.punchListItem.count({
          where: {
            workpack_id: { in: workpackIds },
            category: 'A',
            status: 'open',
            deleted_at: null,
          },
        })
      : 0,
  ]);

  const safetyBlock = todaySafety
    ? `═══ SAFETY (ALWAYS FIRST) ═══
LTI: ${todaySafety.lti ?? 0} | Near Miss: ${todaySafety.near_miss ?? 0} | First Aid: ${todaySafety.first_aid ?? 0}
Manpower: ${todaySafety.manpower_actual ?? 0} on site | Manhours: ${Number(todaySafety.manhours_worked ?? 0)}
PTW: ${todaySafety.ptw_issued ?? 0} issued / ${todaySafety.ptw_closed ?? 0} closed
Toolbox Talks: ${todaySafety.toolbox_talks ?? 0}
Open Incidents: ${(todaySafety as any).SafetyIncident?.length ?? 0}
${todaySafety.safety_notes ? `Safety Notes: ${todaySafety.safety_notes}` : ''}

`
    : '';

  const prompt = `Write a daily turnaround progress report for ${event.name} dated ${new Date().toLocaleDateString('en-IN')}.

${safetyBlock}═══ SCHEDULE PROGRESS ═══
Active/Recent Activities (${recentActivities.length}):
${recentActivities.map((a: any) => `- ${a.activity_number ?? a.activity_id ?? ''}: ${a.description} | ${a.status} | ${a.progress_percent ?? 0}%`).join('\n')}

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
    const reports = await generateSyorityAI(
      {
          modelIdentifier: aiConfig.model,
          apiKey: aiConfig.apiKey,
          maxTokens: 800,
      },
      prompt
    );
    const report = Array.isArray(reports) ? reports[0] : reports;
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
}
