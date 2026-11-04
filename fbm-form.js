// Ansøgningsform til fuldtbooketmusiker.dk (4/11 2026): ét spørgsmål ad gangen, kalenderen til sidst.
// Svar gemmes løbende via /api/lead (page=ansoegning). Booking via /api/book: serveren scorer A/B/C og vælger kalender.
// Covermusik er et hårdt stop før kontaktinfo. Instagram/hjemmeside/besætning spørges først efter bookingen.
// window.FBM_LIVE (sat af gen_newform.py) styrer om Meta-pixel/dataLayer får konverteringen. Kun kvalificerede (cv=1) tælles.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LIVE = window.FBM_LIVE === true, PAGE = 'ansoegning', KNOCKOUT = 'Kun mit eget materiale';
  var arrow = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

  // svarmulighederne skal være præcis de samme som i worker.js (FBM_APP.opts) og GHL-felterne
  var STEPS = [
    { id: 'jobs', q: 'Hvor mange betalte jobs har du spillet det seneste år?', opts: ['0–9', '10–29', '30–59', '60–99', '100+'] },
    { id: 'pris', q: 'Hvad tager du typisk for et spillejob i dag?', opts: ['Under 5.000 kr.', '5.000–9.999 kr.', '10.000–19.999 kr.', '20.000+ kr.'] },
    { id: 'pris_maal', q: 'Hvad vil du gerne kunne tage for et spillejob?', opts: ['Under 10.000 kr.', '10.000–14.999 kr.', '15.000–24.999 kr.', '25.000+ kr.'] },
    { id: 'jobs_maal', q: 'Hvor mange jobs vil du gerne spille om året?', opts: ['Under 50', '50–99', '100+'] },
    { id: 'x3', q: 'Er du åben for at tage 2–3x mere for dine jobs, hvis vi finder kunderne, der vil betale det?', opts: ['Ja', 'Nej'] },
    { id: 'cover', q: 'Spiller du covermusik eller dit eget materiale?', help: 'Vi hjælper musikere, der spiller kendte numre til bryllupper, firmafester og private fester.', opts: ['Covermusik', 'Både covermusik og eget materiale', KNOCKOUT] },
    { id: 'contact', type: 'contact', q: 'Hvor skal vi sende din invitation hen?', help: 'Vi bruger det kun til din samtale. Ingen nyhedsbreve.' },
    { id: 'oms', q: 'Hvad omsætter du for på musikken om måneden i dag?', help: 'Et cirka-tal er fint.', opts: ['Under 10.000 kr.', '10.000–24.999 kr.', '25.000–49.999 kr.', '50.000–99.999 kr.', '100.000+ kr.'] },
    { id: 'invest', q: null, opts: ['Ja', 'Ja, hvis tallene giver mening', 'Nej'] },
    { id: 'cal', type: 'cal', q: 'Vælg en tid til din strategisamtale', help: '1 time på Google Meet med Oscar. Du får en invitation på mail med det samme.' }
  ];
  var N = STEPS.length;
  // hvilke svar der stopper formen styres i /admin (Ansøgningsform); standard indtil svaret er hentet
  var STOP = { cover: [KNOCKOUT] };
  fetch('/api/form-config').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.stop) STOP = j.stop; }).catch(function () { });
  // investeringsspørgsmålet bygger på deres eget mål (som aftalt i kaldet 4/11)
  var investGoal = function () {
    var j = S.a.jobs_maal, p = S.a.pris_maal;
    var pTxt = p && p !== 'Under 10.000 kr.' ? ' til ' + p + ' pr. job' : '';
    if (j === '50–99' || j === '100+') return 'Dit mål: ' + j + ' jobs om året' + pTxt + '.';
    return 'Dit mål: flere jobs' + (pTxt || ' til bedre priser') + '.';
  };
  var INVEST_Q = 'Vil du investere 3.000–5.000 kr. om måneden i annoncer for at nå det, ud over vores honorar?';

  // ── kilde (første besøg) ──
  var q = new URLSearchParams(location.search), src = null;
  try { src = JSON.parse(ls('fbm_src') || 'null'); } catch (e) { }
  if (!src) {
    var rh = ''; try { rh = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { }
    src = { ref_host: rh, utm_source: q.get('utm_source') || (q.get('fbclid') ? 'facebook' : q.get('gclid') ? 'google' : ''), utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || '', utm_content: q.get('utm_content') || '', landing: location.pathname };
    ls('fbm_src', JSON.stringify(src));
  }

  // ── state ──
  var KEY = 'fbm_app_v1';
  var uuid = function () { try { return crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); } };
  var S; try { S = JSON.parse(ls(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || !S.lid) S = { lid: uuid(), a: {}, name: '', email: '', phone: '', step: 0, stop: false, booked: null, extraSent: false };
  var persist = function () { ls(KEY, JSON.stringify(S)); };

  // ── gem mens der svares ──
  var tSave = null, inflight = false, again = false;
  var payload = function (extra) { return { lid: S.lid, page: PAGE, answers: S.a, name: S.name, email: S.email, phone: S.phone, step: S.step, done: S.step >= N - 1, src: src, extra: !!extra, vid: ls('bk_vid') || '', sid: ls('bk_sid') || '' }; };
  var hasData = function () { return S.name || S.email || S.phone || Object.keys(S.a).length; };
  var saveNow = function (beacon, extra) {
    clearTimeout(tSave); persist();
    if (!hasData()) return Promise.resolve();
    var body = JSON.stringify(payload(extra));
    if (beacon && navigator.sendBeacon) { try { navigator.sendBeacon('/api/lead', new Blob([body], { type: 'application/json' })); return Promise.resolve(); } catch (e) { } }
    if (inflight && !extra) { again = true; return Promise.resolve(); }
    inflight = true;
    return fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
      .then(function (r) { return r.ok; }).catch(function () { return false; })
      .then(function (ok) { inflight = false; if (again) { again = false; saveNow(); } return ok; });
  };
  var saveSoon = function () { persist(); clearTimeout(tSave); tSave = setTimeout(saveNow, 700); };
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveNow(true); });
  addEventListener('pagehide', function () { saveNow(true); });

  // ── modal ──
  var M = $('#fbmModal'), B = $('#fbmBody'), bar = $('#fbmBar'), stepLbl = $('#fbmStep'), last = null;
  var lockScroll = function (on) { document.documentElement.classList.toggle('fbm-lock', on); document.body.classList.toggle('bk-lock', on); };
  var open = function (e) {
    if (e) e.preventDefault();
    last = document.activeElement;
    try { dispatchEvent(new CustomEvent('bk:open', { detail: { el: e && e.currentTarget || null } })); } catch (_) { }
    M.hidden = false; requestAnimationFrame(function () { M.classList.add('open'); });
    lockScroll(true);
    try { history.replaceState(null, '', location.pathname + location.search + '#ansoeg'); } catch (_) { }
    render();
  };
  var close = function () {
    saveNow(); M.classList.remove('open'); lockScroll(false);
    setTimeout(function () { M.hidden = true; }, 300); if (last && last.focus) last.focus({ preventScroll: true });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { }
  };
  $$('a[href="#ansoeg"],#applyBtn,[data-book]').forEach(function (a) { a.addEventListener('click', open); });
  $$('[data-fbm-close]', M).forEach(function (x) { x.addEventListener('click', close); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !M.hidden) close(); });
  if (location.hash === '#ansoeg' || location.hash === '#book') setTimeout(open, 60);

  var setProg = function (i, label) {
    bar.style.transform = 'scaleX(' + Math.max(0.03, Math.min(1, i / (N - 1))) + ')';
    stepLbl.textContent = label != null ? label : 'Trin ' + (i + 1) + ' af ' + N;
  };
  var focusFirst = function () { if (!matchMedia('(hover:hover)').matches) return; var f = $('input,.fo,.fday,.fbtn', B); if (f) f.focus({ preventScroll: true }); };
  var head = function (i, qtxt, help, pre) {
    return '<p class="fk">' + String(i + 1).padStart(2, '0') + ' <span>/ ' + String(N).padStart(2, '0') + '</span></p>' + (pre ? '<p class="fpre">' + esc(pre) + '</p>' : '') + '<h3 class="fq" id="fbmQ">' + esc(qtxt) + '</h3>' + (help ? '<p class="fh">' + esc(help) + '</p>' : '');
  };
  var nav = function (i, nextLabel) {
    return '<p class="ferr" id="fErr" role="alert"></p><div class="fnav">' +
      (nextLabel ? '<button type="button" class="fbtn" id="fNext">' + esc(nextLabel) + arrow + '</button>' : '') +
      (i > 0 ? '<button type="button" class="fback" id="fBack">Tilbage</button>' : '') +
      (nextLabel ? '<span class="fhint">eller tryk Enter ↵</span>' : '') + '</div>';
  };
  var err = function (m) { var e = $('#fErr'); if (e) e.textContent = m || ''; };
  var digits = function (s) { return (s || '').replace(/\D/g, ''); };
  var okMail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || ''); };
  var contactErr = function () {
    if (S.name.trim().length < 2) return 'Skriv dit navn.';
    if (!okMail(S.email)) return 'Tjek e-mailen. Den ser ikke helt rigtig ud.';
    if (digits(S.phone).length < 8) return 'Skriv et telefonnummer med mindst 8 cifre.';
    return '';
  };
  // første trin, der mangler et svar (fx hvis nogen hopper tilbage og ændrer noget)
  var firstMissing = function () {
    for (var i = 0; i < N - 1; i++) { var st = STEPS[i]; if (st.type === 'contact' ? contactErr() : !S.a[st.id]) return i; }
    return N - 1;
  };
  var go = function (i) { S.step = Math.max(0, Math.min(i, firstMissing())); saveNow(); render(); };

  var render = function () {
    M.classList.remove('wide'); M.classList.toggle('end', !!(S.booked || S.stop));
    if (S.booked) return renderDone();
    if (S.stop) return renderStop();
    var i = Math.min(S.step, firstMissing()), st = STEPS[i];
    setProg(i);
    var html;
    if (st.type === 'contact') {
      html = head(i, st.q, st.help) + '<div class="fgrid">' +
        '<label class="ff"><span>Fulde navn</span><input class="fin" id="cName" autocomplete="name" value="' + esc(S.name) + '" placeholder="Fornavn og efternavn"></label>' +
        '<label class="ff"><span>E-mail</span><input class="fin" id="cMail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="' + esc(S.email) + '" placeholder="navn@mail.dk"></label>' +
        '<label class="ff"><span>Telefon</span><input class="fin" id="cTel" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(S.phone) + '" placeholder="12 34 56 78"></label></div>' +
        nav(i, 'Fortsæt');
    } else if (st.type === 'cal') {
      M.classList.add('wide');
      html = head(i, st.q, st.help) + '<div class="fcal"><div class="fdays" id="cDays" role="group" aria-label="Dag"><div class="fskel"></div><div class="fskel"></div><div class="fskel"></div><div class="fskel"></div></div>' +
        '<div class="ftimes" id="cTimes" role="group" aria-label="Tidspunkt"></div></div>' +
        '<p class="ferr" id="cErr" role="alert"></p><div class="fnav"><button type="button" class="fbtn" id="cBook" disabled>Vælg et tidspunkt' + arrow + '</button><button type="button" class="fback" id="fBack">Tilbage</button></div>';
    } else {
      var v = S.a[st.id] || '';
      html = (st.id === 'invest' ? head(i, INVEST_Q, '', investGoal()) : head(i, st.q, st.help)) + '<div class="fopts" role="radiogroup" aria-labelledby="fbmQ">' + st.opts.map(function (o, k) {
        return '<button type="button" class="fo" role="radio" data-v="' + esc(o) + '" aria-checked="' + (v === o) + '"><kbd>' + String.fromCharCode(65 + k) + '</kbd><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>' + nav(i, null);
    }
    B.innerHTML = '<div class="fstep">' + html + '</div>';
    B.scrollTop = 0;
    wire(st, i);
    focusFirst();
  };

  var wire = function (st, i) {
    var bk = $('#fBack');
    if (bk) bk.addEventListener('click', function () { S.step = Math.max(0, i - 1); persist(); render(); });
    B.onkeydown = null;
    if (st.opts) {
      $$('.fo', B).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.fo', B).forEach(function (x) { x.setAttribute('aria-checked', 'false'); }); b.setAttribute('aria-checked', 'true');
          S.a[st.id] = b.dataset.v;
          if ((STOP[st.id] || []).indexOf(b.dataset.v) > -1) { S.stop = true; saveNow(); setTimeout(renderStop, 260); return; }
          saveSoon(); setTimeout(function () { go(i + 1); }, 240);
        });
      });
      B.onkeydown = function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var k = e.key.length === 1 ? e.key.toUpperCase().charCodeAt(0) - 65 : -1, o = $$('.fo', B)[k];
        if (o) { e.preventDefault(); o.click(); }
      };
    }
    if (st.type === 'contact') {
      var nx = $('#fNext'), go2 = function () { var m = contactErr(); err(m); if (m) { var bad = S.name.trim().length < 2 ? '#cName' : !okMail(S.email) ? '#cMail' : '#cTel'; $(bad).focus(); return; } go(i + 1); };
      [['cName', 'name'], ['cMail', 'email'], ['cTel', 'phone']].forEach(function (p, k, all) {
        var el = $('#' + p[0]);
        el.addEventListener('input', function () { S[p[1]] = el.value; err(''); saveSoon(); });
        el.addEventListener('blur', function () { S[p[1]] = el.value.trim(); el.value = S[p[1]]; saveNow(); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (k < all.length - 1) $('#' + all[k + 1][0]).focus(); else go2(); } });
      });
      nx.addEventListener('click', go2);
    }
    if (st.type === 'cal') loadSlots();
  };

  // ── kalender ──
  var DAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'], MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'], tz = 'Europe/Copenhagen';
  var fmtTime = function (iso) { return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', timeZone: tz }).replace('.', ':'); };
  var fmtLong = function (iso) { return new Date(iso).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }) + ' kl. ' + fmtTime(iso); };
  var fmtShort = function (iso) { return new Date(iso).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }) + ' ' + fmtTime(iso); };   // "tor. 5. nov. 20:00" (kort, så knappen holder én linje på små mobiler)
  var cErr = function (m) { var e = $('#cErr'); if (e) e.textContent = m || ''; };
  var slots = null, picked = null;
  var loadSlots = function () {
    var from = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
    fetch('/api/slots?page=' + PAGE + '&from=' + from + '&days=14').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { slots = j; drawDays(); })
      .catch(function () { $('#cDays').innerHTML = ''; cErr('Kalenderen kunne ikke hentes lige nu. Prøv igen om et øjeblik.'); });
  };
  var drawDays = function () {
    var dEl = $('#cDays'), tEl = $('#cTimes'); if (!dEl) return;
    var keys = Object.keys(slots.slots || {}).sort().filter(function (k) { return (slots.slots[k] || []).length; });
    if (!keys.length) { dEl.innerHTML = ''; tEl.innerHTML = ''; cErr('Der er ingen ledige tider lige nu. Kig forbi igen i morgen, så er der kommet nye.'); return; }
    dEl.innerHTML = keys.map(function (k) {
      var d = new Date(k + 'T12:00:00');
      return '<button type="button" class="fday" data-d="' + k + '" aria-pressed="false"><small>' + DAYS[d.getDay()] + '</small><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()] + '</span></button>';
    }).join('');
    var bb = $('#cBook');
    var pickDay = function (k) {
      $$('.fday', dEl).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.d === k)); });
      tEl.innerHTML = slots.slots[k].map(function (iso) { return '<button type="button" class="ftime" data-t="' + esc(iso) + '" aria-pressed="false">' + fmtTime(iso) + '</button>'; }).join('');
      picked = null; bb.disabled = true; bb.innerHTML = 'Vælg et tidspunkt' + arrow;
      $$('.ftime', tEl).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.ftime', tEl).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true');
          picked = b.dataset.t; bb.disabled = false; bb.innerHTML = 'Book ' + esc(fmtShort(picked)) + arrow; cErr('');
          if (matchMedia('(max-width:720px)').matches) bb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      });
    };
    $$('.fday', dEl).forEach(function (b) { b.addEventListener('click', function () { pickDay(b.dataset.d); }); });
    pickDay(keys[0]);
    bb.onclick = book;
  };
  var cookie = function (n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; };
  var book = function () {
    if (!picked) return; var bb = $('#cBook');
    // GHL opretter Google Meet-mødet, det tager typisk 4-6 sekunder
    bb.disabled = true; bb.innerHTML = '<i class="fspin" aria-hidden="true"></i>Booker din tid';
    $$('.fday,.ftime,#fBack', B).forEach(function (x) { x.disabled = true; });
    cErr(''); var e0 = $('#cErr'); if (e0) { e0.classList.add('fwait'); e0.textContent = 'Opretter dit møde og Google Meet-link. Det tager et par sekunder.'; }
    var unlock = function () { $$('.fday,.ftime,#fBack', B).forEach(function (x) { x.disabled = false; }); var e1 = $('#cErr'); if (e1) e1.classList.remove('fwait'); };
    saveNow().then(function () {
      return fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lid: S.lid, start: picked, fbp: cookie('_fbp'), fbc: cookie('_fbc') }) });
    }).then(function (r) { return r.json().then(function (x) { return { ok: r.ok, x: x }; }); }).then(function (res) {
      var e = res.x && res.x.error;
      if (e === 'already booked' && res.x.start) { S.booked = { start: res.x.start }; persist(); render(); return; }
      if (e === 'not eligible') { S.stop = true; persist(); render(); return; }
      if (e === 'missing answers' || e === 'missing contact') { go(0); return; }
      if (!res.ok || !res.x.ok) {
        unlock();
        if (e === 'slot taken') {
          var t = picked; Object.keys(slots.slots).forEach(function (k) { slots.slots[k] = slots.slots[k].filter(function (x) { return x !== t; }); });
          drawDays(); cErr('Den tid blev lige taget. Vælg en anden.'); return;
        }
        if (e === 'too many bookings') { bb.innerHTML = 'Vælg et tidspunkt' + arrow; cErr('Der er allerede booket samtaler fra denne forbindelse. Skriv til os, hvis du skal ændre tiden.'); return; }
        bb.disabled = false; bb.innerHTML = 'Prøv igen' + arrow; cErr('Det lykkedes ikke at booke. Prøv igen om et øjeblik.'); return;
      }
      S.booked = { start: res.x.start || picked, end: res.x.end || null }; S.step = N; persist();
      if (res.x.cv === 1) fireConv();
      render();
    }).catch(function () { unlock(); bb.disabled = false; bb.innerHTML = 'Prøv igen' + arrow; cErr('Ingen forbindelse. Prøv igen om lidt.'); });
  };
  // kun kvalificerede bookinger tælles i annoncerne; samme event_id som serverens CAPI-kald (fbm-<lid>)
  var fireConv = function () {
    if (!LIVE || S.convFired) return;
    S.convFired = true; persist();
    try { if (window.fbq) fbq('track', 'Schedule', { content_name: 'Ansøgning kvalificeret' }, { eventID: 'fbm-' + S.lid }); } catch (e) { }
    try { (window.dataLayer = window.dataLayer || []).push({ event: 'fbm_qualified_booking' }); } catch (e) { }
  };

  // ── stop: kun eget materiale ──
  var renderStop = function () {
    M.classList.add('end');
    B.scrollTop = 0;
    setProg(N - 1, 'Tak for din interesse');
    B.innerHTML = '<div class="fstep fend"><p class="fk">Tak for din interesse</p><h3 class="fq">Vi hjælper desværre kun covermusikere</h3>' +
      '<p class="fh">Vores system er bygget til musikere, der spiller kendte numre til bryllupper, firmafester og private fester. Der kan vi skaffe kunderne. Med dit eget materiale er vi ikke de rigtige til at hjælpe dig, og det vil vi hellere sige ærligt nu end tage din tid.</p>' +
      '<div class="fnav"><button type="button" class="fbtn ghost" data-fbm-close>Tilbage til siden</button></div></div>';
    $$('[data-fbm-close]', B).forEach(function (x) { x.addEventListener('click', close); });
  };

  // ── tak + valgfri forberedelse ──
  var renderDone = function () {
    setProg(N - 1, 'Samtalen er booket');
    var b = S.booked, f = (S.name || '').trim().split(/\s+/)[0] || '';
    var st = new Date(b.start), en = b.end ? new Date(b.end) : new Date(st.getTime() + 60 * 60000);
    var z = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    var title = 'Strategisamtale med Fuldt Booket Musiker', det = 'Google Meet. Linket står i din bekræftelsesmail.';
    var gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(st) + '/' + z(en) + '&details=' + encodeURIComponent(det);
    var ics = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fuldt Booket Musiker//DA', 'BEGIN:VEVENT', 'UID:' + S.lid + '@fuldtbooketmusiker.dk', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(st), 'DTEND:' + z(en), 'SUMMARY:' + title, 'DESCRIPTION:' + det, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    var ex = S.extra || {}, crew = (ex.optraeder || '').split(', ').filter(Boolean);
    var prep = S.extraSent
      ? '<div class="fprep sent"><p class="fk">Tak</p><p class="fh">Oscar har det nu og kigger det igennem før samtalen.</p></div>'
      : '<div class="fprep"><p class="fk">Valgfrit · 30 sekunder</p><h4>Hjælp Oscar med at forberede sig</h4><p class="fh">Så bruger I tiden på din plan i stedet for at gennemgå det grundlæggende.</p>' +
        '<div class="fgrid two">' +
        '<label class="ff"><span>Instagram</span><input class="fin" id="xIg" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(ex.instagram || '') + '" placeholder="@ditnavn"></label>' +
        '<label class="ff"><span>Hjemmeside</span><input class="fin" id="xWeb" type="url" inputmode="url" autocapitalize="off" spellcheck="false" value="' + esc(ex.hjemmeside || '') + '" placeholder="www.ditnavn.dk"></label></div>' +
        '<p class="ff"><span>Hvordan optræder du?</span></p><div class="fchips" role="group" aria-label="Hvordan optræder du?">' + ['Solo', 'Duo', 'Trio / band'].map(function (o) { return '<button type="button" class="fchip" data-v="' + o + '" aria-pressed="' + (crew.indexOf(o) > -1) + '">' + o + '</button>'; }).join('') + '</div>' +
        '<p class="ferr" id="xErr" role="alert"></p><div class="fnav"><button type="button" class="fbtn" id="xSend">Send til Oscar' + arrow + '</button></div></div>';
    B.scrollTop = 0;
    B.innerHTML = '<div class="fstep fend"><div class="fok" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>' +
      '<p class="fk">Samtalen er booket</p><h3 class="fq">Tak' + (f ? ', ' + esc(f) : '') + '. Vi ses ' + esc(fmtLong(b.start)) + '.</h3>' +
      '<p class="fh">Invitationen med link til Google Meet er på vej til ' + esc(S.email || 'din mail') + '. Læg tiden i kalenderen, så den ikke glipper.</p>' +
      '<div class="fadd"><a class="fbtn sm ghost" href="' + gcal + '" target="_blank" rel="noopener">Google Kalender</a><a class="fbtn sm ghost" href="' + ics + '" download="strategisamtale.ics">Apple / Outlook</a></div>' + prep + '</div>';
    if (!S.extraSent) wireExtra();
  };
  var wireExtra = function () {
    S.extra = S.extra || {};
    var ig = $('#xIg'), web = $('#xWeb');
    var sync = function () { S.extra.instagram = ig.value.trim(); S.extra.hjemmeside = web.value.trim(); S.extra.optraeder = $$('.fchip[aria-pressed=true]', B).map(function (x) { return x.dataset.v; }).join(', '); persist(); };
    [ig, web].forEach(function (el) { el.addEventListener('input', sync); });
    $$('.fchip', B).forEach(function (c) { c.addEventListener('click', function () { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); sync(); }); });
    $('#xSend').addEventListener('click', function () {
      sync();
      var e = S.extra, x = $('#xErr');
      if (!e.instagram && !e.hjemmeside && !e.optraeder) { x.textContent = 'Udfyld mindst ét felt, eller luk bare vinduet.'; return; }
      ['instagram', 'hjemmeside', 'optraeder'].forEach(function (k) { if (e[k]) S.a[k] = e[k]; });
      var btn = $('#xSend'); btn.disabled = true; btn.textContent = 'Sender...';
      saveNow(false, true).then(function (ok) {
        if (!ok) { btn.disabled = false; btn.innerHTML = 'Prøv igen' + arrow; x.textContent = 'Det blev ikke sendt. Prøv igen.'; return; }
        S.extraSent = true; persist(); renderDone();
      });
    });
  };
})();
