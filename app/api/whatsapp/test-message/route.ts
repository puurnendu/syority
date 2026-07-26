import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { decrypt } from '@/lib/encryption';

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const orgId = session.user.organization_id;
        const body = await req.json();
        const { recipient_phone } = body;

        if (!recipient_phone) {
            return NextResponse.json({ error: 'Recipient phone number is required' }, { status: 400 });
        }

        const settings = await prisma.aiProviderSetting.findUnique({
            where: { organization_id: orgId },
        });

        if (!settings?.whatsapp_phone_number_id || !settings?.whatsapp_access_token_encrypted) {
            return NextResponse.json({ error: 'WhatsApp API credentials not found in configuration' }, { status: 400 });
        }

        const phoneNumberId = settings.whatsapp_phone_number_id;
        const accessToken = decrypt(settings.whatsapp_access_token_encrypted);

        const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
        
        const payload = {
            messaging_product: 'whatsapp',
            to: recipient_phone.replace(/[^0-9]/g, ''), // strip any non-numeric characters just in case, though user should include country code
            type: 'text',
            text: {
                body: 'Hello from Syority 🚀 WhatsApp integration is working!'
            }
        };

        // If user typed +91... stripping gives 91... which is correct format for Meta "to" field (country code without +)
        const response = await fetch(metaUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        console.log('[WhatsApp Test Message] Response:', JSON.stringify(data, null, 2));

        if (!response.ok) {
            return NextResponse.json({ 
                error: data.error?.message || 'Failed to send WhatsApp message' 
            }, { status: response.status });
        }

        return NextResponse.json({ success: true, data });

    } catch (error: unknown) {
        console.error('[WhatsApp Test Message] Error:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Internal Server Error' 
        }, { status: 500 });
    }
});
