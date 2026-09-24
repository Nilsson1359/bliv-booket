// fuldtbooketmusiker.dk: statiske filer + Meta Conversions API-relay (24/9 2026).
// POST /api/conv  {event_name, event_id, url, fbp, fbc, fn, ln, em, ph, test_event_code?}
// -> graph.facebook.com/{PIXEL}/events med META_CAPI_TOKEN (Worker-secret, aldrig i HTML).
// Samme event_id som browser-pixelen, så Meta dedupliker browser + server.
const ALLOWED_EVENTS = new Set(['Lead', 'PageView', 'Schedule', 'Contact']);

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const norm = v => (v || '').toString().trim().toLowerCase();
async function hashed(v) { v = norm(v); return v ? [await sha256(v)] : undefined; }
async function hashedPhone(v) {
  v = (v || '').toString().replace(/[^\d+]/g, '');
  if (!v) return undefined;
  if (v.startsWith('+')) v = v.slice(1);
  else if (v.length === 8) v = '45' + v; // dansk 8-cifret uden landekode
  return [await sha256(v)];
}

async function handleConv(request, env) {
  const origin = request.headers.get('Origin') || '';
  const host = new URL(request.url).hostname;
  if (origin && new URL(origin).hostname !== host) return json({ error: 'bad origin' }, 403);
  if (!env.META_CAPI_TOKEN || !env.META_PIXEL_ID) return json({ error: 'relay not configured' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const event_name = ALLOWED_EVENTS.has(body.event_name) ? body.event_name : null;
  if (!event_name) return json({ error: 'bad event' }, 400);

  const ua = request.headers.get('User-Agent') || '';
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const user_data = {
    client_ip_address: ip || undefined,
    client_user_agent: ua || undefined,
    fbp: body.fbp || undefined,
    fbc: body.fbc || undefined,
    fn: await hashed(body.fn),
    ln: await hashed(body.ln),
    em: await hashed(body.em),
    ph: await hashedPhone(body.ph),
    country: [await sha256('dk')],
  };
  Object.keys(user_data).forEach(k => user_data[k] === undefined && delete user_data[k]);

  const event = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(body.event_id || crypto.randomUUID()).slice(0, 100),
    event_source_url: String(body.url || request.headers.get('Referer') || '').slice(0, 500),
    action_source: 'website',
    user_data,
    custom_data: { content_name: 'Samtale booket', content_category: 'booking' },
  };
  const payload = { data: [event] };
  if (body.test_event_code) payload.test_event_code = String(body.test_event_code).slice(0, 40);

  const r = await fetch(`https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const res = await r.json().catch(() => ({}));
  // Aldrig token eller fejldetaljer tilbage til browseren, kun om Meta tog imod.
  return json({ ok: r.ok, events_received: res.events_received ?? 0, fbtrace_id: res.fbtrace_id }, r.ok ? 200 : 502);
}

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/conv') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      try { return await handleConv(request, env); } catch (e) { return json({ error: 'relay failed' }, 500); }
    }
    return env.ASSETS.fetch(request);
  },
};
