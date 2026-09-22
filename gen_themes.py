import re
import sys
SRC=sys.argv[1] if len(sys.argv)>1 else 'index.html'
OUTP=sys.argv[2] if len(sys.argv)>2 else ''
base=open(SRC,encoding='utf-8').read()
DARK_COMMON='''
/* ===== DARK THEME OVERRIDES ===== */
:root{color-scheme:dark}
body{background:var(--bg);color:var(--ink)}
body::before{mix-blend-mode:screen;opacity:.16}
.nav.scrolled{background:color-mix(in srgb,var(--bg) 84%,transparent)}
.hero::before{background:conic-gradient(from 165deg at 50% 0%,transparent 0deg,color-mix(in srgb,var(--accent) 22%,transparent) 12deg,transparent 30deg)}
.hero-blob.a{background:color-mix(in srgb,var(--accent) 18%,var(--bg))}
.bg-stage::before{background:radial-gradient(ellipse 34% 60% at 50% 0%,color-mix(in srgb,var(--accent) 26%,transparent),color-mix(in srgb,var(--accent) 6%,transparent) 45%,transparent 70%)}
.final .glow{background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 18%,transparent),transparent 70%)}
/* text on stage sections */
.bg-stage,.bg-stage h2,.bg-stage h3,.bg-stage .big,.bg-stage .bigserif,.talent-lines p,.tl li,.final h2,.fx-body .bigserif{color:var(--ink)}
.bg-stage .lead,.talent-lines p.sm,.final p{color:var(--ink2)}
.bg-stage .eyebrow,.final h2 em{color:var(--accent2)}
.bg-stage .dim{color:var(--ink3)}
/* pills, buttons */
.tagpill,.hero-tag .pill{background:var(--card);border-color:var(--line2);color:var(--ink)}
.tagpill.dark{background:transparent;border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--accent2)}
.btn,.btn.light,.btn.lg{background:var(--accent);color:#0B0F0D}
.btn::before{background:var(--ink)}
.btn:hover{color:var(--bg)}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line2)}
.btn.ghost::before{background:var(--accent)}
.btn.ghost:hover{color:#0B0F0D}
.nav .btn{background:var(--ink);color:var(--bg)}
.nav .btn::before{background:var(--accent)}
.nav .btn:hover{color:#0B0F0D}
/* highlights */
.hl,.mark,.story .letter .mark{background:linear-gradient(transparent 62%,color-mix(in srgb,var(--accent) 38%,transparent) 62%,color-mix(in srgb,var(--accent) 38%,transparent) 94%,transparent 94%)!important;color:var(--ink)}
/* surfaces */
.ph .lbl{background:color-mix(in srgb,var(--bg) 80%,transparent);color:var(--ink2)}
.vsl-fb{color:var(--ink)}
.vsl-fb .play{background:var(--accent);color:#0B0F0D}
.pola{background:var(--sand);box-shadow:0 30px 50px -30px rgba(0,0,0,.8)}
.pola .cap,.pola .yr{color:var(--ink)}
.ck{background:var(--sand)}
.ck.ink{background:var(--accent)}
.ck.ink svg{stroke:#0B0F0D}
.dg,.dg.dark{background:var(--card);border-color:var(--line2)}
.kpi,.eqbig,.notif,.tcard,.ov,.pc,.checks li,.qcloud div,.plist div,.done div,.mayb div,.cannot div,.invest div,.tpbadge,.card,.monday{background:var(--card);border-color:var(--line2)}
.pc.sand,.ov-s,.cmp div,.fsteps li,.card .two-lists .pc,.tcard .av,.qcloud div::before,.steps div::before,.kbar,.notif .dot{background:var(--sand)}
.pc.sand{border-color:transparent}
.pc.ink,.cmp div.on,.fsteps li.on,.ov-pill{background:var(--ink);color:var(--bg)}
.cmp div.on .k,.fsteps li.on span,.pc.ink .eyebrow,.swap .pc.ink .mono{color:var(--accentD)!important}
.cmp div.on small{color:color-mix(in srgb,var(--bg) 70%,transparent)}
.pc.ink .bigserif,.pc.ink .big,.pc.ink p,.hope .bigserif{color:var(--bg)!important}
.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentD)!important}
.pc.ink .btn{background:var(--bg);color:var(--ink)}
.pc.ink .btn::before{background:var(--accent)}
.pc.ink .btn:hover{color:#0B0F0D}
.pc.ink .tagpill.dark{border-color:color-mix(in srgb,var(--bg) 40%,transparent);color:var(--bg)}
.chain .pill{border-color:color-mix(in srgb,var(--bg) 25%,transparent);background:color-mix(in srgb,var(--bg) 8%,transparent);color:var(--bg)}
.chain .arr{background:color-mix(in srgb,var(--bg) 30%,transparent)}
.chain .arr::after{border-left-color:color-mix(in srgb,var(--bg) 40%,transparent)}
.chain .arr i{background:var(--accentD)}
.card{box-shadow:0 -24px 60px -34px rgba(0,0,0,.8)}
.monday{color:var(--ink);box-shadow:0 40px 80px -40px rgba(0,0,0,.9)}
.talent .monday .stage-tag{color:var(--ink3)}
.stage-tag.off .live::before{background:var(--ink3)}
.final .mono{color:var(--ink3)}
footer{background:var(--stage);color:var(--ink3);border-color:var(--line)}
.kslots i.h{background:color-mix(in srgb,var(--accent) 40%,transparent)}
.card .ph,.ph{background:var(--ph)}
.tpbadge .tpstars{color:#00B67A}
.marquee span{color:var(--ink2)}
.story .letter .sal,.story .shout{color:var(--ink)}
.fixnow{background:var(--stage);border:1px solid var(--line2)}
.fx-media::after{background:linear-gradient(90deg,transparent 60%,var(--stage) 100%)}
@media (max-width:980px){.fx-media::after{background:linear-gradient(180deg,transparent 60%,var(--stage) 100%)}}
.fx-sub{color:var(--ink3)}
.swap .arrow{color:var(--accent)}
.js .quote.strike.in{color:var(--ink3)}
/* booking widget blends into dark card */
.bk-body{padding:0}.bk-body::after{height:0}.bk-body iframe{background:var(--card);border-radius:0;min-height:100%}.bk-load{inset:0;border-radius:0;background:var(--card)}
'''
themes={
 'dark-green':dict(name='Mørk & grøn · Syne',
  fonts='family=Syne:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#0E1411;--warm:#111A15;--amber:#101915;--sand:#1F2E27;--card:#162019;--stage:#070B09;--stage2:#0C1310;--ink:#EEF3EF;--ink2:#B4C1B9;--ink3:#7E8C84;--line:rgba(238,243,239,.1);--line2:rgba(238,243,239,.22);--accent:#3DD68C;--accent2:#8CEFC0;--accentD:#1E7A4E;--accentT:#8CEFC0;--ph:#22302A;--ph2:#1B2721;--ph3:#2B3B33}
:root{--display:"Syne",ui-sans-serif,system-ui,sans-serif}
h1,h2,h3,.big,.card h3,.fsteps li,.ov-p,.kpi b,.hero-meta b,.btn,.logo{font-family:"Syne",ui-sans-serif,system-ui,sans-serif;letter-spacing:-.01em}
h1{font-weight:800;font-size:clamp(1.6rem,2.7vw,2.4rem);line-height:1.1}h2{font-weight:700;font-size:clamp(1.4rem,2.4vw,2.1rem)}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
 'black-gold':dict(name='Sort & guld · Archivo',
  fonts='family=Archivo:wdth,wght@100,500..900&family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#0D0C0A;--warm:#12100E;--amber:#110F0C;--sand:#262119;--card:#181511;--stage:#050504;--stage2:#0C0B09;--ink:#F3EEE4;--ink2:#BDB4A6;--ink3:#84796A;--line:rgba(243,238,228,.1);--line2:rgba(243,238,228,.22);--accent:#D9A94A;--accent2:#F0CC7C;--accentD:#8A6420;--accentT:#F0CC7C;--ph:#2C2720;--ph2:#231F19;--ph3:#363028}
:root{--display:"Archivo",ui-sans-serif,system-ui,sans-serif}
h1,h2,h3,.big,.card h3,.fsteps li,.ov-p,.kpi b,.hero-meta b,.btn,.logo{font-family:"Archivo",ui-sans-serif,system-ui,sans-serif;font-variation-settings:"wdth" 100;letter-spacing:-.02em}
h1{font-weight:800}h2{font-weight:750}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
 'burgundy':dict(name='Bordeaux & champagne · Fraunces',
  fonts='family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#160B0E;--warm:#1C0F13;--amber:#1A0E12;--sand:#33202A;--card:#21131A;--stage:#0C0507;--stage2:#150A0E;--ink:#F6EEE8;--ink2:#C9B7B0;--ink3:#8E7A76;--line:rgba(246,238,232,.1);--line2:rgba(246,238,232,.22);--accent:#E3C08A;--accent2:#F2D9B0;--accentD:#8F6B3A;--accentT:#F2D9B0;--ph:#3A2630;--ph2:#2E1D26;--ph3:#46303A}
:root{--display:"Fraunces",Georgia,serif}
h1,h2,h3,.big,.card h3,.ov-p,.kpi b,.hero-meta b,.logo,.story .shout{font-family:"Fraunces",Georgia,serif;font-variation-settings:"opsz" 144,"SOFT" 30;letter-spacing:-.015em}
h1{font-weight:500;font-size:clamp(2rem,3.6vw,3.2rem);line-height:1.05}h1 em{font-style:italic;font-weight:400}h2{font-weight:500;font-size:clamp(1.7rem,3vw,2.6rem)}h3{font-weight:500}.card h3{font-weight:500}.big{font-weight:500}.ov-p{font-weight:500}
.btn,.fsteps li{font-family:"Manrope",sans-serif;font-weight:700}
.story .shout{text-transform:none;font-weight:600;font-style:italic;letter-spacing:-.01em}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
 'charcoal-silver':dict(name='Kul & sølv · Cormorant + Manrope',
  fonts='family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#0F1012;--warm:#141517;--amber:#121315;--sand:#25272B;--card:#18191C;--stage:#070708;--stage2:#0E0F11;--ink:#F2F2F0;--ink2:#B9BAB6;--ink3:#7E7F7B;--line:rgba(242,242,240,.1);--line2:rgba(242,242,240,.22);--accent:#D6D9DE;--accent2:#EEF0F3;--accentD:#6B7078;--accentT:#EEF0F3;--ph:#2A2C30;--ph2:#222327;--ph3:#343639}
:root{--display:"Cormorant Garamond",Georgia,serif}
h1,h2,h3,.card h3,.ov-p,.hero-meta b,.logo,.story .shout,.bigserif,.story .letter .q,.hope .bigserif{font-family:"Cormorant Garamond",Georgia,serif;letter-spacing:-.005em}
h1{font-weight:600;font-size:clamp(2.4rem,4.4vw,4rem);line-height:1.02}h1 em{font-style:italic;font-weight:500}h2{font-weight:600;font-size:clamp(2rem,3.4vw,3rem);line-height:1.05}h3,.card h3{font-weight:600;font-size:clamp(1.6rem,2.4vw,2.2rem)}.ov-p{font-size:1.35rem;font-weight:600}
.big{font-family:"Manrope",sans-serif;font-weight:700;letter-spacing:-.02em}.kpi b{font-family:"Manrope",sans-serif;font-weight:800;letter-spacing:-.03em}
.btn,.fsteps li{font-family:"Manrope",sans-serif;font-weight:700}
.story .shout{text-transform:uppercase;font-weight:700;letter-spacing:.02em}
.btn,.btn.light,.btn.lg{background:var(--ink);color:var(--bg)}.btn::before{background:var(--accent2)}.btn:hover{color:var(--bg)}
.tagpill::before,.hero-tag .pill::before{background:var(--accent2)}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentD)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--ink2)}'''),
 'espresso-copper':dict(name='Espresso & kobber · Playfair + Manrope',
  fonts='family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#120E0B;--warm:#17120E;--amber:#15100C;--sand:#2C221B;--card:#1C1611;--stage:#090705;--stage2:#110D0A;--ink:#F4ECE3;--ink2:#C5B7A9;--ink3:#8A7B6D;--line:rgba(244,236,227,.1);--line2:rgba(244,236,227,.22);--accent:#C8834E;--accent2:#E6AE7E;--accentD:#7D4E2B;--accentT:#E6AE7E;--ph:#332820;--ph2:#2A201A;--ph3:#3E3129}
:root{--display:"Playfair Display",Georgia,serif}
h1,h2,h3,.card h3,.ov-p,.hero-meta b,.logo,.story .shout{font-family:"Playfair Display",Georgia,serif;letter-spacing:-.01em}
h1{font-weight:600;font-size:clamp(2rem,3.5vw,3.1rem);line-height:1.08}h1 em{font-style:italic;font-weight:500}h2{font-weight:600;font-size:clamp(1.65rem,2.9vw,2.5rem);line-height:1.1}h3,.card h3{font-weight:600}.ov-p{font-weight:600;font-size:1.2rem}
.big,.kpi b{font-family:"Manrope",sans-serif;font-weight:700;letter-spacing:-.02em}
.btn,.fsteps li{font-family:"Manrope",sans-serif;font-weight:700}
.story .shout{text-transform:none;font-style:italic;font-weight:600}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
 'forest-brass':dict(name='Skovgrøn & messing · Fraunces',
  fonts='family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#0B1A14;--warm:#0F2018;--amber:#0E1E17;--sand:#1E3A2E;--card:#12251C;--stage:#06110D;--stage2:#0B1A14;--ink:#EEF4EF;--ink2:#B7C7BD;--ink3:#7F9388;--line:rgba(238,244,239,.1);--line2:rgba(238,244,239,.22);--accent:#D9B25A;--accent2:#EFD08A;--accentD:#8A6E2A;--accentT:#EFD08A;--ph:#21382E;--ph2:#1A2E25;--ph3:#2A4438}
:root{--display:"Fraunces",Georgia,serif}
h1,h2,h3,.big,.card h3,.ov-p,.kpi b,.hero-meta b,.logo,.story .shout{font-family:"Fraunces",Georgia,serif;font-variation-settings:"opsz" 144,"SOFT" 30;letter-spacing:-.015em}
h1{font-weight:500;font-size:clamp(2rem,3.6vw,3.2rem);line-height:1.05}h1 em{font-style:italic;font-weight:400}h2{font-weight:500;font-size:clamp(1.7rem,3vw,2.6rem)}h3,.card h3{font-weight:500}.big,.ov-p{font-weight:500}
.btn,.fsteps li{font-family:"Manrope",sans-serif;font-weight:700}
.story .shout{text-transform:none;font-weight:600;font-style:italic;letter-spacing:-.01em}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
 'onyx-emerald':dict(name='Onyx & smaragd · Archivo',
  fonts='family=Archivo:wdth,wght@100,500..900&family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#0A0C0B;--warm:#0E1210;--amber:#0D100F;--sand:#1C2622;--card:#121816;--stage:#050606;--stage2:#0A0C0B;--ink:#F0F3F1;--ink2:#B5BFBA;--ink3:#7B8681;--line:rgba(240,243,241,.1);--line2:rgba(240,243,241,.22);--accent:#2ECC8A;--accent2:#7FE7B9;--accentD:#177A50;--accentT:#7FE7B9;--ph:#1C2622;--ph2:#161E1B;--ph3:#243029}
:root{--display:"Archivo",ui-sans-serif,system-ui,sans-serif}
h1,h2,h3,.big,.card h3,.fsteps li,.ov-p,.kpi b,.hero-meta b,.btn,.logo{font-family:"Archivo",ui-sans-serif,system-ui,sans-serif;font-variation-settings:"wdth" 100;letter-spacing:-.02em}
h1{font-weight:800}h2{font-weight:750}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
 'olive-champagne':dict(name='Oliven & champagne · Cormorant + Manrope',
  fonts='family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#12160F;--warm:#171C13;--amber:#151A12;--sand:#2B3324;--card:#1A2016;--stage:#0A0D08;--stage2:#12160F;--ink:#F2F1E8;--ink2:#C1C3B2;--ink3:#868A78;--line:rgba(242,241,232,.1);--line2:rgba(242,241,232,.22);--accent:#E1CB8C;--accent2:#F1E0B2;--accentD:#8E7A3E;--accentT:#F1E0B2;--ph:#2A3223;--ph2:#22291C;--ph3:#343D2C}
:root{--display:"Cormorant Garamond",Georgia,serif}
h1,h2,h3,.card h3,.ov-p,.hero-meta b,.logo,.story .shout,.bigserif,.story .letter .q,.hope .bigserif{font-family:"Cormorant Garamond",Georgia,serif;letter-spacing:-.005em}
h1{font-weight:600;font-size:clamp(2.4rem,4.4vw,4rem);line-height:1.02}h1 em{font-style:italic;font-weight:500}h2{font-weight:600;font-size:clamp(2rem,3.4vw,3rem);line-height:1.05}h3,.card h3{font-weight:600;font-size:clamp(1.6rem,2.4vw,2.2rem)}.ov-p{font-size:1.35rem;font-weight:600}
.big{font-family:"Manrope",sans-serif;font-weight:700;letter-spacing:-.02em}.kpi b{font-family:"Manrope",sans-serif;font-weight:800;letter-spacing:-.03em}
.btn,.fsteps li{font-family:"Manrope",sans-serif;font-weight:700}
.story .shout{text-transform:uppercase;font-weight:700;letter-spacing:.02em}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
}
for key,t in themes.items():
    s=base
    s=re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com/css2\?[^"]*">',f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{t["fonts"]}&display=swap">',s,count=1)
    s=s.replace('<meta name="color-scheme" content="light">','<meta name="color-scheme" content="dark">')
    s=s.replace('</style>',DARK_COMMON+'\n'+t['vars']+'\n</style>',1)
    idx=[m.start() for m in re.finditer(r'<script>',s)]
    if len(idx)>1: s=s[:idx[1]]+'<script>document.querySelectorAll(".dg").forEach(d=>d.classList.add("dark"));</script>\n'+s[idx[1]:]
    s=s.replace('<title>Bliv Booket</title>',f'<title>Bliv Booket · {t["name"]}</title>')
    s=s.replace('<title>Tak · Bliv Booket</title>',f'<title>Tak · Bliv Booket · {t["name"]}</title>')
    open(f'{OUTP}{key}.html','w',encoding='utf-8').write(s); print(OUTP+key,'ok')
