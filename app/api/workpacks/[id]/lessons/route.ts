import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id: workpackId } = await params;

    const lessons = await prisma.lessonLearned.findMany({
        where: {
            workpack_id: workpackId,
            organization_id: orgId,
            deleted_at: null,
        },
        orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(lessons);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id: workpackId } = await params;

    const body = await req.json();
    const {
        title,
        description,
        category = 'general',
        impact = 'medium',
        recommendation,
        applicable_to = [],
        is_in_central_register = false,
        status = 'draft',
    } = body;

    if (!title || !description) {
        return NextResponse.json(
            { error: 'title and description are required' },
            { status: 400 }
        );
    }

    const lesson = await prisma.lessonLearned.create({
        data: {
            organization_id: orgId,
            workpack_id: workpackId,
            title: String(title).slice(0, 500),
            description: String(description),
            category: String(category).slice(0, 100) || 'general',
            impact: String(impact).slice(0, 50) || 'medium',
            recommendation: recommendation != null ? String(recommendation) : null,
            applicable_to: Array.isArray(applicable_to) ? applicable_to : [],
            is_in_central_register: Boolean(is_in_central_register),
            status: String(status).slice(0, 50) || 'draft',
        },
    });
    return NextResponse.json(lesson);
}
