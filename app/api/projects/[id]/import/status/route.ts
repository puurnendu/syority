/**
 * @deprecated M11-R0 — Schedule import status tracking has been permanently retired.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    status: 'deprecated',
    message: 'Schedule import has been retired (M11-R0). The STO platform uses native schedule creation.',
  });
}
