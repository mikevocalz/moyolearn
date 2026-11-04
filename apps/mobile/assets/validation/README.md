# Device-validation assets

## `r12-patches.mp4`

The R1.2 and R1.5 test clip that `moyo://device-validation-probe` plays. It is
generated, not recorded. To rebuild it:

```
apps/mobile/assets/validation/generate-r12-patches.sh
```

The command needs ffmpeg with `libx264` and the `drawbox` filter. It was last
run with ffmpeg 9.0.2 on 2026-10-25 and produced 34,883 bytes,
sha256 `2255e55492c769ef4ff731b4b23f155901cabc29c04dfabf6d89652b09f9de5b` (x264 output can differ between
builds, so compare decoded values, not bytes).

| Property | Value |
| --- | --- |
| Video | H.264 High, level 4.1, yuv420p, 1920x1080, 30 fps, 10 s, GOP 30 |
| Colour | BT.709 primaries, transfer and matrix, limited (tv) range |
| Audio | none |

Layout, top to bottom:

1. Near-black ramp, rows 0-359: 16 steps of 120 px, sRGB 0, 2, 4 ... 30.
2. Mid greys, rows 360-719: sRGB 64, 96, 119 (about 18% reflectance), 128, 160, 188.
3. Skin tones, rows 720-1079: the ten Monk Skin Tone swatches (f6ede4 through
   292420), then ColorChecker dark skin (115, 82, 68) and light skin
   (194, 150, 130).
4. A 40x40 white square at y = 340 that crosses the frame once per second. A
   frozen or dropped frame shows as a stalled or jumping square.

Decoding frame 15 with the BT.709 matrix gives each patch within 1 code value
of the numbers above (checked 2026-10-25 with
`ffmpeg -vf scale=in_color_matrix=bt709:in_range=tv,format=rgb24`).
