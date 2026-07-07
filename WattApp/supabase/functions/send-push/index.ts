import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const INTERNAL_SECRET = Deno.env.get('PUSH_INTERNAL_SECRET') ?? ''

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
}
const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Category = 'booking' | 'charging' | 'promo'
const CATEGORY_PREF: Record<Category, string> = {
  booking:  'notif_booking',
  charging: 'notif_charging',
  promo:    'notif_promo',
}

// Fetch opted-in push tokens for the given users + category.
async function tokensFor(supabase: any, userIds: string[], category: Category): Promise<string[]> {
  const prefCol = CATEGORY_PREF[category]
  const { data } = await supabase
    .from('profiles')
    .select(`id, expo_push_token, notif_push, ${prefCol}`)
    .in('id', userIds)
    .not('expo_push_token', 'is', null)
  return (data ?? [])
    .filter((p: any) => p.notif_push !== false && p[prefCol] !== false)
    .map((p: any) => p.expo_push_token)
}

// Send to Expo in batches of 100 (Expo's per-request limit).
async function sendExpo(messages: object[]) {
  const results: unknown[] = []
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(messages.slice(i, i + 100)),
    })
    results.push(await res.json())
  }
  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const payload = await req.json()

    let userIds: string[] = []
    let title:   string
    let body:    string
    let category: Category = payload.category ?? 'booking'
    const data = payload.data ?? {}

    // ── Path 1: booking notification (authenticated customer → host) ──
    // Abuse-resistant: the caller must own the booking; we only ever push
    // to the host of that booking's listing.
    if (payload.booking_id) {
      const authHeader = req.headers.get('Authorization') ?? ''
      if (!authHeader.startsWith('Bearer ')) return err('Unauthorized', 401)
      const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
      if (!user) return err('Unauthorized', 401)

      const { data: booking } = await supabase
        .from('bookings')
        .select('id,user_id,listing:charger_listings(host_id)')
        .eq('id', payload.booking_id).single()
      if (!booking)                    return err('Booking not found', 404)
      if (booking.user_id !== user.id) return err('Not your booking', 403)

      const hostId = (booking.listing as any)?.host_id
      if (!hostId) return ok({ success: true, sent: 0 })   // no host (public station)
      userIds  = [hostId]
      title    = payload.title ?? 'New booking on your charger'
      body     = payload.body  ?? 'A customer just booked your charger.'
      category = 'booking'

    // ── Path 2: internal service-to-service send ──
    } else {
      if (!INTERNAL_SECRET || req.headers.get('x-internal-secret') !== INTERNAL_SECRET)
        return err('Forbidden', 403)
      if (!Array.isArray(payload.user_ids) || !payload.user_ids.length)
        return err('user_ids required')
      if (!payload.title || !payload.body) return err('title and body required')
      userIds = payload.user_ids
      title   = payload.title
      body    = payload.body
    }

    const tokens = await tokensFor(supabase, userIds, category)
    if (!tokens.length) return ok({ success: true, sent: 0 })

    const messages = tokens.map(to => ({ to, title, body, data, sound: 'default' }))
    const tickets = await sendExpo(messages)
    return ok({ success: true, sent: tokens.length, tickets })

  } catch (e: any) {
    console.error('[send-push]', e)
    return err(e.message ?? 'Internal server error', 500)
  }
})
