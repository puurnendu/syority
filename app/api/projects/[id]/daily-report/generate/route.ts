import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi } from '@/lib/apiGuard';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';
import { generateSyorityAI } from '@/lib/ai/universalAiClient';
import { format } from 'date-fns';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimiter';
import { isLegacyProjectChainEnabled, LEGACY_PROJECT_CHAIN_RETIRED } from '@/lib/legacyProjectChain';

export const POST = withTenantGuard(async (req, { params }, session) => {
  const { id } = await params;

  // Phase 0 item 5: legacy Project daily-report chain is quarantined.
  // STO shift/daily reporting lives at /shift-reports (M14, Event-scoped).
  {
    const orgId0 = (session?.user as { organization_id?: string })?.organization_id ?? '';
    if (!(await isLegacyProjectChainEnabled(orgId0))) {
      return NextResponse.json(LEGACY_PROJECT_CHAIN_RETIRED, { status: 410 });
    }
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  const identifier = session?.user?.id ?? ip;
  const { allowed, resetAt } = await checkRateLimit(identifier, 'ai');
  if (!allowed) return rateLimitResponse(resetAt);

  const { error } = await guardApi('reports.generate');
  if (error) return error;

  const orgId = (session.user as { organization_id?: string }).organization_id ?? '';
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });
  await assertTenantAccess('project', id, orgId);

  const project = await prisma.project.findFirst({
    where: { id, org_id: orgId },
    include: {
      Workpack: {
        where: { organization_id: orgId, deleted_at: null },
        include: {
          activities: {
            where: {
              deleted_at: null,
              ProgressLog: { some: { log_date: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } },
            },
            include: { ProgressLog: true },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const proj = project as { Workpack: { activities: { description: string; progress_percent?: number | null; status: string | null }[] }[] };
  const activities = proj.Workpack.flatMap((w: { activities: { description: string; progress_percent?: number | null; status: string | null }[] }) => w.activities);
  const activitySummary = activities
    .map((a: { description: string; progress_percent?: number | null; status: string | null }) => `- ${a.description}: ${a.progress_percent ?? 0}% complete (${a.status})`)
    .join('\n');

  const prompt = `
Generate a professional daily status report for the following project:
Project: ${project.name}
Date: ${format(new Date(), 'MMMM d, yyyy')}

Activities updated today:
${activitySummary}

Please structure the report with:
1. Executive Summary
2. Work Completed Today
3. Critical Issues & Constraints
4. Tomorrow's Plan
5. Overall Project Health (SPI/CPI context)

Keep it concise and professional.
`;

  try {
    const aiConfig = await loadProviderForJob(orgId, 'workpack_generation');
    const results = await generateSyorityAI(
        {
            modelIdentifier: aiConfig.model,
            apiKey: aiConfig.apiKey,
        },
        prompt
    );
    
    const reportText = Array.isArray(results) ? results[0] : results;
    
    return NextResponse.json({ report: reportText });
  } catch (err: any) {
    console.error('AI Report Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate AI report' }, { status: 500 });
  }
});
