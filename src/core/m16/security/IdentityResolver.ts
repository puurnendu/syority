/**
 * M16 — Identity Resolver
 *
 * Resolves channel-specific identity to application user.
 *
 * WhatsApp: phone number → User (with whatsapp_verified / whatsapp_opt_in enforcement)
 * Web:      NextAuth session → User
 *
 * SECURITY:
 *   - phone number alone ≠ authorization
 *   - whatsapp_verified MUST be true for WhatsApp interactions
 *   - whatsapp_opt_in MUST be true for WhatsApp interactions
 *   - organizationId comes from the User record, NEVER from LLM
 */

import { prisma } from '@/lib/prisma';
import type { M16Identity } from '../types';

// ── WhatsApp Identity ─────────────────────────────────────────────────────────

export type WhatsAppIdentityResult =
  | { status: 'resolved'; identity: M16Identity }
  | { status: 'not_found'; reason: 'no_user' }
  | { status: 'rejected'; reason: 'not_verified' | 'not_opted_in' | 'inactive' };

/**
 * Resolve a WhatsApp phone number to an application identity.
 *
 * Enforces:
 *   - User exists and is active
 *   - User has whatsapp_verified = true
 *   - User has whatsapp_opt_in = true
 *
 * @param phoneNumber - E.164 format phone number (e.g., "+919876543210")
 */
export async function resolveWhatsAppIdentity(
  phoneNumber: string
): Promise<WhatsAppIdentityResult> {
  const normalized = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  const user = await prisma.user.findFirst({
    where: { whatsapp_number: normalized },
    select: {
      id: true,
      organization_id: true,
      name: true,
      preferred_language: true,
      whatsapp_number: true,
      whatsapp_verified: true,
      whatsapp_opt_in: true,
      is_active: true,
    },
  });

  if (!user) {
    return { status: 'not_found', reason: 'no_user' };
  }

  if (!user.is_active) {
    return { status: 'rejected', reason: 'inactive' };
  }

  if (!user.whatsapp_verified) {
    return { status: 'rejected', reason: 'not_verified' };
  }

  if (!user.whatsapp_opt_in) {
    return { status: 'rejected', reason: 'not_opted_in' };
  }

  return {
    status: 'resolved',
    identity: {
      userId: user.id,
      organizationId: user.organization_id!,
      userName: user.name || 'Unknown',
      verified: user.whatsapp_verified,
      optedIn: user.whatsapp_opt_in,
      preferredLanguage: user.preferred_language || null,
      phoneNumber: normalized,
    },
  };
}

// ── Web Identity ──────────────────────────────────────────────────────────────

/**
 * Resolve a NextAuth session to an M16 identity.
 * The session is already authenticated by NextAuth — we just extract the identity.
 */
export function resolveWebIdentity(session: {
  user: { id: string; organization_id: string; name?: string };
}): M16Identity {
  return {
    userId: session.user.id,
    organizationId: session.user.organization_id,
    userName: session.user.name || 'Unknown',
    verified: true, // Web sessions are inherently verified
    optedIn: true,  // Web sessions are inherently opted-in
    preferredLanguage: null,
    phoneNumber: null,
  };
}
