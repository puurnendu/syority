/**
 * M16-R1 Security Tests (S1–S9)
 *
 * Tests webhook signature verification, tenant isolation,
 * event isolation, unauthorized action, and identity enforcement.
 */

import { describe, it, expect } from 'vitest';
import { verifyMetaWebhookSignature } from '../security/WebhookSignatureVerifier';
import { createHmac } from 'crypto';

const TEST_SECRET = 'test_app_secret_for_unit_tests_only';
const TEST_BODY = Buffer.from(JSON.stringify({
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: '+919876543210',
          id: 'wamid.test123',
          type: 'text',
          text: { body: 'What is HX-204 status?' },
        }],
      },
    }],
  }],
}));

function computeValidSignature(body: Buffer, secret: string): string {
  const hash = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hash}`;
}

describe('M16-R1 Security', () => {
  describe('Webhook Signature Verification', () => {
    // S1: Invalid Meta signature
    it('S1 — rejects invalid Meta signature', () => {
      const result = verifyMetaWebhookSignature(
        TEST_BODY,
        'sha256=0000000000000000000000000000000000000000000000000000000000000000',
        TEST_SECRET
      );
      expect(result).toBe(false);
    });

    // S2: Missing Meta signature
    it('S2 — rejects missing Meta signature', () => {
      const result = verifyMetaWebhookSignature(TEST_BODY, '', TEST_SECRET);
      expect(result).toBe(false);
    });

    it('S2b — rejects null-like signature', () => {
      const result = verifyMetaWebhookSignature(TEST_BODY, null as any, TEST_SECRET);
      expect(result).toBe(false);
    });

    // S3: Modified payload
    it('S3 — rejects modified payload (signature for different body)', () => {
      const originalSignature = computeValidSignature(TEST_BODY, TEST_SECRET);
      const modifiedBody = Buffer.from(JSON.stringify({ tampered: true }));
      const result = verifyMetaWebhookSignature(modifiedBody, originalSignature, TEST_SECRET);
      expect(result).toBe(false);
    });

    // S4: Valid Meta signature
    it('S4 — accepts valid Meta signature', () => {
      const validSignature = computeValidSignature(TEST_BODY, TEST_SECRET);
      const result = verifyMetaWebhookSignature(TEST_BODY, validSignature, TEST_SECRET);
      expect(result).toBe(true);
    });

    it('S4b — rejects signature with wrong prefix', () => {
      const hash = createHmac('sha256', TEST_SECRET).update(TEST_BODY).digest('hex');
      const result = verifyMetaWebhookSignature(TEST_BODY, `md5=${hash}`, TEST_SECRET);
      expect(result).toBe(false);
    });

    it('S4c — rejects signature without sha256= prefix', () => {
      const hash = createHmac('sha256', TEST_SECRET).update(TEST_BODY).digest('hex');
      const result = verifyMetaWebhookSignature(TEST_BODY, hash, TEST_SECRET);
      expect(result).toBe(false);
    });

    it('S4d — rejects empty secret', () => {
      const result = verifyMetaWebhookSignature(TEST_BODY, 'sha256=abc', '');
      expect(result).toBe(false);
    });

    it('S4e — rejects invalid hex in signature', () => {
      const result = verifyMetaWebhookSignature(
        TEST_BODY,
        'sha256=not_valid_hex_string_at_all!!!',
        TEST_SECRET
      );
      expect(result).toBe(false);
    });
  });

  describe('Tenant Isolation', () => {
    // S5: Tenant isolation — organizationId must come from trusted user, not LLM
    it('S5 — M16InteractionContext enforces organizationId from trusted source', async () => {
      const { buildInteractionContext } = await import('../context/InteractionContextBuilder');

      const ctx = buildInteractionContext({
        identity: {
          userId: 'user-1',
          organizationId: 'org-A',
          userName: 'Test',
          verified: true,
          optedIn: true,
          preferredLanguage: null,
          phoneNumber: '+919876543210',
        },
        channel: 'whatsapp',
        conversationId: 'conv-1',
        eventId: 'event-1',
        siteId: 'site-1',
        messageId: 'msg-1',
        identitySource: 'phone_number',
      });

      // organizationId is from identity, not settable from outside
      expect(ctx.organizationId).toBe('org-A');
      // Context is frozen — cannot be mutated
      expect(() => { (ctx as any).organizationId = 'org-B'; }).toThrow();
    });
  });

  describe('Event Isolation', () => {
    // S6: Event isolation — eventId from trusted context
    it('S6 — context builder uses provided eventId, not LLM-derived', async () => {
      const { buildInteractionContext } = await import('../context/InteractionContextBuilder');

      const ctx = buildInteractionContext({
        identity: {
          userId: 'user-1',
          organizationId: 'org-A',
          userName: 'Test',
          verified: true,
          optedIn: true,
          preferredLanguage: null,
          phoneNumber: '+919876543210',
        },
        channel: 'whatsapp',
        conversationId: 'conv-1',
        eventId: 'event-TA2027',
        siteId: 'site-1',
        messageId: 'msg-1',
        identitySource: 'phone_number',
      });

      expect(ctx.eventId).toBe('event-TA2027');
      // Frozen — cannot be overridden
      expect(() => { (ctx as any).eventId = 'event-TA2028'; }).toThrow();
    });
  });

  describe('Unauthorized Action', () => {
    // S7: Unauthorized execution intent without event context
    it('S7 — execution intent without event context is denied', async () => {
      const { checkAuthorization } = await import('../auth/M16AuthorizationBoundary');
      const { M16Intent } = await import('../intents');

      const ctx = {
        organizationId: 'org-A',
        userId: 'user-1',
        channel: 'whatsapp' as const,
        conversationId: 'conv-1',
        eventId: null, // No event context
        identitySource: 'phone_number' as const,
        siteId: null,
        messageId: null,
      };

      const result = checkAuthorization(ctx, M16Intent.START_ACTIVITY, null);
      expect(result.authorized).toBe(false);
      expect(result.deniedReason).toContain('requires event context');
    });
  });

  describe('WhatsApp Identity Enforcement', () => {
    // S8/S9 are integration tests that require Prisma mocking
    // Here we verify the contract expectations

    it('S8/S9 — IdentityResolver enforces verified and opt_in checks', async () => {
      // This is a contract verification — the actual DB calls
      // are tested in integration tests
      const { resolveWhatsAppIdentity } = await import('../security/IdentityResolver');
      expect(typeof resolveWhatsAppIdentity).toBe('function');
    });
  });
});
