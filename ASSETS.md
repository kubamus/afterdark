# AFTER DARK — Asset Manifest

Every local visual asset stored in `public/assets/` is derived from verified official hardware media or openly licensed club photography via `scripts/fetch-assets.sh`, `scripts/process-assets.ts`, and `scripts/process-film.sh`.

## Hardware Product Media (Reference & Editorial Use)

### AlphaTheta CDJ-3000X
- **Official product page:** https://alphatheta.com/en/product/player/cdj-3000x/black/
- **Copyright / Owner:** AlphaTheta Corporation. Used here for non-commercial campaign demonstration and accurate product representation; no third-party rights are claimed.
- **Derived textures (`public/assets/tex/`):**
  - `cdj-top.webp`, `cdj-top-emissive.webp` — cropped from `cdj_3d_01.webp` (orthographic top view) and split into unlit surface base + illuminated LED/display emissive maps.
  - `cdj-screen-play.webp` — active performance waveform view cropped from `cdj_3d_01.webp`.
  - `cdj-screen-browse.webp` — dark-mode track browser view cropped from `cdj_display_dark.png`.
  - `cdj-front.webp` — front elevation cropped from `cdj_spec_04.webp`.
- **Derived macro film loops (`public/assets/film/`):**
  - `jog.mp4` / `jog.webp`, `screen.mp4` / `screen.webp`, `nfc.mp4` / `nfc.webp`, `playcue.mp4` / `playcue.webp` — muted, compressed H.264 clips extracted from official CDJ-3000X film `cdj_film_pc.mp4`.
- **Derived editorial photographs (`public/assets/img/`):**
  - `cdj-hero.webp`, `cdj-hero-portrait.webp`, `cdj-source.webp`, `cdj-top-dark.webp`, `cdj-qr.webp`, `cdj-browse.webp`, `cdj-xray.webp`, `cdj-angle.webp`, `cdj-top-ortho.webp`.

### Pioneer DJ DJM-A9
- **Official product page:** https://www.pioneerdj.com/en/product/dj-mixers/djm-a9/
- **Copyright / Owner:** AlphaTheta Corporation / Pioneer DJ. Branding on the DJM-A9 hardware is preserved accurately as Pioneer DJ.
- **Derived textures (`public/assets/tex/`):**
  - `djm-top.webp`, `djm-top-emissive.webp` — cropped from `djm_2.png` (orthographic top view), channel fader caps inpainted so 3D fader caps can move independently, and split into base + emissive maps.
  - `djm-fadercap.webp` — channel fader cap extracted directly from `djm_2.png`.
  - `djm-front.webp` — front elevation cropped from `djm_4.png`.
- **Derived editorial photographs (`public/assets/img/`):**
  - `djm-eq.webp`, `djm-beatfx.webp`, `djm-magvel.webp`, `djm-centerlock.webp`, `djm-color.webp`, `djm-phones.webp`, `djm-fxselect.webp`, `djm-xpad.webp`, `djm-ess.webp`, `djm-angle.webp`, `djm-angle-low.webp`.

## Live Club Culture Photography
- **Files:** `public/assets/img/club-1.webp`, `club-2.webp`, `club-3.webp`, `club-4.webp` (and `-sm.webp` mobile sizes).
- **Source:** Wikimedia Commons — *Bob Beaman Nightclub Munich* series (`Bob_Beaman_Nightclub_Munich_1.jpg` through `4.jpg`).
- **Author:** Arnold Jaeger Werner.
- **License:** Creative Commons Attribution 2.0 Generic (CC BY 2.0).

## Typography
- **Files (`src/fonts/`):** `archivo-var.woff2`, `plex-sans-var.woff2`, `plex-mono-400.woff2`, `plex-mono-500.woff2`.
- **License:** SIL Open Font License 1.1 (sourced via `@fontsource-variable/archivo`, `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono`).

## Audio
- **Engine (`src/audio/engine.ts`):** 100% original real-time procedural synthesis via the Web Audio API (124 BPM, C minor). No third-party audio samples are bundled.

## 3D Geometry Limitations & Approach
- Official CAD/GLB models of the CDJ-3000X and DJM-A9 are not publicly distributed.
- Rather than substituting inaccurate procedural lookalikes, the Three.js booth combines dimensionally accurate chassis/bezel/jog/knob/fader geometry (built strictly from published millimetre dimensions and measured orthographic coordinates) with high-resolution planar-projected official orthographic photography and custom emissive/LED-gating shaders. This preserves exact panel typography, control spacing, and AlphaTheta / Pioneer DJ branding fidelity.
