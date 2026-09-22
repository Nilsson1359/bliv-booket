import re
base=open('index.html',encoding='utf-8').read()
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
 'navy-lime':dict(name='Navy & lime · Unbounded',
  fonts='family=Unbounded:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600',
  vars=''':root{--bg:#0B1220;--warm:#0F1728;--amber:#0E1626;--sand:#1F2C48;--card:#141D33;--stage:#060A14;--stage2:#0B1222;--ink:#EEF2FA;--ink2:#B3BED4;--ink3:#7B889F;--line:rgba(238,242,250,.1);--line2:rgba(238,242,250,.22);--accent:#C7F542;--accent2:#DFFF7A;--accentD:#5F7A12;--accentT:#DFFF7A;--ph:#1F2B47;--ph2:#18223A;--ph3:#293755}
:root{--display:"Unbounded",ui-sans-serif,system-ui,sans-serif}
h1,h2,h3,.big,.card h3,.fsteps li,.ov-p,.kpi b,.hero-meta b,.btn,.logo{font-family:"Unbounded",ui-sans-serif,system-ui,sans-serif;letter-spacing:-.03em}
h1{font-size:clamp(1.55rem,2.6vw,2.3rem);font-weight:700;line-height:1.12}h2{font-size:clamp(1.35rem,2.3vw,2rem);font-weight:600;line-height:1.15}h3{font-weight:600}.big{font-weight:600;font-size:clamp(1.05rem,1.6vw,1.4rem)}.btn{font-weight:600;font-size:.92rem}.story .shout{font-family:"Unbounded",sans-serif;font-weight:800;font-size:clamp(1.3rem,3.4vw,2.6rem)}
.story .letter .q em,.story .letter .hook-a,.card .close em,.pc.ink .bigserif em,.hope .bigserif em{color:var(--accentT)!important}
.ov-s .ov-l,.card .num,.card .two-lists .h4,.pc .h4,.kpct,.dg-f .ac,.fsteps li span,.tcard .twho span{color:var(--accentT)}'''),
}
for key,t in themes.items():
    s=base
    s=re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com/css2\?[^"]*">',f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{t["fonts"]}&display=swap">',s,count=1)
    s=s.replace('<meta name="color-scheme" content="light">','<meta name="color-scheme" content="dark">')
    s=s.replace('</style>',DARK_COMMON+'\n'+t['vars']+'\n</style>',1)
    idx=[m.start() for m in re.finditer(r'<script>',s)]
    s=s[:idx[1]]+'<script>document.querySelectorAll(".dg").forEach(d=>d.classList.add("dark"));</script>\n'+s[idx[1]:]
    s=s.replace('<title>Bliv Booket</title>',f'<title>Bliv Booket · {t["name"]}</title>')
    open(f'{key}.html','w',encoding='utf-8').write(s); print(key,'ok')
