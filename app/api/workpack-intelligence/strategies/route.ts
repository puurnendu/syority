/**
 * REMOVED per ADR-0012 — MaintenanceStrategy deferred to Asset Integrity milestone.
 * See: docs/adr/ADR-0012-Workpack-Template-Architecture.md
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'MaintenanceStrategy API has been removed. See ADR-0012.' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: 'MaintenanceStrategy API has been removed. See ADR-0012.' }, { status: 410 });
}
