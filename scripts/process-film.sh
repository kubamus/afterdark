#!/usr/bin/env bash
# Cuts short, muted, web-optimised loops from the official CDJ-3000X film (AlphaTheta).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets-src/cdj_film_pc.mp4
OUT=public/assets/film
mkdir -p "$OUT"
clip() { # name start duration speed
  local name=$1 ss=$2 t=$3 speed=${4:-1}
  ffmpeg -loglevel error -y -ss "$ss" -t "$t" -i "$SRC" -an \
    -vf "setpts=${speed}*PTS,scale=1280:-2:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -crf 25 -profile:v high -movflags +faststart -g 24 "$OUT/$name.mp4"
  ffmpeg -loglevel error -y -ss 0.4 -i "$OUT/$name.mp4" -frames:v 1 -vf "scale=1280:-2" "$OUT/$name.png" && cwebp -quiet -q 78 "$OUT/$name.png" -o "$OUT/$name.webp" && rm "$OUT/$name.png"
}
clip jog 1.0 3.9
clip screen 7.1 3.3
clip nfc 12.7 3.15
clip playcue 15.95 0.98 2.2
ls -la "$OUT"
