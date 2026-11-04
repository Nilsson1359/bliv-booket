// fuldtbooketmusiker.dk: statiske filer + Meta CAPI-relay + egen tracking + /admin (24/9 2026).
//  POST /api/conv   Meta Conversions API-relay (token = Worker-secret META_CAPI_TOKEN)
//  POST /api/t      tracking fra track.js -> D1 (env.DB), geo fra request.cf, ip fra CF-Connecting-IP
//  GET  /admin      dashboard (login m. ADMIN_PASSWORD-secret, signeret cookie 30 dage)
//  GET  /admin/api/stats|heat|visitors|leads  JSON til dashboardet
//  POST /api/lead, GET /api/slots, POST /api/book  formular + booking på /firmafest og /bryllup (se 'leads' nedenfor)
//  GET  /admin/api/sales  salgstal fra GHL-pipelinen "fuldt booket musiker" (cron hvert 10. min henter, se 'salg' nedenfor)
import ADMIN_HTML from './admin.html';

const ALLOWED_EVENTS = new Set(['Lead', 'PageView', 'Schedule', 'Contact']);
const TRACK_TYPES = new Set(['pageview', 'booking_open', 'booking_interact', 'click', 'leave', 'view', 'cta', 'form_start', 'form_field', 'form_error', 'form_abandon', 'form_submit']);
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
  if (/fuldtbooketmusiker\.dk$/.test(ref_host) || OSCAR_HOSTS[ref_host]) ref_host = '';
  // Oscars underdomæner: "/" er gig-siden, så dashboardet viser /bryllup og /firmafest uanset domæne
  const gig = OSCAR_HOSTS[new URL(request.url).hostname];
  if (gig && (!b.path || b.path === '/')) b.path = '/' + gig;
  else if (gig && (b.path === SPLIT_PATH || b.path === SPLIT_PATH + '/')) { const v = splitVer(request); b.path = '/' + gig + (v ? '/' + v : SPLIT_PATH); }   // split: tælles på versionen
  else if (gig && /^\/v[0-9]\/?$/.test(b.path)) b.path = '/' + gig + '/direkte-' + b.path.replace(/\//g, '');   // /v2 åbnet direkte (deling/preview) tæller ikke med i testen
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

// Hvad tæller som hvad på fuldtbooketmusiker.dk
const CONF = {
  ctaType: 'booking_open', callsMails: false, sections: false,
  isOpened: e => e.type === 'booking_open', isInteracted: e => e.type === 'booking_interact',
  isBooked: e => e.type === 'pageview' && e.path === '/tak', isSeriesOpened: e => e.type === 'booking_open',
  visitorFlags: (s, e) => {
    if (!s) return { opened: 0, interacted: 0, booked: 0 };
    if (e.type === 'booking_open') s.opened = 1;
    if (e.type === 'booking_interact') s.interacted = 1;
    if (e.type === 'pageview' && e.path === '/tak') s.booked = 1;
  },
};

// Dashboardet læser periodens hændelser ÉN gang (sidevis i ts-orden) og regner alt i koden.
// Før kørte hver tabel sin egen gennemsøgning (~20-40 læste rækker pr. hændelse); nu ~1-2.
const PAGE = 10000;
async function scanEvents(db, from, to, cols, fn) {
  let lastTs = from, lastId = -1;
  for (;;) {
    const rows = await all(db, `SELECT id, ts, ${cols} FROM events INDEXED BY idx_events_ts WHERE ts >= ? AND ts <= ? AND (ts > ? OR id > ?) ORDER BY ts, id LIMIT ${PAGE}`, lastTs, to, lastTs, lastId);
    for (const r of rows) fn(r);
    if (rows.length < PAGE) return;
    lastTs = rows[rows.length - 1].ts; lastId = rows[rows.length - 1].id;
  }
}
// SQL-semantik: MAX ignorerer NULL, NULL sorteres først
const mx = (a, b) => (a == null ? b : b == null ? a : (b > a ? b : a));
const cmpK = (a, b) => (a === b ? 0 : a == null ? -1 : b == null ? 1 : a < b ? -1 : 1);
const setOf = (m, k) => { let s = m.get(k); if (!s) m.set(k, s = new Set()); return s; };
const nBooked = (sids, booked) => { let n = 0; for (const s of sids) if (booked.has(s)) n++; return n; };
const sortTop = (arr, by, limit) => { arr.sort((a, b) => b[by] - a[by] || cmpK(a.k, b.k)); return limit ? arr.slice(0, limit) : arr; };
const stampOf = (ts, off) => new Date((Math.floor(ts / 1000) + off) * 1000).toISOString();
const bucket10 = d => (Number.isInteger(d) ? Math.trunc(d / 10) * 10 : d);
const likeStart = (s, p) => s != null && String(s).toLowerCase().startsWith(p);
// leave-øjebliksbilleder samles pr. sidevisning (seneste = største dur/depth)
const addLeave = (m, e) => { const x = m.get(e.pv) || {}; m.set(e.pv, { path: mx(x.path, e.path), sid: mx(x.sid, e.sid), dur: mx(x.dur, e.dur), depth: mx(x.depth, e.depth) }); };

async function statsJSON(env, url) {
  const db = env.DB, { from, to, tzMin, key } = rangeOf(url);
  const off = tzMin * 60;
  const bucketOf = key === 'today' ? ts => { const s = stampOf(ts, off); return s.slice(0, 10) + ' ' + s.slice(11, 13) + ':00'; } : ts => stampOf(ts, off).slice(0, 10);
  const T = { visitors: new Set(), sessions: new Set(), front: new Set(), opened: new Set(), interacted: new Set(), booked: new Set(), calls: new Set(), mails: new Set() };
  let rows = 0, pageviews = 0;
  const series = new Map(), leaves = new Map(), hours = new Map(), points = new Map(), sections = new Map(), ctaSids = new Set();
  const TOPS = {
    countries: e => e.country,
    cities: e => (e.city == null || e.city === '' ? undefined : e.region == null || e.country == null ? null : `${e.city}, ${e.region} (${e.country})`),
    refs: e => (e.ref_host == null || e.ref_host === '' ? undefined : e.ref_host),
    utm_sources: e => (e.utm_source == null || e.utm_source === '' ? undefined : e.utm_source),
    campaigns: e => (e.utm_campaign == null || e.utm_campaign === '' ? undefined : e.utm_campaign),
    contents: e => (e.utm_content == null || e.utm_content === '' ? undefined : e.utm_content),
    devices: e => e.device, browsers: e => e.browser, oses: e => e.os, pages: e => e.path,
  };
  const tops = Object.fromEntries(Object.keys(TOPS).map(n => [n, new Map()]));
  const ctaSec = new Map(), ctaBtn = new Map(), clicks = new Map();
  const addClick = (m, k, sid) => { const x = m.get(k) || m.set(k, { clicks: 0, sids: new Set() }).get(k); x.clicks++; x.sids.add(sid); };
  await scanEvents(db, from, to, 'type, vid, sid, pv, path, ref_host, utm_source, utm_campaign, utm_content, country, region, city, lat, lon, device, browser, os, sec, label, depth, dur', e => {
    rows++;
    const t = e.type, sid = e.sid;
    let S = series.get(bucketOf(e.ts));
    if (!S) series.set(bucketOf(e.ts), S = { visitors: new Set(), sessions: new Set(), opened: new Set(), booked: new Set() });
    if (t === 'pageview') {
      pageviews++;
      if (e.vid != null) { T.visitors.add(e.vid); S.visitors.add(e.vid); }
      if (sid != null) { T.sessions.add(sid); S.sessions.add(sid); }
      if (e.path === '/' && sid != null) T.front.add(sid);
      for (const n in TOPS) { const k = TOPS[n](e); if (k !== undefined && sid != null) setOf(tops[n], k).add(sid); else if (k !== undefined) setOf(tops[n], k); }
      if (e.lat != null) { const pk = e.lat + '|' + e.lon + '|' + e.city; const p = points.get(pk) || points.set(pk, { lat: e.lat, lon: e.lon, city: e.city, sids: new Set() }).get(pk); if (sid != null) p.sids.add(sid); }
      if (sid != null) setOf(hours, Number(stampOf(e.ts, off).slice(11, 13))).add(sid);
    }
    if (t === 'leave') addLeave(leaves, e);
    if (t === 'click' && e.path === '/') addClick(clicks, e.sec, sid);
    if (t === CONF.ctaType) {
      addClick(ctaSec, e.sec, sid);
      addClick(ctaBtn, e.sec == null || e.label == null ? null : e.sec + ' | ' + e.label, sid);
      if (sid != null) ctaSids.add(sid);
    }
    if (t === 'view' && sid != null) setOf(sections, e.sec).add(sid);
    if (sid == null) return;
    if (CONF.isOpened(e)) T.opened.add(sid);
    if (CONF.isInteracted(e)) T.interacted.add(sid);
    if (CONF.isBooked(e)) { T.booked.add(sid); S.booked.add(sid); }
    if (CONF.isSeriesOpened(e)) S.opened.add(sid);
    if (t === 'cta' && likeStart(e.label, 'ring:')) T.calls.add(sid);
    if (t === 'cta' && likeStart(e.label, 'mail:')) T.mails.add(sid);
  });
  const booked = T.booked;
  // sidevisninger tælles efter starttidspunkt: dem, der startede før perioden, springes over
  const early = new Set((await all(db, `SELECT DISTINCT pv FROM events WHERE type='leave' AND ts >= ? AND ts < ?`, from - 3600000, from)).map(r => r.pv));
  const front = [...leaves].filter(([pv, x]) => x.path === '/' && !early.has(pv)).map(([, x]) => x);
  const avg = k => { const v = front.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const ret = await one(db, `SELECT COUNT(*) AS n FROM (SELECT vid FROM events WHERE type='pageview' AND ts BETWEEN ? AND ? AND vid IS NOT NULL GROUP BY vid) r WHERE EXISTS (SELECT 1 FROM events o INDEXED BY idx_events_vid WHERE o.vid = r.vid AND o.type='pageview' AND o.ts < ?)`, from, to, from);
  const live = await one(db, `SELECT COUNT(DISTINCT sid) AS n FROM events INDEXED BY idx_events_ts WHERE ts > ?`, Date.now() - 5 * 60000);
  const totals = {
    visitors: T.visitors.size, sessions: T.sessions.size, pageviews: rows ? pageviews : null, front_sessions: T.front.size,
    opened: T.opened.size, interacted: T.interacted.size, booked: booked.size,
    ...(CONF.callsMails ? { calls: T.calls.size, mails: T.mails.size } : {}),
    avg_dur: avg('dur'), avg_depth: avg('depth'), returning_visitors: ret.n || 0,
  };
  const out = { live: live.n || 0, range: key, from, to, totals };
  out.series = [...series].sort((a, b) => cmpK(a[0], b[0])).map(([d, s]) => ({ d, visitors: s.visitors.size, sessions: s.sessions.size, opened: s.opened.size, booked: s.booked.size }));
  for (const n in TOPS) out[n] = sortTop([...tops[n]].map(([k, s]) => ({ k, sessions: s.size, booked: nBooked(s, booked) })), 'sessions', 25);
  const ctaRows = m => sortTop([...m].map(([k, x]) => ({ k, clicks: x.clicks, sessions: nonNull(x.sids), booked: nBooked(x.sids, booked) })), 'sessions');
  out.cta_sections = ctaRows(ctaSec); out.cta_buttons = ctaRows(ctaBtn);
  out.clicks_sections = sortTop([...clicks].map(([k, x]) => ({ k, clicks: x.clicks, sessions: nonNull(x.sids) })), 'clicks');
  const depth = new Map();
  for (const x of front) if (x.depth != null) { const b = bucket10(x.depth); depth.set(b, (depth.get(b) || 0) + 1); }
  out.depth = [...depth].sort((a, b) => a[0] - b[0]).map(([b, n]) => ({ b, n }));
  out.points = [...points.values()].map(p => ({ lat: p.lat, lon: p.lon, city: p.city, sessions: p.sids.size })).sort((a, b) => b.sessions - a.sessions).slice(0, 500);
  out.hours = [...hours].sort((a, b) => a[0] - b[0]).map(([h, s]) => ({ h, sessions: s.size }));
  if (CONF.sections) out.sections = sortTop([...sections].map(([k, s]) => ({ k, sessions: s.size, booked: nBooked(s, booked), cta: nBooked(s, ctaSids) })), 'sessions');
  return out;
}
const nonNull = s => { let n = 0; for (const x of s) if (x != null) n++; return n; };

async function visitorsJSON(env, url) {
  const db = env.DB, { from, to } = rangeOf(url);
  const limit = Math.min(500, Number(url.searchParams.get('limit')) || 150);
  const S = new Map(), leaves = new Map();
  await scanEvents(db, from, to, 'type, vid, sid, pv, path, ip, city, region, country, device, browser, os, ref_host, utm_source, utm_campaign, label, depth, dur, vw', e => {
    if (e.type === 'leave') addLeave(leaves, e);
    let s = S.get(e.sid);
    if (!s) S.set(e.sid, s = { sid: e.sid, ts: e.ts, last: e.ts, pages: 0, depth: null, ...CONF.visitorFlags(null) });
    s.ts = Math.min(s.ts, e.ts); s.last = Math.max(s.last, e.ts);
    for (const c of ['ip', 'city', 'region', 'country', 'device', 'browser', 'os', 'ref_host', 'utm_source', 'utm_campaign', 'vid', 'vw']) s[c] = mx(s[c], e[c]);
    if (e.type === 'pageview') s.pages++;
    if (e.type === 'leave') s.depth = mx(s.depth, e.depth);
    CONF.visitorFlags(s, e);
  });
  const dur = new Map();
  for (const x of leaves.values()) if (x.dur != null) dur.set(x.sid, (dur.get(x.sid) || 0) + x.dur);
  const rows = [...S.values()].sort((a, b) => b.ts - a.ts).slice(0, limit).map(s => ({ ...s, dur: dur.has(s.sid) ? dur.get(s.sid) : null }));
  return { rows };
}

async function heatJSON(env, url) {
  const db = env.DB, { from, to } = rangeOf(url);
  const path = url.searchParams.get('path') || '/';
  const device = url.searchParams.get('device') || 'all';
  const devSql = device === 'all' ? '' : device === 'desktop' ? `AND device='desktop'` : `AND device<>'desktop'`;
  const points = await all(db, `SELECT x, y, sec, secy, label, device, vw FROM events WHERE type='click' AND path=? AND ts BETWEEN ? AND ? ${devSql} ORDER BY ts DESC LIMIT 6000`, path, from, to);
  const labels = await all(db, `SELECT label AS k, sec, COUNT(*) AS clicks, COUNT(DISTINCT sid) AS sessions FROM events WHERE type='click' AND path=? AND ts BETWEEN ? AND ? ${devSql} AND label<>'' GROUP BY label, sec ORDER BY clicks DESC LIMIT 40`, path, from, to);
  const depth = await all(db, `SELECT (depth/10)*10 AS b, COUNT(*) AS n FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' AND ts BETWEEN ? AND ? GROUP BY pv) WHERE path=? AND depth IS NOT NULL ${devSql} GROUP BY b ORDER BY b`, from, to, path);
  const total = await one(db, `SELECT COUNT(*) AS n FROM (SELECT pv, MAX(path) AS path, MAX(sid) AS sid, MAX(device) AS device, MAX(dur) AS dur, MAX(depth) AS depth, MIN(ts) AS ts FROM events WHERE type='leave' AND ts BETWEEN ? AND ? GROUP BY pv) WHERE path=? AND depth IS NOT NULL ${devSql}`, from, to, path);
  return { path, device, points, labels, depth, leaves: total.n || 0 };
}


// ───────── læsebudget + cache for dashboardet ─────────
// D1 gratis = 5 mio. læste rækker pr. døgn (UTC) for HELE Cloudflare-kontoen, delt med den anden side.
// Dashboardet opdaterer kun ved genindlæsning; svar caches kort, og hvert site må højst bruge READ_BUDGET pr. døgn.
const READ_BUDGET = 1000000;
const CACHE_TTL = { today: 60, '7d': 120, '30d': 300, '90d': 600, '365d': 1800 };
const utcDay = () => new Date().toISOString().slice(0, 10);

// env med en D1 der tæller læste rækker (meta.rows_read) for alle forespørgsler
function meteredEnv(env, meter) {
  const DB = { prepare: sql => ({ bind: (...p) => {
    const st = env.DB.prepare(sql).bind(...p);
    const run = async () => { const r = await st.all(); meter.rows += (r.meta && r.meta.rows_read) || 0; return r; };
    return { all: run, first: async () => ((await run()).results || [])[0] || null };
  } }) };
  return new Proxy(env, { get: (t, k) => (k === 'DB' ? DB : t[k]) });
}
async function usedToday(env) {
  try { return ((await env.DB.prepare('SELECT rows FROM usage WHERE day = ?').bind(utcDay()).first()) || {}).rows || 0; }
  catch { await env.DB.prepare('CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, rows INTEGER NOT NULL DEFAULT 0)').run().catch(() => {}); return 0; }
}
const addUsage = (env, rows) => env.DB.prepare('INSERT INTO usage (day, rows) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET rows = rows + excluded.rows').bind(utcDay(), rows).run().catch(() => {});
// Antal hændelser i perioden ud fra id'erne (læser 2 rækker i stedet for at tælle dem alle)
async function eventsInRange(env, url) {
  const { from, to } = rangeOf(url);
  const a = await env.DB.prepare('SELECT id FROM events WHERE ts >= ? ORDER BY ts LIMIT 1').bind(from).first();
  const b = await env.DB.prepare('SELECT id FROM events WHERE ts <= ? ORDER BY ts DESC LIMIT 1').bind(to).first();
  return a && b ? Math.max(0, b.id - a.id + 1) : 0;
}
// cost = ca. læste rækker pr. hændelse i perioden for dette endpoint (målt)
// Læste rækker pr. hændelse i perioden (målt 24/9 på 60.000 testhændelser: stats 1,9 / heat 1,7 / visitors 1,0 / form 1,3), rundet op
const COST = { leads: 0, stats: 2.5, heat: 2, visitors: 1.2, form: 1.5, outcomes: 0.2, quality: 0.5, calls: 0.2 };
async function adminApi(env, ctx, url, fn, cost, ttlOverride) {
  const cache = caches.default;
  const key = new Request(url.origin + '/__admin-cache' + url.pathname + url.search);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return new Response(hit.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Cache': 'HIT' } });
  const used = await usedToday(env);
  const est = Math.round((await eventsInRange(env, url)) * cost);
  if (used + est > READ_BUDGET) {
    return json({ error: 'Dagens læsebudget er brugt', detail: `${used.toLocaleString('da-DK')} af ${READ_BUDGET.toLocaleString('da-DK')} rækker (denne visning ville koste ca. ${est.toLocaleString('da-DK')}). Vælg en kortere periode, eller kig igen efter kl. 02.`, used, est, budget: READ_BUDGET }, 429);
  }
  const meter = { rows: 0 };
  const data = await fn(meteredEnv(env, meter), url);
  await addUsage(env, meter.rows + 5);
  const body = JSON.stringify(data);
  const ttl = ttlOverride || CACHE_TTL[url.searchParams.get('range') || '7d'] || 120;
  if (!data.error) ctx.waitUntil(cache.put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl } })).catch(() => {}));
  return new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Cache': 'MISS', 'X-Rows-Read': String(meter.rows), 'X-Rows-Today': String(used + meter.rows + 5) } });
}

// ───────── leads (/firmafest + /bryllup) ─────────
// POST /api/lead   formularen gemmer løbende (debounced, uden gem-knap) -> upsert pr. lid i D1 `leads`
// GET  /api/slots  ledige tider: GHL free-slots hvis GHL_TOKEN + kalender-id, ellers fast skema (hverdage 9-17)
// POST /api/book   booker valgt tid ud fra leadet i D1 (kunden skriver ikke info igen) -> GHL kontakt + aftale + note
// Telegram (TG_BOT_TOKEN + TG_CHAT_ID) én gang pr. milepæl: contact / done / booked.
const LEAD_PAGES = { firmafest: 'Firmafest', bryllup: 'Bryllup', ansoegning: 'Ansøgning' };   // ansoegning = musikernes ansøgningsform på fuldtbooketmusiker.dk (se 'ansøgning' nedenfor)
const LID_RE = /^[A-Za-z0-9-]{8,40}$/;
const MAX_LEAD_WRITES = 120;
const MAX_NEW_LEADS_PER_IP_HOUR = 15, MAX_BOOKINGS_PER_IP = 2;
const GHL_BASE = 'https://services.leadconnectorhq.com';
const TZ = 'Europe/Copenhagen';
const FALLBACK = { startMin: 9 * 60, endMin: 17 * 60, stepMin: 30, durationMin: 20, leadMs: 2 * 3600000 };

const sameOrigin = request => {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true;
  try { return new URL(origin).hostname === new URL(request.url).hostname; } catch { return false; }
};
async function readJSON(request, limit = 8192) {
  if (Number(request.headers.get('Content-Length') || 0) > limit) return { err: json({ error: 'too large' }, 413) };
  const text = await request.text();
  if (text.length > limit) return { err: json({ error: 'too large' }, 413) };
  try { const b = JSON.parse(text); return b && typeof b === 'object' ? { b } : { err: json({ error: 'bad json' }, 400) }; }
  catch { return { err: json({ error: 'bad json' }, 400) }; }
}
const phoneDigits = p => (p || '').replace(/\D/g, '');
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '');
const hasContact = l => phoneDigits(l.phone).length >= 8 || validEmail(l.email);
const e164 = p => { let v = (p || '').replace(/[^\d+]/g, ''); if (!v) return ''; if (v.startsWith('00')) v = '+' + v.slice(2); if (!v.startsWith('+')) v = (v.length === 8 ? '+45' : '+') + v; return v; };

// ─── tid (Europe/Copenhagen, sommer/vintertid) ───
const tzFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function tzOffsetAt(ms) {
  const s = tzFmt.formatToParts(new Date(ms)).find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  const m = s.match(/([+-])(\d+)(?::(\d+))?/); if (!m) return 60;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}
// lokal vægur-tid i København -> epoch ms
function cphToUtc(y, mo, d, minOfDay) {
  const guess = Date.UTC(y, mo - 1, d, 0, minOfDay);
  let utc = guess - tzOffsetAt(guess) * 60000;
  const off2 = tzOffsetAt(utc);
  utc = guess - off2 * 60000;
  return utc;
}
const pad2 = n => String(n).padStart(2, '0');
// epoch ms -> "2026-10-26T09:00:00+01:00"
function isoCph(ms) {
  const off = tzOffsetAt(ms), l = new Date(ms + off * 60000), a = Math.abs(off);
  return `${l.getUTCFullYear()}-${pad2(l.getUTCMonth() + 1)}-${pad2(l.getUTCDate())}T${pad2(l.getUTCHours())}:${pad2(l.getUTCMinutes())}:00${off < 0 ? '-' : '+'}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
}
const ymdCph = ms => isoCph(ms).slice(0, 10);
const addDays = (ymd, n) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

// ─── Telegram ───
const tgEsc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function tgSend(env, text) {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {});
}
function leadText(title, l) {
  let ans = {}; try { ans = JSON.parse(l.answers_json || '{}'); } catch { }
  const lines = [`<b>${tgEsc(title)} · ${tgEsc(LEAD_PAGES[l.page] || l.page)}</b>`];
  if (l.name) lines.push('👤 ' + tgEsc(l.name));
  if (l.phone) lines.push('📞 ' + tgEsc(e164(l.phone) || l.phone));
  if (l.email) lines.push('✉️ ' + tgEsc(l.email));
  for (const [k, v] of Object.entries(ans)) if (v !== '' && v != null) lines.push(`• ${tgEsc(k)}: ${tgEsc(v)}`);
  if (l.booked_start) lines.push('📅 ' + tgEsc(new Date(l.booked_start).toLocaleString('da-DK', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })));
  let src = {}; try { src = JSON.parse(l.src_json || '{}'); } catch { }
  const s = [src.utm_source, src.utm_campaign, src.utm_content].filter(Boolean).join(' / ') || src.ref_host;
  if (s) lines.push('🔗 ' + tgEsc(s));
  if (SPLIT.includes(src.ver)) lines.push('🧪 Split-test: ' + src.ver);
  if (l.score) lines.push('🏷 Lead-score: ' + l.score);
  if (l.city || l.country) lines.push('📍 ' + tgEsc([l.city, l.country].filter(Boolean).join(', ')));
  lines.push('https://fuldtbooketmusiker.dk/admin');
  return lines.join('\n');
}
// sætter milepæl-flaget atomisk; true = første gang (så sendes beskeden)
async function claimFlag(env, id, flag) {
  const r = await env.DB.prepare(`UPDATE leads SET notified_flags = notified_flags || ? WHERE id = ? AND instr(notified_flags, ?) = 0`).bind(flag + ',', id, flag + ',').run();
  return (r.meta && r.meta.changes) === 1;
}

// ─── POST /api/lead ───
async function handleLead(request, env, ctx) {
  if (!env.DB) return json({ error: 'no db' }, 503);
  if (!sameOrigin(request)) return json({ error: 'bad origin' }, 403);
  const { b, err } = await readJSON(request); if (err) return err;
  if (BOT_UA.test(request.headers.get('User-Agent') || '')) return json({ ok: true });
  const lid = String(b.lid || '');
  if (!LID_RE.test(lid)) return json({ error: 'bad lid' }, 400);
  if (!LEAD_PAGES[b.page]) return json({ error: 'bad page' }, 400);
  const answers = {};
  if (b.answers && typeof b.answers === 'object' && !Array.isArray(b.answers)) {
    for (const [k, v] of Object.entries(b.answers).slice(0, 16)) answers[str(k, 40)] = str(v, k === 'om' ? 2000 : 500);
  }
  const src = b.src && typeof b.src === 'object' ? Object.fromEntries(['ref_host', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'landing', 'ver'].map(k => [k, str(b.src[k], k === 'landing' ? 300 : 150)]).filter(([, v]) => v)) : {};
  const cf = request.cf || {}, now = Date.now();
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const row = await env.DB.prepare(`INSERT INTO leads (id, page, created_ts, updated_ts, name, email, phone, answers_json, step, done, src_json, vid, sid, ip, city, country, writes, notified_flags)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,''
      -- misbrugs-værn i samme sætning (atomisk i D1): kendt lid opdateres frit, nyt lid kun hvis IP'en
      -- har oprettet færre end MAX_NEW_LEADS_PER_IP_HOUR leads den seneste time
      WHERE ?1 IN (SELECT id FROM leads WHERE id = ?1) OR ?14 = ''
         OR (SELECT COUNT(*) FROM leads INDEXED BY idx_leads_ip WHERE ip = ?14 AND created_ts > ?3 - 3600000) < ${MAX_NEW_LEADS_PER_IP_HOUR}
      ON CONFLICT(id) DO UPDATE SET
        updated_ts = excluded.updated_ts,
        name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE leads.name END,
        email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE leads.email END,
        phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE leads.phone END,
        answers_json = json_patch(leads.answers_json, excluded.answers_json),
        step = MAX(leads.step, excluded.step),
        done = MAX(leads.done, excluded.done),
        src_json = CASE WHEN leads.src_json = '{}' THEN excluded.src_json ELSE leads.src_json END,
        writes = leads.writes + 1
      WHERE leads.writes < ${MAX_LEAD_WRITES}
      RETURNING *`)
    .bind(lid, b.page, now, now, str(b.name, 120).trim(), str(b.email, 160).trim(), str(b.phone, 40).trim(), JSON.stringify(answers),
      num(b.step, 0, 50) ?? 0, b.done === true ? 1 : 0, JSON.stringify(src), str(b.vid, 40), str(b.sid, 40),
      ip, str(cf.city, 80), str(cf.country, 8))
    .first();
  if (!row) return json({ error: 'too many writes' }, 429); // for mange skrivninger på lid ELLER for mange nye leads fra IP'en
  ctx.waitUntil((async () => {
    // ansøgningen: oplysningerne efter bookingen (Instagram, hjemmeside, besætning) skrives på GHL-kontakten
    if (b.page === 'ansoegning' && b.extra === true && row.ghl_contact_id) await fbmContactExtra(env, row);
    if (!tgOn(env, b.page)) return;
    if (hasContact(row) && await claimFlag(env, lid, 'contact')) await tgSend(env, leadText('📝 Delvist lead', row));
    if (row.done && await claimFlag(env, lid, 'done')) await tgSend(env, leadText('✅ Formular udfyldt', row));
  })().catch(e => console.log('lead efterarbejde', String(e && e.message || e))));
  return json({ ok: true });
}

// ─── ledige tider ───
// ansøgningen viser tiderne fra den kvalificerede kalender til alle (begge kalendere er Oscars, så tiderne er de samme)
const ghlCalendarId = (env, page) => (page === 'ansoegning' ? env.GHL_CALENDAR_FBM_Q : page === 'firmafest' ? env.GHL_CALENDAR_FIRMAFEST : env.GHL_CALENDAR_BRYLLUP) || '';
const ghlOn = (env, page) => !!(env.GHL_TOKEN && env.GHL_LOCATION_ID && ghlCalendarId(env, page));
async function ghl(env, method, path, version, body) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(GHL_BASE + path, {
      method, signal: ctl.signal,
      // GHL's Cloudflare afviser kald uden User-Agent (fejl 1010)
      headers: { 'User-Agent': 'fuldtbooketmusiker.dk/1.0', Authorization: 'Bearer ' + env.GHL_TOKEN, Version: version, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`GHL ${method} ${path.split('?')[0]} ${r.status}: ${str(data.message || data.error || JSON.stringify(data), 200)}`);
    return data;
  } finally { clearTimeout(t); }
}
// varighed fra GHL-kalenderen (cache 1 time), ellers 30 min
async function ghlDuration(env, calId) {
  const cache = caches.default, key = new Request('https://cache.local/ghl-cal/' + calId);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return Number(await hit.text()) || 30;
  let min = 30;
  try {
    const c = (await ghl(env, 'GET', `/calendars/${calId}`, '2021-04-15')).calendar || {};
    const d = Number(c.slotDuration) || 30;
    min = /hour/i.test(c.slotDurationUnit || '') ? d * 60 : d;
  } catch { }
  await cache.put(key, new Response(String(min), { headers: { 'Cache-Control': 'max-age=3600' } })).catch(() => {});
  return min;
}
async function bookedStarts(env, fromMs, toMs) {
  const rows = await all(env.DB, `SELECT booked_start FROM leads WHERE booked_start >= ? AND booked_start < ?`, fromMs, toMs);
  return new Set(rows.map(r => r.booked_start));
}
function fallbackSlots(fromYmd, days, now) {
  const out = {};
  for (let i = 0; i < days; i++) {
    const ymd = addDays(fromYmd, i), [y, m, d] = ymd.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const list = [];
    for (let t = FALLBACK.startMin; t + FALLBACK.durationMin <= FALLBACK.endMin; t += FALLBACK.stepMin) {
      const ms = cphToUtc(y, m, d, t);
      if (ms >= now + FALLBACK.leadMs) list.push(ms);
    }
    if (list.length) out[ymd] = list;
  }
  return out;
}
// -> { source, durationMin, slots: { ymd: [ms,...] } }
async function computeSlots(env, page, fromYmd, days) {
  const now = Date.now();
  const [y, m, d] = fromYmd.split('-').map(Number);
  const fromMs = cphToUtc(y, m, d, 0), toYmd = addDays(fromYmd, days), [y2, m2, d2] = toYmd.split('-').map(Number);
  const toMs = cphToUtc(y2, m2, d2, 0);
  let res = null;
  if (ghlOn(env, page)) {
    try {
      const calId = ghlCalendarId(env, page);
      const [data, durationMin] = await Promise.all([
        ghl(env, 'GET', `/calendars/${calId}/free-slots?startDate=${fromMs}&endDate=${toMs - 1}&timezone=${encodeURIComponent(TZ)}`, '2021-04-15'),
        ghlDuration(env, calId),
      ]);
      const slots = {};
      for (const [k, v] of Object.entries(data)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || !Array.isArray(v.slots)) continue;
        for (const s of v.slots) { const ms = Date.parse(s); if (Number.isFinite(ms) && ms > now && ms >= fromMs && ms < toMs) (slots[ymdCph(ms)] ||= []).push(ms); }
      }
      res = { source: 'ghl', durationMin, slots };
    } catch (e) { res = null; console.log('ghl slots fejl', String(e && e.message || e)); }
  }
  if (!res) res = { source: 'fallback', durationMin: FALLBACK.durationMin, slots: fallbackSlots(fromYmd, days, now) };
  // D1 er sikkerhedsnettet: tider vi selv har booket, er optaget uanset kilde
  const taken = await bookedStarts(env, fromMs, toMs);
  for (const k of Object.keys(res.slots)) {
    res.slots[k] = res.slots[k].filter(ms => !taken.has(ms)).sort((a, b) => a - b);
    if (!res.slots[k].length) delete res.slots[k];
  }
  return res;
}
async function handleSlots(request, env, ctx, url) {
  if (!env.DB) return json({ error: 'no db' }, 503);
  const page = url.searchParams.get('page');
  if (!LEAD_PAGES[page]) return json({ error: 'bad page' }, 400);
  const today = ymdCph(Date.now());
  let from = url.searchParams.get('from') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || isNaN(Date.parse(from))) return json({ error: 'bad from' }, 400);
  if (from < today) from = today;
  if (from > addDays(today, 120)) return json({ error: 'from too far' }, 400);
  const days = Math.round(num(url.searchParams.get('days') || 14, 1, 31));
  const cache = caches.default, key = new Request(`${url.origin}/__slots-cache/${page}/${from}/${days}`);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return new Response(hit.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Cache': 'HIT' } });
  const r = await computeSlots(env, page, from, days);
  const slots = Object.fromEntries(Object.entries(r.slots).map(([k, v]) => [k, v.map(isoCph)]));
  const body = JSON.stringify({ tz: TZ, source: r.source, durationMin: r.durationMin, slots });
  ctx.waitUntil(cache.put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } })).catch(() => {}));
  return new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Cache': 'MISS' } });
}

// ─── POST /api/book ───
async function ghlBook(env, lead, startMs, endMs, fbm) {
  if (lead.page === 'ansoegning') return fbmGhlBook(env, lead, startMs, endMs, fbm);
  const calendarId = ghlCalendarId(env, lead.page), locationId = env.GHL_LOCATION_ID;
  let ver = ''; try { ver = JSON.parse(lead.src_json || '{}').ver || ''; } catch { }
  if (!SPLIT.includes(ver)) ver = '';   // split-test (/book): version på tag, titel og note, så GHL kan filtrere på den
  const parts = (lead.name || '').trim().split(/\s+/);
  const contact = { locationId, name: lead.name || undefined, firstName: parts[0] || undefined, lastName: parts.slice(1).join(' ') || undefined,
    email: validEmail(lead.email) ? lead.email : undefined, phone: e164(lead.phone) || undefined, tags: ['lp-' + lead.page, ...(ver ? [`lp-${lead.page}-${ver}`] : [])], source: 'fuldtbooketmusiker.dk/' + lead.page };
  Object.keys(contact).forEach(k => contact[k] === undefined && delete contact[k]);
  const c = await ghl(env, 'POST', '/contacts/upsert', '2021-07-28', contact);
  const contactId = c.contact && c.contact.id;
  if (!contactId) throw new Error('GHL upsert gav intet contact.id');
  const appt = await ghl(env, 'POST', '/calendars/events/appointments', '2021-04-15', {
    calendarId, locationId, contactId, startTime: isoCph(startMs), endTime: isoCph(endMs),
    title: `Samtale: ${LEAD_PAGES[lead.page]}${ver ? ' ' + ver : ''} · ${lead.name || lead.email || lead.phone}`, appointmentStatus: 'confirmed', toNotify: true,
  });
  const apptId = appt.id || (appt.appointment && appt.appointment.id) || '';
  // Google Meet-link: GHL lægger det i aftalens address (nogle gange først et øjeblik efter oprettelsen)
  const meetOf = a => { const u = String((a && (a.address || (a.appointment && a.appointment.address))) || ''); return MEET_RE.test(u) ? u : ''; };
  let meet = meetOf(appt);
  if (!meet && apptId) meet = meetOf(await ghl(env, 'GET', `/calendars/events/appointments/${apptId}`, '2021-04-15').catch(() => null));
  let ans = {}; try { ans = JSON.parse(lead.answers_json || '{}'); } catch { }
  const note = [`Fra fuldtbooketmusiker.dk/${lead.page} (${LEAD_PAGES[lead.page]})`, ...(ver ? [`Split-test: tekstversion ${ver}`] : []), ...Object.entries(ans).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n');
  await ghl(env, 'POST', `/contacts/${contactId}/notes`, '2021-07-28', { body: note }).catch(e => console.log('ghl note fejl', e.message));
  return { contactId, apptId, meet };
}
async function handleBook(request, env, ctx) {
  if (!env.DB) return json({ error: 'no db' }, 503);
  if (!sameOrigin(request)) return json({ error: 'bad origin' }, 403);
  const { b, err } = await readJSON(request, 2048); if (err) return err;
  const lid = String(b.lid || '');
  if (!LID_RE.test(lid)) return json({ error: 'bad lid' }, 400);
  const startMs = Date.parse(String(b.start || ''));
  if (!Number.isFinite(startMs)) return json({ error: 'bad start' }, 400);
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(lid).first();
  if (!lead) return json({ error: 'unknown lead' }, 404);
  if (!hasContact(lead)) return json({ error: 'missing contact' }, 400);
  // ansøgningen: scoren regnes her på serveren ud fra de gemte svar (aldrig fra browseren)
  let fbm = null;
  if (lead.page === 'ansoegning') {
    let ans = {}; try { ans = JSON.parse(lead.answers_json || '{}'); } catch { }
    const rules = await fbmRules(env);
    fbm = fbmScore(ans, rules);
    if (fbm.missing) return json({ error: 'missing answers' }, 400);
    if (fbm.knockout) return json({ error: 'not eligible' }, 403);
    fbm.qualified = fbmQualified(rules).includes(fbm.score);
    fbm.fbp = str(b.fbp, 120); fbm.fbc = str(b.fbc, 300);
  }
  if (lead.booked_start) {
    if (lead.booked_start === startMs) return json({ ok: true, start: isoCph(lead.booked_start), end: isoCph(lead.booked_end), source: lead.ghl_appt_id ? 'ghl' : 'fallback', already: true });
    return json({ error: 'already booked', start: isoCph(lead.booked_start) }, 409);
  }
  // misbrugs-værn: én IP kan ikke blokere kalenderen ved at booke alle tider
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (ip) {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM leads INDEXED BY idx_leads_booked_ip WHERE booked_ip = ? AND booked_start > ?').bind(ip, Date.now()).first();
    if (c && c.n >= MAX_BOOKINGS_PER_IP) return json({ error: 'too many bookings' }, 429);
  }
  const day = ymdCph(startMs);
  const s = await computeSlots(env, lead.page, day, 1);
  if (!(s.slots[day] || []).includes(startMs)) return json({ error: 'slot taken' }, 409);
  const endMs = startMs + s.durationMin * 60000;
  const claim = await env.DB.prepare(`UPDATE leads SET booked_start = ?1, booked_end = ?2, updated_ts = ?3, done = 1, booked_ip = ?5, score = ?6, booked_at = ?3
      WHERE id = ?4 AND booked_start IS NULL AND NOT EXISTS (SELECT 1 FROM leads o WHERE o.booked_start = ?1)
        AND (?5 = '' OR (SELECT COUNT(*) FROM leads o INDEXED BY idx_leads_booked_ip WHERE o.booked_ip = ?5 AND o.booked_start > ?3) < ${MAX_BOOKINGS_PER_IP})`)
    .bind(startMs, endMs, Date.now(), lid, ip, fbm ? fbm.score : null).run().catch(() => null); // unik index fanger samtidige bookinger
  if (!claim || (claim.meta && claim.meta.changes) !== 1) {
    const c = ip ? await env.DB.prepare('SELECT COUNT(*) AS n FROM leads INDEXED BY idx_leads_booked_ip WHERE booked_ip = ? AND booked_start > ?').bind(ip, Date.now()).first() : null;
    return c && c.n >= MAX_BOOKINGS_PER_IP ? json({ error: 'too many bookings' }, 429) : json({ error: 'slot taken' }, 409);
  }
  // GHL (kontakt + aftale + Google Meet) tager 4-6 sekunder. Ansøgningen svarer kunden med det samme, når tiden er
  // reserveret i D1 (unik index = ingen dobbeltbooking hos os), og laver GHL-delen bagefter. Gig-siderne venter som før.
  const ua = request.headers.get('User-Agent') || '';
  const pushGhl = async () => {
    let source = 'fallback', ghlErr = '';
    if (ghlOn(env, lead.page)) {
      try {
        const { contactId, apptId, meet, after } = await ghlBook(env, lead, startMs, endMs, fbm);
        await env.DB.prepare('UPDATE leads SET ghl_contact_id = ?, ghl_appt_id = ?, meet_url = ? WHERE id = ?').bind(contactId, apptId, meet || '', lid).run();
        if (after) ctx.waitUntil(after().catch(e => console.log('ghl efterarbejde', String(e && e.message || e))));
        // Instagram/tekst sendt fra tak-skærmen mens GHL arbejdede -> skrives på kontakten nu
        if (fbm) { const row = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(lid).first(); if (row) await fbmContactExtra(env, row).catch(() => {}); }
        source = 'ghl';
      } catch (e) { ghlErr = str(e && e.message || e, 300); }
    }
    return { source, ghlErr };
  };
  const followUp = async ({ ghlErr }) => {
    const booked = { ...lead, booked_start: startMs, booked_end: endMs, score: fbm ? fbm.score : null };
    // kun kvalificerede bookinger lærer Meta, hvem der er gode (samme event_id som pixel'en i browseren = ingen dobbelttælling)
    if (fbm && fbm.qualified && fbmLive(env)) await capiSend(env, { event_name: 'Schedule', event_id: 'fbm-' + lid, url: 'https://fuldtbooketmusiker.dk/',
      ip, ua, fbp: fbm.fbp, fbc: fbm.fbc, name: lead.name, em: lead.email, ph: lead.phone, content_name: 'Ansøgning kvalificeret' });
    // GHL-fejl meldes altid (også i forhåndsvisning): kunden har fået en bekræftelse, så aftalen skal oprettes manuelt
    if (ghlErr) { await tgSend(env, `⚠️ GHL fejlede: ${tgEsc(ghlErr)}\nBookingen er gemt i D1, opret den manuelt i GHL.\n\n` + leadText('📅 Booket', booked)); await claimFlag(env, lid, 'booked'); return; }
    if (!tgOn(env, lead.page)) return;
    if (await claimFlag(env, lid, 'booked')) await tgSend(env, leadText('📅 Booket', booked));
  };
  let source = ghlOn(env, lead.page) ? 'ghl' : 'fallback';
  if (fbm) ctx.waitUntil(pushGhl().then(followUp).catch(e => console.log('book efterarbejde', String(e && e.message || e))));
  else { const r = await pushGhl(); source = r.source; ctx.waitUntil(followUp(r).catch(e => console.log('book efterarbejde', String(e && e.message || e)))); }
  // cv = om annonce-konverteringen skal sendes fra browseren (kun kvalificerede ansøgninger; gig-siderne altid)
  return json({ ok: true, start: isoCph(startMs), end: isoCph(endMs), source, cv: fbm ? (fbm.qualified ? 1 : 0) : 1 });
}

// ───────── ansøgning: musikernes ansøgningsform på fuldtbooketmusiker.dk (4/11 2026) ─────────
// Ét spørgsmål ad gangen (som Typeform), svar gemmes løbende via /api/lead (page=ansoegning).
// Covermusik er et hårdt stop før kontaktinfo. Resten scores A/B/C her på serveren:
// Kvalificerede (valgt i admin, standard A/B) booker i "Strategisamtale", C i "Afklaringssamtale" (begge Oscars, neutrale navne kunden kan se).
// Kontakt + svar i GHL-felter + tags + pipeline-trin + note. Meta får kun Schedule for kvalificerede.
// Ingen SMS/mail herfra. FBM_FORM_LIVE != '1' = forhåndsvisning: ingen CAPI, ingen pixel, ingen Telegram.
const FBM_APP = {
  pipeline: 'YHh9YrfPgUjeimsRU3Vx',
  stageQ: 'ea77c8f2-e34b-49a8-a48e-1e8b39641669',    // "Møde Booket"
  stageC: 'c4371fb8-e3df-41f4-a096-a0ecc7d153c0',    // "Ikke kvalificeret"
  user: 'uHdnK0qAOcJCDq4ruP8Q',                      // Oscar (ejer begge kalendere)
  // svarmuligheder = præcis teksterne i GHL-felterne (SINGLE_OPTIONS skal matche)
  opts: {
    jobs: ['0–9', '10–29', '30–59', '60–99', '100+'],
    pris: ['Under 5.000 kr.', '5.000–9.999 kr.', '10.000–19.999 kr.', '20.000+ kr.'],
    pris_maal: ['Under 10.000 kr.', '10.000–14.999 kr.', '15.000–24.999 kr.', '25.000+ kr.'],
    jobs_maal: ['Under 50', '50–99', '100+'],
    x3: ['Ja', 'Nej'],
    cover: ['Covermusik', 'Både covermusik og eget materiale', 'Kun mit eget materiale'],
    oms: ['Under 10.000 kr.', '10.000–24.999 kr.', '25.000–49.999 kr.', '50.000–99.999 kr.', '100.000+ kr.'],
    invest: ['0–5.000 kr.', '5.000–10.000 kr.', '10.000–20.000 kr.', '20.000–50.000 kr.', '50.000–100.000 kr.'],   // "Hvor meget er du villig til at investere om måneden for at nå dit mål?"
  },
  // GHL custom field-id'er (contact). "Ansøgning: ..." er oprettet via API 4/11, resten fandtes i Oscars form
  fields: {
    jobs: 'TcJck5nWRgQPltUoGeLM', pris: 'fmgHuyzDBeUNKJgFbBEy', pris_maal: 'o6JaCOAikJSOPutRtvPB', jobs_maal: 'l9cVQ4UN5pCo9c9bW3Ad',
    x3: 'va1DK3ylzbKraxYM5NWw', cover: 'uKlnPLVJdFcLRa4Gelkq', oms: '1XQHbzMq4S4TAlQp7jaq', invest: '1wN51tKtPYi610zIdM6M', om: 'uSGmRwuiNilDOJ6pbSvN',
    score: 'jSPa8jm8m0FX1A643NwL', reason: '9Obpz6pkJFoDrTmfpuJG',
    instagram: 'yPp3j9zZMHmE7BJfkpS8', hjemmeside: 'q2oceZxi4pvomJ3xvKpk', optraeder: 'VrPxlYPCOW4Xw0wwlhtL',
    utm_source: 'sDG3v7y2wkZeum3eBDTv', utm_medium: 'A5Jqj9BQwv4hSuKJU3Ob', utm_campaign: 'VVmGBZbPjFKMsAYs1yof', utm_content: 'GjM7mpL0t4S0IFtV5HzH', event_id: 'EZdwrewrRSIHeCOsy1UW',
  },
  optraeder: ['Solo', 'Duo', 'Trio / band'],
  labels: { jobs: 'Betalte jobs seneste år', pris: 'Pris pr. job i dag', pris_maal: 'Ønsket pris pr. job', jobs_maal: 'Ønskede jobs om året',
    x3: 'Åben for 2–3x pris', cover: 'Covermusik/eget', oms: 'Omsætning pr. md.', invest: 'Vil investere pr. md.' },
};
const fbmLive = env => env.FBM_FORM_LIVE === '1';
const tgOn = (env, page) => page !== 'ansoegning' || fbmLive(env);

// ─── regler (styres fra /admin -> fanen Ansøgningsform, gemmes i D1 kv 'fbm_rules') ───
// Hvert svar har et niveau: ok | B | C | stop. Kombinationsregler: "hvis X og Y, så B/C".
// Score: stop (formen stopper, kan ikke booke) > C > B > A. Kvalificerede scorer vælges også i admin.
// Standard = udgangspunktet fra kaldet 4/11: dem Oscar har lukket spiller 30-100 jobs; 10-20 jobs har ikke pengene.
const FBM_LEVELS = ['ok', 'B', 'C', 'stop'];
const FBM_Q = ['jobs', 'pris', 'pris_maal', 'jobs_maal', 'x3', 'cover', 'oms', 'invest'];
const FBM_DEFAULT_RULES = {
  answers: {
    jobs: { '0–9': 'C', '10–29': 'B' }, pris: { 'Under 5.000 kr.': 'B' }, x3: { 'Nej': 'B' },
    cover: { 'Kun mit eget materiale': 'stop' }, invest: { '0–5.000 kr.': 'C', '5.000–10.000 kr.': 'B' },
  },
  combos: [
    { if: [{ q: 'jobs', a: '10–29' }, { q: 'pris', a: 'Under 5.000 kr.' }], then: 'C' },
    { if: [{ q: 'jobs', a: '10–29' }, { q: 'pris', a: '5.000–9.999 kr.' }], then: 'C' },
    { if: [{ q: 'jobs', a: '10–29' }, { q: 'oms', a: 'Under 10.000 kr.' }], then: 'C' },
  ],
  qualified: ['A', 'B'],
};
// renser regler fra admin/D1: kun kendte spørgsmål, svar og niveauer
function fbmCleanRules(r) {
  const O = FBM_APP.opts, out = { answers: {}, combos: [], qualified: [] };
  const src = r && typeof r === 'object' ? r : {};
  for (const q of FBM_Q) for (const a of O[q]) {
    const lv = src.answers && src.answers[q] && src.answers[q][a];
    if (FBM_LEVELS.includes(lv) && lv !== 'ok') (out.answers[q] ||= {})[a] = lv;
  }
  for (const c of (Array.isArray(src.combos) ? src.combos : []).slice(0, 20)) {
    const conds = (Array.isArray(c && c.if) ? c.if : []).filter(x => x && FBM_Q.includes(x.q) && O[x.q].includes(x.a)).slice(0, 3);
    if (conds.length >= 2 && new Set(conds.map(x => x.q)).size === conds.length && ['B', 'C'].includes(c.then)) out.combos.push({ if: conds.map(x => ({ q: x.q, a: x.a })), then: c.then });
  }
  out.qualified = ['A', 'B', 'C'].filter(x => Array.isArray(src.qualified) && src.qualified.includes(x));
  if (!out.qualified.length) out.qualified = ['A'];
  return out;
}
async function fbmRules(env) {
  if (!env.DB) return FBM_DEFAULT_RULES;
  const r = await kvGet(env.DB, 'fbm_rules', null).catch(() => null);
  return r ? fbmCleanRules(r) : FBM_DEFAULT_RULES;
}
const fbmQualified = rules => (rules && rules.qualified) || ['A', 'B'];
// -> { score: 'A'|'B'|'C', reason } | { knockout } | { missing }   (samme regel-motor som i admin.html, simuleringen)
function fbmScore(a, rules) {
  const O = FBM_APP.opts, R = rules || FBM_DEFAULT_RULES, L = FBM_APP.labels;
  const lv = q => (R.answers[q] && R.answers[q][a[q]]) || 'ok';
  if (FBM_Q.some(q => a[q] && lv(q) === 'stop')) return { knockout: true };
  if (FBM_Q.some(q => !O[q].includes(a[q]))) return { missing: true };
  const why = { B: [], C: [] };
  for (const q of FBM_Q) { const l = lv(q); if (l === 'B' || l === 'C') why[l].push(`${L[q]}: ${a[q]}`); }
  for (const c of R.combos) if (c.if.every(x => a[x.q] === x.a)) why[c.then].push(c.if.map(x => `${L[x.q]}: ${x.a}`).join(' + '));
  if (why.C.length) return { score: 'C', reason: 'C: ' + why.C.join('; ') };
  if (why.B.length) return { score: 'B', reason: 'B: ' + why.B.join('; ') };
  return { score: 'A', reason: 'A: ingen svar trækker ned' };
}
const fbmFieldList = (pairs) => pairs.filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => ({ id: FBM_APP.fields[k], field_value: v }));
const fbmOptraeder = v => String(v || '').split(', ').filter(x => FBM_APP.optraeder.includes(x));

async function fbmGhlBook(env, lead, startMs, endMs, fbm) {
  const locationId = env.GHL_LOCATION_ID, F = FBM_APP;
  const calendarId = fbm.qualified ? env.GHL_CALENDAR_FBM_Q : env.GHL_CALENDAR_FBM_U;
  if (!calendarId) throw new Error('kalender-id mangler (GHL_CALENDAR_FBM_Q/U)');
  let ans = {}, src = {}; try { ans = JSON.parse(lead.answers_json || '{}'); } catch { } try { src = JSON.parse(lead.src_json || '{}'); } catch { }
  const parts = (lead.name || '').trim().split(/\s+/);
  const customFields = fbmFieldList([
    ...Object.keys(F.opts).map(k => [k, F.opts[k].includes(ans[k]) ? ans[k] : '']),
    ['score', fbm.score], ['reason', fbm.reason],
    ['instagram', str(ans.instagram, 200)], ['hjemmeside', str(ans.hjemmeside, 200)], ['optraeder', fbmOptraeder(ans.optraeder)], ['om', str(ans.om, 2000)],
    ['utm_source', src.utm_source], ['utm_medium', src.utm_medium], ['utm_campaign', src.utm_campaign], ['utm_content', src.utm_content], ['event_id', 'fbm-' + lead.id],
  ]);
  const contact = { locationId, name: lead.name || undefined, firstName: parts[0] || undefined, lastName: parts.slice(1).join(' ') || undefined,
    email: validEmail(lead.email) ? lead.email : undefined, phone: e164(lead.phone) || undefined,
    tags: ['fbm-ansoegning', 'fbm-score-' + fbm.score.toLowerCase(), fbm.qualified ? 'fbm-kvalificeret' : 'fbm-ikke-kvalificeret'],
    source: 'fuldtbooketmusiker.dk/ansoegning', customFields };
  Object.keys(contact).forEach(k => contact[k] === undefined && delete contact[k]);
  const c = await ghl(env, 'POST', '/contacts/upsert', '2021-07-28', contact);
  const contactId = c.contact && c.contact.id;
  if (!contactId) throw new Error('GHL upsert gav intet contact.id');
  // titlen kan kunden se i invitationen: ingen score i den
  const appt = await ghl(env, 'POST', '/calendars/events/appointments', '2021-04-15', {
    calendarId, locationId, contactId, assignedUserId: F.user, startTime: isoCph(startMs), endTime: isoCph(endMs),
    title: `Strategisamtale · ${lead.name || lead.email || lead.phone}`, appointmentStatus: 'confirmed', toNotify: true,
  });
  const apptId = appt.id || (appt.appointment && appt.appointment.id) || '';
  const meetOf = a => { const u = String((a && (a.address || (a.appointment && a.appointment.address))) || ''); return MEET_RE.test(u) ? u : ''; };
  // note, pipeline og Meet-link efter svaret til kunden (sparer et par sekunder på "Booker...")
  const after = async () => {
    const extra = [['Instagram', ans.instagram], ['Hjemmeside', ans.hjemmeside], ['Optræder', ans.optraeder], ['Om mig og hvorfor', ans.om]].filter(([, v]) => v);
    const note = [`Ansøgning fra fuldtbooketmusiker.dk · Lead-score ${fbm.score} (${fbm.qualified ? 'kvalificeret' : 'IKKE kvalificeret'})`, fbm.reason, '',
      ...Object.keys(F.labels).filter(k => ans[k]).map(k => `${F.labels[k]}: ${ans[k]}`), ...extra.map(([k, v]) => `${k}: ${v}`),
      ...([src.utm_source, src.utm_campaign, src.utm_content].some(Boolean) ? ['', 'Kilde: ' + [src.utm_source, src.utm_campaign, src.utm_content].filter(Boolean).join(' / ')] : [])].join('\n');
    await Promise.all([
      ghl(env, 'POST', `/contacts/${contactId}/notes`, '2021-07-28', { body: note }).catch(e => console.log('ghl note fejl', e.message)),
      ghl(env, 'POST', '/opportunities/upsert', '2021-07-28', {
        pipelineId: F.pipeline, locationId, contactId, name: lead.name || lead.email || 'Ansøgning', status: 'open',
        pipelineStageId: fbm.qualified ? F.stageQ : F.stageC, source: 'Fuldtbooketmusiker.dk',
      }).catch(e => console.log('ghl opportunity fejl', e.message)),
      (async () => {
        let meet = meetOf(appt);
        if (!meet && apptId) meet = meetOf(await ghl(env, 'GET', `/calendars/events/appointments/${apptId}`, '2021-04-15').catch(() => null));
        if (meet) await env.DB.prepare('UPDATE leads SET meet_url = ? WHERE id = ?').bind(meet, lead.id).run();
      })().catch(() => {}),
    ]);
  };
  return { contactId, apptId, meet: meetOf(appt), after };
}
// Instagram/hjemmeside/besætning fra tak-skærmen -> GHL-kontakten (+ note, så Oscar ser det ved mødet)
async function fbmContactExtra(env, row) {
  if (!env.GHL_TOKEN) return;
  let ans = {}; try { ans = JSON.parse(row.answers_json || '{}'); } catch { }
  const customFields = fbmFieldList([['instagram', str(ans.instagram, 200)], ['hjemmeside', str(ans.hjemmeside, 200)], ['optraeder', fbmOptraeder(ans.optraeder)], ['om', str(ans.om, 2000)]]);
  if (!customFields.length) return;
  if (!(await claimFlag(env, row.id, 'extra'))) return;   // én gang pr. lead (formularen sender kun ved tryk på knappen)
  await ghl(env, 'PUT', `/contacts/${row.ghl_contact_id}`, '2021-07-28', { customFields });
  const body = ['Efter booking:', ...[['Instagram', ans.instagram], ['Hjemmeside', ans.hjemmeside], ['Optræder', ans.optraeder]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ...(ans.om ? ['', 'Om mig og hvorfor:', ans.om] : [])].join('\n');
  await ghl(env, 'POST', `/contacts/${row.ghl_contact_id}/notes`, '2021-07-28', { body }).catch(() => {});
}
// Meta CAPI fra serveren (samme felter som /api/conv)
async function capiSend(env, e) {
  if (!env.META_CAPI_TOKEN || !env.META_PIXEL_ID) return;
  const parts = (e.name || '').trim().split(/\s+/);
  const user_data = { client_ip_address: e.ip || undefined, client_user_agent: e.ua || undefined, fbp: e.fbp || undefined, fbc: e.fbc || undefined,
    fn: await hashed(parts[0]), ln: await hashed(parts.slice(1).join(' ')), em: await hashed(e.em), ph: await hashedPhone(e.ph), country: [await sha256('dk')] };
  Object.keys(user_data).forEach(k => user_data[k] === undefined && delete user_data[k]);
  const payload = { data: [{ event_name: e.event_name, event_time: Math.floor(Date.now() / 1000), event_id: e.event_id, event_source_url: e.url, action_source: 'website', user_data,
    custom_data: { content_name: e.content_name || 'Samtale booket', content_category: 'booking' } }] };
  const r = await fetch(`https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) console.log('capi fejl', r.status, str(await r.text().catch(() => ''), 300));
}

// ─── SMS 15 min efter booking (kun live) ───
// Har ansøgeren ikke udfyldt Instagram/hjemmeside/tekst efter bookingen, sender GHL (Oscars nummer) en SMS og beder om
// et link til deres Instagram. Svaret læses i GHL-samtalen og lægges automatisk på kontakten (Instagram/hjemmeside + note).
// Tekst og til/fra styres i /admin -> Ansøgningsform (D1 kv 'fbm_sms'). {fornavn} og {tid} udfyldes.
const FBM_SMS_DEFAULT = { on: true, text: 'Hej {fornavn}! Vi fik ikke lige din Instagram eller hjemmeside med. Kan du sende den her? Så kigger Oscar på den inden jeres snak. Mvh. Oscar' };
const FBM_SMS_AFTER = 15 * 60000;
async function fbmSmsCfg(env) {
  const c = await kvGet(env.DB, 'fbm_sms', null).catch(() => null);
  return { on: c ? c.on !== false : FBM_SMS_DEFAULT.on, text: (c && typeof c.text === 'string' && c.text.trim()) ? c.text.slice(0, 600) : FBM_SMS_DEFAULT.text };
}
const fbmFirst = n => (n || '').trim().split(/\s+/)[0] || '';
const fbmWhen = ms => new Date(ms).toLocaleDateString('da-DK', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }) + ' kl. ' +
  new Date(ms).toLocaleTimeString('da-DK', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).replace('.', ':');   // "lørdag 7. november kl. 07:00"
const fbmSmsText = (tpl, lead) => tpl.replace(/\{fornavn\}/g, fbmFirst(lead.name)).replace(/\{tid\}/g, fbmWhen(lead.booked_start)).replace(/Hej !/, 'Hej!').replace(/\s+/g, ' ').trim();
const fbmHasExtra = a => !!(a.instagram || a.hjemmeside || a.om);
// svaret -> { instagram, hjemmeside }
function fbmParseReply(t) {
  t = String(t || '').trim();
  const out = {};
  const ig = t.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || t.match(/(?:^|\s)@([A-Za-z0-9._]{2,30})\b/);
  if (ig) out.instagram = '@' + ig[1].replace(/\.$/, '');
  const url = [...t.matchAll(/(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(?:dk|com|se|no|net|org|eu|io|band|music|nu|info)(?:\/[^\s]*)?)/gi)]
    .map(m => m[0]).find(u => !/instagram\.com/i.test(u));
  if (url) out.hjemmeside = url.replace(/[.,!)]+$/, '');
  if (!out.instagram && !out.hjemmeside && /^@?[A-Za-z0-9._]{2,30}$/.test(t)) out.instagram = '@' + t.replace(/^@/, '');
  return out;
}
async function fbmSmsJob(env) {
  if (!env.DB || !env.GHL_TOKEN) return { skipped: true };
  const cfg = await fbmSmsCfg(env), now = Date.now(), res = { sent: 0, replies: 0 };
  // 1) send (kun når formen er live)
  if (cfg.on && fbmLive(env)) {
    const due = await all(env.DB, `SELECT * FROM leads WHERE page = 'ansoegning' AND booked_at IS NOT NULL AND booked_at <= ? AND booked_at >= ?
        AND booked_start > ? AND ghl_contact_id IS NOT NULL AND phone <> '' AND instr(notified_flags, 'sms15,') = 0 ORDER BY booked_at LIMIT 5`, now - FBM_SMS_AFTER, now - 86400000, now);
    for (const l of due) {
      let a = {}; try { a = JSON.parse(l.answers_json || '{}'); } catch { }
      if (!(await claimFlag(env, l.id, 'sms15'))) continue;                // én gang pr. lead, også hvis noget fejler
      if (fbmHasExtra(a)) continue;                                        // har allerede udfyldt -> ingen SMS
      try {
        await ghl(env, 'POST', '/conversations/messages', '2021-04-15', { type: 'SMS', contactId: l.ghl_contact_id, message: fbmSmsText(cfg.text, l) });
        await env.DB.prepare(`UPDATE leads SET answers_json = json_set(answers_json, '$._sms_at', ?) WHERE id = ?`).bind(now, l.id).run();
        res.sent++;
      } catch (e) {
        console.log('fbm sms fejl', l.id, String(e && e.message || e));
        // prøv igen ved næste kørsel (højst i 2 timer efter bookingen)
        if (now - l.booked_at < 2 * 3600000) await env.DB.prepare(`UPDATE leads SET notified_flags = replace(notified_flags, 'sms15,', '') WHERE id = ?`).bind(l.id).run();
      }
    }
  }
  // 2) læs svar (op til 3 døgn efter SMS'en)
  const wait = await all(env.DB, `SELECT * FROM leads WHERE page = 'ansoegning' AND json_extract(answers_json, '$._sms_at') > ?
      AND instr(notified_flags, 'smsreply,') = 0 ORDER BY updated_ts DESC LIMIT 8`, now - 3 * 86400000);
  for (const l of wait) {
    let a = {}; try { a = JSON.parse(l.answers_json || '{}'); } catch { }
    const conv = ((await ghl(env, 'GET', `/conversations/search?locationId=${env.GHL_LOCATION_ID}&contactId=${l.ghl_contact_id}`, '2021-04-15').catch(() => ({}))).conversations || [])[0];
    if (!conv) continue;
    const d = await ghl(env, 'GET', `/conversations/${conv.id}/messages?limit=20`, '2021-04-15').catch(() => ({}));
    const msgs = Array.isArray(d.messages) ? d.messages : (d.messages && d.messages.messages) || [];
    const reply = msgs.filter(m => m.direction === 'inbound' && m.messageType === 'TYPE_SMS' && Date.parse(m.dateAdded) > a._sms_at && String(m.body || '').trim())
      .sort((x, y) => Date.parse(x.dateAdded) - Date.parse(y.dateAdded))[0];
    if (!reply || !(await claimFlag(env, l.id, 'smsreply'))) continue;
    const body = str(reply.body, 1000), got = fbmParseReply(body);
    const add = { sms_svar: body, ...(!a.instagram && got.instagram ? { instagram: got.instagram } : {}), ...(!a.hjemmeside && got.hjemmeside ? { hjemmeside: got.hjemmeside } : {}) };
    await env.DB.prepare('UPDATE leads SET answers_json = json_patch(answers_json, ?), updated_ts = ? WHERE id = ?').bind(JSON.stringify(add), now, l.id).run();
    const customFields = fbmFieldList([['instagram', add.instagram], ['hjemmeside', add.hjemmeside]]);
    if (customFields.length) await ghl(env, 'PUT', `/contacts/${l.ghl_contact_id}`, '2021-07-28', { customFields }).catch(e => console.log('fbm sms felt', e.message));
    await ghl(env, 'POST', `/contacts/${l.ghl_contact_id}/notes`, '2021-07-28', { body: ['SMS-svar efter booking:', body, ...(add.instagram ? ['', 'Instagram: ' + add.instagram] : []), ...(add.hjemmeside ? ['Hjemmeside: ' + add.hjemmeside] : [])].join('\n') }).catch(() => {});
    res.replies++;
  }
  return res;
}

// Test-SMS fra admin: samme tekst som rigtige ansøgere får (med en tid om 2 dage). Svaret læses af fbmSmsJob som normalt.
// Findes nummeret allerede i GHL, bruges den kontakt uændret; ellers oprettes en testkontakt.
async function fbmSmsTest(env, phoneIn) {
  const phone = e164(phoneIn);
  if (phoneDigits(phone).length < 10) return { ok: false, error: 'Ugyldigt nummer' };
  const L = env.GHL_LOCATION_ID, cfg = await fbmSmsCfg(env), now = Date.now();
  const found = ((await ghl(env, 'GET', `/contacts/?locationId=${L}&query=${encodeURIComponent(phone)}`, '2021-07-28')).contacts || [])
    .find(c => phoneDigits(c.phone).endsWith(phoneDigits(phone).slice(-8)));
  const contactId = found ? found.id : ((await ghl(env, 'POST', '/contacts/', '2021-07-28', { locationId: L, firstName: 'Test', lastName: 'SMS ansøgningsform', phone, tags: ['fbm-sms-test'] })).contact || {}).id;
  if (!contactId) return { ok: false, error: 'Kunne ikke finde/oprette kontakt i GHL' };
  const d = new Date(now + 2 * 86400000), [y, m, dd] = ymdCph(d.getTime()).split('-').map(Number);
  const message = fbmSmsText(cfg.text, { name: (found && found.firstName) || 'Test', booked_start: cphToUtc(y, m, dd, 14 * 60) });
  await ghl(env, 'POST', '/conversations/messages', '2021-04-15', { type: 'SMS', contactId, message });
  const id = 'smstest-' + crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO leads (id, page, created_ts, updated_ts, name, email, phone, answers_json, step, done, ghl_contact_id, notified_flags, writes)
    VALUES (?, 'ansoegning', ?, ?, 'TEST SMS', 'sms-test', ?, ?, 0, 0, ?, 'sms15,', 1)`).bind(id, now, now, phone, JSON.stringify({ _sms_at: now, _test: 1 }), contactId).run();
  return { ok: true, message, contactId, existing: !!found };
}

// ─── /admin/api/form: regler + spørgsmål + ansøgninger (til simulering i admin) ───
async function fbmFormAdmin(env, url) {
  const { from } = rangeOf(url);
  const saved = await kvGet(env.DB, 'fbm_rules', null).catch(() => null);
  const rows = await all(env.DB, `SELECT id, created_ts, updated_ts, name, email, phone, answers_json, step, booked_start, booked_at, score, ghl_contact_id, ghl_appt_id, notified_flags
    FROM leads WHERE page = 'ansoegning' AND created_ts >= ? ORDER BY updated_ts DESC LIMIT 500`, from);
  return {
    rules: saved ? fbmCleanRules(saved) : FBM_DEFAULT_RULES, defaults: FBM_DEFAULT_RULES, custom: !!saved, updated: saved && saved.updated || null,
    sms: { ...(await fbmSmsCfg(env)), defaultText: FBM_SMS_DEFAULT.text, afterMin: FBM_SMS_AFTER / 60000 },
    questions: FBM_Q.map(q => ({ id: q, label: FBM_APP.labels[q], opts: FBM_APP.opts[q] })), live: fbmLive(env),
    rows: rows.map(({ answers_json, ...r }) => { let answers = {}; try { answers = JSON.parse(answers_json || '{}'); } catch { } return { ...r, answers }; }),
  };
}
async function fbmFormSave(request, env) {
  const { b, err } = await readJSON(request, 16384); if (err) return err;
  await salesTables(env.DB);   // opretter kv-tabellen hvis den mangler
  if (b.smsTest) return json(await fbmSmsTest(env, str(b.smsTest, 30)).catch(e => ({ ok: false, error: str(e && e.message || e, 200) })));
  if (b.sms && typeof b.sms === 'object') {
    const text = str(b.sms.text, 600).trim();
    await kvPut(env.DB, 'fbm_sms', { on: b.sms.on !== false, text: text || FBM_SMS_DEFAULT.text, updated: Date.now() });
    return json({ ok: true, sms: await fbmSmsCfg(env) });
  }
  if (b.reset === true) { await env.DB.prepare('DELETE FROM kv WHERE k = ?').bind('fbm_rules').run(); return json({ ok: true, rules: FBM_DEFAULT_RULES }); }
  const clean = fbmCleanRules(b.rules);
  const prev = await kvGet(env.DB, 'fbm_rules', null).catch(() => null);
  if (prev) await kvPut(env.DB, 'fbm_rules_prev', prev);   // én fortryd-version
  await kvPut(env.DB, 'fbm_rules', { ...clean, updated: Date.now() });
  return json({ ok: true, rules: clean });
}

// ─── /admin/api/leads ───
async function leadsJSON(env, url) {
  const { from } = rangeOf(url);
  const rows = await all(env.DB, `SELECT id, page, created_ts, updated_ts, name, email, phone, answers_json, step, done, booked_start, booked_end,
      ghl_contact_id, ghl_appt_id, src_json, ip, city, country, notified_flags FROM leads WHERE updated_ts >= ? ORDER BY updated_ts DESC LIMIT 300`, from);
  const funnel = await all(env.DB, `SELECT page, COUNT(*) AS started, SUM(instr(notified_flags, 'contact,') > 0) AS contact, SUM(done) AS done,
      SUM(booked_start IS NOT NULL) AS booked FROM leads WHERE created_ts >= ? GROUP BY page`, from);
  // split-test: besøgende pr. version (unikke vid) + leads efter den version, formularen blev startet på
  const splitPaths = Object.values(OSCAR_HOSTS).flatMap(g => SPLIT.map(v => `/${g}/${v}`));
  const splitVisits = await all(env.DB, `SELECT path, COUNT(DISTINCT vid) AS visitors FROM events WHERE type='pageview' AND ts >= ?
      AND path IN (${splitPaths.map(() => '?').join(',')}) GROUP BY path`, from, ...splitPaths);
  const splitLeads = await all(env.DB, `SELECT page, json_extract(src_json, '$.ver') AS ver, COUNT(*) AS started, SUM(instr(notified_flags, 'contact,') > 0) AS contact,
      SUM(done) AS done, SUM(booked_start IS NOT NULL) AS booked FROM leads WHERE created_ts >= ? AND json_extract(src_json, '$.ver') IS NOT NULL GROUP BY page, ver`, from);
  const split = Object.values(OSCAR_HOSTS).map(g => ({ page: g, vers: SPLIT.map(v => {
    const l = splitLeads.find(x => x.page === g && x.ver === v) || {};
    return { ver: v, visitors: (splitVisits.find(x => x.path === `/${g}/${v}`) || {}).visitors || 0,
      started: l.started || 0, contact: l.contact || 0, done: l.done || 0, booked: l.booked || 0 };
  }) }));
  // ansøgningsformen: hvor mange nåede hvert spørgsmål, hvor mange stoppede, scorer (efter de gemte regler)
  const rules = await fbmRules(env);
  const appRows = await all(env.DB, `SELECT answers_json, email, phone, booked_start, score FROM leads WHERE page = 'ansoegning' AND created_ts >= ?`, from);
  const app = { started: appRows.length, contact: 0, booked: 0, stopped: 0, a: 0, b: 0, c: 0, extra: 0, ...Object.fromEntries(FBM_Q.map(q => [q, 0])) };
  for (const r of appRows) {
    let ans = {}; try { ans = JSON.parse(r.answers_json || '{}'); } catch { }
    for (const q of FBM_Q) if (ans[q]) app[q]++;
    if (r.email || r.phone) app.contact++;
    if (fbmScore(ans, rules).knockout) app.stopped++;
    if (ans.instagram || ans.hjemmeside || ans.om) app.extra++;
    if (r.booked_start) { app.booked++; if (r.score === 'A') app.a++; else if (r.score === 'B') app.b++; else if (r.score === 'C') app.c++; }
  }
  return {
    funnel, split, ansoegning: { ...app, qualified: fbmQualified(rules), live: fbmLive(env) },
    rows: rows.map(r => {
      let answers = {}, src = {}; try { answers = JSON.parse(r.answers_json || '{}'); } catch { } try { src = JSON.parse(r.src_json || '{}'); } catch { }
      const { answers_json, src_json, ...rest } = r;
      return { ...rest, answers, src, contact: r.notified_flags.includes('contact,') ? 1 : 0 };
    }),
  };
}

// ───────── salg: GHL-pipelinen "fuldt booket musiker" (22/10 2026) ─────────
// Charlies salgstal (møder, brochure, opkald, closing, CAC/AOV/ROAS) regnes ud fra Oscars GHL.
// Cron (hvert 10. min) henter pipeline + kalendere + samtaler og gemmer et let øjebliksbillede i D1 `kv`;
// dashboardet læser kun D1. Gratis Worker = højst 50 udgående kald pr. kørsel, så samtaler hentes i bidder.
// Annoncekroner: ingen Meta-adgang endnu, så forbrug = kr. pr. booket møde (indstilling, standard 100 kr).
// Lukket på kald/DM + kontant indbetalt skrives ind pr. kunde i dashboardet (`sales_deal`), GHL har ingen betalinger.
const FBM = {
  pipeline: 'YHh9YrfPgUjeimsRU3Vx',                        // "fuldt booket musiker"
  calendars: ['fI7JGGwe6o7PqtOEECqc', 'ie1qAG2yhrzV4greL3Ma', '0vw3bys1juCaQmANeSK4'], // Discovery Call + 2 Kald + Strategisamtale (ansøgningsformen, kvalificerede)
  since: Date.UTC(2026, 8, 20),                            // pipelinen startede 24/9
  maxCalls: 42,                                            // GHL-kald pr. kørsel (gratis-grænse 50 inkl. alt andet)
};
// Brochuren = mailen efter mødet ("Tak for et godt møde – her er præsentationen") med link til tilbuddet
const BROCHURE_RE = /præsentation/i;
const TEST_RE = /\btest\b|oscarstest/i;
const OFFER_STAGES = new Set(['Venter på', '2 kald', 'Forhandling', 'Lukket']);
const LOST_STAGES = new Set(['Tabt', 'Ikke kvalificeret']);
const MSG_TYPES = { TYPE_SMS: 'sms', TYPE_EMAIL: 'mail', TYPE_CALL: 'call', TYPE_FACEBOOK: 'dm', TYPE_INSTAGRAM: 'dm', TYPE_WHATSAPP: 'dm', TYPE_LIVE_CHAT: 'dm', TYPE_GMB: 'dm' };

const kvGet = async (db, k, dflt) => { const r = await db.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first().catch(() => null); try { return r ? JSON.parse(r.v) : dflt; } catch { return dflt; } };
const kvPut = (db, k, v) => db.prepare('INSERT INTO kv (k, v, ts) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ts = excluded.ts').bind(k, JSON.stringify(v), Date.now()).run();
async function salesTables(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, ts INTEGER NOT NULL)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS sales_deal (opp_id TEXT PRIMARY KEY, via TEXT NOT NULL DEFAULT '', cash INTEGER, updated_ts INTEGER NOT NULL)`),
  ]);
}

// Én kørsel: pipeline, aftaler, ændrede samtaler (i bidder) og åbnings-status på brochurer
async function salesSync(env) {
  if (!env.GHL_TOKEN || !env.GHL_LOCATION_ID || !env.DB) return { error: 'GHL ikke sat op' };
  const db = env.DB, L = env.GHL_LOCATION_ID, start = Date.now();
  let calls = 0;
  const call = (path, v = '2021-07-28') => { calls++; return ghl(env, 'GET', path, v); };
  const left = () => FBM.maxCalls - calls;
  await salesTables(db);
  const core = await kvGet(db, 'sales_core', {}), conv = await kvGet(db, 'sales_conv', {});

  const pipe = ((await call(`/opportunities/pipelines?locationId=${L}`)).pipelines || []).find(p => p.id === FBM.pipeline);
  if (!pipe) return { error: 'Pipelinen "fuldt booket musiker" findes ikke længere i GHL' };
  const stages = pipe.stages.map(s => ({ id: s.id, name: String(s.name || '').trim() }));

  const opps = [];
  for (let after = '', guard = 0; guard < 10; guard++) {
    const d = await call(`/opportunities/search?location_id=${L}&pipeline_id=${FBM.pipeline}&limit=100${after}`);
    const b = d.opportunities || [];
    for (const o of b) {
      const a = (o.attributions || []).find(x => x.isFirst) || (o.attributions || [])[0] || {};
      opps.push({ id: o.id, cid: o.contactId, name: str(o.name || o.contact?.name, 80), email: str(o.contact?.email, 120), stage: o.pipelineStageId, status: o.status,
        value: Number(o.monetaryValue) || 0, created: Date.parse(o.createdAt) || 0, statusAt: Date.parse(o.lastStatusChangeAt) || 0, source: str(o.source, 60),
        campaign: str(a.utmCampaign, 80), content: str(a.utmContent, 120), viaCal: (o.attributions || []).some(x => x.medium === 'calendar') ? 1 : 0 });
    }
    if (b.length < 100 || !d.meta?.startAfterId) break;
    after = `&startAfter=${d.meta.startAfter}&startAfterId=${d.meta.startAfterId}`;
  }

  const events = [];
  for (const cal of FBM.calendars) {
    const d = await call(`/calendars/events?locationId=${L}&calendarId=${cal}&startTime=${FBM.since}&endTime=${start + 120 * 86400000}`, '2021-04-15');
    for (const e of d.events || []) if (!e.deleted) events.push({ id: e.id, cid: e.contactId, cal, start: Date.parse(e.startTime) || 0, added: Date.parse(e.dateAdded) || 0, status: e.appointmentStatus || e.appoinmentStatus || '' });
  }

  // samtaler ændret siden sidst (sorteret nyeste først) -> kun dem der hører til pipelinens kontakter
  const cids = new Set(opps.map(o => o.cid));
  const wm = core.wm || FBM.since, dirty = [];
  for (let after = '', guard = 0; guard < 6 && left() > 5; guard++) {
    const d = await call(`/conversations/search?locationId=${L}&limit=100&sortBy=last_message_date&sort=desc${after}`, '2021-04-15');
    const cs = d.conversations || [];
    for (const c of cs) if (cids.has(c.contactId) && (!conv[c.id] || conv[c.id].last < c.lastMessageDate)) dirty.push({ id: c.id, cid: c.contactId, last: c.lastMessageDate });
    if (cs.length < 100 || cs[cs.length - 1].lastMessageDate < wm) break;
    after = `&startAfterDate=${cs[cs.length - 1].lastMessageDate}`;
  }
  dirty.sort((a, b) => a.last - b.last);
  let done = 0;
  for (const c of dirty) {
    if (left() < 3) break;
    const d = await call(`/conversations/${c.id}/messages?limit=100`, '2021-04-15');
    const raw = Array.isArray(d.messages) ? d.messages : (d.messages?.messages || []);
    const old = new Map((conv[c.id]?.m || []).filter(m => m.mid).map(m => [m.mid, m]));
    const m = [];
    for (const x of raw) {
      const t = MSG_TYPES[x.messageType]; if (!t) continue;
      const subj = x.meta?.email?.subject || '';
      const r = { t, d: x.direction === 'inbound' ? 'in' : 'out', ts: Date.parse(x.dateAdded) || 0 };
      if (t === 'call') { r.st = x.meta?.call?.status || x.status || ''; r.dur = Number(x.meta?.call?.duration) || 0; }
      if (t === 'mail' && r.d === 'out' && BROCHURE_RE.test(subj)) {
        r.b = 1; r.mid = (x.meta?.email?.messageIds || [])[0] || x.id;
        const prev = old.get(r.mid); if (prev) { r.op = prev.op; r.chk = prev.chk; }
      }
      if (r.d === 'out' && x.source === 'workflow') r.auto = 1;
      m.push(r);
    }
    conv[c.id] = { cid: c.cid, last: c.last, m };
    done++;
  }
  const allDone = done === dirty.length;

  // åbnet? (brochurer op til 30 dage gamle, tjekkes højst hver time til de er åbnet)
  const brochures = Object.values(conv).flatMap(c => c.m.filter(m => m.b && !m.op && start - m.ts < 30 * 86400000 && start - (m.chk || 0) > 3600000));
  brochures.sort((a, b) => (a.chk || 0) - (b.chk || 0));
  for (const b of brochures) {
    if (left() < 1) break;
    const e = await call(`/conversations/messages/email/${b.mid}`, '2021-04-15').catch(() => null);
    const s = e?.emailMessage?.status || '';
    if (['opened', 'clicked', 'replied'].includes(s)) b.op = 1;
    b.chk = start;
  }

  await kvPut(db, 'sales_conv', conv);
  await kvPut(db, 'sales_core', { stages, opps, events, wm: allDone ? start - 10 * 60000 : wm, synced: start, pending: dirty.length - done });
  return { ok: true, calls, opps: opps.length, events: events.length, convUpdated: done, pending: dirty.length - done };
}

// ─── /admin/api/sales ───
async function salesJSON(env, url) {
  const db = env.DB, { from } = rangeOf(url);
  await salesTables(db);
  const core = await kvGet(db, 'sales_core', null);
  if (!core) return { empty: true };
  const conv = await kvGet(db, 'sales_conv', {});
  const settings = await kvGet(db, 'sales_settings', {});
  const costPerMeeting = Number(settings.costPerMeeting) >= 0 && settings.costPerMeeting !== undefined ? Number(settings.costPerMeeting) : 100;
  const deals = new Map((await all(db, 'SELECT opp_id, via, cash FROM sales_deal')).map(r => [r.opp_id, r]));
  const stageName = new Map(core.stages.map(s => [s.id, s.name]));
  const now = Date.now();
  const msgsOf = new Map();
  for (const c of Object.values(conv)) { const a = msgsOf.get(c.cid) || []; a.push(...c.m); msgsOf.set(c.cid, a); }
  const evOf = new Map();
  for (const e of core.events) { const a = evOf.get(e.cid) || []; a.push(e); evOf.set(e.cid, a); }

  const leads = core.opps.filter(o => o.created >= from && !TEST_RE.test(o.name) && !TEST_RE.test(o.email)).map(o => {
    const stage = stageName.get(o.stage) || '?';
    const ev = (evOf.get(o.cid) || []).sort((a, b) => a.start - b.start);
    const msgs = (msgsOf.get(o.cid) || []).sort((a, b) => a.ts - b.ts);
    // booket via kalenderen, også hvis aftalen siden er slettet/flyttet uden for kalenderne
    const booked = ev.length > 0 || !!o.viaCal;
    const showedEv = ev.filter(e => e.status === 'showed');
    const showed = showedEv.length > 0;
    const noshow = !showed && ev.some(e => e.status === 'noshow');
    const upcoming = ev.some(e => e.start > now && e.status !== 'cancelled');
    const cancelled = ev.length > 0 && ev.every(e => e.status === 'cancelled');
    const br = msgs.filter(m => m.b), brTs = br.length ? br[0].ts : 0;
    const opened = br.some(m => m.op);
    const replied = !!brTs && msgs.some(m => m.d === 'in' && m.t !== 'call' && m.ts > brTs);
    const won = o.status === 'won' || stage === 'Lukket';
    const lost = !won && (o.status === 'lost' || LOST_STAGES.has(stage));
    const positive = replied && !lost;
    const outCalls = msgs.filter(m => m.t === 'call' && m.d === 'out');
    const answered = outCalls.some(m => m.st === 'completed');
    const talked = outCalls.some(m => m.st === 'completed' && m.dur >= 120);
    const offer = br.length > 0 || OFFER_STAGES.has(stage) || won;
    const deal = deals.get(o.id) || {};
    // gæt: lukket inden for 2 døgn efter et afholdt møde = på kaldet, ellers på DM; kan rettes i tabellen
    const guess = won ? (showedEv.some(e => o.statusAt >= e.start && o.statusAt - e.start < 2 * 86400000) ? 'call' : 'dm') : '';
    return { id: o.id, name: o.name, created: o.created, stage, status: o.status, value: o.value, source: o.source, campaign: o.campaign, content: o.content,
      meeting: ev.length ? ev[ev.length - 1].start : null, booked, showed, noshow, upcoming, cancelled, brochure: br.length > 0, opened, replied, positive,
      called: outCalls.length > 0, answered, talked, offer, offerVia: offer ? (showed ? 'call' : 'dm') : '', won, lost,
      via: won ? (deal.via || guess) : '', viaGuess: won && !deal.via, cash: deal.cash ?? null,
      sms: msgs.filter(m => m.t === 'sms' && m.d === 'out' && !m.auto).length, inbound: msgs.filter(m => m.d === 'in' && m.t !== 'call').length };
  });

  const n = f => leads.filter(f).length;
  const won = leads.filter(l => l.won);
  const t = {
    leads: leads.length, booked: n(l => l.booked), showed: n(l => l.showed), noshow: n(l => l.noshow), upcoming: n(l => l.upcoming && !l.showed),
    cancelled: n(l => l.cancelled), notQualified: n(l => l.stage === 'Ikke kvalificeret'),
    brochure: n(l => l.brochure), opened: n(l => l.opened), replied: n(l => l.replied), positive: n(l => l.positive),
    called: n(l => l.called), answered: n(l => l.answered), talked: n(l => l.talked),
    offer: n(l => l.offer), offerCall: n(l => l.offerVia === 'call'), offerDm: n(l => l.offerVia === 'dm'),
    won: won.length, wonCall: won.filter(l => l.via === 'call').length, wonDm: won.filter(l => l.via === 'dm').length,
    revenue: won.reduce((s, l) => s + l.value, 0), paidDeals: won.filter(l => l.value > 0).length,
    cash: won.reduce((s, l) => s + (l.cash || 0), 0), cashKnown: won.filter(l => l.cash != null).length,
  };
  t.spend = t.booked * costPerMeeting;
  const stages = core.stages.map(s => ({ name: s.name, n: leads.filter(l => l.stage === s.name).length }));
  return { synced: core.synced, pending: core.pending || 0, costPerMeeting, totals: t, stages, leads: leads.sort((a, b) => b.created - a.created) };
}

// Client Portal-admin (client.fuldtbooketmusiker.dk) henter de samme tal via service binding: /api/sales-feed[/sync|/settings|/deal]
// med hemmelig nøgle (secret SALES_FEED_KEY, samme værdi som i fbm-client).
async function salesFeedOk(request, env) {
  const k = request.headers.get('X-Feed-Key') || '';
  return !!env.SALES_FEED_KEY && k.length >= 32 && (await sha256(k)) === (await sha256(env.SALES_FEED_KEY));
}

async function salesPost(request, env, p, trusted = false) {
  if (!trusted && (request.headers.get('Origin') || '') !== new URL(request.url).origin) return json({ error: 'forkert oprindelse' }, 403);
  p = p.replace('/api/sales-feed/', '/admin/api/sales/');
  const body = await request.json().catch(() => ({}));
  await salesTables(env.DB);
  if (p === '/admin/api/sales/sync') return json(await salesSync(env));
  if (p === '/admin/api/sales/settings') {
    const c = num(body.costPerMeeting, 0, 100000);
    if (c == null) return json({ error: 'ugyldigt beløb' }, 400);
    await kvPut(env.DB, 'sales_settings', { costPerMeeting: Math.round(c) });
    return json({ ok: true });
  }
  if (p === '/admin/api/sales/deal') {
    const id = str(body.id, 40), via = ['call', 'dm', ''].includes(body.via) ? body.via : null;
    const cash = body.cash === null || body.cash === '' ? null : num(body.cash, 0, 10000000);
    if (!/^[A-Za-z0-9]{10,40}$/.test(id) || via == null || (body.cash != null && body.cash !== '' && cash == null)) return json({ error: 'ugyldige felter' }, 400);
    await env.DB.prepare(`INSERT INTO sales_deal (opp_id, via, cash, updated_ts) VALUES (?, ?, ?, ?) ON CONFLICT(opp_id) DO UPDATE SET via = excluded.via, cash = excluded.cash, updated_ts = excluded.updated_ts`)
      .bind(id, via, cash == null ? null : Math.round(cash), Date.now()).run();
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}

// ───────── video m. byte-range ─────────
async function serveVideo(request, env) {
  const res = await env.ASSETS.fetch(new Request(request.url, { method: 'GET', headers: { 'Accept-Encoding': 'identity' } }));
  if (!res.ok) return res;
  const h = new Headers(res.headers); h.set('Accept-Ranges', 'bytes'); h.set('Content-Type', 'video/mp4'); h.set('Cache-Control', 'public, max-age=86400');
  const range = request.headers.get('Range');
  if (!range) return new Response(request.method === 'HEAD' ? null : res.body, { status: 200, headers: h });
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] !== '' ? +m[1] : NaN, end = m && m[2] !== '' ? +m[2] : NaN;
  if (isNaN(start)) { start = Math.max(0, size - (isNaN(end) ? 0 : end)); end = size - 1; }
  if (isNaN(end) || end >= size) end = size - 1;
  if (!m || start > end || start >= size) { h.set('Content-Range', `bytes */${size}`); return new Response(null, { status: 416, headers: h }); }
  h.set('Content-Range', `bytes ${start}-${end}/${size}`); h.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : buf.slice(start, end + 1), { status: 206, headers: h });
}

// Oscars egne underdomæner (Cloudflare for SaaS -> denne Worker): forsiden er gig-siden, resten af Bliv Booket vises ikke der
const OSCAR_HOSTS = { 'bryllup.oscartjoensson.dk': 'bryllup', 'firmafest.oscartjoensson.dk': 'firmafest' };
const SPLIT = ['v2', 'v4'];   // versionerne i split-testen (samme på begge sider)
const SPLIT_PATH = '/book';    // adressen der splitter, fx bryllup.oscartjoensson.dk/book
const splitVer = request => { const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)oj_ab=(v[0-9])/); return m && SPLIT.includes(m[1]) ? m[1] : ''; };
const OSCAR_PASS = /^\/(api\/(lead|slots|book|booking|ics|t)$|media\/|ev\.js$|track\.js$|privatliv$|favicon)/;
async function oscarHost(request, env, url, gig) {
  const p = url.pathname;
  if (p === '/' || p === '/index.html' || p === '/tak' || p === '/tak/') {
    const r = await env.ASSETS.fetch(new Request(url.origin + (p.startsWith('/tak') ? '/tak-' : '/') + gig, { method: request.method, headers: request.headers }));
    const h = new Headers(r.headers); h.set('Cache-Control', 'public, max-age=60');
    return new Response(r.body, { status: r.status, headers: h });
  }
  // split-test (31/10 2026, Charlie): /book viser selv v2 eller v4 på SAMME adresse (ingen viderestilling, så Meta ser samme
  // URL som i annoncen). Ren tilfældighed + cookie (samme version igen); ingen særbehandling af bots/Metas crawler, ellers er det cloaking.
  // Resultat pr. version: admin -> "Split-test" (besøg tælles som /<gig>/vN, leads med src.ver).
  if (p === SPLIT_PATH || p === SPLIT_PATH + '/') {
    const had = splitVer(request), v = had || SPLIT[crypto.getRandomValues(new Uint8Array(1))[0] & 1];
    const r = await env.ASSETS.fetch(new Request(`${url.origin}/ev/${gig}-tekst-${v}`, { method: request.method, headers: request.headers }));
    if (r.status !== 200) return Response.redirect(`https://${url.hostname}/`, 302);
    const h = new Headers(r.headers);
    h.set('Cache-Control', 'private, no-store'); h.set('Vary', 'Cookie');   // aldrig delt cache: hver besøgende sin version
    if (!had) h.append('Set-Cookie', `oj_ab=${v}; Path=/; Max-Age=${90 * 86400}; Secure; SameSite=Lax`);
    return new HTMLRewriter().on('head', { element: e => e.prepend(`<script>window.OJ_VER='${v}'</script>`, { html: true }) })
      .transform(new Response(r.body, { status: 200, headers: h }));
  }
  const cv = p.match(/^\/(v[2-9])\/?$/);
  const vp = cv ? `/ev/${gig}-tekst-${cv[1]}` : (p === '/versioner' || p === '/versioner/') ? '/ev/versioner' : '';   // /versioner = oversigt; /v2, /v3 ... = tekstversioner (gen_events.py COPY)
  if (vp) {
    const r = await env.ASSETS.fetch(new Request(url.origin + vp, { method: request.method, headers: request.headers }));
    if (r.status !== 200) return Response.redirect(`https://${url.hostname}/`, 302);
    const h = new Headers(r.headers); h.set('Cache-Control', 'public, max-age=60');
    return new Response(r.body, { status: 200, headers: h });
  }
  const other = Object.entries(OSCAR_HOSTS).find(([, g]) => '/' + g === p);
  if (other) return Response.redirect(`https://${other[0]}/${url.search}`, 301);   // /bryllup og /firmafest -> rigtigt underdomæne
  if (p === '/admin' || p.startsWith('/admin/')) return Response.redirect('https://fuldtbooketmusiker.dk' + p, 302);
  if (!OSCAR_PASS.test(p)) return Response.redirect(`https://${url.hostname}/`, 302);
  return null;   // filer og API: samme vej som på fuldtbooketmusiker.dk
}

// ─── tak-side: GET /api/booking?lid= (fornavn + tid, ingen kontaktdata) og GET /api/ics?lid= (kalenderfil) ───
// lid er et tilfældigt id, som kun findes i kundens egen browser, så det fungerer som adgangsnøgle.
// Kun på Oscars egne værter, kun rigtige UUID v4 (crypto.randomUUID), kun egen sides bookinger, kun indtil 3 døgn efter samtalen
const MEET_RE = /^https:\/\/meet\.google\.com\/[a-z]{3,4}-[a-z]{3,4}-[a-z]{3,4}$/;   // Google Meet-kode, fx abc-defg-hij
const READ_LID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function bookedLead(env, url) {
  const lid = String(url.searchParams.get('lid') || ''), gig = OSCAR_HOSTS[url.hostname];
  if (!env.DB || !gig || !READ_LID_RE.test(lid)) return null;
  const l = await env.DB.prepare('SELECT id, page, name, booked_start, booked_end, meet_url FROM leads WHERE id = ? AND booked_start > ?').bind(lid, Date.now() - 3 * 86400000).first();
  if (!l || !l.booked_start || l.page !== gig) return null;
  const end = l.booked_end || l.booked_start + 30 * 60000;
  l.meet_url = MEET_RE.test(l.meet_url || '') && end > Date.now() ? l.meet_url : '';   // én regel for begge adresser
  return l;
}
async function handleBooking(env, url) {
  const l = await bookedLead(env, url);
  if (!l) return json({ error: 'not found' }, 404);
  const end = l.booked_end || l.booked_start + 30 * 60000;
  return new Response(JSON.stringify({ page: l.page, first: (l.name || '').trim().split(/\s+/)[0] || '', start: isoCph(l.booked_start), end: isoCph(end), min: Math.round((end - l.booked_start) / 60000), meet: l.meet_url }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
}
async function handleIcs(env, url) {
  const l = await bookedLead(env, url);
  if (!l) return new Response('Bookingen blev ikke fundet.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const end = l.booked_end || l.booked_start + 30 * 60000;
  const z = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = t => String(t).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const meet = l.meet_url;
  const what = l.page === 'bryllup' ? 'jeres bryllup' : l.page === 'firmafest' ? 'jeres firmafest' : 'jeres fest';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oscar Jonsson Musik//DA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${l.id}@oscartjoensson.dk`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(l.booked_start)}`, `DTEND:${z(end)}`,
    `SUMMARY:${esc('Videomøde med Oscar Jønsson om musikken')}`,
    ...(meet ? [`LOCATION:${esc(meet)}`, `URL:${esc(meet)}`] : []),
    `DESCRIPTION:${esc(`Videomøde på Google Meet om musikken til ${what}.\n` + (meet ? `Deltag: ${meet}` : 'Linket står i jeres bekræftelsesmail.'))}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Videomøde med Oscar om 15 min')}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="snak-med-oscar.ics"', 'Cache-Control': 'private, no-store' } });
}

// ───────── router ─────────
export default {
  async scheduled(event, env, ctx) {
    // */5: SMS til ansøgere der ikke har udfyldt sidste trin (+ læs deres svar). */10: salgstal fra GHL
    if (event.cron === '*/5 * * * *') ctx.waitUntil(fbmSmsJob(env).catch(err => console.log('fbmSmsJob', String(err))));
    else ctx.waitUntil(salesSync(env).catch(err => console.log('salesSync', String(err))));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    const gig = OSCAR_HOSTS[url.hostname];
    if (gig) { const r = await oscarHost(request, env, url, gig); if (r) return r; }
    // gamle adresser (annoncer/links) -> Oscars eget domæne; kunder skal ikke lande på fuldtbooketmusiker.dk. Forhåndsvisninger under /ev/ bliver.
    else if ((p === '/bryllup' || p === '/firmafest' || p === '/bryllup/' || p === '/firmafest/') && url.searchParams.get('nt') !== '1') {
      const host = Object.keys(OSCAR_HOSTS).find(h => OSCAR_HOSTS[h] === p.replace(/\//g, ''));
      return Response.redirect(`https://${host}/${url.search}`, 301);
    }
    try {
      if (p === '/api/sales-feed' || p.startsWith('/api/sales-feed/')) {
        if (!(await salesFeedOk(request, env))) return json({ error: 'unauthorized' }, 401);
        if (p === '/api/sales-feed' && request.method === 'GET') return json(await salesJSON(env, url));
        if (request.method === 'POST') return await salesPost(request, env, p, true);
        return json({ error: 'not found' }, 404);
      }
      if (p === '/api/conv') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleConv(request, env);
      }
      // formen henter kun hvilke svar der stopper den (scoren holdes på serveren)
      if (p === '/api/form-config' && request.method === 'GET') {
        const r = await fbmRules(env), stop = {};
        for (const [q, m] of Object.entries(r.answers)) for (const [a, l] of Object.entries(m)) if (l === 'stop') (stop[q] ||= []).push(a);
        return json({ stop });
      }
      if (p === '/api/lead') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleLead(request, env, ctx);
      }
      if (p === '/api/slots') {
        if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
        return await handleSlots(request, env, ctx, url);
      }
      if (p === '/api/booking' && request.method === 'GET') return await handleBooking(env, url);
      if (p === '/api/ics' && request.method === 'GET') return await handleIcs(env, url);
      if (p === '/api/book') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleBook(request, env, ctx);
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
        if (p === '/admin/api/stats') return await adminApi(env, ctx, url, statsJSON, COST.stats);
        if (p === '/admin/api/heat') return await adminApi(env, ctx, url, heatJSON, COST.heat);
        if (p === '/admin/api/visitors') return await adminApi(env, ctx, url, visitorsJSON, COST.visitors);
        if (p === '/admin/api/leads') return await adminApi(env, ctx, url, leadsJSON, COST.leads, 30);
        if (p === '/admin/api/form' && request.method === 'GET') return json(await fbmFormAdmin(env, url));
        if (p === '/admin/api/form' && request.method === 'POST') return await fbmFormSave(request, env);
        if (p === '/admin/api/sales' && request.method === 'GET') return json(await salesJSON(env, url));
        if (p.startsWith('/admin/api/sales/') && request.method === 'POST') return await salesPost(request, env, p);
        return json({ error: 'not found' }, 404);
      }
    } catch (e) {
      return json({ error: 'server error', detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
    // ny ansøgningsform til forhåndsvisning (ikke linket fra forsiden, ikke i søgemaskiner). "steup" = stavefejl der også skal virke
    if (!gig && /^\/new-form-(setup|steup)\/?$/.test(p)) {
      const r = await env.ASSETS.fetch(new Request(new URL('/new-form-setup', url), request));
      const h = new Headers(r.headers); h.set('X-Robots-Tag', 'noindex, nofollow'); h.set('Cache-Control', 'no-store');
      return new Response(r.body, { status: r.status, headers: h });
    }
    // Video: Safari/iPhone kræver byte-range (206) for at afspille mp4; assets-bindingen svarer altid 200 med hele filen
    if (/\.(mp4|m4v|mov)$/i.test(p) && (request.method === 'GET' || request.method === 'HEAD')) return await serveVideo(request, env);
    return env.ASSETS.fetch(request);
  },
};
