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
# Live-version vælges i LIVE i gen_events.py (firmafest = A/messing, bryllup = B/champagne fra 8/10 2026). Oversigt: /ev/
python3 gen_events.py >/dev/null && cp -r ev _site/ev && rm -f _site/ev/_live-*.html && cp ev/_live-firmafest.html _site/firmafest.html && cp ev/_live-bryllup.html _site/bryllup.html && cp ev.js _site/ev.js
cp _headers _site/_headers
# Kevin-HLS (ny version 9/10 2026, 17 min) er for stor til git; ligger lokalt i ~/bliv-booket-cf/public/media/kevin2 (ny sti = ingen gammel cache)
K=~/bliv-booket-cf/public/media/kevin2; if [ -d "$K" ]; then cp -r "$K" _site/media/kevin2; else echo "ADVARSEL: $K mangler, Kevin-video bliver 404"; fi
echo "_site bygget: $(ls _site | tr '\n' ' ')"
