/**
 * M7.6B — Artifact Detail API
 * GET: Download an artifact
 * DELETE: Archive an artifact
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ArtifactService } from '@/core/report-engine';
import { hasPermission } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const orgId = session.user.organizationId || (session.user as any).organization_id;
    const artifact = await ArtifactService.getForDownload(params.id, orgId);

    // Return binary data if available
    if (artifact.file_data) {
      return new NextResponse(artifact.file_data, {
        headers: {
          'Content-Type': artifact.content_type,
          'Content-Disposition': `attachment; filename="${artifact.filename}"`,
        },
      });
    }

    // Return HTML snapshot if no binary
    if (artifact.html_snapshot) {
      return new NextResponse(artifact.html_snapshot, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json({ error: 'No content available' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(session, 'reporting:admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const orgId = session.user.organizationId || (session.user as any).organization_id;
    await ArtifactService.archive(params.id, orgId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
