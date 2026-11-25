import * as THREE from "three";
import { BOOTH } from "./hardware/layout";

export interface VenueRig {
  group: THREE.Group;
  update(opts: {
    venue: number;
    crowd: number;
    signal: number;
    kick: number;
    release: number;
    time: number;
  }): void;
  dispose(): void;
}

/**
 * Generates a studio/club PMREM environment texture procedurally so black anodised
 * aluminum, brushed chrome jog rims, and clearcoat glass screens catch crisp directional
 * specular reflections without downloading a multi-megabyte HDRI.
 */
export function buildClubEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x040406);

  const addPanel = (
    color: number,
    intensity: number,
    size: [number, number],
    pos: [number, number, number],
    lookAt: [number, number, number] = [0, 0, 0],
  ) => {
    const geo = new THREE.PlaneGeometry(size[0], size[1]);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.lookAt(...lookAt);
    envScene.add(m);
  };

  // Overhead studio softbox strip (reveals brushed chrome jog ring & clearcoat glass)
  addPanel(0xf6f3ec, 3.0, [5.8, 1.4], [0, 4.0, 0.4]);
  // Cool rim strip from crowd side (defines front/rear bevels and knob collars)
  addPanel(0xdde6f4, 2.5, [6.8, 1.0], [0, 1.7, -4.2]);
  // Warm side kicker right
  addPanel(0xffe4cc, 1.7, [2.4, 1.6], [4.5, 1.5, 1.5]);
  // Subtle cool side fill left
  addPanel(0xc8d6ec, 1.4, [2.4, 1.5], [-4.5, 1.4, 1.2]);
  // Restrained crimson venue bounce far back
  addPanel(0xe52d38, 1.0, [3.2, 0.7], [0, 2.4, -5.8]);

  const rt = pmrem.fromScene(envScene, 0.032);
  envScene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();
  return rt.texture;
}

/**
 * Single monolithic seamless booth surface (zero coplanar geometry → zero Z-fighting!),
 * audio signal cable (CDJ-3000X → DJM-A9), drifting volumetric venue light beams,
 * and curved dark-club backdrop plate.
 */
export function buildVenue(crowdTex: THREE.Texture | null): VenueRig {
  const group = new THREE.Group();
  group.name = "Venue";
  const disposables: { dispose(): void }[] = [];

  // Single continuous seamless studio/booth deck plane fading radially into pure obsidian
  const tableGeo = new THREE.PlaneGeometry(7.6, 4.8);
  tableGeo.rotateX(-Math.PI / 2);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x0b0b0e,
    roughness: 0.44,
    metalness: 0.24,
  });
  tableMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
  float dist = length(vWorldPos.xz * vec2(0.42, 0.65));
  float edge = 1.0 - smoothstep(0.48, 1.28, dist);
  gl_FragColor.rgb *= edge;`,
      );
  };
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = BOOTH.tableY - 0.001;
  table.receiveShadow = true;
  group.add(table);
  disposables.push(tableGeo, tableMat);

  // Coaxial / audio signal cable connecting Left CDJ-3000X rear output → DJM-A9 Ch 2 rear input
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-BOOTH.cdjX + 0.05, 0.048, -0.215),
    new THREE.Vector3(-BOOTH.cdjX + 0.04, 0.042, -0.34),
    new THREE.Vector3(-0.22, 0.024, -0.385),
    new THREE.Vector3(-0.075, 0.036, -0.33),
    new THREE.Vector3(-0.038, 0.052, -0.212),
  ]);
  const cableGeo = new THREE.TubeGeometry(cableCurve, 64, 0.0048, 14, false);
  const cableUniforms = {
    uSignal: { value: 0 },
    uTime: { value: 0 },
  };
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x151519,
    roughness: 0.4,
    metalness: 0.28,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1,
  });
  cableMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cableUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vCableUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCableUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vCableUv;\nuniform float uSignal;\nuniform float uTime;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
  float flow = fract(vCableUv.x * 2.0 - uTime * 0.85);
  float pulse = exp(-pow((flow - 0.5) * 6.5, 2.0));
  float carrier = 0.22 + 0.78 * pulse;
  vec3 sigCol = mix(vec3(0.90, 0.18, 0.22), vec3(0.98, 0.96, 0.92), pulse * 0.72);
  totalEmissiveRadiance = sigCol * carrier * uSignal * 3.2;`,
      );
  };
  const cable = new THREE.Mesh(cableGeo, cableMat);
  cable.castShadow = true;
  group.add(cable);
  disposables.push(cableGeo, cableMat);

  // PRO DJ LINK cable for Right CDJ-3000X → DJM-A9 Ch 3
  const cableRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(BOOTH.cdjX - 0.05, 0.048, -0.215),
    new THREE.Vector3(BOOTH.cdjX - 0.04, 0.04, -0.335),
    new THREE.Vector3(0.22, 0.022, -0.375),
    new THREE.Vector3(0.08, 0.035, -0.32),
    new THREE.Vector3(0.038, 0.052, -0.212),
  ]);
  const cableRGeo = new THREE.TubeGeometry(cableRCurve, 48, 0.0044, 12, false);
  const cableRMat = new THREE.MeshStandardMaterial({ color: 0x131317, roughness: 0.46, metalness: 0.22 });
  const cableR = new THREE.Mesh(cableRGeo, cableRMat);
  group.add(cableR);
  disposables.push(cableRGeo, cableRMat);

  // Volumetric architectural club light beams (subtle ambient haze always alive + intensifies on release)
  const beamGroup = new THREE.Group();
  group.add(beamGroup);
  const beamMats: THREE.ShaderMaterial[] = [];
  const beamConfigs: {
    pos: [number, number, number];
    rot: [number, number, number];
    color: number;
    rTop: number;
    rBot: number;
    len: number;
    phase: number;
  }[] = [
    { pos: [-1.7, 2.3, -2.5], rot: [0.32, 0, -0.44], color: 0xe52d38, rTop: 0.05, rBot: 0.88, len: 4.8, phase: 0.0 },
    { pos: [1.7, 2.3, -2.5], rot: [0.32, 0, 0.44], color: 0xe52d38, rTop: 0.05, rBot: 0.88, len: 4.8, phase: 1.4 },
    { pos: [-0.65, 2.6, -2.8], rot: [0.22, 0, -0.18], color: 0xf4eee4, rTop: 0.04, rBot: 0.72, len: 5.0, phase: 2.6 },
    { pos: [0.65, 2.6, -2.8], rot: [0.22, 0, 0.18], color: 0xf4eee4, rTop: 0.04, rBot: 0.72, len: 5.0, phase: 4.1 },
  ];

  const beamVert = `
    varying vec2 vUv;
    varying vec3 vNormalView;
    varying vec3 vViewDir;
    void main() {
      vUv = uv;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vNormalView = normalize(normalMatrix * normal);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `;
  const beamFrag = `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    varying vec3 vNormalView;
    varying vec3 vViewDir;
    void main() {
      float edge = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.75);
      float axial = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
      float alpha = edge * axial * uOpacity;
      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  const beamMeshes: { mesh: THREE.Mesh; baseRotZ: number; phase: number }[] = [];
  for (const cfg of beamConfigs) {
    const geo = new THREE.CylinderGeometry(cfg.rTop, cfg.rBot, cfg.len, 32, 1, true);
    geo.translate(0, -cfg.len / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(cfg.color) },
        uOpacity: { value: 0 },
      },
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...cfg.pos);
    mesh.rotation.set(...cfg.rot);
    beamGroup.add(mesh);
    beamMats.push(mat);
    beamMeshes.push({ mesh, baseRotZ: cfg.rot[2], phase: cfg.phase });
    disposables.push(geo, mat);
  }

  // Curved dark-club atmosphere backdrop behind the booth
  let crowdMat: THREE.ShaderMaterial | null = null;
  if (crowdTex) {
    const crowdGeo = new THREE.PlaneGeometry(7.2, 4.4, 24, 1);
    const pos = crowdGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, x * x * 0.08);
    }
    crowdGeo.computeVertexNormals();
    crowdMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: crowdTex },
        uOpacity: { value: 0 },
        uPulse: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uOpacity;
        uniform float uPulse;
        varying vec2 vUv;
        void main() {
          vec3 col = texture2D(uMap, vUv).rgb;
          float vigX = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));
          float vigY = smoothstep(0.0, 0.26, vUv.y) * (1.0 - smoothstep(0.84, 1.0, vUv.y));
          col *= (0.82 + 0.42 * uPulse);
          col += vec3(0.26, 0.03, 0.04) * uPulse * (1.0 - vUv.y) * 0.45;
          gl_FragColor = vec4(col, vigX * vigY * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const crowd = new THREE.Mesh(crowdGeo, crowdMat);
    crowd.position.set(0, 0.85, -3.65);
    group.add(crowd);
    disposables.push(crowdGeo, crowdMat);
  }

  return {
    group,
    update({ venue, crowd, signal, kick, release, time }) {
      cableUniforms.uSignal.value = signal;
      cableUniforms.uTime.value = time;

      // Subtle living architectural haze even in studio views, erupting dramatically on release/venue
      const beamIntensity = Math.min(1, venue * 0.9 + release * 0.85);
      beamGroup.visible = beamIntensity > 0.005;
      if (beamGroup.visible) {
        for (let i = 0; i < beamMats.length; i++) {
          const mat = beamMats[i]!;
          const bm = beamMeshes[i]!;
          const isRed = i < 2;
          const baseOp = isRed ? 0.16 : 0.085;
          mat.uniforms.uOpacity!.value = beamIntensity * baseOp * (0.76 + 0.55 * kick);
          bm.mesh.rotation.z = bm.baseRotZ + Math.sin(time * (0.38 + release * 0.45) + bm.phase) * (0.09 + release * 0.12);
        }
      }

      if (crowdMat) {
        const cOp = crowd > 0.005 ? Math.min(1, crowd * 0.94 + release * 0.58 * Math.min(1, crowd * 5)) : 0;
        crowdMat.uniforms.uOpacity!.value = cOp;
        crowdMat.uniforms.uPulse!.value = kick * (0.55 + 0.45 * release);
      }
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
