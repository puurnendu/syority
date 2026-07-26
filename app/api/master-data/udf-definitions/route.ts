import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CODE_REGEX = /^[a-z][a-z0-9_]*$/;
const VALID_TYPES = ['text', 'number', 'select'];

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const definitions = await prisma.activityUdfDefinition.findMany({
        where: { organization_id: orgId, deleted_at: null },
        include: {
            options: {
                where: { deleted_at: null },
                orderBy: [{ sort_order: 'asc' }, { value: 'asc' }],
            },
        },
        orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
    });
    const withCount = await Promise.all(
        definitions.map(async (d) => {
            const count = await prisma.activityUdfValue.count({ where: { udf_definition_id: d.id } });
            return { ...d, _valuesCount: count };
        })
    );
    return NextResponse.json(withCount);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as { organization_id?: string }).organization_id;
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const body = await req.json();
        const { code, name, type: dataType, is_mandatory, sort_order, is_active, description } = body;

        if (!code || typeof code !== 'string') return NextResponse.json({ error: 'code is required' }, { status: 400 });
        const codeNorm = code.trim().toLowerCase().replace(/\s+/g, '_');
        if (!CODE_REGEX.test(codeNorm)) return NextResponse.json({ error: 'code must match /^[a-z][a-z0-9_]*$/' }, { status: 400 });
        if (!name || typeof name !== 'string') return NextResponse.json({ error: 'name is required' }, { status: 400 });
        const type = (dataType ?? body.data_type ?? 'text') as string;
        if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'type must be text, number, or select' }, { status: 400 });

        const existing = await prisma.activityUdfDefinition.findFirst({
            where: { organization_id: orgId, code: codeNorm, deleted_at: null },
        });
        if (existing) return NextResponse.json({ error: 'code already exists in this organization' }, { status: 409 });

        const maxOrder = await prisma.activityUdfDefinition.aggregate({
            where: { organization_id: orgId, deleted_at: null },
            _max: { sort_order: true },
        });
        const nextOrder = (maxOrder._max.sort_order ?? 0) + 1;

        const created = await prisma.activityUdfDefinition.create({
            data: {
                organization_id: orgId,
                code: codeNorm,
                name: (name as string).trim(),
                type,
                is_mandatory: Boolean(is_mandatory),
                sort_order: typeof sort_order === 'number' ? sort_order : nextOrder,
                is_active: is_active !== false,
                created_by: (session.user as { id?: string }).id ?? null,
            },
            include: {
                options: { where: { deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { value: 'asc' }] },
            },
        });
        return NextResponse.json(created);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Create failed' }, { status: 500 });
    }
}
