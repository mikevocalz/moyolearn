#!/usr/bin/env bash
# Regenerates r12-patches.mp4, the Round 1 (R1.2) video test clip.
#
#   apps/mobile/assets/validation/generate-r12-patches.sh
#
# 1920x1080, 30 fps, 10 s, H.264 High, yuv420p, BT.709 limited range.
# Layout (top to bottom):
#   - near-black ramp: 16 steps, sRGB 0..30 in steps of 2
#   - mid greys: sRGB 64, 96, 119 (about 18% reflectance), 128, 160, 188
#   - skin tones: the ten Monk Skin Tone swatches, then ColorChecker
#     "dark skin" (115,82,68) and "light skin" (194,150,130)
#   - a 40x40 white marker that crosses the frame once per second, so a
#     frozen or dropped frame is visible
# The boxes are drawn in RGB (gbrp) and converted once with the BT.709
# matrix, so the encoded values match the sRGB numbers above. Drawing them in
# YUV would use ffmpeg's BT.601 default and tint the greys.
# Needs ffmpeg with libx264 and the drawbox filter.
set -euo pipefail
cd "$(dirname "$0")"

W=1920; H=1080
f=""
add() { f="${f:+$f,}$1"; }

# Near-black ramp, rows 0..359, 16 boxes of 120 px.
for i in $(seq 0 15); do
  v=$(( i * 2 )); hex=$(printf '%02x%02x%02x' "$v" "$v" "$v")
  add "drawbox=x=$(( i * 120 )):y=0:w=120:h=360:color=0x${hex}:t=fill"
done

# Mid greys, rows 360..719, 6 boxes of 320 px.
i=0
for v in 64 96 119 128 160 188; do
  hex=$(printf '%02x%02x%02x' "$v" "$v" "$v")
  add "drawbox=x=$(( i * 320 )):y=360:w=320:h=360:color=0x${hex}:t=fill"
  i=$(( i + 1 ))
done

# Skin tones, rows 720..1079, 12 boxes of 160 px.
i=0
for hex in f6ede4 f3e7db f7ead0 eadaba d7bd96 a07e56 825c43 604134 3a312a 292420 735244 c29682; do
  add "drawbox=x=$(( i * 160 )):y=720:w=160:h=360:color=0x${hex}:t=fill"
  i=$(( i + 1 ))
done

# Moving marker on the boundary between the ramp and the greys.
add "drawbox=x='mod(t,1)*$(( W - 40 ))':y=340:w=40:h=40:color=white:t=fill"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=0x808080:s=${W}x${H}:r=30:d=10,format=gbrp" \
  -vf "$f,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -profile:v high -level 4.1 -preset slow -crf 16 \
  -g 30 -keyint_min 30 -sc_threshold 0 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -movflags +faststart -an \
  r12-patches.mp4

ls -l r12-patches.mp4
