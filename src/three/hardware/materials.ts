import * as THREE from "three";
import type { RectPx } from "./layout";

export interface DeviceFrame {
  pxPerM: number;
  crop: { width: number; height: number };
}

/**
 * Assigns planar top-down UVs to a geometry whose vertices are in device-local metres
 * (x right, z toward the DJ, origin at the centre of the photo crop). Because every
 * surface samples the same orthographic photograph, raised controls (knobs, jog,
 * buttons) show exactly the artwork that sits beneath them in the official image.
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

export interface PanelUniforms {
  uPower: { value: number };
  uLed: { value: number };
  uBoost: { value: number };
  uMeterRect: { value: THREE.Vector4[] };
  uMeterLevel: { value: number[] };
  uTint: { value: THREE.Color };
}

export const METER_SLOTS = 6;

/**
 * MeshStandardMaterial driven by the product photograph:
 *  - map: unpowered panel colour
 *  - emissiveMap: illuminated LEDs, buttons and displays
 *  - uPower sweeps the panel awake from the DJ side to the rear
 *  - LED meter columns are gated segment-by-segment by real (or simulated) audio levels
 */
export function createPanelMaterial(base: THREE.Texture, emissive: THREE.Texture, meters: THREE.Vector4[] = []) {
  const uniforms: PanelUniforms = {
    uPower: { value: 0 },
    uLed: { value: 0 },
    uBoost: { value: 2.4 },
    uMeterRect: { value: Array.from({ length: METER_SLOTS }, (_, i) => meters[i] ?? new THREE.Vector4(-1, -1, -1, -1)) },
    uMeterLevel: { value: new Array(METER_SLOTS).fill(0) },
    uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const mat = new THREE.MeshStandardMaterial({
    map: base,
    emissiveMap: emissive,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 1,
    roughness: 0.58,
    metalness: 0.08,
    alphaTest: 0.5,
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

/** Matte anodised/painted chassis surface. */
export function chassisMaterial(color = 0x121214, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.35 });
}

export function rubberMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.82, metalness: 0 });
}

export function knobSideMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.38, metalness: 0.55 });
}

/** Builds a merged set of knob caps (photo-projected tops) and skirts. */
export function buildKnobs(
  dev: DeviceFrame,
  specs: { at: readonly [number, number]; r: number; h: number }[],
  panelY: number,
) {
  const tops: THREE.BufferGeometry[] = [];
  const sides: THREE.BufferGeometry[] = [];
  for (const k of specs) {
    const [x, z] = local(dev, k.at[0], k.at[1]);
    const r = k.r / dev.pxPerM;
    const top = new THREE.CircleGeometry(r, 36);
    top.rotateX(-Math.PI / 2);
    top.translate(x, panelY + k.h, z);
    applyPlanarUV(top, dev);
    tops.push(top);
    const side = new THREE.CylinderGeometry(r, r * 1.06, k.h, 36, 1, true);
    side.translate(x, panelY + k.h / 2, z);
    sides.push(side);
  }
  return { tops, sides };
}
