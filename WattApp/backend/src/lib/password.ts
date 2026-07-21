import argon2 from 'argon2';
import { createHash, timingSafeEqual } from 'crypto';

// New passwords are hashed with Argon2id (modern best practice).
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/**
 * Verify a password against a stored hash. Supports BOTH:
 *  - Argon2 hashes (new accounts created by this backend), and
 *  - bcrypt hashes migrated from Supabase (auth.users.encrypted_password).
 * So existing users keep their passwords.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith('$argon2')) {
    try { return await argon2.verify(hash, plain); } catch { return false; }
  }
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    // bcrypt from Supabase — lazy-load bcryptjs so it's only needed for legacy logins.
    const bcrypt = await import('bcryptjs').catch(() => null as any);
    if (!bcrypt) throw new Error('bcryptjs not installed — needed for legacy Supabase passwords');
    return bcrypt.compareSync(plain, hash);
  }
  return false;
}

// Opaque refresh-token hashing (store only the hash server-side).
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex'); const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
