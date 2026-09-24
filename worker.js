// fuldtbooketmusiker.dk: statiske filer + Meta CAPI-relay + egen tracking + /admin (24/9 2026).
//  POST /api/conv   Meta Conversions API-relay (token = Worker-secret META_CAPI_TOKEN)
//  POST /api/t      tracking fra track.js -> D1 (env.DB), geo fra request.cf, ip fra CF-Connecting-IP
//  GET  /admin      dashboard (login m. ADMIN_PASSWORD-secret, signeret cookie 30 dage)
//  GET  /admin/api/stats|heat|visitors  JSON til dashboardet
import ADMIN_HTML from './admin.html';

const ALLOWED_EVENTS = new Set(['Lead', 'PageView', 'Schedule', 'Contact']);
const TRACK_TYPES = new Set(['pageview', 'booking_open', 'booking_interact', 'click', 'leave']);
const RANGES = { today: 1, '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
const html = (s, status = 200, extra = {}) => new Response(s, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const str = (v, n = 200) => (v == null ? '' : String(v)).slice(0, n);
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };

// ───────── crypto ─────────
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const norm = v => (v || '').toString().trim().toLowerCase();
async function hashed(v) { v = norm(v); return v ? [await sha256(v)] : undefined; }
async function hashedPhone(v) {
  v = (v || '').toString().replace(/[^\d+]/g, '');
  if (!v) return undefined;
  if (v.startsWith('+')) v = v.slice(1);
  else if (v.length === 8) v = '45' + v;
  return [await sha256(v)];
}

// ───────── Meta CAPI ─────────
async function handleConv(request, env) {
  const origin = request.headers.get('Origin') || '';
  const host = new URL(request.url).hostname;
  if (origin && new URL(origin).hostname !== host) return json({ error: 'bad origin' }, 403);
  if (!env.META_CAPI_TOKEN || !env.META_PIXEL_ID) return json({ error: 'relay not configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const event_name = ALLOWED_EVENTS.has(body.event_name) ? body.event_name : null;
  if (!event_name) return json({ error: 'bad event' }, 400);
  const user_data = {
    client_ip_address: request.headers.get('CF-Connecting-IP') || undefined,
    client_user_agent: request.headers.get('User-Agent') || undefined,
    fbp: body.fbp || undefined, fbc: body.fbc || undefined,
    fn: await hashed(body.fn), ln: await hashed(body.ln), em: await hashed(body.em), ph: await hashedPhone(body.ph),
    country: [await sha256('dk')],
  };
  Object.keys(user_data).forEach(k => user_data[k] === undefined && delete user_data[k]);
  const event = {
    event_name, event_time: Math.floor(Date.now() / 1000),
    event_id: str(body.event_id || crypto.randomUUID(), 100),
    event_source_url: str(body.url || request.headers.get('Referer') || '', 500),
    action_source: 'website', user_data,
    custom_data: { content_name: 'Samtale booket', content_category: 'booking' },
  };
  const payload = { data: [event] };
  if (body.test_event_code) payload.test_event_code = str(body.test_event_code, 40);
  const r = await fetch(`https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const res = await r.json().catch(() => ({}));
  return json({ ok: r.ok, events_received: res.events_received ?? 0, fbtrace_id: res.fbtrace_id }, r.ok ? 200 : 502);
}

// ───────── tracking collect ─────────
function parseUA(ua) {
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Andet';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Andet';
  return { device, browser, os };
}
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|axios|node-fetch|go-http/i;
async function handleTrack(request, env) {
  if (!env.DB) return json({ error: 'no db' }, 503);
  if (BOT_UA.test(request.headers.get('User-Agent') || '')) return new Response(null, { status: 204 });
  if (Number(request.headers.get('Content-Length') || 0) > 8192) return json({ error: 'too large' }, 413);
  let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!TRACK_TYPES.has(b.type)) return json({ error: 'bad type' }, 400);
  const cf = request.cf || {};
  const ua = request.headers.get('User-Agent') || '';
  const { device, browser, os } = parseUA(ua);
  let ref_host = ''; try { if (b.ref) ref_host = new URL(b.ref).hostname.replace(/^www\./, ''); } catch { }
  if (/fuldtbooketmusiker\.dk$/.test(ref_host)) ref_host = '';
  await env.DB.prepare(`INSERT INTO events (ts,type,vid,sid,pv,path,ref,ref_host,utm_source,utm_medium,utm_campaign,utm_content,
      ip,country,region,city,postal,lat,lon,ua,device,browser,os,vw,vh,dw,dh,x,y,sec,secy,label,depth,dur)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(Date.now(), b.type, str(b.vid, 40), str(b.sid, 40), str(b.pv, 40), str(b.path, 200), str(b.ref, 500), str(ref_host, 100),
      str(b.utm_source, 100), str(b.utm_medium, 100), str(b.utm_campaign, 150), str(b.utm_content, 150),
      request.headers.get('CF-Connecting-IP') || '', cf.country || '', cf.region || '', cf.city || '', cf.postalCode || '',
      num(cf.latitude, -90, 90), num(cf.longitude, -180, 180), str(ua, 300), device, browser, os,
      num(b.vw, 0, 10000), num(b.vh, 0, 10000), num(b.dw, 0, 100000), num(b.dh, 0, 200000),
      num(b.x, 0, 1), num(b.y, 0, 1), str(b.sec, 40), num(b.secy, -1, 2), str(b.label, 80),
      num(b.depth, 0, 100), num(b.dur, 0, 86400000)).run();
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

// ───────── admin auth ─────────
function cookieOf(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
async function isAuthed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const c = cookieOf(request, 'bk_admin'); const [exp, sig] = c.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sig === await hmac(env.ADMIN_PASSWORD, 'admin:' + exp);
}
async function loginCookie(env) {
  const exp = Date.now() + 30 * 86400000;
  return `bk_admin=${exp}.${await hmac(env.ADMIN_PASSWORD, 'admin:' + exp)}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`;
}
const LOGIN_HTML = (err) => `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin · Bliv Booket</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#121212;color:#eee;font-family:Manrope,system-ui,sans-serif}form{background:#1b1b1b;border:1px solid #2c2c2c;border-radius:20px;padding:36px 32px;width:min(92vw,360px)}h1{font-size:1.1rem;margin:0 0 18px;letter-spacing:.02em}input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#0f0f0f;color:#fff;font-size:1rem}button{margin-top:14px;width:100%;padding:12px;border-radius:999px;border:0;background:#e8e8e8;color:#111;font-weight:700;font-size:1rem;cursor:pointer}p{color:#f28b82;font-size:.85rem;margin:10px 0 0}</style></head>
<body><form method="post" action="/admin/login"><h1>Bliv Booket · Statistik</h1><input type="password" name="password" placeholder="Adgangskode" autofocus autocomplete="current-password"><button>Log ind</button>${err ? '<p>Forkert adgangskode</p>' : ''}</form></body></html>`;

// ───────── admin data ─────────
function rangeOf(url) {
  const r = url.searchParams.get('range') || '7d';
  const days = RANGES[r] || 7;
  const to = Date.now();
  // "i dag" = siden midnat dansk tid (approks. via aktuelt offset)
  const tzMin = tzOffsetMinutes();
  let from;
  if (r === 'today') { const d = new Date(to + tzMin * 60000); d.setUTCHours(0, 0, 0, 0); from = d.getTime() - tzMin * 60000; }
  else from = to - days * 86400000;
  return { from, to, days, tzMin, key: r };
}
function tzOffsetMinutes() {
  // Europe/Copenhagen: CET (+60) / CEST (+120)
  const now = new Date();
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Copenhagen', timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  const m = s.match(/([+-])(\d+)(?::(\d+))?/); if (!m) return 60;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}
const all = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).all()).results || [];
const one = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).first()) || {};

async function statsJSON(env, url) {
  const db = env.DB, { from, to, tzMin, key } = rangeOf(url);
  const R = 'ts BETWEEN ? AND ?';
  const booked = `SELECT DISTINCT sid FROM events WHERE type='pageview' AND path='/tak' AND ${R}`;
  const totals = await one(db, `SELECT
      COUNT(DISTINCT CASE WHEN type='pageview' THEN vid END) AS visitors,
      COUNT(DISTINCT CASE WHEN type='pageview' THEN sid END) AS sessions,
      SUM(type='pageview') AS pageviews,
      COUNT(DISTINCT CASE WHEN type='pageview' AND path='/' THEN sid END) AS front_sessions,
      COUNT(DISTINCT CASE WHEN type='booking_open' THEN sid END) AS opened,
      COUNT(DISTINCT CASE WHEN type='booking_interact' THEN sid END) AS interacted,
      COUNT(DISTINCT CASE WHEN type='pageview' AND path='/tak' THEN sid END) AS booked,
      (SELECT AVG(dur) FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' GROUP BY pv) WHERE path='/' AND ts BETWEEN ? AND ?) AS avg_dur,
      (SELECT AVG(depth) FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' GROUP BY pv) WHERE path='/' AND ts BETWEEN ? AND ?) AS avg_depth,
      COUNT(DISTINCT CASE WHEN type='pageview' AND vid IN (SELECT vid FROM events WHERE type='pageview' AND ts < ?) THEN vid END) AS returning_visitors
    FROM events WHERE ${R}`, from, to, from, to, from, from, to);
  const dayExpr = `strftime('%Y-%m-%d', (ts/1000 + ${tzMin * 60}), 'unixepoch')`;
  const hourExpr = `strftime('%Y-%m-%d %H:00', (ts/1000 + ${tzMin * 60}), 'unixepoch')`;
  const bucket = key === 'today' ? hourExpr : dayExpr;
  const series = await all(db, `SELECT ${bucket} AS d,
      COUNT(DISTINCT CASE WHEN type='pageview' THEN vid END) AS visitors,
      COUNT(DISTINCT CASE WHEN type='pageview' THEN sid END) AS sessions,
      COUNT(DISTINCT CASE WHEN type='booking_open' THEN sid END) AS opened,
      COUNT(DISTINCT CASE WHEN type='pageview' AND path='/tak' THEN sid END) AS booked
    FROM events WHERE ${R} GROUP BY d ORDER BY d`, from, to);
  const top = (col, type = 'pageview', extra = '') => all(db, `SELECT ${col} AS k, COUNT(DISTINCT sid) AS sessions,
      COUNT(DISTINCT CASE WHEN sid IN (${booked}) THEN sid END) AS booked
    FROM events WHERE type='${type}' AND ${R} ${extra} GROUP BY k ORDER BY sessions DESC LIMIT 25`, from, to, from, to);
  const [countries, cities, refs, utm_sources, campaigns, contents, devices, browsers, oses, pages] = await Promise.all([
    top('country'), top(`city || ', ' || region || ' (' || country || ')'`, 'pageview', `AND city<>''`),
    top('ref_host', 'pageview', `AND ref_host<>''`), top('utm_source', 'pageview', `AND utm_source<>''`),
    top('utm_campaign', 'pageview', `AND utm_campaign<>''`), top('utm_content', 'pageview', `AND utm_content<>''`),
    top('device'), top('browser'), top('os'), top('path'),
  ]);
  // CTA pr. sektion + pr. knap
  const ctaSql = (grp) => all(db, `SELECT ${grp} AS k, COUNT(*) AS clicks, COUNT(DISTINCT sid) AS sessions,
      COUNT(DISTINCT CASE WHEN sid IN (${booked}) THEN sid END) AS booked
    FROM events WHERE type='booking_open' AND ${R} GROUP BY k ORDER BY sessions DESC`, from, to, from, to);
  const [cta_sections, cta_buttons] = await Promise.all([ctaSql('sec'), ctaSql(`sec || ' | ' || label`)]);
  // klik pr. sektion (alle klik, ikke kun book-knapper)
  const clicks_sections = await all(db, `SELECT sec AS k, COUNT(*) AS clicks, COUNT(DISTINCT sid) AS sessions FROM events WHERE type='click' AND path='/' AND ${R} GROUP BY k ORDER BY clicks DESC`, from, to);
  const depth = await all(db, `SELECT (depth/10)*10 AS b, COUNT(*) AS n FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' GROUP BY pv) WHERE path='/' AND depth IS NOT NULL AND ts BETWEEN ? AND ? GROUP BY b ORDER BY b`, from, to);
  const points = await all(db, `SELECT lat, lon, city, COUNT(DISTINCT sid) AS sessions FROM events WHERE type='pageview' AND lat IS NOT NULL AND ${R} GROUP BY lat, lon, city ORDER BY sessions DESC LIMIT 500`, from, to);
  const hours = await all(db, `SELECT CAST(strftime('%H', (ts/1000 + ${tzMin * 60}), 'unixepoch') AS INTEGER) AS h, COUNT(DISTINCT sid) AS sessions FROM events WHERE type='pageview' AND ${R} GROUP BY h ORDER BY h`, from, to);
  const live = await one(db, `SELECT COUNT(DISTINCT sid) AS n FROM events WHERE ts > ?`, Date.now() - 5 * 60000);
  return { live: live.n || 0, range: key, from, to, totals, series, countries, cities, refs, utm_sources, campaigns, contents, devices, browsers, oses, pages, cta_sections, cta_buttons, clicks_sections, depth, points, hours };
}

async function heatJSON(env, url) {
  const db = env.DB, { from, to } = rangeOf(url);
  const path = url.searchParams.get('path') || '/';
  const device = url.searchParams.get('device') || 'all';
  const devSql = device === 'all' ? '' : device === 'desktop' ? `AND device='desktop'` : `AND device<>'desktop'`;
  const points = await all(db, `SELECT x, y, sec, secy, label, device, vw FROM events WHERE type='click' AND path=? AND ts BETWEEN ? AND ? ${devSql} ORDER BY ts DESC LIMIT 6000`, path, from, to);
  const labels = await all(db, `SELECT label AS k, sec, COUNT(*) AS clicks, COUNT(DISTINCT sid) AS sessions FROM events WHERE type='click' AND path=? AND ts BETWEEN ? AND ? ${devSql} AND label<>'' GROUP BY label, sec ORDER BY clicks DESC LIMIT 40`, path, from, to);
  const depth = await all(db, `SELECT (depth/10)*10 AS b, COUNT(*) AS n FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' GROUP BY pv) WHERE path=? AND depth IS NOT NULL AND ts BETWEEN ? AND ? ${devSql} GROUP BY b ORDER BY b`, path, from, to);
  const total = await one(db, `SELECT COUNT(*) AS n FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' GROUP BY pv) WHERE path=? AND depth IS NOT NULL AND ts BETWEEN ? AND ? ${devSql}`, path, from, to);
  return { path, device, points, labels, depth, leaves: total.n || 0 };
}

async function visitorsJSON(env, url) {
  const db = env.DB, { from, to } = rangeOf(url);
  const limit = Math.min(500, Number(url.searchParams.get('limit')) || 150);
  const rows = await all(db, `SELECT sid, MIN(ts) AS ts, MAX(ts) AS last, MAX(ip) AS ip, MAX(city) AS city, MAX(region) AS region, MAX(country) AS country,
      MAX(device) AS device, MAX(browser) AS browser, MAX(os) AS os, MAX(ref_host) AS ref_host, MAX(utm_source) AS utm_source, MAX(utm_campaign) AS utm_campaign,
      SUM(type='pageview') AS pages, MAX(CASE WHEN type='booking_open' THEN 1 ELSE 0 END) AS opened,
      MAX(CASE WHEN type='booking_interact' THEN 1 ELSE 0 END) AS interacted,
      MAX(CASE WHEN type='pageview' AND path='/tak' THEN 1 ELSE 0 END) AS booked,
      MAX(CASE WHEN type='leave' THEN depth END) AS depth, (SELECT SUM(dur) FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' GROUP BY pv) x WHERE x.sid = events.sid) AS dur,
      MAX(vid) AS vid, MAX(vw) AS vw
    FROM events WHERE ts BETWEEN ? AND ? GROUP BY sid ORDER BY ts DESC LIMIT ?`, from, to, limit);
  return { rows };
}

// ───────── router ─────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === '/api/conv') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleConv(request, env);
      }
      if (p === '/api/t') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleTrack(request, env);
      }
      if (p === '/admin' || p.startsWith('/admin/')) {
        if (p === '/admin/login' && request.method === 'POST') {
          const form = await request.formData();
          const pw = String(form.get('password') || '');
          if (env.ADMIN_PASSWORD && pw.length && pw === env.ADMIN_PASSWORD) {
            return new Response(null, { status: 303, headers: { Location: '/admin', 'Set-Cookie': await loginCookie(env) } });
          }
          await new Promise(r => setTimeout(r, 600));
          return html(LOGIN_HTML(true), 401);
        }
        if (p === '/admin/logout') return new Response(null, { status: 303, headers: { Location: '/admin', 'Set-Cookie': 'bk_admin=; Path=/admin; Max-Age=0; Secure; HttpOnly' } });
        const ok = await isAuthed(request, env);
        if (!ok) return p.startsWith('/admin/api/') ? json({ error: 'unauthorized' }, 401) : html(LOGIN_HTML(false), 401);
        if (p === '/admin' || p === '/admin/') return html(ADMIN_HTML, 200, { 'X-Robots-Tag': 'noindex' });
        if (p === '/admin/api/stats') return json(await statsJSON(env, url));
        if (p === '/admin/api/heat') return json(await heatJSON(env, url));
        if (p === '/admin/api/visitors') return json(await visitorsJSON(env, url));
        return json({ error: 'not found' }, 404);
      }
    } catch (e) {
      return json({ error: 'server error', detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
