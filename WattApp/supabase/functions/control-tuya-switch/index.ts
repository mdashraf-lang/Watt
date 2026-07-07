import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TUYA_BASE      = Deno.env.get('TUYA_BASE_URL') ?? 'https://openapi.tuyaeu.com'
const CLIENT_ID      = Deno.env.get('TUYA_CLIENT_ID')!
const CLIENT_SECRET  = Deno.env.get('TUYA_CLIENT_SECRET')!
const SHUTOFF_SECRET = Deno.env.get('AUTO_SHUTOFF_SECRET') ?? ''

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-auto-shutoff-secret',
}
const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ── Crypto helpers ─────────────────────────────────────────────
async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function hmacHex(msg: string, key: string) {
  const k   = await crypto.subtle.importKey('raw', new TextEncoder().encode(key),
                { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig  = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ── Tuya API ───────────────────────────────────────────────────
async function getToken(): Promise<string> {
  const t       = Date.now().toString()
  const path    = '/v1.0/token?grant_type=1'
  const strSign = ['GET', await sha256hex(''), '', path].join('\n')
  const sign    = await hmacHex(`${CLIENT_ID}${t}${strSign}`, CLIENT_SECRET)
  const res     = await fetch(`${TUYA_BASE}${path}`, {
    headers: { client_id: CLIENT_ID, sign_method: 'HMAC-SHA256', t, sign },
  })
  const data = await res.json()
  if (!data.success) throw new Error(`Tuya token error: ${data.msg} (code ${data.code})`)
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
// Different Tuya models expose their main switch under different DP codes
// (switch_1, switch, switch_on, …). Detect the device's actual code from
// its live status instead of hardcoding one — sending the wrong code makes
// Tuya reply "command or value not support".
const KNOWN_SWITCH_CODES = ['switch_1', 'switch', 'switch_on', 'switch_2', 'switch_3']

async function getDeviceStatus(d: string): Promise<{ code: string; value: unknown }[]> {
  const r = await tuyaCall('GET', `/v1.0/devices/${d}/status`)
  if (!r.success) throw new Error(`Tuya status: ${r.msg}`)
  return r.result ?? []
}

function findSwitchCode(status: { code: string; value: unknown }[]): string {
  for (const c of KNOWN_SWITCH_CODES)
    if (status.some(x => x.code === c && typeof x.value === 'boolean')) return c
  const anyBool = status.find(x => typeof x.value === 'boolean' && x.code.toLowerCase().includes('switch'))
  if (anyBool) return anyBool.code
  throw new Error('Device reports no switch function')
}

async function setSwitch(d: string, value: boolean) {
  const code = findSwitchCode(await getDeviceStatus(d))
  return tuyaCall('POST', `/v1.0/devices/${d}/commands`, { commands: [{ code, value }] })
}
async function switchOn(d: string)  { return setSwitch(d, true)  }
async function switchOff(d: string) { return setSwitch(d, false) }
async function switchStatus(d: string): Promise<boolean> {
  const status = await getDeviceStatus(d)
  try { return status.find(x => x.code === findSwitchCode(status))?.value === true }
  catch { return false }
}

// ── Energy metering ────────────────────────────────────────────
// Fallback scales (value / 10^scale) when the device spec lookup fails.
const FALLBACK_SCALES: Record<string, number> = {
  cur_power: 1,               // 0.1 W
  cur_voltage: 1,             // 0.1 V
  cur_current: 3,             // mA
  add_ele: 2,                 // 0.01 kWh
  total_forward_energy: 2,    // 0.01 kWh
  forward_energy_total: 2,    // 0.01 kWh
}

// Reads live electrical data from the device. Returns nulls for values
// the device does not report (non-metering switches only have switch_1).
async function deviceEnergy(d: string) {
  const [statusRes, specRes] = await Promise.all([
    tuyaCall('GET', `/v1.0/devices/${d}/status`),
    tuyaCall('GET', `/v1.0/devices/${d}/specifications`).catch(() => null),
  ])
  if (!statusRes.success) throw new Error(`Tuya status: ${statusRes.msg}`)
  const status: { code: string; value: unknown }[] = statusRes.result ?? []

  // Per-device scale map from the Tuya specification endpoint
  const scales: Record<string, number> = {}
  if (specRes?.success) {
    for (const s of specRes.result?.status ?? []) {
      try {
        const v = JSON.parse(s.values)
        if (typeof v.scale === 'number') scales[s.code] = v.scale
      } catch { /* non-numeric spec — ignore */ }
    }
  }
  const read = (code: string): number | null => {
    const item = status.find(x => x.code === code)
    if (!item || typeof item.value !== 'number') return null
    return item.value / Math.pow(10, scales[code] ?? FALLBACK_SCALES[code] ?? 0)
  }

  const powerW    = read('cur_power')
  const energyKwh = read('total_forward_energy') ?? read('forward_energy_total') ?? read('add_ele')

  let switchState = false
  try { switchState = status.find(x => x.code === findSwitchCode(status))?.value === true }
  catch { /* device has no switch DP */ }

  return {
    switch:     switchState,
    power_w:    powerW,                       // live power draw (W)
    voltage_v:  read('cur_voltage'),          // line voltage (V)
    current_a:  read('cur_current'),          // current (A)
    energy_kwh: energyKwh,                    // cumulative meter reading (kWh)
    metering:   powerW !== null || energyKwh !== null,
  }
}

// ── Main ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { action, booking_id, listing_id } = await req.json() as {
      action: 'on' | 'off' | 'status' | 'energy'; booking_id?: string; listing_id?: string
    }
    if (!action || !['on', 'off', 'status', 'energy'].includes(action))
      return err('action must be on | off | status | energy')

    // ── Path 1: internal auto-shutoff (pg_cron) ────────────────
    if (SHUTOFF_SECRET && req.headers.get('x-auto-shutoff-secret') === SHUTOFF_SECRET) {
      if (!listing_id) return err('listing_id required')
      const { data: l } = await supabase.from('charger_listings')
        .select('id,tuya_device_id').eq('id', listing_id).maybeSingle()
      if (!l?.tuya_device_id) return err('Device not configured', 404)
      const r = await switchOff(l.tuya_device_id)
      if (!r.success) throw new Error(`Tuya: ${r.msg}`)
      await supabase.from('charger_listings').update({ switch_status: false }).eq('id', listing_id)
      return ok({ success: true, switch_status: false })
    }

    // Authenticate user for paths 2 & 3
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return err('Unauthorized', 401)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.slice(7))
    if (authErr || !user) return err('Unauthorized', 401)

    // ── Path 2: investor direct control ───────────────────────
    // Investor toggles their own charger ON/OFF from the Watt app.
    // Controls the physical switch AND updates is_available on the listing,
    // so the charger appears/disappears for customers on the map.
    if (listing_id && !booking_id) {
      const { data: l } = await supabase.from('charger_listings')
        .select('id,tuya_device_id,host_id')
        .eq('id', listing_id)
        .eq('host_id', user.id)   // must be the owner
        .maybeSingle()
      if (!l)                return err('Listing not found or not yours', 404)
      if (!l.tuya_device_id) return err('No Tuya device configured yet', 400)

      if (action === 'energy') {
        const e = await deviceEnergy(l.tuya_device_id)
        await supabase.from('charger_listings').update({ switch_status: e.switch }).eq('id', l.id)
        return ok({ success: true, ...e })
      }

      let switchState: boolean
      if (action === 'on') {
        const r = await switchOn(l.tuya_device_id)
        if (!r.success) throw new Error(`Tuya: ${r.msg}`)
        switchState = true
      } else if (action === 'off') {
        const r = await switchOff(l.tuya_device_id)
        if (!r.success) throw new Error(`Tuya: ${r.msg}`)
        switchState = false
      } else {
        switchState = await switchStatus(l.tuya_device_id)
      }

      // Sync switch_status — is_available is handled by the app toggle separately
      await supabase.from('charger_listings').update({ switch_status: switchState }).eq('id', l.id)
      return ok({ success: true, switch_status: switchState })
    }

    // ── Path 3: customer booking-validated control ─────────────
    if (!booking_id) return err('booking_id required')
    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .select('id,user_id,status,booked_at,duration_minutes,listing_id,listing:charger_listings(id,tuya_device_id,tuya_verified)')
      .eq('id', booking_id).single()

    if (bookErr || !booking)         return err('Booking not found', 404)
    if (booking.user_id !== user.id) return err('Not your booking', 403)
    if (!booking.listing_id)         return err('No charger linked to this booking', 400)

    const l = booking.listing as any
    if (!l?.tuya_device_id) return err('Charger device not configured. Contact the host.', 400)
    if (!l?.tuya_verified)  return err('Charger not yet verified by admin.', 400)

    if (action === 'energy') {
      const e = await deviceEnergy(l.tuya_device_id)
      await supabase.from('charger_listings').update({ switch_status: e.switch }).eq('id', l.id)
      return ok({ success: true, ...e })
    }

    if (action === 'on') {
      const now   = Date.now()
      const start = new Date(booking.booked_at).getTime()
      const end   = start + booking.duration_minutes * 60_000
      if (!['confirmed', 'active'].includes(booking.status)) return err('Booking not confirmed', 422)
      if (now < start) return err(`Session hasn't started yet. Starts at ${new Date(start).toISOString()}`, 422)
      if (now > end)   return err('Booking window expired', 422)
    }

    let switchState: boolean
    if (action === 'on') {
      const r = await switchOn(l.tuya_device_id)
      if (!r.success) throw new Error(`Tuya: ${r.msg}`)
      switchState = true
    } else if (action === 'off') {
      const r = await switchOff(l.tuya_device_id)
      if (!r.success) throw new Error(`Tuya: ${r.msg}`)
      switchState = false
    } else {
      switchState = await switchStatus(l.tuya_device_id)
    }

    await supabase.from('charger_listings').update({ switch_status: switchState }).eq('id', l.id)
    return ok({ success: true, switch_status: switchState })

  } catch (e: any) {
    console.error('[control-tuya-switch]', e)
    return err(e.message ?? 'Internal server error', 500)
  }
})
