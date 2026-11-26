import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DJM } from "./layout";
import {
  applyPlanarUV,
  buildContouredFaderCap,
  buildPanelScrews,
  buildPhysicalKnobs,
  buildSeparatedRectKeycap,
  buildSeparatedRoundKeycap,
  createFlutedKnobBarrelGeo,
  createPanelMaterial,
  createSeamlessKnobPointerGeo,
  createSpunMetalCapTexture,
  local,
  rectToUV,
  type PanelUniforms,
} from "./materials";
import type { CdjSharedMaterials } from "./cdj";

export interface DjmTextures {
  top: THREE.Texture;
  topEmissive: THREE.Texture;
  front: THREE.Texture;
  faderCap: THREE.Texture;
}

export interface DjmRig {
  group: THREE.Group;
  panel: PanelUniforms;
  /** Sound Color FX knobs (index 0..3 for ch1..ch4) */
  colorKnobs: THREE.Group[];
  /** Physical 3D CENTER LOCK slide switch nub (moves left/right when toggled!) */
  centerLockSwitch: { set(locked: boolean): void };
  /** Movable channel faders (index 0..3 for ch1..ch4) */
  faders: { mesh: THREE.Object3D; zMin: number; zMax: number; set(v: number): void }[];
  /** Movable 3rd-gen MAGVEL FADER crossfader */
  crossfader: { mesh: THREE.Object3D; xMin: number; xMax: number; set(v: number): void };
  /** Glowing Beat FX ON/OFF dome light */
  beatFxDomeMat: THREE.MeshPhysicalMaterial;
  /** Dynamic 3D Beat FX OLED display updater + live X-PAD glow strip */
  updateBeatFxScreen(opts: {
    fxName: string;
    division: string;
    xpadPos: number;
    freqMask: { low: boolean; mid: boolean; hi: boolean };
    active: boolean;
    power: number;
    time: number;
  }): void;
  /** Interactive hit targets for raycasting */
  hitTargets: { ch2Fader: THREE.Object3D; ch2Filter: THREE.Object3D; crossfader: THREE.Object3D; beatFxDome: THREE.Mesh };
  /** Device-local anchors in metres */
  anchors: Record<string, THREE.Vector3>;
  dispose(): void;
}

const TOP_Y = DJM.feetH + DJM.bodyH;

/** Authentic mid-set DJ knob positions (radians) so the mixer feels alive & human, never factory-sterile! */
const LIVED_IN_KNOB_ANGLES: Record<string, number> = {
  "ch1-input": -0.65,
  "ch1-trim": -0.35,
  "ch1-hi": 0.12,
  "ch1-mid": -0.18,
  "ch1-low": -0.45,
  // Ch 2 (Visitor's incoming track — classic DJ bass-kill transition ready to drop!)
  "ch2-input": -0.22,
  "ch2-trim": 0.08,
  "ch2-hi": 0.06,
  "ch2-mid": -0.32,
  "ch2-low": -1.85,
  // Ch 3 (Active live room track — dialed cleanly with human micro-offset)
  "ch3-input": -0.2,
  "ch3-trim": 0.14,
  "ch3-hi": 0.16,
  "ch3-mid": -0.05,
  "ch3-low": 0.08,
  // Ch 4 (Standby)
  "ch4-input": 0.52,
  "ch4-trim": -0.85,
  "ch4-hi": -0.08,
  "ch4-mid": 0.04,
  "ch4-low": -0.14,
  // Mic / Headphones / Master / Booth / Beat FX
  mic1: -1.9,
  mic2: -2.1,
  "mic-hi": 0.05,
  "mic-low": -0.1,
  "micfx-param": -0.4,
  "micrev-param": -0.8,
  "scfx-param": 0.42,
  "phonesA-mix": 0.18,
  "phonesA-level": 0.72,
  master: 0.62,
  "booth-hi": 0.15,
  "booth-low": -0.12,
  "booth-level": 0.45,
  "phonesB-mix": -0.25,
  "phonesB-level": 0.5,
  "send-ch": -0.5,
  "send-level": -0.3,
  "fx-select": -0.55,
  "fx-time": 0.25,
  "fx-depth": 0.58,
};

/** Physical countersunk faceplate screw positions measured from djm_0..djm_3 (crop px). */
const DJM_SCREWS_PX: readonly (readonly [number, number])[] = [
  [18, 22],
  [272, 22],
  [540, 22],
  [798, 22],
  [1044, 22],
  [18, 725],
  [232, 690],
  [232, 1072],
  [272, 1072],
  [742, 1072],
  [798, 1072],
  [1044, 1072],
  [488, 690],
  [488, 948],
];

export function buildDjm(tex: DjmTextures, shared: CdjSharedMaterials): DjmRig {
  const group = new THREE.Group();
  group.name = "DJM-A9";
  const dev = DJM;
  const disposables: { dispose(): void }[] = [];

  // Chassis (407.4 × 458.3 × 107.9 mm) with bead-blasted aluminum patina
  const bodyGeo = new RoundedBoxGeometry(dev.width, dev.bodyH, dev.bodyDepth, 5, 0.005);
  const body = new THREE.Mesh(bodyGeo, shared.chassis);
  body.position.set(0, dev.feetH + dev.bodyH / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  disposables.push(bodyGeo);

  // Subtle metallic bevel frame around top deck perimeter
  const rimFrameGeo = new RoundedBoxGeometry(dev.width + 0.001, 0.003, dev.bodyDepth + 0.001, 3, 0.0012);
  const rimFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1c1c22,
    roughness: 0.42,
    metalness: 0.62,
    normalMap: shared.maps.anodizedNormal,
    normalScale: new THREE.Vector2(0.14, 0.14),
  });
  const rimFrame = new THREE.Mesh(rimFrameGeo, rimFrameMat);
  rimFrame.position.set(0, TOP_Y - 0.002, 0);
  group.add(rimFrame);
  disposables.push(rimFrameGeo, rimFrameMat);

  // Photographed top panel with 6 live 15-segment LED meter columns + organic bead-blast patina
  const meterRects = dev.meters.map((m) => rectToUV(dev, m));
  const { material: panelMat, uniforms: panel } = createPanelMaterial(tex.top, tex.topEmissive, meterRects, {
    normalMap: shared.maps.anodizedNormal,
    roughnessMap: shared.maps.anodizedRoughness,
    normalScale: 0.14,
    roughness: 0.72,
    metalness: 0.3,
  });
  disposables.push(panelMat);

  const topGeo = new THREE.PlaneGeometry(dev.width - 0.003, dev.bodyDepth - 0.003, 1, 1);
  topGeo.rotateX(-Math.PI / 2);
  topGeo.translate(0, TOP_Y + 0.0012, 0);
  applyPlanarUV(topGeo, dev);
  const top = new THREE.Mesh(topGeo, panelMat);
  top.receiveShadow = true;
  group.add(top);
  disposables.push(topGeo);

  // Official front face elevation (preserves Pioneer DJ logo + Headphones A/B jacks)
  const frontMat = new THREE.MeshStandardMaterial({
    map: tex.front,
    roughness: 0.66,
    metalness: 0.3,
    normalMap: shared.maps.anodizedNormal,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughnessMap: shared.maps.anodizedRoughness,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const frontGeo = new THREE.PlaneGeometry(dev.width - 0.006, dev.bodyH - 0.004);
  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.set(0, dev.feetH + dev.bodyH / 2, dev.bodyDepth / 2 + 0.0012);
  group.add(front);
  disposables.push(frontMat, frontGeo);

  // Low-profile isolator feet
  const footGeo = new THREE.CylinderGeometry(0.022, 0.021, Math.max(0.004, dev.feetH + 0.002), 28);
  disposables.push(footGeo);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new THREE.Mesh(footGeo, shared.rubber);
      f.position.set(sx * (dev.width / 2 - 0.036), dev.feetH / 2, sz * (dev.bodyDepth / 2 - 0.04));
      group.add(f);
    }
  }

  // Physical countersunk faceplate screws (14 bolted fasteners!)
  const screws = buildPanelScrews(dev, DJM_SCREWS_PX, TOP_Y);
  group.add(screws);

  // =========================================================================
  // PHYSICAL 3D FLUTED ROTARY KNOBS (with lived-in mid-set angles & AO shadows!)
  // =========================================================================
  const pointerMat = new THREE.MeshStandardMaterial({
    color: 0xf1f0ec,
    roughness: 0.32,
    metalness: 0.08,
  });
  disposables.push(pointerMat);

  const knobSpecsWithAngles = dev.knobs.map((k) => ({
    ...k,
    angle: LIVED_IN_KNOB_ANGLES[k.id] ?? 0,
  }));
  const physicalKnobs = buildPhysicalKnobs(dev, knobSpecsWithAngles, TOP_Y, {
    barrel: shared.knobSide,
    silver: shared.silver,
    pointer: pointerMat,
    aoTex: shared.maps.contactAo,
  });
  group.add(physicalKnobs);

  // =========================================================================
  // SCULPTED 16-FLUTE MACHINED ALUMINUM SOUND COLOR FX KNOBS (Matches `djm-color.webp`)
  // Compact footprint leaves the printed LOW—LOCK—HI faceplate arc 100% clear!
  // =========================================================================
  const colorKnobs: THREE.Group[] = [];
  const spunCapTex = createSpunMetalCapTexture();
  const colorBarrelMat = new THREE.MeshPhysicalMaterial({
    color: 0x262932,
    roughness: 0.32,
    metalness: 0.84,
    clearcoat: 0.22,
    clearcoatRoughness: 0.26,
  });
  const colorBevelMat = new THREE.MeshStandardMaterial({
    color: 0x8e95a4,
    roughness: 0.22,
    metalness: 0.94,
  });
  const colorCrownMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: spunCapTex,
    roughness: 0.26,
    metalness: 0.88,
    clearcoat: 0.26,
    clearcoatRoughness: 0.22,
    normalMap: shared.maps.radialNormal,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: shared.maps.radialRoughness,
  });
  const colorSeatMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c0f,
    roughness: 0.8,
    metalness: 0.2,
  });
  const aoDiscMat = shared.maps.contactAo
    ? new THREE.MeshBasicMaterial({
        map: shared.maps.contactAo,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    : null;
  disposables.push(colorBarrelMat, colorBevelMat, colorCrownMat, colorSeatMat);
  if (spunCapTex) disposables.push(spunCapTex);
  if (aoDiscMat) disposables.push(aoDiscMat);

  const initialColorAngles = [-0.25, 0, 0.18, 0];
  for (let i = 0; i < dev.color.length; i++) {
    const ck = dev.color[i]!;
    const [kx, kz] = local(dev, ck.at[0], ck.at[1]);
    const r = ck.r / dev.pxPerM;
    const h = ck.h * 0.86;
    const rTop = r * 0.76;
    const rBot = r * 0.89;

    if (aoDiscMat) {
      const aoGeo = new THREE.PlaneGeometry(r * 2.2, r * 2.2);
      aoGeo.rotateX(-Math.PI / 2);
      const ao = new THREE.Mesh(aoGeo, aoDiscMat);
      ao.position.set(kx, TOP_Y + 0.0014, kz);
      group.add(ao);
      disposables.push(aoGeo);
    }

    const pivot = new THREE.Group();
    pivot.position.set(kx, TOP_Y + 0.0013, kz);
    pivot.rotation.y = initialColorAngles[i] ?? 0;
    pivot.name = ck.id;

    // Subtle dark base seat (NO bulky silver washer covering the printed faceplate arc!)
    const seatGeo = new THREE.CylinderGeometry(rBot * 0.96, rBot * 1.0, h * 0.07, 48);
    const seat = new THREE.Mesh(seatGeo, colorSeatMat);
    seat.position.y = h * 0.035;
    pivot.add(seat);

    // High-resolution 16-flute machined dark-anodized aluminum grip barrel
    const barrelGeo = createFlutedKnobBarrelGeo(rTop, rBot, h, 16, 0.105, 128);
    const barrel = new THREE.Mesh(barrelGeo, colorBarrelMat);
    barrel.position.y = h / 2;
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    pivot.add(barrel);

    // Razor diamond-cut metallic rim ring right around the top bevel (like djm-color.webp!)
    const bevelRingGeo = new THREE.TorusGeometry(rTop * 0.89, 0.00042, 12, 64);
    bevelRingGeo.rotateX(Math.PI / 2);
    const bevelRing = new THREE.Mesh(bevelRingGeo, colorBevelMat);
    bevelRing.position.y = h * 0.965;
    pivot.add(bevelRing);

    // Anisotropic conical spun-metal top cap
    const crownCapGeo = new THREE.CylinderGeometry(rTop * 0.84, rTop * 0.86, 0.0006, 64);
    const crownCap = new THREE.Mesh(crownCapGeo, colorCrownMat);
    crownCap.position.y = h * 0.992;
    pivot.add(crownCap);

    // Single seamless rounded white indicator inlaid flush over the front shoulder
    const pointerGeo = createSeamlessKnobPointerGeo(rTop, rBot, h, 0.00135);
    const pointer = new THREE.Mesh(pointerGeo, pointerMat);
    pivot.add(pointer);

    group.add(pivot);
    colorKnobs.push(pivot);
    disposables.push(seatGeo, barrelGeo, bevelRingGeo, crownCapGeo, pointerGeo);
  }

  // =========================================================================
  // SEPARATED 3D BUTTONS, FROSTED ACRYLIC KEYCAPS, SLIDE SWITCHES & JACKS
  // (Solid dark-rubber or glowing translucent acrylic walls — NO smeared sides!)
  // =========================================================================
  const wellGeos: THREE.BufferGeometry[] = [];
  const darkBodyGeos: THREE.BufferGeometry[] = [];
  const amberBodyGeos: THREE.BufferGeometry[] = [];
  const whiteAcrylicGeos: THREE.BufferGeometry[] = [];
  const blueAcrylicGeos: THREE.BufferGeometry[] = [];
  const redAcrylicGeos: THREE.BufferGeometry[] = [];
  const faceGeos: THREE.BufferGeometry[] = [];
  const roundSkirtGeos: THREE.BufferGeometry[] = [];

  const pushRect = (
    cx: number,
    cy: number,
    wPx: number,
    hPx: number,
    heightM: number,
    bucket: THREE.BufferGeometry[],
  ) => {
    const { well, body: b, face } = buildSeparatedRectKeycap(dev, cx, cy, wPx, hPx, heightM, TOP_Y + 0.0012);
    wellGeos.push(well);
    bucket.push(b);
    faceGeos.push(face);
  };

  const pushRound = (cx: number, cy: number, rPx: number, heightM: number) => {
    const { well, skirt, face } = buildSeparatedRoundKeycap(dev, cx, cy, rPx, heightM, TOP_Y + 0.0012);
    wellGeos.push(well);
    roundSkirtGeos.push(skirt);
    faceGeos.push(face);
  };

  // 1) Exact 0.0px pixel-measured 6 Sound Color FX frosted translucent keycaps (djm-scfx-6.png!)
  for (const px of [166.5, 221.5]) {
    for (const py of [518, 572, 627]) {
      pushRect(px, py, 37, 26, 0.0054, whiteAcrylicGeos);
    }
  }

  // 2) Exact 0.0px pixel-measured 10 Translucent Amber CUE A/B pads (djm-cue-row.png!)
  for (const cx of dev.channelX) {
    pushRect(cx - 20, 640.5, 46, 29, 0.0058, amberBodyGeos);
    pushRect(cx + 29, 640.5, 32, 29, 0.0058, amberBodyGeos);
  }
  pushRect(758, 640.5, 46, 29, 0.0058, amberBodyGeos); // Master CUE A
  pushRect(807, 640.5, 32, 29, 0.0058, amberBodyGeos); // Master CUE B

  // 3) 5 Glowing Blue BEAT FX assign LED indicator pills beneath each CUE row
  for (const cx of [...dev.channelX, 778]) {
    pushRect(cx - 22, 681, 16, 9, 0.003, blueAcrylicGeos);
  }

  // 4) Left Mic / Phantom / Bluetooth / MIDI / Headphones A & B controls (EXACT crop-px centers on djm-top.webp!)
  pushRect(192, 186, 40, 24, 0.005, redAcrylicGeos); // +48V Phantom
  pushRect(192, 256, 40, 24, 0.0046, darkBodyGeos); // Bluetooth Pairing
  pushRect(192, 325, 40, 24, 0.0046, darkBodyGeos); // MIDI ON/OFF
  pushRect(192, 381, 40, 24, 0.0046, darkBodyGeos); // MIDI START/STOP
  pushRound(68, 456, 12, 0.005); // TALKOVER
  pushRect(68, 521, 38, 22, 0.0052, blueAcrylicGeos); // MIC FX ECHO
  pushRect(68, 576, 38, 22, 0.0052, blueAcrylicGeos); // MIC FX PITCH
  pushRect(68, 630, 38, 22, 0.0052, blueAcrylicGeos); // MIC FX MEGAPHONE
  pushRect(68, 787, 38, 22, 0.0052, blueAcrylicGeos); // MIC REVERB ON
  pushRound(68, 1004, 18, 0.006); // MIC PUSH TO TALK ON
  pushRect(163, 787, 38, 24, 0.0048, darkBodyGeos); // PHONES A LINK CUE
  pushRect(221, 787, 38, 24, 0.0048, darkBodyGeos); // PHONES A MONO SPLIT
  pushRect(751, 739, 32, 24, 0.0048, darkBodyGeos); // PHONES B LINK CUE
  pushRect(811, 739, 32, 24, 0.0048, darkBodyGeos); // PHONES B MONO SPLIT

  // 5) Right Beat FX & Multi I/O controls (EXACT crop-px centers measured directly on djm-top.webp!)
  pushRound(946, 171, 18, 0.0058); // INSERT blue button
  pushRect(901, 469, 42, 20, 0.0052, darkBodyGeos); // BEAT <
  pushRect(991, 469, 42, 20, 0.0052, darkBodyGeos); // BEAT >
  pushRound(895, 521, 11, 0.0052); // AUTO/TAP
  pushRound(946, 521, 18, 0.0064); // TAP (green-ringed button)
  pushRound(996, 521, 11, 0.0052); // QUANTIZE / UTILITY
  for (const fxX of [895, 946, 997]) {
    pushRect(fxX, 582, 38, 24, 0.0054, blueAcrylicGeos); // FX FREQUENCY LOW / MID / HI
  }
  for (const chX of [884, 926, 968, 1010]) {
    pushRect(chX, 725, 32, 18, 0.0052, blueAcrylicGeos); // CH SELECT 1 2 3 4
    pushRect(chX, 775, 32, 18, 0.0052, blueAcrylicGeos); // CH SELECT MIC CF.A CF.B MST
  }

  // Solid materials for separated keycap walls (translucent acrylics glow subtly from inside!)
  const darkKeycapMat = new THREE.MeshStandardMaterial({
    color: 0x141419,
    roughness: 0.64,
    metalness: 0.12,
    normalMap: shared.maps.rubberNormal,
    normalScale: new THREE.Vector2(0.24, 0.24),
  });
  const amberAcrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xc27014,
    emissive: new THREE.Color(0xe68816),
    emissiveIntensity: 0.48,
    roughness: 0.28,
    metalness: 0.06,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
  });
  const whiteAcrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0x585d68,
    emissive: new THREE.Color(0x9aa6bd),
    emissiveIntensity: 0.2,
    roughness: 0.34,
    metalness: 0.14,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
  });
  const blueAcrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a4eb8,
    emissive: new THREE.Color(0x2e72ee),
    emissiveIntensity: 0.52,
    roughness: 0.28,
    metalness: 0.06,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
  });
  const redAcrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0x991b22,
    emissive: new THREE.Color(0xd62832),
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.06,
    clearcoat: 0.45,
  });
  disposables.push(darkKeycapMat, amberAcrylicMat, whiteAcrylicMat, blueAcrylicMat, redAcrylicMat);

  const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, castShadow = true) => {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos)!;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    disposables.push(...geos, merged);
  };

  addMerged(wellGeos, shared.bezel, false);
  addMerged(darkBodyGeos, darkKeycapMat, true);
  addMerged(amberBodyGeos, amberAcrylicMat, true);
  addMerged(whiteAcrylicGeos, whiteAcrylicMat, true);
  addMerged(blueAcrylicGeos, blueAcrylicMat, true);
  addMerged(redAcrylicGeos, redAcrylicMat, true);
  addMerged(roundSkirtGeos, darkKeycapMat, true);
  addMerged(faceGeos, panelMat, false);

  // Glowing green ring around BEAT FX TAP button + blue ring around MIC ON button
  const addHaloRing = (cx: number, cy: number, rPx: number, hex: number) => {
    const [rx, rz] = local(dev, cx, cy);
    const r = (rPx / dev.pxPerM) * 0.96;
    const g = new THREE.TorusGeometry(r, 0.0012, 12, 40);
    g.rotateX(Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({
      color: hex,
      emissive: new THREE.Color(hex),
      emissiveIntensity: 1.65,
      roughness: 0.22,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(rx, TOP_Y + 0.0042, rz);
    group.add(mesh);
    disposables.push(g, m);
  };
  addHaloRing(946, 521, 18, 0x38c962); // TAP (exact cropX=946, cropY=521!)
  addHaloRing(68, 1004, 18, 0x3b82f6); // MIC ON (exact cropX=68, cropY=1004!)

  // =========================================================================
  // PHYSICAL 3D SLIDE SWITCHES (CENTER LOCK, 4× A/THRU/B, 3× CURVE SWITCHES)
  // =========================================================================
  const buildSlideSwitch = (cx: number, cy: number, horiz: boolean, offsetPx = 0) => {
    const [sx, sz] = local(dev, cx, cy);
    const slotW = (horiz ? 40 : 18) / dev.pxPerM;
    const slotD = (horiz ? 18 : 34) / dev.pxPerM;
    const wellGeo = new RoundedBoxGeometry(slotW, 0.0018, slotD, 1, 0.0005);
    const well = new THREE.Mesh(wellGeo, shared.bezel);
    well.position.set(sx, TOP_Y + 0.0013, sz);
    group.add(well);

    const nubW = (horiz ? 14 : 13) / dev.pxPerM;
    const nubD = (horiz ? 13 : 14) / dev.pxPerM;
    const nubGeo = new RoundedBoxGeometry(nubW, 0.0068, nubD, 2, 0.0009);
    const nub = new THREE.Mesh(nubGeo, darkKeycapMat);
    const offM = offsetPx / dev.pxPerM;
    nub.position.set(sx + (horiz ? offM : 0), TOP_Y + 0.0046, sz + (horiz ? 0 : offM));
    nub.castShadow = true;
    group.add(nub);
    disposables.push(wellGeo, nubGeo);
    return { nub, baseX: sx, baseZ: sz };
  };

  const clSwitch = buildSlideSwitch(192, 466, true, 6); // CENTER LOCK ON/OFF
  const centerLockSwitch = {
    set(locked: boolean) {
      const offM = (locked ? 6 : -6) / dev.pxPerM;
      clSwitch.nub.position.x = clSwitch.baseX + offM;
    },
  };
  buildSlideSwitch(946, 90, false, -4); // MULTI I/O INSERT SOURCE (RETURN / USB)
  for (let i = 0; i < dev.channelX.length; i++) {
    const off = i === 1 ? -7 : i === 2 ? 7 : 0; // Ch 2 -> A, Ch 3 -> B, Ch 1/4 -> THRU!
    buildSlideSwitch(dev.channelX[i]!, 948, true, off);
  }
  buildSlideSwitch(777, 924, true, -4); // EQ CURVE (ISO)
  buildSlideSwitch(777, 976, true, 0); // CH FADER curve
  buildSlideSwitch(777, 1030, true, 5); // CROSSFADER sharp cut

  // Recessed USB A / B bays with raised covers + glowing blue indicator strips (exact crop-px!)
  for (const ux of [70, 190]) {
    const [bx, bz] = local(dev, ux, 96);
    const bayGeo = new RoundedBoxGeometry(90 / dev.pxPerM, 0.0022, 60 / dev.pxPerM, 2, 0.0008);
    const bay = new THREE.Mesh(bayGeo, shared.bezel);
    bay.position.set(bx, TOP_Y + 0.0016, bz);
    group.add(bay);
    const coverGeo = new RoundedBoxGeometry(80 / dev.pxPerM, 0.0038, 46 / dev.pxPerM, 2, 0.001);
    const cover = new THREE.Mesh(coverGeo, darkKeycapMat);
    cover.position.set(bx, TOP_Y + 0.0028, bz - 0.002);
    cover.castShadow = true;
    group.add(cover);
    const ledGeo = new THREE.BoxGeometry(72 / dev.pxPerM, 0.001, 0.0018);
    const led = new THREE.Mesh(ledGeo, blueAcrylicMat);
    led.position.set(bx, TOP_Y + 0.0022, bz + 0.0102);
    group.add(led);
    disposables.push(bayGeo, coverGeo, ledGeo);
  }

  // 3D Gold-ringed 1/4" Headphone A jack on top deck (exact cropX=192, cropY=1058!)
  {
    const [jx, jz] = local(dev, 192, 1058);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a448, roughness: 0.24, metalness: 0.92 });
    const ringGeo = new THREE.TorusGeometry(0.0056, 0.0012, 12, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.set(jx, TOP_Y + 0.002, jz);
    const holeGeo = new THREE.CylinderGeometry(0.0044, 0.0044, 0.0022, 24);
    const hole = new THREE.Mesh(holeGeo, shared.bezel);
    hole.position.set(jx, TOP_Y + 0.0014, jz);
    group.add(ring, hole);
    disposables.push(goldMat, ringGeo, holeGeo);
  }

  // 6 Recessed Acrylic LED Meter Lens Channels (open hollow bezel rails + clearcoat lens so LEDs shine brightly!)
  const meterLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x101218,
    transparent: true,
    opacity: 0.16,
    roughness: 0.06,
    metalness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    depthWrite: false,
  });
  disposables.push(meterLensMat);
  const meterRailGeos: THREE.BufferGeometry[] = [];
  for (const m of dev.meters) {
    const [x0, z0] = local(dev, m.x0, m.y0);
    const [x1, z1] = local(dev, m.x1, m.y1);
    const mw = x1 - x0;
    const md = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const railT = 0.0012;
    const railH = 0.0022;

    // Left & right raised dark bezel rails framing the 15-segment LED strip without blocking it!
    for (const sx of [-1, 1]) {
      const rRaw = new THREE.BoxGeometry(railT, railH, md + railT * 2);
      const rGeo = rRaw.index ? rRaw.toNonIndexed() : rRaw;
      if (rRaw !== rGeo) rRaw.dispose();
      rGeo.translate(cx + sx * (mw / 2 + railT / 2), TOP_Y + 0.0014 + railH / 2, cz);
      meterRailGeos.push(rGeo);
    }
    for (const sz of [-1, 1]) {
      const capRaw = new THREE.BoxGeometry(mw + railT * 2, railH, railT);
      const capGeo = capRaw.index ? capRaw.toNonIndexed() : capRaw;
      if (capRaw !== capGeo) capRaw.dispose();
      capGeo.translate(cx, TOP_Y + 0.0014 + railH / 2, cz + sz * (md / 2 + railT / 2));
      meterRailGeos.push(capGeo);
    }

    const lensGeo = new THREE.PlaneGeometry(mw, md);
    lensGeo.rotateX(-Math.PI / 2);
    const lens = new THREE.Mesh(lensGeo, meterLensMat);
    lens.position.set(cx, TOP_Y + 0.0033, cz);
    group.add(lens);
    disposables.push(lensGeo);
  }
  addMerged(meterRailGeos, shared.bezel, false);

  // Recessed X-PAD capacitive touch strip + authentic dotted electric-blue LED bar (matches real DJM-A9!)
  const xp = dev.xpad;
  const [xpx0, xpz0] = local(dev, xp.x0, xp.y0);
  const [xpx1, xpz1] = local(dev, xp.x1, xp.y1);
  const xpW = xpx1 - xpx0;
  const xpD = xpz1 - xpz0;
  const xpGeo = new RoundedBoxGeometry(xpW, 0.0024, xpD, 2, 0.0007);
  const xpMat = new THREE.MeshPhysicalMaterial({
    color: 0x07080c,
    roughness: 0.14,
    metalness: 0.15,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
  });
  const xpMesh = new THREE.Mesh(xpGeo, xpMat);
  xpMesh.position.set((xpx0 + xpx1) / 2, TOP_Y + 0.0018, (xpz0 + xpz1) / 2);
  group.add(xpMesh);

  // Live dotted electric-blue LED line along the top groove of the X-PAD (just like official DJM-A9 photo!)
  const xpLedCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  let xpLedCtx: CanvasRenderingContext2D | null = null;
  let xpLedTex: THREE.CanvasTexture | null = null;
  if (xpLedCanvas) {
    xpLedCanvas.width = 256;
    xpLedCanvas.height = 16;
    xpLedCtx = xpLedCanvas.getContext("2d");
    xpLedTex = new THREE.CanvasTexture(xpLedCanvas);
    xpLedTex.colorSpace = THREE.SRGBColorSpace;
    disposables.push(xpLedTex);
  }
  const xpGlowGeo = new THREE.PlaneGeometry(xpW * 0.92, xpD * 0.16);
  xpGlowGeo.rotateX(-Math.PI / 2);
  const xpGlowMat = new THREE.MeshBasicMaterial({
    map: xpLedTex,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const xpGlow = new THREE.Mesh(xpGlowGeo, xpGlowMat);
  xpGlow.position.set((xpx0 + xpx1) / 2, TOP_Y + 0.00315, xpz0 + xpD * 0.24);
  group.add(xpGlow);
  disposables.push(xpGeo, xpMat, xpGlowGeo, xpGlowMat);

  // Beat FX glowing frosted-blue DOMED silicone ON/OFF button (exact cropX=946, cropY=1028!)
  const [bfxX, bfxZ] = local(dev, 946, 1028);
  const bfxWellGeo = new THREE.CylinderGeometry(0.0145, 0.015, 0.002, 40);
  const bfxWell = new THREE.Mesh(bfxWellGeo, shared.bezel);
  bfxWell.position.set(bfxX, TOP_Y + 0.0014, bfxZ);
  group.add(bfxWell);

  const beatFxDomeGeo = new THREE.SphereGeometry(0.0124, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.56);
  beatFxDomeGeo.scale(1, 0.65, 1);
  const beatFxDomeMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b82f6,
    emissive: new THREE.Color(0x4c96ff),
    emissiveIntensity: 1.5,
    roughness: 0.24,
    metalness: 0.05,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
  });
  const beatFxDome = new THREE.Mesh(beatFxDomeGeo, beatFxDomeMat);
  beatFxDome.name = "DJM-BeatFX-Dome";
  beatFxDome.position.set(bfxX, TOP_Y + 0.0028, bfxZ);
  beatFxDome.castShadow = true;
  group.add(beatFxDome);
  disposables.push(bfxWellGeo, beatFxDomeGeo, beatFxDomeMat);

  // =========================================================================
  // SCULPTED 3D CONTOURED CHANNEL FADERS + RECESSED DUST-GUARD TRACK SLOTS
  // =========================================================================
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.96, metalness: 0.04 });
  disposables.push(slotMat);

  const faders: DjmRig["faders"] = [];
  for (const f of dev.faders) {
    const [fx] = local(dev, f.capAt[0], f.capAt[1]);
    const [, zSlot0] = local(dev, f.capAt[0], f.slot.y0);
    const [, zSlot1] = local(dev, f.capAt[0], f.slot.y1);
    const [, zTop] = local(dev, f.capAt[0], f.slot.y0 + 10);
    const [, zBot] = local(dev, f.capAt[0], f.slot.y1 - 10);

    // Real dark recessed dust-brush fader slot
    const slotGeo = new THREE.BoxGeometry(0.0038, 0.0014, zSlot1 - zSlot0);
    const slotMesh = new THREE.Mesh(slotGeo, slotMat);
    slotMesh.position.set(fx, TOP_Y + 0.0014, (zSlot0 + zSlot1) / 2);
    group.add(slotMesh);
    disposables.push(slotGeo);

    // Contoured P-LOCK saddle channel fader cap (sleek authentic proportions!)
    const w = f.capW / dev.pxPerM;
    const d = (f.capH * 1.15) / dev.pxPerM;
    const h = 0.0145;
    const capGroup = buildContouredFaderCap(w, d, h, "vertical-fader");
    capGroup.name = f.id;
    capGroup.position.set(fx, TOP_Y + 0.0012, zBot);
    group.add(capGroup);
    capGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        disposables.push(obj.geometry);
        if (Array.isArray(obj.material)) obj.material.forEach((m) => disposables.push(m));
        else disposables.push(obj.material);
      }
    });

    const set = (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      capGroup.position.z = zBot + (zTop - zBot) * clamped;
    };
    faders.push({ mesh: capGroup, zMin: zBot, zMax: zTop, set });
  }

  faders[0]?.set(0.15);
  faders[1]?.set(0.0);
  faders[2]?.set(0.88);
  faders[3]?.set(0.12);

  // =========================================================================
  // SCULPTED 3RD-GEN MAGVEL FADER CROSSFADER + RECESSED TRACK SLOT
  // =========================================================================
  const cf = dev.crossfader;
  const [cfx, cfz] = local(dev, cf.capAt[0], cf.capAt[1]);
  const [cfSlot0] = local(dev, cf.slot.x0, cf.capAt[1]);
  const [cfSlot1] = local(dev, cf.slot.x1, cf.capAt[1]);
  const [cfMin] = local(dev, cf.slot.x0 + 12, cf.capAt[1]);
  const [cfMax] = local(dev, cf.slot.x1 - 12, cf.capAt[1]);

  const cfSlotGeo = new THREE.BoxGeometry(cfSlot1 - cfSlot0, 0.0014, 0.004);
  const cfSlot = new THREE.Mesh(cfSlotGeo, slotMat);
  cfSlot.position.set((cfSlot0 + cfSlot1) / 2, TOP_Y + 0.0014, cfz);
  group.add(cfSlot);
  disposables.push(cfSlotGeo);

  const cfCap = buildContouredFaderCap((cf.capW * 1.18) / dev.pxPerM, cf.capH / dev.pxPerM, 0.014, "horizontal-crossfader");
  cfCap.name = "DJM-MAGVEL";
  cfCap.position.set(cfx, TOP_Y + 0.0012, cfz);
  group.add(cfCap);
  cfCap.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      disposables.push(obj.geometry);
      if (Array.isArray(obj.material)) obj.material.forEach((m) => disposables.push(m));
      else disposables.push(obj.material);
    }
  });

  const crossfader = {
    mesh: cfCap,
    xMin: cfMin,
    xMax: cfMax,
    set(v: number) {
      const c = Math.max(-1, Math.min(1, v));
      cfCap.position.x = cfx + ((cfMax - cfMin) * 0.5) * c;
    },
  };

  // =========================================================================
  // LIVE DYNAMIC 3D BEAT FX COLOUR OLED DISPLAY (CanvasTexture updated live!)
  // =========================================================================
  const bfx = dev.beatFxDisplay;
  const [bx0, bz0] = local(dev, bfx.x0, bfx.y0);
  const [bx1, bz1] = local(dev, bfx.x1, bfx.y1);

  const bfxCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  let bfxCtx: CanvasRenderingContext2D | null = null;
  let bfxTex: THREE.CanvasTexture | null = null;
  if (bfxCanvas) {
    bfxCanvas.width = 384;
    bfxCanvas.height = 310;
    bfxCtx = bfxCanvas.getContext("2d");
    bfxTex = new THREE.CanvasTexture(bfxCanvas);
    bfxTex.colorSpace = THREE.SRGBColorSpace;
    bfxTex.anisotropy = 4;
    disposables.push(bfxTex);
  }

  const bfxGlassGeo = new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0);
  bfxGlassGeo.rotateX(-Math.PI / 2);
  const bfxGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x040507,
    roughness: 0.055,
    metalness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: bfxTex,
    emissiveIntensity: 1.35,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const bfxGlass = new THREE.Mesh(bfxGlassGeo, bfxGlassMat);
  bfxGlass.position.set((bx0 + bx1) / 2, TOP_Y + 0.0024, (bz0 + bz1) / 2);
  group.add(bfxGlass);
  disposables.push(bfxGlassGeo, bfxGlassMat);

  let lastDrawTime = -1;
  const updateBeatFxScreen: DjmRig["updateBeatFxScreen"] = ({
    fxName,
    division,
    xpadPos,
    freqMask,
    active,
    power,
    time,
  }) => {
    const clampedX = Math.max(0, Math.min(1, xpadPos));
    xpGlowMat.opacity = Math.max(0, (power - 0.08) / 0.92) * (active ? 1.0 : 0.72);
    bfxGlassMat.emissiveIntensity = Math.max(0, (power - 0.08) / 0.92) * (active ? 1.45 : 1.18);

    if (!bfxCtx || !bfxTex || !bfxCanvas) return;
    if (time - lastDrawTime < 0.04 && lastDrawTime >= 0) return;
    lastDrawTime = time;

    // 1) Update authentic dotted electric-blue LED strip along the physical 3D X-PAD
    if (xpLedCtx && xpLedTex && xpLedCanvas) {
      xpLedCtx.clearRect(0, 0, xpLedCanvas.width, xpLedCanvas.height);
      const totalDots = 34;
      const litDots = Math.max(2, Math.round(clampedX * totalDots));
      for (let i = 0; i < totalDots; i++) {
        const dx = 4 + (i / (totalDots - 1)) * (xpLedCanvas.width - 8);
        const lit = i < litDots;
        xpLedCtx.fillStyle = lit ? "#8cb4ff" : "rgba(70, 100, 165, 0.16)";
        xpLedCtx.fillRect(dx - 2, 4, 4, 8);
      }
      xpLedTex.needsUpdate = true;
    }

    // 2) Authentic Pioneer DJ DJM-A9 Beat FX Colour OLED Display (1:1 match to official hardware!)
    const w = bfxCanvas.width;
    const h = bfxCanvas.height;
    bfxCtx.fillStyle = "#08090c";
    bfxCtx.fillRect(0, 0, w, h);

    // Subtle dark panel frame inset
    const padX = 14;
    const innerW = w - padX * 2;

    // Row 1: Green bordered "TAP" badge + crisp white "124.0 BPM"
    bfxCtx.strokeStyle = "#5ad460";
    bfxCtx.lineWidth = 2;
    bfxCtx.strokeRect(padX + 4, 14, 62, 24);
    bfxCtx.fillStyle = "#5ad460";
    bfxCtx.font = "600 15px system-ui, sans-serif";
    bfxCtx.textAlign = "center";
    bfxCtx.fillText("TAP", padX + 35, 31);

    bfxCtx.fillStyle = "#f2f2ee";
    bfxCtx.font = "600 32px system-ui, sans-serif";
    bfxCtx.textAlign = "right";
    bfxCtx.fillText("124.0", w - padX - 48, 37);
    bfxCtx.fillStyle = "#b4bac4";
    bfxCtx.font = "600 14px system-ui, sans-serif";
    bfxCtx.textAlign = "left";
    bfxCtx.fillText("BPM", w - padX - 42, 36);

    // Row 2: Large clean centered Effect Name (e.g. ECHO / MOBIUS)
    bfxCtx.fillStyle = "#f5f5f0";
    bfxCtx.font = "500 38px system-ui, sans-serif";
    bfxCtx.textAlign = "center";
    bfxCtx.fillText(fxName.toUpperCase(), w / 2, 92);

    // Row 3: 3-column primary beat division bar (neighbor | ACTIVE in solid cream-white | neighbor)
    const allDivs = ["1/4", "1/2", "3/4", "1", "2"];
    const selIdx = Math.max(0, allDivs.indexOf(division));
    const prevDiv = allDivs[Math.max(0, selIdx - 1)] ?? "3/4";
    const curDiv = allDivs[selIdx] ?? "1";
    const nextDiv = allDivs[Math.min(allDivs.length - 1, selIdx + 1)] ?? "2";
    const shownDivs = selIdx === 0 ? ["1/4", "1/2", "3/4"] : selIdx === allDivs.length - 1 ? ["3/4", "1", "2"] : [prevDiv, curDiv, nextDiv];

    const row3Y = 112;
    const row3H = 54;
    const col3W = innerW / 3;
    bfxCtx.strokeStyle = "rgba(215, 222, 232, 0.34)";
    bfxCtx.lineWidth = 1.5;
    bfxCtx.beginPath();
    bfxCtx.moveTo(padX, row3Y);
    bfxCtx.lineTo(padX + innerW, row3Y);
    bfxCtx.moveTo(padX, row3Y + row3H);
    bfxCtx.lineTo(padX + innerW, row3Y + row3H);
    bfxCtx.stroke();

    shownDivs.forEach((d, i) => {
      const cx = padX + i * col3W;
      const isActive = d === curDiv;
      if (isActive) {
        bfxCtx.fillStyle = "#eeede3";
        bfxCtx.fillRect(cx + 1, row3Y + 1, col3W - 2, row3H - 2);
      } else if (i > 0) {
        bfxCtx.strokeStyle = "rgba(215, 222, 232, 0.28)";
        bfxCtx.beginPath();
        bfxCtx.moveTo(cx, row3Y);
        bfxCtx.lineTo(cx, row3Y + row3H);
        bfxCtx.stroke();
      }
      bfxCtx.fillStyle = isActive ? "#0b0c0f" : "#ecece6";
      bfxCtx.font = "600 30px system-ui, sans-serif";
      bfxCtx.textAlign = "center";
      bfxCtx.fillText(d, cx + col3W / 2, row3Y + 38);
    });

    // Row 4: TIME  484 msec + subtle LOW/MID/HI indicator dots
    const divMap: Record<string, number> = { "1/4": 121, "1/2": 242, "3/4": 363, "1": 484, "2": 968 };
    const msec = divMap[division] ?? 484;
    bfxCtx.fillStyle = "#a8b0bc";
    bfxCtx.font = "500 16px system-ui, sans-serif";
    bfxCtx.textAlign = "left";
    bfxCtx.fillText("TIME", padX + 18, 200);
    bfxCtx.fillStyle = "#f2f2ec";
    bfxCtx.font = "600 26px system-ui, sans-serif";
    bfxCtx.textAlign = "center";
    bfxCtx.fillText(`${msec}`, w * 0.5, 202);
    bfxCtx.fillStyle = "#a8b0bc";
    bfxCtx.font = "500 15px system-ui, sans-serif";
    bfxCtx.textAlign = "left";
    bfxCtx.fillText("msec", w * 0.5 + 36, 200);

    // Subtle right-side frequency band indicators (L M H)
    const bandFlags = [freqMask.low, freqMask.mid, freqMask.hi];
    bandFlags.forEach((on, idx) => {
      bfxCtx.fillStyle = on ? "#5ac8cf" : "rgba(148,163,184,0.22)";
      bfxCtx.fillRect(w - padX - 38 + idx * 12, 189, 8, 8);
    });

    // Row 5: Signature DJM-A9 Mint-Teal "∞ BEAT" bar
    const tealY = 216;
    const tealH = 26;
    bfxCtx.fillStyle = "#62cbd1";
    bfxCtx.fillRect(padX, tealY, innerW, tealH);
    bfxCtx.fillStyle = "#f8fbfc";
    bfxCtx.font = "600 15px system-ui, sans-serif";
    bfxCtx.textAlign = "center";
    bfxCtx.fillText("∞  BEAT", w / 2, tealY + 18);

    // Row 6: 6-column X-PAD division strip (1/16 | 1/8 | 1/4 | 1/2 | 3/4 | 1) synced live to X-PAD touch!
    const xpDivs = ["1/16", "1/8", "1/4", "1/2", "3/4", "1"];
    const xpSelIdx = Math.min(xpDivs.length - 1, Math.floor(clampedX * xpDivs.length));
    const row6Y = tealY + tealH;
    const row6H = h - row6Y - 12;
    const col6W = innerW / xpDivs.length;

    bfxCtx.strokeStyle = "rgba(215, 222, 232, 0.34)";
    bfxCtx.lineWidth = 1.25;
    bfxCtx.strokeRect(padX, row6Y, innerW, row6H);

    xpDivs.forEach((lbl, i) => {
      const cx = padX + i * col6W;
      const isXpActive = i === xpSelIdx;
      if (isXpActive) {
        bfxCtx.fillStyle = "#eeede3";
        bfxCtx.fillRect(cx + 1, row6Y + 1, col6W - 2, row6H - 2);
      } else if (i > 0) {
        bfxCtx.strokeStyle = "rgba(215, 222, 232, 0.28)";
        bfxCtx.beginPath();
        bfxCtx.moveTo(cx, row6Y);
        bfxCtx.lineTo(cx, row6Y + row6H);
        bfxCtx.stroke();
      }
      bfxCtx.fillStyle = isXpActive ? "#0b0c0f" : "#ecece6";
      bfxCtx.font = "600 18px system-ui, sans-serif";
      bfxCtx.textAlign = "center";
      bfxCtx.fillText(lbl, cx + col6W / 2, row6Y + row6H * 0.64);
    });

    bfxCtx.textAlign = "left";
    bfxTex.needsUpdate = true;
  };

  // Rear Bluetooth/Wi-Fi antenna
  const [ax, az] = local(dev, dev.antenna.at[0], dev.antenna.at[1]);
  const antGeo = new THREE.CylinderGeometry(dev.antenna.r * 0.85, dev.antenna.r, dev.antenna.h, 20);
  const ant = new THREE.Mesh(antGeo, shared.rubber);
  ant.position.set(ax, TOP_Y + dev.antenna.h / 2 - 0.008, az - 0.005);
  ant.castShadow = true;
  group.add(ant);
  disposables.push(antGeo);

  const [ch2X, ch2FaderZ] = local(dev, dev.faders[1]!.capAt[0], dev.faders[1]!.capAt[1]);
  const [, ch2ColorZ] = local(dev, dev.color[1]!.at[0], dev.color[1]!.at[1]);

  const anchors = {
    center: new THREE.Vector3(0, TOP_Y, 0),
    channels: new THREE.Vector3(0, TOP_Y, -0.06),
    color: new THREE.Vector3(ch2X, TOP_Y + 0.022, ch2ColorZ),
    beatfx: new THREE.Vector3((bx0 + bx1) / 2, TOP_Y + 0.012, (bz0 + bz1) / 2),
    beatfxDome: new THREE.Vector3(bfxX, TOP_Y + 0.011, bfxZ),
    fader: new THREE.Vector3(ch2X, TOP_Y + 0.014, ch2FaderZ),
    crossfader: new THREE.Vector3(cfx, TOP_Y + 0.017, cfz),
    ch2Rear: new THREE.Vector3(ch2X, 0.05, -dev.bodyDepth / 2),
  };

  return {
    group,
    panel,
    colorKnobs,
    centerLockSwitch,
    faders,
    crossfader,
    beatFxDomeMat,
    updateBeatFxScreen,
    hitTargets: {
      ch2Fader: faders[1]!.mesh,
      ch2Filter: colorKnobs[1]!,
      crossfader: cfCap,
      beatFxDome,
    },
    anchors,
    dispose: () => {
      screws.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      physicalKnobs.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      disposables.forEach((d) => d.dispose());
    },
  };
}
