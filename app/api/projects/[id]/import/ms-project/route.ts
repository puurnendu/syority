/**
 * @deprecated M11-R0 — MS Project XML schedule import has been permanently retired.
 *
 * The STO platform is a native Turnaround Scheduling platform.
 * Schedule creation follows: Digital Plant → Equipment → Scope → Workpack → Activity → CPM.
 * External schedule files (MPP, XML, XER) cannot create or modify the native STO schedule.
 *
 * Historical data created by previous imports is preserved but no new imports are accepted.
 */
import { NextRequest, NextResponse } from 'next/server';

const DEPRECATION_RESPONSE = {
  error: 'MS Project schedule import has been permanently retired (M11-R0).',
  message: 'The STO platform uses native schedule creation via Digital Plant → Scope → Workpack → Activity → CPM. External schedule files cannot create or modify the native STO schedule.',
  deprecated_since: 'M11-R0',
  alternative: 'Use the native STO scheduling workflow: Planning Readiness → Planner Workspace → Schedule View.',
};

export async function POST(_req: NextRequest) {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 });
}
