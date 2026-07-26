import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

/**
 * MetaClient — thin wrapper around Meta WhatsApp API
 * Fetches credentials from DB for the specific org, falls back to ENV vars.
 */

const BASE = 'https://graph.facebook.com/v18.0';

async function getMetaConfig(orgId?: string) {
  let token = process.env.WHATSAPP_ACCESS_TOKEN;
  let phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (orgId) {
    const settings = await prisma.aiProviderSetting.findUnique({
      where: { organization_id: orgId },
      select: {
        whatsapp_access_token_encrypted: true,
        whatsapp_phone_number_id: true,
      },
    });

    if (settings?.whatsapp_access_token_encrypted) {
      token = decrypt(settings.whatsapp_access_token_encrypted);
    }
    if (settings?.whatsapp_phone_number_id) {
      phoneId = settings.whatsapp_phone_number_id;
    }
  }

  if (!token || !phoneId) {
    console.warn(`[MetaClient] Missing credentials for org ${orgId ?? 'GLOBAL'}. Fallback to ENV? ${!!process.env.WHATSAPP_ACCESS_TOKEN}`);
  }

  return { token, phoneId };
}

export async function downloadAudioFromMeta(mediaId: string, orgId?: string): Promise<Buffer> {
  const { token } = await getMetaConfig(orgId);
  if (!token) throw new Error('WhatsApp Access Token not configured');

  const urlRes = await fetch(`${BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!urlRes.ok)
    throw new Error(`Meta media URL fetch failed: ${urlRes.status}`);
  const { url } = (await urlRes.json()) as { url: string };
  const fileRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok)
    throw new Error(`Meta audio download failed: ${fileRes.status}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sendWhatsAppMessage(
  toNumber: string,
  text: string,
  orgId?: string
): Promise<string | null> {
  const { token, phoneId } = await getMetaConfig(orgId);
  if (!token || !phoneId) return null;

  const to = toNumber.startsWith('+') ? toNumber.slice(1) : toNumber;
  const res = await fetch(`${BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    }),
  });
  if (!res.ok) {
    console.error('[Meta] Send message failed:', res.status, await res.text());
    return null;
  }
  const d = (await res.json()) as { messages?: Array<{ id: string }> };
  return d.messages?.[0]?.id ?? null;
}

export async function sendTemplateMessage(
  toNumber: string,
  templateName: string,
  language: string,
  components: unknown[],
  orgId?: string
): Promise<string | null> {
  const { token, phoneId } = await getMetaConfig(orgId);
  if (!token || !phoneId) return null;

  const to = toNumber.startsWith('+') ? toNumber.slice(1) : toNumber;
  const res = await fetch(`${BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components,
      },
    }),
  });
  if (!res.ok) {
    console.error('[Meta] Template send failed:', res.status, await res.text());
    return null;
  }
  const d = (await res.json()) as { messages?: Array<{ id: string }> };
  return d.messages?.[0]?.id ?? null;
}
