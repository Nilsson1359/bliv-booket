#!/bin/sh
# Bygger _site/ til fuldtbooketmusiker.dk (kul & sølv-temaet). Kør gen_themes.py først.
set -e
cd "$(dirname "$0")"
rm -rf _site && mkdir _site && cp -r media _site/
sed 's#<title>Bliv Booket · Kul & sølv · Cormorant + Manrope</title>#<title>Bliv Booket</title>#' charcoal-silver.html > _site/index.html
cp tak-charcoal-silver.html _site/tak.html
echo "_site bygget: $(ls _site | tr '\n' ' ')"
