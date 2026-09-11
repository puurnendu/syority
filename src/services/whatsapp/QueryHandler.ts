import { prisma } from '@/lib/prisma';

/**
 * @deprecated M16-R4 will replace this with M16InteractionPipeline.
 * This handler queries Prisma directly without event context or M16 entity resolution.
 * It will be migrated to use governed tools via the M16 pipeline.
 */
export async function handleQuery(
  extracted: { query_type: string | null; query_target: string | null },
  user: { id: string; name: string },
  orgId: string,
  lang: string
): Promise<string> {
  const qt = extracted.query_type;

  if (qt === 'help') {
    return (
      '📋 *How to send updates:*\n' +
      'Unit, Tag, Job, Progress%\n' +
      '_Example: FCC, E-101A, bundle done, 75%_\n\n' +
      '📊 *Queries:*\n' +
      '• status FCC-MEC-001 — workpack status\n' +
      '• status E-101A — equipment status\n' +
      '• my jobs — your 24hr schedule'
    );
  }

  if (qt === 'status' && extracted.query_target) {
    const target = (extracted.query_target as string).trim();
    const wp = await prisma.workpack.findFirst({
      where: {
        organization_id: orgId,
        OR: [
          { workpack_number: { equals: target, mode: 'insensitive' } },
          { title: { contains: target, mode: 'insensitive' } },
        ],
        deleted_at: null,
      },
      include: {
        activities: {
          where: { deleted_at: null },
          select: { status: true, progress_percent: true },
        },
        constraint_logs: {
          where: {
            deleted_at: null,
            status: { not: 'resolved' },
            severity: { in: ['critical', 'high'] },
          },
          select: { title: true, severity: true },
          take: 3,
        },
      },
    });

    if (wp) {
      const total = wp.activities.length;
      const done = wp.activities.filter((a) => a.status === 'completed').length;
      const inProg = wp.activities.filter((a) => a.status === 'in_progress').length;
      const progress = wp.overall_progress ?? 0;
      let reply =
        `📊 *${wp.workpack_number ?? target}*\n${wp.title}\n` +
        `Status: ${wp.status} | ${progress}%\n` +
        `Activities: ${done} done, ${inProg} in progress, ${total - done - inProg} pending\n`;
      if (wp.constraint_logs.length > 0) {
        reply += '\n🔴 Open constraints:\n';
        wp.constraint_logs.forEach((c) => {
          reply += `• ${c.title}\n`;
        });
      }
      return reply;
    }

    const asset = await prisma.asset.findFirst({
      where: {
        organization_id: orgId,
        tag_number: { equals: target, mode: 'insensitive' },
      },
      include: {
        workpacks: {
          where: {
            status: { in: ['draft', 'under_review', 'approved', 'issued'] },
            deleted_at: null,
          },
          select: {
            workpack_number: true,
            overall_progress: true,
            status: true,
          },
          take: 2,
        },
      },
    });

    if (asset) {
      let reply = `🏭 *${asset.tag_number}* — ${asset.name}\n`;
      if (asset.workpacks.length > 0) {
        asset.workpacks.forEach((w) => {
          reply += `Active: ${w.workpack_number} (${w.overall_progress ?? 0}%)\n`;
        });
      } else {
        reply += 'No active workpack\n';
      }
      return reply;
    }

    return `⚠ No workpack or equipment found for "${target}"`;
  }

  if (qt === 'my_jobs') {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const userName = user.name;

    const activities = await prisma.activity.findMany({
      where: {
        workpack: {
          organization_id: orgId,
          status: { in: ['draft', 'under_review', 'approved', 'issued'] },
          deleted_at: null,
        },
        deleted_at: null,
        status: { not: 'completed' },
        responsible: userName ? { contains: userName, mode: 'insensitive' } : undefined,
        OR: [{ planned_end: { lte: in24Hours } }, { planned_end: null }],
      },
      include: {
        workpack: {
          select: {
            workpack_number: true,
            asset: { select: { tag_number: true } },
          },
        },
      },
      orderBy: { planned_end: 'asc' },
      take: 10,
    });

    if (activities.length === 0) {
      return '📋 No activities assigned to you in the next 24 hours.';
    }

    const firstName = userName.split(' ')[0] ?? userName;
    let reply = `📋 *Your 24hr Schedule — ${firstName}*\n\n`;
    const overdue = activities.filter((a) => a.planned_end && a.planned_end < now);
    const upcoming = activities.filter((a) => !a.planned_end || a.planned_end >= now);

    if (overdue.length > 0) {
      reply += '*🔴 Overdue (complete ASAP):*\n';
      overdue.forEach((a) => {
        const wp = a.workpack as { asset?: { tag_number: string } | null; workpack_number: string };
        reply += `• ${wp?.asset?.tag_number ?? wp?.workpack_number}: ${a.description}\n`;
      });
      reply += '\n';
    }
    if (upcoming.length > 0) {
      reply += '*Today / Tomorrow:*\n';
      upcoming.forEach((a) => {
        const due = a.planned_end
          ? new Date(a.planned_end).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              timeZone: 'Asia/Kolkata',
            })
          : 'No date';
        const wp = a.workpack as { asset?: { tag_number: string } | null; workpack_number: string | null };
        reply += `• ${wp?.asset?.tag_number ?? wp?.workpack_number}: ${a.description} (due ${due})\n`;
      });
    }
    reply += '\n_Reply: Unit, Tag, Job, Progress%_';
    return reply;
  }

  if (lang === 'hi') return '❓ Samajh nahi aaya. "help" likhein.';
  if (lang === 'gu') return '❓ Samajyu nahi. "help" lakho.';
  if (lang === 'ta') return '❓ புரியவில்லை. "help" அனுப்பவும்.';
  if (lang === 'ml') return '❓ മനസ്സിലായില്ല. "help" അയക്കൂ.';
  return '❓ Could not understand. Send "help".';
}
