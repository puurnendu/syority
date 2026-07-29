/**
 * GET /api/planner-workspace/ai-suggestions
 *
 * Returns AI advisory suggestions for a given activity or workpack.
 * Query: ?activityId=<uuid> OR ?workpackId=<uuid>
 *
 * Advisory only — no auto-modifications.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { organization_id: string };
  const activityId = req.nextUrl.searchParams.get('activityId') ?? undefined;
  const workpackId = req.nextUrl.searchParams.get('workpackId') ?? undefined;

  if (!activityId && !workpackId) {
    return NextResponse.json({ error: 'activityId or workpackId required' }, { status: 400 });
  }

  try {
    const suggestions: {
      type: string;
      title: string;
      description: string;
      confidence?: number;
    }[] = [];

    if (workpackId) {
      // Fetch similar historical workpacks on same equipment type
      const wp = await prisma.workpack.findFirst({
        where: { id: workpackId, organization_id: user.organization_id },
        select: {
          equipment_type: true,
          work_type: true,
          asset_id: true,
          activities: {
            where: { deleted_at: null },
            select: { duration_hours: true },
          },
        },
      });

      if (wp?.equipment_type) {
        // Find similar workpacks by equipment type
        const similar = await prisma.workpack.findMany({
          where: {
            organization_id: user.organization_id,
            equipment_type: wp.equipment_type,
            deleted_at: null,
            id: { not: workpackId },
            status: { in: ['completed', 'approved', 'in_progress'] },
          },
          select: {
            workpack_number: true,
            title: true,
            activities: {
              where: { deleted_at: null },
              select: { duration_hours: true },
            },
          },
          take: 10,
        });

        if (similar.length > 0) {
          const durations = similar.map((s) =>
            s.activities.reduce((sum, a) => sum + Number(a.duration_hours ?? 0), 0)
          );
          const median = durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)];
          const min = Math.min(...durations);
          const max = Math.max(...durations);

          suggestions.push({
            type: 'similar_duration',
            title: 'Similar Historical Durations',
            description: `Based on ${similar.length} similar ${wp.equipment_type} workpacks, median duration is ${median}h (range: ${min}–${max}h)`,
            confidence: 0.85,
          });
        }
      }

      // Check for lessons learned on same asset
      if (wp?.asset_id) {
        const lessons = await prisma.lessonLearned.findMany({
          where: {
            organization_id: user.organization_id,
            deleted_at: null,
            workpack: { asset_id: wp.asset_id },
          },
          select: { title: true, description: true },
          take: 5,
        });

        if (lessons.length > 0) {
          suggestions.push({
            type: 'lessons_learned',
            title: 'Relevant Lessons Learned',
            description: `${lessons.length} lesson(s) found from previous work on this asset: ${lessons.map((l) => l.title).join(', ')}`,
          });
        }
      }

      // Check for missing planning information
      if (wp) {
        const missing: string[] = [];
        const currentDuration = wp.activities.reduce(
          (s, a) => s + Number(a.duration_hours ?? 0), 0
        );
        if (currentDuration === 0 && wp.activities.length > 0) {
          missing.push('All activities have zero duration');
        }

        if (missing.length > 0) {
          suggestions.push({
            type: 'missing_info',
            title: 'Missing Planning Information',
            description: missing.join('. '),
          });
        }
      }
    }

    // If no suggestions found, return a default
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'none',
        title: 'No Suggestions',
        description: 'No AI suggestions available for this selection.',
      });
    }

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
