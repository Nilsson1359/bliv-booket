#!/usr/bin/env python3
"""Engelsk version af fuldtbooketmusiker.dk under /en (8/11 2026).

Kører EFTER resten af build.sh og arbejder på de FÆRDIGBYGGEDE danske sider i _site/:
  _site/index.html      -> _site/en/index.html      (/en/)
  _site/tak.html        -> _site/en/tak.html        (/en/tak)
  _site/onboarding.html -> _site/en/onboarding.html (/en/onboarding)
  _site/privatliv.html  -> _site/en/privacy.html    (/en/privacy)
Dvs. design, tema, scripts, tracking, video og booking-popup er altid de samme som på den danske side;
kun teksten byttes via oversættelses-tabellerne herunder. Danske tekster matches med fleksibel whitespace.

Desuden tilføjes på BÅDE dansk og engelsk: hreflang-links, DA/EN-skifter i toppen, og bk_lang i localStorage.
Den danske /tak sender videre til /en/tak (m. samme query), hvis besøgende kom fra /en/ (bk_lang=en),
FØR GTM/pixel/track.js kører, så GHL-redirecten (der altid går til /tak) også virker for engelske besøgende.

VEDLIGEHOLD: Ændres en dansk tekst, fejler bygget her med en liste over danske nøgler, der ikke længere findes.
Ret nøglen (og den engelske tekst) i tabellen. Nødudgang: EN_ALLOW_MISSING=1 ./build.sh (bygger med advarsel).
"""
import os, re, sys, pathlib

ROOT = pathlib.Path(__file__).parent
SITE = ROOT / '_site'
DOMAIN = 'https://fuldtbooketmusiker.dk'

# (dansk fil i _site, dansk URL, engelsk fil i _site, engelsk URL)
PAGES = [
    ('index.html', '/', 'en/index.html', '/en/'),
    ('tak.html', '/tak', 'en/tak.html', '/en/tak'),
    ('onboarding.html', '/onboarding', 'en/onboarding.html', '/en/onboarding'),
    ('privatliv.html', '/privatliv', 'en/privacy.html', '/en/privacy'),
]

# ───────────────────────── Trustpilot-anmeldelser (index + tak) ─────────────────────────
REVIEWS = [
    ('Perfekt stemning fra start til slut!', 'Perfect atmosphere from start to finish!'),
    ('Oscar får vores varmeste anbefalinger! Han var med os hele bryllupsdagen og skabte præcis den rette stemning. Han rørte os med smukt guitarspil og sang ved vielsen og leverede behagelig baggrundsmusik til receptionen. På bådfarten inden middagen satte han for alvor gang i fællessangen, og som afslutning styrede han diskoteket og holdt dansegulvet i gang, til vi simpelthen ikke kunne mere. Helt magisk! Hvis I leder efter en alsidig musiker, der kan det hele, og en helt igennem rar person, så er det Oscar, I skal booke.',
     'Oscar gets our warmest recommendation! He was with us the whole wedding day and created exactly the right atmosphere. He moved us with beautiful guitar and vocals at the ceremony and played lovely background music for the reception. On the boat trip before dinner he really got the sing-along going, and to finish he ran the disco and kept the dance floor packed until we simply couldn\'t dance any more. Pure magic!\nIf you\'re looking for a versatile musician who can do it all, and a genuinely lovely person, Oscar is the one to book.'),
    ('Oscar og Clara var med til at gøre vores bryllup til noget helt særligt!', 'Oscar and Clara helped make our wedding truly special!'),
    ('Oscar spillede guitar og sang under middagen sammen med Clara, og de skabte præcis den hyggelige og afslappede stemning, vi havde håbet på. Det var virkelig dejligt at have livemusik så tæt på under middagen, både musikken og Claras fantastiske stemme passede perfekt til aftenen. Senere på aftenen tog Oscar over som DJ, og så blev der for alvor skruet op for festen! Vi er virkelig glade for, at vi valgte Oscar og Clara til vores bryllup. De var super søde, professionelle og utrolig gode til at mærke stemningen og levere det, der passede til aftenen. Kæmpe anbefaling herfra. Vi kunne ikke have ønsket os en bedre musikalsk ramme om vores bryllup!',
     'Oscar played guitar and sang during dinner together with Clara, and they created exactly the cosy, relaxed atmosphere we had hoped for. It was wonderful to have live music so close during dinner; both the music and Clara\'s amazing voice were a perfect fit for the evening.\nLater in the evening Oscar took over as DJ, and that\'s when the party really took off!\nWe\'re so glad we chose Oscar and Clara for our wedding. They were lovely, professional and incredibly good at reading the room and delivering exactly what the evening needed.\nHuge recommendation from us. We couldn\'t have wished for a better musical setting for our wedding!'),
    ('Helt fantastisk musiker!', 'An absolutely fantastic musician!'),
    ('Vi bookede Oscar til vores bryllup, da vi ønskede én som kunne spille lige fra udendørs vielsen og til gæsterne gik hjem, altså én som kunne spille musik til forskellige stemninger, og det må man sige at Oscar han KAN! Han spillede og sang akustisk, på fineste vis, til vielsen. Efter vielsen flyttede vi udstyret op til receptionen, hvor der blev spillet dejlig, festlig og hyggeligt musik. Under middagen spillede og sang han lavmeldt, så der var god mulighed for at snakke ved bordene. Da natten faldt på og der var godt gang i festen spillede han op til dans, og alle gæsterne var ude at give den gas. Oscar har hele tiden en finger på pulsen, og fornemmer hurtigt stemningen i selskabet. Vi kunne ikke have været mere tilfredse med vores valg at musiker, og vi vil give vores allervarmeste anbefalinger til Oscar! Der er ingen tvivl om, at det bliver ham vi booker igen en anden gang :-)',
     'We booked Oscar for our wedding because we wanted someone who could play from the outdoor ceremony until the last guests went home, someone who could match the music to every mood, and Oscar certainly CAN!\nHe played and sang acoustically, beautifully, at the ceremony. Afterwards we moved the gear to the reception, where he played lovely, festive and cosy music.\nDuring dinner he kept it low-key, so there was plenty of room to talk at the tables.\nAs night fell and the party got going, he played for dancing, and every single guest was out on the floor.\nOscar always has his finger on the pulse and quickly senses the mood in the room.\nWe couldn\'t have been happier with our choice of musician, and we give Oscar our very warmest recommendation!\nThere\'s no doubt he\'s the one we\'ll book next time :-)'),
    ('Oscar spillede til vores bryllup 16/5</p>', 'Oscar played at our wedding on 16 May</p>'),
    ('Oscar spillede til vores bryllup 16/5. Han spillede på guitar og sang under middagen. Meget dejligt baggrundsmusik, som skabte en let og dejlig stemning. Efter brudevalsen skiftede Oscar over til DJ pulten og havde et bredt udvalg med og var virkelig god til at skifte mellem de forskellige genre, da vores gæster var en meget blandet flok. Han fik alle i gang og skabte en fantastisk feststemning. Oscar kender både til nyt og gammelt. Han tog imod alle ønsker og var med til at gøre vores dag/nat uforglemmelig og helt perfekt. Vi vil klart anbefale Oscar til privatfest både til unge som gamle.',
     'Oscar played at our wedding on 16 May. He played guitar and sang during dinner. Really lovely background music that created a light, pleasant atmosphere. After the first dance Oscar switched to the DJ booth, brought a wide selection and was great at moving between genres, as our guests were a very mixed crowd. He got everyone going and created a fantastic party atmosphere. Oscar knows both new and old music. He took every request and helped make our day and night unforgettable and absolutely perfect. We\'d definitely recommend Oscar for private parties, for young and old alike.'),
    ('Fantastisk oplevelse da Oscar spillede…', 'A fantastic experience when Oscar played…'),
    ('Fantastisk oplevelse da Oscar spillede til min Far’s bryllup lige fra kirken helt frem til sidst sang der blev spillet på dj pulten kan klart anbefales hvis i skal havde en og spille til jeres festlige begivenheder',
     'A fantastic experience when Oscar played at my dad\'s wedding, all the way from the church to the very last song from the DJ booth. Highly recommended if you need someone to play at your celebrations'),
    ('Oscar spillede til vores bryllup både…', 'Oscar played at our wedding, both…'),
    ('Oscar spillede til vores bryllup både akustisk med sang og DJ til festen efter midnat. Det var en super god beslutning at vælge Oscar, der foruden at være dygtig og imødekommende er en utrolig professionel og venlig ung mand. Han var med til løfte vores fest til det vi ønskede os allermest “En dansefest”. Alle vores gæster var vilde med ham og dansegulvet var fyldt fra start til slut. Oscar formåede at ramme alle aldersgrupper og som prikken over i et spillede og sang han i kirken lige efter vores vielse solo foran 100 gæster og os.',
     'Oscar played at our wedding, both acoustic with vocals and as a DJ for the party after midnight.\nChoosing Oscar was a great decision. Besides being skilled and easy to work with, he\'s an incredibly professional and friendly young man.\nHe helped turn our party into exactly what we wanted most: “a dance party”.\nAll our guests loved him and the dance floor was full from start to finish.\nOscar managed to reach every age group, and as the icing on the cake he played and sang solo in the church right after our ceremony, in front of 100 guests and us.'),
    ('Perfekt musik hele dagen', 'Perfect music all day'),
    ('Oscar spillede musik til min mors bryllup den 14/03-2026, og det var en helt fantastisk oplevelse. Han var med fra vielsen og helt til langt ud på natten. Han leverede en gennemført og stemningsfuld indsats hele vejen igennem🌟 Kan varmt anbefale Oscar til alle, der leder efter en dygtig og pålidelig live-musiker!☺️',
     'Oscar played at my mum\'s wedding on 14 March 2026, and it was an absolutely fantastic experience. He was there from the ceremony until late into the night and delivered a polished, atmospheric performance the whole way through🌟\nI warmly recommend Oscar to anyone looking for a skilled and reliable live musician!☺️'),
    ('5 stjerner ⭐️⭐️⭐️⭐️⭐️', '5 stars ⭐️⭐️⭐️⭐️⭐️'),
    ('Vi havde Oscar til at spille live musik til vores fest, og det var en virkelig god oplevelse hele vejen igennem. ✨ Han var rigtig god til at tilpasse sangvalget til både anledning, gæsterne og stemningen i rummet. Under middagen var han meget opmærksom på at holde lydniveauet behageligt, så man stadig kunne føre samtaler, og musikken var helt klart med til, at løfte helhedsoplevelsen og niveauet for vores fest. Vi kan varmt anbefale Oscar til andre, der ønsker live musik ✨',
     'We had Oscar play live music at our party, and it was a really great experience from start to finish. ✨\nHe was excellent at tailoring the songs to the occasion, the guests and the mood in the room.\nDuring dinner he made a point of keeping the volume comfortable so people could still talk, and the music clearly lifted the whole experience and the level of our party.\nWe warmly recommend Oscar to anyone who wants live music ✨'),
    ('Oscar spillede til vores sølvbryllup og…', 'Oscar played at our silver wedding and…'),
    ('Oscar spillede til vores sølvbryllup og gjorde det bare perfekt. Super under middagen og med lidt flere musikere (Martin Jønsson + trommer og sangerinde) gik det hele op i en højere enhed. Tak for festen 🙏🤗',
     'Oscar played at our silver wedding anniversary and nailed it. Superb during dinner, and with a few more musicians (Martin Jønsson + drums and a singer) everything came together beautifully. Thanks for a great party 🙏🤗'),
    ('<p class="ttitle">Super dygtig musiker</p>', '<p class="ttitle">A seriously talented musician</p>'),
    ('Super dygtig musiker, kæmpe repetoire og perfekt til at skabe stemning til festen 👌🏻', 'A seriously talented musician with a huge repertoire, perfect for getting a party going 👌🏻'),
    ('Oscar leverede musikken til vores bryllup!', 'Oscar provided the music for our wedding!'),
    ('Vi havde booket Oscar til at spille guitar og synge til vores vielse og reception, og vi var super tilfredse med musikken! Udover vores egen begejstring, fik Oscar også meget ros fra vores gæster. Vi havde på forhånd aftalt et bestemt musiknummer, vi ville ankomme til, og ellers stod Oscar selv for at bestemme resten af musikken, og det hele passede perfekt ind i den stemning, vi ønskede os for dagen.',
     'We booked Oscar to play guitar and sing at our ceremony and reception, and we were thrilled with the music! On top of our own enthusiasm, Oscar got lots of compliments from our guests. We had agreed on one specific song to walk in to, and otherwise Oscar chose the rest of the music himself, and it all fit perfectly with the atmosphere we wanted for the day.'),
    ('Fleksibel, selvkørende, stemnings-spotter og publikumsfavorit', 'Flexible, self-sufficient, reads the room and a crowd favourite'),
    ('Vi har af to omgange haft Oscar til at spille til arrangementer. Kæmpe fornøjelse begge gange. Oscar er selvkørende, fleksibel, godt selskab, fanger rummet og stemningen og så er gæsterne ret fan af ham, også til en lille snak i pauserne. Oscar får en stor anbefaling. Det er i hvert fald ikke sidste gang, at vi bruger ham.',
     'We\'ve had Oscar play at our events twice. A huge pleasure both times.\nOscar is self-sufficient, flexible and great company. He reads the room and the mood, and the guests are big fans of him, including for a quick chat during the breaks.\nOscar comes highly recommended. It certainly won\'t be the last time we book him.'),
    ('Oscar er teknisk dygtig</p>', 'Oscar is technically brilliant</p>'),
    ('Oscar er teknisk dygtig, en virkelig god guitarist og sanger. Oscar var meget nærværende og gæsterne havde en fest. En sublim oplevelse Booker gerne Oscar igen :-)',
     'Oscar is technically brilliant, a really good guitarist and singer. He was very present and the guests had a blast.\nA sublime experience\nWould happily book Oscar again :-)'),
    ('aria-label="Anmeldelser fra Trustpilot"', 'aria-label="Reviews from Trustpilot"'),
    ('aria-label="5 stjerner"', 'aria-label="5 stars"'),
    ('<b>4,5 ud af 5</b><span>14 anmeldelser · Oscar Jønsson Musik</span>', '<b>4.5 out of 5</b><span>14 reviews · Oscar Jønsson Musik</span>'),
]

FOOTER = [
    ('<span>Fuldt booket musiker på 90 dage</span>', '<span>Fully booked musician in 90 days</span>'),
]

# ───────────────────────── Forside (index.html) ─────────────────────────
INDEX = REVIEWS + FOOTER + [
    # head
    ('<meta property="og:title" content="Bliv Booket: Fuldt booket musiker på 90 dage">',
     '<meta property="og:title" content="Bliv Booket: Get fully booked as a musician in 90 days">\n<meta property="og:locale" content="en_GB">'),
    ('<title>Bliv Booket</title>', '<title>Bliv Booket · Get fully booked in 90 days</title>'),
    # nav + hero
    ('Ansøg nu om en plads', 'Apply for a spot'),
    ('<span>Et 90-dages <span class="nw">gjort-for-dig-system</span></span>', '<span>A 90-day <span class="nw">done-for-you system</span></span>'),
    ('<span>Du møder op, vi klarer resten</span>', '<span>You show up. We handle the rest.</span>'),
    ('<em>Fuldt booket musiker</em>: gå fra tilfældige jobs til et fast system, der skaffer dig nye spillemuligheder',
     '<em>Fully booked musician:</em> go from random gigs to a reliable system that keeps bringing you new bookings'),
    ('På 90 dage hjælper vi dig med at finde de rigtige kunder, vise hvorfor de skal vælge dig og bygge et system, der skaber nye henvendelser, også når du ikke selv leder efter jobs.',
     'In 90 days we help you find the right clients, show them why they should choose you, and build a system that keeps bringing in new inquiries, even when you\'re not out hunting for work.'),
    ('>Se de fem dele</a>', '>See the five parts</a>'),
    ('aria-label="Afspil videoen"', 'aria-label="Play the video"'),
    ('<span class="vsl-lbl">Se videoen · 2 min</span>', '<span class="vsl-lbl">Watch the video · 2 min</span>'),
    ('<div><b>90 dage</b>fra start til fuld kalender</div>', '<div><b>90 days</b>from kick-off to a full calendar</div>'),
    ('<div><b>Gjort for dig</b>vi bygger og styrer det hele</div>', '<div><b>Done for you</b>we build and run all of it</div>'),
    ('<div><b>Du møder op</b>til de gigs, vi booker ind til dig</div>', '<div><b>You show up</b>to the gigs we book for you</div>'),
    ('<span class="kl">Gennemsnitligt gig</span><b><span class="kn" data-to="14700">0</span> kr</b><span class="kd">Det betaler kunderne i gennemsnit for et gig</span>',
     '<span class="kl">Average gig</span><b><span class="cur">DKK</span> <span class="kn" data-to="14700">0</span></b><span class="kd">What clients pay for a gig, on average</span>'),
    ('<span class="kl">Annoncer pr. booket gig</span><b><span class="kn" data-to="1000">0</span> kr</b><span class="kd">Så meget koster det i annoncer at få et gig i hus</span>',
     '<span class="kl">Ad spend per booked gig</span><b><span class="cur">DKK</span> <span class="kn" data-to="1000">0</span></b><span class="kd">What it costs in ads to land one gig</span>'),
    ('<span class="kpct">6,8 % af gig-prisen</span>', '<span class="kpct">6.8% of the gig fee</span>'),
    ('<span class="kl">Gigs om måneden</span>', '<span class="kl">Gigs per month</span>'),
    ('<span class="kd">Så mange gigs får vores kunder i gennemsnit</span>', '<span class="kd">What our clients book on average</span>'),
    ('<span>Bryllupper</span><span>Firmafester</span><span>Større arrangementer</span><span>Særlige arrangementer</span><span>De rigtige kunder</span><span>Til den rigtige pris</span><span>Uden at vente på telefonen</span>',
     '<span>Weddings</span><span>Corporate parties</span><span>Large events</span><span>Special occasions</span><span>The right clients</span><span>At the right price</span><span>No more waiting by the phone</span>'),
    # testimonials
    ('<span class="eyebrow">Anmeldelser fra Trustpilot</span><h2>Det siger kunderne, der har booket Oscar</h2><p class="lead">Systemet er bygget og testet i Oscars egen musikforretning. Her er, hvad kunderne siger bagefter.</p>',
     '<span class="eyebrow">Reviews from Trustpilot</span><h2>What clients say after booking Oscar</h2><p class="lead">The system was built and tested in Oscar\'s own music business. Here\'s what his clients say afterwards (reviews translated from Danish).</p>'),
    # story
    ('<span class="eyebrow">Min historie</span><h2>Hvorfor jeg byggede Bliv Booket</h2>', '<span class="eyebrow">My story</span><h2>Why I built Bliv Booket</h2>'),
    ('<span>Fra Oscar Jønssons skrivebord</span><span>Musiker og stifter af Bliv Booket</span><span>Danmark</span>',
     '<span>From the desk of Oscar Jønsson</span><span>Musician and founder of Bliv Booket</span><span>Denmark</span>'),
    ('<p class="sal">Kære musiker,</p>', '<p class="sal">Dear fellow musician,</p>'),
    ('<p>Jeg er nærmest vokset op med musik.</p>', '<p>I pretty much grew up with music.</p>'),
    ('Min far er professionel musiker, og derfor fik jeg selv muligheden for at komme ud og spille foran mennesker i en tidlig alder. Siden da har musikken været en kæmpe del af mit liv, og jeg har brugt mange år på at blive bedre til mit håndværk og skabe gode oplevelser for de mennesker, jeg spiller for.',
     'My dad is a professional musician, so I got the chance to play in front of people from an early age. Music has been a huge part of my life ever since, and I\'ve spent years getting better at my craft and creating great experiences for the people I play for.'),
    ('<span class="yr">Dengang</span>', '<span class="yr">Back then</span>'),
    ('alt="Oscar som dreng på scenen med guitar sammen med sin far"', 'alt="Oscar as a boy on stage with a guitar, next to his father"'),
    ('<p class="cap">Ude at spille foran mennesker i en tidlig alder</p>', '<p class="cap">Playing in front of an audience from an early age</p>'),
    ('<span class="yr">I dag</span>', '<span class="yr">Today</span>'),
    ('alt="Oscar Jønsson spiller guitar og synger på scenen til et bryllup"', 'alt="Oscar Jønsson playing guitar and singing on stage at a wedding"'),
    ('<p class="cap">Fuldt booket med op til 200.000&nbsp;kr. i månedlige aftaler på spillejobs</p>', '<p class="cap">Fully booked, with up to DKK&nbsp;200,000 a month in gig bookings</p>'),
    ('<p>Men jeg fandt også hurtigt ud af, at det at være en dygtig musiker <b>ikke nødvendigvis betyder, at kalenderen er fyldt med jobs.</b></p>',
     '<p>But I quickly learned that being a great musician <b>doesn\'t necessarily mean your calendar is full of gigs.</b></p>'),
    ('<p>Det var faktisk noget af det, jeg selv kæmpede mest med.</p>', '<p>In fact, it was one of the things I struggled with most.</p>'),
    ('<p>Jeg kunne spille. Jeg kunne levere varen, når jeg stod til et arrangement. Men når jobbet var slut, sad jeg ofte med det samme spørgsmål:</p>',
     '<p>I could play. I could deliver when I was on stage at an event. But when the gig was over, I was often left with the same question:</p>'),
    ('<p class="q">“Hvor skal det <em>næste job</em> komme fra?”</p>', '<p class="q">“Where is the <em>next gig</em> going to come from?”</p>'),
    ('<p>Jeg følte mig afhængig af anbefalinger, mit netværk og tilfældige henvendelser. Jeg havde ikke et system, hvor jeg selv kunne skabe efterspørgsel og få nye potentielle kunder ind.</p>',
     '<p>I felt dependent on referrals, my network and random inquiries. I had no system that let me create demand myself and bring in new potential clients.</p>'),
    ('<p>Det blev starten på, at jeg begyndte at interessere mig enormt meget for den del af musikbranchen, som meget få musikere lærer noget om:</p>',
     '<p>That was the start of my obsession with the part of the music industry that very few musicians are ever taught:</p>'),
    ('<p class="shout">Hvordan man faktisk driver forretning som musiker.</p>', '<p class="shout">How to actually run a business as a musician.</p>'),
    ('<p>Jeg har siden investeret rigtig meget tid, energi og penge i at lære om markedsføring, salg, content, annoncering og de systemer, der ligger bag en stabil strøm af bookinger.</p>',
     '<p>Since then I\'ve invested a lot of time, energy and money in learning marketing, sales, content, advertising and the systems behind a steady stream of bookings.</p>'),
    *[(f'</i>{a}</div>', f'</i>{b}</div>') for a, b in [('Markedsføring', 'Marketing'), ('Salg', 'Sales'), ('Annoncering', 'Advertising'), ('Systemer', 'Systems')]],
    ('<p><b>Og vigtigst af alt har jeg brugt det i min egen musikforretning.</b></p>', '<p><b>And most importantly, I\'ve put it to work in my own music business.</b></p>'),
    ('<p>Undervejs har jeg samlet det, der virker, i et system, som er lavet specifikt til musikere.</p>', '<p>Along the way I\'ve packaged what works into a system built specifically for musicians.</p>'),
    ('<p>Et system, der skal hjælpe dygtige musikere med ikke bare at blive bedre til at spille, men med at <span class="mark">blive bedre til at skabe efterspørgsel efter det, de allerede er gode til.</span></p>',
     '<p>A system that helps talented musicians not just play better, but <span class="mark">get better at creating demand for what they\'re already great at.</span></p>'),
    ('alt="Oscar spiller akustisk guitar til en fest"', 'alt="Oscar playing acoustic guitar at a party"'),
    ('alt="Oscar Jønsson spiller akustisk guitar i studiet"', 'alt="Oscar Jønsson playing acoustic guitar in the studio"'),
    ('alt="Oscar Jønsson og sangerinde optræder på stranden"', 'alt="Oscar Jønsson and a singer performing on the beach"'),
    ('<p>For jeg tror ikke, at problemet for de fleste musikere er, at de ikke er dygtige nok.</p>', '<p>Because I don\'t believe the problem for most musicians is that they aren\'t good enough.</p>'),
    ('<p><span class="mark">Problemet er, at ingen nogensinde har lært dem, hvordan de får de rigtige mennesker til at opdage dem, stole på dem og booke dem.</span></p>',
     '<p><span class="mark">The problem is that nobody ever taught them how to get the right people to discover them, trust them and book them.</span></p>'),
    ('<p class="hook">Men hvorfor skal du lytte til mig?</p>', '<p class="hook">So why should you listen to me?</p>'),
    ('<p class="hook-a">Jeg kender allerede præcis din position, fordi jeg har stået i den selv.</p>', '<p class="hook-a">Because I know exactly where you are. I\'ve been there myself.</p>'),
    ('<small>Musiker · Stifter af Bliv Booket</small>', '<small>Musician · Founder of Bliv Booket</small>'),
    # Kevin
    ('<span class="eyebrow">Kundehistorie</span><h2>Fra at ringe rundt efter jobs til bookinger et år frem</h2>',
     '<span class="eyebrow">Client story</span><h2>From chasing gigs on the phone to bookings a year ahead</h2>'),
    ('<p class="lead">Kevin Hartmann har spillet professionelt i næsten 20 år. Her fortæller han Oscar, hvad der skete, da han fik et system bag sin musik.</p>',
     '<p class="lead">Kevin Hartmann has played professionally for almost 20 years. Here he tells Oscar what happened once he put a system behind his music.</p>'),
    ('alt="Oscar Jønsson interviewer Kevin Hartmann"', 'alt="Oscar Jønsson interviewing Kevin Hartmann"'),
    ('aria-label="Afspil interviewet med Kevin"', 'aria-label="Play the interview with Kevin"'),
    ('<span class="vsl-lbl">Se hele samtalen · 17 min</span>', '<span class="vsl-lbl">Watch the interview · 17 min</span>'),
    ('<small>Musiker · Bliv Booket-kunde</small>', '<small>Musician · Bliv Booket client</small>'),
    ('<span>Hop til</span>', '<span>Jump to</span>'),
    ('<i>0:23</i>Før: ringede selv rundt</button>', '<i>0:23</i>Before: cold-calling for work</button>'),
    ('<i>2:22</i>Jobs hver weekend</button>', '<i>2:22</i>Gigs every weekend</button>'),
    ('<i>2:37</i>Dobbelt så høj pris</button>', '<i>2:37</i>Double the price</button>'),
    ('<i>7:52</i>Jeg skulle bare møde op</button>', '<i>7:52</i>I just had to show up</button>'),
    ('<i>10:45</i>180.000 kr. på 3-4 måneder</button>', '<i>10:45</i>DKK 180,000 in 3–4 months</button>'),
    ('<i>15:52</i>Råd til andre musikere</button>', '<i>15:52</i>Advice for other musicians</button>'),
    ('<div class="kstat"><b>180.000 kr.</b><span>omsat på 3-4 måneder</span></div>', '<div class="kstat"><b>DKK 180k</b><span>in revenue in 3–4 months</span></div>'),
    ('<span>igen på det, han har brugt på annoncer</span>', '<span>return on what he\'s spent on ads</span>'),
    ('<div class="kstat"><b>10.000+ kr.</b><span>pr. job i dag, mod 4-5.000 kr. før</span></div>', '<div class="kstat"><b>DKK 10k+</b><span>per gig today, up from DKK 4–5k before</span></div>'),
    ('<div class="kstat"><b>25.000 kr.</b><span>hans største job til dato</span></div>', '<div class="kstat"><b>DKK 25k</b><span>his biggest gig to date</span></div>'),
    ('<p class="knote">Tallene er Kevins egne, som han fortæller dem i videoen</p>', '<p class="knote">The interview is in Danish. The figures are Kevin\'s own, as he tells them in the video (DKK 10,000 ≈ €1,340)</p>'),
    ('<p>Jeg vidste overhovedet ikke, hvor min næste booking kom fra.</p>', '<p>I had absolutely no idea where my next booking was coming from.</p>'),
    ('<p>Jeg har jobs hver weekend og er allerede begyndt at få bookinger ind for næste år.</p>', '<p>I have gigs every weekend, and I\'m already getting bookings for next year.</p>'),
    ('<p>Alt var faktisk gjort for mig. Jeg skulle bare møde op.</p>', '<p>Everything was actually done for me. I just had to show up.</p>'),
    (' Hør det ved ', ' Hear it at '),
    # intro
    ('<span class="eyebrow">Hele vejen fra musik til booking</span>', '<span class="eyebrow">All the way from music to booking</span>'),
    ('Du har måske allerede prøvet bookingplatforme, opslag på sociale medier, beskeder til spillesteder og håbet på anbefalinger.',
     'You may already have tried booking platforms, social media posts, messaging venues and hoping for referrals.'),
    ('<p class="lead">Nu bygger vi hele vejen fra din musik til din næste booking, så du kan få flere af <span class="hl">de rigtige jobs til en pris, der gør det muligt at leve af det.</span></p>',
     '<p class="lead">Now we build the entire path from your music to your next booking, so you land more of <span class="hl">the right gigs, at a price you can actually make a living from.</span></p>'),
    ('<p class="lead">Uden at du selv skal lære annoncering, bygge hjemmesider eller bruge hele din uge på at finde kunder.</p>',
     '<p class="lead">Without having to learn advertising, build websites or spend your whole week finding clients.</p>'),
    ('<span>Fra fremmed til booket</span>', '<span>From stranger to booked</span>'),
    ('<span>Hver prik er et menneske. De fremhævede bliver booket.</span>', '<span>Each dot is a person. The highlighted ones get booked.</span>'),
    # overview
    ('<span class="eyebrow">Overblik</span><h2>Her er de 6 problemer, du står med lige nu, og løsningen på dem</h2>',
     '<span class="eyebrow">Overview</span><h2>The 6 problems holding you back right now, and how we solve them</h2>'),
    ('<span class="ov-l">Løsningen</span>', '<span class="ov-l">The solution</span>'),
    ('<b class="ov-p">Du mangler ikke talent</b><p class="ov-d">Du har ikke et fast system, der hjælper de rigtige mennesker med at finde, vælge og booke dig.</p>',
     '<b class="ov-p">You don\'t lack talent</b><p class="ov-d">You lack a reliable system that helps the right people find you, choose you and book you.</p>'),
    ('<p>Vi bygger Bliv Booket-systemet™ omkring dit talent, så du kan blive ved med at være ekspert i din musik.</p><span class="ov-pill">Hele systemet</span>',
     '<p>We build the Bliv Booket System™ around your talent, so you can stay the expert in your music.</p><span class="ov-pill">The whole system</span>'),
    ('<b class="ov-p">Du venter på, at telefonen ringer</b><p class="ov-d">Anbefalinger og tilfældige henvendelser. Det er ikke et system. Det er håb.</p>',
     '<b class="ov-p">You\'re waiting for the phone to ring</b><p class="ov-d">Referrals and random inquiries. That\'s not a system. That\'s hope.</p>'),
    ('<p>Et system, der skaber henvendelser™: annoncer og en side, der gør det let at sende dig en forespørgsel.</p>',
     '<p>An Inquiry Engine™: ads plus a page that makes it easy to send you a request.</p>'),
    ('<b class="ov-p">Din kalender føles tilfældig</b><p class="ov-d">Du kan ikke selv skabe bookinger, når du har brug for dem.</p>',
     '<b class="ov-p">Your calendar feels random</b><p class="ov-d">You can\'t create bookings on demand when you need them.</p>'),
    ('<p>Du får din egen vej til nye kunder, som du kan tænde for, når kalenderen skal fyldes.</p>',
     '<p>You get your own route to new clients that you can switch on whenever the calendar needs filling.</p>'),
    ('<b class="ov-p">Du bliver sammenlignet på pris</b><p class="ov-d">På bookingsider står du ved siden af ti andre, og kunden spørger kun: “Hvad koster du?”</p>',
     '<b class="ov-p">You get compared on price</b><p class="ov-d">On booking sites you\'re listed next to ten others, and the client only asks: “How much do you charge?”</p>'),
    ('<p>Bliv det klare valg™: vi viser, hvorfor du er pengene værd, så samtalen ændrer sig.</p>',
     '<p>Become the Obvious Choice™: we show why you\'re worth the money, so the conversation changes.</p>'),
    ('<b class="ov-p">Du viser ikke tydeligt nok, hvorfor de skal vælge dig</b><p class="ov-d">Telefonvideoer, mørke optagelser og en side, der ikke fortæller, hvem du passer til.</p>',
     '<b class="ov-p">You don\'t show clearly enough why they should choose you</b><p class="ov-d">Phone videos, dark footage and a website that doesn\'t say who you\'re right for.</p>'),
    ('<p>Videoer, der får dem til at vælge dig™: filmet til rigtige arrangementer og i studie.</p>',
     '<p>Videos That Get You Chosen™: filmed at real events and in the studio.</p>'),
    ('<b class="ov-p">Du har ikke en fast vej fra musik til booking</b><p class="ov-d">Delene arbejder ikke sammen, og kunden ved ikke, hvad næste skridt er.</p>',
     '<b class="ov-p">You have no clear path from music to booking</b><p class="ov-d">The pieces don\'t work together, and the client doesn\'t know what to do next.</p>'),
    ('<p>Fra henvendelse til booket job™: hele vejen fra de opdager dig, til de booker dig.</p>',
     '<p>From Inquiry to Booked Gig™: the whole way from discovering you to booking you.</p>'),
    ('<span class="ov-pill">Del 2</span>', '<span class="ov-pill">Part 2</span>'),
    ('<span class="ov-pill">Del 3</span>', '<span class="ov-pill">Part 3</span>'),
    ('<span class="ov-pill">Del 4</span>', '<span class="ov-pill">Part 4</span>'),
    ('<span class="ov-pill">Del 5</span>', '<span class="ov-pill">Part 5</span>'),
    # p1
    ('<span>Lørdag · 23:41 · 500 gæster</span>', '<span>Saturday · 11:41 pm · 500 guests</span>'),
    ('<h2>Du mangler ikke talent</h2>', '<h2>You don\'t lack talent</h2>'),
    ('<p class="lead">Når du først står foran publikum, ved du præcis, hvad du skal gøre.</p>', '<p class="lead">Once you\'re in front of an audience, you know exactly what to do.</p>'),
    ('<li>Du kan spille.</li>', '<li>You can play.</li>'),
    ('<li>Du kan skabe stemning.</li>', '<li>You can create an atmosphere.</li>'),
    ('<li>Du kan få mennesker på dansegulvet.</li>', '<li>You can get people on the dance floor.</li>'),
    ('<li>Du kan give gæsterne en aften, de taler om bagefter.</li>', '<li>You can give guests a night they\'ll talk about for weeks.</li>'),
    ('<span>Mandag · 08:12 · 0 nye henvendelser</span>', '<span>Monday · 8:12 am · 0 new inquiries</span>'),
    ('<p class="big">Men problemet begynder, når det sidste nummer er spillet.</p>', '<p class="big">But the problem starts when the last song has been played.</p>'),
    ('<li>Du pakker dit udstyr sammen.</li><li>Du tager hjem.</li>', '<li>You pack up your gear.</li><li>You head home.</li>'),
    ('<p class="body dim">Og mandag morgen er du tilbage ved det samme spørgsmål:</p>', '<p class="body dim">And on Monday morning you\'re back to the same question:</p>'),
    ('<p class="q">“Hvor kommer mit næste job fra?”</p>', '<p class="q">“Where\'s my next gig coming from?”</p>'),
    ('<div><b>Måske</b>kommer der en anbefaling.</div>', '<div><b>Maybe</b>a referral comes in.</div>'),
    ('<div><b>Måske</b>skriver en tidligere kunde.</div>', '<div><b>Maybe</b>a past client gets in touch.</div>'),
    ('<div><b>Måske</b>finder nogen dig på Eventzone.</div>', '<div><b>Maybe</b>someone finds you on a booking site.</div>'),
    ('<div><b>Måske</b>sender en anden musiker et job videre.</div>', '<div><b>Maybe</b>another musician passes a gig your way.</div>'),
    ('<p class="big">Men du ved det ikke.</p>', '<p class="big">But you don\'t know.</p>'),
    ('<p class="big dim">Og det er dét, der er problemet.</p>', '<p class="big dim">And that\'s the problem.</p>'),
    ('Du er måske dygtig nok til at leve af din musik. Men du har ikke et fast system, der hjælper de rigtige mennesker med at finde, vælge og booke dig.',
     'You may well be good enough to make a living from your music. But you don\'t have a reliable system that helps the right people find you, choose you and book you.'),
    # p2
    ('<h2>Du venter på, at telefonen ringer</h2>', '<h2>You\'re waiting for the phone to ring</h2>'),
    ('<p class="lead">Hvis du er som mange andre professionelle musikere, DJs eller bands, har du allerede prøvet at:</p>',
     '<p class="lead">If you\'re like most professional musicians, DJs and bands, you\'ve already tried:</p>'),
    ('Oprette dig på Eventzone og andre bookingsider</li>', 'Listing yourself on gig marketplaces and booking sites</li>'),
    ('Lægge videoer op på Instagram og Facebook</li>', 'Posting videos on Instagram and Facebook</li>'),
    ('Skrive til spillesteder og arrangører</li>', 'Messaging venues and event organisers</li>'),
    ('Spørge tidligere kunder om anbefalinger</li>', 'Asking past clients for referrals</li>'),
    ('Tage jobs til en lavere pris for at sikre bookingen</li>', 'Dropping your price to secure the booking</li>'),
    ('Håbe på, at folk fra dit seneste job husker dit navn</li>', 'Hoping people from your last gig remember your name</li>'),
    ('Poste mere uden at vide, om det skaber bookinger</li>', 'Posting more without knowing if it leads to bookings</li>'),
    ('<p class="big">Noget af det har måske virket.</p>', '<p class="big">Some of it may have worked.</p>'),
    ('<p class="big dim">Men det virker ikke hver gang.</p>', '<p class="big dim">But it doesn\'t work every time.</p>'),
    ('<li>Den ene måned har du travlt.</li>', '<li>One month you\'re flat out.</li>'),
    ('<li>Den næste måned er kalenderen næsten tom.</li>', '<li>The next, your calendar is almost empty.</li>'),
    ('<li>Du kan ikke se, hvorfor den gode måned var god.</li>', '<li>You can\'t tell why the good month was good.</li>'),
    ('<li>Og du ved derfor heller ikke, hvordan du kan få det til at ske igen.</li>', '<li>So you don\'t know how to make it happen again.</li>'),
    ('<span class="k">Uden system</span><b>0-2 jobs</b><small>om måneden, og du ved ikke hvorfor</small>', '<span class="k">No system</span><b>0–2 gigs</b><small>a month, and you don\'t know why</small>'),
    ('<span class="k">Bliv Booket-systemet™</span><b>5-7 gigs</b><small>om måneden i gennemsnit hos vores kunder</small>', '<span class="k">The Bliv Booket System™</span><b>5–7 gigs</b><small>a month, on average, for our clients</small>'),
    ('<span>Henvendelser over 12 måneder</span>', '<span>Inquiries over 12 months</span>'),
    ('<span>Samme talent. Forskellig kalender.</span>', '<span>Same talent. Different calendar.</span>'),
    ('>Din plan bliver</span>', '>Your plan becomes</span>'),
    ('<span class="pill">Spil et godt job</span>', '<span class="pill">Play a great gig</span>'),
    ('<span class="pill">håb på en anbefaling</span>', '<span class="pill">hope for a referral</span>'),
    ('<span class="pill">vent på en besked</span>', '<span class="pill">wait for a message</span>'),
    ('<span class="pill">tag det næste job</span>', '<span class="pill">take the next gig</span>'),
    ('<p class="bigserif">Det er ikke et system.<br><em>Det er håb.</em></p>', '<p class="bigserif">That\'s not a system.<br><em>That\'s hope.</em></p>'),
    # p3
    ('<h2>Det er derfor, din kalender føles tilfældig</h2>', '<h2>That\'s why your calendar feels random</h2>'),
    ('<p class="lead">Problemet er ikke kun, at du mangler flere bookinger.</p><p class="big">Problemet er, at du ikke selv kan skabe dem, når du har brug for dem.</p>',
     '<p class="lead">The problem isn\'t just that you need more bookings.</p><p class="big">It\'s that you can\'t create them yourself when you need them.</p>'),
    ('>Du kan ikke beslutte</p>', '>You can\'t decide</p>'),
    ('<div><em>“Denne måned vil jeg gerne have ti nye henvendelser fra bryllupper, firmafester eller større arrangementer.”</em></div>',
     '<div><em>“This month I want ten new inquiries from weddings, corporate parties or large events.”</em></div>'),
    ('<div>Du kan ikke tænde for noget og vide, at nye mennesker vil opdage dig.</div>', '<div>You can\'t switch something on and know new people will discover you.</div>'),
    ('<div>Du kan ikke regne ud, hvor mange henvendelser du skal have for at få ét nyt job.</div>', '<div>You can\'t work out how many inquiries it takes to land one new gig.</div>'),
    ('<p class="big">Derfor føles din kalender som noget, der sker for dig.</p>', '<p class="big">So your calendar feels like something that happens to you.</p>'),
    ('<p class="big dim">Ikke som noget, du selv kan påvirke.</p>', '<p class="big dim">Not something you can control.</p>'),
    ('<span>Din kalender uden system</span>', '<span>Your calendar without a system</span>'),
    ('<span>Nogle måneder står tomme.</span>', '<span>Some months stay empty.</span>'),
    ('<p class="lead">Det skaber en usikkerhed, som følger dig fra måned til måned:</p>', '<p class="lead">That creates an uncertainty that follows you from month to month:</p>'),
    ('<div>Har jeg nok jobs næste måned?</div><div>Kan jeg betale mine regninger?</div><div>Skal jeg sige ja til dette job, selvom prisen er for lav?</div><div>Hvad sker der, hvis anbefalingerne stopper?</div><div>Kan jeg virkelig leve af min musik?</div><div>Skal jeg finde et andet arbejde ved siden af?</div><div>Hvorfor bliver andre musikere booket mere end mig?</div><div>Er de bedre end mig, eller er de bare bedre til at blive set?</div>',
     '<div>Will I have enough gigs next month?</div><div>Can I pay my bills?</div><div>Should I say yes to this gig even though the fee is too low?</div><div>What happens if the referrals dry up?</div><div>Can I really make a living from my music?</div><div>Do I need a day job on the side?</div><div>Why do other musicians get booked more than me?</div><div>Are they better than me, or just better at being seen?</div>'),
    ('aria-label="Oscar Jønsson spiller til et arrangement"', 'aria-label="Oscar Jønsson performing at an event"'),
    ('<span class="tagpill dark">Fiks mine problemer nu</span>', '<span class="tagpill dark">Fix this for me now</span>'),
    ('<p class="bigserif xl">Du kan være fantastisk foran 500 mennesker lørdag aften og stadig sidde foran en tom indbakke mandag morgen.</p>',
     '<p class="bigserif xl">You can be brilliant in front of 500 people on Saturday night and still be staring at an empty inbox on Monday morning.</p>'),
    ('<p class="fx-sub">90 dage · Gjort for dig · Du møder op til de gigs, vi booker ind til dig.</p>', '<p class="fx-sub">90 days · Done for you · You show up to the gigs we book for you.</p>'),
    # p4
    ('<h2>Du bliver sammenlignet på pris</h2>', '<h2>You get compared on price</h2>'),
    ('<p class="lead">Når en kunde finder dig på en bookingside, står du ofte ved siden af mange andre musikere.</p><p>Kunden ser måske fem bands, seks DJs eller ti solomusikere.</p><p>De kan ikke altid høre eller forstå forskellen.</p><p>Så de spørger:</p>',
     '<p class="lead">When a client finds you on a booking site, you\'re usually listed next to lots of other musicians.</p><p>They might see five bands, six DJs or ten solo artists.</p><p>They can\'t always hear or understand the difference.</p><p>So they ask:</p>'),
    ('<span class="mono">Fra</span><p class="bigserif quote strike rv"><span class="stk">“Hvad koster du?”</span></p><p style="color:var(--ink2);font-size:.95rem">Nu handler valget pludselig om pris.</p>',
     '<span class="mono">From</span><p class="bigserif quote strike rv"><span class="stk">“How much do you charge?”</span></p><p style="color:var(--ink2);font-size:.95rem">Suddenly the decision is all about price.</p>'),
    ('<span class="mono" style="color:var(--accent2)">Til</span><p class="bigserif" style="color:var(--bg)">“Hvordan får vi dig ud at spille til vores arrangement?”</p><p style="color:rgba(244,239,231,.7);font-size:.95rem">Målet er at ændre hele samtalen.</p>',
     '<span class="mono" style="color:var(--accent2)">To</span><p class="bigserif" style="color:var(--bg)">“How do we get you to play at our event?”</p><p style="color:rgba(244,239,231,.7);font-size:.95rem">The goal is to change the whole conversation.</p>'),
    ('<span>16 musikere på en bookingside</span>', '<span>16 musicians on a booking site</span>'),
    ('<span>Når kunden kun ser et tal, vinder det laveste.</span>', '<span>When all the client sees is a number, the lowest one wins.</span>'),
    ('>Valget handler ikke om</p>', '>The decision isn\'t about</p>'),
    ('<span>Ikke om den stemning, du skaber.</span><span>Ikke om følelsen i rummet.</span><span>Ikke om din erfaring.</span><span>Ikke om, hvor trygge de kan være ved at vælge dig.</span>',
     '<span>Not the atmosphere you create.</span><span>Not the feeling in the room.</span><span>Not your experience.</span><span>Not how safe they can feel choosing you.</span>'),
    ('>Bare om dit tal er højere eller lavere end de andres.</p>', '>Just whether your number is higher or lower than everyone else\'s.</p>'),
    ('>Så ender du med at sænke din pris eller forsvare, hvorfor du koster mere.</p>', '>So you end up lowering your price, or defending why you cost more.</p>'),
    ('>Men målet er ikke at blive bedre til at forsvare din pris.</p>', '>But the goal isn\'t to get better at defending your price.</p>'),
    ('aria-label="Oscar og sangerinde spiller på stranden"', 'aria-label="Oscar and a singer performing on the beach"'),
    ('aria-label="Oscar spiller akustisk guitar alene i studiet"', 'aria-label="Oscar playing acoustic guitar alone in the studio"'),
    ('aria-label="Oscar spiller og synger i studiet"', 'aria-label="Oscar playing and singing in the studio"'),
    ('<span class="lbl">Studie</span>', '<span class="lbl">Studio</span>'),
    ('<p class="lead">Når kunden allerede har set dig spille, mærket din energi og forstået, hvad du gør ved et rum, bliver du ikke længere bare sammenlignet med den billigste mulighed.</p>',
     '<p class="lead">Once a client has already seen you play, felt your energy and understood what you do to a room, you\'re no longer just being compared with the cheapest option.</p>'),
    ('<p class="big">Så leder de ikke kun efter en musiker.</p>', '<p class="big">Then they\'re not just looking for a musician.</p>'),
    ('<p class="bigserif">De leder efter dig.</p>', '<p class="bigserif">They\'re looking for you.</p>'),
    # p5
    ('<h2>Du viser ikke tydeligt nok, hvorfor de skal vælge dig</h2>', '<h2>You don\'t show clearly enough why they should choose you</h2>'),
    ('<p class="lead">Du kan være den bedste musiker blandt alle dem, kunden overvejer.</p><p class="big">Men hvis kunden ikke kan se forskellen, findes forskellen næsten ikke for dem.</p>',
     '<p class="lead">You might be the best musician of everyone the client is considering.</p><p class="big">But if the client can\'t see the difference, to them it barely exists.</p>'),
    ('aria-label="Kevin Hartmann spiller klaver og synger"', 'aria-label="Kevin Hartmann playing piano and singing"'),
    ('aria-label="Kevin Hartmann fortæller om sig selv"', 'aria-label="Kevin Hartmann talking about himself"'),
    ('<span class="lbl">Hvem er Kevin</span>', '<span class="lbl">Meet Kevin</span>'),
    ('aria-label="Kevin Hartmann i en kort reel"', 'aria-label="Kevin Hartmann in a short reel"'),
    ('<p class="h4">Mange musikere har</p><ul class="plain"><li>Tilfældige videoer optaget på en telefon</li><li>Mørke optagelser med dårlig lyd</li><li>Klip fra meget forskellige typer jobs</li><li>En hjemmeside, der ikke fortæller, hvem de passer til</li><li>En Instagram-profil uden en tydelig retning</li><li>Ingen enkel måde at sende en forespørgsel på</li></ul>',
     '<p class="h4">Most musicians have</p><ul class="plain"><li>Random videos shot on a phone</li><li>Dark footage with poor sound</li><li>Clips from wildly different kinds of gigs</li><li>A website that doesn\'t say who they\'re right for</li><li>An Instagram profile with no clear direction</li><li>No simple way to send an inquiry</li></ul>'),
    ('<p class="big">Hvis du vil bookes til store bryllupper, firmafester eller særlige arrangementer, skal de rigtige kunder kunne se sig selv have dig stående dér.</p>',
     '<p class="big">If you want to be booked for big weddings, corporate parties or special events, the right clients need to be able to picture you right there at theirs.</p>'),
    ('<span class="hl">Det, de ser på deres skærm, skal passe til den pris, du vil have på din faktura.</span>', '<span class="hl">What they see on their screen has to match the price you want on your invoice.</span>'),
    # p6
    ('<h2>Du har ikke en fast vej fra musik til booking</h2>', '<h2>You have no clear path from music to booking</h2>'),
    ('<p class="lead">De fleste musikere har enkelte dele. Men delene arbejder ikke sammen.</p><p style="color:var(--ink2)">En potentiel kunde ser måske en video, synes den er god og fortsætter derefter med sin dag.</p>',
     '<p class="lead">Most musicians have some of the pieces. But the pieces don\'t work together.</p><p style="color:var(--ink2)">A potential client might watch a video, like it, and then just get on with their day.</p>'),
    ('<span>Seks løse dele</span>', '<span>Six loose pieces</span>'),
    ('<span>Delene arbejder ikke sammen.</span>', '<span>The pieces don\'t work together.</span>'),
    ('<p class="h4">Kunden ved ikke</p><ul class="plain"><li>Hvad du kan bookes til</li><li>Om du passer til deres arrangement</li><li>Hvad der gør dig anderledes</li><li>Hvordan de kontakter dig</li><li>Hvad næste skridt er</li></ul>',
     '<p class="h4">The client doesn\'t know</p><ul class="plain"><li>What they can book you for</li><li>Whether you\'re right for their event</li><li>What makes you different</li><li>How to contact you</li><li>What the next step is</li></ul>'),
    ('<p class="big">Derfor mister du mennesker, som måske gerne ville have booket dig.</p><div class="pair"><p class="lead">Ikke fordi de sagde nej.</p><p class="bigserif">Men fordi vejen frem var uklar.</p>',
     '<p class="big">So you lose people who might have loved to book you.</p><div class="pair"><p class="lead">Not because they said no.</p><p class="bigserif">But because the way forward wasn\'t clear.</p>'),
    ('alt="Oscar Jønsson spiller og synger i studiet"', 'alt="Oscar Jønsson playing and singing in the studio"'),
    # cost
    ('<span class="eyebrow">Konsekvensen</span><h2>Det bliver dyrt at vente</h2>', '<span class="eyebrow">The cost</span><h2>Waiting gets expensive</h2>'),
    ('<div>For få ser dig</div><div>For få spørger efter dig</div><div>Du får for få jobs at vælge imellem</div><div>Du bliver nødt til at tage dårligere jobs</div><div>Det bliver svært at hæve din pris</div><div>Din indkomst bliver ved med at være usikker</div>',
     '<div>Too few people see you</div><div>Too few ask for you</div><div>You have too few gigs to choose from</div><div>You end up taking worse gigs</div><div>Raising your price gets hard</div><div>Your income stays unpredictable</div>'),
    ('<p class="big">Det påvirker ikke bare kalenderen. <span class="dim">Det påvirker også dit liv.</span></p>', '<p class="big">It doesn\'t just affect your calendar. <span class="dim">It affects your life.</span></p>'),
    ('<li>Du kan ikke planlægge din økonomi.</li><li>Du ved ikke, hvor travl du er om tre måneder.</li><li>Du siger måske ja til jobs, du ikke ønsker, fordi du ikke ved, hvornår den næste mulighed kommer.</li><li>Og i værste fald begynder du at tvivle på, om det overhovedet er muligt at leve godt af din musik.</li>',
     '<li>You can\'t plan your finances.</li><li>You don\'t know how busy you\'ll be three months from now.</li><li>You say yes to gigs you don\'t want, because you don\'t know when the next opportunity will come.</li><li>And at worst, you start doubting whether it\'s even possible to make a good living from your music.</li>'),
    ('<p class="big">Det er derfor, problemet ikke kan løses med endnu et tilfældigt opslag på Instagram.</p>', '<p class="big">That\'s why one more random Instagram post won\'t fix it.</p>'),
    ('<p class="bigserif">Du har brug for, at alle dele arbejder sammen.</p>', '<p class="bigserif">You need every piece working together.</p>'),
    ('<span>Én vej fra fremmed til kunde</span>', '<span>One path from stranger to client</span>'),
    ('<span>Vi bygger og styrer det hele.</span>', '<span>We build and run all of it.</span>'),
    # system
    ('<span class="eyebrow">Løsningen · Det, vi bygger for dig</span><h2>På 90 dage bygger vi Bliv Booket-systemet<sup style="font-size:.4em;color:var(--accent)">™</sup> sammen med dig.</h2><p class="lead">Det består af fem enkle dele:</p>',
     '<span class="eyebrow">The solution · What we build for you</span><h2>In 90 days we build the Bliv Booket System<sup style="font-size:.4em;color:var(--accent)">™</sup> with you.</h2><p class="lead">It has five simple parts:</p>'),
    ('aria-label="90 dage"><span id="counterNum">90</span><small>dage</small>', 'aria-label="90 days"><span id="counterNum">90</span><small>days</small>'),
    ('<div class="num">Del 1 af 5</div><h3>De rigtige jobs<sup>™</sup></h3><p>Før vi filmer eller laver annoncer, finder vi ud af:</p>',
     '<div class="num">Part 1 of 5</div><h3>The Right Gigs<sup>™</sup></h3><p>Before we film anything or run a single ad, we figure out:</p>'),
    ('<li>Hvem du helst vil spille for</li><li>Hvilke arrangementer du ønsker flere af</li><li>Hvilke kunder der kan betale en ordentlig pris</li><li>Hvad du konkret skal tilbyde dem</li><li>Hvorfor de skal vælge netop dig</li><li>Hvad du skal tage for det</li>',
     '<li>Who you most want to play for</li><li>Which events you want more of</li><li>Which clients can pay a proper fee</li><li>Exactly what you should offer them</li><li>Why they should choose you specifically</li><li>What you should charge for it</li>'),
    ('<div class="close">Du skal ikke bare have flere jobs. Du skal have flere af <em>de jobs, du rent faktisk ønsker.</em><span class="p">Målet er, at du kan spille for de rigtige mennesker til en pris, der gør det muligt at bygge et godt liv omkring din musik.</span></div>',
     '<div class="close">You don\'t just need more gigs. You need more of <em>the gigs you actually want.</em><span class="p">The goal is for you to play for the right people at a price that lets you build a good life around your music.</span></div>'),
    ('<div class="num">Del 2 af 5</div><h3>Bliv det klare valg<sup>™</sup></h3><p>Derefter gør vi det nemt for de rigtige kunder at forstå, hvorfor de skal vælge dig.</p>',
     '<div class="num">Part 2 of 5</div><h3>Become the Obvious Choice<sup>™</sup></h3><p>Next, we make it easy for the right clients to understand why they should choose you.</p>'),
    ('<p class="h4">Vi hjælper dig med at vise</p><ul class="plain"><li>Hvilken oplevelse du skaber</li><li>Hvilke arrangementer du passer bedst til</li><li>Hvad der gør dig anderledes</li><li>Hvorfor du er pengene værd</li><li>Hvorfor kunden kan føle sig tryg ved at booke dig</li></ul>',
     '<p class="h4">We help you show</p><ul class="plain"><li>The experience you create</li><li>Which events you\'re the best fit for</li><li>What makes you different</li><li>Why you\'re worth the money</li><li>Why the client can feel confident booking you</li></ul>'),
    ('<div class="close">Du skal ikke ligne endnu en musiker på en lang liste. Du skal fremstå som <em>det naturlige valg</em> for den rigtige kunde.<span class="p">Det er sådan, vi ændrer spørgsmålet fra: “Hvad koster du?” Til: “Hvordan får vi dig ud at spille til vores arrangement?”</span></div>',
     '<div class="close">You shouldn\'t look like just another musician on a long list. You should come across as <em>the natural choice</em> for the right client.<span class="p">That\'s how we change the question from “How much do you charge?” to “How do we get you to play at our event?”</span></div>'),
    ('alt="Oscar Jønsson med guitar i det varme studie"', 'alt="Oscar Jønsson with a guitar in the warm-lit studio"'),
    ('<div class="num">Del 3 af 5</div><h3>Videoer, der får dem til at vælge dig<sup>™</sup></h3><p>Når vi ved, hvem du vil bookes af, producerer vi de videoer, der skal vise din værdi.</p>',
     '<div class="num">Part 3 of 5</div><h3>Videos That Get You Chosen<sup>™</sup></h3><p>Once we know who you want to be booked by, we produce the videos that show your value.</p>'),
    ('<p class="h4">Vi filmer dig blandt andet</p><ul class="plain cols"><li>Når du spiller til rigtige arrangementer</li><li>Når publikum reagerer på din musik</li><li>Når du skaber stemning i lokalet</li><li>I professionelle og eksklusive studier</li><li>Med lyd og billeder, der passer til dit niveau</li><li>I videoer lavet til dine sociale medier</li><li>I videoer lavet specielt til annoncer</li></ul>',
     '<p class="h4">Among other things, we film you</p><ul class="plain cols"><li>Playing at real events</li><li>With the audience reacting to your music</li><li>Lifting the atmosphere in the room</li><li>In professional, high-end studios</li><li>With sound and visuals that match your level</li><li>In videos made for your social media</li><li>In videos made specifically for ads</li></ul>'),
    ('<div class="close">Vi filmer ikke bare for at lave flotte videoer. Hver video skal hjælpe kunden med at forstå én ting: <em>“Det er sådan, det vil føles at have denne musiker til vores arrangement.”</em><span class="p">Videoer fra rigtige jobs viser oplevelsen. Studievideoerne viser kvaliteten. Annoncevideoerne får nye kunder til at opdage dig. Tilsammen gør de dit talent lettere at se, forstå og vælge.</span></div>',
     '<div class="close">We don\'t film just to make pretty videos. Every video has to help the client understand one thing: <em>“This is what it will feel like to have this musician at our event.”</em><span class="p">Footage from real gigs shows the experience. Studio videos show the quality. Ad videos get new clients to discover you. Together they make your talent easier to see, understand and choose.</span></div>'),
    ('aria-label="Oscar spiller til et rigtigt arrangement"', 'aria-label="Oscar playing at a real event"'),
    ('<span class="lbl">Job</span>', '<span class="lbl">Gig</span>'),
    ('aria-label="Oscar i studiet"', 'aria-label="Oscar in the studio"'),
    ('aria-label="Annoncevideo med Oscar"></video><span class="lbl">Annonce</span>', 'aria-label="Ad video featuring Oscar"></video><span class="lbl">Ad</span>'),
    ('<div class="num">Del 4 af 5</div><h3>Et system, der skaber henvendelser<sup>™</sup></h3><p>Når videoerne er klar, bygger vi en enkel vej fra fremmed til kunde.</p>',
     '<div class="num">Part 4 of 5</div><h3>The Inquiry Engine<sup>™</sup></h3><p>Once the videos are ready, we build a simple path from stranger to client.</p>'),
    ('<p class="h4">Vi</p><ul class="plain cols"><li>Laver annoncer, som de rigtige mennesker ser</li><li>Bygger en side, der præsenterer dig og din musik</li><li>Gør det tydeligt, hvad du kan bookes til</li><li>Gør det let at sende dig en forespørgsel</li><li>Viser annoncerne igen til personer, der allerede har vist interesse</li><li>Holder øje med, hvad der virker</li><li>Retter annoncerne til, så de løbende bliver bedre</li></ul>',
     '<p class="h4">We</p><ul class="plain cols"><li>Create ads that the right people see</li><li>Build a page that presents you and your music</li><li>Make it clear what you can be booked for</li><li>Make it easy to send you an inquiry</li><li>Retarget people who have already shown interest</li><li>Track what\'s working</li><li>Fine-tune the ads so they keep improving</li></ul>'),
    ('<div class="close">Du skal ikke selv finde ud af, hvilke knapper du skal trykke på. Vi bygger systemet og hjælper med at styre det.<span class="p">Målet er, at du ikke kun skal vente på anbefalinger. Du skal have <em>din egen vej til nye kunder.</em></span></div>',
     '<div class="close">You don\'t need to figure out which buttons to press. We build the system and help you run it.<span class="p">The goal is that you\'re no longer just waiting for referrals. You have <em>your own route to new clients.</em></span></div>'),
    ('<div class="num">Del 5 af 5</div><h3>Fra henvendelse til booket job<sup>™</sup></h3><p>Nye henvendelser er kun værdifulde, hvis de bliver behandlet rigtigt. Derfor hjælper vi også med det, der sker, efter en kunde har vist interesse.</p>',
     '<div class="num">Part 5 of 5</div><h3>From Inquiry to Booked Gig<sup>™</sup></h3><p>New inquiries are only valuable if they\'re handled well. So we also help with what happens after a client shows interest.</p>'),
    ('<p class="h4">Du kan vælge selv at lære</p><ul class="plain"><li>Hvordan du svarer på en ny forespørgsel</li><li>Hvilke spørgsmål du skal stille</li><li>Hvordan du finder kundens behov og budget</li><li>Hvordan du forklarer din værdi</li><li>Hvordan du siger din pris med ro</li><li>Hvordan du følger op</li><li>Hvordan du får kunden til at træffe en beslutning</li></ul>',
     '<p class="h4">You can choose to learn</p><ul class="plain"><li>How to reply to a new inquiry</li><li>Which questions to ask</li><li>How to uncover the client\'s needs and budget</li><li>How to explain your value</li><li>How to state your price with confidence</li><li>How to follow up</li><li>How to help the client make a decision</li></ul>'),
    ('<p class="h4">Hvis du ikke selv ønsker at stå for det, kan vi hjælpe med at finde mennesker, der kan</p><ul class="plain"><li>Kontakte de nye henvendelser</li><li>Aftale samtaler</li><li>Følge op på interesserede kunder</li><li>Hjælpe med at få jobs i kalenderen</li></ul>',
     '<p class="h4">If you\'d rather not handle it yourself, we can help you find people who</p><ul class="plain"><li>Contact new inquiries</li><li>Set up calls</li><li>Follow up with interested clients</li><li>Help get gigs into your calendar</li></ul>'),
    ('>På den måde stopper vores arbejde ikke, når nogen udfylder en formular.</p>', '>That way, our work doesn\'t stop when someone fills in a form.</p>'),
    ('>Vi bygger hele vejen fra</p>', '>We build the whole path, from</p>'),
    ('<li><span>01</span>De opdager dig</li><li><span>02</span>De bliver interesserede</li><li><span>03</span>De kontakter dig</li><li class="on"><span>04</span>De booker dig</li>',
     '<li><span>01</span>They discover you</li><li><span>02</span>They get interested</li><li><span>03</span>They contact you</li><li class="on"><span>04</span>They book you</li>'),
    ('<p class="big">Fem dele. Ét system. Bygget for dig på 90 dage.</p>', '<p class="big">Five parts. One system. Built for you in 90 days.</p>'),
    # promise
    ('<span class="eyebrow">Løftet</span><h2>På 90 dage hjælper vi dig med at:</h2>', '<span class="eyebrow">The promise</span><h2>In 90 days, we help you:</h2>'),
    *[(f'</svg>{a}</div>', f'</svg>{b}</div>') for a, b in [
        ('Vælge de jobs og kunder, du vil gå efter', 'Choose the gigs and clients you want to go after'),
        ('Sætte en pris, der passer til din værdi', 'Set a price that reflects your value'),
        ('Fremstå som det klare valg for de rigtige kunder', 'Stand out as the obvious choice for the right clients'),
        ('Få professionelle videoer, der viser, hvad du kan', 'Get professional videos that show what you can do'),
        ('Få en side, der gør det let at booke dig', 'Get a page that makes booking you easy'),
        ('Få annoncer, der viser dig til nye kunder', 'Get ads that put you in front of new clients'),
        ('Få et system til at behandle og følge op på henvendelser', 'Get a system for handling and following up on inquiries')]],
    ('<span class="tagpill dark">Du møder op, vi klarer resten</span>', '<span class="tagpill dark">You show up. We handle the rest.</span>'),
    ('>Du skal ikke blive ekspert i markedsføring.</p>', '>You don\'t need to become a marketing expert.</p>'),
    ('>Du skal fortsat være ekspert i din musik.</p>', '>You stay the expert in your music.</p>'),
    ('>Vi bygger systemet omkring dit talent.</p>', '>We build the system around your talent.</p>'),
    # future
    ('<span class="eyebrow">Efter de 90 dage</span><h2>Fra tilfældige jobs til en rigtig forretning</h2>', '<span class="eyebrow">After the 90 days</span><h2>From random gigs to a real business</h2>'),
    ('<p class="lead">Forestil dig, at du ikke længere behøver at vågne og tænke:</p>', '<p class="lead">Imagine no longer waking up thinking:</p>'),
    ('<span class="stk">“Mon der kommer noget i næste måned?”</span>', '<span class="stk">“Will anything come in next month?”</span>'),
    ('<p class="h4">Forestil dig i stedet, at du ved</p><ul class="plain"><li>Hvem du vil spille for</li><li>Hvilke jobs du vil have</li><li>Hvad du skal tage for dem</li><li>Hvordan nye kunder opdager dig</li><li>Hvor nye henvendelser kommer fra</li><li>Hvad du skal gøre, når en kunde kontakter dig</li></ul>',
     '<p class="h4">Imagine instead that you know</p><ul class="plain"><li>Who you want to play for</li><li>Which gigs you want</li><li>What to charge for them</li><li>How new clients discover you</li><li>Where new inquiries come from</li><li>What to do when a client gets in touch</li></ul>'),
    ('alt="Oscar Jønsson og sangerinde på stranden"', 'alt="Oscar Jønsson and a singer on the beach"'),
    ('<p class="big">Du er stadig den samme dygtige musiker.</p><p class="lead">Forskellen er, at der nu er bygget en forretning omkring dit talent.</p>',
     '<p class="big">You\'re still the same great musician.</p><p class="lead">The difference is that there\'s now a business built around your talent.</p>'),
    ('<span class="eyebrow">Ved afslutningen af Bliv Booket™ står du med</span>', '<span class="eyebrow">By the end of Bliv Booket™ you\'ll have</span>'),
    *[(f'</span>{a}</div>', f'</span>{b}</div>') for a, b in [
        ('Et klart svar på, hvem du vil spille for', 'A clear answer to who you want to play for'),
        ('En pris, der passer til den oplevelse, du leverer', 'A price that matches the experience you deliver'),
        ('En tydelig grund til, at kunden skal vælge dig', 'A clear reason for clients to choose you'),
        ('Professionelle videoer fra både jobs og studie', 'Professional videos from both gigs and the studio'),
        ('Annoncer, der bliver vist til de rigtige mennesker', 'Ads shown to the right people'),
        ('En side, der kan gøre interesse til henvendelser', 'A page that turns interest into inquiries'),
        ('En fast måde at følge op og få jobs i kalenderen på', 'A reliable way to follow up and get gigs in the calendar'),
        ('Mere kontrol over, hvor dine næste bookinger kommer fra', 'More control over where your next bookings come from')]],
    ('<p class="big">Målet er ikke bare at gøre dig mere synlig.</p><p class="lead">Målet er at gøre det lettere for de rigtige mennesker at opdage dig, ønske dig og booke dig.</p>',
     '<p class="big">The goal isn\'t just to make you more visible.</p><p class="lead">It\'s to make it easier for the right people to discover you, want you and book you.</p>'),
    # final
    ('<h2 class="rv">Du mangler ikke talent. Du mangler <em>et fast system,</em> der hjælper de rigtige mennesker med at se det.</h2>',
     '<h2 class="rv">You don\'t lack talent. You lack <em>a reliable system</em> that helps the right people see it.</h2>'),
    ('<p class="rv" data-d="2">Du har brugt årevis på at blive god nok til at leve af din musik. Nu bygger vi systemet, der hjælper dig med faktisk at gøre det.</p>',
     '<p class="rv" data-d="2">You\'ve spent years getting good enough to make a living from your music. Now we build the system that helps you actually do it.</p>'),
    ('Bliv Booket™ · Et 90-dages <span class="nw">gjort-for-dig-system</span> for musikere, DJs og bands · Du møder op, vi sørger for alt',
     'Bliv Booket™ · A 90-day <span class="nw">done-for-you system</span> for musicians, DJs and bands · You show up, we take care of everything'),
    # booking modal
    ('<b id="bkTitle">Book din samtale</b><span>Ansøg om en plads · 1 time · online</span>', '<b id="bkTitle">Book your call</b><span>Apply for a spot · 1 hour · online</span>'),
    ('aria-label="Luk"', 'aria-label="Close"'),
    ('<div class="bk-load"><i></i>Henter ledige tider</div>', '<div class="bk-load"><i></i>Loading available times</div>'),
    ('title="Book din samtale"', 'title="Book your call"'),
    ('<div class="bk-foot"><span><b>Ingen binding.</b> Samtalen er gratis og uforpligtende.</span><span>Du får en kalender-invitation på mail med det samme.</span></div>',
     '<div class="bk-foot"><span><b>No strings attached.</b> The call is free and there\'s no obligation.</span><span>The booking form is in Danish: just pick a time and add your details. Your calendar invite arrives by email right away.</span></div>'),
    # scripts (body)
    ("const msgs=['Bryllup · Aarhus · 120 gæster','Firmafest · København · 300 gæster','Sommerfest · Odense · 80 gæster','Jubilæum · Aalborg · 150 gæster','Bryllup · Skagen · 90 gæster']",
     "const msgs=['Wedding · Aarhus · 120 guests','Corporate party · Copenhagen · 300 guests','Summer party · Odense · 80 guests','Anniversary · Aalborg · 150 guests','Wedding · Skagen · 90 guests']"),
    ("const fmt=n=>n.toLocaleString('da-DK');", "const fmt=n=>n.toLocaleString('en-US');"),
    ("f.title='Bliv Booket: se videoen'", "f.title='Bliv Booket: watch the video'"),
    ("toLocaleDateString('da-DK',{day:'numeric',month:'long',year:'numeric'})", "toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})"),
    ("const stages=['Ser dig','Interesseret','Skriver','Booker'];", "const stages=['Sees you','Interested','Gets in touch','Books'];"),
    ("label(ctx,th,'Kalender',", "label(ctx,th,'Calendar',"),
    ("label(ctx,th,d.stack.length+' booket',", "label(ctx,th,d.stack.length+' booked',"),
    ("ctx.measureText('BLIV BOOKET-SYSTEMET™')", "ctx.measureText('BLIV BOOKET SYSTEM™')"),
    ("label(ctx,th,'Uden system',", "label(ctx,th,'No system',"),
    ("label(ctx,th,'Tilfældigt',", "label(ctx,th,'Random',"),
    ("ctx.measureText('FORUDSIGELIGT')", "ctx.measureText('PREDICTABLE')"),
    ("'Med systemet':'Bliv Booket-systemet™'", "'With the system':'Bliv Booket System™'"),
    ("label(ctx,th,'Forudsigeligt',", "label(ctx,th,'Predictable',"),
    ("label(ctx,th,'Bliv Booket-systemet™',", "label(ctx,th,'Bliv Booket System™',"),
    ("const months=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];", "const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];"),
    ("label(ctx,th,'tom',", "label(ctx,th,'empty',"),
    ("label(ctx,th,total+' jobs',", "label(ctx,th,total+' gigs',"),
    ("label(ctx,th,'Billigst',", "label(ctx,th,'Cheapest',"),
    ("label(ctx,th,'Dyrest',", "label(ctx,th,'Priciest',"),
    ("txt='Kunden kigger'", "txt='Client browsing'"),
    ("txt='Vælger den billigste'", "txt='Picks the cheapest'"),
    ("txt='Leder efter dig'", "txt='Looking for you'"),
    ("label(ctx,th,'Dig',", "label(ctx,th,'You',"),
    ("const names=['Instagram','Hjemmeside','Videoer','Tidligere kunder','Anmeldelser','En annonce'];", "const names=['Instagram','Website','Videos','Past clients','Reviews','One ad'];"),
    ("label(ctx,th,'Ingen vej videre',", "label(ctx,th,'No way forward',"),
    ("const names=['Annonce','Din side','Forespørgsel','Opfølgning','Booket'];", "const names=['Ad','Your page','Inquiry','Follow-up','Booked'];"),
    ("label(ctx,th,'Vises igen',", "label(ctx,th,'Retargeted',"),
    ("const kt=d.stack.length+' i kalenderen';", "const kt=d.stack.length+' in calendar';"),
    ("label(ctx,th,'Sidste nummer',", "label(ctx,th,'Last song',"),
]

# ───────────────────────── Tak-siden (tak.html) ─────────────────────────
TAK = REVIEWS + FOOTER + [
    ('<title>Tak · Bliv Booket · Kul & sølv · Cormorant + Manrope</title>', '<title>Thank you · Bliv Booket</title>'),
    ('<a class="btn ghost" href="index.html">Til forsiden</a>', '<a class="btn ghost" href="/en/">Back to home</a>'),
    ('<h1>Din samtale er booket, <em id="tyName">og du har taget første skridt.</em></h1>', '<h1>Your call is booked, <em id="tyName">and you\'ve taken the first step.</em></h1>'),
    ('<p class="lead">Du får en bekræftelse og en kalender-invitation på mail inden for et minut. <b>Det vigtigste nu:</b> accepter invitationen, så samtalen ligger fast i din kalender.</p>',
     '<p class="lead">You\'ll get a confirmation and a calendar invite by email within a minute. <b>Most important right now:</b> accept the invite so the call is locked into your calendar.</p>'),
    ('<span class="tagpill">Gratis · 1 time · online</span>', '<span class="tagpill">Free · 1 hour · online</span>'),
    ('<span class="k">Din samtale</span>', '<span class="k">Your call</span>'),
    ('<b id="whenText">Tidspunktet står i din mail</b>', '<b id="whenText">The time is in your email</b>'),
    ('<span>dage</span>', '<span>days</span>'),
    ('<span>timer</span>', '<span>hours</span>'),
    ('text=Samtale%20med%20Bliv%20Booket&details=Din%20samtale%20med%20Oscar%20fra%20Bliv%20Booket.%20Link%20til%20m%C3%B8det%20st%C3%A5r%20i%20din%20bekr%C3%A6ftelsesmail.',
     'text=Call%20with%20Bliv%20Booket&details=Your%20call%20with%20Oscar%20from%20Bliv%20Booket.%20The%20meeting%20link%20is%20in%20your%20confirmation%20email.'),
    ('Tilføj til Google Kalender</a>', 'Add to Google Calendar</a>'),
    ('download="bliv-booket-samtale.ics"', 'download="bliv-booket-call.ics"'),
    ('<small>Accepter også invitationen i mailen. Så får vi besked om, at du kommer, og du får påmindelser 24 timer og 1 time før.</small>',
     '<small>Please also accept the invite in the email. That tells us you\'re coming, and you\'ll get reminders 24 hours and 1 hour before.</small>'),
    ('<span class="eyebrow">Næste skridt</span><h2>Tre ting, der sikrer, at du får mest ud af samtalen</h2>', '<span class="eyebrow">Next steps</span><h2>Three things that make sure you get the most out of the call</h2>'),
    ('<span class="n">01 · Vigtigst</span><b>Accepter kalender-invitationen</b><p>Åbn mailen fra Bliv Booket og tryk "Ja" på invitationen. Tjek spam eller Kampagner-fanen, hvis den ikke er i indbakken.</p>',
     '<span class="n">01 · Most important</span><b>Accept the calendar invite</b><p>Open the email from Bliv Booket and click "Yes" on the invite. Check your spam or Promotions tab if it\'s not in your inbox.</p>'),
    ('<b>Sæt en time af, uforstyrret</b><p>Vær ved en computer med kamera og rolig baggrund. Link til mødet står i mailen. Samtalen holdes online.</p>',
     '<b>Block out an hour, undisturbed</b><p>Be at a computer with a camera and a quiet background. The meeting link is in the email. The call takes place online.</p>'),
    ('<b>Kan du ikke nå det, så ombook</b><p>Brug ombook-linket i mailen i stedet for at udeblive. Så holder vi pladsen til en anden musiker, og du får en ny tid.</p>',
     '<b>Can\'t make it? Reschedule</b><p>Use the reschedule link in the email rather than not showing up. That way we can offer the slot to another musician, and you get a new time.</p>'),
    ('<span class="eyebrow">Forbered dig på 5 minutter</span>', '<span class="eyebrow">Prepare in 5 minutes</span>'),
    ('<h2>Det taler vi om på samtalen</h2>', '<h2>What we\'ll talk about on the call</h2>'),
    ('<p class="lead">Samtalen handler om dig og din kalender. Jo mere konkret du er, jo mere kan vi give dig tilbage. Tænk over:</p>',
     '<p class="lead">The call is about you and your calendar. The more specific you are, the more we can give you back. Think about:</p>'),
    ('<li>Hvilke jobs vil du have flere af? Bryllupper, firmafester, større arrangementer?</li>', '<li>Which gigs do you want more of? Weddings, corporate parties, large events?</li>'),
    ('<li>Hvad tager du for et gig i dag, og hvad vil du gerne tage?</li>', '<li>What do you charge for a gig today, and what would you like to charge?</li>'),
    ('<li>Hvor kommer dine bookinger fra lige nu? Anbefalinger, bookingsider, sociale medier?</li>', '<li>Where do your bookings come from right now? Referrals, booking sites, social media?</li>'),
    ('<li>Hvor mange gigs om måneden vil du helst have?</li>', '<li>How many gigs a month would you ideally like?</li>'),
    ('<li>Hvad har du prøvet før, og hvad virkede ikke?</li>', '<li>What have you tried before, and what didn\'t work?</li>'),
    ('<p class="h4">Sådan foregår samtalen</p><ul class="plain"><li>Vi gennemgår din situation og dine mål</li><li>Vi ser på, hvad der holder din kalender tilbage</li><li>Vi vurderer sammen, om Bliv Booket passer til dig</li><li>Passer det, får du en plan for de 90 dage</li></ul>',
     '<p class="h4">How the call works</p><ul class="plain"><li>We go through your situation and your goals</li><li>We look at what\'s holding your calendar back</li><li>Together we assess whether Bliv Booket is right for you</li><li>If it is, you get a plan for the 90 days</li></ul>'),
    ('<span>Ingen forpligtelse. Det er en samtale, ikke et salgsmøde.</span>', '<span>No obligation. It\'s a conversation, not a sales pitch.</span>'),
    ('<span>Vi tager kun musikere ind, vi tror på, vi kan fylde kalenderen for.</span>', '<span>We only take on musicians whose calendars we believe we can fill.</span>'),
    ('<span class="eyebrow">Ofte stillede spørgsmål</span><h2>Det spørger musikere os om før samtalen</h2>', '<span class="eyebrow">Frequently asked questions</span><h2>What musicians ask us before the call</h2>'),
    ('<summary>Hvad er Bliv Booket helt kort?<i></i></summary><div class="a">Et 90-dages <span class="nw">gjort-for-dig-system</span>. Vi finder de rigtige kunder, viser hvorfor de skal vælge dig, producerer videoer, kører annoncer, bygger din side og hjælper med at få henvendelser til at blive bookinger. Du møder op til de gigs, vi booker ind til dig.</div>',
     '<summary>What is Bliv Booket, in short?<i></i></summary><div class="a">A 90-day <span class="nw">done-for-you system</span>. We find the right clients, show them why they should choose you, produce videos, run ads, build your page and help turn inquiries into bookings. You show up to the gigs we book for you.</div>'),
    ('<summary>Hvem passer forløbet til?<i></i></summary><div class="a">Professionelle musikere, DJs og bands, der allerede leverer en god oplevelse, men mangler et fast system til at få nye kunder. Det passer ikke til dig, hvis du kun spiller for sjov eller ikke vil ud og spille mere.</div>',
     '<summary>Who is the program for?<i></i></summary><div class="a">Professional musicians, DJs and bands who already deliver a great experience but lack a reliable system for winning new clients. It\'s not for you if you only play for fun or don\'t want to play more gigs.</div>'),
    ('<summary>Hvad sker der på samtalen?<i></i></summary><div class="a">Vi taler om din situation, dine ønskede jobs og priser, og hvor dine bookinger kommer fra i dag. Derefter vurderer vi sammen, om forløbet giver mening for dig. Passer det, får du en konkret plan og svar på alt om investeringen.</div>',
     '<summary>What happens on the call?<i></i></summary><div class="a">We talk about your situation, the gigs and fees you\'re aiming for, and where your bookings come from today. Then we decide together whether the program makes sense for you. If it does, you get a concrete plan and answers to everything about the investment.</div>'),
    ('<summary>Skal jeg forberede noget?<i></i></summary><div class="a">Kun de fem punkter ovenfor. Har du tal på dine gigs og priser, er det en fordel, men ikke et krav.</div>',
     '<summary>Do I need to prepare anything?<i></i></summary><div class="a">Just the five points above. Numbers on your gigs and fees are a plus, but not a requirement.</div>'),
    ('<summary>Hvad koster det?<i></i></summary><div class="a">Investeringen afhænger af, hvad vi skal bygge for dig, og gennemgås åbent på samtalen. Til sammenligning koster det vores kunder i gennemsnit 1.000 kr i annoncer at få et gig i hus, og et gig ligger i gennemsnit på 30.000 kr.</div>',
     '<summary>What does it cost?<i></i></summary><div class="a">The investment depends on what we need to build for you, and we go through it openly on the call. For comparison, our clients spend on average DKK 1,000 in ads to land a gig, and the average gig pays DKK 14,700.</div>'),
    ('<summary>Skal jeg selv lære annoncering eller lave hjemmeside?<i></i></summary><div class="a">Nej. Det er hele pointen. Vi bygger og styrer systemet. Du skal fortsat være ekspert i din musik.</div>',
     '<summary>Do I have to learn advertising or build a website myself?<i></i></summary><div class="a">No. That\'s the whole point. We build and run the system. You stay the expert in your music.</div>'),
    ('<summary>Hvor lang tid tager det, før jeg ser bookinger?<i></i></summary><div class="a">Forløbet er 90 dage. De første uger går med at finde de rigtige jobs og producere videoer, derefter kører annoncerne, og henvendelserne begynder at komme ind.</div>',
     '<summary>How long before I see bookings?<i></i></summary><div class="a">The program runs for 90 days. The first weeks go into defining the right gigs and producing videos; then the ads go live and inquiries start coming in.</div>'),
    ('<summary>Hvad hvis jeg ikke kan nå samtalen?<i></i></summary><div class="a">Brug ombook-linket i din bekræftelsesmail, så finder vi en ny tid. Udebliver du uden at give besked, går pladsen til en anden musiker.</div>',
     '<summary>What if I can\'t make the call?<i></i></summary><div class="a">Use the reschedule link in your confirmation email and we\'ll find a new time. If you don\'t show up without letting us know, the spot goes to another musician.</div>'),
    ('<summary>Hvor foregår samtalen?<i></i></summary><div class="a">Online. Link til mødet står i din bekræftelsesmail og i kalender-invitationen. Brug gerne en computer, det gør det lettere at vise dig ting undervejs.</div>',
     '<summary>Where does the call take place?<i></i></summary><div class="a">Online. The meeting link is in your confirmation email and the calendar invite. A computer works best, as it makes it easier for us to show you things along the way.</div>'),
    ('<span class="eyebrow">Anmeldelser fra Trustpilot</span><h2>Imens du venter: det siger kunderne, der har booket Oscar</h2><p class="lead">Systemet, du får på samtalen, er det samme, Oscar bruger i sin egen musikforretning. Her er, hvad hans kunder siger.</p>',
     '<span class="eyebrow">Reviews from Trustpilot</span><h2>While you wait: what clients say after booking Oscar</h2><p class="lead">The system you\'ll hear about on the call is the same one Oscar uses in his own music business. Here\'s what his clients say (reviews translated from Danish).</p>'),
    ('<span class="tagpill dark">Vi ses til samtalen</span>', '<span class="tagpill dark">See you on the call</span>'),
    ('<h2>Du mangler ikke talent. <em>Nu bygger vi systemet,</em> der hjælper de rigtige mennesker med at se det.</h2>', '<h2>You don\'t lack talent. <em>Now we build the system</em> that helps the right people see it.</h2>'),
    ('<p>Har du spørgsmål inden da, så svar på bekræftelsesmailen. Vi læser alt.</p>', '<p>Questions before then? Just reply to the confirmation email. We read everything.</p>'),
    ('Alle anmeldelser kan ses på <a', 'See all reviews on <a'),
    # scripts
    ("start.toLocaleDateString('da-DK',{weekday:'long',day:'numeric',month:'long'})+' kl. '+start.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})",
     "start.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+' at '+start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})"),
    ("'PRODID:-//Bliv Booket//DA'", "'PRODID:-//Bliv Booket//EN'"),
    ("'SUMMARY:Samtale med Bliv Booket','DESCRIPTION:Din samtale med Oscar fra Bliv Booket. Link til mødet står i din bekræftelsesmail.'",
     "'SUMMARY:Call with Bliv Booket','DESCRIPTION:Your call with Oscar from Bliv Booket. The meeting link is in your confirmation email.'"),
    ("'DESCRIPTION:Samtale med Bliv Booket om 1 time'", "'DESCRIPTION:Call with Bliv Booket in 1 hour'"),
    ("alert('Åbn kalender-invitationen i din mail og tryk Accepter. Så lander samtalen automatisk i din kalender.')",
     "alert('Open the calendar invite in your email and click Accept. The call will then appear in your calendar automatically.')"),
]

# ───────────────────────── Onboarding (gen_onboarding.py-output) ─────────────────────────
ONBOARDING = FOOTER + [
    ('<title>Onboarding · Bliv Booket</title>', '<title>Onboarding · Bliv Booket</title>'),
    ('<a class="logo" href="/"', '<a class="logo" href="/en/"'),
    ('title="Fuldt Booket Musiker - Onboarding Form"></iframe>', 'title="Onboarding form"></iframe>'),
    ('<h1>Velkommen om bord. <em>Nu går vi i gang.</em></h1>', '<h1>Welcome aboard. <em>Let\'s get started.</em></h1>'),
    ('<p class="lead">Udfyld formularen herunder, så har vi alle de informationer, vi skal bruge for at komme i gang med dig.</p>',
     '<p class="lead">Fill in the form below so we have everything we need to get started with you. (The form itself is in Danish; feel free to answer in English.)</p>'),
]

# ───────────────────────── Privatlivspolitik (privatliv.html) ─────────────────────────
PRIVACY = [
    ('<title>Privatlivspolitik · Oscar Jønsson Musik</title>', '<title>Privacy policy · Oscar Jønsson Musik</title>'),
    ('<meta name="description" content="Sådan behandler Oscar Jønsson Musik de oplysninger, du sender, når du beder om et tilbud på musik.">',
     '<meta name="description" content="How Oscar Jønsson Musik handles the information you send when you request a quote for music.">'),
    ('← Tilbage</a>', '← Back</a>'),
    ('<h1>Privatlivspolitik</h1>', '<h1>Privacy policy</h1>'),
    ('<p>Her kan du læse, hvilke oplysninger vi gemmer, når du beder om et tilbud på musik til en fest, og hvad vi bruger dem til.</p>',
     '<p>This page explains what information we store when you request a quote for music for an event, and what we use it for. The Danish version is the legally binding one.</p>'),
    ('<b>Dataansvarlig</b>', '<b>Data controller</b>'),
    ('CVR 43415352', 'Danish CVR no. 43415352'),
    ('<h2>Hvad vi gemmer</h2>', '<h2>What we store</h2>'),
    ('<p>Når du udfylder formularen, gemmer vi de svar, du giver undervejs, også før du trykker færdig:</p>',
     '<p>When you fill in the form, we store the answers you give along the way, including before you press submit:</p>'),
    ('<li>Dato, sted, cirka antal gæster og hvilken musik I ønsker</li>', '<li>Date, venue, approximate number of guests and the music you\'d like</li>'),
    ('<li>Navn, e-mail, telefonnummer og eventuelt firmanavn</li>', '<li>Name, email, phone number and company name, if any</li>'),
    ('<li>Det tidspunkt, du vælger til en samtale</li>', '<li>The time you choose for a call</li>'),
    ('<p>Vi registrerer også, hvordan siden bliver brugt (fx hvilke sektioner der bliver set, og hvilken enhed og by besøget kommer fra), så vi kan gøre siden bedre.</p>',
     '<p>We also record how the site is used (for example which sections are viewed, and which device and city a visit comes from) so we can improve it.</p>'),
    ('<h2>Hvorfor</h2>', '<h2>Why</h2>'),
    ('<p>Vi bruger oplysningerne til at give dig et tilbud, ringe eller skrive til dig om musikken og holde den samtale, du har booket. Grundlaget er, at du selv har bedt om et tilbud (databeskyttelsesforordningen artikel 6, stk. 1, litra b). Statistikken om brugen af siden er vores legitime interesse i at forbedre den (litra f).</p>',
     '<p>We use the information to send you a quote, call or write to you about the music, and hold the call you have booked. The legal basis is that you asked us for a quote (GDPR Article 6(1)(b)). Statistics about how the site is used are based on our legitimate interest in improving it (Article 6(1)(f)).</p>'),
    ('<h2>Hvem der behandler dem for os</h2>', '<h2>Who processes it on our behalf</h2>'),
    ('<li>Cloudflare: drift af hjemmesiden og databasen</li>', '<li>Cloudflare: hosting of the website and database</li>'),
    ('<li>Vores kundesystem (GoHighLevel): kontaktoplysninger og din booking</li>', '<li>Our CRM (GoHighLevel): contact details and your booking</li>'),
    ('<li>Telegram: intern besked til os om, at der er kommet en ny forespørgsel</li>', '<li>Telegram: an internal notification to us that a new request has come in</li>'),
    ('<li>Meta (Facebook og Instagram): måling af annoncer, hvis du er kommet ind via en annonce</li>', '<li>Meta (Facebook and Instagram): ad measurement, if you arrived via an ad</li>'),
    ('<p>Vi sælger aldrig dine oplysninger og bruger dem ikke til andet end ovenstående.</p>', '<p>We never sell your information and don\'t use it for anything other than the above.</p>'),
    ('<h2>Hvor længe</h2>', '<h2>How long</h2>'),
    ('<p>Vi gemmer oplysningerne, så længe de er nødvendige for at give dig et tilbud og holde kontakten om jeres fest. Bliver det til en aftale, gemmer vi dem, så længe bogføringsloven kræver det. Du kan til enhver tid bede os slette dem.</p>',
     '<p>We keep the information for as long as it\'s needed to give you a quote and stay in touch about your event. If it becomes a booking, we keep it for as long as Danish bookkeeping law requires. You can ask us to delete it at any time.</p>'),
    ('<h2>Dine rettigheder</h2>', '<h2>Your rights</h2>'),
    ('<p>Du kan altid bede om at se, rette eller slette dine oplysninger. Skriv til', '<p>You can always ask to see, correct or delete your information. Email'),
    ('. Er du utilfreds med vores behandling, kan du klage til <a href="https://www.datatilsynet.dk" target="_blank" rel="noopener">Datatilsynet</a>.</p>',
     '. If you\'re unhappy with how we handle your data, you can complain to the Danish Data Protection Agency (<a href="https://www.datatilsynet.dk/english" target="_blank" rel="noopener">Datatilsynet</a>).</p>'),
    ('Senest opdateret 13. oktober 2026.', 'Last updated 13 October 2026.'),
]

TABLES = {'index.html': INDEX, 'tak.html': TAK, 'onboarding.html': ONBOARDING, 'privatliv.html': PRIVACY}

# ───────────────────────── fælles: hreflang, sprogskifter, bk_lang ─────────────────────────
SWITCH_CSS = ('<style>.lang-sw{display:inline-flex;align-items:center;gap:2px;margin-left:auto;margin-right:clamp(8px,1.4vw,16px);'
              'font-family:var(--mono,ui-monospace,monospace);font-size:.7rem;letter-spacing:.12em;min-height:44px}'
              '.lang-sw a,.lang-sw span{padding:6px 5px;color:var(--ink3,#888);text-decoration:none;border-radius:6px}'
              '.lang-sw [aria-current]{color:var(--ink,#eee);font-weight:600}.lang-sw a:hover{color:var(--ink,#eee)}'
              '.lang-sw i{opacity:.4;font-style:normal}'
              # smal mobil: kun det andet sprog + ingen pil i nav-knappen, så logo | EN | CTA kan være der
              '@media (max-width:480px){.lang-sw{padding-left:8px;margin-right:6px}.lang-sw [aria-current],.lang-sw i{display:none}.nav .lang-sw~.btn .ar{display:none}}'
              '.kpi b .cur{font-size:.42em;letter-spacing:.06em;vertical-align:.55em;margin-right:.08em;opacity:.75}</style>\n')


def switch_html(lang, da_url, en_url):
    da = '<span aria-current="true" lang="da">DA</span>' if lang == 'da' else f'<a href="{da_url}" hreflang="da" lang="da" data-lang="da" title="Dansk">DA</a>'
    en = '<span aria-current="true" lang="en">EN</span>' if lang == 'en' else f'<a href="{en_url}" hreflang="en" lang="en" data-lang="en" title="English">EN</a>'
    # klik på skifteren husker valget (bruges af /tak-viderestillingen) og tager query med (utm, name/start på /tak)
    return (f'<nav class="lang-sw" aria-label="{"Sprog" if lang == "da" else "Language"}">{da}<i>/</i>{en}</nav>'
            '<script>document.currentScript.previousElementSibling.addEventListener("click",function(e){var a=e.target.closest("a[data-lang]");'
            'if(!a)return;try{localStorage.setItem("bk_lang",a.dataset.lang)}catch(_){}a.href=a.getAttribute("href")+location.search});</script>')


def hreflang(da_url, en_url):
    return (f'<link rel="alternate" hreflang="da" href="{DOMAIN}{da_url}">'
            f'<link rel="alternate" hreflang="en" href="{DOMAIN}{en_url}">'
            f'<link rel="alternate" hreflang="x-default" href="{DOMAIN}{da_url}">')


def add_common(s, lang, da_url, en_url, remember_lang):
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + hreflang(da_url, en_url), 1)
    if remember_lang:  # landingssiden husker sproget (bruges når GHL sender til /tak)
        s = s.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<script>try{{localStorage.setItem("bk_lang","{lang}")}}catch(e){{}}</script>', 1)
    sw = switch_html(lang, da_url, en_url)
    m = re.search(r'<header class="nav" id="nav"><div class="wrap">.*?</div></header>', s, re.S)
    if m:
        block = m.group(0)
        i = block.find('<a class="btn')
        block = block[:i] + sw + block[i:] if i >= 0 else block.replace('</div></header>', sw + '</div></header>')
        s = s[:m.start()] + SWITCH_CSS + block + s[m.end():]
    elif '<a class="back"' in s:  # privatlivspolitikken: ingen nav, skifter øverst til højre
        s = s.replace('<a class="back"', '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'
                      '<a class="back"', 1)
        s = re.sub(r'(<a class="back"[^>]*>.*?</a>)', lambda mm: mm.group(1) + sw.replace('class="lang-sw"', 'class="lang-sw" style="margin:0"') + '</div>', s, count=1)
        s = s.replace('</style>', SWITCH_CSS.replace('<style>', '').replace('</style>\n', '') + '</style>', 1)
    else:
        raise SystemExit(f'gen_en: fandt ikke nav/tilbage-link til sprogskifter ({da_url})')
    return s


# Dansk /tak: kom besøgende fra /en/, så send videre til /en/tak FØR GTM/pixel/track.js kører.
# <plaintext> stopper resten af dokumentet, så der ikke fyres dansk PageView/Lead først.
TAK_REDIRECT = ('<script>try{if(localStorage.getItem("bk_lang")==="en"&&!/[?&]lang=da\\b/.test(location.search)){'
                'location.replace("/en/tak"+location.search+location.hash);document.write("<plaintext style=display:none>")}}catch(e){}</script>')


def flex(key):
    """Dansk nøgle -> regex, hvor enhver whitespace matcher \\s+ (robust mod linjeskift/dobbelte mellemrum)."""
    parts = re.split(r'\s+', key.strip())
    lead = r'\s+' if key[:1].isspace() else ''
    trail = r'\s+' if key[-1:].isspace() else ''
    return re.compile(lead + r'\s+'.join(re.escape(p) for p in parts) + trail)


def translate(s, table, name, missing):
    for da, en in sorted(table, key=lambda p: -len(p[0])):
        pat = flex(da)
        s, n = pat.subn(lambda _m, en=en: en, s)
        if n == 0:
            missing.append((name, da[:90]))
    return s


DANISH = re.compile(r'\b(og|ikke|dig|din|dine|jeg|på|af|som|når|også|eller|hvad|hvor|hvordan|skal|bliver|kunder|samtale|musiker|musikere|tak|forside|ansøg|booke dig)\b', re.I)
ALLOWED = re.compile(r'Jønsson|Sønderup|Møller|Vigsø|Tømrerfirma|Datatilsynet|Bliv Booket|oscartjoensson|fuldtbooketmusiker|Oscar Jønsson Musik|Joensson Agency v/|lang="da"|hreflang="da"|Dansk|DA<|Aarhus|København|Copenhagen')


def visible_text(html):
    t = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html, flags=re.S)
    t = re.sub(r'<!--.*?-->', ' ', t, flags=re.S)
    attrs = ' '.join(re.findall(r'(?:alt|aria-label|title|content|placeholder)="([^"]*)"', t))
    t = re.sub(r'<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', t + ' ' + attrs)


def main():
    (SITE / 'en').mkdir(exist_ok=True)
    missing, leftovers = [], []
    for da_file, da_url, en_file, en_url in PAGES:
        src = (SITE / da_file).read_text(encoding='utf-8')
        # engelsk
        en = translate(src, TABLES[da_file], da_file, missing)
        en = en.replace('<html lang="da">', '<html lang="en">', 1)
        en = re.sub(r'''(["'(])media/''', r'\1/media/', en)   # /en/ ligger en mappe dybere
        en = en.replace('href="index.html"', 'href="/en/"')
        en = add_common(en, 'en', da_url, en_url, remember_lang=(da_file == 'index.html'))
        (SITE / en_file).write_text(en, encoding='utf-8')
        # dansk: samme hreflang + skifter (+ /tak-viderestilling)
        da = add_common(src, 'da', da_url, en_url, remember_lang=(da_file == 'index.html'))
        if da_file == 'tak.html':
            da = da.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + TAK_REDIRECT, 1)
        (SITE / da_file).write_text(da, encoding='utf-8')
        # tjek for dansk tekst, der er sluppet igennem
        txt = ALLOWED.sub(' ', visible_text(en))
        hits = sorted(set(m.group(0).lower() for m in DANISH.finditer(txt)))
        hits += sorted(set(re.findall(r'\w*[æøåÆØÅ]\w*', txt)))
        if hits:
            leftovers.append((en_file, hits))
    if missing:
        print('gen_en: FØLGENDE DANSKE TEKSTER FINDES IKKE LÆNGERE (ret nøglerne i gen_en.py):', file=sys.stderr)
        for f, k in missing:
            print(f'  {f}: {k!r}', file=sys.stderr)
    if leftovers:
        print('gen_en: mulig dansk tekst tilbage på engelske sider:', file=sys.stderr)
        for f, h in leftovers:
            print(f'  {f}: {h}', file=sys.stderr)
    if (missing or leftovers) and os.environ.get('EN_ALLOW_MISSING') != '1':
        raise SystemExit('gen_en: stoppet (EN_ALLOW_MISSING=1 for at bygge alligevel)')
    print('gen_en: /en bygget:', ', '.join(p[3] for p in PAGES))


if __name__ == '__main__':
    main()
