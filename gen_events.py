#!/usr/bin/env python3
"""Bygger Oscars gig-landingssider: /firmafest og /bryllup (fuldtbooketmusiker.dk).
Én kilde -> 2 sider x 3 designretninger (a/b/c) + ev-temaer.html (vælger).
Tekst: Charlies copy-dokument (ordret, tankestreger erstattet). Formular: typeform-stil, gemmes mens
der skrives (POST /api/lead), derefter egen kalender (GET /api/slots, POST /api/book -> GHL).
Kør: python3 gen_events.py [valgt-retning]   (build.sh kopierer de valgte til _site/firmafest.html + bryllup.html)"""
import json, pathlib, sys, html as H

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / 'ev'
OUT.mkdir(exist_ok=True)
CHOSEN = sys.argv[1] if len(sys.argv) > 1 else 'a'

TRUSTPILOT = 'https://dk.trustpilot.com/review/oscartjoensson.dk'
PIXEL_ID = ''   # [MANGLER] Oscars egen Meta-pixel til gig-annoncerne; tom = ingen pixel/GTM

# ───────────────────────── anmeldelser (Trustpilot, ordret) ─────────────────────────
R = {
 'vigso': ('Perfekt stemning fra start til slut!', 'Oscar får vores varmeste anbefalinger! Han var med os hele bryllupsdagen og skabte præcis den rette stemning. Han rørte os med smukt guitarspil og sang ved vielsen og leverede behagelig baggrundsmusik til receptionen. På bådfarten inden middagen satte han for alvor gang i fællessangen, og som afslutning styrede han diskoteket og holdt dansegulvet i gang, til vi simpelthen ikke kunne mere. Helt magisk! Hvis I leder efter en alsidig musiker, der kan det hele, og en helt igennem rar person, så er det Oscar, I skal booke.', 'Camilla Vive Holmgren Vigsø', '21.09.2026', 'Han var med os hele bryllupsdagen og skabte præcis den rette stemning.'),
 'kasper': ('Oscar og Clara var med til at gøre vores bryllup til noget helt særligt!', 'Oscar spillede guitar og sang under middagen sammen med Clara, og de skabte præcis den hyggelige og afslappede stemning, vi havde håbet på. Det var virkelig dejligt at have livemusik så tæt på under middagen, både musikken og Claras fantastiske stemme passede perfekt til aftenen. Senere på aftenen tog Oscar over som DJ, og så blev der for alvor skruet op for festen! Vi er virkelig glade for, at vi valgte Oscar og Clara til vores bryllup. De var super søde, professionelle og utrolig gode til at mærke stemningen og levere det, der passede til aftenen. Kæmpe anbefaling herfra. Vi kunne ikke have ønsket os en bedre musikalsk ramme om vores bryllup!', 'Kasper', '21.09.2026', 'Senere på aftenen tog Oscar over som DJ, og så blev der for alvor skruet op for festen!'),
 'porskrog': ('Helt fantastisk musiker!', 'Vi bookede Oscar til vores bryllup, da vi ønskede én som kunne spille lige fra udendørs vielsen og til gæsterne gik hjem, altså én som kunne spille musik til forskellige stemninger, og det må man sige at Oscar han KAN! Han spillede og sang akustisk, på fineste vis, til vielsen. Efter vielsen flyttede vi udstyret op til receptionen, hvor der blev spillet dejlig, festlig og hyggeligt musik. Under middagen spillede og sang han lavmeldt, så der var god mulighed for at snakke ved bordene. Da natten faldt på og der var godt gang i festen spillede han op til dans, og alle gæsterne var ude at give den gas. Oscar har hele tiden en finger på pulsen, og fornemmer hurtigt stemningen i selskabet. Vi kunne ikke have været mere tilfredse med vores valg at musiker, og vi vil give vores allervarmeste anbefalinger til Oscar! Der er ingen tvivl om, at det bliver ham vi booker igen en anden gang :-)', 'Camilla Porskrog Christensen', '17.09.2026', 'Oscar har hele tiden en finger på pulsen, og fornemmer hurtigt stemningen i selskabet.'),
 'heidi': ('Oscar spillede til vores bryllup 16/5', 'Oscar spillede til vores bryllup 16/5. Han spillede på guitar og sang under middagen. Meget dejligt baggrundsmusik, som skabte en let og dejlig stemning. Efter brudevalsen skiftede Oscar over til DJ pulten og havde et bredt udvalg med og var virkelig god til at skifte mellem de forskellige genre, da vores gæster var en meget blandet flok. Han fik alle i gang og skabte en fantastisk feststemning. Oscar kender både til nyt og gammelt. Han tog imod alle ønsker og var med til at gøre vores dag/nat uforglemmelig og helt perfekt. Vi vil klart anbefale Oscar til privatfest både til unge som gamle.', 'Heidi', '19.05.2026', 'Han fik alle i gang og skabte en fantastisk feststemning.'),
 'andreas': ('Fantastisk oplevelse da Oscar spillede…', 'Fantastisk oplevelse da Oscar spillede til min Far’s bryllup lige fra kirken helt frem til sidst sang der blev spillet på dj pulten kan klart anbefales hvis i skal havde en og spille til jeres festlige begivenheder', 'Andreas Mario Møller', '31.03.2026', 'Lige fra kirken helt frem til sidst sang der blev spillet på dj pulten.'),
 'norup': ('Oscar spillede til vores bryllup både…', 'Oscar spillede til vores bryllup både akustisk med sang og DJ til festen efter midnat. Det var en super god beslutning at vælge Oscar, der foruden at være dygtig og imødekommende er en utrolig professionel og venlig ung mand. Han var med til løfte vores fest til det vi ønskede os allermest “En dansefest”. Alle vores gæster var vilde med ham og dansegulvet var fyldt fra start til slut. Oscar formåede at ramme alle aldersgrupper og som prikken over i et spillede og sang han i kirken lige efter vores vielse solo foran 100 gæster og os.', 'Henrik Norup-Møller', '30.03.2026', 'Alle vores gæster var vilde med ham og dansegulvet var fyldt fra start til slut.'),
 'laura': ('Perfekt musik hele dagen', 'Oscar spillede musik til min mors bryllup den 14/03-2026, og det var en helt fantastisk oplevelse. Han var med fra vielsen og helt til langt ud på natten. Han leverede en gennemført og stemningsfuld indsats hele vejen igennem🌟 Kan varmt anbefale Oscar til alle, der leder efter en dygtig og pålidelig live-musiker!☺️', 'Laura Norup Tolmer', '30.03.2026', 'Han var med fra vielsen og helt til langt ud på natten.'),
 'sonderup': ('5 stjerner ⭐️⭐️⭐️⭐️⭐️', 'Vi havde Oscar til at spille live musik til vores fest, og det var en virkelig god oplevelse hele vejen igennem. ✨ Han var rigtig god til at tilpasse sangvalget til både anledning, gæsterne og stemningen i rummet. Under middagen var han meget opmærksom på at holde lydniveauet behageligt, så man stadig kunne føre samtaler, og musikken var helt klart med til, at løfte helhedsoplevelsen og niveauet for vores fest. Vi kan varmt anbefale Oscar til andre, der ønsker live musik ✨', 'Camilla Sønderup', '27.01.2026', 'Under middagen var han meget opmærksom på at holde lydniveauet behageligt, så man stadig kunne føre samtaler.'),
 'solv': ('Oscar spillede til vores sølvbryllup og…', 'Oscar spillede til vores sølvbryllup og gjorde det bare perfekt. Super under middagen og med lidt flere musikere (Martin Jønsson + trommer og sangerinde) gik det hele op i en højere enhed. Tak for festen 🙏🤗', 'Henrik Rasmussen', '10.10.2025', 'Oscar spillede til vores sølvbryllup og gjorde det bare perfekt.'),
 'jakob': ('Super dygtig musiker', 'Super dygtig musiker, kæmpe repetoire og perfekt til at skabe stemning til festen 👌🏻', 'Jakob Tømrerfirma A/S', '28.09.2025', 'Kæmpe repetoire og perfekt til at skabe stemning til festen.'),
 'emma': ('Oscar leverede musikken til vores bryllup!', 'Vi havde booket Oscar til at spille guitar og synge til vores vielse og reception, og vi var super tilfredse med musikken! Udover vores egen begejstring, fik Oscar også meget ros fra vores gæster. Vi havde på forhånd aftalt et bestemt musiknummer, vi ville ankomme til, og ellers stod Oscar selv for at bestemme resten af musikken, og det hele passede perfekt ind i den stemning, vi ønskede os for dagen.', 'Emma', '12.09.2025', 'Udover vores egen begejstring, fik Oscar også meget ros fra vores gæster.'),
 'benjamin': ('Fleksibel, selvkørende, stemnings-spotter og publikumsfavorit', 'Vi har af to omgange haft Oscar til at spille til arrangementer. Kæmpe fornøjelse begge gange. Oscar er selvkørende, fleksibel, godt selskab, fanger rummet og stemningen og så er gæsterne ret fan af ham, også til en lille snak i pauserne. Oscar får en stor anbefaling. Det er i hvert fald ikke sidste gang, at vi bruger ham.', 'Benjamin Henriksen', '10.07.2025', 'Oscar er selvkørende, fleksibel, godt selskab, fanger rummet og stemningen.'),
 'md': ('Oscar er teknisk dygtig', 'Oscar er teknisk dygtig, en virkelig god guitarist og sanger. Oscar var meget nærværende og gæsterne havde en fest. En sublim oplevelse Booker gerne Oscar igen :-)', 'MD', '11.04.2025', 'Oscar var meget nærværende og gæsterne havde en fest.'),
}

# ───────────────────────── medier ─────────────────────────
def img(name, alt, sizes='(max-width:700px) 92vw, 560px', widths=(480, 960, 1600), cls='', eager=False, w=None, h=None):
    have = [x for x in widths if (ROOT / 'media/ev' / f'{name}-{x}.webp').exists()]
    if not have: have = ['full']
    srcset = ', '.join(f'/media/ev/{name}-{x}.webp {x}w' for x in have if x != 'full') or f'/media/ev/{name}-full.webp'
    src = f'/media/ev/{name}-{have[min(1, len(have)-1)]}.webp'
    dims = f' width="{w}" height="{h}"' if w else ''
    load = ' fetchpriority="high"' if eager else ' loading="lazy" decoding="async"'
    return f'<img class="{cls}" src="{src}" srcset="{srcset}" sizes="{sizes}" alt="{H.escape(alt)}"{dims}{load}>'

CLIPS = {
 'beach': ('clip-beach-duo', 'beach-v', 'Oscar spiller akustisk guitar med sangerinde på en strand'),
 'acoustic': ('clip-ad', 'acoustic', 'Oscar synger og spiller akustisk guitar'),
 'gigblue': ('clip-gig-blue', 'gig-blue', 'Oscar spiller el-guitar på scenen i blåt lys'),
 'warm': ('clip-studio-warm', 'warm', 'Oscar synger med gul akustisk guitar'),
 'studio': ('clip-studio', 'studio-v', 'Oscar spiller guitar i studiet'),
 # fra oscartjoensson.dk (8/10 2026), 16:9, uden lyd
 'fest': ('/media/ev/v/fest.mp4', '/media/ev/v/fest.webp', 'Fyldt dansegulv til en fest, Oscar spiller på scenen'),
 'champagne': ('/media/ev/v/champagne.mp4', '/media/ev/v/champagne.webp', 'Champagne klar til velkomsten'),
 'kirke': ('/media/ev/v/kirke.mp4', '/media/ev/v/kirke.webp', 'Gæster i kirken til vielsen'),
 'middag': ('/media/ev/v/middag.mp4', '/media/ev/v/middag.webp', 'Oscar spiller akustisk guitar og synger under middagen'),
 'duo': ('/media/ev/v/duo.mp4', '/media/ev/v/duo.webp', 'Oscar og en pianist på scenen i rødt og grønt lys'),
}
LAND = {'fest', 'champagne', 'kirke', 'middag', 'duo'}
def vsrc(k): f = CLIPS[k][0]; return f if f.startswith('/') else f'/media/clips/{f}.mp4'
def vposter(k): p = CLIPS[k][1]; return p if p.startswith('/') else f'/media/ev/{p}-full.webp'
YT = [('-EH6aN7DRlI', 'hvem', 'Hvem er Oscar Jønsson'),
      ('DMEh5RBKn1s', 'dj', 'DJ Medley'), ('vXLYCO1kmrM', 'allofme', 'All Of Me · John Legend'), ('0GeIAyd3rX4', 'wicked', 'Wicked Game · Chris Isaak'),
      ('jcWckbldTTo', 'acoustic', 'Acoustic Medley'), ('Dm8C8OdAfEY', 'perfect', 'Perfect · Ed Sheeran'), ('NZLpLNtWeMo', 'stupid', 'Stupid Man · Thomas Helmig')]
# Stemningsbilleder (Unsplash-licens, fri brug) — KUN i high-end-demoerne D/E, aldrig i de live annoncesider
STOCK_CRED = json.load(open(ROOT / 'media/ev/stock/credits.json'))
STOCK = {
 'bryllup': dict(hero_name='b-guitar-vielse', hero_wide='b-slor', intro='b-gang', s8='b-hander', offer='b-guitar', final='b-soe',
   flow=['b-champagne', 'b-hoejbord', 'b-dans-sh'],
   mood=[('b-par-sh', 'Vielsen'), ('b-lysekrone', 'Ceremonien'), ('b-lys', 'Middagen'), ('b-dans-vindue', 'Første dans'), ('b-glas', 'Velkomst'), ('b-par-ryg', 'Aftenen'), ('b-guitar-taet', 'Guitar og sang'), ('b-telt', 'Festsalen')]),
 'firmafest': dict(hero_name='f-band-guitar', hero_wide='f-langbord', intro='f-gaester', s8='f-glaede', offer='f-champagne-taarn', final='f-scene-sh',
   flow=['f-skaenk', 'f-lys-bord', 'f-dansegulv'],
   mood=[('f-guldbord', 'Middagen'), ('f-coupe', 'Velkomst'), ('f-telt-dans', 'Dansegulvet'), ('f-band', 'Live-sæt'), ('f-lyskaede', 'Aftenen'), ('f-glaede-sh', 'Festen'), ('f-guitar-taet', 'Guitar og sang'), ('f-tomlys', 'Midnat')]),
}
def simg(k, sizes='(max-width:820px) 92vw, 560px', eager=False, cls=''):
    c = STOCK_CRED[k]; w, h = c['w'], c['h']
    srcset = ', '.join(f'/media/ev/stock/{k}-{x}.webp {x}w' for x in (480, 960, 1600))
    load = ' fetchpriority="high"' if eager else ' loading="lazy" decoding="async"'
    return f'<img class="{cls}" src="/media/ev/stock/{k}-960.webp" srcset="{srcset}" sizes="{sizes}" alt="{H.escape(c["alt"] or "Stemningsbillede")}" width="{w}" height="{h}"{load}>'

PLAY = '<svg viewBox="0 0 68 48" aria-hidden="true"><rect width="68" height="48" rx="14" fill="rgba(0,0,0,.6)"/><path d="M27 15l18 9-18 9z" fill="#fff"/></svg>'
def yt(i, cls=''):
    vid, img_, title = YT[i]
    return (f'<button type="button" class="yt {cls}" data-yt="{vid}" aria-label="Afspil {H.escape(title)}">'
            f'<img src="/media/ev/yt/{img_}.webp" alt="" loading="lazy" decoding="async" width="960" height="540">{PLAY}</button>')
def clip(key, cap=''):
    alt = CLIPS[key][2]
    return (f'<figure class="clip"><video muted loop playsinline preload="none" poster="{vposter(key)}" '
            f'data-src="{vsrc(key)}" aria-label="{H.escape(alt)}" width="720" height="960"></video>'
            + (f'<figcaption>{cap}</figcaption>' if cap else '') + '</figure>')

# ───────────────────────── sider ─────────────────────────
P = {}
P['firmafest'] = dict(
 title='Livemusik og DJ til firmafesten · Oscar Jønsson',
 desc='Livemusik og DJ samlet i én løsning til jeres firmafest. Oscar planlægger musikken fra velkomst til sidste dans, så festudvalget kan nyde aftenen.',
 kind='firmafest', label='Firmafest',
 eyebrow='Til festudvalget',
 h1='Firmafesten, <em>ingen vil gå glip af</em>',
 sub='Fra akavet smalltalk og tomt dansegulv til “bare én sang mere”, og en aften, der samler teamet og bliver snakket om på kontoret resten af året.',
 cta='Få et tilbud på jeres firmafest',
 hero_img=('gig-wide', 'Oscar spiller på scenen til en fest i pink og blåt lys'), hero_clip='fest',
 intro=['Fra velkomstmusikken til aftenens sidste dans planlægger vi musikken omkring jeres team.',
        'Livemusik skaber en afslappet stemning under middagen. Live-sættet og DJ løfter festen, så kollegerne slipper arbejdsdagen, danser og synger med sammen.',
        'Med mere end 10 års erfaring som guitarist, sanger og DJ læser Oscar stemningen i rummet og tilpasser musikken gennem hele aftenen.',
        'I nyder festen med teamet. Vi tager os af musikken, der bringer jer tættere sammen.'],
 s2=('En samlet musikoplevelse fra velkomst til sidste dans', ['Lokalet er booket. Maden er på plads. Invitationerne er sendt.', 'Nu mangler musikken, der får aftenen til at føles som en fest.'],
     ['Med Oscar får I livemusik og DJ samlet i én løsning, hvor musikken følger aftenen og menneskene i rummet.', 'Så I kan være med til festen uden selv at skulle vælge næste sang eller holde øje med dansegulvet.']),
 s3=('I kan godt arrangere en fest. <em>Men stemningen kan ikke skrives ind i programmet.</em>', ['I har styr på datoen, gæstelisten og middagen.', 'Men ét spørgsmål bliver ved med at dukke op:'],
     '“Hvordan får vi alle med, også dem, der normalt går tidligt?”',
     ['En flot ramme gør det nemt at møde op.', 'Musikken giver folk en grund til at blive.'], 'Fra de første samtaler til de sange, kollegerne synger med på, skal stemningen have plads til at udvikle sig.'),
 s4=('En playliste kan vælge sange. <em>Den kan ikke mærke rummet.</em>', 'Måske kender I det fra tidligere firmafester:',
     ['En playliste, som nogen hele tiden skulle ændre.', 'Musik, der gjorde det svært at tale sammen under middagen.', 'Et dansegulv, hvor de samme få kolleger stod hele aftenen.', 'Folk, der tog hjem, lige da festen skulle til at begynde.'],
     ['Der kan være gode sange og stadig mangle en god fest.', 'Det handler også om, hvornår sangene bliver spillet, hvordan energien bygges op, og hvem der står i rummet.']),
 s5=('Ingen fra festudvalget skal stå med ansvaret for næste sang', ['I skal kunne sætte jer til bords og nyde det, I har arrangeret.', 'Uden hele tiden at tænke:'],
     ['“Er musikken for høj?”', '“Hvornår skal vi sætte gang i festen?”', '“Hvordan får vi flere ud på dansegulvet?”'],
     ['Oscar følger stemningen og tilpasser musikken undervejs.', 'Så I kan være kolleger til festen og være med, når jeres yndlingssang kommer.']),
 s6=('Vælg musikken efter den aften, I vil skabe', ['En sangliste fortæller, hvilke numre der kan blive spillet.', 'Den fortæller ikke, hvordan det føles, når kollegerne rejser sig fra bordene og synger med sammen.', 'Derfor begynder vi med jeres team og den fest, I ønsker.'],
     'Vil I have en afslappet middag, en stor dansefest eller en aften, der bevæger sig fra det ene til det andet?', 'Musikken skal passe til jer og give mennesker på tværs af afdelinger noget at mødes om.'),
 s7=('Velkomst, middag og dansegulv skal hænge sammen', [('Velkomst', 'Under velkomsten skal det være nemt at falde i snak.', 'v:champagne'), ('Middag', 'Under middagen skal musikken give varme til rummet og plads til samtaler.', 'v:middag'), ('Dansegulv', 'Senere skal energien løftes, så folk får lyst til at rejse sig.', 'v:fest')],
     'Vi planlægger overgangen mellem aftenens dele, så musikken følger festen fra begyndelse til afslutning.'),
 s8=('I har lagt for meget i aftenen til, at den bare skal overstås', ['Der ligger tid, penge og arbejde bag en firmafest.', 'Hvis kollegerne bliver siddende i deres sædvanlige grupper og går efter middagen, mister I muligheden for at samle teamet på en anden måde end i hverdagen.', 'Når folk danser, griner og synger sammen, får de noget fælles at tage med tilbage på kontoret.'], 'Det er den aften, vi planlægger musikken til.'),
 s9=('Sådan skaber vi jeres firmafest', 'Oscars Firmafestoplevelse består af fem dele:', [
     ('En musikplan omkring jeres team', 'Vi taler om gæsterne, programmet og den stemning, I ønsker. Så musikken passer til både menneskerne og aftenen.'),
     ('En velkomst, der får skuldrene ned', 'Vi aftaler musikken til ankomsten, så kollegerne kan lande i festen og begynde at tale sammen.'),
     ('Livemusik, der giver middagen stemning', 'Guitar og sang skaber en varm ramme omkring middagen med plads til samtaler og indslag.'),
     ('Et live-sæt, der samler festen', 'Når det er tid til at løfte energien, bringer Oscar velkendte sange og nærvær ind i rummet.'),
     ('DJ, der følger dansegulvet', 'Festen fortsætter med musik, der tilpasses kollegernes reaktioner og energien gennem aftenen.')],
     'Det konkrete program og spilletiderne aftaler vi sammen.'),
 s10=('I samler teamet. <em>Vi tager os af musikken.</em>', 'Med Oscar får I:', ['En musikplan tilpasset jeres firmafest.', 'Guitar, sang og DJ samlet i én løsning.', 'Musik, der følger aftenens forskellige stemninger.', 'En erfaren musiker, der læser rummet.', 'Frihed til selv at være med til festen.'],
     'I nyder aftenen med kollegerne. Oscar står for musikken fra velkomst til sidste dans.'),
 s11=('Fra “skal du med?” til <em>“du skulle have været der”</em>', ['Forestil jer en middag, hvor samtalerne flyder.', 'Den første sang, der får et bord til at synge med.', 'Kolleger fra forskellige afdelinger, der mødes på dansegulvet.', 'Og mandag morgen, hvor festen stadig er en del af samtalen.'],
     'I har samlet menneskene. Nu skaber vi musikken, der bringer dem tættere sammen.', 'Fortæl om jeres firmafest og få et tilbud', 'Send dato, sted og cirka antal gæster. Så tager vi en snak om musikken til jeres aften.'),
 reviews=['jakob', 'benjamin', 'sonderup', 'md', 'heidi', 'porskrog', 'solv', 'vigso'],
 strip=['benjamin', 'jakob', 'sonderup', 'md', 'heidi', 'porskrog'],
 gallery=[('duo', 'Live-sæt'), ('gigblue', 'På scenen'), ('acoustic', 'Velkomst'), ('warm', 'Middag'), ('studio', 'Guitar og sang')],
 form=dict(
   title='Fortæl om jeres firmafest',
   steps=[
     dict(id='dato', type='date', q='Hvornår er festen?', help='Vælg datoen, eller sig til hvis den ikke ligger fast endnu.', alt='Datoen ligger ikke fast endnu'),
     dict(id='sted', type='text', q='Hvor skal festen holdes?', help='By, lokale eller adresse.', ph='Fx Comwell Kolding eller vores kantine i Aarhus', ac='off'),
     dict(id='gaester', type='choice', q='Cirka hvor mange gæster?', opts=['Under 50', '50 til 100', '100 til 200', 'Over 200']),
     dict(id='musik', type='multi', q='Hvilken musik drømmer I om?', help='Vælg gerne flere.', opts=['Musik til velkomsten', 'Livemusik under middagen', 'Live-sæt der løfter festen', 'DJ til dansegulvet', 'Vi vil gerne have et råd']),
     dict(id='kontakt', type='contact', q='Hvem skal vi sende tilbuddet til?', help='Vi bruger kun oplysningerne til at give jer et tilbud.', company=True),
   ]),
)
P['bryllup'] = dict(
 title='Livemusik og DJ til jeres bryllup · Oscar Jønsson',
 desc='Guitar, sang og DJ samlet i én løsning til jeres bryllup. Oscar planlægger musikken fra velkomst til sidste dans, så I kan være til stede i dagen.',
 kind='bryllup', label='Bryllup',
 eyebrow='Til brudeparret',
 h1='Det uforglemmelige <em>bryllup</em>',
 sub='Fra akavet stemning og tomt dansegulv til en fest, der bliver en del af familiens historie.',
 cta='Få et tilbud på musikken til jeres bryllup',
 hero_img=('beach-duo', 'Oscar spiller guitar ved siden af en sangerinde i hvid kjole på en strand'), hero_clip='beach',
 intro=['Fra velkomstmusikken til aftenens sidste dans planlægger vi musikken omkring jer og jeres gæster.',
        'Livemusik skaber en varm stemning under middagen. Live-sættet og DJ løfter festen, så venner og familie mødes på dansegulvet, synger med og deler en aften, de husker.',
        'Med mere end 10 års erfaring som guitarist, sanger og DJ læser Oscar stemningen i rummet og tilpasser musikken gennem hele aftenen.',
        'I nyder jeres bryllup. Vi tager os af musikken, der samler dem, I elsker.'],
 s2=('Jeres musik. Jeres mennesker. <em>Én samlet oplevelse.</em>', ['I har valgt stedet, maden og dem, I vil dele dagen med.', 'Nu mangler musikken, der binder oplevelsen sammen.'],
     ['Med Oscar får I livemusik og DJ samlet i én løsning, tilpasset jeres ønsker og aftenens forløb.', 'Så I kan være til stede i øjeblikkene uden selv at skulle styre musikken.']),
 s3=('I har planlagt dagen. <em>Nu skal der være plads til at nyde den.</em>', ['I kan vælge bordplanen, blomsterne og menuen.', 'Men stemningen opstår mellem mennesker.', 'Og måske tænker I:'],
     '“Hvordan får vi både vores venner, forældre og bedsteforældre med til festen?”',
     ['Musikken skal give plads til de rolige øjeblikke og samle gæsterne, når festen tager fart.'], 'Det kræver et blik for både jer, gæsterne og det, der sker i rummet.'),
 s4=('En liste med yndlingssange <em>er en begyndelse</em>', 'Måske har I allerede:',
     ['Lavet en fælles playliste.', 'Spurgt vennerne, hvilke sange de vil høre.', 'Overvejet en sanger til middagen og en DJ til festen.'],
     ['Men hvem sørger for overgangen?', 'Hvornår skal musikken være i baggrunden, og hvornår skal den samle alle?', 'Oscar hjælper jer med at gøre sangønskerne til en plan for hele aftenen.']),
 s5=('I skal ikke holde øje med dansegulvet på jeres bryllupsdag', ['I skal have plads til at høre talerne, kramme jeres gæster og danse sammen.', 'Uden at tænke:'],
     ['“Hvem starter musikken nu?”', '“Passer den næste sang til gæsterne?”', '“Skal vi gøre noget for at få gang i festen?”'],
     ['Vi aftaler retningen på forhånd.', 'På aftenen følger Oscar stemningen, så I kan blive i øjeblikket.']),
 s6=('Musikken bliver en del af det, I husker', ['Når I tænker tilbage på brylluppet, er det måske en bestemt sang, der kommer først.', 'Den, I sang med på sammen med jeres venner.', 'Den, der fik jeres forældre ud på dansegulvet.', 'Den sidste sang, hvor ingen helt havde lyst til at sige farvel.', 'Derfor handler valget af musik også om:'],
     '“Hvem skal skabe de øjeblikke, vi gerne vil huske?”', 'Vi planlægger musikken omkring den oplevelse, I ønsker at dele med jeres gæster.'),
 s7=('Musikken skal følge dagen, som den udvikler sig', [('Velkomst', 'Ved velkomsten skal gæsterne kunne mødes og falde til.', 'v:champagne'), ('Middag', 'Under middagen skal der være varme i rummet og plads til ord, grin og taler.', 'v:middag'), ('Fest', 'Senere skal musikken samle generationerne og give festen energi.', 'v:fest')],
     'Vi aftaler forløbet med jer og tilpasser det på aftenen, når programmet og stemningen udvikler sig.'),
 s8=('Jeres gæster er samlet for én særlig aften', ['Mennesker fra forskellige dele af jeres liv mødes.', 'Nogle kender hinanden godt. Andre mødes for første gang.', 'Musikken kan give dem en fælles indgang til festen: en sang, de kender, et omkvæd, de synger sammen, eller en anledning til at danse.'], 'Så gæsterne tager hjem med minder om det, de delte med jer og hinanden.'),
 s9=('Sådan skaber vi jeres bryllupsfest', 'Oscars Bryllupsoplevelse består af fem dele:', [
     ('En musikplan, der begynder med jer', 'Vi taler om jeres musiksmag, gæster, særlige sangønsker og program. Så aftenen får en retning, der føles som jer.'),
     ('En varm velkomst', 'Vi aftaler musikken til gæsternes ankomst, så der er en indbydende stemning fra begyndelsen.'),
     ('Livemusik omkring middagen', 'Guitar og sang giver middagen nærvær med plads til samtaler, taler og de øjeblikke, der opstår undervejs.'),
     ('Et live-sæt, der samler gæsterne', 'Oscar løfter energien med sange, gæsterne kan mærke, synge med på og danse til.'),
     ('DJ frem til aftenens sidste dans', 'Musikken fortsætter med en blanding af jeres ønsker og sange, der passer til energien på dansegulvet.')],
     'Det konkrete program, særlige sange og spilletiderne aftaler vi sammen.'),
 s10=('I er til stede. <em>Vi tager os af musikken.</em>', 'Med Oscar får I:', ['En musikplan tilpasset jer og jeres gæster.', 'Guitar, sang og DJ samlet i én løsning.', 'En sammenhængende oplevelse fra velkomst til dansefest.', 'En erfaren musiker, der tilpasser sig stemningen.', 'Plads til at nyde dagen sammen med dem, I elsker.'],
     'I skal giftes, fejres og danse. Oscar står for musikken omkring det hele.'),
 s11=('Fra en planlagt dag til <em>minder, I deler resten af livet</em>', ['Forestil jer, at middagen glider over i fest.', 'Jeres venner synger med.', 'Jeres familie mødes på dansegulvet.', 'Og I står midt i det hele med dem, I elsker, omkring jer.', 'Senere kommer en af sangene i radioen.', 'Og I kigger på hinanden, fordi I begge husker præcis det samme øjeblik.'],
     'I samler dem, I elsker. Vi skaber musikken til den aften, I vil huske sammen.', 'Fortæl om jeres bryllup og få et tilbud', 'Send dato, sted og cirka antal gæster. Så tager vi en snak om jeres ønsker til musikken.'),
 reviews=['vigso', 'kasper', 'porskrog', 'norup', 'heidi', 'emma', 'laura', 'andreas', 'solv'],
 strip=['vigso', 'norup', 'porskrog', 'kasper', 'emma', 'laura', 'heidi'],
 gallery=[('kirke', 'Vielsen'), ('beach', 'Guitar og sang'), ('acoustic', 'Reception'), ('warm', 'Middag'), ('gigblue', 'Dansefest')],
 form=dict(
   title='Fortæl om jeres bryllup',
   steps=[
     dict(id='dato', type='date', q='Hvornår skal I giftes?', help='Vælg datoen, eller sig til hvis den ikke ligger fast endnu.', alt='Datoen ligger ikke fast endnu'),
     dict(id='sted', type='text', q='Hvor skal festen holdes?', help='By, festsal eller adresse.', ph='Fx Hindsgavl Slot eller en lade på Fyn', ac='off'),
     dict(id='gaester', type='choice', q='Cirka hvor mange gæster?', opts=['Under 60', '60 til 100', '100 til 150', 'Over 150']),
     dict(id='musik', type='multi', q='Hvor på dagen skal der være musik?', help='Vælg gerne flere.', opts=['Vielsen', 'Reception og velkomst', 'Middagen', 'Live-sæt til festen', 'DJ til sidste dans']),
     dict(id='kontakt', type='contact', q='Hvem skal vi sende tilbuddet til?', help='Vi bruger kun oplysningerne til at give jer et tilbud.', company=False),
   ]),
)

STORY = dict(
 eyebrow='Mød Oscar',
 h='Jeg er nærmest vokset op med musik.',
 p=['Min far er professionel musiker, og derfor fik jeg selv muligheden for at komme ud og spille foran mennesker i en tidlig alder.',
    'Siden da har musikken været en kæmpe del af mit liv, og jeg har brugt mange år på at blive bedre til mit håndværk og skabe gode oplevelser for de mennesker, jeg spiller for.'],
 sign='Oscar Jønsson',
)

# ───────────────────────── designretninger ─────────────────────────
# ───────────────────────── farvetemaer (kun farver) ─────────────────────────
PAL = {
 'messing':  ('Messing', 'dark', '--bg:#14110E;--bg2:#1B1713;--card:#221D18;--ink:#F4EEE5;--ink2:#C9BFB2;--mute:#9C9184;--line:rgba(244,238,229,.12);--accent:#C9A46A;--accentT:#D8B67E;--onaccent:#17120C'),
 'kul':      ('Kul & sølv', 'dark', '--bg:#121417;--bg2:#181B1F;--card:#1F2328;--ink:#EEF0F2;--ink2:#C3C8CF;--mute:#959CA6;--line:rgba(238,240,242,.12);--accent:#C9CED6;--accentT:#D5DAE1;--onaccent:#121417'),
 'bordeaux': ('Bordeaux', 'dark', '--bg:#170D10;--bg2:#1F1216;--card:#28171C;--ink:#F5ECE8;--ink2:#D2C1BC;--mute:#A8948F;--line:rgba(245,236,232,.12);--accent:#D9A88A;--accentT:#E2B69B;--onaccent:#1E1014'),
 'skov':     ('Skovgrøn & messing', 'dark', '--bg:#0F1512;--bg2:#141C18;--card:#1A241F;--ink:#EEF1EA;--ink2:#C3CBBF;--mute:#95A091;--line:rgba(238,241,234,.12);--accent:#C8A962;--accentT:#D5B877;--onaccent:#121810'),
 'natrose':  ('Natrosé', 'dark', '--bg:#0D0F13;--bg2:#13161C;--card:#191D24;--ink:#EEF0F3;--ink2:#BAC0CA;--mute:#8D94A0;--line:rgba(238,240,243,.12);--accent:#E2BFA6;--accentT:#E8C8B1;--onaccent:#1A120D'),
 'champagne':('Champagne', 'light', '--bg:#F6F1E8;--bg2:#EFE7DA;--card:#FFFDF9;--ink:#1F1A15;--ink2:#4E463D;--mute:#6E655A;--line:rgba(31,26,21,.12);--accent:#7E5F35;--accentT:#7A5A2F;--onaccent:#FFFBF4'),
 'hvid':     ('Hvid', 'light', '--bg:#FFFFFF;--bg2:#F6F5F2;--card:#FFFFFF;--ink:#111111;--ink2:#444444;--mute:#6B6B6B;--line:rgba(17,17,17,.13);--accent:#111111;--accentT:#111111;--onaccent:#FFFFFF'),
 'mono':     ('Monokrom', 'light', '--bg:#FAFAF8;--bg2:#F1F1EE;--card:#FFFFFF;--ink:#0E0E0E;--ink2:#3F3F3F;--mute:#696969;--line:rgba(14,14,14,.13);--accent:#0E0E0E;--accentT:#0E0E0E;--onaccent:#FFFFFF;--imgfilter:grayscale(1) contrast(1.04)'),
 'salvie':   ('Elfenben & salvie', 'light', '--bg:#FAF8F3;--bg2:#F0EEE6;--card:#FFFFFF;--ink:#1D211C;--ink2:#4A5047;--mute:#6A7066;--line:rgba(29,33,28,.12);--accent:#55644E;--accentT:#4A5844;--onaccent:#FFFFFF'),
 'sten':     ('Sten & blågrå', 'light', '--bg:#F3F4F6;--bg2:#E8EBEF;--card:#FFFFFF;--ink:#1A1D22;--ink2:#474D57;--mute:#646A74;--line:rgba(26,29,34,.12);--accent:#2B3542;--accentT:#2B3542;--onaccent:#FFFFFF'),
}

# ───────────────────────── designretninger (layout + typografi) ─────────────────────────
D = {
 'a': dict(name='Aftenlys', kind='Performance', note='Mørk og varm. Split-hero med video, kort, tal og CTA overalt. Cormorant + Manrope.',
   fonts='family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700',
   vars='--display:"Cormorant Garamond",Georgia,serif;--body:Manrope,system-ui,sans-serif;--hw:600;--hls:-.01em;--r:18px',
   hero='split', pals=['messing', 'kul', 'bordeaux', 'skov']),
 'b': dict(name='Champagne', kind='Performance', note='Lyst bryllupsmagasin med polaroid-vifte i hero. Instrument Serif + DM Sans.',
   fonts='family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700',
   vars='--display:"Instrument Serif",Georgia,serif;--body:"DM Sans",system-ui,sans-serif;--hw:400;--hls:-.015em;--r:6px',
   hero='fan', pals=['champagne', 'salvie', 'sten', 'hvid']),
 'c': dict(name='Natscene', kind='Performance', note='Filmisk med fuldskærms-video bag overskriften. Bricolage Grotesque + Inter.',
   fonts='family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Inter:wght@400;500;600',
   vars='--display:"Bricolage Grotesque",system-ui,sans-serif;--body:Inter,system-ui,sans-serif;--hw:700;--hls:-.035em;--r:22px',
   hero='full', pals=['natrose', 'kul', 'bordeaux', 'skov']),
 'd': dict(name='Redaktion', kind='High-end', note='Som Greg Finck: navnet i kæmpe serif delt om ét billede, hvidt, skarpe kanter, tynde linjer. Bodoni Moda + Jost. Demo med stemningsbilleder fra Unsplash.',
   fonts='family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..600;1,6..96,400..600&family=Jost:wght@400;500',
   vars='--display:"Bodoni Moda",Didot,Georgia,serif;--body:Jost,system-ui,sans-serif;--hw:400;--hls:-.02em;--r:0px',
   hero='name', ed=True, pals=['hvid', 'mono', 'champagne', 'sten']),
 'e': dict(name='Atelier', kind='High-end', note='Som Elizabeth Messina og Tec Petaja: centreret, luftigt, bredt billede med hvid kant og kursiv serif. Cormorant + Jost. Demo med stemningsbilleder fra Unsplash.',
   fonts='family=Cormorant:ital,wght@0,400;0,500;1,400;1,500&family=Jost:wght@400;500',
   vars='--display:Cormorant,Georgia,serif;--body:Jost,system-ui,sans-serif;--hw:400;--hls:-.01em;--r:0px',
   hero='atelier', ed=True, pals=['salvie', 'hvid', 'champagne', 'sten']),
}

# kontrast-tjek (WCAG): brødtekst/accent-tekst/knap-tekst skal klare 4,5:1 i alle temaer
def _lum(h):
    h = h.lstrip('#'); r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)
def _cr(a, b):
    la, lb = sorted((_lum(a), _lum(b)), reverse=True); return (la + .05) / (lb + .05)
for _k, (_n, _m, _v) in PAL.items():
    _c = dict(x.split(':', 1) for x in _v.split(';'))
    for fg, bg in (('--ink', '--bg'), ('--ink2', '--bg'), ('--mute', '--bg'), ('--accentT', '--bg'), ('--accentT', '--bg2'), ('--onaccent', '--accent'), ('--ink', '--card')):
        r = _cr(_c[fg], _c[bg]); assert r >= 4.5, f'kontrast {_k}: {fg} på {bg} = {r:.2f}'

CSS = r'''
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:clip}
img,video{display:block;max-width:100%;height:auto}
a{color:inherit}
h1,h2,h3{font-family:var(--display);font-weight:var(--hw);letter-spacing:var(--hls);line-height:1.06;margin:0;text-wrap:balance}
h1 em,h2 em{font-style:italic;color:var(--accentT)}
p{margin:0;text-wrap:pretty}
.wrap{width:min(1160px,100% - 32px);margin-inline:auto}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:.8rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--accentT)}
.eyebrow::before{content:"";width:26px;height:1px;background:currentColor}
.lead{font-size:clamp(1.06rem,1.6vw,1.22rem);color:var(--ink2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:14px 26px;border-radius:999px;background:var(--accent);color:var(--onaccent);font:600 1rem/1.2 var(--body);text-decoration:none;border:0;cursor:pointer;transition:transform .2s,box-shadow .2s;text-align:center}
.btn:hover{transform:translateY(-1px);box-shadow:0 12px 30px -12px var(--accent)}
.btn svg{width:18px;height:18px;flex:none}
.btn:disabled{opacity:.45;cursor:default;transform:none;box-shadow:none}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.btn.sm{min-height:44px;padding:10px 18px;font-size:.92rem}
.cta-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.rating{display:inline-flex;align-items:center;gap:10px;font-size:.92rem;color:var(--ink2);text-decoration:none}
.stars{letter-spacing:2px;font-size:1rem;background:linear-gradient(90deg,#E8B04A 90%,rgba(232,176,74,.3) 90%);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-fan .rating,.hero-name .rating,.hero-atelier .rating{justify-content:center;text-align:left;flex-wrap:wrap}
@media (max-width:560px){.hero-fan .rating span,.hero-name .rating span,.hero-atelier .rating span{text-align:center}}
/* nav */
.nav{position:fixed;inset:0 0 auto;z-index:40;transition:background .3s,border-color .3s;border-bottom:1px solid transparent}
.nav.scrolled{background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-color:var(--line)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:68px;gap:12px}
.logo{font-family:var(--display);font-size:1.3rem;font-weight:var(--hw);text-decoration:none;letter-spacing:var(--hls);white-space:nowrap}
.logo small{font-family:var(--body);font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--mute);margin-left:8px;font-weight:600}
@media (max-width:420px){.logo small{display:none}.nav .btn{padding:10px 14px;font-size:.88rem}}
/* hero */
.hero{position:relative;padding:calc(68px + clamp(28px,6vw,72px)) 0 clamp(40px,6vw,80px);overflow:hidden}
.hero h1{font-size:clamp(2.6rem,7vw,5.2rem)}
.hero .copy{display:flex;flex-direction:column;gap:22px;max-width:640px}
.hero .sub{font-size:clamp(1.08rem,1.8vw,1.3rem);color:var(--ink2)}
.hero-split .wrap{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(28px,5vw,64px);align-items:center}
.hero-split .media{position:relative;aspect-ratio:3/4;border-radius:var(--r);overflow:hidden;box-shadow:0 40px 90px -40px rgba(0,0,0,.8)}
.hero-split .media video,.hero-split .media img{width:100%;height:100%;object-fit:cover}
.hero-fan{text-align:center}
.hero-fan .copy{margin-inline:auto;align-items:center}
.hero-fan .cta-row{justify-content:center}
.fan{position:relative;height:clamp(260px,40vw,420px);margin-top:clamp(36px,5vw,56px);display:flex;justify-content:center}
.fan figure{position:absolute;margin:0;width:clamp(170px,24vw,280px);background:#fff;padding:10px 10px 38px;box-shadow:0 30px 60px -28px rgba(40,25,10,.45);border-radius:3px;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.fan figure img,.fan figure video{aspect-ratio:3/4;object-fit:cover;width:100%;height:auto}
.fan figure:nth-child(1){transform:translateX(-62%) rotate(-8deg)}
.fan figure:nth-child(2){transform:translateY(-4%) rotate(1deg);z-index:2}
.fan figure:nth-child(3){transform:translateX(62%) rotate(7deg)}
.fan figcaption{position:absolute;bottom:9px;left:0;right:0;text-align:center;font-family:var(--display);font-style:italic;color:#3b3026;font-size:1rem}
.hero-full{min-height:min(100svh,920px);display:flex;align-items:flex-end;padding-bottom:clamp(36px,6vw,72px)}
.hero-full .bgv{position:absolute;inset:0;z-index:0}
.hero-full .bgv img,.hero-full .bgv video{width:100%;height:100%;object-fit:cover}
.hero-full .bgv::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,15,19,.55) 0%,rgba(13,15,19,.25) 35%,rgba(13,15,19,.92) 85%,var(--bg) 100%)}
.hero-full .wrap{position:relative;z-index:1}
/* review strip */
.strip{border-block:1px solid var(--line);background:var(--bg2);overflow:hidden;padding:18px 0}
.strip-track{display:flex;gap:44px;width:max-content;animation:marq 60s linear infinite}
.strip:hover .strip-track{animation-play-state:paused}
.strip-item{display:flex;gap:12px;align-items:baseline;white-space:nowrap;font-size:1rem}
.strip-item q{font-family:var(--display);font-style:italic;font-size:1.12rem;quotes:"“" "”"}
.strip-item span{color:var(--mute);font-size:.9rem}
@keyframes marq{to{transform:translateX(-50%)}}
/* sections */
.sec{padding:clamp(64px,9vw,120px) 0;position:relative}
.sec.alt{background:var(--bg2)}
.sec h2{font-size:clamp(2rem,4.6vw,3.4rem);margin-bottom:22px}
.stack{display:flex;flex-direction:column;gap:16px}
.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,72px);align-items:center}
.narrow{max-width:760px}
.center{text-align:center;margin-inline:auto}
.center .cta-row{justify-content:center}
.big{font-family:var(--display);font-size:clamp(1.5rem,2.8vw,2.1rem);line-height:1.25;letter-spacing:var(--hls)}
.quote{font-family:var(--display);font-style:italic;font-size:clamp(1.6rem,3.4vw,2.6rem);line-height:1.2;color:var(--accentT);padding:clamp(20px,3vw,32px) 0;border-block:1px solid var(--line);margin:8px 0;text-wrap:balance}
.intro-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:8px}
.ic{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px;font-size:1rem;color:var(--ink2)}
.ic b{display:block;font-family:var(--display);font-size:1.5rem;color:var(--accentT);font-weight:var(--hw);margin-bottom:6px;line-height:1}
.photo{border-radius:var(--r);overflow:hidden;aspect-ratio:4/3;background:var(--card)}
.photo img,.photo video{width:100%;height:100%;object-fit:cover}
.pcards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:10px 0 6px}
.pc{display:flex;gap:14px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;font-size:1rem}
.pc i{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,#d65f5f 18%,transparent);color:#E58A8A;font-style:normal;font-weight:700;font-size:.9rem}
.bubbles{display:flex;flex-direction:column;gap:10px;margin:6px 0}
.bubble{align-self:flex-start;background:var(--card);border:1px solid var(--line);border-radius:20px 20px 20px 6px;padding:12px 18px;font-family:var(--display);font-style:italic;font-size:1.25rem}
.bubble:nth-child(2){align-self:center}.bubble:nth-child(3){align-self:flex-end;border-radius:20px 20px 6px 20px}
.flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:22px 0}
.fl{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.fl .photo{border-radius:0;aspect-ratio:4/3}
.fl>div:last-child{padding:18px 20px}
.fl b{display:flex;align-items:center;gap:10px;font-family:var(--display);font-size:1.5rem;font-weight:var(--hw);margin-bottom:6px}
.fl b span{font-family:var(--body);font-size:.8rem;color:var(--accentT);letter-spacing:.14em}
.fl p{font-size:1rem;color:var(--ink2)}
.parts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:24px 0 18px;counter-reset:p}
.part{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px 20px;display:flex;flex-direction:column;gap:10px}
.part .n{font-family:var(--display);font-size:2.4rem;line-height:1;color:var(--accentT)}
.part b{font-size:1.06rem;line-height:1.3}
.part p{font-size:.96rem;color:var(--ink2)}
.check{list-style:none;padding:0;margin:8px 0;display:grid;gap:10px}
.check li{display:flex;gap:12px;align-items:flex-start;font-size:1.06rem}
.check li::before{content:"✓";flex:none;width:24px;height:24px;margin-top:2px;border-radius:50%;background:var(--accent);color:var(--onaccent);display:grid;place-items:center;font-size:13px;font-weight:700;line-height:1}
.offer{background:var(--card);border:1px solid var(--line);border-radius:calc(var(--r) + 6px);padding:clamp(24px,4vw,44px);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:clamp(24px,4vw,48px);align-items:center}
.offer .photo{aspect-ratio:1}
/* gallery */
.gal{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,1fr);gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;margin-top:28px;scrollbar-width:none}
.gal::-webkit-scrollbar{display:none}
.clip{margin:0;position:relative;border-radius:var(--r);overflow:hidden;scroll-snap-align:start;background:var(--card);aspect-ratio:3/4}
.clip video{width:100%;height:100%;object-fit:cover}
.clip figcaption{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);color:#fff;font-size:.88rem;font-weight:600;padding:6px 12px;border-radius:999px}
/* story */
.story{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,72px);align-items:center}
.story .photo{aspect-ratio:4/5}
.story .sign{font-family:var(--display);font-style:italic;font-size:1.6rem;color:var(--accentT)}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:10px}
.facts div{border-top:1px solid var(--line);padding-top:14px;font-size:.95rem;color:var(--ink2)}
.facts b{display:block;font-family:var(--display);font-size:clamp(1.6rem,3vw,2.2rem);color:var(--ink);font-weight:var(--hw);line-height:1.05;margin-bottom:4px}
/* reviews */
.revs{columns:3 300px;column-gap:16px;margin-top:30px}
.rev{break-inside:avoid;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px;margin:0 0 16px;display:flex;flex-direction:column;gap:12px}
.rev b{font-size:1.04rem;line-height:1.35}
.rev p{font-size:.98rem;color:var(--ink2)}
.rev .who{display:flex;justify-content:space-between;gap:10px;font-size:.88rem;color:var(--mute);border-top:1px solid var(--line);padding-top:12px}
.rev .who strong{color:var(--ink);font-weight:600}
.rev.clamp p{display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.rev button{align-self:flex-start;background:none;border:0;color:var(--accentT);font:600 .92rem var(--body);padding:4px 0;cursor:pointer;min-height:32px}
.tp{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.tp .score{font-family:var(--display);font-size:3rem;line-height:1}
/* final */
.final{position:relative;overflow:hidden;text-align:center}
.final .bg{position:absolute;inset:0;opacity:.22}
.final .bg img{width:100%;height:100%;object-fit:cover}
.final .bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,var(--bg),transparent 30%,transparent 70%,var(--bg))}
.final .wrap{position:relative}
.lines{display:flex;flex-direction:column;gap:6px;font-family:var(--display);font-size:clamp(1.25rem,2.4vw,1.7rem);line-height:1.35;margin:10px 0 22px}
footer{border-top:1px solid var(--line);padding:28px 0 calc(28px + env(safe-area-inset-bottom));font-size:.9rem;color:var(--mute)}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
/* sticky mobile CTA */
.sticky{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:35;transform:translateY(140%);transition:transform .35s}
.sticky.on{transform:none}
.sticky .btn{width:100%;box-shadow:0 18px 40px -14px rgba(0,0,0,.7)}
@media (min-width:821px){.sticky{display:none}}
/* reveal */
.rv{opacity:0;transform:translateY(18px);transition:opacity .8s,transform .8s cubic-bezier(.2,.7,.2,1)}
.rv.in{opacity:1;transform:none}
html:not(.js) .rv{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.rv{opacity:1;transform:none;transition:none}.strip-track{animation:none}.btn{transition:none}}
/* responsive */
@media (max-width:980px){.parts{grid-template-columns:repeat(2,minmax(0,1fr))}.parts .part:last-child{grid-column:1/-1}.intro-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:820px){
 .hero-split .wrap,.two,.story,.offer{grid-template-columns:minmax(0,1fr)}
 .hero-split .media{aspect-ratio:4/5;max-height:62svh;width:100%}
 .flow{grid-template-columns:minmax(0,1fr)}.fl{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)}.fl .photo{aspect-ratio:auto;height:100%}
 .pcards{grid-template-columns:minmax(0,1fr)}
 .story .photo{max-width:420px}
 .gal{grid-auto-columns:64vw;margin-inline:-16px;padding-inline:16px;scroll-padding-inline:16px}
 .revs{columns:auto;display:grid;grid-auto-flow:column;grid-auto-columns:86%;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;scrollbar-width:none}
 .revs::-webkit-scrollbar{display:none}
 .rev{scroll-snap-align:start;margin:0}
}
@media (max-width:560px){
 body{font-size:16px}
 .hero h1{font-size:clamp(2.3rem,11vw,3rem)}
 .hero .cta-row .btn{width:100%}
 .intro-grid{grid-template-columns:minmax(0,1fr)}
 .parts{grid-template-columns:minmax(0,1fr)}
 .facts{grid-template-columns:minmax(0,1fr)}
 .fl{grid-template-columns:minmax(0,1fr)}.fl .photo{aspect-ratio:16/10}
 .fan figure{width:44vw}
 .fan figure:nth-child(1){transform:translateX(-50%) rotate(-8deg)}
 .fan figure:nth-child(3){transform:translateX(50%) rotate(7deg)}
 .bubble{font-size:1.1rem}
 .cta-row.full .btn{width:100%}
}
/* ───── form-modal (typeform) ───── */
.fm{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(6,5,4,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transition:opacity .25s}
.fm[hidden]{display:none}
.fm.open{opacity:1}
.fm-card{position:relative;width:min(680px,100% - 32px);height:min(720px,100dvh - 48px);background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:calc(var(--r) + 6px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 50px 120px -40px rgba(0,0,0,.8)}
@media (max-width:640px){.fm-card{width:100%;height:100dvh;border-radius:0;border:0}}
.fm-top{display:flex;align-items:center;gap:14px;padding:16px 18px;border-bottom:1px solid var(--line)}
.fm-top b{font-family:var(--display);font-size:1.15rem;font-weight:var(--hw);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fm-x{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);display:grid;place-items:center;cursor:pointer;flex:none}
.fm-x svg{width:18px;height:18px}
.fm-prog{height:3px;background:var(--line)}
.fm-prog i{display:block;height:100%;width:0;background:var(--accent);transition:width .4s}
.fm-body{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:clamp(24px,5vw,48px) clamp(20px,5vw,48px)}
.fq{display:flex;flex-direction:column;gap:18px;animation:fqin .45s cubic-bezier(.2,.7,.2,1)}
@keyframes fqin{from{opacity:0;transform:translateY(16px)}}
.fq .k{font-size:.85rem;font-weight:600;color:var(--accentT);letter-spacing:.06em}
.fq h3{font-size:clamp(1.7rem,4.6vw,2.4rem)}
.fq .h{color:var(--ink2);font-size:1rem;margin-top:-6px}
.fin{width:100%;font:500 1.15rem/1.3 var(--body);color:var(--ink);background:transparent;border:0;border-bottom:2px solid var(--line);padding:12px 2px;border-radius:0;outline:none;transition:border-color .2s;-webkit-appearance:none;appearance:none;min-height:52px}
.fin:focus{border-color:var(--accent)}
.fin::placeholder{color:var(--mute);opacity:1}
input[type=date].fin{color-scheme:var(--scheme)}
.flab{font-size:.9rem;font-weight:600;color:var(--ink2);display:block;margin-bottom:-8px}
.fgrid{display:grid;gap:22px}
.opts{display:grid;gap:10px}
.opt{display:flex;align-items:center;gap:14px;width:100%;min-height:54px;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:500 1.05rem var(--body);text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
.opt kbd{flex:none;width:28px;height:28px;border-radius:7px;border:1px solid var(--line);display:grid;place-items:center;font:600 .82rem var(--body);color:var(--ink2)}
.opt[aria-pressed=true]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--card))}
.opt[aria-pressed=true] kbd{background:var(--accent);color:var(--onaccent);border-color:var(--accent)}
.falt{background:none;border:0;color:var(--accentT);font:600 1rem var(--body);padding:10px 0;cursor:pointer;text-align:left;min-height:44px;text-decoration:underline;text-underline-offset:4px}
.falt[aria-pressed=true]{color:var(--ink)}
.fnav{display:flex;align-items:center;gap:14px;margin-top:8px;flex-wrap:wrap}
.fnav .hint{font-size:.85rem;color:var(--mute)}
@media (hover:none){.fnav .hint{display:none}}
.ferr{color:#F08A7E;font-size:.95rem;min-height:1.3em}
.fback{background:none;border:0;color:var(--ink2);font:500 .95rem var(--body);cursor:pointer;min-height:44px;padding:0 6px}
.saved{font-size:.82rem;color:var(--mute);display:flex;align-items:center;gap:6px}
.saved::before{content:"";width:7px;height:7px;border-radius:50%;background:#6FBF8A}
/* kalender */
.days{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:none;scroll-snap-type:x proximity}
.days::-webkit-scrollbar{display:none}
.day{flex:none;width:72px;min-height:76px;border:1px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;scroll-snap-align:start;font-family:var(--body)}
.day small{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mute)}
.day b{font-size:1.4rem;line-height:1}
.day span{font-size:.78rem;color:var(--ink2)}
.day[aria-pressed=true]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--card))}
.day:disabled{opacity:.35;cursor:default}
.times{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
.time{min-height:48px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:600 1rem var(--body);cursor:pointer}
.time[aria-pressed=true]{background:var(--accent);color:var(--onaccent);border-color:var(--accent)}
.calfoot{display:flex;flex-direction:column;gap:12px;margin-top:6px}
.skel{height:48px;border-radius:12px;background:linear-gradient(90deg,var(--card),var(--bg2),var(--card));background-size:200% 100%;animation:sk 1.2s infinite}
@keyframes sk{to{background-position:-200% 0}}
.done-ic{width:64px;height:64px;border-radius:50%;background:var(--accent);color:var(--onaccent);display:grid;place-items:center}
.done-ic svg{width:30px;height:30px}
.cal-add{display:flex;flex-wrap:wrap;gap:10px}
.next3{display:grid;gap:10px;counter-reset:n}
.next3 div{display:flex;gap:14px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;font-size:1rem}
.next3 div::before{counter-increment:n;content:counter(n);flex:none;width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--onaccent);display:grid;place-items:center;font-weight:700;font-size:.85rem}
body.lock{overflow:hidden}
main img,main video{filter:var(--imgfilter,none)}
/* ───── D · Redaktion (navnet delt om ét billede) ───── */
.hero-name{padding-top:calc(68px + clamp(16px,3vw,40px))}
.hero-name .nm{display:grid;grid-template-columns:1fr minmax(0,auto) 1fr;grid-template-rows:auto auto;align-items:start;gap:0 clamp(16px,3vw,40px)}
.hero-name .n1,.hero-name .n2{font-family:var(--display);font-weight:500;font-size:clamp(4rem,10.2vw,10.4rem);line-height:.82;letter-spacing:-.04em}
.hero-name .n1,.hero-name .n2{position:relative;z-index:2;color:#fff;mix-blend-mode:difference}
.hero-name .n1{grid-column:1;grid-row:1;justify-self:start}
.hero-name .n2{grid-column:3;grid-row:2;justify-self:end;align-self:end;margin-bottom:34px}
.hero-name .nm-pic{grid-column:2;grid-row:1/3;width:clamp(240px,27vw,400px);margin:clamp(30px,5vw,80px) 0 0}
.hero-name .nm-pic video{width:100%;aspect-ratio:4/5;object-fit:cover}
.hero-name .nm-pic figcaption{margin-top:10px;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink2)}
.hero-name .copy{margin:clamp(40px,6vw,80px) auto 0;align-items:center;text-align:center;max-width:720px}
.hero-name .copy .cta-row{justify-content:center}
.hero-name h1{font-size:clamp(2.2rem,4.6vw,3.6rem)}
@media (max-width:820px){
 /* mobil: navnet på to tætte linjer, så overskrift + knap er i folden, billedet bagefter */
 .hero-name .wrap{display:grid;grid-template-columns:minmax(0,1fr)}
 .hero-name .nm{display:contents}
 .hero-name .n1,.hero-name .n2{font-size:clamp(2.9rem,15.5vw,5rem);grid-column:1;grid-row:auto;margin:0;line-height:.86}
 .hero-name .n1{order:1}.hero-name .n2{order:2;justify-self:end}
 .hero-name .copy{order:3;margin-top:22px}
 .hero-name .nm-pic{order:4;grid-column:1;grid-row:auto;width:100%;margin:30px 0 0}
 .hero-name .nm-pic video{aspect-ratio:4/5}
}
/* ───── E · Atelier (centreret, bredt billede m. hvid kant) ───── */
.hero-atelier .copy{margin:0 auto;align-items:center;text-align:center;max-width:780px}
.hero-atelier .copy .cta-row{justify-content:center}
.hero-atelier h1{font-size:clamp(2.6rem,6.4vw,5.4rem);font-weight:400}
.hero-atelier h1 em{font-weight:400}
.hero-atelier .at-pic{position:relative;margin:clamp(36px,5vw,64px) auto 0;max-width:1060px;padding:0 clamp(28px,4vw,56px)}
.hero-atelier .at-pic img,.hero-atelier .at-pic video{width:100%;aspect-ratio:16/9;object-fit:cover}
.hero-atelier .at-side{position:absolute;left:0;top:50%;transform:translate(-30%,-50%) rotate(-90deg);font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--ink2);white-space:nowrap}
@media (max-width:640px){.hero-atelier .at-pic{padding:0}.hero-atelier .at-side{display:none}}
.dir-e .sec h2,.dir-e .center h2{text-align:inherit}
.dir-e .sec h2{font-size:clamp(2.1rem,4.6vw,3.6rem)}
/* ───── fælles high-end (D+E): ingen kort, skarpe kanter, tynde linjer, små spærrede versaler ───── */
.ed .eyebrow{font-size:.74rem;letter-spacing:.26em;color:var(--ink2);font-weight:500}
.ed .eyebrow::before{display:none}
.ed h1 em,.ed h2 em{color:inherit}
.ed .btn{border-radius:0;text-transform:uppercase;letter-spacing:.18em;font-size:.78rem;font-weight:500;padding:15px 28px}
.ed .btn:hover{transform:none;box-shadow:none;opacity:.86}
.ed .btn.sm{font-size:.72rem;padding:11px 18px}
.ed .ic,.ed .pc,.ed .part,.ed .rev,.ed .fl,.ed .bubble{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0}
.ed .ic,.ed .pc,.ed .part,.ed .rev{padding-left:0;padding-right:0}
.ed .fl>div:last-child{padding-left:0;padding-right:0}
.ed .pc i{background:none;color:var(--mute);font-weight:400}
.ed .bubble{align-self:flex-start !important;padding:12px 0;border-radius:0}
.ed .offer{background:transparent;border:0;border-block:1px solid var(--line);border-radius:0;padding-inline:0}
.ed .photo,.ed .clip,.ed .yt,.ed .hero-split .media{border-radius:0}
.ed .clip figcaption{background:none;backdrop-filter:none;left:0;bottom:-30px;color:var(--ink2);font-weight:500;font-size:.74rem;letter-spacing:.18em;text-transform:uppercase;padding:0}
.ed .clip{overflow:visible;margin-bottom:34px}
.ed .gal{padding-bottom:4px}
.ed .strip{background:transparent}
.ed .rev .who{border-top:0;padding-top:0}
.ed .rev b{font-family:var(--display);font-size:1.4rem;font-weight:400;line-height:1.2}
.ed .part .n,.ed .fl b span{font-family:var(--display);font-style:italic}
.ed .facts div{border-top:1px solid var(--ink)}
.ed .quote{border-color:var(--ink)}
.ed .story-media .then{box-shadow:none;border:1px solid var(--line)}
.ed .fm-card,.ed .opt,.ed .day,.ed .time,.ed .fm-x,.ed .calwait{border-radius:0}
.ed .sticky .btn{box-shadow:none}
.ed .final .bg{opacity:.12}
.mosaic{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(18px,2.4vw,34px);align-items:start}
.mosaic .m{margin:0}
.mosaic .m img{width:100%;height:auto;display:block}
.mosaic figcaption{margin-top:10px;font-size:.74rem;letter-spacing:.2em;text-transform:uppercase;color:var(--ink2)}
.mosaic .m1{grid-column:1/5}.mosaic .m2{grid-column:6/9;margin-top:120px}.mosaic .m3{grid-column:10/13;margin-top:40px}
.mosaic .m4{grid-column:2/6;margin-top:-40px}.mosaic .m5{grid-column:7/10;margin-top:60px}.mosaic .m6{grid-column:10/13;margin-top:-80px}
.mosaic .m7{grid-column:1/4;margin-top:20px}.mosaic .m8{grid-column:5/11;margin-top:80px}
.mosaic .m img{aspect-ratio:4/5;object-fit:cover}.mosaic .m8 img,.mosaic .m4 img{aspect-ratio:3/2}
@media (max-width:820px){.mosaic{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mosaic .m{grid-column:auto !important;margin-top:0 !important}.mosaic .m:nth-child(even){margin-top:40px !important}.mosaic .m8{grid-column:1/-1 !important}}
.pal-mono .stars{background:linear-gradient(90deg,#0E0E0E 90%,rgba(14,14,14,.25) 90%);-webkit-background-clip:text;background-clip:text}
.hero-split.land .media{aspect-ratio:4/3}
@media (max-width:820px){.hero-split.land .media{aspect-ratio:16/10}}
.yt{position:relative;display:block;width:100%;padding:0;border:0;border-radius:var(--r);overflow:hidden;background:#000;cursor:pointer;aspect-ratio:16/9}
.yt img,.yt iframe{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border:0}
.yt svg{position:absolute;left:50%;top:50%;width:64px;height:46px;transform:translate(-50%,-50%);transition:transform .2s}
.yt:hover svg{transform:translate(-50%,-50%) scale(1.08)}
.yt.on svg{display:none}
.story-media{position:relative;padding-bottom:56px}
.story-media .then{position:absolute;right:-10px;bottom:0;width:min(170px,38%);margin:0;background:#fff;padding:7px 7px 28px;transform:rotate(4deg);box-shadow:0 24px 50px -20px rgba(0,0,0,.7);border-radius:3px}
.story-media .then img{aspect-ratio:4/5;object-fit:cover;width:100%}
.story-media .then figcaption{position:absolute;bottom:5px;left:0;right:0;text-align:center;font-family:var(--display);font-style:italic;color:#3b3026;font-size:.95rem}
.music{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,64px);align-items:center}
.sig{font-size:1.25em;display:inline-block}
.ytgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.ytgrid figure{margin:0;display:flex;flex-direction:column;gap:8px}
.ytgrid figcaption{font-size:.92rem;color:var(--ink2)}
@media (max-width:820px){.music{grid-template-columns:minmax(0,1fr)}.story-media{max-width:560px}}
@media (max-width:420px){.ytgrid{gap:10px}.ytgrid figcaption{font-size:.86rem}}
.fm-card{transition:width .35s cubic-bezier(.2,.7,.2,1)}
.fm-card.wide{width:min(1080px,100% - 32px);height:min(780px,100dvh - 48px)}
.withcal{display:grid;grid-template-columns:minmax(0,1fr);gap:28px}
.calbox{display:none}
.wc-l .ferr:empty{min-height:0;margin:0}
.wc-l .fnav{margin-top:0}
.calbox.on{display:block;animation:fqin .45s cubic-bezier(.2,.7,.2,1)}
.calin{display:flex;flex-direction:column;gap:14px}
.calin[hidden]{display:none}
.calin .k{font-size:.85rem;font-weight:600;color:var(--accentT);letter-spacing:.06em}
.calh{color:var(--ink2);font-size:1rem}
.calwait{display:none}
@media (min-width:900px){
 .withcal{grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:40px;align-items:start}
 .calbox{display:block;position:sticky;top:0;border-left:1px solid var(--line);padding-left:40px;min-height:100%}
 .calwait{display:flex;flex-direction:column;gap:10px;justify-content:center;min-height:420px;border:1px dashed var(--line);border-radius:16px;padding:28px;color:var(--mute)}
 .calwait b{font-family:var(--display);font-weight:var(--hw);font-size:1.5rem;color:var(--ink2)}
 .calwait[hidden]{display:none}
}
@media (max-width:640px){.fm-card.wide{width:100%;height:100dvh}.calbox.on{border-top:1px solid var(--line);padding-top:24px}}
'''

ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>'

def cta(label, cls='', sec=''):
    return f'<button type="button" class="btn {cls}" data-open="{sec}">{H.escape(label)}{ARROW}</button>'

def ps(lines, cls=''):
    return ''.join(f'<p class="{cls}">{l}</p>' for l in lines)

def stars(): return '<span class="stars" role="img" aria-label="4,5 ud af 5 stjerner">★★★★★</span>'

def page(key, d, pal):
    c = P[key]; dd = D[d]; pn, pmode, pv = PAL[pal]
    rating = f'<a class="rating" href="{TRUSTPILOT}" target="_blank" rel="noopener">{stars()}<span><b>4,5 ud af 5</b> · 14 anmeldelser på Trustpilot</span></a>'
    heroimg = img(c['hero_img'][0], c['hero_img'][1], sizes='100vw' if dd['hero'] == 'full' else '(max-width:820px) 92vw, 520px', eager=True, w=1600, h=900)
    hk = c['hero_clip']; hclip = CLIPS[hk]; land = hk in LAND
    hvideo = f'<video autoplay muted loop playsinline preload="metadata" poster="{vposter(hk)}" aria-label="{H.escape(hclip[2])}" data-hero width="{1280 if land else 720}" height="{720 if land else 960}"><source src="{vsrc(hk)}" type="video/mp4"></video>'
    copy = f'''<div class="copy rv"><span class="eyebrow">{c["eyebrow"]}</span><h1>{c["h1"]}</h1><p class="sub">{c["sub"]}</p>
      <div class="cta-row">{cta(c["cta"], sec="hero")}</div>{rating}</div>'''
    if dd['hero'] == 'split':
        hero = f'<section class="hero hero-split{" land" if land else ""}" id="top"><div class="wrap">{copy}<div class="media rv">{hvideo}</div></div></section>'
    elif dd['hero'] == 'fan':
        f3 = [('acoustic', 'Velkomst'), ('fest', 'Dansegulvet'), ('warm', 'Middag')]
        if key == 'bryllup': f3 = [('acoustic', 'Vielsen'), ('beach', 'Velkomst'), ('gigblue', 'Dansefest')]
        figs = ''
        for i, (k2, cap) in enumerate(f3):
            f, poster, alt = CLIPS[k2]
            media = (f'<video autoplay muted loop playsinline preload="metadata" poster="{vposter(k2)}" aria-label="{H.escape(alt)}" width="720" height="960"><source src="{vsrc(k2)}" type="video/mp4"></video>' if i == 1
                     else f'<img src="/media/ev/{poster}-480.webp" alt="{H.escape(alt)}" width="480" height="640"{" fetchpriority=high" if i==0 else ""}>')
            figs += f'<figure>{media}<figcaption>{cap}</figcaption></figure>'
        hero = f'<section class="hero hero-fan" id="top"><div class="wrap">{copy}<div class="fan rv" aria-hidden="false">{figs}</div></div></section>'
    elif dd['hero'] == 'name':
        nk = 'gigblue' if key == 'firmafest' else 'beach'
        nv = f'<video autoplay muted loop playsinline preload="metadata" poster="{vposter(nk)}" aria-label="{H.escape(CLIPS[nk][2])}" width="720" height="960"><source src="{vsrc(nk)}" type="video/mp4"></video>'
        if dd.get('ed'): nv = simg(STOCK[key]['hero_name'], sizes='(max-width:820px) 92vw, 400px', eager=True)
        hero = f'''<section class="hero hero-name" id="top"><div class="wrap">
      <div class="nm"><span class="n1" aria-hidden="true">Oscar</span><figure class="nm-pic">{nv}<figcaption>{"Firmafest · Livemusik & DJ" if key=="firmafest" else "Vielse · Middag · Dansefest"}</figcaption></figure><span class="n2" aria-hidden="true">Jønsson</span></div>
      {copy}</div></section>'''
    elif dd['hero'] == 'atelier':
        hero = f'''<section class="hero hero-atelier" id="top"><div class="wrap">{copy}
      <figure class="at-pic rv"><span class="at-side" aria-hidden="true">Guitar · Sang · DJ</span>{simg(STOCK[key]['hero_wide'], sizes='(max-width:1100px) 92vw, 1060px', eager=True)}</figure></div></section>'''
    else:
        bg = hvideo if land else heroimg
        hero = f'<section class="hero hero-full" id="top"><div class="bgv">{bg}</div><div class="wrap">{copy}</div></section>'

    strip_items = ''.join(f'<div class="strip-item"><q>{R[k][4]}</q><span>{R[k][2]}</span></div>' for k in c['strip'])
    strip = f'<div class="strip" aria-label="Uddrag af anmeldelser"><div class="strip-track">{strip_items}<span aria-hidden="true" style="display:contents">{strip_items}</span></div></div>'

    intro = c['intro']
    introsec = f'''<section class="sec" id="intro"><div class="wrap"><div class="two">
      <div class="stack rv"><p class="big">{intro[0]}</p><p class="lead">{intro[1]}</p><p class="lead">{intro[2]}</p><p class="big" style="color:var(--accentT)">{intro[3]}</p>
      <div class="cta-row full">{cta(c["cta"], sec="intro")}</div></div>
      <div class="photo rv">{simg(STOCK[key]["intro"]) if dd.get("ed") else img(c["hero_img"][0] if dd["hero"]!="split" else ("beach-duo2" if key=="bryllup" else "studio-a"), "Oscar spiller live", w=1600, h=900)}</div></div></div></section>'''

    t, a, b = c['s2']
    gal = ''.join(clip(k, cap) for k, cap in c['gallery'])
    s2 = f'''<section class="sec alt" id="samlet"><div class="wrap"><div class="narrow rv"><h2>{t}</h2>
      <div class="stack">{ps(a, "big")}{ps(b, "lead")}</div></div><div class="gal rv" aria-label="Klip fra Oscars jobs">{gal}</div></div></section>'''

    mood = ''
    if dd.get('ed'):
        figs = ''.join(f'<figure class="m m{i+1} rv">{simg(k, sizes="(max-width:820px) 46vw, 420px")}<figcaption>{cap}</figcaption></figure>' for i, (k, cap) in enumerate(STOCK[key]['mood']))
        mood = f'<section class="sec mood" id="stemning" aria-label="Stemningsbilleder"><div class="wrap"><div class="mosaic">{figs}</div></div></section>'

    t, a, q, b, e = c['s3']
    s3 = f'''<section class="sec" id="stemning"><div class="wrap narrow center rv"><h2>{t}</h2><div class="stack">{ps(a, "lead")}
      <p class="quote">{q}</p>{ps(b, "big")}<p class="lead">{e}</p></div></div></section>'''

    t, a, items, b = c['s4']
    s4 = f'''<section class="sec alt" id="playliste"><div class="wrap"><div class="two">
      <div class="stack rv"><h2>{t}</h2><p class="lead">{a}</p><div class="pcards">{"".join(f'<div class="pc"><i>✕</i><span>{x}</span></div>' for x in items)}</div></div>
      <div class="stack rv">{ps(b[:1], "big")}{ps(b[1:], "lead")}<div class="cta-row full">{cta(c["cta"], sec="playliste")}</div></div></div></div></section>'''

    t, a, qs, b = c['s5']
    s5 = f'''<section class="sec" id="ansvar"><div class="wrap"><div class="two">
      <div class="stack rv"><h2>{t}</h2>{ps(a, "lead")}</div>
      <div class="stack rv"><div class="bubbles">{"".join(f'<div class="bubble">{x}</div>' for x in qs)}</div>{ps(b[:1], "big")}{ps(b[1:], "lead")}</div></div></div></section>'''

    story = f'''<section class="sec alt" id="oscar"><div class="wrap"><div class="story">
      <div class="story-media rv">{yt(0, "big")}<figure class="then">{img("dengang", "Oscar som ung musiker med el-guitar på en scene", widths=(480,), sizes="200px", w=1123, h=1400)}<figcaption>Dengang</figcaption></figure></div>
      <div class="stack rv"><span class="eyebrow">{STORY["eyebrow"]}</span><h2>{STORY["h"]}</h2>{ps(STORY["p"], "lead")}<p class="sign">{STORY["sign"]}</p>
      <div class="facts"><div><b>10+ år</b>som guitarist, sanger og DJ</div><div><b>1.000+</b>shows til fester, bryllupper og firmaevents</div><div><b>4,5 / 5</b>på Trustpilot, 14 anmeldelser</div></div>
      <div class="cta-row full">{cta(c["cta"], sec="oscar")}</div></div></div></div></section>'''

    music = f'''<section class="sec" id="musik"><div class="wrap"><div class="music">
      <div class="stack rv music-h"><span class="eyebrow">Hør selv</span><h2>Lyt til musikken fra <em class="sig">Oscar Jønsson</em></h2>
<div class="cta-row full">{cta(c["cta"], sec="musik")}</div></div>
      <div class="ytgrid rv">{"".join(f'<figure>{yt(i)}<figcaption>{H.escape(YT[i][2])}</figcaption></figure>' for i in range(1, 7))}</div></div></div></section>'''

    t, a, q, b = c['s6']
    s6 = f'''<section class="sec" id="vaelg"><div class="wrap narrow center rv"><h2>{t}</h2><div class="stack">{ps(a, "lead")}<p class="quote">{q}</p><p class="big">{b}</p></div></div></section>'''

    t, stages, b = c['s7']
    if dd.get('ed'): stages = [(n, tx, 's:' + STOCK[key]['flow'][i]) for i, (n, tx, ph) in enumerate(stages)]
    def flm(ph, n):
        if ph.startswith('s:'): return simg(ph[2:], sizes='(max-width:820px) 92vw, 360px')
        if ph.startswith('v:'):
            k = ph[2:]; return f'<video muted loop playsinline preload="none" poster="{vposter(k)}" data-src="{vsrc(k)}" aria-label="{H.escape(CLIPS[k][2])}" width="960" height="540"></video>'
        return img(ph, n, widths=(480,), sizes="(max-width:820px) 40vw, 360px", w=480, h=640)
    fl = ''.join(f'<div class="fl"><div class="photo">{flm(ph, n)}</div><div><b><span>0{i+1}</span>{n}</b><p>{tx}</p></div></div>' for i, (n, tx, ph) in enumerate(stages))
    s7 = f'''<section class="sec alt" id="forloeb"><div class="wrap"><div class="narrow rv"><h2>{t}</h2></div><div class="flow rv">{fl}</div><p class="big rv narrow">{b}</p></div></section>'''

    revs = ''.join(f'<article class="rev clamp"><b>{R[k][0]}</b><p>{R[k][1]}</p><button type="button" data-more>Læs hele anmeldelsen</button><div class="who"><strong>{R[k][2]}</strong><span>{R[k][3]}</span></div></article>' for k in c['reviews'])
    reviews = f'''<section class="sec" id="anmeldelser"><div class="wrap"><div class="tp rv"><span class="score">4,5</span><div><div>{stars()}</div><span style="color:var(--ink2)">14 anmeldelser af Oscar Jønsson Musik på <a href="{TRUSTPILOT}" target="_blank" rel="noopener">Trustpilot</a></span></div></div>
      <h2 class="rv" style="margin-top:18px">Det siger dem, der har haft Oscar til deres fest</h2><div class="revs">{revs}</div>
      <div class="cta-row center" style="margin-top:28px">{cta(c["cta"], sec="anmeldelser")}</div></div></section>'''

    t, a, b = c['s8']
    s8 = f'''<section class="sec alt" id="vaerdi"><div class="wrap"><div class="two"><div class="photo rv">{simg(STOCK[key]["s8"]) if dd.get("ed") else img("studio-b", "Oscar spiller guitar og synger", w=1600, h=1066)}</div>
      <div class="stack rv"><h2>{t}</h2>{ps(a, "lead")}<p class="big" style="color:var(--accentT)">{b}</p></div></div></div></section>'''

    t, a, parts, b = c['s9']
    pt = ''.join(f'<div class="part rv"><span class="n">{i+1}</span><b>{n}</b><p>{tx}</p></div>' for i, (n, tx) in enumerate(parts))
    s9 = f'''<section class="sec" id="fem-dele"><div class="wrap"><div class="narrow rv"><h2>{t}</h2><p class="lead">{a}</p></div><div class="parts">{pt}</div>
      <p class="lead rv">{b}</p><div class="cta-row rv" style="margin-top:22px">{cta(c["cta"], sec="fem-dele")}</div></div></section>'''

    t, a, items, b = c['s10']
    s10 = f'''<section class="sec alt" id="tilbud"><div class="wrap"><div class="offer rv"><div class="stack"><h2>{t}</h2><p class="lead">{a}</p>
      <ul class="check">{"".join(f"<li>{x}</li>" for x in items)}</ul><p class="big">{b}</p><div class="cta-row full">{cta(c["cta"], sec="tilbud")}</div></div>
      <div class="photo">{simg(STOCK[key]["offer"]) if dd.get("ed") else img("studio-warm-sq", "Oscar med akustisk guitar", widths=(480, 960), w=1200, h=1200)}</div></div></div></section>'''

    t, lines, b, ctal, small = c['s11']
    s11 = f'''<section class="sec final" id="slut"><div class="bg">{simg(STOCK[key]["final"], sizes="100vw") if dd.get("ed") else img(c["hero_img"][0], "", sizes="100vw", w=1600, h=900)}</div><div class="wrap narrow rv"><h2>{t}</h2>
      <div class="lines">{"".join(f"<span>{x}</span>" for x in lines)}</div><p class="big" style="color:var(--accentT)">{b}</p>
      <div class="cta-row" style="justify-content:center;margin-top:26px">{cta(ctal, sec="slut")}</div><p class="lead" style="margin-top:16px">{small}</p></div></section>'''

    cfg = dict(page=key, label=c['label'], title=c['form']['title'], steps=c['form']['steps'])
    pixel = ''
    if PIXEL_ID:
        pixel = f"<script>if(!/[?&]nt=1\\b/.test(location.search)){{!function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{PIXEL_ID}');fbq('track','PageView');}}</script>"
    og = f'https://fuldtbooketmusiker.dk/media/ev/{c["hero_img"][0]}-1600.webp'
    return f'''<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<script>if(location.protocol==="http:"&&!/^(localhost|127\\.)/.test(location.hostname))location.replace("https://"+location.host+location.pathname+location.search+location.hash)</script>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{c["title"]}</title>
<meta name="description" content="{H.escape(c["desc"])}">
<meta name="robots" content="noindex">
<meta property="og:title" content="{H.escape(c["title"])}"><meta property="og:description" content="{H.escape(c["desc"])}"><meta property="og:image" content="{og}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="{pv.split("--bg:")[1].split(";")[0]}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23C9A46A'/%3E%3Ctext x='32' y='44' font-size='34' text-anchor='middle' font-family='Georgia' fill='%2314110E'%3EO%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{dd["fonts"]}&display=swap">
<link rel="preload" as="image" href="{vposter(('beach' if key=='bryllup' else 'gigblue') if dd['hero']=='name' else hk) if (dd['hero'] in ('split','fan','name') or land) else '/media/ev/'+c['hero_img'][0]+'-960.webp'}">
{pixel}
<script src="/track.js" async></script>
<style>:root{{{pv};{dd["vars"]};--scheme:{pmode}}}{CSS}</style>
</head>
<body class="dir-{d}{" ed" if dd.get("ed") else ""} pal-{pal}">
<header class="nav" id="nav"><div class="wrap"><a class="logo" href="#top">Oscar Jønsson<small>Musik</small></a>{cta("Få et tilbud", "sm", sec="nav")}</div></header>
<main>
{hero}
{strip}
{introsec}
{s2}
{mood}
{s3}
{s4}
{s5}
{story}
{music}
{s6}
{s7}
{reviews}
{s8}
{s9}
{s10}
{s11}
</main>
<footer><div class="wrap"><span>© 2026 Oscar Jønsson Musik{' · Stemningsbilleder: <a href="https://unsplash.com/license" target="_blank" rel="noopener">Unsplash</a>' if dd.get('ed') else ''}</span><span>Livemusik og DJ til {"firmafester" if key=="firmafest" else "bryllupper"} i hele Danmark</span></div></footer>
<div class="sticky" id="sticky">{cta(c["cta"] if len(c["cta"])<34 else "Få et tilbud", sec="sticky")}</div>
<div class="fm" id="bkModal" hidden role="dialog" aria-modal="true" aria-labelledby="fmTitle">
  <div class="fm-card"><div class="fm-top"><b id="fmTitle">{c["form"]["title"]}</b><span class="saved" id="fmSaved" hidden>Gemt</span><button type="button" class="fm-x" id="fmX" aria-label="Luk">{X}</button></div>
  <div class="fm-prog"><i id="fmProg"></i></div><div class="fm-body" id="fmBody"></div></div>
</div>
<script>window.EV={json.dumps(cfg, ensure_ascii=False)};</script>
<script src="/ev.js" defer></script>
</body>
</html>
'''

for key in P:
    for d, dd in D.items():
        for pal in dd['pals']:
            html_ = page(key, d, pal)
            (OUT / f'{key}-{d}-{pal}.html').write_text(html_)
            if pal == dd['pals'][0]: (OUT / f'{key}-{d}.html').write_text(html_)  # standard-farve (gamle links virker)

# ───────────────────────── live-valg + oversigtsside (/ev/) ─────────────────────────
LIVE = {'firmafest': ('a', 'messing'), 'bryllup': ('b', 'champagne')}   # ÉN kilde: build.sh kopierer ev/_live-*.html
for key, (d, pal) in LIVE.items():
    (OUT / f'_live-{key}.html').write_text((OUT / f'{key}-{d}-{pal}.html').read_text())

def chip(pal):
    n, m, v = PAL[pal]; c = dict(x.split(':', 1) for x in v.split(';'))
    return c['--bg'], c['--accent'], c['--ink'], n
data = {'live': LIVE, 'dirs': {d: dict(name=dd['name'], kind=dd['kind'], note=dd['note'], pals=[[p] + list(chip(p)) for p in dd['pals']]) for d, dd in D.items()}}
cards = {'Performance': '', 'High-end': ''}
for d, dd in D.items():
    p0 = dd['pals'][0]
    chips = ''.join(f'<button type="button" class="ch" data-pal="{p}" aria-pressed="{str(i == 0).lower()}" title="{chip(p)[3]}"><i style="background:linear-gradient(135deg,{chip(p)[0]} 50%,{chip(p)[1]} 50%)"></i><span>{chip(p)[3]}</span></button>' for i, p in enumerate(dd['pals']))
    cards[dd['kind']] += f'''<article class="card" data-dir="{d}">
  <a class="shot" href="/ev/firmafest-{d}-{p0}"><img class="sd" src="/ev/thumbs/firmafest-{d}-{p0}-d.webp" alt="" loading="lazy" width="720" height="450"><img class="sm" src="/ev/thumbs/firmafest-{d}-{p0}-m.webp" alt="" loading="lazy" width="195" height="422"><span class="live" hidden>Live nu</span></a>
  <div class="meta"><div class="top"><h3>{d.upper()} · {dd["name"]}</h3><span class="kind">{dd["kind"]}</span></div><p>{dd["note"]}</p>
  <div class="chips" role="group" aria-label="Farver">{chips}</div>
  <div class="act"><a class="b pri open" href="/ev/firmafest-{d}-{p0}">Åbn siden</a><a class="b form" href="/ev/firmafest-{d}-{p0}#form">Se formularen</a></div></div>
</article>'''
(OUT / 'index.html').write_text(f'''<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Oscar Jønsson · Versioner</title><meta name="description" content="Alle versioner og farver af Oscars landingssider til firmafester og bryllupper.">
<meta property="og:title" content="Oscar Jønsson · Versioner"><meta property="og:image" content="https://fuldtbooketmusiker.dk/ev/thumbs/bryllup-d-hvid-d.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Jost:wght@400;500&display=swap">
<style>
:root{{--bg:#FAFAF8;--ink:#141414;--ink2:#4A4A4A;--mute:#6E6E6E;--line:rgba(20,20,20,.12);--card:#fff}}
@media (prefers-color-scheme:dark){{:root:not([data-theme=light]){{--bg:#121212;--ink:#F2F2F0;--ink2:#C2C2C0;--mute:#9A9A98;--line:rgba(242,242,240,.14);--card:#1B1B1B}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Jost,system-ui,sans-serif;-webkit-font-smoothing:antialiased}}
.wrap{{width:min(1240px,100% - 32px);margin:auto}}
header{{padding:clamp(36px,6vw,72px) 0 18px;display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line)}}
h1{{font:400 clamp(2.4rem,6vw,4.6rem)/.95 "Bodoni Moda",Georgia,serif;letter-spacing:-.03em;margin:0}}
h1 small{{display:block;font:500 .78rem Jost,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:var(--ink2);margin-bottom:14px}}
.seg{{display:inline-flex;border:1px solid var(--ink)}}
.seg button{{font:500 .8rem Jost,sans-serif;letter-spacing:.18em;text-transform:uppercase;padding:13px 22px;min-height:46px;background:transparent;color:var(--ink);border:0;cursor:pointer}}
.seg button[aria-pressed=true]{{background:var(--ink);color:var(--bg)}}
.lives{{display:flex;flex-wrap:wrap;gap:8px 22px;padding:16px 0 0;font-size:.95rem;color:var(--ink2)}}
.lives a{{color:var(--ink)}}
h2{{font:500 .8rem Jost,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:var(--ink2);margin:48px 0 16px;display:flex;align-items:center;gap:14px}}
h2::after{{content:"";flex:1;height:1px;background:var(--line)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:22px}}
.card{{background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column}}
.shot{{position:relative;display:block;aspect-ratio:16/10;overflow:hidden;background:#000}}
.shot .sd{{width:100%;height:100%;object-fit:cover;object-position:top;display:block;transition:transform .5s}}
.shot:hover .sd{{transform:scale(1.02)}}
.shot .sm{{position:absolute;right:12px;bottom:-34%;width:24%;height:auto;border:3px solid #fff;box-shadow:0 14px 30px -10px rgba(0,0,0,.55);background:#fff}}
.live{{position:absolute;left:12px;top:12px;background:#1E7F4E;color:#fff;font:500 .72rem Jost,sans-serif;letter-spacing:.16em;text-transform:uppercase;padding:6px 10px}}
.meta{{padding:20px 20px 22px;display:flex;flex-direction:column;gap:12px;flex:1}}
.top{{display:flex;justify-content:space-between;align-items:baseline;gap:12px}}
h3{{font:400 1.7rem/1.1 "Bodoni Moda",Georgia,serif;margin:0;letter-spacing:-.01em}}
.kind{{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);white-space:nowrap}}
.meta p{{margin:0;color:var(--ink2);font-size:.95rem}}
.chips{{display:flex;flex-wrap:wrap;gap:8px}}
.ch{{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:6px 12px 6px 7px;border:1px solid var(--line);background:transparent;color:var(--ink);font:500 .85rem Jost,sans-serif;cursor:pointer}}
.ch i{{width:28px;height:28px;border-radius:50%;border:1px solid var(--line);flex:none}}
.ch[aria-pressed=true]{{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}}
.act{{display:flex;flex-wrap:wrap;gap:10px;margin-top:auto;padding-top:6px}}
.b{{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 18px;border:1px solid var(--ink);color:var(--ink);text-decoration:none;font:500 .78rem Jost,sans-serif;letter-spacing:.16em;text-transform:uppercase}}
.b.pri{{background:var(--ink);color:var(--bg)}}
footer{{margin:56px 0 0;padding:22px 0 40px;border-top:1px solid var(--line);color:var(--mute);font-size:.9rem}}
@media (max-width:520px){{.shot .sm{{width:28%}}.act .b{{flex:1;letter-spacing:.1em;font-size:.74rem;padding:12px 10px;white-space:nowrap}}}}
</style></head><body><div class="wrap">
<header><h1><small>Oscar Jønsson · Landingssider</small>Versioner &amp; farver</h1>
<div class="seg" role="group" aria-label="Side"><button type="button" data-page="firmafest" aria-pressed="true">Firmafest</button><button type="button" data-page="bryllup" aria-pressed="false">Bryllup</button></div></header>
<div class="lives">Live nu: <a href="/firmafest">fuldtbooketmusiker.dk/firmafest</a><a href="/bryllup">fuldtbooketmusiker.dk/bryllup</a></div>
<h2>Performance</h2><div class="grid">{cards["Performance"]}</div>
<h2>High-end</h2><div class="grid">{cards["High-end"]}</div>
<footer>Del linket: fuldtbooketmusiker.dk/ev/ · Tryk på en farve for at se versionen i den farve.</footer></div>
<script>
const DATA={json.dumps(data, ensure_ascii=False)};
let page=/bryllup/.test(location.hash)?'bryllup':'firmafest';
const sel={{}};
function draw(){{
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.page===page)));
  document.querySelectorAll('.card').forEach(c=>{{
    const d=c.dataset.dir, pal=sel[d]||DATA.dirs[d].pals[0][0], base=`/ev/${{page}}-${{d}}-${{pal}}`;
    c.querySelector('.sd').src=`/ev/thumbs/${{page}}-${{d}}-${{pal}}-d.webp`; c.querySelector('.sm').src=`/ev/thumbs/${{page}}-${{d}}-${{pal}}-m.webp`;
    c.querySelector('.shot').href=base; c.querySelector('.open').href=base; c.querySelector('.form').href=base+'#form';
    c.querySelectorAll('.ch').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pal===pal)));
    const L=DATA.live[page]; c.querySelector('.live').hidden=!(L[0]===d&&L[1]===pal);
  }});
}}
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{{page=b.dataset.page;history.replaceState(null,'','#'+page);draw();}});
document.querySelectorAll('.ch').forEach(b=>b.onclick=()=>{{sel[b.closest('.card').dataset.dir]=b.dataset.pal;draw();}});
draw();
</script></body></html>''')
(OUT / 'temaer.html').write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/ev/"><link rel="canonical" href="/ev/"><title>Versioner</title><a href="/ev/">Versioner</a>')
print('ev/: ' + ' '.join(sorted(p.name for p in OUT.iterdir())))
