import { NextRequest, NextResponse } from 'next/server';
import { generateShiftReports } from '@/services/whatsapp/ShiftReportGenerator';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const shiftType = body.shift === 'day' ? 'day' : 'night';

  console.log(`[Cron] Generating ${shiftType} shift reports...`);

  try {
    await generateShiftReports(shiftType);
    return NextResponse.json({
      ok: true,
      shift: shiftType,
      generated_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[Cron] Shift report error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
