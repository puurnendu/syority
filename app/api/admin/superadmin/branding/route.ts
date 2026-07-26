import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Minimal branding endpoint used by NavBar / DashboardHeader.
 * Returns safe defaults so the Platform shell does not 404 on every page load.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    branding: {
      logoUrl: null,
      platformName: 'SYORITY',
      logoWidthPx: 140,
      logoHeightPx: 40,
    },
  });
}
