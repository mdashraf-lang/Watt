import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// UAT default; set THAWANI_BASE_URL=https://checkout.thawani.om for production.
const THAWANI_BASE   = Deno.env.get('THAWANI_BASE_URL') ?? 'https://uatcheckout.thawani.om'
const SECRET_KEY     = Deno.env.get('THAWANI_SECRET_KEY') ?? ''
const PUBLISHABLE_KEY = Deno.env.get('THAWANI_PUBLISHABLE_KEY') ?? ''

// Guardrails on a single top-up (OMR).
const MIN_OMR = 1
const MAX_OMR = 500

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function thawani(method: string, path: string, body?: object) {
  const res = await fetch(`${THAWANI_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'thawani-api-key': SECRET_KEY },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  return { statusOk: res.ok, json }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    if (!SECRET_KEY || !PUBLISHABLE_KEY)
      return err('Thawani not configured. Set THAWANI_SECRET_KEY and THAWANI_PUBLISHABLE_KEY.', 503)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Authenticate the user.
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return err('Unauthorized', 401)
    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
    if (!user) return err('Unauthorized', 401)

    const { action, amount, session_id } = await req.json() as {
      action: 'create' | 'verify'; amount?: number; session_id?: string
    }

    // ── Create a checkout session ──────────────────────────────
    if (action === 'create') {
      const omr = Number(amount)
      if (!omr || omr < MIN_OMR || omr > MAX_OMR)
        return err(`Amount must be between ${MIN_OMR} and ${MAX_OMR} OMR`)

      const clientRef = `${user.id}:${Date.now()}`
      const { statusOk, json } = await thawani('POST', '/api/v1/checkout/session', {
        client_reference_id: clientRef,
        mode: 'payment',
        products: [{
          name: 'Watt Wallet Top-up',
          unit_amount: Math.round(omr * 1000),   // OMR → baisa (integer)
          quantity: 1,
        }],
        success_url: 'watt://wallet?status=success',
        cancel_url:  'watt://wallet?status=cancel',
        metadata: { user_id: user.id, amount: omr },
      })
      const sid = json?.data?.session_id
      if (!statusOk || !sid) return err(`Thawani session error: ${json?.description ?? 'unknown'}`, 502)

      await supabase.from('payment_sessions').insert({
        user_id: user.id, session_id: sid, amount: omr, status: 'pending',
      })

      return ok({
        success: true,
        session_id: sid,
        publishable_key: PUBLISHABLE_KEY,
        pay_url: `${THAWANI_BASE}/pay/${sid}?key=${PUBLISHABLE_KEY}`,
      })
    }

    // ── Verify a session & credit the wallet if paid ───────────
    if (action === 'verify') {
      if (!session_id) return err('session_id required')

      // The session must belong to this user.
      const { data: ps } = await supabase
        .from('payment_sessions')
        .select('user_id, amount, status')
        .eq('session_id', session_id).maybeSingle()
      if (!ps || ps.user_id !== user.id) return err('Session not found', 404)
      if (ps.status === 'paid') return ok({ success: true, status: 'paid', already: true })

      const { statusOk, json } = await thawani('GET', `/api/v1/checkout/session/${session_id}`)
      const paymentStatus = json?.data?.payment_status
      if (!statusOk) return err(`Thawani verify error: ${json?.description ?? 'unknown'}`, 502)

      if (paymentStatus === 'paid') {
        const { data: balance, error: rpcErr } = await supabase.rpc('credit_wallet_topup', {
          p_user: user.id, p_amount: ps.amount, p_session: session_id, p_method: 'thawani',
        })
        if (rpcErr) throw rpcErr
        return ok({ success: true, status: 'paid', balance })
      }

      if (paymentStatus === 'cancelled' || paymentStatus === 'expired') {
        await supabase.from('payment_sessions').update({ status: 'failed' }).eq('session_id', session_id)
      }
      return ok({ success: true, status: paymentStatus ?? 'pending' })
    }

    return err('action must be create | verify')

  } catch (e: any) {
    console.error('[thawani-checkout]', e)
    return err(e.message ?? 'Internal server error', 500)
  }
})
