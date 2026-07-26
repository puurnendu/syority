import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const { eventId } = await params;

    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const nodes = await prisma.wbsNode.findMany({
      where: { event_id: eventId, organization_id: orgId },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
    });

    const flat = [...nodes];
    const map = new Map<string, any>();
    
    // Convert to regular objects with a children array
    nodes.forEach(n => map.set(n.id, { ...n, children: [] }));
    
    const tree: any[] = [];
    nodes.forEach(n => {
      if (n.parent_id && map.has(n.parent_id)) {
        map.get(n.parent_id).children.push(map.get(n.id));
      } else {
        tree.push(map.get(n.id));
      }
    });

    return NextResponse.json({ data: tree, flat });
  } catch (error: any) {
    console.error('Error fetching event wbs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch wbs' }, { status: 500 });
  }
}
