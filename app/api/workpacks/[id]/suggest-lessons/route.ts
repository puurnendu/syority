import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { suggestLessons } from '@/services/ai/LessonsSuggester';

export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await context.params;

    const result = await suggestLessons(id, orgId, session!.user.id);
    return NextResponse.json(result, { status: 201 });
}
