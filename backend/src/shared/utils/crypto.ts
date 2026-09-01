import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

/**
 * AES-256-GCM encryption for driver passwords (A-9 decision):
 * every login password is bcrypt-hashed; ADDITIONALLY, driver passwords
 * are stored encrypted (reversible) so the Admin can view them.
 * GCM provides authenticated encryption: tampered ciphertext fails to decrypt.
 *
 * Stored format: base64(iv):base64(authTag):base64(ciphertext)
 */
const KEY = Buffer.from(env.PASSWORD_ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 12; // GCM recommended IV size

export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [iv, authTag, ciphertext] = payload.split(':');
  if (!iv || !authTag || !ciphertext) {
    throw new Error('Invalid encrypted payload format');
  }
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** SHA-256 hex digest — used to store refresh tokens (never in plain text). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
