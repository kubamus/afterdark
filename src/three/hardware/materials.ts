import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RectPx } from "./layout";

export interface DeviceFrame {
  pxPerM: number;
  crop: { width: number; height: number };
}

/**
 * Assigns planar top-down UVs to a geometry whose vertices are in device-local metres
 * (x right, z toward the DJ, origin at the centre of the photo crop).
 */
export function applyPlanarUV(geo: THREE.BufferGeometry, dev: DeviceFrame) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) * dev.pxPerM + dev.crop.width / 2;
    const py = pos.getZ(i) * dev.pxPerM + dev.crop.height / 2;
    uv[i * 2] = px / dev.crop.width;
    uv[i * 2 + 1] = 1 - py / dev.crop.height;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** crop px → device-local metres */
export function local(dev: DeviceFrame, px: number, py: number): [number, number] {
  return [(px - dev.crop.width / 2) / dev.pxPerM, (py - dev.crop.height / 2) / dev.pxPerM];
}

/** Rect in crop px → UV-space vec4 (u0, v0, u1, v1) with v0 < v1 */
export function rectToUV(dev: DeviceFrame, r: RectPx) {
  return new THREE.Vector4(
    r.x0 / dev.crop.width,
    1 - r.y1 / dev.crop.height,
    r.x1 / dev.crop.width,
    1 - r.y0 / dev.crop.height,
  );
}

/** Deterministic PRNG for repeatable photorealistic procedural surface maps. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth tileable 2D value noise for organic roughness patina & lived-in surface variation. */
function makeTileableNoise(gridSize: number, seed: number) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  const sample = (u: number, v: number) => {
    const x = (((u % 1) + 1) % 1) * gridSize;
    const y = (((v % 1) + 1) % 1) * gridSize;
    const x0 = Math.floor(x) % gridSize;
    const y0 = Math.floor(y) % gridSize;
    const x1 = (x0 + 1) % gridSize;
    const y1 = (y0 + 1) % gridSize;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = grid[y0 * gridSize + x0]!;
    const n10 = grid[y0 * gridSize + x1]!;
    const n01 = grid[y1 * gridSize + x0]!;
    const n11 = grid[y1 * gridSize + x1]!;
    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  };
  return sample;
}

/** Converts a scalar heightfield into a tangent-space normal map CanvasTexture. */
function heightToNormalTexture(
  height: Float32Array,
  size: number,
  strength: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (height[y * size + xp]! - height[y * size + xm]!) * strength;
      const dy = (height[yp * size + x]! - height[ym * size + x]!) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

export interface ProceduralSurfaceMaps {
  /** Authentic isotropic fine powder-coated / bead-blasted anodized aluminum normal map (ZERO corduroy stripes!) */
  anodizedNormal: THREE.CanvasTexture | null;
  /** Organic multi-octave roughness patina: subtle finger-sheen clouds + micro-scratches + metallic flake */
  anodizedRoughness: THREE.CanvasTexture | null;
  /** Fine concentric machined platter grooves + radial sheen */
  radialNormal: THREE.CanvasTexture | null;
  /** Concentric radial roughness variation for brushed metal discs */
  radialRoughness: THREE.CanvasTexture | null;
  /** Fine elastomer pebble normal map for rubberized knobs, jog grip collar & keycap walls */
  rubberNormal: THREE.CanvasTexture | null;
  /** Soft radial ambient occlusion disc for realistic contact grounding under knobs & round buttons */
  contactAo: THREE.CanvasTexture | null;
  dispose(): void;
}

/**
 * Generates authentic, physically grounded procedural PBR surface maps:
 *  - Bead-blasted / powder-coated dark aluminum (isotropic micro-grain + subtle lived-in hand-sheen
 *    roughness clouds + delicate micro-scratches so hardware never looks sterile or "corduroy-striped")
 *  - Radial spun aluminum / vinyl micro-grooves for jog platter & circular metallic transport caps
 *  - Soft tactile elastomer grain for matte rubberized keycaps & jog grip
 *  - Contact AO radial gradient for crisp grounded shadows under knobs and buttons
 */
export function createSurfaceMaps(): ProceduralSurfaceMaps {
  if (typeof document === "undefined") {
    return {
      anodizedNormal: null,
      anodizedRoughness: null,
      radialNormal: null,
      radialRoughness: null,
      rubberNormal: null,
      contactAo: null,
      dispose() {},
    };
  }

  const rand = mulberry32(48271);
  const disposables: THREE.Texture[] = [];

  // 1) Authentic isotropic bead-blasted satin aluminum + lived-in organic patina roughness (512x512)
  const aSize = 512;
  const aHeight = new Float32Array(aSize * aSize);
  const noiseCoarse = makeTileableNoise(6, 101); // broad palm / finger-oil patina clouds
  const noiseMed = makeTileableNoise(18, 202); // subtle anodized bath mottling
  const noiseFine = makeTileableNoise(64, 303); // fine powder-coat micro-pebble

  // Generate 28 ultra-subtle random studio hairline micro-scratches on a scratch layer
  const scratchCanvas = document.createElement("canvas");
  scratchCanvas.width = aSize;
  scratchCanvas.height = aSize;
  const sCtx = scratchCanvas.getContext("2d");
  if (sCtx) {
    sCtx.fillStyle = "#000000";
    sCtx.fillRect(0, 0, aSize, aSize);
    for (let i = 0; i < 34; i++) {
      const sx = rand() * aSize;
      const sy = rand() * aSize;
      const len = 18 + rand() * 75;
      const ang = rand() * Math.PI * 2;
      const alpha = 0.08 + rand() * 0.22;
      sCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
      sCtx.lineWidth = 0.65 + rand() * 0.6;
      sCtx.beginPath();
      sCtx.moveTo(sx, sy);
      sCtx.quadraticCurveTo(
        sx + Math.cos(ang + 0.14) * len * 0.5,
        sy + Math.sin(ang + 0.14) * len * 0.5,
        sx + Math.cos(ang) * len,
        sy + Math.sin(ang) * len,
      );
      sCtx.stroke();
    }
  }
  const scratchData = sCtx ? sCtx.getImageData(0, 0, aSize, aSize).data : null;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = aSize;
  roughCanvas.height = aSize;
  const rCtx = roughCanvas.getContext("2d");
  const rImg = rCtx ? rCtx.createImageData(aSize, aSize) : null;

  for (let y = 0; y < aSize; y++) {
    const v = y / aSize;
    for (let x = 0; x < aSize; x++) {
      const u = x / aSize;
      const idx = y * aSize + x;
      const nCoarse = noiseCoarse(u, v);
      const nMed = noiseMed(u, v);
      const nFine = noiseFine(u, v);
      const microGrain = (rand() - 0.5) * 0.72;
      const scratch = scratchData ? scratchData[idx * 4]! / 255 : 0;

      // Isotropic bead-blast heightfield (zero horizontal corduroy stripes!)
      aHeight[idx] = microGrain * 0.55 + (nFine - 0.5) * 0.42 + (nMed - 0.5) * 0.14 - scratch * 0.28;

      if (rImg) {
        // Real satin-matte aluminum roughness (~0.36..0.64): subtle lived-in touch sheen clouds
        // plus tiny bright metallic flecks & hairline micro-scratches that break up specular highlights!
        const patina = nCoarse * 0.55 + nMed * 0.3 + nFine * 0.15;
        const sparkle = rand() > 0.985 ? -28 : 0;
        const roughByte = Math.max(
          74,
          Math.min(182, Math.round(92 + patina * 72 + microGrain * 18 - scratch * 46 + sparkle)),
        );
        rImg.data[idx * 4] = roughByte;
        rImg.data[idx * 4 + 1] = roughByte;
        rImg.data[idx * 4 + 2] = roughByte;
        rImg.data[idx * 4 + 3] = 255;
      }
    }
  }

  // Smooth the bead-blast heightfield slightly (1 soft pass) so micro-pebbles catch light organically
  const aSmooth = new Float32Array(aSize * aSize);
  for (let y = 0; y < aSize; y++) {
    const ym = (y - 1 + aSize) % aSize;
    const yp = (y + 1) % aSize;
    for (let x = 0; x < aSize; x++) {
      const xm = (x - 1 + aSize) % aSize;
      const xp = (x + 1) % aSize;
      aSmooth[y * aSize + x] =
        (aHeight[y * aSize + x]! * 5 +
          aHeight[y * aSize + xm]! +
          aHeight[y * aSize + xp]! +
          aHeight[ym * aSize + x]! +
          aHeight[yp * aSize + x]!) /
        9;
    }
  }

  // Non-repeating feel: repeat (1, 1) on top plates so patina clouds & micro-scratches never visibly tile!
  const anodizedNormal = heightToNormalTexture(aSmooth, aSize, 0.85, 2, 2);
  let anodizedRoughness: THREE.CanvasTexture | null = null;
  if (rCtx && rImg) {
    rCtx.putImageData(rImg, 0, 0);
    anodizedRoughness = new THREE.CanvasTexture(roughCanvas);
    anodizedRoughness.wrapS = THREE.RepeatWrapping;
    anodizedRoughness.wrapT = THREE.RepeatWrapping;
    anodizedRoughness.repeat.set(1, 1);
    anodizedRoughness.anisotropy = 8;
  }

  // 2) Concentric fine grooves + realistic radial spun-metal sheen (512x512, centered at 0.5,0.5)
  const radSize = 512;
  const radHeight = new Float32Array(radSize * radSize);
  const radRoughCanvas = document.createElement("canvas");
  radRoughCanvas.width = radSize;
  radRoughCanvas.height = radSize;
  const rrCtx = radRoughCanvas.getContext("2d");
  const rrImg = rrCtx ? rrCtx.createImageData(radSize, radSize) : null;

  for (let y = 0; y < radSize; y++) {
    const dy = (y + 0.5) / radSize - 0.5;
    for (let x = 0; x < radSize; x++) {
      const dx = (x + 0.5) / radSize - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx);
      // Ultra-fine concentric platter grooves + subtle lived-in touch variation
      const groove = Math.sin(r * Math.PI * 2 * 145) * 0.48 + Math.sin(r * Math.PI * 2 * 290) * 0.14;
      const fineNoise = (rand() - 0.5) * 0.2;
      const touchCloud = noiseCoarse(x / radSize, y / radSize);
      radHeight[y * radSize + x] = groove + fineNoise;

      if (rrImg) {
        const aniso = Math.cos(ang * 2 + 0.5) * 16;
        const rv = Math.max(
          54,
          Math.min(168, Math.round(88 + groove * 14 + aniso + (touchCloud - 0.5) * 34 + fineNoise * 16)),
        );
        const idx = (y * radSize + x) * 4;
        rrImg.data[idx] = rv;
        rrImg.data[idx + 1] = rv;
        rrImg.data[idx + 2] = rv;
        rrImg.data[idx + 3] = 255;
      }
    }
  }
  const radialNormal = heightToNormalTexture(radHeight, radSize, 1.35, 1, 1);
  let radialRoughness: THREE.CanvasTexture | null = null;
  if (rrCtx && rrImg) {
    rrCtx.putImageData(rrImg, 0, 0);
    radialRoughness = new THREE.CanvasTexture(radRoughCanvas);
    radialRoughness.anisotropy = 8;
  }

  // 3) Matte soft-touch elastomer pebble normal map (256x256)
  const rubSize = 256;
  const rubHeight = new Float32Array(rubSize * rubSize);
  for (let i = 0; i < rubHeight.length; i++) {
    rubHeight[i] = (rand() - 0.5) * 0.78;
  }
  const rubSmooth = new Float32Array(rubSize * rubSize);
  for (let y = 0; y < rubSize; y++) {
    const ym = (y - 1 + rubSize) % rubSize;
    const yp = (y + 1) % rubSize;
    for (let x = 0; x < rubSize; x++) {
      const xm = (x - 1 + rubSize) % rubSize;
      const xp = (x + 1) % rubSize;
      rubSmooth[y * rubSize + x] =
        (rubHeight[y * rubSize + x]! * 4 +
          rubHeight[y * rubSize + xm]! +
          rubHeight[y * rubSize + xp]! +
          rubHeight[ym * rubSize + x]! +
          rubHeight[yp * rubSize + x]!) /
        8;
    }
  }
  const rubberNormal = heightToNormalTexture(rubSmooth, rubSize, 1.15, 3, 3);

  // 4) Contact Ambient Occlusion radial disc for physical seating under knobs, buttons & faders
  const aoCanvas = document.createElement("canvas");
  aoCanvas.width = 128;
  aoCanvas.height = 128;
  const aoCtx = aoCanvas.getContext("2d");
  let contactAo: THREE.CanvasTexture | null = null;
  if (aoCtx) {
    const grad = aoCtx.createRadialGradient(64, 64, 22, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.92)");
    grad.addColorStop(0.58, "rgba(0,0,0,0.68)");
    grad.addColorStop(0.82, "rgba(0,0,0,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    aoCtx.fillStyle = grad;
    aoCtx.fillRect(0, 0, 128, 128);
    contactAo = new THREE.CanvasTexture(aoCanvas);
  }

  for (const t of [anodizedNormal, anodizedRoughness, radialNormal, radialRoughness, rubberNormal, contactAo]) {
    if (t) disposables.push(t);
  }

  return {
    anodizedNormal,
    anodizedRoughness,
    radialNormal,
    radialRoughness,
    rubberNormal,
    contactAo,
    dispose() {
      disposables.forEach((t) => t.dispose());
    },
  };
}

/** Legacy alias kept for compatibility. */
export function createBrushedTexture(): THREE.CanvasTexture | null {
  return createSurfaceMaps().anodizedNormal;
}

export interface PanelUniforms {
  uPower: { value: number };
  uLed: { value: number };
  uBoost: { value: number };
  uMeterRect: { value: THREE.Vector4[] };
  uMeterLevel: { value: number[] };
  uTint: { value: THREE.Color };
}

export const METER_SLOTS = 6;

export interface PanelMaterialOptions {
  normalMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
  normalScale?: number;
  roughness?: number;
  metalness?: number;
}

/**
 * MeshStandardMaterial driven by the product photograph + organic bead-blasted aluminum patina:
 *  - map: unpowered panel colour
 *  - emissiveMap: illuminated LEDs, buttons and displays
 *  - normalMap / roughnessMap: isotropic fine bead-blast grain + organic finger-sheen patina
 *  - polygonOffset prevents depth-buffer Z-fighting on every camera distance
 *  - uPower sweeps the panel awake from the DJ side to the rear
 *  - LED meter columns are gated segment-by-segment by real (or simulated) audio levels
 */
export function createPanelMaterial(
  base: THREE.Texture,
  emissive: THREE.Texture,
  meters: THREE.Vector4[] = [],
  opts: PanelMaterialOptions = {},
) {
  const uniforms: PanelUniforms = {
    uPower: { value: 0 },
    uLed: { value: 0 },
    uBoost: { value: 2.6 },
    uMeterRect: { value: Array.from({ length: METER_SLOTS }, (_, i) => meters[i] ?? new THREE.Vector4(-1, -1, -1, -1)) },
    uMeterLevel: { value: new Array(METER_SLOTS).fill(0) },
    uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const nScale = opts.normalScale ?? 0.16;
  const mat = new THREE.MeshStandardMaterial({
    map: base,
    emissiveMap: emissive,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 1,
    roughness: opts.roughness ?? 0.72, // modulated by patina roughnessMap (~0.36..0.64 effective!)
    metalness: opts.metalness ?? 0.32,
    normalMap: opts.normalMap ?? null,
    normalScale: new THREE.Vector2(nScale, nScale),
    roughnessMap: opts.roughnessMap ?? null,
    alphaTest: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uPower;
uniform float uLed;
uniform float uBoost;
uniform vec4 uMeterRect[${METER_SLOTS}];
uniform float uMeterLevel[${METER_SLOTS}];
uniform vec3 uTint;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#ifdef USE_EMISSIVEMAP
  vec2 euv = vEmissiveMapUv;
  vec3 eCol = texture2D( emissiveMap, euv ).rgb;
  // wake sweep: front (v=0) to rear (v=1)
  float sweep = 1.0 - smoothstep( uPower * 1.25 - 0.18, uPower * 1.25 - 0.02, euv.y );
  float gate = 1.0;
  for ( int i = 0; i < ${METER_SLOTS}; i++ ) {
    vec4 r = uMeterRect[i];
    if ( euv.x >= r.x && euv.x <= r.z && euv.y >= r.y && euv.y <= r.w ) {
      float t = ( euv.y - r.y ) / ( r.w - r.y );
      float seg = floor( t * 15.0 ) / 15.0;
      gate = step( seg + 0.001, uMeterLevel[i] );
    }
  }
  totalEmissiveRadiance *= eCol * gate * sweep * uLed * uBoost * uTint;
#endif`,
      );
  };
  mat.userData.uniforms = uniforms;
  return { material: mat, uniforms };
}

/** Matte bead-blasted dark anodized chassis with organic roughness patina. */
export function chassisMaterial(
  color = 0x101014,
  roughness = 0.72,
  normalMap: THREE.Texture | null = null,
  roughnessMap: THREE.Texture | null = null,
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.42,
    normalMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
    roughnessMap,
  });
}

export function rubberMaterial(normalMap: THREE.Texture | null = null) {
  return new THREE.MeshStandardMaterial({
    color: 0x0e0e12,
    roughness: 0.76,
    metalness: 0.05,
    normalMap,
    normalScale: new THREE.Vector2(0.32, 0.32),
  });
}

export function knobSideMaterial(rubberNormal: THREE.Texture | null = null) {
  return new THREE.MeshStandardMaterial({
    color: 0x17171c,
    roughness: 0.62,
    metalness: 0.18,
    normalMap: rubberNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
}

export function brushedSilverMaterial(normalMap: THREE.Texture | null = null) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xd4d7de,
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.35,
    clearcoatRoughness: 0.18,
    normalMap,
    normalScale: new THREE.Vector2(0.08, 0.08),
  });
}

export function buttonBezelMaterial(rubberNormal: THREE.Texture | null = null) {
  return new THREE.MeshStandardMaterial({
    color: 0x050507,
    roughness: 0.85,
    metalness: 0.12,
    normalMap: rubberNormal,
    normalScale: new THREE.Vector2(0.15, 0.15),
  });
}

/**
 * Builds a truly separated 3D rectangular keycap:
 *  - `well`: dark recessed shadow bezel punched into the aluminum deck
 *  - `body`: solid molded tapered keycap body (NO smeared photo texture on vertical sides!)
 *  - `face`: crisp slightly inset top cap surface carrying the planar-projected legend/LED!
 */
export function buildSeparatedRectKeycap(
  dev: DeviceFrame,
  cx: number,
  cy: number,
  wPx: number,
  hPx: number,
  heightM: number,
  baseY: number,
): { well: THREE.BufferGeometry; body: THREE.BufferGeometry; face: THREE.BufferGeometry } {
  const [x, z] = local(dev, cx, cy);
  const w = wPx / dev.pxPerM;
  const d = hPx / dev.pxPerM;
  const r = Math.min(0.0014, w * 0.2, d * 0.2, heightM * 0.35);

  // Dark recessed cutout bezel slightly wider than the keycap
  const wellRaw = new RoundedBoxGeometry(w + 0.0022, 0.0014, d + 0.0022, 1, 0.0005);
  const well = wellRaw.index ? wellRaw.toNonIndexed() : wellRaw;
  if (wellRaw !== well) wellRaw.dispose();
  well.translate(x, baseY + 0.0005, z);

  // Solid molded 3D keycap body (clean dark rubber or translucent acrylic sides — zero texture smear!)
  const bodyRaw = new RoundedBoxGeometry(w, heightM, d, 2, r);
  const body = bodyRaw.index ? bodyRaw.toNonIndexed() : bodyRaw;
  if (bodyRaw !== body) bodyRaw.dispose();
  body.translate(x, baseY + heightM / 2 + 0.0004, z);

  // Crisp top legend plate sitting cleanly on top of the molded keycap
  const faceW = Math.max(0.002, w - r * 1.15);
  const faceD = Math.max(0.002, d - r * 1.15);
  const faceRaw = new THREE.PlaneGeometry(faceW, faceD);
  faceRaw.rotateX(-Math.PI / 2);
  const face = faceRaw.index ? faceRaw.toNonIndexed() : faceRaw;
  if (faceRaw !== face) faceRaw.dispose();
  face.translate(x, baseY + heightM + 0.00055, z);
  applyPlanarUV(face, dev);

  return { well, body, face };
}

/**
 * Builds a truly separated 3D round button:
 *  - `well`: dark recessed circular socket
 *  - `skirt`: tapered dark polymer/anodized body wall
 *  - `face`: crisp top legend disc (no smeared sides!)
 */
export function buildSeparatedRoundKeycap(
  dev: DeviceFrame,
  cx: number,
  cy: number,
  rPx: number,
  heightM: number,
  baseY: number,
  segments = 28,
): { well: THREE.BufferGeometry; skirt: THREE.BufferGeometry; face: THREE.BufferGeometry } {
  const [x, z] = local(dev, cx, cy);
  const r = rPx / dev.pxPerM;

  const wellRaw = new THREE.CylinderGeometry(r * 1.12, r * 1.16, 0.0014, segments);
  const well = wellRaw.index ? wellRaw.toNonIndexed() : wellRaw;
  if (wellRaw !== well) wellRaw.dispose();
  well.translate(x, baseY + 0.0005, z);

  const skirtRaw = new THREE.CylinderGeometry(r * 0.86, r * 1.0, heightM, segments);
  const skirt = skirtRaw.index ? skirtRaw.toNonIndexed() : skirtRaw;
  if (skirtRaw !== skirt) skirtRaw.dispose();
  skirt.translate(x, baseY + heightM / 2 + 0.0004, z);

  const faceRaw = new THREE.CircleGeometry(r * 0.84, segments);
  faceRaw.rotateX(-Math.PI / 2);
  const face = faceRaw.index ? faceRaw.toNonIndexed() : faceRaw;
  if (faceRaw !== face) faceRaw.dispose();
  face.translate(x, baseY + heightM + 0.00055, z);
  applyPlanarUV(face, dev);

  return { well, skirt, face };
}

/**
 * Builds a high-detail sculpted 3D rotary knob barrel matching official Pioneer DJM-A9 knobs (`djm-eq.webp`):
 *  - Stepped satin-elastomer grip skirt with crisp 14-rib tactile finger flutes
 *  - Smooth chamfered top shoulder & gently recessed satin crown
 */
export function createFlutedKnobBarrelGeo(
  rTop: number,
  rBot: number,
  height: number,
  flutes = 14,
  fluteDepth = 0.064,
  radialSegs = 96,
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rBot * 0.96, height * 0.1),
    new THREE.Vector2(rBot * 0.96, height * 0.18),
    new THREE.Vector2(rBot * 0.93, height * 0.42),
    new THREE.Vector2((rBot + rTop) * 0.46, height * 0.72),
    new THREE.Vector2(rTop * 1.0, height * 0.89),
    new THREE.Vector2(rTop * 0.94, height * 0.96),
    new THREE.Vector2(rTop * 0.84, height * 0.995),
    new THREE.Vector2(rTop * 0.35, height * 0.988),
    new THREE.Vector2(0.0001, height * 0.982),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegs);
  geo.translate(0, -height / 2, 0);

  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.sqrt(x * x + z * z);
    if (r < 0.0003) continue;
    const ny = (y + height / 2) / height;
    if (ny > 0.14 && ny < 0.9) {
      const t = (ny - 0.14) / 0.76;
      const fluteMask = Math.sin(t * Math.PI);
      const ang = Math.atan2(z, x);
      // Pronounced rounded Pioneer DJ finger-grip ribs that catch real directional rim highlights!
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(ang * flutes), 1.35);
      const rScale = 1 - fluteDepth * fluteMask * (1 - ridge);
      pos.setXYZ(i, x * rScale, y, z * rScale);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sculpted 3D contoured Pioneer DJ P-LOCK fader cap (tapered rubberized saddle
 * with deep ergonomic finger concave dip, dark steel stem underneath, and molded white center blade).
 */
export function buildContouredFaderCap(
  widthX: number,
  depthZ: number,
  heightY: number,
  orientation: "vertical-fader" | "horizontal-crossfader",
): THREE.Group {
  const grp = new THREE.Group();
  const isCross = orientation === "horizontal-crossfader";
  // Profile runs along the travel axis: Z for vertical channel/tempo faders, X for horizontal crossfader
  const span = isCross ? widthX : depthZ;
  const extrudeLen = isCross ? depthZ : widthX;

  // Exposed dark brushed steel fader shaft descending into the recessed slot
  const stemGeo = new THREE.BoxGeometry(isCross ? 0.0018 : widthX * 0.36, 0.0042, isCross ? depthZ * 0.36 : 0.0018);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x26262d, roughness: 0.35, metalness: 0.78 });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.0021;
  grp.add(stem);

  // Tapered ergonomic saddle shape
  const shape = new THREE.Shape();
  const hs = span * 0.5;
  const baseY = 0.0026;
  const topY = heightY;
  shape.moveTo(-hs, baseY);
  shape.lineTo(hs, baseY);
  shape.lineTo(hs * 0.82, topY);
  shape.quadraticCurveTo(0, baseY + (topY - baseY) * 0.72, -hs * 0.82, topY);
  shape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeLen,
    bevelEnabled: true,
    bevelThickness: 0.0011,
    bevelSize: 0.0009,
    bevelSegments: 2,
    curveSegments: 12,
  });
  if (isCross) {
    // Profile spans X, extrudes along Z
    extrudeGeo.translate(0, 0, -extrudeLen / 2);
  } else {
    // Profile spans Z, extrudes along X
    extrudeGeo.rotateY(Math.PI / 2);
    extrudeGeo.translate(-extrudeLen / 2, 0, 0);
  }

  const capMat = new THREE.MeshStandardMaterial({
    color: 0x15151a,
    roughness: 0.58,
    metalness: 0.16,
  });
  const capMesh = new THREE.Mesh(extrudeGeo, capMat);
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  grp.add(capMesh);

  // Crisp molded white center index blade embedded in the saddle valley
  const lineGeo = isCross
    ? new THREE.BoxGeometry(0.0022, 0.0018, extrudeLen + 0.0018)
    : new THREE.BoxGeometry(extrudeLen + 0.0018, 0.0018, 0.0022);
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf1f0ec,
    emissive: new THREE.Color(0xf1f0ec),
    emissiveIntensity: 0.22,
    roughness: 0.32,
    metalness: 0.05,
  });
  const lineMesh = new THREE.Mesh(lineGeo, lineMat);
  lineMesh.position.y = baseY + (topY - baseY) * 0.87;
  grp.add(lineMesh);

  return grp;
}

/**
 * Builds physical countersunk black-anodized Torx/Phillips faceplate screws
 * so hardware decks have unmistakable bolted industrial depth.
 */
export function buildPanelScrews(
  dev: DeviceFrame,
  coordsPx: readonly (readonly [number, number])[],
  panelY: number,
): THREE.Group {
  const grp = new THREE.Group();
  grp.name = "Faceplate-Screws";
  const headR = 0.0028;
  const headGeo = new THREE.CylinderGeometry(headR, headR * 0.85, 0.0011, 16);
  const rimGeo = new THREE.RingGeometry(headR * 0.92, headR * 1.28, 16);
  rimGeo.rotateX(-Math.PI / 2);
  const slotGeo = new THREE.BoxGeometry(headR * 1.2, 0.0005, 0.0006);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x222229, roughness: 0.28, metalness: 0.85 });
  const recessMat = new THREE.MeshStandardMaterial({ color: 0x040406, roughness: 0.92, metalness: 0.1 });

  for (const [px, py] of coordsPx) {
    const [x, z] = local(dev, px, py);
    const s = new THREE.Group();
    s.position.set(x, panelY + 0.0012, z);
    const rim = new THREE.Mesh(rimGeo, recessMat);
    rim.position.y = 0.0002;
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.0005;
    const slot1 = new THREE.Mesh(slotGeo, recessMat);
    slot1.position.y = 0.00105;
    slot1.rotation.y = (px * 0.13 + py * 0.07) % Math.PI;
    const slot2 = new THREE.Mesh(slotGeo, recessMat);
    slot2.position.y = 0.00105;
    slot2.rotation.y = slot1.rotation.y + Math.PI / 2;
    s.add(rim, head, slot1, slot2);
    grp.add(s);
  }
  return grp;
}

/**
 * Builds photorealistic Pioneer DJM-A9 rotary potentiometers matching official `djm-eq.webp`:
 *  - Grounded contact ambient occlusion disc
 *  - Signature machined brushed-aluminum flared lower skirt collar (catches crisp studio highlights!)
 *  - Satin charcoal-graphite 14-rib elastomer grip barrel (NOT flat void black!)
 *  - Distinct satin graphite recessed crown cap
 *  - Thin, flush inlaid warm-white indicator stripe wrapping cleanly over the front shoulder
 */
export function buildPhysicalKnobs(
  dev: DeviceFrame,
  specs: { id: string; at: readonly [number, number]; r: number; h: number; angle?: number }[],
  panelY: number,
  mats: {
    barrel: THREE.Material;
    silver: THREE.Material;
    pointer: THREE.Material;
    aoTex: THREE.Texture | null;
  },
): THREE.Group {
  const root = new THREE.Group();
  root.name = "Physical-Knobs";

  const aoMat = mats.aoTex
    ? new THREE.MeshBasicMaterial({
        map: mats.aoTex,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    : null;

  // Authentic charcoal-graphite soft-touch elastomer grip + slightly lighter satin graphite top cap
  const gripElastomerMat = new THREE.MeshPhysicalMaterial({
    color: 0x262830,
    roughness: 0.5,
    metalness: 0.18,
    clearcoat: 0.16,
    clearcoatRoughness: 0.44,
    normalMap: (mats.barrel as THREE.MeshStandardMaterial).normalMap ?? null,
    normalScale: new THREE.Vector2(0.28, 0.28),
  });
  const knobCapMat = new THREE.MeshPhysicalMaterial({
    color: 0x32353f,
    roughness: 0.36,
    metalness: 0.34,
    clearcoat: 0.24,
    clearcoatRoughness: 0.3,
  });
  const skirtSilverMat = new THREE.MeshStandardMaterial({
    color: 0xb6bcc8,
    roughness: 0.24,
    metalness: 0.9,
  });
  const inlayPointerMat = new THREE.MeshStandardMaterial({
    color: 0xeeece6,
    roughness: 0.42,
    metalness: 0.04,
  });

  // High-resolution sculpted 14-rib grip barrel + flared brushed-aluminum base skirt (like djm-eq.webp!)
  const unitBarrel = createFlutedKnobBarrelGeo(0.79, 0.96, 1.0, 14, 0.068, 84);
  const unitBaseCollar = new THREE.CylinderGeometry(0.95, 1.09, 0.15, 56);
  const unitCrownDisc = new THREE.CylinderGeometry(0.68, 0.75, 0.04, 56);
  const unitAo = new THREE.PlaneGeometry(1, 1);
  unitAo.rotateX(-Math.PI / 2);

  for (const k of specs) {
    const [x, z] = local(dev, k.at[0], k.at[1]);
    const r = k.r / dev.pxPerM;
    const h = k.h * 1.08;
    const angle = k.angle ?? 0;

    if (aoMat) {
      const ao = new THREE.Mesh(unitAo, aoMat);
      ao.scale.set(r * 2.7, 1, r * 2.7);
      ao.position.set(x, panelY + 0.00145, z);
      root.add(ao);
    }

    const pivot = new THREE.Group();
    pivot.position.set(x, panelY + 0.0013, z);
    pivot.rotation.y = angle;
    pivot.name = k.id;

    // Signature machined brushed-aluminum flared base collar
    const collar = new THREE.Mesh(unitBaseCollar, skirtSilverMat);
    collar.scale.set(r, h, r);
    collar.position.y = h * 0.075;
    collar.castShadow = true;
    collar.receiveShadow = true;
    pivot.add(collar);

    // Sculpted 14-rib charcoal elastomer barrel
    const barrel = new THREE.Mesh(unitBarrel, gripElastomerMat);
    barrel.scale.set(r, h, r);
    barrel.position.y = h / 2;
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    pivot.add(barrel);

    // Distinct satin graphite top cap
    const cap = new THREE.Mesh(unitCrownDisc, knobCapMat);
    cap.scale.set(r, h, r);
    cap.position.y = h * 0.984;
    pivot.add(cap);

    // Flush-inlaid warm off-white indicator line (top + cleanly seated front groove)
    const finW = Math.max(0.00105, r * 0.11);
    const topFinGeo = new RoundedBoxGeometry(finW, 0.00065, r * 0.66, 2, 0.00025);
    const topFin = new THREE.Mesh(topFinGeo, inlayPointerMat);
    topFin.position.set(0, h * 1.001, -r * 0.36);
    pivot.add(topFin);

    const sideFinGeo = new RoundedBoxGeometry(finW, h * 0.42, 0.0008, 2, 0.00025);
    const sideFin = new THREE.Mesh(sideFinGeo, inlayPointerMat);
    sideFin.position.set(0, h * 0.72, -r * 0.77);
    sideFin.rotation.x = -0.2;
    pivot.add(sideFin);

    root.add(pivot);
  }

  return root;
}
