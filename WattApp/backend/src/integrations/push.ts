import { pool } from '../db/pool';

// Expo push notifications. Ported from the send-push edge function.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Category = 'booking' | 'charging' | 'promo';
const PREF: Record<Category, string> = {
  booking: 'notif_booking', charging: 'notif_charging', promo: 'notif_promo',
};

async function optedInTokens(userIds: string[], category: Category): Promise<string[]> {
  const col = PREF[category];
  const { rows } = await pool.query(
    `select expo_push_token, notif_push, ${col} as catpref
     from public.profiles
     where id = any($1::uuid[]) and expo_push_token is not null`,
    [userIds],
  );
  return rows
    .filter(r => r.notif_push !== false && r.catpref !== false)
    .map(r => r.expo_push_token);
}

export async function sendPush(
  userIds: string[], category: Category, title: string, body: string, data: Record<string, any> = {},
): Promise<number> {
  if (!userIds.length) return 0;
  const tokens = await optedInTokens(userIds, category);
  if (!tokens.length) return 0;
  const messages = tokens.map(to => ({ to, title, body, data, sound: 'default' }));
  for (let i = 0; i < messages.length; i += 100) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    }).catch(() => { /* best-effort */ });
  }
  return tokens.length;
}
