import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CDJ } from "./layout";
import {
  applyPlanarUV,
  buildKnobs,
  chassisMaterial,
  createPanelMaterial,
  knobSideMaterial,
  local,
  rubberMaterial,
  type PanelUniforms,
} from "./materials";

export interface CdjTextures {
  top: THREE.Texture;
  topEmissive: THREE.Texture;
  screenPlay: THREE.Texture;
  screenBrowse: THREE.Texture;
  front: THREE.Texture;
}

export interface CdjRig {
  group: THREE.Group;
  panel: PanelUniforms;
  play: { mesh: THREE.Mesh; uniforms: PanelUniforms; restY: number };
  cue: { mesh: THREE.Mesh; uniforms: PanelUniforms; restY: number };
  screen: { power: { value: number }; mix: { value: number }; material: THREE.MeshPhysicalMaterial };
  /** world-space anchor helpers in device-local metres */
  anchors: Record<string, THREE.Vector3>;
  dispose(): void;
}

const TOP_Y = CDJ.feetH + CDJ.bodyH;

export function buildCdj(tex: CdjTextures, shared: { chassis: THREE.Material; rubber: THREE.Material; knobSide: THREE.Material }): CdjRig {
  const group = new THREE.Group();
  group.name = "CDJ-3000X";
  const dev = CDJ;
  const disposables: { dispose(): void }[] = [];

  const [, zBodyRear] = local(dev, 0, dev.body.y0);
  const [, zBodyFront] = local(dev, 0, dev.body.y1);
  const zBodyCenter = (zBodyRear + zBodyFront) / 2;

  // Chassis
  const bodyGeo = new RoundedBoxGeometry(dev.width, dev.bodyH, dev.bodyDepth, 3, 0.0045);
  const body = new THREE.Mesh(bodyGeo, shared.chassis);
  body.position.set(0, dev.feetH + dev.bodyH / 2, zBodyCenter);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  disposables.push(bodyGeo);

  // Photographed top panel
  const { material: panelMat, uniforms: panel } = createPanelMaterial(tex.top, tex.topEmissive);
  disposables.push(panelMat);
  const topGeo = new THREE.PlaneGeometry(dev.width - 0.003, dev.bodyDepth - 0.003, 1, 1);
  topGeo.rotateX(-Math.PI / 2);
  topGeo.translate(0, TOP_Y + 0.0004, zBodyCenter);
  applyPlanarUV(topGeo, dev);
  const top = new THREE.Mesh(topGeo, panelMat);
  top.receiveShadow = true;
  group.add(top);
  disposables.push(topGeo);

  // Front face (official front elevation)
  const frontMat = new THREE.MeshStandardMaterial({ map: tex.front, roughness: 0.55, metalness: 0.25 });
  const frontGeo = new THREE.PlaneGeometry(dev.width - 0.008, dev.bodyH - 0.006);
  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.set(0, dev.feetH + dev.bodyH / 2, zBodyFront + 0.0003);
  group.add(front);
  disposables.push(frontMat, frontGeo);

  // Feet
  const footGeo = new THREE.CylinderGeometry(dev.footR, dev.footR * 0.96, dev.feetH, 40);
  disposables.push(footGeo);
  for (const sx of [-1, 1]) {
    for (const z of [zBodyFront - 0.052, zBodyRear + 0.06]) {
      const f = new THREE.Mesh(footGeo, shared.rubber);
      f.position.set(sx * (dev.width / 2 - 0.0036 - dev.footR), dev.feetH / 2, z);
      f.castShadow = true;
      group.add(f);
    }
  }

  // Tilted screen unit
  const su = dev.screenUnit;
  const [sx0, szRear] = local(dev, su.x0, su.y0);
  const [sx1, szFront] = local(dev, su.x1, su.y1);
  const sDepth = szFront - szRear;
  const tilt = Math.atan2(dev.screenRearH - dev.screenFrontH, sDepth);
  const pivot = new THREE.Group();
  pivot.position.set(0, dev.screenFrontH, szFront);
  pivot.rotation.x = tilt;
  group.add(pivot);
  const thickness = 0.02;
  const bezelGeo = new RoundedBoxGeometry(sx1 - sx0, thickness, sDepth, 2, 0.003);
  const bezel = new THREE.Mesh(bezelGeo, shared.chassis);
  bezel.position.set((sx0 + sx1) / 2, -thickness / 2, -sDepth / 2);
  bezel.castShadow = true;
  pivot.add(bezel);
  disposables.push(bezelGeo);
  const bezelTopGeo = new THREE.PlaneGeometry(sx1 - sx0 - 0.002, sDepth - 0.002);
  bezelTopGeo.rotateX(-Math.PI / 2);
  bezelTopGeo.translate((sx0 + sx1) / 2, 0, (szRear + szFront) / 2);
  applyPlanarUV(bezelTopGeo, dev);
  bezelTopGeo.translate(0, 0.0004, -szFront);
  pivot.add(new THREE.Mesh(bezelTopGeo, panelMat));
  disposables.push(bezelTopGeo);

  // Glass: emissive UI with a crossfade between the waveform and the browser
  const g = dev.glass;
  const [gx0, gz0] = local(dev, g.x0, g.y0);
  const [gx1, gz1] = local(dev, g.x1, g.y1);
  const screenPower = { value: 0 };
  const screenMix = { value: 0 };
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020203,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    emissive: 0xffffff,
    emissiveMap: tex.screenPlay,
    emissiveIntensity: 1,
  });
  glassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uBrowse = { value: tex.screenBrowse };
    shader.uniforms.uMix = screenMix;
    shader.uniforms.uScreenPower = screenPower;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uBrowse;\nuniform float uMix;\nuniform float uScreenPower;")
      .replace(
        "#include <emissivemap_fragment>",
        `#ifdef USE_EMISSIVEMAP
  vec3 ePlay = texture2D( emissiveMap, vEmissiveMapUv ).rgb;
  vec3 eBrowse = texture2D( uBrowse, vEmissiveMapUv ).rgb;
  totalEmissiveRadiance *= mix( ePlay, eBrowse, uMix ) * uScreenPower * 1.35;
#endif`,
      );
  };
  disposables.push(glassMat);
  const glassGeo = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0);
  glassGeo.rotateX(-Math.PI / 2);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set((gx0 + gx1) / 2, 0.0012, (gz0 + gz1) / 2 - szFront);
  pivot.add(glass);
  disposables.push(glassGeo);

  // Jog wheel: outer ring and platter, both carrying the photographed surface
  const [jx, jz] = local(dev, dev.jog.at[0], dev.jog.at[1]);
  const ringGeo = new THREE.CylinderGeometry(dev.jog.ringR / dev.pxPerM, (dev.jog.ringR + 3) / dev.pxPerM, 0.006, 128);
  ringGeo.translate(jx, TOP_Y + 0.003, jz);
  applyPlanarUV(ringGeo, dev);
  const platterGeo = new THREE.CylinderGeometry(dev.jog.platterR / dev.pxPerM, dev.jog.platterR / dev.pxPerM, 0.0105, 128);
  platterGeo.translate(jx, TOP_Y + 0.00525, jz);
  applyPlanarUV(platterGeo, dev);
  const jog = new THREE.Mesh(mergeGeometries([ringGeo, platterGeo])!, panelMat);
  jog.castShadow = true;
  jog.receiveShadow = true;
  group.add(jog);
  disposables.push(ringGeo, platterGeo, jog.geometry);

  // PLAY and CUE: their own materials so they can blink independently
  const button = (spec: { at: readonly [number, number]; r: number }) => {
    const [bx, bz] = local(dev, spec.at[0], spec.at[1]);
    const geo = new THREE.CylinderGeometry(spec.r / dev.pxPerM, (spec.r + 1.5) / dev.pxPerM, 0.006, 64);
    geo.translate(bx, 0, bz);
    applyPlanarUV(geo, dev);
    geo.translate(-bx, 0, -bz);
    const { material, uniforms } = createPanelMaterial(tex.top, tex.topEmissive);
    uniforms.uBoost.value = 3.2;
    const mesh = new THREE.Mesh(geo, material);
    const restY = TOP_Y + 0.003;
    mesh.position.set(bx, restY, bz);
    mesh.castShadow = true;
    group.add(mesh);
    disposables.push(geo, material);
    return { mesh, uniforms, restY };
  };
  const play = button(dev.play);
  const cue = button(dev.cue);

  // Browse knob and small knobs
  const { tops, sides } = buildKnobs(dev, [{ at: dev.browse.at, r: dev.browse.r, h: 0.016 }, ...dev.knobs], TOP_Y);
  const knobTop = new THREE.Mesh(mergeGeometries(tops)!, panelMat);
  const knobSide = new THREE.Mesh(mergeGeometries(sides)!, shared.knobSide);
  knobSide.castShadow = true;
  group.add(knobTop, knobSide);
  disposables.push(knobTop.geometry, knobSide.geometry, ...tops, ...sides);

  // Tempo fader cap (projected from the photograph)
  const tc = dev.tempo.capAt;
  const [tx, tz] = local(dev, tc[0], tc[1]);
  const tempoGeo = new THREE.BoxGeometry(44 / dev.pxPerM, 0.012, 30 / dev.pxPerM);
  tempoGeo.translate(tx, TOP_Y + 0.006, tz);
  applyPlanarUV(tempoGeo, dev);
  const tempo = new THREE.Mesh(tempoGeo, panelMat);
  tempo.castShadow = true;
  group.add(tempo);
  disposables.push(tempoGeo);

  const anchors = {
    screen: new THREE.Vector3(0, 0.115, (gz0 + gz1) / 2),
    jog: new THREE.Vector3(jx, TOP_Y + 0.011, jz),
    play: new THREE.Vector3(play.mesh.position.x, TOP_Y, play.mesh.position.z),
    front: new THREE.Vector3(0, dev.feetH + dev.bodyH / 2, zBodyFront),
    rear: new THREE.Vector3(-0.1, 0.05, zBodyRear),
  };

  return {
    group,
    panel,
    play,
    cue,
    screen: { power: screenPower, mix: screenMix, material: glassMat },
    anchors,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

export function sharedHardwareMaterials() {
  return { chassis: chassisMaterial(0x111113, 0.46), rubber: rubberMaterial(), knobSide: knobSideMaterial() };
}

export const CDJ_FRONT_Z = (() => {
  const [, z] = local(CDJ, 0, CDJ.body.y1);
  return z;
})();
