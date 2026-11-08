// Ansøgningsform til fuldtbooketmusiker.dk (4/11 2026): ét spørgsmål ad gangen, kalenderen til sidst.
// Svar gemmes løbende via /api/lead (page=ansoegning). Booking via /api/book: serveren scorer A/B/C og vælger kalender.
// Covermusik er et hårdt stop før kontaktinfo. Instagram/hjemmeside/besætning spørges først efter bookingen.
// window.FBM_LIVE (sat af gen_newform.py) styrer om Meta-pixel/dataLayer får konverteringen. Kun kvalificerede (cv=1) tælles.
// window.FBM_LANG='en' (/international, 8/11 2026): engelske tekster og euro-intervaller, men SAMME svar-værdier (data-v) som den danske,
// så score, regler i /admin og GHL-felterne er fælles. Tider vises i besøgendes egen tidszone. page=international.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var EN = window.FBM_LANG === 'en', t = function (da, en) { return EN ? en : da; };
  var LIVE = window.FBM_LIVE === true, PAGE = EN ? 'international' : 'ansoegning', KNOCKOUT = 'Kun mit eget materiale', BASE = EN ? '/international/' : '/';
  var arrow = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

  // svarmulighederne skal være præcis de samme som i worker.js (FBM_APP.opts) og GHL-felterne
  // en: engelsk tekst + labels (samme rækkefølge som opts). Euro-intervallerne svarer til kr.-intervallerne (1 € ≈ 7,5 kr.)
  var STEPS = [
    { id: 'jobs', q: 'Hvor mange betalte jobs har du spillet det seneste år?', opts: ['0–9', '10–29', '30–59', '60–99', '100+'],
      en: { q: 'How many paid gigs have you played in the last 12 months?' } },
    { id: 'pris', q: 'Hvad tager du typisk for et spillejob i dag?', opts: ['Under 5.000 kr.', '5.000–9.999 kr.', '10.000–19.999 kr.', '20.000+ kr.'],
      en: { q: 'What do you typically charge per gig today?', opts: ['Under €700', '€700–1,300', '€1,300–2,700', '€2,700+'] } },
    { id: 'pris_maal', q: 'Hvad vil du gerne kunne tage for et spillejob?', opts: ['Under 10.000 kr.', '10.000–14.999 kr.', '15.000–24.999 kr.', '25.000+ kr.'],
      en: { q: 'What would you like to charge per gig?', opts: ['Under €1,300', '€1,300–2,000', '€2,000–3,300', '€3,300+'] } },
    { id: 'jobs_maal', q: 'Hvor mange jobs vil du gerne spille om året?', opts: ['Under 50', '50–99', '100+'],
      en: { q: 'How many gigs would you like to play per year?' } },
    { id: 'x3', q: 'Er du åben for at tage 2–3x mere for dine jobs, hvis vi finder kunderne, der vil betale det?', opts: ['Ja', 'Nej'],
      en: { q: 'Are you open to charging 2–3x more per gig if we find the clients who will pay it?', opts: ['Yes', 'No'] } },
    { id: 'cover', q: 'Spiller du covermusik eller dit eget materiale?', help: 'Vi hjælper musikere, der spiller kendte numre til bryllupper, firmafester og private fester.', opts: ['Covermusik', 'Både covermusik og eget materiale', KNOCKOUT],
      en: { q: 'Do you play covers or your own material?', help: 'We help musicians who play well-known songs at weddings, corporate events and private parties.', opts: ['Covers', 'Both covers and my own material', 'Only my own material'] } },
    { id: 'contact', type: 'contact', q: 'Hvor skal vi sende din ansøgning hen, hvis du bliver godkendt?', help: 'Vi bruger det kun til din ansøgning og samtale. Ingen nyhedsbreve.',
      en: { q: 'Where should we send your application if you are approved?', help: 'We only use this for your application and call. No newsletters.' } },
    { id: 'oms', q: 'Hvad omsætter du for på musikken om måneden i dag?', help: 'Et cirka-tal er fint.', opts: ['Under 10.000 kr.', '10.000–24.999 kr.', '25.000–49.999 kr.', '50.000–99.999 kr.', '100.000+ kr.'],
      en: { q: 'How much do you earn from music per month today?', help: 'A rough number is fine.', opts: ['Under €1,300', '€1,300–3,300', '€3,300–6,700', '€6,700–13,000', '€13,000+'] } },
    { id: 'invest', q: 'Hvor meget er du villig til at investere om måneden for at nå dit mål?', opts: ['0–5.000 kr.', '5.000–10.000 kr.', '10.000–20.000 kr.', '20.000–50.000 kr.', '50.000–100.000 kr.'],
      en: { q: 'How much are you willing to invest per month to reach your goal?', opts: ['€0–700', '€700–1,300', '€1,300–2,700', '€2,700–6,700', '€6,700–13,000'] } },
    { id: 'cal', type: 'cal', q: 'Vælg en tid til din strategisamtale', help: '1 time på Google Meet med Oscar. Du får en invitation på mail med det samme.',
      en: { q: 'Pick a time for your strategy call', help: '1 hour on Google Meet with Oscar. You will get an email invitation right away.' } }
  ];
  // engelsk: spørgsmål/hjælp/labels fra .en; værdien der gemmes (data-v) er altid den danske
  if (EN) STEPS.forEach(function (st) { st.da = st.opts; if (st.en) { st.q = st.en.q; st.help = st.en.help || ''; } });
  var label = function (st, k) { return EN && st.en && st.en.opts ? st.en.opts[k] : st.opts[k]; };
  var labelOf = function (id, v) { var st = STEPS.filter(function (x) { return x.id === id; })[0], k = st && st.opts ? st.opts.indexOf(v) : -1; return k > -1 ? label(st, k) : v; };
  var N = STEPS.length;
  // hvilke svar der stopper formen styres i /admin (Ansøgningsform); standard indtil svaret er hentet
  var STOP = { cover: [KNOCKOUT] };
  fetch('/api/form-config').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.stop) STOP = j.stop; }).catch(function () { });
  // investeringsspørgsmålet bygger på deres eget mål (som aftalt i kaldet 4/11)
  var investGoal = function () {
    var j = S.a.jobs_maal, p = S.a.pris_maal;
    var pTxt = p && p !== 'Under 10.000 kr.' ? t(' til ' + p + ' pr. job', ' at ' + labelOf('pris_maal', p) + ' per gig') : '';
    if (j === '50–99' || j === '100+') return t('Dit mål: ' + j + ' jobs om året', 'Your goal: ' + j + ' gigs a year') + pTxt + '.';
    return t('Dit mål: flere jobs', 'Your goal: more gigs') + (pTxt || t(' til bedre priser', ' at better prices')) + '.';
  };

  // ── kilde (første besøg) ──
  var q = new URLSearchParams(location.search), src = null;
  try { src = JSON.parse(ls('fbm_src') || 'null'); } catch (e) { }
  if (!src) {
    var rh = ''; try { rh = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { }
    src = { ref_host: rh, utm_source: q.get('utm_source') || (q.get('fbclid') ? 'facebook' : q.get('gclid') ? 'google' : ''), utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || '', utm_content: q.get('utm_content') || '', landing: location.pathname };
    ls('fbm_src', JSON.stringify(src));
  }

  // ── state ──
  var KEY = EN ? 'fbm_app_en_v1' : 'fbm_app_v1';
  var uuid = function () { try { return crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); } };
  var S; try { S = JSON.parse(ls(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || !S.lid) S = { lid: uuid(), a: {}, name: '', email: '', phone: '', step: 0, stop: false, booked: null, extraSent: false };
  var persist = function () { ls(KEY, JSON.stringify(S)); };

  // ── gem mens der svares ──
  var tSave = null, inflight = false, again = false;
  // engelsk: euro-svarene med som tekst (_eur), så Oscar kan se hvad de faktisk valgte (GHL-felterne har kr.-intervallerne)
  var eur = function () { return ['pris', 'pris_maal', 'oms', 'invest'].filter(function (k) { return S.a[k]; }).map(function (k) { return k + ': ' + labelOf(k, S.a[k]); }).join('; '); };
  var payload = function (extra) { return { lid: S.lid, page: PAGE, answers: EN ? Object.assign({}, S.a, { _eur: eur() }) : S.a, name: S.name, email: S.email, phone: S.phone, step: S.step, done: S.step >= N - 1, src: src, extra: !!extra, vid: ls('bk_vid') || '', sid: ls('bk_sid') || '' }; };
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
  // modal på forsiden (#fbmModal) eller inline på tak-siderne (#fbmTak: kun 'sidste trin' efter booking)
  var M = $('#fbmModal'), INL = M ? null : $('#fbmTak');
  if (!M && !INL) return;
  var B = M ? $('#fbmBody') : INL, bar = $('#fbmBar') || { style: {} }, stepLbl = $('#fbmStep') || {}, last = null;
  var MC = M ? M.classList : { add: function () { }, remove: function () { }, toggle: function () { } };
  var lockScroll = function (on) { document.documentElement.classList.toggle('fbm-lock', on); document.body.classList.toggle('bk-lock', on); };
  var open = function (e) {
    if (e) e.preventDefault();
    last = document.activeElement;
    try { dispatchEvent(new CustomEvent('bk:open', { detail: { el: e && e.currentTarget || null } })); } catch (_) { }
    M.hidden = false; requestAnimationFrame(function () { MC.add('open'); });
    lockScroll(true);
    try { history.replaceState(null, '', location.pathname + location.search + '#ansoeg'); } catch (_) { }
    render();
  };
  var close = function () {
    saveNow(); MC.remove('open'); lockScroll(false);
    setTimeout(function () { M.hidden = true; }, 300); if (last && last.focus) last.focus({ preventScroll: true });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { }
  };
  if (M) {
    $$('a[href="#ansoeg"],#applyBtn,[data-book]').forEach(function (a) { a.addEventListener('click', open); });
    $$('[data-fbm-close]', M).forEach(function (x) { x.addEventListener('click', close); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && !M.hidden) close(); });
    if (location.hash === '#ansoeg' || location.hash === '#book') setTimeout(open, 60);
  }

  var setProg = function (i, lbl) {
    bar.style.transform = 'scaleX(' + Math.max(0.03, Math.min(1, i / (N - 1))) + ')';
    stepLbl.textContent = lbl != null ? lbl : t('Trin ', 'Step ') + (i + 1) + t(' af ', ' of ') + N;
  };
  var focusFirst = function () { if (!matchMedia('(hover:hover)').matches) return; var f = $('input,.fo,.fday,.fbtn', B); if (f) f.focus({ preventScroll: true }); };
  var head = function (i, qtxt, help, pre) {
    return '<p class="fk">' + String(i + 1).padStart(2, '0') + ' <span>/ ' + String(N).padStart(2, '0') + '</span></p>' + (pre ? '<p class="fpre">' + esc(pre) + '</p>' : '') + '<h3 class="fq" id="fbmQ">' + esc(qtxt) + '</h3>' + (help ? '<p class="fh">' + esc(help) + '</p>' : '');
  };
  var nav = function (i, nextLabel) {
    return '<p class="ferr" id="fErr" role="alert"></p><div class="fnav">' +
      (nextLabel ? '<button type="button" class="fbtn" id="fNext">' + esc(nextLabel) + arrow + '</button>' : '') +
      (i > 0 ? '<button type="button" class="fback" id="fBack">' + t('Tilbage', 'Back') + '</button>' : '') +
      (nextLabel ? '<span class="fhint">' + t('eller tryk Enter ↵', 'or press Enter ↵') + '</span>' : '') + '</div>';
  };
  var err = function (m) { var e = $('#fErr'); if (e) e.textContent = m || ''; };
  var digits = function (s) { return (s || '').replace(/\D/g, ''); };
  var okMail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || ''); };
  var contactErr = function () {
    if (S.name.trim().length < 2) return t('Skriv dit navn.', 'Please enter your name.');
    if (!okMail(S.email)) return t('Tjek e-mailen. Den ser ikke helt rigtig ud.', 'Please check your email. It does not look quite right.');
    if (digits(S.phone).length < 8) return t('Skriv et telefonnummer med mindst 8 cifre.', 'Please enter your phone number with country code.');
    if (EN && !/^\s*(\+|00)/.test(S.phone)) return 'Please add your country code, e.g. +44.';
    return '';
  };
  // første trin, der mangler et svar (fx hvis nogen hopper tilbage og ændrer noget)
  // engelsk: landekoden foreslås ud fra browserens sprog/region (kan rettes)
  var DIAL = { GB: 44, US: 1, CA: 1, AU: 61, NZ: 64, IE: 353, DE: 49, AT: 43, CH: 41, NL: 31, BE: 32, FR: 33, ES: 34, PT: 351, IT: 39, SE: 46, NO: 47, FI: 358, IS: 354, PL: 48, ZA: 27, AE: 971, DK: 45 };
  var dialGuess = function () {
    if (!EN) return '';
    var r = ''; try { (navigator.languages || [navigator.language]).some(function (l) { var m = /-([A-Za-z]{2})$/.exec(l || ''); if (m) r = m[1].toUpperCase(); return !!m; }); } catch (e) { }
    return DIAL[r] ? '+' + DIAL[r] + ' ' : '';
  };
  var firstMissing = function () {
    for (var i = 0; i < N - 1; i++) { var st = STEPS[i]; if (st.type === 'contact' ? contactErr() : !S.a[st.id]) return i; }
    return N - 1;
  };
  var go = function (i) { S.step = Math.max(0, Math.min(i, firstMissing())); saveNow(); render(); };

  var render = function () {
    MC.remove('wide'); MC.toggle('end', !!(S.booked || S.stop));
    if (S.booked) return renderDone();
    if (S.stop) return renderStop();
    var i = Math.min(S.step, firstMissing()), st = STEPS[i];
    setProg(i);
    var html;
    if (st.type === 'contact') {
      html = head(i, st.q, st.help) + '<div class="fgrid">' +
        '<label class="ff"><span>' + t('Fulde navn', 'Full name') + '</span><input class="fin" id="cName" autocomplete="name" value="' + esc(S.name) + '" placeholder="' + t('Fornavn og efternavn', 'First and last name') + '"></label>' +
        '<label class="ff"><span>E-mail</span><input class="fin" id="cMail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="' + esc(S.email) + '" placeholder="' + t('navn@mail.dk', 'name@email.com') + '"></label>' +
        '<label class="ff"><span>' + t('Telefon', 'Phone (with country code)') + '</span><input class="fin" id="cTel" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(S.phone || dialGuess()) + '" placeholder="' + t('12 34 56 78', '+44 7700 900123') + '"></label></div>' +
        nav(i, t('Fortsæt', 'Continue'));
    } else if (st.type === 'cal') {
      MC.add('wide');
      html = head(i, st.q, st.help) + '<div class="fcal"><div class="fdays" id="cDays" role="group" aria-label="' + t('Dag', 'Day') + '"><div class="fskel"></div><div class="fskel"></div><div class="fskel"></div><div class="fskel"></div></div>' +
        '<div class="ftimes" id="cTimes" role="group" aria-label="' + t('Tidspunkt', 'Time') + '"></div></div>' + (EN ? '<p class="fh ftz">Times are shown in your time zone (' + esc(tz.replace(/_/g, ' ')) + ').</p>' : '') +
        '<p class="ferr" id="cErr" role="alert"></p><div class="fnav"><button type="button" class="fbtn" id="cBook" disabled>' + t('Vælg et tidspunkt', 'Pick a time') + arrow + '</button><button type="button" class="fback" id="fBack">' + t('Tilbage', 'Back') + '</button></div>';
    } else {
      var v = S.a[st.id] || '';
      html = (st.id === 'invest' ? head(i, st.q, '', investGoal()) : head(i, st.q, st.help)) + '<div class="fopts" role="radiogroup" aria-labelledby="fbmQ">' + st.opts.map(function (o, k) {
        return '<button type="button" class="fo" role="radio" data-v="' + esc(o) + '" aria-checked="' + (v === o) + '"><kbd>' + String.fromCharCode(65 + k) + '</kbd><span>' + esc(label(st, k)) + '</span></button>';
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
          try { dispatchEvent(new CustomEvent('bk:interact')); } catch (_) { }   // track.js: formular rørt
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
  var DAYS = EN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  var MONTHS = EN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  // engelsk: besøgendes egen tidszone (dagene grupperes om efter den); dansk: altid København
  var tz = 'Europe/Copenhagen', LOC = EN ? 'en-GB' : 'da-DK';
  if (EN) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; new Date().toLocaleString('en-GB', { timeZone: tz }); } catch (e) { tz = 'Europe/Copenhagen'; } }
  var fmtTime = function (iso) { return new Date(iso).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit', timeZone: tz }).replace('.', ':'); };
  var fmtLong = function (iso) { return new Date(iso).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }) + t(' kl. ', ' at ') + fmtTime(iso); };
  var fmtShort = function (iso) { return new Date(iso).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }) + ' ' + fmtTime(iso); };   // "tor. 5. nov. 20:00" (kort, så knappen holder én linje på små mobiler)
  var cErr = function (m) { var e = $('#cErr'); if (e) e.textContent = m || ''; };
  var slots = null, picked = null;
  var loadSlots = function () {
    var from = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
    fetch('/api/slots?page=' + PAGE + '&from=' + from + '&days=14').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        if (EN && j && j.slots) {   // grupper efter besøgendes lokale dato
          var by = {}; Object.keys(j.slots).forEach(function (k) { j.slots[k].forEach(function (iso) { var d = new Date(iso).toLocaleDateString('sv-SE', { timeZone: tz }); (by[d] = by[d] || []).push(iso); }); });
          Object.keys(by).forEach(function (d) { by[d].sort(function (a, b) { return Date.parse(a) - Date.parse(b); }); });
          j.slots = by;
        }
        slots = j; drawDays();
      })
      .catch(function () { $('#cDays').innerHTML = ''; cErr(t('Kalenderen kunne ikke hentes lige nu. Prøv igen om et øjeblik.', 'The calendar could not be loaded right now. Please try again in a moment.')); });
  };
  var drawDays = function () {
    var dEl = $('#cDays'), tEl = $('#cTimes'); if (!dEl) return;
    var keys = Object.keys(slots.slots || {}).sort().filter(function (k) { return (slots.slots[k] || []).length; });
    if (!keys.length) { dEl.innerHTML = ''; tEl.innerHTML = ''; cErr(t('Der er ingen ledige tider lige nu. Kig forbi igen i morgen, så er der kommet nye.', 'There are no open times right now. Check back tomorrow, new ones will be added.')); return; }
    dEl.innerHTML = keys.map(function (k) {
      var d = new Date(k + 'T12:00:00');
      return '<button type="button" class="fday" data-d="' + k + '" aria-pressed="false"><small>' + DAYS[d.getDay()] + '</small><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()] + '</span></button>';
    }).join('');
    var bb = $('#cBook');
    var pickDay = function (k) {
      $$('.fday', dEl).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.d === k)); });
      tEl.innerHTML = slots.slots[k].map(function (iso) { return '<button type="button" class="ftime" data-t="' + esc(iso) + '" aria-pressed="false">' + fmtTime(iso) + '</button>'; }).join('');
      picked = null; bb.disabled = true; bb.innerHTML = t('Vælg et tidspunkt', 'Pick a time') + arrow;
      $$('.ftime', tEl).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.ftime', tEl).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true');
          picked = b.dataset.t; bb.disabled = false; bb.innerHTML = t('Book ', 'Book ') + esc(fmtShort(picked)) + arrow; cErr('');
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
    bb.disabled = true; bb.innerHTML = '<i class="fspin" aria-hidden="true"></i>' + t('Booker din tid', 'Booking your time');
    $$('.fday,.ftime,#fBack', B).forEach(function (x) { x.disabled = true; });
    cErr('');
    var unlock = function () { $$('.fday,.ftime,#fBack', B).forEach(function (x) { x.disabled = false; }); var e1 = $('#cErr'); if (e1) e1.classList.remove('fwait'); };
    saveNow().then(function () {
      return fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lid: S.lid, start: picked, fbp: cookie('_fbp'), fbc: cookie('_fbc'), track: LIVE }) });
    }).then(function (r) { return r.json().then(function (x) { return { ok: r.ok, x: x }; }); }).then(function (res) {
      var e = res.x && res.x.error;
      if (e === 'already booked' && res.x.start) { S.booked = { start: res.x.start }; persist(); render(); return; }
      if (e === 'not eligible') { S.stop = true; persist(); render(); return; }
      if (e === 'missing answers' || e === 'missing contact') { go(0); return; }
      if (!res.ok || !res.x.ok) {
        unlock();
        if (e === 'slot taken') {
          var tk = picked; Object.keys(slots.slots).forEach(function (k) { slots.slots[k] = slots.slots[k].filter(function (x) { return x !== tk; }); });
          drawDays(); cErr(t('Den tid blev lige taget. Vælg en anden.', 'That time was just taken. Please pick another.')); return;
        }
        if (e === 'too many bookings') { bb.innerHTML = t('Vælg et tidspunkt', 'Pick a time') + arrow; cErr(t('Der er allerede booket samtaler fra denne forbindelse. Skriv til os, hvis du skal ændre tiden.', 'Calls have already been booked from this connection. Message us if you need to change the time.')); return; }
        bb.disabled = false; bb.innerHTML = t('Prøv igen', 'Try again') + arrow; cErr(t('Det lykkedes ikke at booke. Prøv igen om et øjeblik.', 'The booking did not go through. Please try again in a moment.')); return;
      }
      S.booked = { start: res.x.start || picked, end: res.x.end || null }; S.step = N; persist();
      try { dispatchEvent(new CustomEvent('bk:booked')); } catch (_) { }   // track.js: booket (alle scorer)
      if (res.x.cv === 1) fireConv();
      if (LIVE) {
        var qs = '?first_name=' + encodeURIComponent((S.name || '').trim().split(/\s+/)[0] || '') + '&start=' + encodeURIComponent(S.booked.start);
        setTimeout(function () { location.assign(BASE + (res.x.cv === 1 ? t('tak', 'thanks') : t('bekraeftet', 'confirmed')) + qs); }, res.x.cv === 1 ? 400 : 150);   // pixel'en når at sende
        return;
      }
      render();
    }).catch(function () { unlock(); bb.disabled = false; bb.innerHTML = t('Prøv igen', 'Try again') + arrow; cErr(t('Ingen forbindelse. Prøv igen om lidt.', 'No connection. Please try again shortly.')); });
  };
  // kun kvalificerede bookinger tælles i annoncerne; samme event_id som serverens CAPI-kald (fbm-<lid>)
  var fireConv = function () {
    if (!LIVE || S.convFired) return;
    S.convFired = true; persist();
    try { if (window.fbq) fbq('track', 'Schedule', { content_name: t('Ansøgning kvalificeret', 'Ansøgning kvalificeret (EN)') }, { eventID: 'fbm-' + S.lid }); } catch (e) { }
    try { (window.dataLayer = window.dataLayer || []).push({ event: 'fbm_qualified_booking', fbm_lang: EN ? 'en' : 'da' }); } catch (e) { }
  };

  // ── stop: kun eget materiale ──
  var renderStop = function () {
    MC.add('end');
    B.scrollTop = 0;
    setProg(N - 1, t('Tak for din interesse', 'Thanks for your interest'));
    B.innerHTML = EN ? '<div class="fstep fend"><p class="fk">Thanks for your interest</p><h3 class="fq">Unfortunately, we only work with cover musicians</h3>' +
      '<p class="fh">Our system is built for musicians who play well-known songs at weddings, corporate events and private parties. That is where we can bring in the clients. With your own material we are not the right fit, and we would rather tell you honestly now than take up your time.</p>' +
      '<div class="fnav"><button type="button" class="fbtn ghost" data-fbm-close>Back to the page</button></div></div>'
      : '<div class="fstep fend"><p class="fk">Tak for din interesse</p><h3 class="fq">Vi hjælper desværre kun covermusikere</h3>' +
      '<p class="fh">Vores system er bygget til musikere, der spiller kendte numre til bryllupper, firmafester og private fester. Der kan vi skaffe kunderne. Med dit eget materiale er vi ikke de rigtige til at hjælpe dig, og det vil vi hellere sige ærligt nu end tage din tid.</p>' +
      '<div class="fnav"><button type="button" class="fbtn ghost" data-fbm-close>Tilbage til siden</button></div></div>';
    $$('[data-fbm-close]', B).forEach(function (x) { x.addEventListener('click', close); });
  };

  // ── tak + valgfri forberedelse ──
  var renderDone = function () {
    var b = S.booked, f = (S.name || '').trim().split(/\s+/)[0] || '';
    var st = new Date(b.start), en = b.end ? new Date(b.end) : new Date(st.getTime() + 60 * 60000);
    var z = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    var title = t('Strategisamtale med Fuldt Booket Musiker', 'Strategy call with Fully Booked Musician'), det = t('Google Meet. Linket står i din bekræftelsesmail.', 'Google Meet. The link is in your confirmation email.');
    var gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(st) + '/' + z(en) + '&details=' + encodeURIComponent(det);
    var ics = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fuldt Booket Musiker//' + t('DA', 'EN'), 'BEGIN:VEVENT', 'UID:' + S.lid + '@fuldtbooketmusiker.dk', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(st), 'DTEND:' + z(en), 'SUMMARY:' + title, 'DESCRIPTION:' + det, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    var ex = S.extra || {}, crew = (ex.optraeder || '').split(', ').filter(Boolean);
    var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
    var cal = '<div class="fadd"><a class="fbtn sm ghost" href="' + gcal + '" target="_blank" rel="noopener">' + t('Google Kalender', 'Google Calendar') + '</a><a class="fbtn sm ghost" href="' + ics + '" download="' + t('strategisamtale', 'strategy-call') + '.ics">Apple / Outlook</a></div>';
    var when = esc(fmtLong(b.start)) + (EN ? ' <span class="ftzs">(' + esc(tz.replace(/_/g, ' ')) + ')</span>' : '');
    B.scrollTop = 0;
    if (S.extraSent && INL) {
      B.innerHTML = '<div class="fstep fend"><p class="fbooked">' + check + '<span>' + t('<b>Din ansøgning er komplet.</b> Oscar kigger den igennem før jeres samtale.', '<b>Your application is complete.</b> Oscar will review it before your call.') + '</span></p></div>';
      return;
    }
    if (S.extraSent) {
      // færdig: ansøgningen er komplet
      setProg(N - 1, t('Ansøgning komplet', 'Application complete'));
      B.innerHTML = '<div class="fstep fend"><div class="fok" aria-hidden="true">' + check + '</div>' +
        '<p class="fk">' + t('Ansøgning komplet', 'Application complete') + '</p><h3 class="fq">' + t('Tak', 'Thanks') + (f ? ', ' + esc(f) : '') + t('. Vi ses ', '. See you ') + when + '.</h3>' +
        '<p class="fh">' + (EN ? 'Oscar will review your application before the call. In a moment you will get an invitation with a Google Meet link at ' + esc(S.email || 'your email') + '. Add it to your calendar so you do not miss it.'
          : 'Oscar kigger din ansøgning igennem før samtalen. Om et øjeblik får du en invitation med link til Google Meet på ' + esc(S.email || 'din mail') + '. Læg tiden i kalenderen, så den ikke glipper.') + '</p>' + cal + '</div>';
      return;
    }
    // næsten færdig: det sidste trin står øverst, så de ikke lukker vinduet før de har udfyldt det
    bar.style.transform = 'scaleX(.94)'; stepLbl.textContent = t('Næsten færdig · sidste trin', 'Almost done · last step');
    B.innerHTML = '<div class="fstep fend">' +
      '<p class="fbooked">' + check + '<span>' + t('Din tid er reserveret: ', 'Your time is reserved: ') + '<b>' + when + '</b></span></p>' +
      '<p class="fk">' + t('Sidste trin · under 1 minut', 'Last step · under 1 minute') + '</p>' +
      '<h3 class="fq">' + t('Du er der næsten', 'You are almost there') + (f ? ', ' + esc(f) : '') + t('. Udfyld det sidste, så er din ansøgning komplet.', '. Fill in the last part and your application is complete.') + '</h3>' +
      '<p class="fh">' + t('Oscar bruger det til at forberede sig, så I kan bruge samtalen på din plan i stedet for det grundlæggende.', 'Oscar uses this to prepare, so you can spend the call on your plan instead of the basics.') + '</p>' +
      '<div class="fgrid two">' +
      '<label class="ff"><span>Instagram</span><input class="fin" id="xIg" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(ex.instagram || '') + '" placeholder="' + t('@ditnavn', '@yourname') + '"></label>' +
      '<label class="ff"><span>' + t('Hjemmeside', 'Website') + '</span><input class="fin" id="xWeb" type="url" inputmode="url" autocapitalize="off" spellcheck="false" value="' + esc(ex.hjemmeside || '') + '" placeholder="' + t('www.ditnavn.dk', 'www.yourname.com') + '"></label></div>' +
      '<label class="ff"><span>' + t('Om dig, og hvorfor du gerne vil have flere jobs', 'About you, and why you want more gigs') + '</span><textarea class="fin fta" id="xOm" rows="4" maxlength="2000" placeholder="' + t('Fx hvad du spiller, hvor længe du har spillet, og hvad du gerne vil nå det næste år', 'E.g. what you play, how long you have been playing, and what you want to achieve in the next year') + '">' + esc(ex.om || '') + '</textarea></label>' +
      '<p class="ff"><span>' + t('Hvordan optræder du?', 'How do you perform?') + '</span></p><div class="fchips" role="group" aria-label="' + t('Hvordan optræder du?', 'How do you perform?') + '">' + ['Solo', 'Duo', 'Trio / band'].map(function (o) { return '<button type="button" class="fchip" data-v="' + o + '" aria-pressed="' + (crew.indexOf(o) > -1) + '">' + o + '</button>'; }).join('') + '</div>' +
      '<p class="ferr" id="xErr" role="alert"></p><div class="fnav"><button type="button" class="fbtn" id="xSend">' + t('Færdiggør min ansøgning', 'Complete my application') + arrow + '</button></div></div>';
    if (!S.extraSent) wireExtra();
  };
  var wireExtra = function () {
    S.extra = S.extra || {};
    var ig = $('#xIg'), web = $('#xWeb'), om = $('#xOm');
    var sync = function () { S.extra.instagram = ig.value.trim(); S.extra.hjemmeside = web.value.trim(); S.extra.om = om.value.trim(); S.extra.optraeder = $$('.fchip[aria-pressed=true]', B).map(function (x) { return x.dataset.v; }).join(', '); persist(); };
    [ig, web, om].forEach(function (el) { el.addEventListener('input', sync); });
    $$('.fchip', B).forEach(function (c) { c.addEventListener('click', function () { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); sync(); }); });
    $('#xSend').addEventListener('click', function () {
      sync();
      var e = S.extra, x = $('#xErr');
      if (!e.instagram && !e.hjemmeside && !e.optraeder && !e.om) { x.textContent = t('Udfyld mindst ét felt, så Oscar kan forberede sig.', 'Fill in at least one field so Oscar can prepare.'); return; }
      ['instagram', 'hjemmeside', 'optraeder', 'om'].forEach(function (k) { if (e[k]) S.a[k] = e[k]; });
      var btn = $('#xSend'); btn.disabled = true; btn.textContent = t('Sender...', 'Sending...');
      saveNow(false, true).then(function (ok) {
        if (!ok) { btn.disabled = false; btn.innerHTML = t('Prøv igen', 'Try again') + arrow; x.textContent = t('Det blev ikke sendt. Prøv igen.', 'It was not sent. Please try again.'); return; }
        S.extraSent = true; persist(); renderDone();
      });
    });
  };
  if (INL) { if (S.booked) { INL.hidden = false; renderDone(); } else INL.hidden = true; }
})();
