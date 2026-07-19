import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// PHASE 2 — Automatic investor payouts (scheduled disbursement)
// ============================================================================
// Runs on a cron schedule. It:
//   1) asks the DB for the batch of investors due a payout (enqueue_auto_payouts
//      already held their funds), then
//   2) sends each one to the payout PROVIDER (real bank transfer), then
//   3) records success/failure via settle_auto_payout (failure auto-refunds).
//
// The whole feature is OFF until app_config.payout_auto_enabled='true' AND a
// provider is configured — enqueue returns nothing otherwise, so this is a
// safe no-op until you're ready.
// ============================================================================

interface PayoutRow {
  id: string
  user_id: string
  amount: number
  bank_name: string | null
  account_holder: string | null
  iban: string | null
  provider: string | null
}

// ── PROVIDER ADAPTER ────────────────────────────────────────────────────────
// This is the ONE place to wire in Oman's disbursement/payout API once you
// have a provider contract. Return { ok, ref } on success; throw or return
// { ok:false } on failure (the amount is auto-refunded to the investor).
//
// Thawani's standard checkout is pay-IN only and does NOT do this — you need a
// bank/provider that exposes an outbound transfer (disbursement) API.
async function sendToProvider(row: PayoutRow): Promise<{ ok: boolean; ref?: string; error?: string }> {
  const provider = (row.provider ?? '').toLowerCase()

  switch (provider) {
    // ── EXAMPLE shape for when a real provider is added ──────────────────────
    // case 'my_oman_bank': {
    //   const res = await fetch(`${Deno.env.get('PAYOUT_API_URL')}/transfers`, {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Bearer ${Deno.env.get('PAYOUT_API_KEY')}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       amount: row.amount, currency: 'OMR',
    //       iban: row.iban, beneficiary: row.account_holder,
    //       reference: `GOWATT-${row.id}`,
    //     }),
    //   })
    //   const data = await res.json()
    //   if (!res.ok) return { ok: false, error: data?.message ?? 'transfer failed' }
    //   return { ok: true, ref: data.transfer_id }
    // }

    default:
      // No provider implemented yet — refuse rather than silently "succeed".
      return { ok: false, error: `No payout provider implemented for '${row.provider}'` }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })

  // Same secret-header pattern as auto-shutoff-chargers.
  const secret = Deno.env.get('DISBURSE_SECRET') ?? ''
  if (!secret || req.headers.get('x-disburse-secret') !== secret)
    return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1) Pull (and hold) the batch due for payout.
  const { data: batch, error } = await supabase.rpc('enqueue_auto_payouts')
  if (error) {
    console.error('[disburse] enqueue error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const rows = (batch ?? []) as PayoutRow[]
  if (!rows.length)
    return new Response(JSON.stringify({ processed: 0, note: 'nothing due (or feature disabled)' }),
      { headers: { 'Content-Type': 'application/json' } })

  const results: { id: string; status: string; error?: string }[] = []

  for (const row of rows) {
    try {
      const r = await sendToProvider(row)
      await supabase.rpc('settle_auto_payout', {
        p_id:   row.id,
        p_ok:   r.ok,
        p_ref:  r.ref ?? null,
        p_note: r.ok ? null : (r.error ?? 'Provider declined'),
      })
      results.push({ id: row.id, status: r.ok ? 'paid' : 'failed', error: r.error })
    } catch (e: any) {
      // Network/unknown error — refund via settle so funds aren't stuck.
      await supabase.rpc('settle_auto_payout', {
        p_id: row.id, p_ok: false, p_ref: null, p_note: e.message ?? 'Unexpected error',
      }).catch(() => {})
      results.push({ id: row.id, status: 'failed', error: e.message })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } })
})
