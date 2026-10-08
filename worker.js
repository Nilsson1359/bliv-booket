// fuldtbooketmusiker.dk: statiske filer + Meta CAPI-relay + egen tracking + /admin (24/9 2026).
//  POST /api/conv   Meta Conversions API-relay (token = Worker-secret META_CAPI_TOKEN)
//  POST /api/t      tracking fra track.js -> D1 (env.DB), geo fra request.cf, ip fra CF-Connecting-IP
//  GET  /admin      dashboard (login m. ADMIN_PASSWORD-secret, signeret cookie 30 dage)
//  GET  /admin/api/stats|heat|visitors|leads  JSON til dashboardet
//  POST /api/lead, GET /api/slots, POST /api/book  formular + booking på /firmafest og /bryllup (se 'leads' nedenfor)
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
const LEAD_PAGES = { firmafest: 'Firmafest', bryllup: 'Bryllup' };
const LID_RE = /^[A-Za-z0-9-]{8,40}$/;
const MAX_LEAD_WRITES = 120;
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
    for (const [k, v] of Object.entries(b.answers).slice(0, 12)) answers[str(k, 40)] = str(v, 500);
  }
  const src = b.src && typeof b.src === 'object' ? Object.fromEntries(['ref_host', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'landing'].map(k => [k, str(b.src[k], k === 'landing' ? 300 : 150)]).filter(([, v]) => v)) : {};
  const cf = request.cf || {}, now = Date.now();
  const row = await env.DB.prepare(`INSERT INTO leads (id, page, created_ts, updated_ts, name, email, phone, answers_json, step, done, src_json, vid, sid, ip, city, country, writes, notified_flags)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'')
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
      request.headers.get('CF-Connecting-IP') || '', str(cf.city, 80), str(cf.country, 8))
    .first();
  if (!row) return json({ error: 'too many writes' }, 429);
  ctx.waitUntil((async () => {
    if (hasContact(row) && await claimFlag(env, lid, 'contact')) await tgSend(env, leadText('📝 Delvist lead', row));
    if (row.done && await claimFlag(env, lid, 'done')) await tgSend(env, leadText('✅ Formular udfyldt', row));
  })().catch(() => {}));
  return json({ ok: true });
}

// ─── ledige tider ───
const ghlCalendarId = (env, page) => (page === 'firmafest' ? env.GHL_CALENDAR_FIRMAFEST : env.GHL_CALENDAR_BRYLLUP) || '';
const ghlOn = (env, page) => !!(env.GHL_TOKEN && env.GHL_LOCATION_ID && ghlCalendarId(env, page));
async function ghl(env, method, path, version, body) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(GHL_BASE + path, {
      method, signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + env.GHL_TOKEN, Version: version, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
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
async function ghlBook(env, lead, startMs, endMs) {
  const calendarId = ghlCalendarId(env, lead.page), locationId = env.GHL_LOCATION_ID;
  const parts = (lead.name || '').trim().split(/\s+/);
  const contact = { locationId, name: lead.name || undefined, firstName: parts[0] || undefined, lastName: parts.slice(1).join(' ') || undefined,
    email: validEmail(lead.email) ? lead.email : undefined, phone: e164(lead.phone) || undefined, tags: ['lp-' + lead.page], source: 'fuldtbooketmusiker.dk/' + lead.page };
  Object.keys(contact).forEach(k => contact[k] === undefined && delete contact[k]);
  const c = await ghl(env, 'POST', '/contacts/upsert', '2021-07-28', contact);
  const contactId = c.contact && c.contact.id;
  if (!contactId) throw new Error('GHL upsert gav intet contact.id');
  const appt = await ghl(env, 'POST', '/calendars/events/appointments', '2021-04-15', {
    calendarId, locationId, contactId, startTime: isoCph(startMs), endTime: isoCph(endMs),
    title: `Samtale: ${LEAD_PAGES[lead.page]} · ${lead.name || lead.email || lead.phone}`, appointmentStatus: 'confirmed', toNotify: true,
  });
  const apptId = appt.id || (appt.appointment && appt.appointment.id) || '';
  let ans = {}; try { ans = JSON.parse(lead.answers_json || '{}'); } catch { }
  const note = [`Fra fuldtbooketmusiker.dk/${lead.page} (${LEAD_PAGES[lead.page]})`, ...Object.entries(ans).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n');
  await ghl(env, 'POST', `/contacts/${contactId}/notes`, '2021-07-28', { body: note }).catch(e => console.log('ghl note fejl', e.message));
  return { contactId, apptId };
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
  if (lead.booked_start) {
    if (lead.booked_start === startMs) return json({ ok: true, start: isoCph(lead.booked_start), end: isoCph(lead.booked_end), source: lead.ghl_appt_id ? 'ghl' : 'fallback', already: true });
    return json({ error: 'already booked', start: isoCph(lead.booked_start) }, 409);
  }
  const day = ymdCph(startMs);
  const s = await computeSlots(env, lead.page, day, 1);
  if (!(s.slots[day] || []).includes(startMs)) return json({ error: 'slot taken' }, 409);
  const endMs = startMs + s.durationMin * 60000;
  const claim = await env.DB.prepare(`UPDATE leads SET booked_start = ?, booked_end = ?, updated_ts = ?, done = 1
      WHERE id = ? AND booked_start IS NULL AND NOT EXISTS (SELECT 1 FROM leads o WHERE o.booked_start = ?)`)
    .bind(startMs, endMs, Date.now(), lid, startMs).run().catch(() => null); // unik index fanger samtidige bookinger
  if (!claim || (claim.meta && claim.meta.changes) !== 1) return json({ error: 'slot taken' }, 409);
  let source = 'fallback', ghlErr = '';
  if (ghlOn(env, lead.page)) {
    try {
      const { contactId, apptId } = await ghlBook(env, lead, startMs, endMs);
      await env.DB.prepare('UPDATE leads SET ghl_contact_id = ?, ghl_appt_id = ? WHERE id = ?').bind(contactId, apptId, lid).run();
      source = 'ghl';
    } catch (e) { ghlErr = str(e && e.message || e, 300); }
  }
  const booked = { ...lead, booked_start: startMs, booked_end: endMs };
  ctx.waitUntil((async () => {
    if (ghlErr) await tgSend(env, `⚠️ GHL fejlede: ${tgEsc(ghlErr)}\nBookingen er gemt i D1, opret den manuelt i GHL.\n\n` + leadText('📅 Booket', booked));
    else if (await claimFlag(env, lid, 'booked')) await tgSend(env, leadText('📅 Booket', booked));
    if (ghlErr) await claimFlag(env, lid, 'booked');
  })().catch(() => {}));
  return json({ ok: true, start: isoCph(startMs), end: isoCph(endMs), source });
}

// ─── /admin/api/leads ───
async function leadsJSON(env, url) {
  const { from } = rangeOf(url);
  const rows = await all(env.DB, `SELECT id, page, created_ts, updated_ts, name, email, phone, answers_json, step, done, booked_start, booked_end,
      ghl_contact_id, ghl_appt_id, src_json, ip, city, country, notified_flags FROM leads WHERE updated_ts >= ? ORDER BY updated_ts DESC LIMIT 300`, from);
  const funnel = await all(env.DB, `SELECT page, COUNT(*) AS started, SUM(instr(notified_flags, 'contact,') > 0) AS contact, SUM(done) AS done,
      SUM(booked_start IS NOT NULL) AS booked FROM leads WHERE created_ts >= ? GROUP BY page`, from);
  return {
    funnel,
    rows: rows.map(r => {
      let answers = {}, src = {}; try { answers = JSON.parse(r.answers_json || '{}'); } catch { } try { src = JSON.parse(r.src_json || '{}'); } catch { }
      const { answers_json, src_json, ...rest } = r;
      return { ...rest, answers, src, contact: r.notified_flags.includes('contact,') ? 1 : 0 };
    }),
  };
}

// ───────── router ─────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === '/api/conv') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleConv(request, env);
      }
      if (p === '/api/lead') {
        if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
        return await handleLead(request, env, ctx);
      }
      if (p === '/api/slots') {
        if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
        return await handleSlots(request, env, ctx, url);
      }
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
        return json({ error: 'not found' }, 404);
      }
    } catch (e) {
      return json({ error: 'server error', detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
