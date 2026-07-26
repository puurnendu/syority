import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LessonsLearntService } from '@/modules/lessons-learnt/services/LessonsLearntService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const lessons = await LessonsLearntService.getLessons(workpackId, session.user.organization_id!);
    return NextResponse.json(lessons);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: workpackId } = await params;
    const body = await req.json();
    const lesson = await LessonsLearntService.createLesson({ ...body, workpack_id: workpackId }, session.user.organization_id!, session.user.id);
    return NextResponse.json(lesson);
}
