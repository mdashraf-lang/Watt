import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessClaims { sub: string; role: string; }

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as any,
  });
}

export function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ jti: tokenId }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: env.REFRESH_TOKEN_TTL as any,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
  return { sub: p.sub, role: p.role };
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  const p = jwt.verify(token, env.JWT_REFRESH_SECRET) as any;
  return { sub: p.sub, jti: p.jti };
}
