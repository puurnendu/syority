import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LessonsLearntService } from '@/modules/lessons-learnt/services/LessonsLearntService';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, lessonId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { lessonId } = await params;
    await LessonsLearntService.deleteLesson(lessonId, session.user.organization_id!);
    return NextResponse.json({ success: true });
}
