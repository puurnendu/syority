import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// ── Lazy key derivation ─────────────────────────────────────────────────────
//
// Key is derived on first encrypt/decrypt call, not at module load.
// This prevents errors during `next build` when ENCRYPTION_KEY is unset.

let _key: Buffer | undefined;

function getKey(): Buffer {
  if (!_key) {
    _key = scryptSync(
      process.env.ENCRYPTION_KEY || 'default-fallback-key-change-this-!!',
      'salt',
      32
    );
  }
  return _key;
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns format: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM.
 */
export function decrypt(hash: string): string {
  const [ivHex, tagHex, encryptedData] = hash.split(':');
  if (!ivHex || !tagHex || !encryptedData) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
