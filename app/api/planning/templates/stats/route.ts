import { NextResponse } from 'next/server';
import { guardPlatformApi } from '@/security/apiGuards';
import { TemplateLibraryService } from '@/core/planning/TemplateLibraryService';

/**
 * Part 10: Platform template statistics endpoint.
 * Returns counts by scope, status, and knowledge-imported templates.
 */
export async function GET() {
  const result = await guardPlatformApi('knowledge.view');
  if (result.error) return result.error;

  try {
    const stats = await TemplateLibraryService.platformStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[planning/templates/stats GET]', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
