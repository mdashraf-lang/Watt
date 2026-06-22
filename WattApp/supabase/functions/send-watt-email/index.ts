import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── SMTP config (add these as Supabase Edge Function secrets) ──
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
// Alternatively set RESEND_API_KEY for Resend.com
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SMTP_FROM      = Deno.env.get('SMTP_FROM') ?? 'Watt <noreply@watt.om>';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Email templates ────────────────────────────────────────────

function templateApplicationReceived(name: string): { subject: string; html: string } {
  return {
    subject: 'تم استلام طلبك / Your Application Has Been Received – Watt',
    html: `
<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .header { background: #064E3B; padding: 32px 24px; text-align: center; }
  .logo { font-size: 32px; font-weight: 900; color: #10B981; letter-spacing: 4px; }
  .body { padding: 32px 24px; }
  .title { font-size: 22px; font-weight: 800; color: #111827; margin-bottom: 12px; }
  .sub { font-size: 14px; color: #6B7280; line-height: 1.7; margin-bottom: 20px; }
  .badge { display: inline-block; background: #FFFBEB; border: 1.5px solid #FEF3C7; color: #D97706; font-weight: 700; padding: 8px 18px; border-radius: 20px; font-size: 13px; margin-bottom: 20px; }
  .steps { background: #F9FAFB; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .step { display: flex; align-items: center; margin-bottom: 12px; gap: 12px; font-size: 14px; color: #374151; }
  .step-num { background: #064E3B; color: #10B981; font-weight: 800; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
  .footer { background: #F3F4F6; padding: 16px 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
  .divider { border-top: 2px solid #E5E7EB; margin: 8px 0 20px; }
  /* LTR section */
  .en { direction: ltr; text-align: left; margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB; }
</style></head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">WATT</div></div>
  <div class="body">
    <div class="badge">⏳ قيد المراجعة</div>
    <div class="title">مرحباً ${name}،</div>
    <div class="sub">
      تم استلام طلبك للانضمام كمستثمر في شبكة واط بنجاح.<br>
      سيقوم فريقنا بمراجعة طلبك والتواصل معك خلال <strong>48 – 72 ساعة</strong>.
    </div>
    <div class="steps">
      <div class="step"><div class="step-num">1</div>مراجعة الطلب</div>
      <div class="step"><div class="step-num">2</div>زيارة الموقع</div>
      <div class="step"><div class="step-num">3</div>توقيع العقد</div>
      <div class="step"><div class="step-num">4</div>تركيب الشاحن</div>
    </div>
    <div class="en">
      <strong>Hello ${name},</strong><br><br>
      Your Watt Investor application has been received.<br>
      Our team will review it and contact you within <strong>48–72 hours</strong>.
    </div>
  </div>
  <div class="footer">© 2025 Watt EV Charging Network · Oman</div>
</div>
</body></html>`,
  };
}

function templateApplicationAccepted(name: string): { subject: string; html: string } {
  return {
    subject: 'تهانينا! تمت الموافقة على طلبك / Congratulations! Application Approved – Watt',
    html: `
<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .header { background: #064E3B; padding: 32px 24px; text-align: center; }
  .logo { font-size: 32px; font-weight: 900; color: #10B981; letter-spacing: 4px; }
  .body { padding: 32px 24px; }
  .title { font-size: 22px; font-weight: 800; color: #111827; margin-bottom: 12px; }
  .sub { font-size: 14px; color: #6B7280; line-height: 1.7; margin-bottom: 20px; }
  .badge { display: inline-block; background: #ECFDF5; border: 1.5px solid #D1FAE5; color: #059669; font-weight: 700; padding: 8px 18px; border-radius: 20px; font-size: 13px; margin-bottom: 20px; }
  .cta { display: block; background: #059669; color: #fff; text-align: center; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none; margin-bottom: 20px; }
  .footer { background: #F3F4F6; padding: 16px 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
  .en { direction: ltr; text-align: left; margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB; }
</style></head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">WATT</div></div>
  <div class="body">
    <div class="badge">✅ تمت الموافقة</div>
    <div class="title">تهانينا يا ${name}! 🎉</div>
    <div class="sub">
      يسعدنا إبلاغك بأنه تمت <strong>الموافقة على طلبك</strong> للانضمام كمستثمر في شبكة واط.<br><br>
      افتح التطبيق الآن لإعداد شاحنك وتفعيله على الخريطة.
    </div>
    <div class="en">
      <strong>Congratulations ${name}! 🎉</strong><br><br>
      Your Watt Investor application has been <strong>approved</strong>.<br>
      Open the app to set up your charger and activate it on the map.
    </div>
  </div>
  <div class="footer">© 2025 Watt EV Charging Network · Oman</div>
</div>
</body></html>`,
  };
}

function templateApplicationRejected(name: string, reason?: string): { subject: string; html: string } {
  return {
    subject: 'تحديث بشأن طلبك / Application Update – Watt',
    html: `
<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; }
  .header { background: #064E3B; padding: 32px 24px; text-align: center; }
  .logo { font-size: 32px; font-weight: 900; color: #10B981; letter-spacing: 4px; }
  .body { padding: 32px 24px; }
  .badge { display: inline-block; background: #FEF2F2; border: 1.5px solid #FECACA; color: #DC2626; font-weight: 700; padding: 8px 18px; border-radius: 20px; font-size: 13px; margin-bottom: 20px; }
  .title { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 12px; }
  .sub { font-size: 14px; color: #6B7280; line-height: 1.7; margin-bottom: 16px; }
  .reason { background: #FEF2F2; border-radius: 10px; padding: 14px; font-size: 13px; color: #7F1D1D; margin-bottom: 20px; }
  .footer { background: #F3F4F6; padding: 16px 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
  .en { direction: ltr; text-align: left; margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB; }
</style></head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">WATT</div></div>
  <div class="body">
    <div class="badge">❌ لم يُقبل الطلب</div>
    <div class="title">مرحباً ${name}،</div>
    <div class="sub">
      نأسف لإبلاغك بأنه لم يتم قبول طلبك في الوقت الحالي.
      ${reason ? '<br>يمكنك إعادة التقديم بعد مراجعة الملاحظات أدناه.' : ''}
    </div>
    ${reason ? `<div class="reason">📋 ${reason}</div>` : ''}
    <div class="en">
      Hello ${name},<br><br>
      Unfortunately, your application was not approved at this time.
      ${reason ? `<br><br>Admin note: ${reason}` : ''}
      You may reapply through the Watt app.
    </div>
  </div>
  <div class="footer">© 2025 Watt EV Charging Network · Oman</div>
</div>
</body></html>`,
  };
}

// ── Email sender ───────────────────────────────────────────────

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: SMTP_FROM, to, subject, html }),
  });
  return res.ok;
}

async function queueEmail(supabase: any, to: string, toName: string, type: string, subject: string, html: string) {
  await supabase.from('email_queue').insert({ to_email: to, to_name: toName, type, subject, html_body: html });
}

// ── Main handler ───────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, to_email, to_name, admin_comment } = await req.json();

    if (!to_email || !type) {
      return new Response(JSON.stringify({ error: 'to_email and type are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let template: { subject: string; html: string };

    switch (type) {
      case 'application_received':
        template = templateApplicationReceived(to_name ?? 'Valued Customer');
        break;
      case 'application_accepted':
        template = templateApplicationAccepted(to_name ?? 'Valued Customer');
        break;
      case 'application_rejected':
        template = templateApplicationRejected(to_name ?? 'Valued Customer', admin_comment);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Try to send immediately via Resend if key is configured
    const sent = await sendViaResend(to_email, template.subject, template.html);

    // Always queue for audit trail and fallback when SMTP not yet configured
    if (SUPABASE_URL && SERVICE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      await queueEmail(admin, to_email, to_name ?? '', type, template.subject, template.html);
      if (sent) {
        await admin.from('email_queue').update({ sent: true }).eq('to_email', to_email).eq('type', type).is('sent', false);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, queued: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
