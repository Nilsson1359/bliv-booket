#!/usr/bin/env python3
"""fuldtbooketmusiker.dk/performance (Oskar 23/11 2026): forsiden med performance-modellen.
Budskab (Oskar 23/11): musikeren betaler kun for de gigs, der kommer igennem os. Nævn IKKE procent/andel,
'0 kr.', annoncebetaling eller hvilke gigs der tæller. Bygges fra _site/index.html (kul & sølv + ansøgningsformen), så
design, formular og tracking er præcis som forsiden. Kun tekst og afsnittet #pris er nyt. Køres af build.sh."""
import sys
SRC, OUT = '_site/index.html', '_site/performance.html'
s = open(SRC, encoding='utf-8').read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n < count:
        sys.exit(f'gen_performance: fandt ikke "{old[:60]}" ({n} af {count}). Forsiden er ændret; ret gen_performance.py.')
    s = s.replace(old, new) if count > 1 else s.replace(old, new, 1)

CK = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'
rep('<span class="pill"><span>Et 90-dages <span class="nw">gjort-for-dig-system</span></span></span>',
    '<span class="pill"><span>Du betaler kun for <span class="nw">gigs, vi skaffer dig</span></span></span>')
rep('På 90 dage hjælper vi dig med at finde de rigtige kunder, vise hvorfor de skal vælge dig og bygge et system, der skaber nye henvendelser, også når du ikke selv leder efter jobs.',
    'Vi finder de rigtige kunder, viser hvorfor de skal vælge dig og bygger et system, der skaber nye henvendelser. Du betaler kun for de gigs, der kommer igennem os.')
rep('<div><b>90 dage</b>fra start til fuld kalender</div>', '<div><b>Betal pr. gig</b>kun for gigs, der kommer igennem os</div>')
rep('<p class="fx-sub">90 dage · Gjort for dig · Du møder op til de gigs, vi booker ind til dig.</p>',
    '<p class="fx-sub">Gjort for dig · Du betaler kun for de gigs, vi booker ind til dig.</p>')
rep('<h2>På 90 dage hjælper vi dig med at:</h2>', '<h2>Vi hjælper dig med at:</h2>')
rep('<span>Et 90-dages <span class="nw">gjort-for-dig-system</span></span>', '<span>Gjort for dig. <span class="nw">Du betaler kun for gigs</span></span>', 2)
rep('Bliv Booket™ · Et 90-dages <span class="nw">gjort-for-dig-system</span> for musikere, DJs og bands · ',
    'Bliv Booket™ · Et <span class="nw">gjort-for-dig-system</span> for musikere, DJs og bands, hvor du kun betaler for gigs · ')

SECTION = f'''<!-- SÅDAN BETALER DU (performance, gen_performance.py) -->
<section class="sheet bg-amber pay" id="pris">
  <div class="wrap stack-lg">
    <div class="sh rv">
      <div class="stack"><span class="eyebrow">Sådan betaler du</span><h2>Du betaler kun for de gigs, vi skaffer dig</h2></div>
      <p class="lead">Vi tjener kun penge, når du gør. Derfor har vi samme mål som dig: flere gode gigs i din kalender.</p>
    </div>
    <div class="pay-steps">
      <div class="pc rv"><span class="pay-n">1</span><p class="h4">Vi bygger det hele</p><p>Videoer, annoncer, side og opfølgning. Gjort for dig.</p></div>
      <div class="pc rv" data-d="1"><span class="pay-n">2</span><p class="h4">Kunden booker dig</p><p>Du spiller gigget og får betalingen fra kunden, præcis som du plejer.</p></div>
      <div class="pc rv" data-d="2"><span class="pay-n">3</span><p class="h4">Du betaler for gigget</p><p>Kun for de gigs, der kommer igennem os.</p></div>
    </div>
    <div class="two top">
      <div class="pair rv"><p class="big">Vi tager risikoen sammen med dig.</p><p class="lead">Du skal ikke betale for et forløb og håbe på, at det virker. Du betaler, når vi har skaffet dig et gig.</p></div>
      <div class="stack rv" data-d="2" style="gap:14px">
        <ul class="pay-list"><li>Du betaler kun for gigs, der kommer igennem os</li><li>Videoer, annoncer og opfølgning er gjort for dig</li><li>Du ser hver henvendelse og hvert gig i din egen app</li></ul>
        <div><a class="btn" href="#ansoeg" data-magnet>Ansøg nu om en plads <span class="ar" aria-hidden="true">{CK}</span></a></div>
      </div>
    </div>
  </div>
</section>

'''
rep('<section class="sheet bg-warm promise">', SECTION + '<section class="sheet bg-warm promise">')
CSS = '''<style>/* performance (gen_performance.py): kun temaets variabler */
.pay-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(12px,1.6vw,22px)}
.pay-steps .pc{display:flex;flex-direction:column;gap:8px}
.pay-n{font-family:var(--serif,Georgia,serif);font-size:2.2rem;line-height:1;color:var(--accent)}
.pay-calc .pay-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink2)}
.pay-calc .pay-row span{white-space:nowrap}.pay-calc .pay-row b{color:var(--ink);font-size:1.2rem;text-align:right}
.pay-calc .pay-row.tot{border-bottom:0}.pay-calc .pay-row.tot b{color:var(--accent);font-size:1.5rem}
.pay-note{color:var(--ink2);margin:0}
.pay-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.pay-list li{position:relative;padding-left:30px;font-size:1.05rem}
.pay-list li:before{content:"";position:absolute;left:0;top:.3em;width:18px;height:18px;border-radius:50%;border:1.5px solid var(--accent)}
.pay-list li:after{content:"";position:absolute;left:6px;top:calc(.3em + 4px);width:5px;height:8px;border:solid var(--accent);border-width:0 1.8px 1.8px 0;transform:rotate(45deg)}
@media (max-width:760px){.pay-steps{grid-template-columns:1fr}}
</style>
<meta name="robots" content="noindex">
<link rel="canonical" href="https://fuldtbooketmusiker.dk/">
'''
i = s.rindex('</head>'); s = s[:i] + CSS + s[i:]
open(OUT, 'w', encoding='utf-8').write(s)
print('gen_performance: _site/performance.html')
