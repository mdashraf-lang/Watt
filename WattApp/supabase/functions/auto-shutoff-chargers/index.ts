import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TUYA_BASE     = Deno.env.get('TUYA_BASE_URL') ?? 'https://openapi.tuyaeu.com'
const CLIENT_ID     = Deno.env.get('TUYA_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('TUYA_CLIENT_SECRET')!
const KW_RATE       = 22 // estimated kW delivery rate

// ── Tuya crypto helpers ────────────────────────────────────────
async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function hmacHex(msg: string, key: string) {
  const k  = await crypto.subtle.importKey('raw', new TextEncoder().encode(key),
               { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}
async function getToken(): Promise<string> {
  const t       = Date.now().toString()
  const path    = '/v1.0/token?grant_type=1'
  const strSign = ['GET', await sha256hex(''), '', path].join('\n')
  const sign    = await hmacHex(`${CLIENT_ID}${t}${strSign}`, CLIENT_SECRET)
  const res     = await fetch(`${TUYA_BASE}${path}`, {
    headers: { client_id: CLIENT_ID, sign_method: 'HMAC-SHA256', t, sign },
  })
  const data = await res.json()
  if (!data.success) throw new Error(`Tuya token: ${data.msg}`)
  return data.result.access_token as string
}
async function tuyaCall(method: string, path: string, body?: object): Promise<any> {
  const token   = await getToken()
  const t       = Date.now().toString()
  const bodyStr = body ? JSON.stringify(body) : ''
  const strSign = [method, await sha256hex(bodyStr), '', path].join('\n')
  const sign    = await hmacHex(`${CLIENT_ID}${token}${t}${strSign}`, CLIENT_SECRET)
  return (await fetch(`${TUYA_BASE}${path}`, {
    method,
    headers: {
      client_id: CLIENT_ID, access_token: token,
      sign_method: 'HMAC-SHA256', t, sign,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(bodyStr ? { body: bodyStr } : {}),
  })).json()
}
// Detect the device's actual switch DP code (models vary: switch_1,
// switch, switch_on, …) — sending the wrong one fails with
// "command or value not support".
const KNOWN_SWITCH_CODES = ['switch_1', 'switch', 'switch_on', 'switch_2', 'switch_3']

async function switchOff(deviceId: string) {
  const statusRes = await tuyaCall('GET', `/v1.0/devices/${deviceId}/status`)
  if (!statusRes.success) throw new Error(`Tuya status: ${statusRes.msg}`)
  const status: { code: string; value: unknown }[] = statusRes.result ?? []

  let code = KNOWN_SWITCH_CODES.find(c => status.some(x => x.code === c && typeof x.value === 'boolean'))
  if (!code) code = status.find(x => typeof x.value === 'boolean' && x.code.toLowerCase().includes('switch'))?.code
  if (!code) throw new Error('Device reports no switch function')

  return tuyaCall('POST', `/v1.0/devices/${deviceId}/commands`, { commands: [{ code, value: false }] })
}

// ── Main handler ───────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })

  // Secured by auto-shutoff secret (read from Supabase env secret)
  const shutoffSecret = Deno.env.get('AUTO_SHUTOFF_SECRET') ?? ''
  if (!shutoffSecret || req.headers.get('x-shutoff-secret') !== shutoffSecret)
    return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fetch all expired active sessions via the convenience view
  const { data: expired, error } = await supabase
    .from('expired_active_sessions')
    .select('*')

  if (error) {
    console.error('[auto-shutoff] query error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!expired?.length)
    return new Response(JSON.stringify({ processed: 0 }),
      { headers: { 'Content-Type': 'application/json' } })

  const results: { session_id: string; status: string; error?: string }[] = []

  for (const row of expired) {
    try {
      // 1. Turn off the Tuya switch if it is on
      if (row.tuya_device_id && row.switch_status) {
        const r = await switchOff(row.tuya_device_id)
        if (!r.success) throw new Error(`Tuya switchOff failed: ${r.msg}`)
        await supabase.from('charger_listings')
          .update({ switch_status: false })
          .eq('id', row.listing_id)
      }

      // 2. Calculate delivered energy up to booking end time
      const startMs      = new Date(row.started_at).getTime()
      const endMs        = new Date(row.booking_ends_at).getTime()
      const elapsedHours = Math.max(0, (endMs - startMs) / 3_600_000)
      const kwh          = parseFloat((elapsedHours * KW_RATE).toFixed(4))

      // 3. Complete the charging session at booking end time
      await supabase.from('charging_sessions').update({
        status:        'completed',
        ended_at:      row.booking_ends_at,
        kwh_delivered: kwh,
      }).eq('id', row.session_id)

      // 4. Complete the booking
      await supabase.from('bookings').update({ status: 'completed' }).eq('id', row.booking_id)

      results.push({ session_id: row.session_id, status: 'completed' })
      console.log(`[auto-shutoff] completed session ${row.session_id}`)
    } catch (e: any) {
      console.error(`[auto-shutoff] session ${row.session_id}:`, e.message)
      results.push({ session_id: row.session_id, status: 'error', error: e.message })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } })
})
