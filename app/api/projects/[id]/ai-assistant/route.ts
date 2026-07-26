import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';
import { generateSyorityAI } from '@/lib/ai/universalAiClient';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimiter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await guardApi('projects.view');
  if (error) return error;

  const { orgId } = orgScope(session);
  const { id: projectId } = await params;
  await assertTenantAccess('project', projectId, orgId);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  const identifier = session?.user?.id ?? ip;
  const { allowed, resetAt } = await checkRateLimit(identifier, 'ai');
  if (!allowed) return rateLimitResponse(resetAt);

  const { message, chatHistory = [] } = await req.json().catch(() => ({}));

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true, name: true, code: true, status: true },
  });
  if (!project) {
    return new Response(
      JSON.stringify({ error: 'Project not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const [actStats, openConstraints, punchSummary, criticalCount] = await Promise.all([
    prisma.activity.aggregate({
      where: { workpack: { project_id: projectId, organization_id: orgId, deleted_at: null } },
      _count: { _all: true },
      _avg: { progress_percent: true },
    }),
    prisma.projectConstraint.count({
      where: { projectId, status: 'Open' },
    }),
    prisma.punchItem.groupBy({
      by: ['category'],
      where: { projectId, status: 'Open' },
      _count: { _all: true },
    }),
    prisma.activity.count({
      where: {
        workpack: { project_id: projectId, organization_id: orgId, deleted_at: null },
        is_critical: true,
      },
    }),
  ]);

  const punchA = punchSummary.find((p) => p.category === 'A')?._count._all ?? 0;
  const progress = Math.round(Number(actStats._avg.progress_percent ?? 0));

  const systemPrompt = `You are SYORITY AI — a turnaround planning expert assistant.

Project: ${project.name} (${project.code}) | Status: ${project.status}
Activities: ${actStats._count._all} total | Progress: ${progress}% | Critical: ${criticalCount}
Open Constraints: ${openConstraints} | A-Punch Items: ${punchA}
Date: ${new Date().toLocaleDateString('en-IN')}

Help with: schedule analysis, constraint resolution, risk identification, priority recommendations.
Be concise. Answer as a senior turnaround planner.`;

  try {
    const aiConfig = await loadProviderForJob(orgId, 'workpack_generation');
    
    // We use generateSyorityAI which handles the generic call (Vertex, OpenAI, Gemini)
    // and returns a result. For streaming compatibility, we'll wrap the result in a stream.
    const results = await generateSyorityAI(
        {
            modelIdentifier: aiConfig.model,
            apiKey: aiConfig.apiKey,
            maxTokens: 1200,
        },
        message,
        systemPrompt
    );

    const fullText = Array.isArray(results) ? (results[0] as string) : String(results);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send the message in one or several chunks to mimic a stream for the frontend
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fullText })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
    });

  } catch (err: any) {
    console.error('[AI Assistant] Error:', err);
    return new Response(
      JSON.stringify({ error: 'AI assistant is temporarily unavailable. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
