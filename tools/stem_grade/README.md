# Farvegradering af stemningsklippene (/bryllup "Se stemningen")

Originalerne er Sony XAVC 4K 10-bit 4:2:2 i **S-Log3 / S-Gamut3.Cine** (Frame.io-share fra oscar thorup,
"2026-10-03 Bryllua Oscar Jønsson (VIDEO)", link i WhatsApp 8/10 2026: https://f.io/mHkNVLh0).
`film.mp4` er Oscars egen færdige klip (allerede gradet) og røres ikke.

- `mklut.py '<json>' ud.cube` laver en 65³-LUT pr. klip: S-Log3 -> lineær -> S-Gamut3.Cine->Rec.709-matrix
  -> eksponering (`ev`, stops), varme (`warm`), tint (`tint`, + = magenta), mætning (`sat`)
  -> filmisk skulder (ACES-fit, `pre` = kontrast) -> Rec.709.
- `meter.json`: målt log-gennemsnit + 95-percentil af lineær luminans (3 frames pr. klip).
- `params.json`: endelige værdier pr. klip. Auto: ev = 0.75*log2(0.115/key), klemt til [-0.8, 2.4];
  aftenklip (key < 0.03) får -0.35 ev, sat 0.82, pre 0.8 så sceneslys ikke bliver neon. Håndrettet: C0172, C0180, C0194, C0199, C0201.

Render pr. klip (lyden genbruges fra den eksisterende web-fil):
```
ffmpeg -i <original-url> -i media/ev/stem/cXXXX.mp4 -map 0:v:0 -map 1:a:0 \
  -vf "setparams=range=pc,scale=1280:720:in_range=pc:out_range=pc:flags=lanczos,format=rgb48le,lut3d=CXXXX.cube:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 22 -maxrate 1800k -bufsize 3600k -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a copy -movflags +faststart cxxxx.mp4
```
Runde 2 (samme dag): `knee`/`ks` = blødt højlys-knæ i lineær luminans (vinduer/markise brænder ikke ud, målt 0 % udbrændt),
`shadow` = skyggeløft (0.05 dag, 0.10 aften), modlys-klip (C0161/62/63/67/70/72/78/79/82) får mere eksponering og knæ 0.5,
aftenklip `dn` = hqdn3d + maxrate 1500k. `render.py` laver LUT + render af alle klip, `qa.py` måler hele længden
(udbrændt/knust/spring/middel). Signerede Frame.io-URL'er (files.json) er ikke i git; hent nye via sharet.

Plakatbilleder (`.webp`, 640x360) tages fra det nye klip ved 2,5 s. Bump `STEM_V` i gen_events.py ved ny udgave.
