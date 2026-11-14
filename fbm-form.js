// Ansøgningsform til fuldtbooketmusiker.dk (4/11 2026, ny rækkefølge 14/11 2026): kontakt -> kalender -> spørgsmål.
// Svar gemmes løbende via /api/lead (page=ansoegning). Booking via /api/book (alle i Strategisamtale).
// Efter bookingen: spørgsmålene ét ad gangen + Instagram/hjemmeside/om dig til sidst. Scoren regnes kun som info på serveren.
// window.FBM_LIVE (sat af gen_newform.py) styrer om Meta-pixel/dataLayer får konverteringen. Alle bookinger tælles (fra 14/11).
// window.FBM_LANG='en' (/international, 8/11 2026): engelske tekster og euro-intervaller, men SAMME svar-værdier (data-v) som den danske,
// så score, regler i /admin og GHL-felterne er fælles. Tider vises i besøgendes egen tidszone. page=international.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var EN = window.FBM_LANG === 'en', t = function (da, en) { return EN ? en : da; };
  var LIVE = window.FBM_LIVE === true, PAGE = EN ? 'international' : 'ansoegning', BASE = EN ? '/international/' : '/';
  var arrow = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

  // svarmulighederne skal være præcis de samme som i worker.js (FBM_APP.opts) og GHL-felterne
  // en: engelsk tekst + labels (samme rækkefølge som opts). Euro-intervallerne svarer til kr.-intervallerne (1 € ≈ 7,5 kr.)
  // 14/11 2026 (Oskars ordre): KONTAKT -> KALENDER -> SPØRGSMÅL. Kontaktinfo først (lead i D1 + GHL med det samme), kalenderen
  // dukker selv op, når den er gyldig, og spørgsmålene kommer efter bookingen som "sidste trin, så Oscar kan forberede samtalen".
  // Ingen stop-svar og ingen kvalificering: alle booker i Strategisamtale og lander på /tak. Ingen trin-tæller, kun en statuslinje.
  var QS = [
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
    { id: 'cover', q: 'Spiller du covermusik eller dit eget materiale?', opts: ['Covermusik', 'Både covermusik og eget materiale', 'Kun mit eget materiale'],
      en: { q: 'Do you play covers or your own material?', opts: ['Covers', 'Both covers and my own material', 'Only my own material'] } },
    { id: 'oms', q: 'Hvad omsætter du for på musikken om måneden i dag?', help: 'Et cirka-tal er fint.', opts: ['Under 10.000 kr.', '10.000–24.999 kr.', '25.000–49.999 kr.', '50.000–99.999 kr.', '100.000+ kr.'],
      en: { q: 'How much do you earn from music per month today?', help: 'A rough number is fine.', opts: ['Under €1,300', '€1,300–3,300', '€3,300–6,700', '€6,700–13,000', '€13,000+'] } },
    { id: 'invest', q: 'Hvor meget er du villig til at investere om måneden for at nå dit mål?', opts: ['0–5.000 kr.', '5.000–10.000 kr.', '10.000–20.000 kr.', '20.000–50.000 kr.', '50.000–100.000 kr.'],
      en: { q: 'How much are you willing to invest per month to reach your goal?', opts: ['€0–700', '€700–1,300', '€1,300–2,700', '€2,700–6,700', '€6,700–13,000'] } },
    { id: 'extra', type: 'extra', q: 'Til sidst: hvor kan Oscar se dig spille?', help: 'Så kan han kigge på det før samtalen og bruge tiden på din plan i stedet for det grundlæggende.',
      en: { q: 'Last one: where can Oscar see you play?', help: 'Then he can look at it before the call and spend the time on your plan instead of the basics.' } }
  ];
  // engelsk: spørgsmål/hjælp/labels fra .en; værdien der gemmes (data-v) er altid den danske
  if (EN) QS.forEach(function (st) { if (st.en) { st.q = st.en.q; st.help = st.en.help || ''; } });
  var label = function (st, k) { return EN && st.en && st.en.opts ? st.en.opts[k] : st.opts[k]; };
  var labelOf = function (id, v) { var st = QS.filter(function (x) { return x.id === id; })[0], k = st && st.opts ? st.opts.indexOf(v) : -1; return k > -1 ? label(st, k) : v; };
  var NQ = QS.length, NP = NQ + 1;   // skærme i alt: kontakt/kalender + spørgsmålene
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
  var fresh = function (o) { return { lid: uuid(), a: {}, name: o ? o.name : '', email: o ? o.email : '', phone: o ? o.phone : '', q: 0, booked: null, final: false, cSent: false }; };
  var S; try { S = JSON.parse(ls(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || !S.lid) S = fresh();
  // gemt fra den gamle rækkefølge (før 14/11): 'extraSent' = færdig, 'stop' findes ikke længere
  if (S.extraSent) S.final = true;
  delete S.stop; delete S.step; delete S.extraSent;
  if (typeof S.q !== 'number') { S.q = 0; if (S.booked) while (S.q < QS.length - 1 && S.a[QS[S.q].id]) S.q++; }
  // en samtale, der er overstået, starter en ny ansøgning (kontaktinfo huskes)
  if (S.booked && Date.parse(S.booked.start) < Date.now() - 2 * 3600000) S = fresh(S);
  var persist = function () { ls(KEY, JSON.stringify(S)); };
  var ev = function (n, d) { try { dispatchEvent(new CustomEvent(n, d ? { detail: d } : undefined)); } catch (_) { } };   // track.js

  // ── gem mens der svares ──
  var tSave = null, inflight = false, again = false;
  // engelsk: euro-svarene med som tekst (_eur), så Oscar kan se hvad de faktisk valgte (GHL-felterne har kr.-intervallerne)
  var eur = function () { return ['pris', 'pris_maal', 'oms', 'invest'].filter(function (k) { return S.a[k]; }).map(function (k) { return k + ': ' + labelOf(k, S.a[k]); }).join('; '); };
  var payload = function (f) {
    f = f || {};
    return { lid: S.lid, page: PAGE, answers: EN ? Object.assign({}, S.a, { _eur: eur() }) : S.a, name: S.name, email: S.email, phone: S.phone,
      step: S.booked ? 1 + S.q : 0, done: false, src: src, contact: !!f.contact, final: !!f.final, vid: ls('bk_vid') || '', sid: ls('bk_sid') || '' };
  };
  var hasData = function () { return S.name || S.email || S.phone || Object.keys(S.a).length; };
  // f.contact = kontaktinfo bekræftet (GHL-kontakt + Telegram), f.final = spørgsmålene er færdige
  var saveNow = function (beacon, f) {
    clearTimeout(tSave); persist();
    if (!hasData()) return Promise.resolve(true);
    var body = JSON.stringify(payload(f));
    if (beacon && navigator.sendBeacon) { try { navigator.sendBeacon('/api/lead', new Blob([body], { type: 'application/json' })); return Promise.resolve(true); } catch (e) { } }
    if (inflight && !f) { again = true; return Promise.resolve(true); }
    inflight = true;
    return fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
      .then(function (r) { return r.ok; }).catch(function () { return false; })
      .then(function (ok) { inflight = false; if (again) { again = false; saveNow(); } return ok; });
  };
  var saveSoon = function () { persist(); clearTimeout(tSave); tSave = setTimeout(saveNow, 700); };
  // forlader de siden med gyldig kontaktinfo, er leadet bekræftet (så det kan følges op)
  var leaving = function () { var c = !S.booked && !S.cSent && typeof contactErr === 'function' && !contactErr(); if (c) { S.cSent = true; } saveNow(true, c ? { contact: true } : null); };
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leaving(); });
  addEventListener('pagehide', leaving);

  // ── modal ──
  // modal på forsiden (#fbmModal) eller inline på tak-siderne (#fbmTak: spørgsmålene, hvis de mangler, ellers "komplet")
  var M = $('#fbmModal'), INL = M ? null : $('#fbmTak');
  if (!M && !INL) return;
  var B = M ? $('#fbmBody') : INL, bar = $('#fbmBar') || { style: {} }, stepLbl = $('#fbmStep') || {}, last = null;
  var MC = M ? M.classList : { add: function () { }, remove: function () { }, toggle: function () { } };
  var lockScroll = function (on) { document.documentElement.classList.toggle('fbm-lock', on); document.body.classList.toggle('bk-lock', on); };
  var open = function (e) {
    if (e) e.preventDefault();
    last = document.activeElement;
    ev('bk:open', { el: e && e.currentTarget || null });
    M.hidden = false; requestAnimationFrame(function () { MC.add('open'); });
    lockScroll(true);
    try { history.replaceState(null, '', location.pathname + location.search + '#ansoeg'); } catch (_) { }
    if (!S.booked) prefetch();
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

  // statuslinje uden trin-tæller: hurtig i starten, langsommere mod slutningen, aldrig 100 % før alt er sendt
  var prog = function (i, lbl) {
    var p = i >= NP ? 1 : Math.min(0.985, Math.max(0.05, 1 - Math.pow(1 - i / NP, 2.2)));
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (lbl != null) stepLbl.textContent = lbl;
  };
  var focusFirst = function () { if (!matchMedia('(hover:hover)').matches) return; var f = $('input,.fo,.fday,.fbtn', B); if (f) f.focus({ preventScroll: true }); };
  var head = function (kick, qtxt, help, pre) {
    return (kick ? '<p class="fk">' + kick + '</p>' : '') + (pre ? '<p class="fpre">' + esc(pre) + '</p>' : '') + '<h3 class="fq" id="fbmQ">' + esc(qtxt) + '</h3>' + (help ? '<p class="fh">' + esc(help) + '</p>' : '');
  };
  var err = function (m) { var e = $('#fErr'); if (e) e.textContent = m || ''; };
  var digits = function (s) { return (s || '').replace(/\D/g, ''); };
  var okMail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim()); };
  var nameErr = function () { return S.name.trim().length < 2 ? t('Skriv dit navn.', 'Please enter your name.') : ''; };
  var telErr = function () {
    if (digits(S.phone).length < 8) return t('Skriv et telefonnummer med mindst 8 cifre.', 'Please enter your phone number with country code.');
    if (EN && !/^\s*(\+|00)/.test(S.phone)) return 'Please add your country code, e.g. +44.';
    return '';
  };
  var mailErr = function () { return okMail(S.email) ? '' : t('Tjek e-mailen. Den ser ikke helt rigtig ud.', 'Please check your email. It does not look quite right.'); };
  var contactErr = function () { return nameErr() || telErr() || mailErr(); };
  // engelsk: landekoden foreslås ud fra browserens sprog/region (kan rettes)
  var DIAL = { GB: 44, US: 1, CA: 1, AU: 61, NZ: 64, IE: 353, DE: 49, AT: 43, CH: 41, NL: 31, BE: 32, FR: 33, ES: 34, PT: 351, IT: 39, SE: 46, NO: 47, FI: 358, IS: 354, PL: 48, ZA: 27, AE: 971, DK: 45 };
  var dialGuess = function () {
    if (!EN) return '';
    var r = ''; try { (navigator.languages || [navigator.language]).some(function (l) { var m = /-([A-Za-z]{2})$/.exec(l || ''); if (m) r = m[1].toUpperCase(); return !!m; }); } catch (e) { }
    return DIAL[r] ? '+' + DIAL[r] + ' ' : '';
  };
  // rul KUN inde i modalen (scrollIntoView ruller også siden bagved og kan blive afbrudt af sidens egen rulning)
  var scrollTo = function (el, pad) { if (!el || INL) return; var y = el.getBoundingClientRect().top - B.getBoundingClientRect().top + B.scrollTop - (pad || 12); B.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); };
  var firstOpen = function () { for (var k = 0; k < NQ - 1; k++) if (!S.a[QS[k].id]) return k; return NQ - 1; };

  var render = function () {
    MC.remove('wide'); MC.toggle('end', !!(S.booked && S.final));
    if (S.booked && S.final) return renderDone();
    if (S.booked) return renderQ();
    return renderContact();
  };

  // ── 1) kontakt + kalender på samme skærm ──
  var calOn = false, calRolled = false;
  var renderContact = function () {
    calOn = false; calRolled = false; MC.add('wide');
    prog(contactErr() ? 0 : 0.6, t('Gratis samtale · under 1 minut', 'Free call · under 1 minute'));
    B.innerHTML = '<div class="fstep fcontact">' +
      head(t('Gratis strategisamtale med Oscar', 'Free strategy call with Oscar'), t('Hvor skal vi sende din invitation hen?', 'Where should we send your invitation?'),
        t('Skriv dine oplysninger, så dukker de ledige tider op lige herunder.', 'Enter your details and the open times appear right below.')) +
      '<div class="fgrid fcgrid">' +
      '<label class="ff fwide"><span>' + t('Fulde navn', 'Full name') + '</span><input class="fin" id="cName" autocomplete="name" value="' + esc(S.name) + '" placeholder="' + t('Fornavn og efternavn', 'First and last name') + '"></label>' +
      '<label class="ff"><span>' + t('Telefon', 'Phone (with country code)') + '</span><input class="fin" id="cTel" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(S.phone || dialGuess()) + '" placeholder="' + t('12 34 56 78', '+44 7700 900123') + '"></label>' +
      '<label class="ff"><span>E-mail</span><input class="fin" id="cMail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="' + esc(S.email) + '" placeholder="' + t('navn@mail.dk', 'name@email.com') + '"></label></div>' +
      '<p class="ferr" id="fErr" role="alert"></p>' +
      '<p class="fnote">' + t('Vi bruger det kun til din samtale. Ingen nyhedsbreve.', 'We only use this for your call. No newsletters.') + '</p>' +
      '<div class="fcalwrap" id="cWrap" aria-live="polite"></div></div>';
    B.scrollTop = 0;
    wireContact();
    drawCal(false);
    focusFirst();
  };
  var started = false;
  var wireContact = function () {
    var F = [['cName', 'name', nameErr], ['cTel', 'phone', telErr], ['cMail', 'email', mailErr]];
    F.forEach(function (p, k) {
      var el = $('#' + p[0]);
      el.addEventListener('input', function () {
        S[p[1]] = el.value; err(''); el.removeAttribute('aria-invalid');
        if (!started) { started = true; ev('bk:start'); ev('bk:interact'); }   // track.js: form_start + formular rørt
        saveSoon(); drawCal(false);
      });
      el.addEventListener('blur', function () {
        S[p[1]] = el.value.trim(); el.value = S[p[1]];
        // fejl vises først, når feltet er forladt med noget i (ikke mens de skriver)
        var m = S[p[1]] ? p[2]() : '';
        if (m) { err(m); el.setAttribute('aria-invalid', 'true'); }
        saveNow(); drawCal(true);
        confirmContact();
      });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return; e.preventDefault();
        if (k < F.length - 1) { $('#' + F[k + 1][0]).focus(); return; }
        el.blur(); var m = contactErr(); if (m) { err(m); return; }
        scrollTo($('#cWrap'));
      });
    });
  };
  // kontakt bekræftet (felterne forladt med gyldig info, eller en tid valgt): lead i Telegram + GHL-kontakt med det samme
  var confirmContact = function () {
    if (S.cSent || S.booked || contactErr()) return;
    S.cSent = true; persist(); ev('bk:field', { f: 'kontakt' });
    saveNow(false, { contact: true });
  };

  // ── kalender ──
  var DAYS = EN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  var MONTHS = EN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  // tiderne vises i den besøgendes egen tidszone (dagene grupperes efter den); det er næsten altid København
  var CPH = 'Europe/Copenhagen', tz = CPH, LOC = EN ? 'en-GB' : 'da-DK';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || CPH; new Date().toLocaleString('en-GB', { timeZone: tz }); } catch (e) { tz = CPH; }
  var tzName = tz.replace(/_/g, ' ');
  var fmtTime = function (iso) { return new Date(iso).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit', timeZone: tz }).replace('.', ':'); };
  var fmtLong = function (iso) { return new Date(iso).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }) + t(' kl. ', ' at ') + fmtTime(iso); };
  var fmtShort = function (iso) { return new Date(iso).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }) + ' ' + fmtTime(iso); };   // "tor. 5. nov. 20:00" (kort, så knappen holder én linje på små mobiler)
  var cErr = function (m) { var e = $('#cErr'); if (e) e.textContent = m || ''; };
  var slots = null, slotsP = null, slotsFail = false, picked = null;
  // tiderne hentes, så snart formen åbnes, så kalenderen står klar, når kontaktinfoen er skrevet
  var prefetch = function () {
    if (slotsP) return slotsP;
    var from = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
    slotsFail = false;
    slotsP = fetch('/api/slots?page=' + PAGE + '&from=' + from + '&days=14').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        var by = {}; Object.keys(j.slots || {}).forEach(function (k) { j.slots[k].forEach(function (iso) { var d = new Date(iso).toLocaleDateString('sv-SE', { timeZone: tz }); (by[d] = by[d] || []).push(iso); }); });
        Object.keys(by).forEach(function (d) { by[d].sort(function (a, b) { return Date.parse(a) - Date.parse(b); }); });
        j.slots = by; slots = j;
      })
      .catch(function () { slotsFail = true; slotsP = null; });
    return slotsP;
  };
  // kalenderen kommer af sig selv, når kontaktinfoen er gyldig (ingen "Vælg tid"-knap). Bliver stående, hvis de retter bagefter.
  var drawCal = function (left) {
    var w = $('#cWrap'); if (!w || S.booked) return;
    var ok = !contactErr();
    if (!ok && !calOn) {
      w.innerHTML = '<div class="fcalph"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><span>' +
        t('Ledige tider vises her, når du har skrevet navn, telefon og e-mail.', 'Open times appear here once you have entered your name, phone and email.') + '</span></div>';
      return;
    }
    prog(0.6);
    // dukker kalenderen op, mens de stadig skriver, ruller vi ikke (tastaturet); først når feltet er forladt, og kun én gang
    var roll = function () { if (calRolled || !(left || !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || ''))) return; calRolled = true; setTimeout(function () { if (matchMedia('(max-width:720px)').matches) scrollTo($('#cWrap')); }, 120); };
    if (calOn) return roll();
    calOn = true;
    w.innerHTML = '<div class="fcalbox"><h4 class="fsub">' + t('Vælg en tid', 'Pick a time') + '</h4><p class="fh">' + t('1 time på Google Meet med Oscar. Du får invitationen på mail med det samme.', '1 hour on Google Meet with Oscar. You will get the invitation by email right away.') + '</p>' +
      '<div class="fcal"><div class="fdays" id="cDays" role="group" aria-label="' + t('Dag', 'Day') + '"><div class="fskel"></div><div class="fskel"></div><div class="fskel"></div><div class="fskel"></div></div>' +
      '<div class="ftimes" id="cTimes" role="group" aria-label="' + t('Tidspunkt', 'Time') + '"></div></div>' +
      (EN || tz !== CPH ? '<p class="fh ftz">' + t('Tiderne vises i din tidszone (' + esc(tzName) + ').', 'Times are shown in your time zone (' + esc(tzName) + ').') + '</p>' : '') +
      '<p class="ferr" id="cErr" role="alert"></p><div class="fnav"><button type="button" class="fbtn" id="cBook" disabled>' + t('Vælg et tidspunkt', 'Pick a time') + arrow + '</button></div></div>';
    $('#cBook').onclick = book;
    roll();
    var p = prefetch() || Promise.resolve();
    p.then(function () {
      if (slots) return drawDays();
      var d = $('#cDays'); if (d) d.innerHTML = '';
      cErr(t('Kalenderen kunne ikke hentes lige nu. Prøv igen om et øjeblik.', 'The calendar could not be loaded right now. Please try again in a moment.'));
      var bb = $('#cBook'); if (bb) { bb.disabled = false; bb.innerHTML = t('Hent tiderne igen', 'Load times again') + arrow; bb.onclick = function () { calOn = false; drawCal(true); }; }
    });
  };
  var drawDays = function () {
    var dEl = $('#cDays'), tEl = $('#cTimes'), bb = $('#cBook'); if (!dEl) return;
    bb.onclick = book;
    var keys = Object.keys(slots.slots || {}).sort().filter(function (k) { return (slots.slots[k] || []).length; });
    if (!keys.length) { dEl.innerHTML = ''; tEl.innerHTML = ''; cErr(t('Der er ingen ledige tider lige nu. Kig forbi igen i morgen, så er der kommet nye.', 'There are no open times right now. Check back tomorrow, new ones will be added.')); return; }
    dEl.innerHTML = keys.map(function (k) {
      var d = new Date(k + 'T12:00:00');
      return '<button type="button" class="fday" data-d="' + k + '" aria-pressed="false"><small>' + DAYS[d.getDay()] + '</small><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()] + '</span></button>';
    }).join('');
    var pickDay = function (k) {
      $$('.fday', dEl).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.d === k)); });
      tEl.innerHTML = slots.slots[k].map(function (iso) { return '<button type="button" class="ftime" data-t="' + esc(iso) + '" aria-pressed="false">' + fmtTime(iso) + '</button>'; }).join('');
      picked = null; bb.disabled = true; bb.innerHTML = t('Vælg et tidspunkt', 'Pick a time') + arrow;
      $$('.ftime', tEl).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.ftime', tEl).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true');
          picked = b.dataset.t; bb.disabled = false; bb.innerHTML = t('Book ', 'Book ') + esc(fmtShort(picked)) + arrow; cErr('');
          confirmContact();
          if (matchMedia('(max-width:720px)').matches) { var r = b.getBoundingClientRect(), br = B.getBoundingClientRect(); if (r.bottom > br.bottom - 110) B.scrollBy({ top: r.bottom - br.bottom + 120, behavior: 'smooth' }); }
        });
      });
    };
    $$('.fday', dEl).forEach(function (b) { b.addEventListener('click', function () { pickDay(b.dataset.d); confirmContact(); }); });
    pickDay(keys[0]);
  };
  var cookie = function (n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; };
  var book = function () {
    if (!picked) return; var bb = $('#cBook');
    var m = contactErr(); if (m) { cErr(m); var bad = nameErr() ? '#cName' : telErr() ? '#cTel' : '#cMail'; $(bad).focus(); return; }
    bb.disabled = true; bb.innerHTML = '<i class="fspin" aria-hidden="true"></i>' + t('Booker din tid', 'Booking your time');
    $$('.fday,.ftime,.fin', B).forEach(function (x) { x.disabled = true; });
    cErr('');
    var unlock = function () { $$('.fday,.ftime,.fin', B).forEach(function (x) { x.disabled = false; }); };
    confirmContact();
    saveNow(false, {}).then(function () {
      return fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lid: S.lid, start: picked, fbp: cookie('_fbp'), fbc: cookie('_fbc'), track: LIVE }) });
    }).then(function (r) { return r.json().then(function (x) { return { ok: r.ok, x: x }; }); }).then(function (res) {
      var e = res.x && res.x.error;
      if (e === 'already booked' && res.x.start) { S.booked = { start: res.x.start }; S.q = firstOpen(); persist(); render(); return; }
      if (!res.ok || !res.x.ok) {
        unlock();
        if (e === 'slot taken') {
          var tk = picked; Object.keys(slots.slots).forEach(function (k) { slots.slots[k] = slots.slots[k].filter(function (x) { return x !== tk; }); });
          drawDays(); cErr(t('Den tid blev lige taget. Vælg en anden.', 'That time was just taken. Please pick another.')); return;
        }
        if (e === 'missing contact') { bb.disabled = false; bb.innerHTML = t('Prøv igen', 'Try again') + arrow; cErr(t('Tjek navn, telefon og e-mail ovenfor.', 'Please check your name, phone and email above.')); return; }
        if (e === 'too many bookings') { bb.innerHTML = t('Vælg et tidspunkt', 'Pick a time') + arrow; cErr(t('Der er allerede booket samtaler fra denne forbindelse. Skriv til os, hvis du skal ændre tiden.', 'Calls have already been booked from this connection. Message us if you need to change the time.')); return; }
        bb.disabled = false; bb.innerHTML = t('Prøv igen', 'Try again') + arrow; cErr(t('Det lykkedes ikke at booke. Prøv igen om et øjeblik.', 'The booking did not go through. Please try again in a moment.')); return;
      }
      S.booked = { start: res.x.start || picked, end: res.x.end || null }; S.q = firstOpen(); persist();
      ev('bk:booked');   // track.js: booket
      fireConv();        // annoncerne: ALLE bookinger, med det samme (også hvis de lukker før spørgsmålene)
      render();
    }).catch(function () { unlock(); bb.disabled = false; bb.innerHTML = t('Prøv igen', 'Try again') + arrow; cErr(t('Ingen forbindelse. Prøv igen om lidt.', 'No connection. Please try again shortly.')); });
  };
  // Meta Schedule + Lead og GTM (fbm_qualified_booking + booking_complete), én gang pr. booking, samme event_id'er som serverens
  // CAPI-kald (fbm-<lid> / fbm-lead-<lid>). bk_conv i sessionStorage = tak-siden sender ikke sin egen Lead oveni.
  // Navnene er uændrede fra før 14/11, så triggere i GTM og evt. tilpassede konverteringer i Meta virker som før.
  var fireConv = function () {
    if (!LIVE || S.convFired) return;
    S.convFired = true; persist();
    try { sessionStorage.setItem('bk_conv', '1'); } catch (e) { }
    try { if (window.fbq) { fbq('track', 'Schedule', { content_name: t('Ansøgning kvalificeret', 'Ansøgning kvalificeret (EN)') }, { eventID: 'fbm-' + S.lid }); fbq('track', 'Lead', { content_name: 'Samtale booket', content_category: 'booking' }, { eventID: 'fbm-lead-' + S.lid }); } } catch (e) { }
    try { var dl = (window.dataLayer = window.dataLayer || []); dl.push({ event: 'fbm_qualified_booking', fbm_lang: EN ? 'en' : 'da' }); dl.push({ event: 'booking_complete', event_id: 'fbm-lead-' + S.lid }); } catch (e) { }
  };

  // ── 2) spørgsmålene efter bookingen ──
  var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  var when = function () { return esc(fmtLong(S.booked.start)) + (EN || tz !== CPH ? ' <span class="ftzs">(' + esc(tzName) + ')</span>' : ''); };
  var renderQ = function () {
    var k = Math.max(0, Math.min(S.q, NQ - 1)), st = QS[k], f = (S.name || '').trim().split(/\s+/)[0] || '';
    prog(1 + k, t('Tid booket · sidste trin', 'Call booked · last step'));
    var kick = t('Sidste trin · så Oscar kan forberede samtalen', 'Last step · so Oscar can prepare the call');
    var intro = k === 0 || !S.introSeen ? '<p class="fbooked">' + check + '<span>' + t('Din tid er booket', 'Your call is booked') + (f ? ', ' + esc(f) : '') + ': <b>' + when() + '</b></span></p>' : '';
    S.introSeen = true; persist();
    var html;
    if (st.type === 'extra') {
      var ex = S.a, crew = (ex.optraeder || '').split(', ').filter(Boolean);
      html = intro + head(kick, st.q, st.help) +
        '<div class="fgrid two">' +
        '<label class="ff"><span>Instagram</span><input class="fin" id="xIg" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(ex.instagram || '') + '" placeholder="' + t('@ditnavn', '@yourname') + '"></label>' +
        '<label class="ff"><span>' + t('Hjemmeside', 'Website') + '</span><input class="fin" id="xWeb" type="url" inputmode="url" autocapitalize="off" spellcheck="false" value="' + esc(ex.hjemmeside || '') + '" placeholder="' + t('www.ditnavn.dk', 'www.yourname.com') + '"></label></div>' +
        '<label class="ff"><span>' + t('Om dig, og hvorfor du gerne vil have flere jobs', 'About you, and why you want more gigs') + '</span><textarea class="fin fta" id="xOm" rows="4" maxlength="2000" placeholder="' + t('Fx hvad du spiller, hvor længe du har spillet, og hvad du gerne vil nå det næste år', 'E.g. what you play, how long you have been playing, and what you want to achieve in the next year') + '">' + esc(ex.om || '') + '</textarea></label>' +
        '<p class="ff"><span>' + t('Hvordan optræder du?', 'How do you perform?') + '</span></p><div class="fchips" role="group" aria-label="' + t('Hvordan optræder du?', 'How do you perform?') + '">' + ['Solo', 'Duo', 'Trio / band'].map(function (o) { return '<button type="button" class="fchip" data-v="' + o + '" aria-pressed="' + (crew.indexOf(o) > -1) + '">' + o + '</button>'; }).join('') + '</div>' +
        '<p class="ferr" id="fErr" role="alert"></p><div class="fnav"><button type="button" class="fbtn" id="xSend">' + t('Færdiggør min ansøgning', 'Complete my application') + arrow + '</button>' + (k > 0 ? '<button type="button" class="fback" id="fBack">' + t('Tilbage', 'Back') + '</button>' : '') + '</div>';
    } else {
      var v = S.a[st.id] || '';
      html = intro + head(kick, st.q, st.help, st.id === 'invest' ? investGoal() : '') + '<div class="fopts" role="radiogroup" aria-labelledby="fbmQ">' + st.opts.map(function (o, i) {
        return '<button type="button" class="fo" role="radio" data-v="' + esc(o) + '" aria-checked="' + (v === o) + '"><kbd>' + String.fromCharCode(65 + i) + '</kbd><span>' + esc(label(st, i)) + '</span></button>';
      }).join('') + '</div><p class="ferr" id="fErr" role="alert"></p>' + (k > 0 ? '<div class="fnav"><button type="button" class="fback" id="fBack">' + t('Tilbage', 'Back') + '</button></div>' : '');
    }
    B.innerHTML = '<div class="fstep">' + html + '</div>';
    B.scrollTop = 0; if (INL && k > 0) INL.scrollIntoView({ block: 'start', behavior: 'smooth' });
    var bk = $('#fBack', B);
    if (bk) bk.addEventListener('click', function () { S.q = Math.max(0, k - 1); persist(); renderQ(); });
    B.onkeydown = null;
    if (st.opts) {
      $$('.fo', B).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('.fo', B).forEach(function (x) { x.setAttribute('aria-checked', 'false'); }); b.setAttribute('aria-checked', 'true');
          S.a[st.id] = b.dataset.v; S.q = k + 1;
          ev('bk:field', { f: st.id });
          saveSoon(); setTimeout(renderQ, 240);   // svaret gemmes med det samme (debounced), scoren regnes på serveren
        });
      });
      B.onkeydown = function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        var o = e.key.length === 1 ? $$('.fo', B)[e.key.toUpperCase().charCodeAt(0) - 65] : null;
        if (o) { e.preventDefault(); o.click(); }
      };
    } else wireExtra();
    focusFirst();
  };
  var wireExtra = function () {
    var ig = $('#xIg'), web = $('#xWeb'), om = $('#xOm');
    var sync = function () { S.a.instagram = ig.value.trim(); S.a.hjemmeside = web.value.trim(); S.a.om = om.value.trim(); S.a.optraeder = $$('.fchip[aria-pressed=true]', B).map(function (x) { return x.dataset.v; }).join(', '); persist(); };
    [ig, web, om].forEach(function (el) { el.addEventListener('input', function () { sync(); err(''); saveSoon(); }); });
    $$('.fchip', B).forEach(function (c) { c.addEventListener('click', function () { c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); sync(); saveSoon(); }); });
    $('#xSend').addEventListener('click', function () {
      sync();
      var a = S.a;
      if (!a.instagram && !a.hjemmeside && !a.optraeder && !a.om) { err(t('Udfyld mindst ét felt, så Oscar kan forberede sig.', 'Fill in at least one field so Oscar can prepare.')); return; }
      var btn = $('#xSend'); btn.disabled = true; btn.innerHTML = '<i class="fspin" aria-hidden="true"></i>' + t('Sender', 'Sending');
      saveNow(false, { final: true }).then(function (ok) {
        if (!ok) { btn.disabled = false; btn.innerHTML = t('Prøv igen', 'Try again') + arrow; err(t('Det blev ikke sendt. Prøv igen.', 'It was not sent. Please try again.')); return; }
        S.final = true; persist(); ev('bk:field', { f: 'extra' });
        finish();
      });
    });
  };
  // færdig: forsiden (live) -> tak-siden for ALLE. Konverteringen er allerede sendt ved bookingen, så tak-siden sender ikke igen.
  var finish = function () {
    prog(NP, t('Ansøgning komplet', 'Application complete'));
    if (LIVE && M) {
      try { sessionStorage.setItem('bk_conv', '1'); } catch (e) { }
      var qs = '?first_name=' + encodeURIComponent((S.name || '').trim().split(/\s+/)[0] || '') + '&start=' + encodeURIComponent(S.booked.start);
      setTimeout(function () { location.assign(BASE + t('tak', 'thanks') + qs); }, 250);
      return;
    }
    render();
  };

  // ── 3) komplet ──
  var renderDone = function () {
    var b = S.booked, f = (S.name || '').trim().split(/\s+/)[0] || '';
    var st = new Date(b.start), en = b.end ? new Date(b.end) : new Date(st.getTime() + 60 * 60000);
    var z = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    var title = t('Strategisamtale med Fuldt Booket Musiker', 'Strategy call with Fully Booked Musician'), det = t('Google Meet. Linket står i din bekræftelsesmail.', 'Google Meet. The link is in your confirmation email.');
    var gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(st) + '/' + z(en) + '&details=' + encodeURIComponent(det);
    var ics = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fuldt Booket Musiker//' + t('DA', 'EN'), 'BEGIN:VEVENT', 'UID:' + S.lid + '@fuldtbooketmusiker.dk', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(st), 'DTEND:' + z(en), 'SUMMARY:' + title, 'DESCRIPTION:' + det, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    var cal = '<div class="fadd"><a class="fbtn sm ghost" href="' + gcal + '" target="_blank" rel="noopener">' + t('Google Kalender', 'Google Calendar') + '</a><a class="fbtn sm ghost" href="' + ics + '" download="' + t('strategisamtale', 'strategy-call') + '.ics">Apple / Outlook</a></div>';
    B.scrollTop = 0;
    if (INL) {
      B.innerHTML = '<div class="fstep fend"><p class="fbooked">' + check + '<span>' + t('<b>Din ansøgning er komplet.</b> Oscar kigger den igennem før jeres samtale.', '<b>Your application is complete.</b> Oscar will review it before your call.') + '</span></p></div>';
      return;
    }
    prog(NP, t('Ansøgning komplet', 'Application complete'));
    B.innerHTML = '<div class="fstep fend"><div class="fok" aria-hidden="true">' + check + '</div>' +
      '<p class="fk">' + t('Ansøgning komplet', 'Application complete') + '</p><h3 class="fq">' + t('Tak', 'Thanks') + (f ? ', ' + esc(f) : '') + t('. Vi ses ', '. See you ') + when() + '.</h3>' +
      '<p class="fh">' + (EN ? 'Oscar will review your application before the call. In a moment you will get an invitation with a Google Meet link at ' + esc(S.email || 'your email') + '. Add it to your calendar so you do not miss it.'
        : 'Oscar kigger din ansøgning igennem før samtalen. Om et øjeblik får du en invitation med link til Google Meet på ' + esc(S.email || 'din mail') + '. Læg tiden i kalenderen, så den ikke glipper.') + '</p>' + cal + '</div>';
  };
  // tak-siderne: spørgsmålene inline, hvis de mangler (fx hvis de kom hertil uden om formen), ellers "komplet"
  if (INL) { if (S.booked) { INL.hidden = false; render(); } else INL.hidden = true; }
})();
