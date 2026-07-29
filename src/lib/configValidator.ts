/**
 * Startup Configuration Validator — Syority Platform
 *
 * Validates that required environment variables are present at startup.
 * Fails fast with clear, actionable error messages for mandatory vars.
 * Logs warnings for optional vars that affect functionality.
 *
 * Called from instrumentation.ts register() — runs once on cold start.
 */

import { logger } from '@/lib/logger';

interface ConfigCheck {
  key: string;
  required: boolean;
  description: string;
  warnIfMissing?: string;
}

const CONFIG_CHECKS: ConfigCheck[] = [
  // ── Mandatory ───────────────────────────────────────────────────────────────
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string',
  },
  {
    key: 'NEXTAUTH_SECRET',
    required: true,
    description: 'NextAuth session signing secret',
  },
  {
    key: 'ENCRYPTION_KEY',
    required: true,
    description: 'AES-256 encryption key for API key storage',
  },

  // ── Optional but recommended ────────────────────────────────────────────────
  {
    key: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL for BullMQ queues',
    warnIfMissing: 'Background jobs (CPM recalculation, report delivery) will fail. Set REDIS_URL to enable queue processing.',
  },
  {
    key: 'GOOGLE_CLOUD_PROJECT',
    required: false,
    description: 'Google Cloud project ID for Vertex AI',
    warnIfMissing: 'Vertex AI provider will be unavailable. Set GOOGLE_CLOUD_PROJECT for enterprise AI features.',
  },
  {
    key: 'GOOGLE_CLOUD_LOCATION',
    required: false,
    description: 'Google Cloud region for Vertex AI',
    warnIfMissing: 'Vertex AI will default to us-central1 if GOOGLE_CLOUD_LOCATION is unset.',
  },
  {
    key: 'NEXTAUTH_URL',
    required: false,
    description: 'Public application URL',
    warnIfMissing: 'NextAuth may generate incorrect callback URLs. Set NEXTAUTH_URL to your public domain.',
  },
  {
    key: 'STORAGE_PROVIDER',
    required: false,
    description: 'File storage backend (local or s3)',
    warnIfMissing: 'Defaulting to local filesystem storage.',
  },
];

/**
 * Validate all required configuration at startup.
 *
 * - Required vars: throws Error with clear message listing all missing vars.
 * - Optional vars: logs warnings for missing vars.
 *
 * @throws Error if any required configuration is missing.
 */
export function validateRequiredConfig(): void {
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  for (const check of CONFIG_CHECKS) {
    const value = process.env[check.key]?.trim();

    if (!value) {
      if (check.required) {
        missingRequired.push(`  ✗ ${check.key} — ${check.description}`);
      } else if (check.warnIfMissing) {
        warnings.push(`  ⚠ ${check.key} — ${check.warnIfMissing}`);
      }
    }
  }

  // Log warnings for optional missing config
  if (warnings.length > 0) {
    logger.warn('Config', 'Optional configuration missing:', {
      warnings,
    });
    for (const w of warnings) {
      console.warn(`[Config] ${w}`);
    }
  }

  // Fail fast for required missing config
  if (missingRequired.length > 0) {
    const msg =
      '\n\n' +
      '╔══════════════════════════════════════════════════════════════╗\n' +
      '║           MISSING REQUIRED CONFIGURATION                   ║\n' +
      '╠══════════════════════════════════════════════════════════════╣\n' +
      '║                                                            ║\n' +
      missingRequired.map(m => `║ ${m.padEnd(59)}║\n`).join('') +
      '║                                                            ║\n' +
      '║  Copy .env.example → .env and fill in the values above.    ║\n' +
      '╚══════════════════════════════════════════════════════════════╝\n';

    logger.error('Config', 'Required environment variables missing', {
      missing: missingRequired,
    });

    throw new Error(msg);
  }

  logger.info('Config', 'All required configuration validated ✅');
}
