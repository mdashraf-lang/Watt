import { randomBytes, randomUUID } from 'crypto';
import { pool, withUser } from '../../db/pool';
import { hashPassword, verifyPassword, hashToken } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { badRequest, conflict, unauthorized } from '../../lib/errors';

const REFRESH_DAYS = 30;

async function getUserByEmail(email: string) {
  const { rows } = await pool.query(
    `select u.id, u.email, u.encrypted_password, u.email_confirmed_at, p.role
     from auth.users u left join public.profiles p on p.id = u.id
     where lower(u.email) = lower($1) limit 1`,
    [email],
  );
  return rows[0] ?? null;
}

async function issueTokens(userId: string, role: string) {
  const access = signAccessToken(userId, role);
  const jti = randomUUID();
  const refresh = signRefreshToken(userId, jti);
  const expires = new Date(Date.now() + REFRESH_DAYS * 864e5);
  await pool.query(
    `insert into public.auth_refresh_tokens (user_id, token_hash, expires_at) values ($1,$2,$3)`,
    [userId, hashToken(refresh), expires],
  );
  return { access_token: access, refresh_token: refresh };
}

export async function register(email: string, password: string, fullName: string) {
  if (await getUserByEmail(email)) throw conflict('Email already registered');
  const id = randomUUID();
  const pw = await hashPassword(password);
  // Create the auth user + profile in one transaction. (handle_new_user trigger
  // may also create the profile; the upsert keeps this idempotent.)
  await withUser(null, async (client) => {
    await client.query(
      `insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       values ($1, lower($2), $3, now(), now(), now())`,
      [id, email, pw],
    );
    await client.query(
      `insert into public.profiles (id, full_name, role)
       values ($1, $2, 'customer')
       on conflict (id) do update set full_name = excluded.full_name`,
      [id, fullName],
    );
  });
  const tokens = await issueTokens(id, 'customer');
  return { user: { id, email, role: 'customer', full_name: fullName }, ...tokens };
}

export async function login(email: string, password: string) {
  const u = await getUserByEmail(email);
  if (!u) throw unauthorized('Invalid email or password');
  const ok = await verifyPassword(u.encrypted_password, password);
  if (!ok) throw unauthorized('Invalid email or password');
  const role = u.role ?? 'customer';
  const tokens = await issueTokens(u.id, role);
  return { user: { id: u.id, email: u.email, role }, ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload;
  try { payload = verifyRefreshToken(refreshToken); }
  catch { throw unauthorized('Invalid refresh token'); }

  const h = hashToken(refreshToken);
  const { rows } = await pool.query(
    `select id, revoked, expires_at from public.auth_refresh_tokens
     where token_hash = $1 and user_id = $2 limit 1`,
    [h, payload.sub],
  );
  const row = rows[0];
  if (!row || row.revoked || new Date(row.expires_at) < new Date())
    throw unauthorized('Refresh token expired');

  // Rotate: revoke the old token, issue a new pair.
  await pool.query(`update public.auth_refresh_tokens set revoked = true where id = $1`, [row.id]);
  const { rows: pr } = await pool.query(`select role from public.profiles where id = $1`, [payload.sub]);
  return issueTokens(payload.sub, pr[0]?.role ?? 'customer');
}

export async function logout(refreshToken: string) {
  if (!refreshToken) return;
  await pool.query(
    `update public.auth_refresh_tokens set revoked = true where token_hash = $1`,
    [hashToken(refreshToken)],
  );
}

export async function changePassword(userId: string, current: string, next: string) {
  const { rows } = await pool.query(`select encrypted_password from auth.users where id = $1`, [userId]);
  if (!rows[0] || !(await verifyPassword(rows[0].encrypted_password, current)))
    throw badRequest('Current password is incorrect');
  await pool.query(`update auth.users set encrypted_password = $1, updated_at = now() where id = $2`,
    [await hashPassword(next), userId]);
  // Revoke all sessions on password change.
  await pool.query(`update public.auth_refresh_tokens set revoked = true where user_id = $1`, [userId]);
}

// ── Password reset (email link) ─────────────────────────────────────────────
export async function requestPasswordReset(email: string): Promise<string | null> {
  const u = await getUserByEmail(email);
  if (!u) return null;                              // don't reveal whether the email exists
  const token = randomBytes(32).toString('hex');
  await pool.query(
    `insert into public.auth_tokens (user_id, purpose, token_hash, expires_at)
     values ($1,'reset',$2, now() + interval '1 hour')`,
    [u.id, hashToken(token)],
  );
  return token;                                     // caller emails the reset link
}

export async function resetPassword(token: string, newPassword: string) {
  const h = hashToken(token);
  const { rows } = await pool.query(
    `select id, user_id, expires_at, used from public.auth_tokens
     where token_hash = $1 and purpose = 'reset' limit 1`,
    [h],
  );
  const row = rows[0];
  if (!row || row.used || new Date(row.expires_at) < new Date())
    throw badRequest('Invalid or expired reset token');
  await withUser(null, async (client) => {
    await client.query(`update auth.users set encrypted_password = $1, updated_at = now() where id = $2`,
      [await hashPassword(newPassword), row.user_id]);
    await client.query(`update public.auth_tokens set used = true where id = $1`, [row.id]);
    await client.query(`update public.auth_refresh_tokens set revoked = true where user_id = $1`, [row.user_id]);
  });
}

export async function emailExists(email: string): Promise<boolean> {
  return !!(await getUserByEmail(email));
}
