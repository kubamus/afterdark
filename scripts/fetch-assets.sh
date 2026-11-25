#!/usr/bin/env bash
# Fetches the original source assets used by AFTER DARK into ./assets-src.
# Every asset's origin and licence is documented in ASSETS.md.
# Processed, web-optimised derivatives are produced by scripts/process-assets.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets-src
cd assets-src
UA="Mozilla/5.0 (AfterDark campaign asset fetch)"
get() { [ -s "$2" ] || curl -sfL -m 90 -A "$UA" -o "$2" "$1" || echo "FAILED $1"; }

AT=https://assets.alphatheta.com/page-assets/cdj-3000x/assets
for n in 1 2 3 4 5 6 7 8; do get "$AT/img/3dv/3d_0$n.webp" "cdj_3d_0$n.webp"; done
for n in 1 2 3 4 5; do get "$AT/img/support/spec_0$n.webp" "cdj_spec_0$n.webp"; done
get "$AT/img/first/kv_pc.webp" cdj_kv_pc.webp
get "$AT/img/first/kv_sp.webp" cdj_kv_sp.webp
get "$AT/img/motion/02.webp" cdj_motion_02.webp
get "$AT/img/motion/05.webp" cdj_motion_05.webp
get "$AT/img/motion/06/06_90.webp" cdj_motion_06.webp
get "$AT/img/motion/08/08_90.webp" cdj_motion_08.webp
get "$AT/img/sound/bg.webp" cdj_sound_xray.webp
get "$AT/img/display/img_display_dark.png" cdj_display_dark.png
get "$AT/video/first/kv_pc.mp4" cdj_film_pc.mp4
get "$AT/video/first/kv_sp.mp4" cdj_film_sp.mp4

PD=https://www.pioneerdj.com/product-images
get "$PD/403/ce00a4f3-1f0f-4157-b65f-c05de5c68dc1/djm-a9_1.png" djm_1.png
get "$PD/404/083cd5a5-6cc3-4e01-8366-65de489ae284/djm-a9_2.png" djm_2.png
get "$PD/406/0e23d7a7-1219-41df-bef9-6ff6b8404320/djm-a9_4.png" djm_4.png
get "$PD/407/76b9e873-5215-4e92-805e-6cf964e3d89e/djm-a9_5.png" djm_5.png

MC=https://images.microcms-assets.io/assets/3b9e29ce734e49babfedb3f8d1e728e3
get "$MC/11c89426da1343d888137369643e0a94/7C834769-F866-44E3-B46F-B41BB541E76F.png" djm_meters_beatfx.png
get "$MC/2506ab63a83d4b2bb334f68aa1125b0e/59FF8CB7-1B8B-476F-B066-03D958906412.png" djm_magvel.png
get "$MC/03ed3410da6045a08fa984f1b033eac0/018CE809-E8A0-434A-887D-F2AD50A97A0F.jpg" djm_xpad_touch.jpg
get "$MC/62619d70ff2d49ef8a5c05034630b7a7/6708C8C8-77A6-438E-84FD-C9524D2E43AE.png" djm_eq.png
get "$MC/bae3033396994bcc82101069e62e38f3/F8D566FA-46B2-4043-BD21-02C348042747.png" djm_centerlock.png
get "$MC/ccf7359ab74e4d7a819a2f83bc40a658/BD2D1FB8-3B3B-49D2-A643-4A6AC853ECFD.png" djm_color.png
get "$MC/a96320bcefa449b293d2ecae58c640f9/68EDC044-1739-450E-8972-915F87C2802B.png" djm_faders_phones.png
get "$MC/9e95e6e87d294368a63fdefe6132933f/CC307947-7547-4ACF-B568-FCBA4A275D56.png" djm_fx_select.png
get "$MC/bf4186857ee84abdbbcff844f37ace02/DJM-A9-feature-sound-quelity-pc-1082x1000.jpg" djm_ess.jpg
get "$MC/3bf97b0e1f384a30a115c385edd0f860/98469870-1B16-46A0-97D8-B8AA81BCD33C.jpg" djm_wide_a.jpg
get "$MC/fe7d5bbd6e2948bf8261c2f85142bef2/AF3BC5CB-08AB-4ECC-B33E-3138BE02324E.jpg" djm_wide_b.jpg

# Club photography — Arnold Jaeger Werner, CC BY 2.0, via Wikimedia Commons
WM=https://upload.wikimedia.org/wikipedia/commons
get "$WM/6/66/Bob_Beaman_Nightclub_Munich_1.jpg" club_munich_1.jpg
get "$WM/2/23/Bob_Beaman_Nightclub_Munich_2.jpg" club_munich_2.jpg
get "$WM/2/23/Bob_Beaman_Nightclub_Munich_3.jpg" club_munich_3.jpg
get "$WM/c/c8/Bob_Beaman_Nightclub_Munich_4.jpg" club_munich_4.jpg
ls -la
