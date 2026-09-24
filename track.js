/* fuldtbooketmusiker.dk: egen besøgs-tracking (24/9 2026).
   Sender til POST /api/t på samme domæne (Worker -> D1). Ingen tredjepart.
   Events: pageview, booking_open (m. sektion+knap), booking_interact, click (heatmap), leave (scrolldybde+tid). */
(function () {
  if (/[?&]nt=1\b/.test(location.search)) return;                 // admin-preview
  if (navigator.webdriver || /bot|crawl|spider|headless|lighthouse|pagespeed/i.test(navigator.userAgent)) return;
  var gen = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };
  var st = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var vid = st('bk_vid'); if (!vid) { vid = gen(); st('bk_vid', vid); }
  // session = 30 min uden aktivitet
  var now = Date.now(), sid = st('bk_sid'), last = +st('bk_last') || 0;
  if (!sid || now - last > 30 * 60 * 1000) { sid = gen(); st('bk_sid', sid); }
  st('bk_last', String(now));
  var q = new URLSearchParams(location.search);
  var pvid = gen();
  var base = function () {
    return {
      vid: vid, sid: sid, pv: pvid, path: location.pathname, ref: document.referrer || '',
      utm_source: q.get('utm_source') || q.get('fbclid') && 'facebook' || q.get('gclid') && 'google' || '',
      utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || '', utm_content: q.get('utm_content') || '',
      vw: innerWidth, vh: innerHeight, dw: document.documentElement.scrollWidth, dh: document.documentElement.scrollHeight
    };
  };
  var send = function (type, extra) {
    var o = base(); o.type = type; if (extra) for (var k in extra) o[k] = extra[k];
    var body = JSON.stringify(o);
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }))) return; } catch (e) { }
    try { fetch('/api/t', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () { }); } catch (e) { }
  };
  st('bk_last', String(now));
  send('pageview');

  // Sektion for et element: nærmeste forfader med id (section/div)
  var secOf = function (el) { var s = el && el.closest ? el.closest('section[id],[id]') : null; while (s && /^(bkModal|bkBody|nav)$/.test(s.id)) s = s.parentElement && s.parentElement.closest ? s.parentElement.closest('section[id],[id]') : null; return s ? s.id : ''; };
  var labelOf = function (el) { var t = el && el.closest ? el.closest('a,button,[role=button],summary,label') : null; var txt = (t || el).innerText || (t || el).textContent || ''; txt = txt.replace(/\s+/g, ' ').trim(); if (!txt && el) txt = el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''); return txt.slice(0, 60); };

  // Booking-popup åbnet (index.html dispatcher bk:open m. knappen)
  addEventListener('bk:open', function (e) {
    var btn = e.detail && e.detail.el;
    send('booking_open', { sec: btn ? secOf(btn) : (e.detail && e.detail.sec) || '', label: btn ? labelOf(btn) : (e.detail && e.detail.label) || '' });
  });
  // Bruger klikker ind i booking-iframen (fokus forlader siden mens popup er åben)
  var interacted = false;
  addEventListener('blur', function () {
    setTimeout(function () {
      var a = document.activeElement; if (interacted || !a || a.tagName !== 'IFRAME') return;
      var m = document.getElementById('bkModal'); if (m && !m.hidden) { interacted = true; send('booking_interact'); }
    }, 0);
  });

  // Klik-heatmap: x som andel af dokumentbredde, y som andel af sektionens højde (robust ved responsivt layout)
  var clicks = 0;
  addEventListener('click', function (e) {
    if (clicks++ > 60) return;
    var el = e.target, secId = secOf(el), sec = secId ? document.getElementById(secId) : null;
    var secy = 0; if (sec) { var r = sec.getBoundingClientRect(); secy = (e.clientY - r.top) / Math.max(1, r.height); }
    var dh = Math.max(1, document.documentElement.scrollHeight);
    send('click', { x: e.pageX / Math.max(1, document.documentElement.scrollWidth), y: e.pageY / dh, sec: secId, secy: secy, label: labelOf(el) });
  }, true);

  // Scrolldybde + tid på siden, sendes én gang ved forlad
  var maxDepth = 0, t0 = Date.now(), left = false;
  var depth = function () { var h = document.documentElement.scrollHeight - innerHeight; return h <= 0 ? 100 : Math.min(100, Math.round((scrollY / h) * 100)); };
  addEventListener('scroll', function () { var d = depth(); if (d > maxDepth) maxDepth = d; }, { passive: true });
  setTimeout(function () { maxDepth = Math.max(maxDepth, depth()); }, 1000);
  var leave = function () { if (left) return; left = true; send('leave', { depth: maxDepth, dur: Date.now() - t0 }); };
  addEventListener('pagehide', leave);
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leave(); });
})();
