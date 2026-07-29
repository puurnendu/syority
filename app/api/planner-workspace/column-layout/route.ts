/**
 * GET/PUT /api/planner-workspace/column-layout
 *
 * Save and retrieve user-specific column layout preferences.
 * GET: ?userId=<uuid>
 * PUT: { columns: [...], frozen: number, widths: {...}, activeView: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const LAYOUT_PREF_KEY = 'planner_workspace_layout';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { id: string; organization_id: string };

  try {
    const pref = await prisma.userPreference.findFirst({
      where: {
        user_id: user.id,
        preference_key: LAYOUT_PREF_KEY,
      },
    });

    if (!pref) {
      return NextResponse.json({ layout: null });
    }

    return NextResponse.json({ layout: pref.preference_value });
  } catch (err: any) {
    // UserPreference table may not exist yet — return null
    return NextResponse.json({ layout: null });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { id: string; organization_id: string };

  try {
    const body = await req.json();

    await prisma.userPreference.upsert({
      where: {
        user_id_preference_key: {
          user_id: user.id,
          preference_key: LAYOUT_PREF_KEY,
        },
      },
      create: {
        user_id: user.id,
        preference_key: LAYOUT_PREF_KEY,
        preference_value: body,
      },
      update: {
        preference_value: body,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    // If UserPreference table doesn't exist, use localStorage only (graceful degradation)
    return NextResponse.json({ success: false, fallback: 'localStorage' });
  }
}
