#!/bin/sh
# Bygger _site/ til fuldtbooketmusiker.dk (kul & sølv-temaet). Kør gen_themes.py først.
set -e
cd "$(dirname "$0")"
rm -rf _site && mkdir _site && cp -r media _site/
sed 's#<title>Bliv Booket · Kul & sølv · Cormorant + Manrope</title>#<title>Bliv Booket</title>#' charcoal-silver.html > _site/index.html
cp tak-charcoal-silver.html _site/tak.html
python3 gen_onboarding.py >/dev/null && mv onboarding.html _site/onboarding.html
cp track.js _site/track.js
# Oscars gig-sider (gen_events.py): valgt retning -> /firmafest + /bryllup, alle retninger som preview i /ev/
# Live-version vælges i LIVE i gen_events.py (fra 21/10 2026: v2 i champagne, firmafest = A, bryllup = B). Oversigt: /ev/
python3 gen_events.py >/dev/null && cp -r ev _site/ev && rm -f _site/ev/_live-*.html && cp ev/_live-firmafest.html _site/firmafest.html && cp ev/_live-bryllup.html _site/bryllup.html && cp ev/_tak-bryllup.html _site/tak-bryllup.html && cp ev/_tak-firmafest.html _site/tak-firmafest.html && rm -f _site/ev/_tak-*.html && cp ev.js _site/ev.js
cp privatliv.html _site/privatliv.html   # linkes fra footeren på v2-siderne
# ny ansøgningsform (4/11 2026): /new-form-setup = samme form uden annonce-tracking (til test)
cp fbm-form.js _site/fbm-form.js && python3 gen_newform.py >/dev/null
# LIVE fra 4/11 2026 (Oskars ordre): forsiden bruger ansøgningsformen i stedet for GHL-kalender-pop-up'en. Slå fra ved at fjerne linjen.
python3 gen_newform.py --live >/dev/null
# ENGELSK version (8/11 2026): /international (+ /international/thanks og /confirmed). Kilde: international.html + tak-international.html
mkdir -p _site/international && cp international.html _site/international/index.html && cp tak-international.html _site/international/thanks.html && perl -pi -e 's#(["\x27(])media/#$1/media/#g' _site/international/index.html _site/international/thanks.html && python3 gen_newform.py --intl >/dev/null
cp _headers _site/_headers
# Kevin-HLS (ny version 9/10 2026, 17 min) er for stor til git; ligger lokalt i ~/bliv-booket-cf/public/media/kevin2 (ny sti = ingen gammel cache)
K=~/bliv-booket-cf/public/media/kevin2; if [ -d "$K" ]; then cp -r "$K" _site/media/kevin2; else echo "ADVARSEL: $K mangler, Kevin-video bliver 404"; fi
# VSL selvhostet til den engelske side (8/11 2026, før lå den kun på Tella): HLS + en.vtt i ~/bliv-booket-cf/public/media/vsl1 (ikke i git)
V=~/bliv-booket-cf/public/media/vsl1; if [ -d "$V" ]; then cp -r "$V" _site/media/vsl1; else echo "ADVARSEL: $V mangler, engelsk VSL bliver 404"; fi
# /en (gen_en.py, anden session 8/11) er erstattet af /international (engelsk ansøgningsform + GHL); Workeren sender /en/* videre dertil. gen_en.py køres ikke.
echo "_site bygget: $(ls _site | tr '\n' ' ')"
