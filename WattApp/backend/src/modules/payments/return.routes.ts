import { Router } from 'express';

// Public payment-return bounce pages.
//
// Hosted checkouts (Thawani) require valid http(s) success/cancel URLs and reject
// custom schemes. The mobile app, however, opens the checkout with
// `WebBrowser.openAuthSessionAsync(pay_url, 'watt://wallet')` and only regains
// control when the in-app browser navigates to a `watt://wallet…` URL. These two
// endpoints bridge the gap: Thawani redirects here over https, and we immediately
// send the browser to the app's deep link, which expo-web-browser intercepts to
// close the session. The app then re-verifies the payment with the backend, so
// these pages carry no trust — they only need to bounce back.
const router = Router();

function bouncePage(status: 'success' | 'cancel'): string {
  const deepLink = `watt://wallet?status=${status}`;
  const linkJson = JSON.stringify(deepLink);
  // <meta refresh> is the CSP-safe primary redirect; the inline script and manual
  // link are progressive fallbacks for browsers that don't act on it immediately.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0;url=${deepLink}" />
<title>Returning to GO WATT…</title>
</head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;padding:48px 24px;color:#111">
<p>Returning to the GO WATT app…</p>
<p><a href="${deepLink}">Tap here if it doesn't open automatically</a></p>
<script>window.location.replace(${linkJson});</script>
</body>
</html>`;
}

router.get('/success', (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8').send(bouncePage('success'));
});

router.get('/cancel', (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8').send(bouncePage('cancel'));
});

export default router;
