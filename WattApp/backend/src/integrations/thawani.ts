import { env } from '../config/env';

// Thawani Pay (Oman) — hosted checkout. Ported from the thawani-checkout edge fn.
const MIN_OMR = 0.1;
const MAX_OMR = 500;

async function thawani(method: string, path: string, body?: object) {
  const res = await fetch(`${env.THAWANI_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'thawani-api-key': env.THAWANI_SECRET_KEY ?? '' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json: json as any };
}

export function thawaniConfigured(): boolean {
  return !!(env.THAWANI_SECRET_KEY && env.THAWANI_PUBLISHABLE_KEY);
}

export function validateAmount(omr: number): string | null {
  if (!omr || omr < MIN_OMR || omr > MAX_OMR) return `Amount must be between ${MIN_OMR} and ${MAX_OMR} OMR`;
  return null;
}

export async function createCheckout(userId: string, omr: number) {
  const { ok, json } = await thawani('POST', '/api/v1/checkout/session', {
    client_reference_id: `${userId}:${Date.now()}`,
    mode: 'payment',
    products: [{ name: 'Watt Wallet Top-up', unit_amount: Math.round(omr * 1000), quantity: 1 }],
    // Thawani requires valid http(s) return URLs (it rejects custom schemes like
    // watt://). These backend endpoints bounce the browser to the app deep link.
    success_url: `${env.PUBLIC_URL}/pay/success`,
    cancel_url: `${env.PUBLIC_URL}/pay/cancel`,
    metadata: { user_id: userId, amount: omr },
  });
  const sid = json?.data?.session_id;
  if (!ok || !sid) throw new Error(`Thawani session error: ${json?.description ?? 'unknown'}`);
  return {
    session_id: sid as string,
    publishable_key: env.THAWANI_PUBLISHABLE_KEY,
    pay_url: `${env.THAWANI_BASE_URL}/pay/${sid}?key=${env.THAWANI_PUBLISHABLE_KEY}`,
  };
}

export async function getPaymentStatus(sessionId: string): Promise<string | null> {
  const { ok, json } = await thawani('GET', `/api/v1/checkout/session/${sessionId}`);
  if (!ok) throw new Error(`Thawani verify error: ${json?.description ?? 'unknown'}`);
  return json?.data?.payment_status ?? null;
}
