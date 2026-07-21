import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';

// Pure-JS bcrypt — no native build needed. Also verifies the bcrypt hashes
// migrated from Supabase (auth.users.encrypted_password), so existing users
// keep their passwords.
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (!hash) return false;
  // bcrypt hashes start with $2a$ / $2b$ / $2y$ (both new + migrated Supabase).
  try { return await bcrypt.compare(plain, hash); } catch { return false; }
}

// Opaque refresh-token hashing (store only the hash server-side).
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex'); const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
