// Tracking-vagt: hver mandag. Se wrangler.toml. Fejl i selve tjekket sendes også (så stilhed aldrig betyder "ok" uden at være det).
const FBM_PIXEL = '1708597793574696';
// sider vi selv står for (Kevin Hartmans side er hans egen opsætning: kun hans lead-tal tjekkes, Oskar 22/11)
const PAGES = [
  'https://fuldtbooketmusiker.dk/', 'https://fuldtbooketmusiker.dk/tak', 'https://fuldtbooketmusiker.dk/international',
  'https://sorenokholm.dk/', 'https://sorenokholm.dk/sidste-farvel/', 'https://tannichristinemusik.dk/',
  'https://oscartjoensson.dk/', 'https://bryllup.oscartjoensson.dk/', 'https://firmafest.oscartjoensson.dk/',
];
const DAY = 86400;
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function meta(env, pixel, event, agg, from, to) {
  const u = `https://graph.facebook.com/v21.0/${pixel}/stats?aggregation=${agg}&event=${event}&start_time=${from}&end_time=${to}&access_token=${encodeURIComponent(env.META_TOKEN)}`;
  const d = await (await fetch(u)).json();
  if (d.error) throw new Error(`Meta (${pixel}): ${d.error.message}`.slice(0, 160));
  const c = {};
  for (const b of d.data || []) for (const x of b.data || []) c[x.value] = (c[x.value] || 0) + (x.count || 0);
  return c;   // fx { BROWSER: 4, SERVER: 4 }
}
const all = async (db, sql, ...a) => (await db.prepare(sql).bind(...a).all()).results || [];
const TEST = `(lower(email) LIKE '%@example.com' OR lower(email) LIKE 'zz-test%' OR lower(name) LIKE 'zz-test%' OR lower(name) LIKE 'test %')`;

// pixel-fejl i HTML: GTM, der sender til samme pixel som siden (dobbelt PageView), Lead uden fast event-id, manglende disablePushState
function pageIssues(h) {
  const out = [];
  const pixels = [...new Set([...h.matchAll(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/g)].map(m => m[1]))];
  const cfgPx = [...h.matchAll(/"pixel":"(\d{8,20})"/g)].map(m => m[1]);
  if ((pixels.length || cfgPx.length) && !/disablePushState\s*=\s*true/.test(h)) out.push('mangler disablePushState (ekstra PageView ved #-links)');
  for (const m of h.matchAll(/fbq\(\s*['"]track(?:Single)?['"]\s*,\s*(?:['"]\d{8,20}['"]\s*,\s*)?['"]Lead['"]([^;]{0,400})/g)) {
    const e = /eventID\s*:\s*([A-Za-z_$][\w$]*)/.exec(m[1]);
    if (!/eventID/.test(m[1]) || (e && new RegExp(`\\b${e[1].replace(/\$/g, '\\$')}\\s*=\\s*[^;]{0,120}(?:Math\\.random|Date\\.now)`).test(h))) { out.push('Lead uden fast event-id'); break; }
  }
  const gtm = /googletagmanager\.com/.test(h) ? [...new Set([...h.matchAll(/\b(GTM-[A-Z0-9]{4,12})\b/g)].map(m => m[1]))] : [];
  return { out, pixels: [...new Set([...pixels, ...cfgPx])], gtm };
}
async function gtmPixels(id) {
  const s = (await (await fetch(`https://www.googletagmanager.com/gtm.js?id=${id}`)).text()).replace(/\\(["'\/])/g, '$1');
  return [...new Set([...s.matchAll(/"vtp_pixelIds?"\s*:\s*"(\d{8,20})/g), ...s.matchAll(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/g), ...s.matchAll(/facebook\.com\/tr\?id=(\d{8,20})/g)].map(m => m[1]))];
}

export async function check(env) {
  const now = Math.floor(Date.now() / 1000), to = now - (now % 3600), from = to - 7 * DAY;
  const bad = [], good = [];
  // 1) FBM: bookinger = Schedule (browser og server). Ingen ekstra (falske) og ingen manglende.
  const [{ n: booked }] = await all(env.FBM, `SELECT count(*) n FROM leads WHERE page IN ('ansoegning','international') AND booked_at >= ? AND booked_at < ? AND NOT ${TEST}`, from * 1000, to * 1000);
  const sch = await meta(env, FBM_PIXEL, 'Schedule', 'event_source', from, to);
  const sS = sch.SERVER || 0, sB = sch.BROWSER || 0;
  if (sS < booked) bad.push(`FBM: ${booked} bookinger, men kun ${sS} Schedule fra serveren (CAPI). Tjek Meta-nøglen i fuldtbooketmusiker-Workeren.`);
  if (sS > booked + 1 || sB > booked + 1) bad.push(`FBM: ${booked} bookinger, men Meta fik ${sS} (server) / ${sB} (browser) Schedule. Ekstra konverteringer = fejl.`);
  if (sS >= booked && sS <= booked + 1 && sB <= booked + 1) good.push(`FBM: ${booked} bookinger = ${sS} Schedule (server), ${sB} (browser)`);
  // 2) FBM: én PageView pr. sidevisning (vores egen måling mod pixlens browser-PageViews)
  const [{ n: views }] = await all(env.FBM, `SELECT count(*) n FROM events WHERE type = 'pageview' AND ts >= ? AND ts < ?`, from * 1000, to * 1000);
  const pv = (await meta(env, FBM_PIXEL, 'PageView', 'event_source', from, to)).BROWSER || 0;
  if (views > 50 && pv > views * 1.5) bad.push(`FBM: ${pv} PageViews i pixlen mod ${views} sidevisninger i vores måling (over 1,5 pr. visning = dobbelt).`);
  else good.push(`FBM: ${pv} PageViews / ${views} sidevisninger`);
  // 3) kunder med pixel: leads i platformen mod Lead i deres pixel
  const accts = await all(env.PLAT, `SELECT id, name, pixel_id FROM accounts WHERE pixel_id IS NOT NULL AND pixel_id <> '' AND id NOT LIKE 'demo%'`);
  for (const a of accts) {
    const [{ n }] = await all(env.PLAT, `SELECT count(*) n FROM leads WHERE account_id = ? AND deleted_at IS NULL AND created_at >= ? AND created_at < ? AND NOT ${TEST.replace(/email/g, "coalesce(email,'')").replace(/name/g, "coalesce(name,'')")}`, a.id, from, to);
    const L = await meta(env, a.pixel_id, 'Lead', 'event_source', from, to);
    const got = Math.max(L.SERVER || 0, L.BROWSER || 0);
    if (n >= 2 && got < Math.ceil(n * 0.6)) bad.push(`${a.name}: ${n} leads i platformen, men kun ${got} Lead i pixlen ${a.pixel_id}.`);
    else if (n || got) good.push(`${a.name}: ${n} leads, Meta ${L.SERVER || 0} server / ${L.BROWSER || 0} browser`);
  }
  // 4) de live sider: pixel-fejl i HTML'en
  for (const url of PAGES) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36 tracking-vagt' }, redirect: 'follow' });
      if (!r.ok) { bad.push(`${url}: svarer ${r.status}`); continue; }
      let h = await r.text();
      // sidens egne scripts på samme vært (platformens hjemmesider har pixlen i /_w/s.js), højst 4
      const base = new URL(r.url);
      for (const m of [...h.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)].slice(0, 12)) {
        let u; try { u = new URL(m[1], base); } catch { continue; }
        if (u.hostname !== base.hostname || (h.length > 3e6)) continue;
        const sr = await fetch(u, { headers: { 'user-agent': 'tracking-vagt' } }).catch(() => null);
        if (sr?.ok) h += '\n' + (await sr.text()).slice(0, 400000);
      }
      const p = pageIssues(h);
      for (const g of p.gtm.slice(0, 2)) { const gp = await gtmPixels(g).catch(() => []); for (const x of gp) if (p.pixels.includes(x)) p.out.push(`${g} sender også til pixel ${x} (dobbelt PageView)`); }
      if (p.out.length) bad.push(`${url}: ${p.out.join('; ')}`);
    } catch (e) { bad.push(`${url}: ${String(e.message || e).slice(0, 80)}`); }
  }
  return { bad, good, from, to };
}

function text(r) {
  const d = t => new Date(t * 1000).toLocaleDateString('da-DK', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Copenhagen' });
  const head = r.bad.length ? `⚠️ <b>Tracking-tjek ${d(r.from)}-${d(r.to)}: ${r.bad.length} problem${r.bad.length > 1 ? 'er' : ''}</b>` : `✅ <b>Tracking-tjek ${d(r.from)}-${d(r.to)}: alt spiller</b>`;
  return [head, ...r.bad.map(x => '• ' + esc(x)), r.bad.length ? '' : null, ...r.good.map(x => '· ' + esc(x))].filter(x => x != null).join('\n');
}
async function tg(env, msg) {
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TG_CHAT, text: msg.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!r.ok) console.log('telegram', r.status, await r.text());
}
export default {
  async scheduled(ev, env, ctx) {
    ctx.waitUntil((async () => {
      let msg;
      try { msg = text(await check(env)); } catch (e) { msg = `⚠️ <b>Tracking-tjekket kunne ikke køre</b>\n${esc(String(e.message || e).slice(0, 300))}`; }
      if (env.DRY === '1') console.log(msg); else await tg(env, msg);
    })());
  },
};
