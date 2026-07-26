import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    FEATURE_FLAG_REGISTRY,
    getFeatureFlagDefinition,
    isRegisteredFeatureFlag,
} from '@/lib/featureFlagRegistry';

async function isAdmin() {
    const session = await getServerSession(authOptions);
    if (!session) return false;
    const user = session.user as any;
    const roles = user.roles ?? [];
    return roles.includes('platform_super_admin') || roles.includes('platform_admin');
}

export async function GET() {
    if (!(await isAdmin())) return new NextResponse('Forbidden', { status: 403 });

    try {
        const flags = await prisma.featureFlag.findMany({
            orderBy: { key: 'asc' },
            include: {
                TenantFeature: {
                    include: {
                        Organization: {
                            select: { id: true, name: true, slug: true },
                        },
                    },
                },
                _count: { select: { TenantFeature: true } },
            },
        });

        const payload = flags.map((flag) => {
            const def = getFeatureFlagDefinition(flag.key);
            return {
                id: flag.key,
                key: flag.key,
                name: def?.name ?? flag.key,
                description: flag.description ?? def?.description ?? null,
                is_enabled: flag.isEnabled,
                modules: def?.modules ?? [],
                registered: !!def,
                usage: {
                    tenant_override_count: flag._count.TenantFeature,
                    tenants_with_override: flag.TenantFeature.length,
                },
                tenant_overrides: flag.TenantFeature.map((tf) => ({
                    organization_id: tf.organization_id,
                    organization_name: tf.Organization?.name ?? 'Unknown',
                    organization_slug: tf.Organization?.slug ?? null,
                    is_enabled: tf.isEnabled,
                })),
                _count: { tenant_overrides: flag._count.TenantFeature },
            };
        });

        return NextResponse.json({
            flags: payload,
            registry: FEATURE_FLAG_REGISTRY,
        });
    } catch (error) {
        console.error('[features GET]', error);
        return NextResponse.json({ error: 'Failed to fetch feature flags' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (!(await isAdmin())) return new NextResponse('Forbidden', { status: 403 });

    try {
        const body = await req.json();
        const key = String(body.key || '')
            .trim()
            .toUpperCase();
        const description = body.description as string | undefined;
        const is_enabled = body.is_enabled;

        if (!key) {
            return NextResponse.json({ error: 'Missing key' }, { status: 400 });
        }

        if (!isRegisteredFeatureFlag(key)) {
            return NextResponse.json(
                {
                    error: 'Unknown feature flag key. Only registered platform modules can be created (prevents orphan flags).',
                    allowed_keys: FEATURE_FLAG_REGISTRY.map((f) => f.key),
                },
                { status: 400 }
            );
        }

        const def = getFeatureFlagDefinition(key)!;
        const flag = await prisma.featureFlag.create({
            data: {
                key,
                description: description || def.description,
                isEnabled: is_enabled ?? true,
            },
        });

        return NextResponse.json({
            id: flag.key,
            key: flag.key,
            name: def.name,
            description: flag.description,
            is_enabled: flag.isEnabled,
            modules: def.modules,
            registered: true,
            usage: { tenant_override_count: 0, tenants_with_override: 0 },
            tenant_overrides: [],
            _count: { tenant_overrides: 0 },
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Feature key already exists' }, { status: 400 });
        }
        console.error('[features POST]', error);
        return NextResponse.json({ error: 'Failed to create feature flag' }, { status: 500 });
    }
}
