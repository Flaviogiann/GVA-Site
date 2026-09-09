#!/usr/bin/env bash
# Encode les 120 frames du hero en AVIF, une image fixe indépendante par
# fichier, en deux jeux : 1920 px pour l'ordinateur, 1080 px pour le
# téléphone.
#
# PIÈGE : il faut le muxer "-f avif", avec un appel ffmpeg par image.
# Avec "-f image2" et un motif "%03d.avif", ffmpeg encode la suite comme
# une vidéo : les frames sont inter-codées, les fichiers paraissent
# légers mais le navigateur ne peut pas les décoder isolément
# (naturalWidth vaut 0).
#
# Usage : bash outils/encode-frames.sh

set -u

BASE="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$BASE/gva_hero/gva_hero/footage"
OUT="$BASE/GVA_SITE/images/hero"

# Largeur et crf de chaque jeu. Plus le crf est bas, meilleure est la
# qualité et plus le fichier est lourd.
LARGEUR_BUREAU=1920 ; CRF_BUREAU=38
LARGEUR_MOBILE=1080 ; CRF_MOBILE=43

encoder() {   # $1 = largeur, $2 = crf, $3 = numéro de frame
  ffmpeg -loglevel error -y \
    -i "$SRC/gva_hero_$3.jpeg" \
    -vf "scale=$1:-2" \
    -c:v libaom-av1 -still-picture 1 -crf "$2" -cpu-used 6 -pix_fmt yuv420p \
    -f avif "$OUT/$1/$3.avif"
}
export -f encoder
export SRC OUT

mkdir -p "$OUT/$LARGEUR_BUREAU" "$OUT/$LARGEUR_MOBILE"
rm -f "$OUT/$LARGEUR_BUREAU"/*.avif "$OUT/$LARGEUR_MOBILE"/*.avif

LISTE="$(mktemp)"
seq -w 0 119 > "$LISTE"

echo "--- $LARGEUR_BUREAU px, crf $CRF_BUREAU ---"
xargs -a "$LISTE" -I{} -P 4 bash -c "encoder $LARGEUR_BUREAU $CRF_BUREAU \"\$@\"" _ {}

echo "--- $LARGEUR_MOBILE px, crf $CRF_MOBILE ---"
xargs -a "$LISTE" -I{} -P 4 bash -c "encoder $LARGEUR_MOBILE $CRF_MOBILE \"\$@\"" _ {}

rm -f "$LISTE"

echo "--- affiches (image LCP, donc encodées plus finement) ---"
ffmpeg -loglevel error -y -i "$SRC/gva_hero_000.jpeg" -vf scale=1920:-2 \
  -c:v libaom-av1 -still-picture 1 -crf 32 -cpu-used 4 -pix_fmt yuv420p -f avif "$OUT/poster.avif"
ffmpeg -loglevel error -y -i "$SRC/gva_hero_000.jpeg" -vf scale=1080:-2 \
  -c:v libaom-av1 -still-picture 1 -crf 34 -cpu-used 4 -pix_fmt yuv420p -f avif "$OUT/poster-1080.avif"
ffmpeg -loglevel error -y -i "$SRC/gva_hero_000.jpeg" -vf scale=1920:-2 \
  -c:v libwebp -quality 74 -compression_level 6 -preset picture "$OUT/poster.webp"
ffmpeg -loglevel error -y -i "$SRC/gva_hero_000.jpeg" -vf scale=1080:-2 \
  -c:v libwebp -quality 70 -compression_level 6 -preset picture "$OUT/poster-1080.webp"

echo "=== BILAN ==="
echo "$LARGEUR_BUREAU : $(ls "$OUT/$LARGEUR_BUREAU" | wc -l) fichiers, $(du -sh "$OUT/$LARGEUR_BUREAU" | cut -f1)"
echo "$LARGEUR_MOBILE : $(ls "$OUT/$LARGEUR_MOBILE" | wc -l) fichiers, $(du -sh "$OUT/$LARGEUR_MOBILE" | cut -f1)"
ls -la "$OUT" | grep poster | awk '{print $5, $NF}'
