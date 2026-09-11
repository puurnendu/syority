import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';

// Stub: IntegrationConfig model does not exist in the current schema.
// Returns empty data until the model is added.

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  return NextResponse.json({ integrations: [] });
}

export async function PATCH(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  return NextResponse.json(
    { error: 'Integration configuration is not available in this release.' },
    { status: 501 }
  );
}
