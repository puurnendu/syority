/**
 * @deprecated M11-R0 — Schedule import batch management has been permanently retired.
 *
 * Historical imported data is preserved but no new batch operations are accepted.
 */
import { NextRequest, NextResponse } from 'next/server';

const DEPRECATION_RESPONSE = {
  error: 'Schedule import batch management has been permanently retired (M11-R0).',
  message: 'The STO platform uses native schedule creation. Import batch operations are no longer available.',
  deprecated_since: 'M11-R0',
};

export async function DELETE(_req: NextRequest) {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 });
}
