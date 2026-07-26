import { z } from 'zod';

const envSchema = z.object({
  // Core
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  
  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // AI
  // OpenAI and Gemini (Vertex) keys are used.
  
  // Encryption
  ENCRYPTION_KEY: z.string().length(32).describe('32-character hex or string for AES-256'),
  
  // Security
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Invalid environment variables. Check your .env file.');
}

if (!parsed.data.NEXTAUTH_URL && !parsed.data.NEXT_PUBLIC_APP_URL) {
  console.error('❌ Set NEXTAUTH_URL or NEXT_PUBLIC_APP_URL to the public app origin.');
  throw new Error('NEXTAUTH_URL or NEXT_PUBLIC_APP_URL is required.');
}

export const env = parsed.data;
