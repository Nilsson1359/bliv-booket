"""Ansøgningsformen (fbm-form.js) sat ind i forsiden i stedet for GHL-kalender-pop-up'en (4/11 2026).

  python3 gen_newform.py            -> _site/new-form-setup.html (forhåndsvisning: ingen GTM/pixel/track.js, noindex)
  python3 gen_newform.py --live     -> _site/index.html bliver den nye version (tracking bevares)

Kør efter build.sh har lagt forsiden i _site/index.html. Selve siden ændres ikke, kun pop-up'en.
"""
import re
import sys

LIVE = '--live' in sys.argv
src = open('_site/index.html', encoding='utf-8').read()
css = open('fbm-form.css', encoding='utf-8').read()

MODAL = '''<!-- ANSØGNINGSFORM (fbm-form.js) -->
<div class="fbm" id="fbmModal" hidden role="dialog" aria-modal="true" aria-labelledby="fbmTitle">
  <div class="fbm-back" data-fbm-close></div>
  <div class="fbm-card">
    <div class="fbm-head">
      <div class="fbm-t"><b id="fbmTitle">Ansøg om en plads</b><span id="fbmStep">Trin 1 af 10</span></div>
      <button class="fbm-x" type="button" aria-label="Luk" data-fbm-close><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l10 10M13 3L3 13"/></svg></button>
    </div>
    <div class="fbm-prog" aria-hidden="true"><i id="fbmBar"></i></div>
    <div class="fbm-body" id="fbmBody"></div>
    <div class="fbm-foot"><span><b>Under 1 minut.</b> Dine svar gemmes undervejs.</span><span>Samtalen er gratis og uforpligtende.</span></div>
  </div>
</div>
<script>window.FBM_LIVE=%s;</script>
<script src="/fbm-form.js" defer></script>
</body>''' % ('true' if LIVE else 'false')

start = src.index('<!-- BOOKING MODAL -->')
end = src.index('</body>', start) + len('</body>')
out = src[:start] + MODAL + src[end:]
out = out.replace('<link rel="preconnect" href="https://link.zency.dk">\n', '')
out = out.replace('</head>', '<style>\n' + css + '</style>\n</head>', 1)

if not LIVE:
    # forhåndsvisning: ingen annonce-tracking og ingen besøgstal i /admin
    out, n1 = re.subn(r'<!-- Google Tag Manager -->.*?<!-- End Google Tag Manager -->\n', '', out, count=1, flags=re.S)
    out, n2 = re.subn(r'<!-- Meta Pixel Code -->.*?<!-- End Meta Pixel Code -->\n', '', out, count=1, flags=re.S)
    out, n3 = re.subn(r'<!-- Google Tag Manager \(noscript\) -->.*?<!-- End Google Tag Manager \(noscript\) -->\n', '', out, count=1, flags=re.S)
    out, n4 = re.subn(r'<script src="/track.js" async></script>\n', '', out, count=1)
    assert (n1, n2, n3, n4) == (1, 1, 1, 1), ('tracking-blokke ikke fundet', n1, n2, n3, n4)
    out = out.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="noindex,nofollow">')
    out = out.replace('<title>Bliv Booket</title>', '<title>Bliv Booket · ny ansøgningsform</title>')

assert 'link.zency.dk' not in out, 'GHL-widget hænger stadig ved'
dst = '_site/index.html' if LIVE else '_site/new-form-setup.html'
open(dst, 'w', encoding='utf-8').write(out)
print(dst, 'ok', len(out))
