/* Oscars gig-sider (/firmafest, /bryllup): typeform-formular der gemmer mens man skriver,
   egen kalender (GET /api/slots -> POST /api/book, Worker sender til GHL), tak-visning.
   Konfiguration i window.EV (genereret af gen_events.py). */
(function () {
  'use strict';
  var EV = window.EV; if (!EV) return;
  document.documentElement.classList.add('js');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ── sidens småting: nav, reveal, video ved scroll, sticky CTA, "læs mere" ──
  var nav = $('#nav'), sticky = $('#sticky'), hero = $('#top');
  var onScroll = function () {
    if (nav) nav.classList.toggle('scrolled', scrollY > 20);
    if (sticky && hero) sticky.classList.toggle('on', hero.getBoundingClientRect().bottom < 0 && !document.body.classList.contains('lock'));
  };
  onScroll(); addEventListener('scroll', onScroll, { passive: true });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.08 });
    $$('.rv').forEach(function (el) { io.observe(el); });
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (v.dataset.src && !v.src) { v.src = v.dataset.src; } var p = v.play(); if (p && p.catch) p.catch(function () { }); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: 0.35 });
    $$('video[data-src]').forEach(function (v) { vo.observe(v); });
  } else { $$('.rv').forEach(function (el) { el.classList.add('in'); }); }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) $$('video[autoplay]').forEach(function (v) { v.pause(); });
  $$('[data-more]').forEach(function (b) { b.addEventListener('click', function () { var r = b.closest('.rev'); r.classList.toggle('clamp'); b.textContent = r.classList.contains('clamp') ? 'Læs hele anmeldelsen' : 'Vis mindre'; }); });
  $$('.rev').forEach(function (r) { var p = $('p', r), b = $('[data-more]', r); if (p && b && p.scrollHeight <= p.clientHeight + 2) { r.classList.remove('clamp'); b.remove(); } });

  // ── first-touch-kilde (sendes med leadet) ──
  var q = new URLSearchParams(location.search);
  var src = null; try { src = JSON.parse(ls('ev_src') || 'null'); } catch (e) { }
  if (!src) {
    var rh = ''; try { rh = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { }
    src = { ref_host: rh, utm_source: q.get('utm_source') || (q.get('fbclid') ? 'facebook' : q.get('gclid') ? 'google' : ''), utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || '', utm_content: q.get('utm_content') || '', landing: location.pathname, ts: Date.now() };
    ls('ev_src', JSON.stringify(src));
  }

  // ── state ──
  var KEY = 'ev_state_' + EV.page;
  var uuid = function () { try { return crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); } };
  var S; try { S = JSON.parse(ls(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || !S.lid) S = { lid: uuid(), answers: {}, name: '', company: '', email: '', phone: '', step: 0, done: false, booked: null };
  var persist = function () { ls(KEY, JSON.stringify(S)); };
  var steps = EV.steps, total = steps.length + 1; // + kalender

  // ── gem mens der skrives ──
  var tSave = null, inflight = false, again = false, savedEl = $('#fmSaved');
  var payload = function () {
    var a = {}; for (var k in S.answers) a[k] = S.answers[k];
    if (S.company) a.firma = S.company;
    return { lid: S.lid, page: EV.page, answers: a, name: S.name, email: S.email, phone: S.phone, step: S.step, done: !!S.done, src: src, vid: ls('bk_vid') || '', sid: ls('bk_sid') || '' };
  };
  var hasData = function () { return S.name || S.email || S.phone || Object.keys(S.answers).length; };
  var saveNow = function (beacon) {
    clearTimeout(tSave); persist();
    if (!hasData()) return Promise.resolve();
    var body = JSON.stringify(payload());
    if (beacon && navigator.sendBeacon) { try { navigator.sendBeacon('/api/lead', new Blob([body], { type: 'application/json' })); return Promise.resolve(); } catch (e) { } }
    if (inflight) { again = true; return Promise.resolve(); }
    inflight = true;
    return fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
      .then(function (r) { if (r.ok && savedEl) { savedEl.hidden = false; } })
      .catch(function () { })
      .then(function () { inflight = false; if (again) { again = false; saveNow(); } });
  };
  var saveSoon = function () { persist(); clearTimeout(tSave); tSave = setTimeout(saveNow, 700); };
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveNow(true); });
  addEventListener('pagehide', function () { saveNow(true); });

  // ── modal ──
  var M = $('#bkModal'), B = $('#fmBody'), prog = $('#fmProg'), last = null;
  var open = function (e) {
    if (e) e.preventDefault();
    last = document.activeElement;
    try { dispatchEvent(new CustomEvent('bk:open', { detail: { el: e && e.currentTarget || null, sec: 'hash', label: 'form' } })); } catch (_) { }
    M.hidden = false; requestAnimationFrame(function () { M.classList.add('open'); });
    document.body.classList.add('lock'); onScroll();
    render();
  };
  var close = function () {
    saveNow(); M.classList.remove('open'); document.body.classList.remove('lock');
    setTimeout(function () { M.hidden = true; }, 250); if (last && last.focus) last.focus(); onScroll();
    if (location.hash === '#form') history.replaceState(null, '', location.pathname + location.search);
  };
  $$('[data-open]').forEach(function (b) { b.addEventListener('click', open); });
  $('#fmX').addEventListener('click', close);
  M.addEventListener('click', function (e) { if (e.target === M) close(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !M.hidden) close(); });
  if (location.hash === '#form') setTimeout(open, 50);

  var setProg = function (i) { prog.style.width = Math.round(Math.min(1, i / total) * 100) + '%'; };
  var focusFirst = function () { var f = $('input,button.opt,button.day,button.btn', B); if (f && matchMedia('(hover:hover)').matches) f.focus({ preventScroll: true }); };

  // ── trin ──
  var render = function () {
    if (S.booked || S.callback) return renderDone();
    if (S.done) return renderCal();
    var i = Math.min(S.step, steps.length - 1), st = steps[i];
    setProg(i);
    var head = '<div class="fq"><span class="k">' + (i + 1) + ' / ' + steps.length + '</span><h3>' + esc(st.q) + '</h3>' + (st.help ? '<p class="h">' + esc(st.help) + '</p>' : '');
    var v = S.answers[st.id] || '', body = '';
    if (st.type === 'date') {
      var today = new Date(); var min = today.toISOString().slice(0, 10);
      var alt = v === 'Ikke fast endnu';
      body = '<input class="fin" type="date" id="fIn" min="' + min + '" value="' + (alt ? '' : esc(v)) + '" aria-label="' + esc(st.q) + '">' +
        '<button type="button" class="falt" id="fAlt" aria-pressed="' + alt + '">' + esc(st.alt) + '</button>';
    } else if (st.type === 'text') {
      body = '<input class="fin" type="text" id="fIn" value="' + esc(v) + '" placeholder="' + esc(st.ph || '') + '" autocomplete="' + (st.ac || 'on') + '" enterkeyhint="next" aria-label="' + esc(st.q) + '">';
    } else if (st.type === 'choice' || st.type === 'multi') {
      var sel = v ? v.split(', ') : [];
      body = '<div class="opts" role="group" aria-label="' + esc(st.q) + '">' + st.opts.map(function (o, k) {
        return '<button type="button" class="opt" data-v="' + esc(o) + '" aria-pressed="' + (sel.indexOf(o) > -1) + '"><kbd>' + String.fromCharCode(65 + k) + '</kbd>' + esc(o) + '</button>';
      }).join('') + '</div>';
    } else if (st.type === 'contact') {
      body = '<div class="fgrid">' +
        '<div><label class="flab" for="cName">' + (EV.page === 'bryllup' ? 'Jeres navne' : 'Dit navn') + '</label><input class="fin" id="cName" autocomplete="name" value="' + esc(S.name) + '" placeholder="' + (EV.page === 'bryllup' ? 'Fx Sofie og Mads' : 'Fornavn og efternavn') + '"></div>' +
        (st.company ? '<div><label class="flab" for="cCo">Virksomhed</label><input class="fin" id="cCo" autocomplete="organization" value="' + esc(S.company) + '" placeholder="Firmanavn"></div>' : '') +
        '<div><label class="flab" for="cMail">E-mail</label><input class="fin" id="cMail" type="email" inputmode="email" autocomplete="email" value="' + esc(S.email) + '" placeholder="navn@mail.dk"></div>' +
        '<div><label class="flab" for="cTel">Telefon</label><input class="fin" id="cTel" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(S.phone) + '" placeholder="12 34 56 78"></div></div>';
    }
    var isLast = i === steps.length - 1, auto = st.type === 'choice';
    var navh = '<p class="ferr" id="fErr" role="alert"></p><div class="fnav">' +
      (auto ? '' : '<button type="button" class="btn" id="fNext">' + (isLast ? 'Vælg tid til en kort snak' : 'Næste') + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>') +
      (i > 0 ? '<button type="button" class="fback" id="fBack">Tilbage</button>' : '') +
      (auto ? '' : '<span class="hint">eller tryk Enter ↵</span>') + '</div></div>';
    B.innerHTML = head + body + navh; B.scrollTop = 0;
    wire(st, i);
    focusFirst();
  };

  var err = function (m) { var e = $('#fErr'); if (e) e.textContent = m || ''; };
  var digits = function (s) { return (s || '').replace(/\D/g, ''); };
  var okMail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || ''); };
  var next = function (i) { S.step = i + 1; if (S.step >= steps.length) { S.done = true; S.step = steps.length; } saveNow(); render(); };

  var wire = function (st, i) {
    var inp = $('#fIn'), nx = $('#fNext'), bk = $('#fBack');
    if (bk) bk.addEventListener('click', function () { S.step = Math.max(0, i - 1); persist(); render(); });
    var validate = function () {
      if (st.type === 'date') { if (!S.answers.dato) return 'Vælg en dato, eller tryk på at den ikke ligger fast endnu.'; }
      else if (st.type === 'text') { if ((S.answers[st.id] || '').trim().length < 2) return 'Skriv gerne hvor festen skal holdes, så vi kan give et præcist tilbud.'; }
      else if (st.type === 'multi') { if (!S.answers[st.id]) return 'Vælg mindst én.'; }
      else if (st.type === 'contact') {
        if (S.name.trim().length < 2) return 'Skriv dit navn.';
        if (!okMail(S.email)) return 'Tjek e-mailen, den ser ikke helt rigtig ud.';
        if (digits(S.phone).length < 8) return 'Skriv et telefonnummer med mindst 8 cifre.';
      }
      return '';
    };
    var go = function () { var m = validate(); err(m); if (!m) next(i); };
    if (nx) nx.addEventListener('click', go);
    if (inp) {
      inp.addEventListener('input', function () { S.answers[st.id] = inp.value; var a = $('#fAlt'); if (a) a.setAttribute('aria-pressed', 'false'); err(''); saveSoon(); });
      inp.addEventListener('change', function () { S.answers[st.id] = inp.value; saveSoon(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    }
    var alt = $('#fAlt');
    if (alt) alt.addEventListener('click', function () { S.answers.dato = 'Ikke fast endnu'; if (inp) inp.value = ''; alt.setAttribute('aria-pressed', 'true'); saveSoon(); setTimeout(function () { next(i); }, 220); });
    $$('.opt', B).forEach(function (b) {
      b.addEventListener('click', function () {
        if (st.type === 'choice') { $$('.opt', B).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); S.answers[st.id] = b.dataset.v; saveSoon(); setTimeout(function () { next(i); }, 260); }
        else { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); S.answers[st.id] = $$('.opt[aria-pressed=true]', B).map(function (x) { return x.dataset.v; }).join(', '); err(''); saveSoon(); }
      });
    });
    if (st.type === 'choice' || st.type === 'multi') {
      B.onkeydown = function (e) {
        if (e.target.tagName === 'INPUT') return;
        var k = e.key.toUpperCase().charCodeAt(0) - 65, o = $$('.opt', B)[k];
        if (e.key.length === 1 && o) { e.preventDefault(); o.click(); }
        else if (e.key === 'Enter' && nx) { e.preventDefault(); go(); }
      };
    } else B.onkeydown = null;
    if (st.type === 'contact') {
      [['cName', 'name'], ['cCo', 'company'], ['cMail', 'email'], ['cTel', 'phone']].forEach(function (p) {
        var el = $('#' + p[0]); if (!el) return;
        el.addEventListener('input', function () { S[p[1]] = el.value; err(''); saveSoon(); });
        el.addEventListener('blur', function () { S[p[1]] = el.value; saveNow(); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var all = $$('.fin', B), j = all.indexOf(el); if (j < all.length - 1) all[j + 1].focus(); else go(); } });
      });
    }
  };

  // ── kalender ──
  var DAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var tz = 'Europe/Copenhagen';
  var fmtTime = function (iso) { return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', timeZone: tz }).replace('.', ':'); };
  var fmtLong = function (iso) { var d = new Date(iso); return d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }) + ' kl. ' + fmtTime(iso); };
  var first = function () { return (S.name || '').trim().split(/\s+/)[0] || ''; };
  var slotsCache = null;
  var renderCal = function () {
    setProg(steps.length);
    B.onkeydown = null;
    B.innerHTML = '<div class="fq"><span class="k">Sidste trin</span><h3>' + (first() ? 'Tak, ' + esc(first()) + '. ' : '') + 'Hvornår passer det med en kort snak?</h3>' +
      '<p class="h">Vi ringer jer op og hører om ' + (EV.page === 'bryllup' ? 'jeres bryllup' : 'jeres fest') + ', så I får et tilbud, der passer. Vælg bare et tidspunkt, vi har allerede jeres oplysninger.</p>' +
      '<div class="days" id="cDays"><div class="skel" style="width:100%"></div></div><div class="times" id="cTimes"></div>' +
      '<p class="ferr" id="fErr" role="alert"></p><div class="calfoot"><button type="button" class="btn" id="cBook" disabled>Vælg et tidspunkt</button>' +
      '<button type="button" class="falt" id="cCall">Ingen af tiderne passer. Ring mig hellere op</button>' +
      '<button type="button" class="fback" id="fBack" style="align-self:flex-start">Tilbage</button></div></div>';
    $('#fBack').addEventListener('click', function () { S.done = false; S.step = steps.length - 1; persist(); render(); });
    $('#cCall').addEventListener('click', function () { S.callback = true; persist(); saveNow(); renderDone(); });
    var from = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
    var p = slotsCache ? Promise.resolve(slotsCache) : fetch('/api/slots?page=' + EV.page + '&from=' + from + '&days=14').then(function (r) { if (!r.ok) throw 0; return r.json(); });
    p.then(function (j) { slotsCache = j; drawDays(j); }).catch(function () {
      $('#cDays').innerHTML = ''; err('Kalenderen kunne ikke hentes lige nu. Tryk nedenfor, så ringer vi jer op.');
    });
  };
  var picked = null;
  var drawDays = function (j) {
    var dEl = $('#cDays'), tEl = $('#cTimes'), keys = Object.keys(j.slots || {}).sort().filter(function (k) { return (j.slots[k] || []).length; });
    if (!keys.length) { dEl.innerHTML = ''; err('Der er ingen ledige tider de næste dage. Tryk nedenfor, så ringer vi jer op.'); return; }
    dEl.innerHTML = keys.map(function (k) {
      var d = new Date(k + 'T12:00:00');
      return '<button type="button" class="day" data-d="' + k + '" aria-pressed="false"><small>' + DAYS[d.getDay()] + '</small><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()] + '</span></button>';
    }).join('');
    var pickDay = function (k) {
      $$('.day', dEl).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.d === k)); });
      tEl.innerHTML = j.slots[k].map(function (iso) { return '<button type="button" class="time" data-t="' + iso + '" aria-pressed="false">' + fmtTime(iso) + '</button>'; }).join('');
      picked = null; var bb = $('#cBook'); bb.disabled = true; bb.textContent = 'Vælg et tidspunkt';
      $$('.time', tEl).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.time', tEl).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true');
          picked = b.dataset.t; bb.disabled = false; bb.textContent = 'Book ' + fmtLong(picked); err('');
          bb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      });
    };
    $$('.day', dEl).forEach(function (b) { b.addEventListener('click', function () { pickDay(b.dataset.d); }); });
    pickDay(keys[0]);
    $('#cBook').onclick = function () {
      if (!picked) return; var bb = $('#cBook'); bb.disabled = true; bb.textContent = 'Booker...';
      saveNow().then(function () {
        return fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lid: S.lid, start: picked }) });
      }).then(function (r) { return r.json().then(function (x) { return { ok: r.ok, x: x }; }); }).then(function (res) {
        var e = res.x && res.x.error;
        if (e === 'already booked' && res.x.start) { S.booked = { start: res.x.start, end: null }; persist(); renderDone(); return; }
        if (!res.ok || !res.x.ok) {
          slotsCache = null;
          if (e === 'slot taken') { renderCal(); setTimeout(function () { err('Den tid blev lige taget. Vælg en anden.'); }, 0); return; }
          err('Det lykkedes ikke at booke. Prøv igen, eller tryk nedenfor, så ringer vi.'); bb.disabled = false; bb.textContent = 'Prøv igen';
          return;
        }
        S.booked = { start: res.x.start || picked, end: res.x.end || null }; persist(); renderDone(true);
      }).catch(function () { bb.disabled = false; bb.textContent = 'Prøv igen'; err('Ingen forbindelse. Prøv igen om lidt.'); });
    };
  };

  // ── tak ──
  var renderDone = function (fresh) {
    prog.style.width = '100%'; B.onkeydown = null;
    var b = S.booked, f = first();
    var gcal = '', ics = '';
    if (b) {
      var st = new Date(b.start), en = b.end ? new Date(b.end) : new Date(st.getTime() + 20 * 60000);
      var z = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
      var title = 'Snak med Oscar Jønsson om musikken', det = 'Vi ringer dig op på ' + (S.phone || 'dit nummer') + '.';
      gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(st) + '/' + z(en) + '&details=' + encodeURIComponent(det);
      ics = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oscar Jonsson Musik//DA', 'BEGIN:VEVENT', 'UID:' + S.lid + '@fuldtbooketmusiker.dk', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(st), 'DTEND:' + z(en), 'SUMMARY:' + title, 'DESCRIPTION:' + det, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    }
    B.innerHTML = '<div class="fq"><div class="done-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>' +
      '<h3>' + (b ? 'Tak' + (f ? ', ' + esc(f) : '') + '. Snakken er booket.' : 'Tak' + (f ? ', ' + esc(f) : '') + '. Vi ringer jer op.') + '</h3>' +
      (b ? '<p class="big" style="font-size:1.35rem">' + esc(fmtLong(b.start)) + '</p><p class="h">Vi ringer på ' + esc(S.phone) + '. Læg tiden i kalenderen, så den ikke glipper.</p>' +
        '<div class="cal-add"><a class="btn sm" href="' + gcal + '" target="_blank" rel="noopener">Google Kalender</a><a class="btn sm ghost" href="' + ics + '" download="snak-med-oscar.ics">Apple / Outlook</a></div>'
        : '<p class="h">Vi har jeres oplysninger og ringer på ' + esc(S.phone || 'jeres nummer') + ' inden for én hverdag.</p>') +
      '<p class="k" style="margin-top:8px">Det sker nu</p><div class="next3">' +
      '<div>' + (b ? 'Vi ringer jer op på tidspunktet. Samtalen tager cirka et kvarter.' : 'Vi ringer jer op og hører om aftenen. Det tager cirka et kvarter.') + '</div>' +
      '<div>Vi taler om gæsterne, programmet og den stemning, I ønsker.</div>' +
      '<div>I får et tilbud på musikken, tilpasset ' + (EV.page === 'bryllup' ? 'jeres bryllup' : 'jeres firmafest') + '.</div></div>' +
      '<button type="button" class="btn ghost" id="dClose" style="align-self:flex-start;margin-top:6px">Tilbage til siden</button></div>';
    $('#dClose').addEventListener('click', close);
    if (fresh || !S.leadFired) {
      S.leadFired = true; persist();
      try { if (window.fbq) fbq('track', b ? 'Schedule' : 'Lead', { content_name: EV.page }, { eventID: S.lid }); } catch (e) { }
      try { (window.dataLayer = window.dataLayer || []).push({ event: b ? 'ev_booked' : 'ev_lead', page: EV.page }); } catch (e) { }
    }
  };
})();
