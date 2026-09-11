/**
 * M16 — WebhookSignatureVerifier
 *
 * Verifies Meta/WhatsApp webhook payload authenticity using
 * X-Hub-Signature-256 HMAC-SHA256 verification.
 *
 * THIS IS THE FIRST M16-R1 DELIVERABLE.
 * No other M16 code may process live WhatsApp messages until
 * transport authenticity is verified.
 *
 * Three separate concepts:
 *   1. Meta transport authenticity (this module)
 *      ≠
 *   2. WhatsApp user identity (IdentityResolver)
 *      ≠
 *   3. Application authorization (M16AuthorizationBoundary)
 *
 * SECURITY:
 *   - Uses timing-safe comparison to prevent timing attacks
 *   - Does NOT log secrets
 *   - Rejects missing signature, invalid signature, modified payload
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify the Meta webhook payload signature.
 *
 * @param rawBody    - The raw request body as a Buffer (before JSON parsing)
 * @param signature  - The X-Hub-Signature-256 header value (format: "sha256=<hex>")
 * @param secret     - The WHATSAPP_APP_SECRET from environment (NEVER logged)
 * @returns true if the signature is valid, false otherwise
 */
export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  // Meta sends: "sha256=<hex_digest>"
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const receivedHash = parts[1];
  if (!receivedHash || receivedHash.length === 0) {
    return false;
  }

  // Compute expected HMAC-SHA256
  const expectedHash = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison — prevents timing attacks
  try {
    const receivedBuffer = Buffer.from(receivedHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    // Invalid hex in signature
    return false;
  }
}
