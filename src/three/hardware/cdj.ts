import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CDJ } from "./layout";
import {
  applyPlanarUV,
  brushedSilverMaterial,
  buildContouredFaderCap,
  buildPanelScrews,
  buildSeparatedRectKeycap,
  buildSeparatedRoundKeycap,
  buttonBezelMaterial,
  chassisMaterial,
  createFlutedKnobBarrelGeo,
  createPanelMaterial,
  createSurfaceMaps,
  knobSideMaterial,
  local,
  rubberMaterial,
  type PanelUniforms,
  type ProceduralSurfaceMaps,
} from "./materials";

export interface CdjTextures {
  top: THREE.Texture;
  topEmissive: THREE.Texture;
  screenPlay: THREE.Texture;
  screenBrowse: THREE.Texture;
  front: THREE.Texture;
}

export interface CdjSharedMaterials {
  chassis: THREE.Material;
  rubber: THREE.Material;
  knobSide: THREE.Material;
  silver: THREE.Material;
  bezel: THREE.Material;
  maps: ProceduralSurfaceMaps;
}

export interface HotCuePadRig {
  index: number;
  label: string;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  ledMat: THREE.MeshStandardMaterial;
  restY: number;
  color: number;
}

export interface CdjRig {
  group: THREE.Group;
  panel: PanelUniforms;
  /** Rotating jog platter assembly (spins with playback & interactive Jog Feel) */
  jogPlatter: THREE.Group;
  /** Subtle luminous ring tucked inside the jog chrome chamfer */
  jogRingMat: THREE.MeshStandardMaterial;
  /** Hit target mesh for direct 3D jog interaction */
  jogHit: THREE.Mesh;
  /** Animated JOG FEEL physical rotary knob */
  jogFeelKnob: THREE.Group;
  /** Animated Tempo fader cap */
  tempoCap: THREE.Group;
  /** Interactive 8 Hot Cue pads A–H with individual LED lightbars & travel */
  hotCues: HotCuePadRig[];
  /** Illuminated IN/CUE & OUT loop rings + Browse ring + NFC front badge */
  loopRingMat: THREE.MeshStandardMaterial;
  browseRingMat: THREE.MeshStandardMaterial;
  nfcGlowMat: THREE.MeshStandardMaterial;
  play: {
    group: THREE.Group;
    hitMesh: THREE.Mesh;
    ringMat: THREE.MeshStandardMaterial;
    uniforms: PanelUniforms;
    restY: number;
  };
  cue: {
    group: THREE.Group;
    hitMesh: THREE.Mesh;
    ringMat: THREE.MeshStandardMaterial;
    uniforms: PanelUniforms;
    restY: number;
  };
  screen: {
    power: { value: number };
    mix: { value: number };
    time: { value: number };
    material: THREE.MeshPhysicalMaterial;
  };
  /** world-space anchor helpers in device-local metres */
  anchors: Record<string, THREE.Vector3>;
  dispose(): void;
}

const TOP_Y = CDJ.feetH + CDJ.bodyH;

const HOT_CUE_SPECS = [
  { label: "A", cx: 142, color: 0xe53946 },
  { label: "B", cx: 204, color: 0x38c2f0 },
  { label: "C", cx: 266, color: 0x8ce030 },
  { label: "D", cx: 328, color: 0xf1f0ec },
  { label: "E", cx: 390, color: 0x2fd065 },
  { label: "F", cx: 452, color: 0xf0a228 },
  { label: "G", cx: 514, color: 0x3a7cff },
  { label: "H", cx: 576, color: 0xe5d238 },
] as const;

const CDJ_SCREWS_PX: readonly (readonly [number, number])[] = [
  [16, 158],
  [704, 158],
  [16, 1012],
  [704, 1012],
  [616, 724],
  [616, 992],
];

/**
 * Generates a continuous, museum-grade parametric 3D outer jog grip ring with
 * 24 smooth CONCAVE scooped finger dimples carved directly into the sloped bevel
 * (matching the authentic CDJ-3000X physical profile — zero protruding nubs!).
 */
function buildSculptedJogGripGeo(rInner: number, rOuter: number, gripHeight: number): THREE.BufferGeometry {
  const radialSegs = 22;
  const angularSegs = 288;
  const dimpleCount = 24;
  const stepTheta = (Math.PI * 2) / dimpleCount;
  const rDimple = rInner + (rOuter - rInner) * 0.5;
  const dimpleRx = 0.0088;
  const dimpleRr = (rOuter - rInner) * 0.35;
  const dimpleDepth = 0.0036;

  const vertsPerRing = angularSegs + 1;
  const vertCount = (radialSegs + 1) * vertsPerRing;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let ri = 0; ri <= radialSegs; ri++) {
    const u = ri / radialSegs;
    let r: number;
    let baseY: number;
    if (u <= 0.86) {
      const s = u / 0.86;
      r = rInner + (rOuter * 0.992 - rInner) * s;
      const curve = Math.pow(s, 1.18);
      baseY = gripHeight * (1.0 - 0.56 * curve);
    } else {
      const s = (u - 0.86) / 0.14;
      const arc = s * Math.PI * 0.5;
      r = rOuter * 0.992 + rOuter * 0.012 * Math.sin(arc);
      baseY = gripHeight * 0.44 * Math.cos(arc);
    }

    for (let ai = 0; ai <= angularSegs; ai++) {
      const v = ai / angularSegs;
      const theta = v * Math.PI * 2;

      let localTheta = ((theta % stepTheta) + stepTheta) % stepTheta;
      if (localTheta > stepTheta * 0.5) localTheta -= stepTheta;
      const dx = localTheta * rDimple;
      const dr = r - rDimple;
      const normDist = Math.sqrt((dx / dimpleRx) ** 2 + (dr / dimpleRr) ** 2);

      let y = baseY;
      let rMod = r;
      if (normDist < 1.0 && u < 0.86) {
        const bowl = Math.pow(Math.cos(normDist * Math.PI * 0.5), 1.65);
        y -= bowl * dimpleDepth;
        rMod -= bowl * 0.0012;
      }

      const midTheta = (((theta + stepTheta * 0.5) % stepTheta) + stepTheta) % stepTheta;
      const mOff = midTheta > stepTheta * 0.5 ? midTheta - stepTheta : midTheta;
      const dotDist = Math.sqrt(
        ((mOff * rOuter * 0.95) / 0.0022) ** 2 + ((r - (rInner + (rOuter - rInner) * 0.78)) / 0.0022) ** 2,
      );
      if (dotDist < 1.0 && u < 0.86) {
        y -= Math.cos(dotDist * Math.PI * 0.5) * 0.00045;
      }

      const idx = ri * vertsPerRing + ai;
      positions[idx * 3] = Math.cos(theta) * rMod;
      positions[idx * 3 + 1] = Math.max(0, y);
      positions[idx * 3 + 2] = Math.sin(theta) * rMod;
      uvs[idx * 2] = v * 12;
      uvs[idx * 2 + 1] = u * 2;
    }
  }

  const indices: number[] = [];
  for (let ri = 0; ri < radialSegs; ri++) {
    for (let ai = 0; ai < angularSegs; ai++) {
      const a = ri * vertsPerRing + ai;
      const b = (ri + 1) * vertsPerRing + ai;
      const c = (ri + 1) * vertsPerRing + (ai + 1);
      const d = ri * vertsPerRing + (ai + 1);
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildCdj(tex: CdjTextures, shared: CdjSharedMaterials): CdjRig {
  const group = new THREE.Group();
  group.name = "CDJ-3000X";
  const dev = CDJ;
  const disposables: { dispose(): void }[] = [];

  const [, zBodyRear] = local(dev, 0, dev.body.y0);
  const [, zBodyFront] = local(dev, 0, dev.body.y1);
  const zBodyCenter = (zBodyRear + zBodyFront) / 2;

  // Sculpted bead-blasted anodized aluminum chassis with crisp chamfered edges
  const bodyGeo = new RoundedBoxGeometry(dev.width, dev.bodyH, dev.bodyDepth, 5, 0.0055);
  const body = new THREE.Mesh(bodyGeo, shared.chassis);
  body.position.set(0, dev.feetH + dev.bodyH / 2, zBodyCenter);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  disposables.push(bodyGeo);

  // Machined metallic perimeter rail around chassis top
  const trimGeo = new RoundedBoxGeometry(dev.width + 0.0012, 0.0032, dev.bodyDepth + 0.0012, 3, 0.0012);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e1e25,
    roughness: 0.44,
    metalness: 0.62,
    normalMap: shared.maps.anodizedNormal,
    normalScale: new THREE.Vector2(0.14, 0.14),
  });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(0, TOP_Y - 0.0022, zBodyCenter);
  group.add(trim);
  disposables.push(trimGeo, trimMat);

  // Photographed top panel WITH organic bead-blasted aluminum patina (ZERO corduroy stripes!)
  const { material: panelMat, uniforms: panel } = createPanelMaterial(tex.top, tex.topEmissive, [], {
    normalMap: shared.maps.anodizedNormal,
    roughnessMap: shared.maps.anodizedRoughness,
    normalScale: 0.14,
    roughness: 0.72,
    metalness: 0.32,
  });
  disposables.push(panelMat);

  const topGeo = new THREE.PlaneGeometry(dev.width - 0.004, dev.bodyDepth - 0.004, 1, 1);
  topGeo.rotateX(-Math.PI / 2);
  topGeo.translate(0, TOP_Y + 0.0012, zBodyCenter);
  applyPlanarUV(topGeo, dev);
  const top = new THREE.Mesh(topGeo, panelMat);
  top.receiveShadow = true;
  group.add(top);
  disposables.push(topGeo);

  // Front face (official front elevation + glowing NFC touchpoint badge)
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
  const frontGeo = new THREE.PlaneGeometry(dev.width - 0.008, dev.bodyH - 0.006);
  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.set(0, dev.feetH + dev.bodyH / 2, zBodyFront + 0.0014);
  group.add(front);
  disposables.push(frontMat, frontGeo);

  // Front NFC touchpoint raised bezel + reactive glow ring
  const nfcFrameGeo = new RoundedBoxGeometry(0.032, 0.017, 0.0028, 2, 0.001);
  const nfcFrame = new THREE.Mesh(nfcFrameGeo, shared.bezel);
  nfcFrame.position.set(0, dev.feetH + dev.bodyH * 0.52, zBodyFront + 0.0016);
  group.add(nfcFrame);
  const nfcGlowGeo = new THREE.RingGeometry(0.006, 0.0095, 32);
  const nfcGlowMat = new THREE.MeshStandardMaterial({
    color: 0xf1f0ec,
    emissive: new THREE.Color(0x52a8ff),
    emissiveIntensity: 0,
    roughness: 0.2,
    transparent: true,
    opacity: 0.78,
  });
  const nfcGlow = new THREE.Mesh(nfcGlowGeo, nfcGlowMat);
  nfcGlow.position.set(0, dev.feetH + dev.bodyH * 0.52, zBodyFront + 0.0033);
  group.add(nfcGlow);
  disposables.push(nfcFrameGeo, nfcGlowGeo, nfcGlowMat);

  // Machined isolator feet with chrome accent rings
  const footGeo = new THREE.CylinderGeometry(dev.footR, dev.footR * 0.94, dev.feetH, 40);
  const footRingGeo = new THREE.TorusGeometry(dev.footR * 0.98, 0.0009, 10, 36);
  footRingGeo.rotateX(Math.PI / 2);
  disposables.push(footGeo, footRingGeo);
  for (const sx of [-1, 1]) {
    for (const z of [zBodyFront - 0.052, zBodyRear + 0.06]) {
      const fx = sx * (dev.width / 2 - 0.0036 - dev.footR);
      const f = new THREE.Mesh(footGeo, shared.rubber);
      f.position.set(fx, dev.feetH / 2, z);
      f.castShadow = true;
      group.add(f);

      const fr = new THREE.Mesh(footRingGeo, shared.silver);
      fr.position.set(fx, dev.feetH * 0.34, z);
      group.add(fr);
    }
  }

  // Countersunk chassis screws
  const screws = buildPanelScrews(dev, CDJ_SCREWS_PX, TOP_Y);
  group.add(screws);

  // Solid dark polymer keycap wall material (eliminates smeared texture sides!)
  const darkKeycapMat = new THREE.MeshStandardMaterial({
    color: 0x15151a,
    roughness: 0.62,
    metalness: 0.14,
    normalMap: shared.maps.rubberNormal,
    normalScale: new THREE.Vector2(0.24, 0.24),
  });
  const redKeycapMat = new THREE.MeshPhysicalMaterial({
    color: 0x991e24,
    emissive: new THREE.Color(0xe52d38),
    emissiveIntensity: 0.55,
    roughness: 0.28,
    clearcoat: 0.45,
  });
  const metallicCapMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2c34,
    roughness: 0.32,
    metalness: 0.86,
    clearcoat: 0.25,
    normalMap: shared.maps.radialNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: shared.maps.radialRoughness,
  });
  const pointerMat = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: 0.3, metalness: 0.08 });
  const aoMat = shared.maps.contactAo
    ? new THREE.MeshBasicMaterial({
        map: shared.maps.contactAo,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    : null;
  disposables.push(darkKeycapMat, redKeycapMat, metallicCapMat, pointerMat);
  if (aoMat) disposables.push(aoMat);

  // =========================================================================
  // TILTED 10.1-INCH CAPACITIVE TOUCHSCREEN UNIT + 6 SEPARATED 3D BEZEL KEYS
  // =========================================================================
  const su = dev.screenUnit;
  const [sx0, szRear] = local(dev, su.x0, su.y0);
  const [sx1, szFront] = local(dev, su.x1, su.y1);
  const sDepth = szFront - szRear;
  const tilt = Math.atan2(dev.screenRearH - dev.screenFrontH, sDepth);
  const pivot = new THREE.Group();
  pivot.position.set(0, dev.screenFrontH, szFront);
  pivot.rotation.x = tilt;
  group.add(pivot);

  const thickness = 0.023;
  const bezelGeo = new RoundedBoxGeometry(sx1 - sx0, thickness, sDepth, 4, 0.0038);
  const bezel = new THREE.Mesh(bezelGeo, shared.chassis);
  bezel.position.set((sx0 + sx1) / 2, -thickness / 2, -sDepth / 2);
  bezel.castShadow = true;
  bezel.receiveShadow = true;
  pivot.add(bezel);
  disposables.push(bezelGeo);

  const bezelTopGeo = new THREE.PlaneGeometry(sx1 - sx0 - 0.003, sDepth - 0.003);
  bezelTopGeo.rotateX(-Math.PI / 2);
  bezelTopGeo.translate((sx0 + sx1) / 2, 0, (szRear + szFront) / 2);
  applyPlanarUV(bezelTopGeo, dev);
  bezelTopGeo.translate(0, 0.001, -szFront);
  pivot.add(new THREE.Mesh(bezelTopGeo, panelMat));
  disposables.push(bezelTopGeo);

  // 6 sculpted 3D bezel keys with separated dark molded walls & recessed sockets!
  const sWellGeos: THREE.BufferGeometry[] = [];
  const sBodyGeos: THREE.BufferGeometry[] = [];
  const sFaceGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const { well, body: b, face } = buildSeparatedRectKeycap(dev, 162 + i * 76, 48, 58, 19, 0.0046, 0.001);
    well.translate(0, 0, -szFront);
    b.translate(0, 0, -szFront);
    face.translate(0, 0, -szFront);
    sWellGeos.push(well);
    sBodyGeos.push(b);
    sFaceGeos.push(face);
  }
  const sWells = new THREE.Mesh(mergeGeometries(sWellGeos)!, shared.bezel);
  const sBodies = new THREE.Mesh(mergeGeometries(sBodyGeos)!, darkKeycapMat);
  sBodies.castShadow = true;
  const sFaces = new THREE.Mesh(mergeGeometries(sFaceGeos)!, panelMat);
  pivot.add(sWells, sBodies, sFaces);
  disposables.push(...sWellGeos, ...sBodyGeos, ...sFaceGeos, sWells.geometry, sBodies.geometry, sFaces.geometry);

  // Active clearcoat touchscreen glass (+2.5mm above bezel, animated live playhead shimmer)
  const g = dev.glass;
  const [gx0, gz0] = local(dev, g.x0, g.y0);
  const [gx1, gz1] = local(dev, g.x1, g.y1);
  const screenPower = { value: 0 };
  const screenMix = { value: 0 };
  const screenTime = { value: 0 };
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x030305,
    roughness: 0.055,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    emissive: 0xffffff,
    emissiveMap: tex.screenPlay,
    emissiveIntensity: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  glassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uBrowse = { value: tex.screenBrowse };
    shader.uniforms.uMix = screenMix;
    shader.uniforms.uScreenPower = screenPower;
    shader.uniforms.uScreenTime = screenTime;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uBrowse;\nuniform float uMix;\nuniform float uScreenPower;\nuniform float uScreenTime;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#ifdef USE_EMISSIVEMAP
  vec2 suv = vEmissiveMapUv;
  vec3 ePlay = texture2D( emissiveMap, suv ).rgb;
  vec3 eBrowse = texture2D( uBrowse, suv ).rgb;
  float waveBand = smoothstep(0.36, 0.42, suv.y) * (1.0 - smoothstep(0.68, 0.74, suv.y));
  float pulse = 1.0 + waveBand * (1.0 - uMix) * 0.14 * sin(suv.x * 28.0 - uScreenTime * 5.2);
  float playheadGlow = exp(-pow((suv.x - 0.502) * 85.0, 2.0)) * waveBand * (1.0 - uMix) * 0.25;
  vec3 screenCol = mix( ePlay * pulse + vec3(0.95, 0.22, 0.25) * playheadGlow, eBrowse, uMix );
  totalEmissiveRadiance *= screenCol * uScreenPower * 1.48;
#endif`,
      );
  };
  disposables.push(glassMat);
  const glassGeo = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0);
  glassGeo.rotateX(-Math.PI / 2);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set((gx0 + gx1) / 2, 0.0025, (gz0 + gz1) / 2 - szFront);
  pivot.add(glass);
  disposables.push(glassGeo);

  // =========================================================================
  // SCULPTED 3D JOG WHEEL (concave 24-dimple collar + radial micro-groove
  // platter + brushed chrome chamfer + glowing inner ring + glossy LCD lens)
  // =========================================================================
  const [jx, jz] = local(dev, dev.jog.at[0], dev.jog.at[1]);
  const rOuter = dev.jog.ringR / dev.pxPerM;
  const rPlatter = dev.jog.platterR / dev.pxPerM;
  const rDisplay = dev.jog.displayR / dev.pxPerM;
  const rGripInner = rPlatter + 0.0022;
  const gripHeight = 0.0152;

  const jogRoot = new THREE.Group();
  jogRoot.position.set(jx, TOP_Y + 0.001, jz);
  group.add(jogRoot);

  // Recessed dark anodized moat + grounded contact shadow ring
  if (aoMat) {
    const jogAoGeo = new THREE.PlaneGeometry(rOuter * 2.28, rOuter * 2.28);
    jogAoGeo.rotateX(-Math.PI / 2);
    const jogAo = new THREE.Mesh(jogAoGeo, aoMat);
    jogAo.position.y = 0.00045;
    jogRoot.add(jogAo);
    disposables.push(jogAoGeo);
  }

  const moatGeo = new THREE.RingGeometry(rOuter * 0.985, rOuter + 0.0064, 112);
  moatGeo.rotateX(-Math.PI / 2);
  const moatMat = new THREE.MeshStandardMaterial({ color: 0x040406, roughness: 0.9, metalness: 0.12 });
  const moat = new THREE.Mesh(moatGeo, moatMat);
  moat.position.y = 0.0006;
  jogRoot.add(moat);

  const outerLipGeo = new THREE.TorusGeometry(rOuter + 0.0054, 0.0013, 12, 112);
  outerLipGeo.rotateX(Math.PI / 2);
  const outerLipMat = new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.44, metalness: 0.56 });
  const outerLip = new THREE.Mesh(outerLipGeo, outerLipMat);
  outerLip.position.y = 0.001;
  jogRoot.add(outerLip);
  disposables.push(moatGeo, moatMat, outerLipGeo, outerLipMat);

  const jogPlatter = new THREE.Group();
  jogPlatter.name = "CDJ-Jog-Platter";
  jogRoot.add(jogPlatter);

  // Continuous parametric 3D sloped grip collar with 24 CONCAVE scooped finger dimples
  const gripGeo = buildSculptedJogGripGeo(rGripInner, rOuter, gripHeight);
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x15151a,
    roughness: 0.54,
    metalness: 0.34,
    normalMap: shared.maps.rubberNormal,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: shared.maps.anodizedRoughness,
  });
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  gripMesh.castShadow = true;
  gripMesh.receiveShadow = true;
  jogPlatter.add(gripMesh);
  disposables.push(gripGeo, gripMat);

  // Machined brushed-chrome chamfer ring
  const bevelPts = [
    new THREE.Vector2(rPlatter - 0.0004, gripHeight + 0.0012),
    new THREE.Vector2(rPlatter + 0.0006, gripHeight + 0.0046),
    new THREE.Vector2(rPlatter + 0.0024, gripHeight + 0.005),
    new THREE.Vector2(rPlatter + 0.0044, gripHeight + 0.0022),
    new THREE.Vector2(rPlatter + 0.0048, gripHeight - 0.0005),
  ];
  const silverRimGeo = new THREE.LatheGeometry(bevelPts, 128);
  const silverRim = new THREE.Mesh(silverRimGeo, shared.silver);
  silverRim.castShadow = true;
  silverRim.receiveShadow = true;
  jogPlatter.add(silverRim);
  disposables.push(silverRimGeo);

  // Subtle recessed inner jog LED light guide ring
  const jogRingGeo = new THREE.TorusGeometry(rPlatter - 0.0006, 0.0009, 12, 112);
  jogRingGeo.rotateX(Math.PI / 2);
  const jogRingMat = new THREE.MeshStandardMaterial({
    color: 0xd8e8ff,
    emissive: new THREE.Color(0x90c2ff),
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
  });
  const jogRing = new THREE.Mesh(jogRingGeo, jogRingMat);
  jogRing.position.y = gripHeight + 0.0042;
  jogPlatter.add(jogRing);
  disposables.push(jogRingGeo, jogRingMat);

  // Capacitive top platter disc with REAL concentric radial micro-grooves (uv1) + photo texture (uv0)
  const platterH = 0.0042;
  const platterGeo = new THREE.CylinderGeometry(rPlatter - 0.0008, rPlatter, platterH, 112);
  const pPos = platterGeo.getAttribute("position") as THREE.BufferAttribute;
  const uv1 = new Float32Array(pPos.count * 2);
  for (let i = 0; i < pPos.count; i++) {
    uv1[i * 2] = pPos.getX(i) / (rPlatter * 2) + 0.5;
    uv1[i * 2 + 1] = pPos.getZ(i) / (rPlatter * 2) + 0.5;
  }
  platterGeo.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
  platterGeo.translate(jx, TOP_Y + gripHeight + platterH / 2, jz);
  applyPlanarUV(platterGeo, dev);
  platterGeo.translate(-jx, -(TOP_Y + gripHeight + platterH / 2), -jz);

  const platterRadialNormal = shared.maps.radialNormal ? shared.maps.radialNormal.clone() : null;
  const platterRadialRough = shared.maps.radialRoughness ? shared.maps.radialRoughness.clone() : null;
  if (platterRadialNormal) {
    platterRadialNormal.channel = 1;
    platterRadialNormal.needsUpdate = true;
    disposables.push(platterRadialNormal);
  }
  if (platterRadialRough) {
    platterRadialRough.channel = 1;
    platterRadialRough.needsUpdate = true;
    disposables.push(platterRadialRough);
  }
  const { material: platterMat, uniforms: platterUniforms } = createPanelMaterial(tex.top, tex.topEmissive, [], {
    normalMap: platterRadialNormal,
    roughnessMap: platterRadialRough,
    normalScale: 0.42,
    roughness: 0.62,
    metalness: 0.34,
  });
  platterUniforms.uBoost.value = 3.0;
  platterUniforms.uPower = panel.uPower;
  platterUniforms.uLed = panel.uLed;
  platterUniforms.uTint = panel.uTint;
  disposables.push(platterMat);

  const jogHit = new THREE.Mesh(platterGeo, platterMat);
  jogHit.name = "CDJ-Jog-Hit";
  jogHit.position.y = gripHeight + platterH / 2 + 0.0002;
  jogHit.castShadow = true;
  jogHit.receiveShadow = true;
  jogPlatter.add(jogHit);
  disposables.push(platterGeo);

  // Flush glossy clearcoat On-Jog central LCD lens + dark bezel ring
  const lcdBezelGeo = new THREE.TorusGeometry(rDisplay * 1.01, 0.00085, 12, 72);
  lcdBezelGeo.rotateX(Math.PI / 2);
  const lcdBezel = new THREE.Mesh(lcdBezelGeo, shared.bezel);
  lcdBezel.position.y = gripHeight + platterH + 0.0005;
  jogPlatter.add(lcdBezel);

  const lcdLensGeo = new THREE.CircleGeometry(rDisplay, 72);
  lcdLensGeo.rotateX(-Math.PI / 2);
  const lcdLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x050608,
    transparent: true,
    opacity: 0.2,
    roughness: 0.04,
    metalness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const lcdLens = new THREE.Mesh(lcdLensGeo, lcdLensMat);
  lcdLens.position.y = gripHeight + platterH + 0.0008;
  jogPlatter.add(lcdLens);
  disposables.push(lcdBezelGeo, lcdLensGeo, lcdLensMat);

  // Luminous cue position tick
  const tickGeo = new THREE.BoxGeometry(0.0022, 0.001, 0.0115);
  const tickMat = new THREE.MeshStandardMaterial({
    color: 0xf1f0ec,
    emissive: new THREE.Color(0xf1f0ec),
    emissiveIntensity: 0.85,
    roughness: 0.28,
  });
  const tick = new THREE.Mesh(tickGeo, tickMat);
  tick.position.set(0, gripHeight + platterH + 0.0007, -(rPlatter - 0.0105));
  jogPlatter.add(tick);
  disposables.push(tickGeo, tickMat);

  // =========================================================================
  // SCULPTED 3D PLAY & CUE BUTTONS (recessed well + AO + glowing translucent
  // halo collar + solid machined metal barrel + radial-brushed cap)
  // =========================================================================
  const btnRadialNormal = shared.maps.radialNormal ? shared.maps.radialNormal.clone() : null;
  if (btnRadialNormal) {
    btnRadialNormal.channel = 1;
    btnRadialNormal.needsUpdate = true;
    disposables.push(btnRadialNormal);
  }

  const buildTransportButton = (spec: { at: readonly [number, number]; r: number }, haloHex: number, name: string) => {
    const [bx, bz] = local(dev, spec.at[0], spec.at[1]);
    const r = spec.r / dev.pxPerM;
    const restY = TOP_Y + 0.0012;

    if (aoMat) {
      const aGeo = new THREE.PlaneGeometry(r * 2.7, r * 2.7);
      aGeo.rotateX(-Math.PI / 2);
      const aMesh = new THREE.Mesh(aGeo, aoMat);
      aMesh.position.set(bx, TOP_Y + 0.0014, bz);
      group.add(aMesh);
      disposables.push(aGeo);
    }

    const wellGeo = new THREE.CylinderGeometry(r * 1.07, r * 1.1, 0.0024, 56);
    const wellMesh = new THREE.Mesh(wellGeo, shared.bezel);
    wellMesh.position.set(bx, TOP_Y + 0.0012, bz);
    group.add(wellMesh);
    disposables.push(wellGeo);

    const btnGroup = new THREE.Group();
    btnGroup.position.set(bx, restY, bz);
    btnGroup.name = name;
    group.add(btnGroup);

    // Frosted translucent glowing LED halo ring
    const ringGeo = new THREE.TorusGeometry(r * 0.93, 0.0027, 20, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: haloHex,
      emissive: new THREE.Color(haloHex),
      emissiveIntensity: 2.3,
      roughness: 0.24,
      metalness: 0.06,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.004;
    btnGroup.add(ring);

    // Solid brushed anodized metal button cylinder skirt (zero stretched photo on sides!)
    const capH = 0.0086;
    const skirtGeo = new THREE.CylinderGeometry(r * 0.82, r * 0.9, capH, 56);
    const skirtMesh = new THREE.Mesh(skirtGeo, shared.knobSide);
    skirtMesh.position.y = capH / 2 + 0.001;
    skirtMesh.castShadow = true;
    btnGroup.add(skirtMesh);

    // Crisp top metallic legend disc (planar UV + radial spun normal on uv1)
    const capGeo = new THREE.CircleGeometry(r * 0.81, 56);
    capGeo.rotateX(-Math.PI / 2);
    const cPos = capGeo.getAttribute("position") as THREE.BufferAttribute;
    const cUv1 = new Float32Array(cPos.count * 2);
    for (let i = 0; i < cPos.count; i++) {
      cUv1[i * 2] = cPos.getX(i) / (r * 1.7) + 0.5;
      cUv1[i * 2 + 1] = cPos.getZ(i) / (r * 1.7) + 0.5;
    }
    capGeo.setAttribute("uv1", new THREE.BufferAttribute(cUv1, 2));
    capGeo.translate(bx, 0, bz);
    applyPlanarUV(capGeo, dev);
    capGeo.translate(-bx, 0, -bz);

    const { material, uniforms } = createPanelMaterial(tex.top, tex.topEmissive, [], {
      normalMap: btnRadialNormal,
      normalScale: 0.36,
      roughness: 0.36,
      metalness: 0.58,
    });
    uniforms.uBoost.value = 3.2;
    const capMesh = new THREE.Mesh(capGeo, material);
    capMesh.name = `${name}-Hit`;
    capMesh.position.y = capH + 0.0011;
    btnGroup.add(capMesh);

    // Brushed metallic chamfer rim around the button crown
    const rimGeo = new THREE.TorusGeometry(r * 0.82, 0.0009, 14, 56);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, shared.silver);
    rim.position.y = capH + 0.001;
    btnGroup.add(rim);

    disposables.push(ringGeo, ringMat, skirtGeo, capGeo, material, rimGeo);
    return { group: btnGroup, hitMesh: capMesh, ringMat, uniforms, restY };
  };

  const play = buildTransportButton(dev.play, 0x38c962, "CDJ-PLAY");
  const cue = buildTransportButton(dev.cue, 0xf0a228, "CDJ-CUE");

  // =========================================================================
  // 8 INTERACTIVE SCULPTED 3D HOT CUE PADS (A–H) — SEPARATED WALLS + LED BARS
  // =========================================================================
  const hotCues: HotCuePadRig[] = [];
  const padCy = 430;
  const padW = 46 / dev.pxPerM;
  const padD = 25 / dev.pxPerM;
  const padH = 0.0062;

  for (let i = 0; i < HOT_CUE_SPECS.length; i++) {
    const spec = HOT_CUE_SPECS[i]!;
    const [px, pz] = local(dev, spec.cx, padCy);
    const restY = TOP_Y + 0.0012;

    const { well, body: padBodyGeo, face: padFaceGeo } = buildSeparatedRectKeycap(
      dev,
      spec.cx,
      padCy,
      46,
      25,
      padH,
      0,
    );
    well.translate(0, TOP_Y + 0.0012, 0);
    const wellMesh = new THREE.Mesh(well, shared.bezel);
    group.add(wellMesh);

    const padGroup = new THREE.Group();
    padGroup.position.set(px, restY, pz);
    padGroup.name = `CDJ-HotCue-${spec.label}`;
    group.add(padGroup);

    padBodyGeo.translate(-px, 0, -pz);
    const bodyMesh = new THREE.Mesh(padBodyGeo, darkKeycapMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    padGroup.add(bodyMesh);

    padFaceGeo.translate(-px, 0, -pz);
    const hitMesh = new THREE.Mesh(padFaceGeo, panelMat);
    hitMesh.name = `CDJ-HotCue-${spec.label}-Hit`;
    hitMesh.userData.hotCueIndex = i;
    padGroup.add(hitMesh);

    const ledGeo = new THREE.BoxGeometry(padW * 0.78, 0.0014, 0.0018);
    const ledMat = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: new THREE.Color(spec.color),
      emissiveIntensity: 1.85,
      roughness: 0.22,
    });
    const ledBar = new THREE.Mesh(ledGeo, ledMat);
    ledBar.position.set(0, padH + 0.0005, padD * 0.34);
    padGroup.add(ledBar);

    disposables.push(well, padBodyGeo, padFaceGeo, ledGeo, ledMat);
    hotCues.push({
      index: i,
      label: spec.label,
      group: padGroup,
      hitMesh,
      ledMat,
      restY,
      color: spec.color,
    });
  }

  // =========================================================================
  // ALL REMAINING REAL 3D TOP-DECK BUTTONS (SEPARATED WALLS, NO TEXTURE SMEAR!)
  // =========================================================================
  const wellGeos: THREE.BufferGeometry[] = [];
  const darkBodyGeos: THREE.BufferGeometry[] = [];
  const redBodyGeos: THREE.BufferGeometry[] = [];
  const roundSkirtGeos: THREE.BufferGeometry[] = [];
  const faceGeos: THREE.BufferGeometry[] = [];
  const silverRimGeos: THREE.BufferGeometry[] = [];

  const addRectButton = (cx: number, cy: number, wPx: number, hPx: number, heightM = 0.0054, isRed = false) => {
    const { well, body: b, face } = buildSeparatedRectKeycap(dev, cx, cy, wPx, hPx, heightM, TOP_Y + 0.0012);
    wellGeos.push(well);
    (isRed ? redBodyGeos : darkBodyGeos).push(b);
    faceGeos.push(face);
  };

  const addRoundButton = (cx: number, cy: number, rPx: number, heightM = 0.0062, withSilverRim = false) => {
    const { well, skirt, face } = buildSeparatedRoundKeycap(dev, cx, cy, rPx, heightM, TOP_Y + 0.0012);
    wellGeos.push(well);
    roundSkirtGeos.push(skirt);
    faceGeos.push(face);
    if (withSilverRim) {
      const [x, z] = local(dev, cx, cy);
      const r = (rPx / dev.pxPerM) * 0.86;
      const rimRaw = new THREE.TorusGeometry(r, 0.00065, 10, 32);
      rimRaw.rotateX(Math.PI / 2);
      const rim = rimRaw.index ? rimRaw.toNonIndexed() : rimRaw;
      if (rimRaw !== rim) rimRaw.dispose();
      rim.translate(x, TOP_Y + 0.0016 + heightM, z);
      silverRimGeos.push(rim);
    }
  };

  // Left utility & media buttons
  addRectButton(38, 232, 18, 9, 0.0036); // USB 1 STOP
  addRectButton(38, 330, 18, 9, 0.0036); // USB 2 STOP
  addRectButton(38, 362, 36, 15, 0.005, true); // QUANTIZE (red backlit!)
  addRectButton(38, 393, 36, 15, 0.005, true); // SLIP (red backlit!)
  addRectButton(38, 430, 26, 22, 0.0054); // CALL / DELETE

  // True 3D recessed USB 1 (Type-A) & USB 2 (Type-C) metallic port bays with inner tongues
  for (const [usbY, isTypeC] of [
    [194, false],
    [292, true],
  ] as const) {
    const [ux, uz] = local(dev, 38, usbY);
    const frameGeo = new RoundedBoxGeometry(48 / dev.pxPerM, 0.0032, 46 / dev.pxPerM, 2, 0.0009);
    const frame = new THREE.Mesh(frameGeo, shared.bezel);
    frame.position.set(ux, TOP_Y + 0.002, uz);
    const cavityGeo = new THREE.BoxGeometry(isTypeC ? 0.011 : 0.015, 0.0026, isTypeC ? 0.0042 : 0.0072);
    const cavityMat = new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.95 });
    const cavity = new THREE.Mesh(cavityGeo, cavityMat);
    cavity.position.set(ux, TOP_Y + 0.0026, uz);
    const tongueGeo = new THREE.BoxGeometry(isTypeC ? 0.0082 : 0.012, 0.0012, 0.0016);
    const tongue = new THREE.Mesh(tongueGeo, shared.silver);
    tongue.position.set(ux, TOP_Y + 0.0034, uz - 0.0012);
    group.add(frame, cavity, tongue);
    disposables.push(frameGeo, cavityGeo, cavityMat, tongueGeo);
  }

  // Loop & Beat Jump cluster
  addRoundButton(38, 483, 18, 0.007, true); // IN/CUE
  addRoundButton(90, 483, 18, 0.007, true); // OUT
  addRoundButton(152, 483, 15, 0.0062, false); // RELOOP/EXIT
  addRoundButton(38, 544, 13, 0.0056, false); // BEAT LOOP 4
  addRoundButton(90, 544, 13, 0.0056, false); // BEAT LOOP 8
  addRectButton(38, 596, 30, 22, 0.0054); // BEAT JUMP <
  addRectButton(90, 596, 30, 22, 0.0054); // BEAT JUMP >

  // Dedicated 3D glowing amber LED halo rings around IN/CUE & OUT + amber center dot on RELOOP/EXIT
  const loopRingMat = new THREE.MeshStandardMaterial({
    color: 0xf0a228,
    emissive: new THREE.Color(0xf0a228),
    emissiveIntensity: 2.0,
    roughness: 0.22,
    metalness: 0.1,
  });
  const loopHaloGeos: THREE.BufferGeometry[] = [];
  for (const cx of [38, 90]) {
    const [lx, lz] = local(dev, cx, 483);
    const r = (18 / dev.pxPerM) * 0.94;
    const hRaw = new THREE.TorusGeometry(r, 0.0016, 14, 44);
    hRaw.rotateX(Math.PI / 2);
    const hGeo = hRaw.index ? hRaw.toNonIndexed() : hRaw;
    if (hRaw !== hGeo) hRaw.dispose();
    hGeo.translate(lx, TOP_Y + 0.0046, lz);
    loopHaloGeos.push(hGeo);
  }
  const [relX, relZ] = local(dev, 152, 483);
  const relDotRaw = new THREE.CylinderGeometry(0.0022, 0.0024, 0.0014, 20);
  const relDot = relDotRaw.index ? relDotRaw.toNonIndexed() : relDotRaw;
  if (relDotRaw !== relDot) relDotRaw.dispose();
  relDot.translate(relX, TOP_Y + 0.0076, relZ);
  loopHaloGeos.push(relDot);
  const loopHalos = new THREE.Mesh(mergeGeometries(loopHaloGeos)!, loopRingMat);
  group.add(loopHalos);
  disposables.push(...loopHaloGeos, loopHalos.geometry, loopRingMat);

  // SLIP REV / FWD / REV physical 3D toggle lever inside recessed housing
  {
    const [sx, sz] = local(dev, 56, 665);
    const swWellGeo = new RoundedBoxGeometry(74 / dev.pxPerM, 0.0022, 44 / dev.pxPerM, 1, 0.0006);
    const swWell = new THREE.Mesh(swWellGeo, shared.bezel);
    swWell.position.set(sx, TOP_Y + 0.0015, sz);
    group.add(swWell);

    const [lx, lz] = local(dev, 39, 665);
    const leverGeo = new RoundedBoxGeometry(22 / dev.pxPerM, 0.011, 16 / dev.pxPerM, 2, 0.0015);
    const lever = new THREE.Mesh(leverGeo, darkKeycapMat);
    lever.position.set(lx, TOP_Y + 0.0068, lz);
    lever.rotation.x = -0.22;
    lever.castShadow = true;
    group.add(lever);
    disposables.push(swWellGeo, leverGeo);
  }

  // TRACK SEARCH & SEARCH (4 sculpted brushed circular machined metal buttons!)
  addRoundButton(38, 739, 16.5, 0.0068, true);
  addRoundButton(83, 739, 16.5, 0.0068, true);
  addRoundButton(38, 797, 16.5, 0.0068, true);
  addRoundButton(83, 797, 16.5, 0.0068, true);

  // Right-side Browse Pod surrounding buttons + Power
  addRoundButton(653, 164, 9, 0.0044, false); // POWER
  addRectButton(634, 210, 30, 24, 0.0056); // BACK
  addRectButton(674, 210, 30, 24, 0.0056); // TAG TRACK
  addRectButton(634, 334, 30, 24, 0.0056); // TRACK FILTER
  addRectButton(674, 334, 30, 24, 0.0056); // SHORT CUT

  // Glowing white LED collar ring around Browse rotary encoder
  const [brX, brZ] = local(dev, dev.browse.at[0], dev.browse.at[1]);
  const browseRingGeo = new THREE.TorusGeometry((dev.browse.r / dev.pxPerM) * 1.08, 0.0014, 14, 48);
  browseRingGeo.rotateX(Math.PI / 2);
  const browseRingMat = new THREE.MeshStandardMaterial({
    color: 0xf4f5f8,
    emissive: new THREE.Color(0xeef4ff),
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const browseRing = new THREE.Mesh(browseRingGeo, browseRingMat);
  browseRing.position.set(brX, TOP_Y + 0.0034, brZ);
  group.add(browseRing);
  disposables.push(browseRingGeo, browseRingMat);

  // Right performance cluster
  addRoundButton(445, 483, 11, 0.0052, false); // CALL <
  addRoundButton(485, 483, 11, 0.0052, false); // CALL >
  addRoundButton(529, 483, 13.5, 0.0058, false); // DELETE
  addRoundButton(567, 483, 11.5, 0.0052, false); // MEMORY

  addRectButton(637, 485, 32, 20, 0.0052); // VINYL / CDJ
  addRectButton(677, 485, 32, 20, 0.0052); // JOG MODE
  addRectButton(637, 552, 32, 22, 0.0054); // BEAT SYNC
  addRectButton(677, 552, 32, 22, 0.0054); // MASTER
  addRectButton(657, 587, 44, 16, 0.005); // KEY SYNC

  addRoundButton(664, 650, 9.5, 0.0054, true); // TEMPO RANGE
  addRoundButton(664, 704, 9.5, 0.0054, true); // MASTER TEMPO
  addRoundButton(596, 866, 11.5, 0.0054, false); // TEMPO RESET

  // Glowing red LED bead inside MASTER TEMPO
  const [mtX, mtZ] = local(dev, 664, 704);
  const mtLedGeo = new THREE.SphereGeometry(0.0014, 12, 12);
  const mtLedMat = new THREE.MeshStandardMaterial({
    color: 0xe52d38,
    emissive: new THREE.Color(0xff3344),
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const mtLed = new THREE.Mesh(mtLedGeo, mtLedMat);
  mtLed.position.set(mtX, TOP_Y + 0.007, mtZ);
  group.add(mtLed);
  disposables.push(mtLedGeo, mtLedMat);

  // Merge all separated static 3D button parts cleanly
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
  addMerged(redBodyGeos, redKeycapMat, true);
  addMerged(roundSkirtGeos, darkKeycapMat, true);
  addMerged(faceGeos, panelMat, false);
  addMerged(silverRimGeos, shared.silver, false);

  // =========================================================================
  // TRUE 3D FLUTED BROWSE ENCODER + VINYL SPEED ADJUST + ANIMATABLE JOG FEEL
  // =========================================================================
  const buildCdjRotary = (cx: number, cy: number, rPx: number, h: number, withPointer: boolean, angle = 0) => {
    const [kx, kz] = local(dev, cx, cy);
    const r = rPx / dev.pxPerM;

    if (aoMat) {
      const aGeo = new THREE.PlaneGeometry(r * 2.7, r * 2.7);
      aGeo.rotateX(-Math.PI / 2);
      const aMesh = new THREE.Mesh(aGeo, aoMat);
      aMesh.position.set(kx, TOP_Y + 0.00145, kz);
      group.add(aMesh);
      disposables.push(aGeo);
    }

    const knobGroup = new THREE.Group();
    knobGroup.position.set(kx, TOP_Y + 0.0013, kz);
    knobGroup.rotation.y = angle;

    const barrelGeo = createFlutedKnobBarrelGeo(r * 0.88, r * 1.02, h, withPointer ? 12 : 24, withPointer ? 0.055 : 0.032, 64);
    const barrel = new THREE.Mesh(barrelGeo, shared.knobSide);
    barrel.position.y = h / 2;
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    knobGroup.add(barrel);

    const crownRingGeo = new THREE.TorusGeometry(r * 0.87, 0.00075, 10, 40);
    crownRingGeo.rotateX(Math.PI / 2);
    const crownRing = new THREE.Mesh(crownRingGeo, shared.silver);
    crownRing.position.y = h - 0.0004;
    knobGroup.add(crownRing);

    const topDiscGeo = new THREE.CircleGeometry(r * 0.85, 40);
    topDiscGeo.rotateX(-Math.PI / 2);
    const topDisc = new THREE.Mesh(topDiscGeo, metallicCapMat);
    topDisc.position.y = h + 0.0002;
    knobGroup.add(topDisc);

    if (withPointer) {
      const finGeo = new THREE.BoxGeometry(0.0015, 0.0014, r * 0.78);
      const fin = new THREE.Mesh(finGeo, pointerMat);
      fin.position.set(0, h + 0.0008, -r * 0.36);
      knobGroup.add(fin);
      disposables.push(finGeo);
    }

    group.add(knobGroup);
    disposables.push(barrelGeo, crownRingGeo, topDiscGeo);
    return knobGroup;
  };

  buildCdjRotary(dev.browse.at[0], dev.browse.at[1], dev.browse.r, 0.019, false, 0);
  buildCdjRotary(dev.knobs[0]!.at[0], dev.knobs[0]!.at[1], dev.knobs[0]!.r, 0.0145, true, -0.45);
  const jogFeelKnob = buildCdjRotary(dev.knobs[1]!.at[0], dev.knobs[1]!.at[1], dev.knobs[1]!.r, 0.0145, true, 0);
  jogFeelKnob.name = "CDJ-JogFeel-Knob";

  // =========================================================================
  // TEMPO FADER (recessed dark dust-guard track slot + contoured P-LOCK cap)
  // =========================================================================
  const ts = dev.tempo.slot;
  const [tsx0, tsz0] = local(dev, ts.x0, ts.y0);
  const [tsx1, tsz1] = local(dev, ts.x1, ts.y1);
  const slotWellGeo = new THREE.BoxGeometry(0.0038, 0.0014, (tsz1 - tsz0) * 0.9);
  const slotWellMat = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.96 });
  const slotWell = new THREE.Mesh(slotWellGeo, slotWellMat);
  slotWell.position.set((tsx0 + tsx1) / 2, TOP_Y + 0.0015, (tsz0 + tsz1) / 2);
  group.add(slotWell);
  disposables.push(slotWellGeo, slotWellMat);

  const tc = dev.tempo.capAt;
  const [tx, tz] = local(dev, tc[0], tc[1]);
  const tempoCap = buildContouredFaderCap(44 / dev.pxPerM, 26 / dev.pxPerM, 0.017, "vertical-fader");
  tempoCap.position.set(tx, TOP_Y + 0.0012, tz);
  tempoCap.name = "CDJ-Tempo-Cap";
  group.add(tempoCap);
  tempoCap.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      disposables.push(obj.geometry);
      if (Array.isArray(obj.material)) obj.material.forEach((m) => disposables.push(m));
      else disposables.push(obj.material);
    }
  });

  const anchors = {
    screen: new THREE.Vector3(0, 0.118, (gz0 + gz1) / 2),
    jog: new THREE.Vector3(jx, TOP_Y + 0.02, jz),
    jogCollar: new THREE.Vector3(jx + rOuter * 0.72, TOP_Y + 0.014, jz - rOuter * 0.42),
    hotCues: new THREE.Vector3(0, TOP_Y + 0.008, local(dev, 359, padCy)[1]),
    play: new THREE.Vector3(play.group.position.x, TOP_Y + 0.01, play.group.position.z),
    cue: new THREE.Vector3(cue.group.position.x, TOP_Y + 0.01, cue.group.position.z),
    front: new THREE.Vector3(0, dev.feetH + dev.bodyH * 0.52, zBodyFront),
    rear: new THREE.Vector3(-0.1, 0.05, zBodyRear),
  };

  return {
    group,
    panel,
    jogPlatter,
    jogRingMat,
    jogHit,
    jogFeelKnob,
    tempoCap,
    hotCues,
    loopRingMat,
    browseRingMat,
    nfcGlowMat,
    play,
    cue,
    screen: { power: screenPower, mix: screenMix, time: screenTime, material: glassMat },
    anchors,
    dispose: () => {
      screws.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function sharedHardwareMaterials(): CdjSharedMaterials {
  const maps = createSurfaceMaps();
  return {
    chassis: chassisMaterial(0x101014, 0.72, maps.anodizedNormal, maps.anodizedRoughness),
    rubber: rubberMaterial(maps.rubberNormal),
    knobSide: knobSideMaterial(maps.rubberNormal),
    silver: brushedSilverMaterial(maps.anodizedNormal),
    bezel: buttonBezelMaterial(maps.rubberNormal),
    maps,
  };
}

export const CDJ_FRONT_Z = (() => {
  const [, z] = local(CDJ, 0, CDJ.body.y1);
  return z;
})();
