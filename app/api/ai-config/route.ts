import { NextRequest, NextResponse } from 'next/server';
import { getTenantClient } from '@/lib/tenantClient';
import { requireTenantContext } from '@/lib/server-context';
import { encrypt } from '@/lib/encryption';

// GET — fetch AI config for current org
export async function GET(req: NextRequest) {
    try {
        const session = await requireTenantContext();
        const tenantPrisma = getTenantClient(session);

        console.log(`[AI Config API - GET] Executing via getTenantClient`);

        // Removed explicit where: { organization_id } because tenantClient injects it
        const settings = await tenantPrisma.aiProviderSetting.findFirst();

        return NextResponse.json({ data: settings });
    } catch (error: unknown) {
        // If requireTenantContext redirects, Next.js handles the thrown redirect error.
        // If it's a real error, return 500.
        if (error && typeof error === 'object' && 'message' in error && String(error.message).includes('NEXT_REDIRECT')) {
            throw error;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST — create AI config
export async function POST(req: NextRequest) {
    try {
        const session = await requireTenantContext();
        const tenantPrisma = getTenantClient(session);
        const userId = session.user_id;

        console.log(`[AI Config API - POST] Creating new config via getTenantClient`);
        const body = await req.json();

        const settings = await tenantPrisma.aiProviderSetting.create({
            data: {
                // organization_id injected automatically by proxy wrapper
                provider: body.provider ?? 'vertex',
                model: body.model ?? null,
                api_key_encrypted: body.api_key ? encrypt(body.api_key) : null,
                api_endpoint: body.api_endpoint ?? null,
                api_version: body.api_version ?? null,
                max_tokens: body.max_tokens ?? 4096,
                temperature: body.temperature ?? 0.1,
                is_active: body.is_active ?? false,
                fallback_provider: body.fallback_provider ?? null,
                fallback_api_key_encrypted: body.fallback_api_key ? encrypt(body.fallback_api_key) : null,
                fallback_model: body.fallback_model ?? null,
                extraction_prompt: body.extraction_prompt ?? null,
                whisper_model: body.whisper_model ?? null,
                whatsapp_phone_number_id: body.whatsapp_phone_number_id ?? null,
                whatsapp_business_id: body.whatsapp_business_id ?? null,
                whatsapp_access_token_encrypted: body.whatsapp_access_token ? encrypt(body.whatsapp_access_token) : null,
                whatsapp_verify_token: body.whatsapp_verify_token ?? null,
                created_by: userId,
            },
        });

        return NextResponse.json({ data: settings }, { status: 201 });
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'message' in error && String(error.message).includes('NEXT_REDIRECT')) {
            throw error;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

/** Treat masked/placeholder values as "unchanged" for API key fields */
function isMasked(val: string | null | undefined): boolean {
    if (val == null || val === '') return true;
    if (val === '[UNCHANGED]') return true;
    return /^[•*\.]+$/.test(val);
}

// PUT — update AI config (upsert: create if no record exists)
export async function PUT(req: NextRequest) {
    try {
        const session = await requireTenantContext();
        const tenantPrisma = getTenantClient(session);
        const userId = session.user_id;

        console.log(`[AI Config API - PUT] Upserting config via getTenantClient`);
        const body = await req.json();

        const updateData: Record<string, unknown> = {
            provider: body.provider,
            model: body.model ?? null,
            api_endpoint: body.api_endpoint ?? null,
            api_version: body.api_version ?? null,
            max_tokens: body.max_tokens ?? 4096,
            temperature: body.temperature ?? 0.1,
            is_active: body.is_active ?? false,
            fallback_provider: body.fallback_provider ?? null,
            fallback_model: body.fallback_model ?? null,
            extraction_prompt: body.extraction_prompt ?? null,
            updated_by: userId,
            vision_provider: body.vision_provider ?? null,
            vision_model: body.vision_model ?? null,
            whatsapp_provider: body.whatsapp_provider ?? null,
            whatsapp_model: body.whatsapp_model ?? null,
            lessons_provider: body.lessons_provider ?? null,
            lessons_model: body.lessons_model ?? null,
            whisper_model: body.whisper_model ?? null,
            whatsapp_phone_number_id: body.whatsapp_phone_number_id ?? null,
            whatsapp_business_id: body.whatsapp_business_id ?? null,
            whatsapp_verify_token: body.whatsapp_verify_token ?? null,
        };

        if (body.api_key != null && !isMasked(String(body.api_key))) {
            updateData.api_key_encrypted = encrypt(String(body.api_key));
        }
        if (body.fallback_api_key != null && !isMasked(String(body.fallback_api_key))) {
            updateData.fallback_api_key_encrypted = encrypt(String(body.fallback_api_key));
        }
        if (body.vision_api_key != null && !isMasked(String(body.vision_api_key))) {
            updateData.vision_api_key_encrypted = encrypt(String(body.vision_api_key));
        }
        if (body.whatsapp_api_key != null && !isMasked(String(body.whatsapp_api_key))) {
            updateData.whatsapp_api_key_encrypted = encrypt(String(body.whatsapp_api_key));
        }
        if (body.whisper_api_key != null && !isMasked(String(body.whisper_api_key))) {
            updateData.whisper_api_key_encrypted = encrypt(String(body.whisper_api_key));
        }
        if (body.whatsapp_access_token != null && !isMasked(String(body.whatsapp_access_token))) {
            updateData.whatsapp_access_token_encrypted = encrypt(String(body.whatsapp_access_token));
        }

        const createData = {
            ...updateData,
            created_by: userId,
        };
        delete (createData as Record<string, unknown>).updated_by;

        // Upsert requires where to be unique, we previously used organization_id
        // Since tenantClient intercepts findUnique into a filtered query, we must ensure it evaluates safely.
        // A safer strategy for wrapper-based upsert without breaking Prisma's requirement for unique fields is to use findFirst/update manually.
        
        let settings = await tenantPrisma.aiProviderSetting.findFirst();
        
        if (settings) {
            settings = await tenantPrisma.aiProviderSetting.update({
                where: { id: settings.id },
                data: updateData
            });
        } else {
            settings = await tenantPrisma.aiProviderSetting.create({
                data: createData as Parameters<typeof tenantPrisma.aiProviderSetting.create>[0]['data']
            });
        }

        return NextResponse.json({ data: settings });
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'message' in error && String(error.message).includes('NEXT_REDIRECT')) {
            throw error;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

