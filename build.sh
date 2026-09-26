#!/bin/sh
# Bygger _site/ til fuldtbooketmusiker.dk (kul & sølv-temaet). Kør gen_themes.py først.
set -e
cd "$(dirname "$0")"
rm -rf _site && mkdir _site && cp -r media _site/
sed 's#<title>Bliv Booket · Kul & sølv · Cormorant + Manrope</title>#<title>Bliv Booket</title>#' charcoal-silver.html > _site/index.html
cp tak-charcoal-silver.html _site/tak.html
cp track.js _site/track.js
cp _headers _site/_headers
# Kevin-HLS (18 min) er for stor til git; ligger lokalt i ~/bliv-booket-cf/public/media/kevin
K=~/bliv-booket-cf/public/media/kevin; if [ -d "$K" ]; then cp -r "$K" _site/media/kevin; else echo "ADVARSEL: $K mangler, Kevin-video bliver 404"; fi
echo "_site bygget: $(ls _site | tr '\n' ' ')"
