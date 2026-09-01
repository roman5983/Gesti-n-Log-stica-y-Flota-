import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, sha256 } from './crypto';

describe('crypto (AES-256-GCM, A-9)', () => {
  it('round-trips a value through encrypt/decrypt', () => {
    const plain = 'Driver1234!';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plain = 'same-password';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it('rejects tampered ciphertext (authenticated encryption)', () => {
    const payload = encrypt('secret');
    const [iv, tag, data] = payload.split(':');
    // Flip a byte of the ciphertext → auth tag no longer matches.
    const tampered = `${iv}:${tag}:${Buffer.from('zzzz').toString('base64')}${data}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('sha256 is deterministic and 64 hex chars', () => {
    const a = sha256('token');
    expect(a).toBe(sha256('token'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
