import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ACCOUNT_SID  = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const FROM_NUMBER  = 'whatsapp:+14155238886';
const CONTENT_SID  = 'HXb5b62575e6e4ff6129ad7c8efe1f983e';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { phone, date, time } = await req.json();

    if (!phone || !date || !time) {
      return new Response(JSON.stringify({ error: 'phone, date, and time are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const toNumber = phone.startsWith('+') ? phone : `+${phone}`;

    const body = new URLSearchParams({
      From:             FROM_NUMBER,
      To:               `whatsapp:${toNumber}`,
      ContentSid:       CONTENT_SID,
      ContentVariables: JSON.stringify({ '1': date, '2': time }),
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sid: result.sid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
