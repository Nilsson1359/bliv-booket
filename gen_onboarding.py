#!/usr/bin/env python3
"""Bygger onboarding.html (fuldtbooketmusiker.dk/onboarding): GHL-onboardingformularen i kul & sølv-stil.
Head + basis-CSS tages fra tak-charcoal-silver.html, så siden følger temaet. Ingen GTM/pixel/tracking:
siden er til eksisterende kunder, ikke annonce-trafik. Kør efter gen_themes.py (build.sh gør det)."""
import re, pathlib

ROOT = pathlib.Path(__file__).parent
src = (ROOT / 'tak-charcoal-silver.html').read_text()

# Copy (Oscar sender endelig tekst)
EYEBROW = 'Onboarding'
H1 = 'Velkommen om bord. <em>Nu går vi i gang.</em>'
SUB = 'Udfyld formularen herunder, så har vi alle de informationer, vi skal bruge for at komme i gang med dig.'

FORM_ID = 'zqMwbdFBvHqQL3FB7XB3'

head = src[:src.index('</style>') + len('</style>')]
# drop GTM + Meta Pixel + track.js
head = re.sub(r'<!-- Google Tag Manager -->.*?<script src="/track.js" async></script>\n', '', head, flags=re.S)
head = re.sub(r'<title>.*?</title>', '<title>Onboarding · Bliv Booket</title>', head)
assert 'fbq(' not in head and 'googletagmanager' not in head and '<style>' in head

page = head + f'''
<style>
.ob-hero{{padding-top:calc(var(--navh) + clamp(40px,6vw,80px));padding-bottom:clamp(48px,7vw,96px);overflow:hidden;min-height:100vh}}
.ob-hero .wrap{{display:flex;flex-direction:column;align-items:center;text-align:center;gap:clamp(28px,4vw,44px)}}
.ob-hero .stack-lg{{align-items:center;max-width:760px}}
.ob-hero h1{{font-size:clamp(2rem,4.2vw,3.4rem)}}
.ob-hero h1 em{{font-family:var(--serif);font-style:italic;font-weight:400}}
.ob-hero .lead{{max-width:56ch}}
.ob-form{{width:100%;max-width:760px;border-radius:var(--rc,24px);background:var(--card);border:1px solid var(--line);padding:clamp(6px,1.4vw,14px);box-shadow:0 30px 80px -40px rgba(0,0,0,.6)}}
.ob-form iframe{{display:block;width:100%;height:1257px;border:none;border-radius:calc(var(--rc,24px) - 8px)}}
@media (max-width:640px){{.ob-form{{padding:0;border:none;background:none;box-shadow:none}}}}
</style>
</head>
<body>
<header class="nav" id="nav"><div class="wrap">
  <a class="logo" href="/" aria-label="Bliv Booket"><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Bliv Booket<sup>™</sup></a>
</div></header>
<section class="ob-hero bg-beige" id="top">
  <div class="hero-blob a" aria-hidden="true"></div>
  <div class="wrap">
    <div class="stack-lg">
      <span class="eyebrow">{EYEBROW}</span>
      <h1>{H1}</h1>
      <p class="lead">{SUB}</p>
    </div>
    <div class="ob-form">
      <iframe
        src="https://link.zency.dk/widget/form/{FORM_ID}"
        id="inline-{FORM_ID}"
        data-layout="{{'id':'INLINE'}}"
        data-trigger-type="alwaysShow"
        data-trigger-value=""
        data-activation-type="alwaysActivated"
        data-activation-value=""
        data-deactivation-type="neverDeactivate"
        data-deactivation-value=""
        data-form-name="Fuldt Booket Musiker - Onboarding Form"
        data-height="1257"
        data-layout-iframe-id="inline-{FORM_ID}"
        data-form-id="{FORM_ID}"
        data-cookie-consent="true"
        data-cookie-consent-provider="auto"
        title="Fuldt Booket Musiker - Onboarding Form"></iframe>
    </div>
  </div>
</section>
<footer><div class="wrap"><span>© 2026 Bliv Booket™</span><span>Fuldt booket musiker på 90 dage</span></div></footer>
<script>document.querySelectorAll(".dg").forEach(d=>d.classList.add("dark"));</script>
<script>
(function(){{
  document.documentElement.classList.add('js');
  const nav=document.getElementById('nav');const f=()=>nav.classList.toggle('scrolled',scrollY>20);f();addEventListener('scroll',f,{{passive:true}});
}})();
</script>
<script src="https://link.zency.dk/js/form_embed.js"></script>
</body>
</html>
'''
(ROOT / 'onboarding.html').write_text(page)
print('onboarding.html bygget')
