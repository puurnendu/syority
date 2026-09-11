import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';

// Stub: SsoConfig model does not exist in the current schema.
// Returns empty data until the model is added.

export async function GET() {
  const { session, error } = await guardApi('settings.org.view');
  if (error) return error;

  return NextResponse.json({ config: null });
}

export async function PATCH(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  return NextResponse.json(
    { error: 'SSO configuration is not available in this release.' },
    { status: 501 }
  );
}
