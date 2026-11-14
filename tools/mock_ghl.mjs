// Lokal mock af GHL, Meta CAPI og Telegram til `wrangler dev --local` (14/11 2026).
// Workeren bruger den, når .dev.vars har DEV_MOCK=http://127.0.0.1:8799 (aldrig i wrangler.toml). Intet rammer de rigtige tjenester.
// Alle kald logges som JSON-linjer i tools/mock_calls.jsonl (ikke i git), så en test kan se præcis, hvad der ville være sendt.
//   node tools/mock_ghl.mjs            (port 8799)
// En kontakt med e-mail "findes@test.dk" findes "i forvejen" (tester reglen: eksisterende kontakter overskrives ikke).
import http from 'node:http';
import fs from 'node:fs';
const LOG = new URL('./mock_calls.jsonl', import.meta.url);
let n = 0;
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const u = new URL(req.url, 'http://x'), p = u.pathname;
    let b = null; try { b = body ? JSON.parse(body) : null; } catch { b = body; }
    fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), m: req.method, p, q: Object.fromEntries(u.searchParams), b }) + '\n');
    if (p.startsWith('/tg/')) return json(res, 200, { ok: true });
    if (p.startsWith('/graph/')) return json(res, 200, { events_received: (b && b.data || []).length, fbtrace_id: 'mock' });
    if (!p.startsWith('/ghl/')) return json(res, 404, { message: 'ukendt' });
    const g = p.slice(4);
    let m;
    if ((m = g.match(/^\/calendars\/([^/]+)\/free-slots$/))) {
      const out = {}, start = +u.searchParams.get('startDate'), end = +u.searchParams.get('endDate');
      for (let d = start; d < end; d += 86400000) {
        const day = new Date(d); const wd = new Date(day.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })).getDay();
        if (wd === 0 || wd === 6) continue;
        const ymd = day.toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
        // 10, 11, 13, 14, 15 dansk tid (vintertid +01:00)
        out[ymd] = { slots: [10, 11, 13, 14, 15].map(h => `${ymd}T${String(h).padStart(2, '0')}:00:00+01:00`).filter(s => Date.parse(s) > Date.now() + 3600000) };
      }
      return json(res, 200, out);
    }
    if (req.method === 'GET' && (m = g.match(/^\/calendars\/([A-Za-z0-9]+)$/))) return json(res, 200, { calendar: { id: m[1], slotDuration: 1, slotDurationUnit: 'hours' } });
    if (g === '/contacts/search/duplicate') {
      const em = u.searchParams.get('email') || '';
      return json(res, 200, { contact: em === 'findes@test.dk' ? { id: 'existing-contact-1' } : null });
    }
    if (req.method === 'POST' && g === '/contacts/') return json(res, 201, { contact: { id: 'mock-contact-' + (++n) } });
    if (req.method === 'POST' && g === '/opportunities/' && b && b.contactId === 'existing-contact-1') return json(res, 400, { message: 'Can not create duplicate opportunity for the contact.', error: 'OPPORTUNITY_NO_DUPLICATE' });
    if (req.method === 'POST' && /^\/opportunities\/(upsert)?$/.test(g)) return json(res, 200, { opportunity: { id: 'mock-opp-' + (++n) } });
    if (req.method === 'POST' && g === '/calendars/events/appointments') return json(res, 201, { id: 'mock-appt-' + (++n), address: 'https://meet.google.com/abc-defg-hij' });
    if (req.method === 'GET' && g.startsWith('/calendars/events/appointments/')) return json(res, 200, { appointment: { address: 'https://meet.google.com/abc-defg-hij' } });
    if (/^\/contacts\/[^/]+(\/(tags|notes))?$/.test(g)) return json(res, 200, { ok: true });
    if (g.startsWith('/conversations')) return json(res, 200, { conversations: [], messages: [] });
    return json(res, 200, {});
  });
}).listen(8799, '127.0.0.1', () => console.log('mock på http://127.0.0.1:8799'));
