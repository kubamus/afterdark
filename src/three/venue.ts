import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BOOTH } from "./hardware/layout";

export interface VenueRig {
  group: THREE.Group;
  update(opts: {
    venue: number;
    crowd: number;
    signal: number;
    cableIgnite: number;
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

  addPanel(0xf6f3ec, 3.0, [5.8, 1.4], [0, 4.0, 0.4]);
  addPanel(0xdde6f4, 2.5, [6.8, 1.0], [0, 1.7, -4.2]);
  addPanel(0xffe4cc, 1.7, [2.4, 1.6], [4.5, 1.5, 1.5]);
  addPanel(0xc8d6ec, 1.4, [2.4, 1.5], [-4.5, 1.4, 1.2]);
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

function smooth01(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

interface SlidingCable {
  group: THREE.Group;
  unpluggedZ: number;
  pluggedZ: number;
}

/**
 * Physical obsidian DJ booth counter (no giant horizon-clipping floor plane!) +
 * normal matte-black rear cables (IEC Power, Cat6 PRO DJ LINK with RJ45 port LEDs,
 * gunmetal Neutrik XLR Master L/R) that physically plug into rear sockets,
 * turning a dark empty room into authentic overhead moving-head club lighting.
 */
export function buildVenue(
  crowdTex: THREE.Texture | null = null,
  rubberNormal: THREE.Texture | null = null,
): VenueRig {
  const group = new THREE.Group();
  group.name = "Venue";
  const disposables: { dispose(): void }[] = [];

  // Real physical sleek DJ booth tabletop right under the CDJs & DJM-A9
  // (No giant opaque floor plane cutting a black horizon seam across the club beams!)
  const tableGeo = new THREE.BoxGeometry(1.56, 0.08, 0.76);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x09090c,
    roughness: 0.72,
    metalness: 0.14,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.set(0, BOOTH.tableY - 0.041, -0.04);
  table.receiveShadow = true;
  group.add(table);
  disposables.push(tableGeo, tableMat);

  // Subtle recessed brushed-dark rear cable channel strip along the back of the booth tabletop
  const channelGeo = new THREE.BoxGeometry(1.26, 0.004, 0.042);
  const channelMat = new THREE.MeshStandardMaterial({
    color: 0x050507,
    roughness: 0.9,
    metalness: 0.1,
  });
  const channel = new THREE.Mesh(channelGeo, channelMat);
  channel.position.set(0, BOOTH.tableY + 0.001, -0.35);
  group.add(channel);
  disposables.push(channelGeo, channelMat);

  // =========================================================================
  // HIGH-DETAIL STUDIO-GRADE REAR BOOTH CABLES + MACHINED 3D CONNECTORS
  // (64-seg smooth curves, textured satin elastomer jacket, Neutrik XLR with
  //  locking latch + knurled chuck + ribbed boot, chamfered IEC C13, shielded RJ45)
  // =========================================================================
  const cableJacketMat = new THREE.MeshPhysicalMaterial({
    color: 0x16171c,
    roughness: 0.48,
    metalness: 0.12,
    clearcoat: 0.14,
    clearcoatRoughness: 0.48,
    normalMap: rubberNormal,
    normalScale: new THREE.Vector2(0.26, 0.26),
  });
  const plugBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e2027,
    roughness: 0.42,
    metalness: 0.2,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4,
    normalMap: rubberNormal,
    normalScale: new THREE.Vector2(0.18, 0.18),
  });
  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x727988,
    roughness: 0.24,
    metalness: 0.92,
  });
  const chromeLatchMat = new THREE.MeshStandardMaterial({
    color: 0xcbd2de,
    roughness: 0.18,
    metalness: 0.96,
  });
  const rj45SilverMat = new THREE.MeshStandardMaterial({
    color: 0xb6becd,
    roughness: 0.22,
    metalness: 0.94,
  });
  const socketPlateMat = new THREE.MeshStandardMaterial({
    color: 0x15161c,
    roughness: 0.38,
    metalness: 0.72,
  });
  const xlrRedBandMat = new THREE.MeshStandardMaterial({
    color: 0xb5242e,
    roughness: 0.42,
    metalness: 0.14,
  });
  const xlrWhiteBandMat = new THREE.MeshStandardMaterial({
    color: 0xd4dae4,
    roughness: 0.42,
    metalness: 0.14,
  });
  disposables.push(
    cableJacketMat,
    plugBodyMat,
    gunmetalMat,
    chromeLatchMat,
    rj45SilverMat,
    socketPlateMat,
    xlrRedBandMat,
    xlrWhiteBandMat,
  );

  const powerCables: SlidingCable[] = [];
  const linkCables: SlidingCable[] = [];
  const xlrCables: SlidingCable[] = [];
  const linkLedMats: THREE.MeshStandardMaterial[] = [];

  const addCableTube = (parent: THREE.Group, points: THREE.Vector3[], radius: number) => {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    const geo = new THREE.TubeGeometry(curve, 64, radius, 24, false);
    const mesh = new THREE.Mesh(geo, cableJacketMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    disposables.push(geo);
  };

  // Fixed machined chassis socket bezels mounted on the rear panel of the DJM-A9 & CDJs
  const socketGeo = new RoundedBoxGeometry(0.028, 0.022, 0.0045, 2, 0.0012);
  const xlrSocketRingGeo = new THREE.CylinderGeometry(0.0128, 0.0128, 0.005, 32);
  xlrSocketRingGeo.rotateX(Math.PI / 2);
  disposables.push(socketGeo, xlrSocketRingGeo);
  const addRearSocket = (x: number, y: number, z: number, round = false) => {
    const s = new THREE.Mesh(round ? xlrSocketRingGeo : socketGeo, socketPlateMat);
    s.position.set(x, y, z);
    group.add(s);
  };

  // Ribbed flexible strain-relief ring geometry shared across IEC & XLR boots
  const ribRingGeo = new THREE.TorusGeometry(0.0064, 0.0011, 10, 24);
  disposables.push(ribRingGeo);

  // 1) 3× Realistic Chamfered IEC C13 Power Cords (Left CDJ, DJM-A9, Right CDJ)
  const iecBodyGeo = new RoundedBoxGeometry(0.024, 0.016, 0.04, 3, 0.0024);
  const iecGripGeo = new RoundedBoxGeometry(0.0265, 0.0185, 0.012, 2, 0.0018);
  const iecBootGeo = new THREE.CylinderGeometry(0.0054, 0.0076, 0.022, 20);
  iecBootGeo.rotateX(Math.PI / 2);
  disposables.push(iecBodyGeo, iecGripGeo, iecBootGeo);

  for (const px of [-BOOTH.cdjX - 0.075, -0.148, BOOTH.cdjX + 0.075]) {
    addRearSocket(px, 0.036, -0.214);
    const cGroup = new THREE.Group();
    const plug = new THREE.Mesh(iecBodyGeo, plugBodyMat);
    plug.position.set(px, 0.036, -0.232);
    plug.castShadow = true;
    const grip = new THREE.Mesh(iecGripGeo, plugBodyMat);
    grip.position.set(px, 0.036, -0.244);
    const boot = new THREE.Mesh(iecBootGeo, plugBodyMat);
    boot.position.set(px, 0.036, -0.262);
    cGroup.add(plug, grip, boot);
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(ribRingGeo, plugBodyMat);
      rib.position.set(px, 0.036, -0.256 - r * 0.0055);
      rib.scale.setScalar(0.95 - r * 0.08);
      cGroup.add(rib);
    }

    addCableTube(
      cGroup,
      [
        new THREE.Vector3(px, 0.036, -0.268),
        new THREE.Vector3(px, 0.025, -0.314),
        new THREE.Vector3(px * 0.99, 0.008, -0.35),
        new THREE.Vector3(px * 0.98, -0.028, -0.366),
      ],
      0.0052,
    );

    group.add(cGroup);
    powerCables.push({ group: cGroup, unpluggedZ: -0.068, pluggedZ: 0 });
  }

  // 2) 2× Shielded Cat6 PRO DJ LINK Ethernet Patch Cords (Left CDJ <-> DJM-A9, Right CDJ <-> DJM-A9)
  const rjPlugGeo = new RoundedBoxGeometry(0.0135, 0.0115, 0.025, 2, 0.0012);
  const rjBootGeo = new RoundedBoxGeometry(0.0115, 0.0105, 0.02, 2, 0.0022);
  const rjClipGeo = new THREE.BoxGeometry(0.005, 0.003, 0.014);
  const ledGeo = new THREE.BoxGeometry(0.0036, 0.0026, 0.0022);
  disposables.push(rjPlugGeo, rjBootGeo, rjClipGeo, ledGeo);

  const buildLinkPair = (xA: number, xB: number) => {
    const cGroup = new THREE.Group();
    for (const x of [xA, xB]) {
      addRearSocket(x, 0.044, -0.214);
      const head = new THREE.Mesh(rjPlugGeo, rj45SilverMat);
      head.position.set(x, 0.044, -0.226);
      const boot = new THREE.Mesh(rjBootGeo, plugBodyMat);
      boot.position.set(x, 0.044, -0.246);
      const clip = new THREE.Mesh(rjClipGeo, plugBodyMat);
      clip.position.set(x, 0.051, -0.236);
      clip.rotation.x = 0.25;
      cGroup.add(head, boot, clip);

      // Authentic 2mm green/amber Ethernet jack status LED right above the socket
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x0a140d,
        emissive: new THREE.Color(x === xA ? 0x22c55e : 0xf59e0b),
        emissiveIntensity: 0,
        roughness: 0.22,
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(x + 0.009, 0.052, -0.215);
      group.add(led);
      linkLedMats.push(ledMat);
      disposables.push(ledMat);
    }

    const midX = (xA + xB) * 0.5;
    addCableTube(
      cGroup,
      [
        new THREE.Vector3(xA, 0.044, -0.254),
        new THREE.Vector3(xA + (midX - xA) * 0.34, 0.026, -0.31),
        new THREE.Vector3(midX, 0.014, -0.328),
        new THREE.Vector3(xB + (midX - xB) * 0.34, 0.026, -0.31),
        new THREE.Vector3(xB, 0.044, -0.254),
      ],
      0.0038,
    );

    group.add(cGroup);
    linkCables.push({ group: cGroup, unpluggedZ: -0.062, pluggedZ: 0 });
  };

  buildLinkPair(-BOOTH.cdjX + 0.055, -0.042);
  buildLinkPair(BOOTH.cdjX - 0.055, 0.042);

  // 3) 2× Machined Neutrik XLR Master Output L/R Cables (DJM-A9 Master Out -> Club PA)
  const xlrBarrelGeo = new THREE.CylinderGeometry(0.0102, 0.0098, 0.044, 32);
  xlrBarrelGeo.rotateX(Math.PI / 2);
  const xlrChuckGeo = new THREE.CylinderGeometry(0.0106, 0.0096, 0.012, 32);
  xlrChuckGeo.rotateX(Math.PI / 2);
  const xlrLatchGeo = new RoundedBoxGeometry(0.0052, 0.0034, 0.014, 2, 0.0008);
  const xlrCollarGeo = new THREE.CylinderGeometry(0.009, 0.0086, 0.0055, 28);
  xlrCollarGeo.rotateX(Math.PI / 2);
  const xlrStrainGeo = new THREE.CylinderGeometry(0.005, 0.0082, 0.026, 24);
  xlrStrainGeo.rotateX(Math.PI / 2);
  disposables.push(xlrBarrelGeo, xlrChuckGeo, xlrLatchGeo, xlrCollarGeo, xlrStrainGeo);

  const xlrSpecs = [
    { x: -0.095, band: xlrWhiteBandMat, dir: -1 },
    { x: 0.095, band: xlrRedBandMat, dir: 1 },
  ];
  for (const spec of xlrSpecs) {
    addRearSocket(spec.x, 0.046, -0.214, true);
    const cGroup = new THREE.Group();
    const barrel = new THREE.Mesh(xlrBarrelGeo, gunmetalMat);
    barrel.position.set(spec.x, 0.046, -0.236);
    barrel.castShadow = true;
    const chuck = new THREE.Mesh(xlrChuckGeo, plugBodyMat);
    chuck.position.set(spec.x, 0.046, -0.262);
    const latch = new THREE.Mesh(xlrLatchGeo, chromeLatchMat);
    latch.position.set(spec.x, 0.0565, -0.228);
    const band = new THREE.Mesh(xlrCollarGeo, spec.band);
    band.position.set(spec.x, 0.046, -0.27);
    const strain = new THREE.Mesh(xlrStrainGeo, plugBodyMat);
    strain.position.set(spec.x, 0.046, -0.285);
    cGroup.add(barrel, chuck, latch, band, strain);
    for (let r = 0; r < 4; r++) {
      const rib = new THREE.Mesh(ribRingGeo, plugBodyMat);
      rib.position.set(spec.x, 0.046, -0.276 - r * 0.0048);
      rib.scale.setScalar(1.06 - r * 0.09);
      cGroup.add(rib);
    }

    addCableTube(
      cGroup,
      [
        new THREE.Vector3(spec.x, 0.046, -0.296),
        new THREE.Vector3(spec.x + spec.dir * 0.008, 0.026, -0.33),
        new THREE.Vector3(spec.x + spec.dir * 0.016, 0.006, -0.352),
        new THREE.Vector3(spec.x + spec.dir * 0.02, -0.032, -0.365),
      ],
      0.0048,
    );

    group.add(cGroup);
    xlrCables.push({ group: cGroup, unpluggedZ: -0.072, pluggedZ: 0 });
  }

  // =========================================================================
  // NORMAL CLUB LIGHTING RIG (Architectural Overhead Truss + Moving-Head Spots
  // + Clean Volumetric Haze Cones — zero pasted 2D photo, zero floor cutoff!)
  // =========================================================================
  const clubRigGroup = new THREE.Group();
  group.add(clubRigGroup);

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e13,
    roughness: 0.58,
    metalness: 0.78,
  });
  const fixtureBodyMat = new THREE.MeshStandardMaterial({
    color: 0x14141a,
    roughness: 0.48,
    metalness: 0.6,
  });
  const trussBarGeo = new THREE.BoxGeometry(5.8, 0.038, 0.038);
  const headGeo = new THREE.CylinderGeometry(0.032, 0.04, 0.088, 16);
  const lensGeo = new THREE.CircleGeometry(0.03, 20);
  lensGeo.rotateX(Math.PI / 2);
  disposables.push(trussMat, fixtureBodyMat, trussBarGeo, headGeo, lensGeo);

  // Two dark steel trusses:
  //  - z = -3.2, y = 1.68 (framed cleanly in the upper club ceiling from DJ POV!)
  //  - z = +2.4, y = 1.18 (framed cleanly in the upper dark room from rear Signal Bridge!)
  const frontTruss = new THREE.Mesh(trussBarGeo, trussMat);
  frontTruss.position.set(0, 1.68, -3.2);
  const rearTruss = new THREE.Mesh(trussBarGeo, trussMat);
  rearTruss.position.set(0, 1.18, 2.4);
  clubRigGroup.add(frontTruss, rearTruss);

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
      float edge = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 2.6);
      float axial = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.32, 1.0, vUv.y));
      float core = pow(edge, 1.8) * 0.55;
      float alpha = (edge * 0.65 + core) * axial * uOpacity;
      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  interface MovingHead {
    pivot: THREE.Group;
    beamMat: THREE.ShaderMaterial;
    lensMat: THREE.MeshBasicMaterial;
    baseRotZ: number;
    baseRotX: number;
    phase: number;
    baseOpacity: number;
  }

  const movingHeads: MovingHead[] = [];

  // Realistic underground club moving-head beam array: deep crimson, warm tungsten amber, crisp white
  const headConfigs: {
    pos: [number, number, number];
    rot: [number, number, number];
    color: number;
    rTop: number;
    rBot: number;
    len: number;
    phase: number;
    opacity: number;
  }[] = [
    // Front-of-house dancefloor moving heads (DJ POV)
    { pos: [-2.15, 1.65, -3.2], rot: [0.22, 0, -0.36], color: 0xe02836, rTop: 0.026, rBot: 0.58, len: 4.5, phase: 0.0, opacity: 0.24 },
    { pos: [-1.22, 1.65, -3.2], rot: [0.16, 0, -0.16], color: 0xf8d4a6, rTop: 0.022, rBot: 0.44, len: 4.6, phase: 1.4, opacity: 0.17 },
    { pos: [-0.38, 1.65, -3.2], rot: [0.14, 0, 0.2], color: 0xdce6ff, rTop: 0.02, rBot: 0.38, len: 4.5, phase: 2.7, opacity: 0.14 },
    { pos: [0.38, 1.65, -3.2], rot: [0.14, 0, -0.2], color: 0xdce6ff, rTop: 0.02, rBot: 0.38, len: 4.5, phase: 3.9, opacity: 0.14 },
    { pos: [1.22, 1.65, -3.2], rot: [0.16, 0, 0.16], color: 0xf8d4a6, rTop: 0.022, rBot: 0.44, len: 4.6, phase: 5.1, opacity: 0.17 },
    { pos: [2.15, 1.65, -3.2], rot: [0.22, 0, 0.36], color: 0xe02836, rTop: 0.026, rBot: 0.58, len: 4.5, phase: 0.8, opacity: 0.24 },

    // Rear-wall club moving heads (visible directly behind the booth in Signal Bridge once XLR connects!)
    { pos: [-1.55, 1.15, 2.4], rot: [-0.22, 0, -0.34], color: 0xe02836, rTop: 0.026, rBot: 0.56, len: 3.8, phase: 0.3, opacity: 0.25 },
    { pos: [-0.72, 1.15, 2.4], rot: [-0.15, 0, 0.18], color: 0xf8d4a6, rTop: 0.022, rBot: 0.42, len: 3.9, phase: 1.8, opacity: 0.18 },
    { pos: [0.0, 1.15, 2.4], rot: [-0.12, 0, -0.06], color: 0xdce6ff, rTop: 0.02, rBot: 0.36, len: 3.8, phase: 3.1, opacity: 0.15 },
    { pos: [0.72, 1.15, 2.4], rot: [-0.15, 0, -0.18], color: 0xf8d4a6, rTop: 0.022, rBot: 0.42, len: 3.9, phase: 4.3, opacity: 0.18 },
    { pos: [1.55, 1.15, 2.4], rot: [-0.22, 0, 0.34], color: 0xe02836, rTop: 0.026, rBot: 0.56, len: 3.8, phase: 5.4, opacity: 0.25 },
  ];

  for (const cfg of headConfigs) {
    const pivot = new THREE.Group();
    pivot.position.set(...cfg.pos);
    pivot.rotation.set(...cfg.rot);

    const head = new THREE.Mesh(headGeo, fixtureBodyMat);
    head.position.y = -0.036;
    pivot.add(head);

    const lensMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(cfg.color),
      transparent: true,
      opacity: 0,
    });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.y = -0.082;
    pivot.add(lens);

    const coneGeo = new THREE.CylinderGeometry(cfg.rTop, cfg.rBot, cfg.len, 28, 1, true);
    coneGeo.translate(0, -cfg.len / 2 - 0.082, 0);
    const beamMat = new THREE.ShaderMaterial({
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
    const cone = new THREE.Mesh(coneGeo, beamMat);
    pivot.add(cone);

    clubRigGroup.add(pivot);
    movingHeads.push({
      pivot,
      beamMat,
      lensMat,
      baseRotZ: cfg.rot[2],
      baseRotX: cfg.rot[0],
      phase: cfg.phase,
      baseOpacity: cfg.opacity,
    });
    disposables.push(coneGeo, beamMat, lensMat);
  }

  // Soft atmospheric club haze glow far in the room (completely radial — zero horizontal seam!)
  const hazeGeo = new THREE.PlaneGeometry(9.0, 4.4);
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: {
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
      uniform float uOpacity;
      uniform float uPulse;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - vec2(0.5, 0.44)) * vec2(1.4, 1.65);
        float glow = exp(-dot(p, p) * 2.3);
        vec3 col = mix(vec3(0.38, 0.05, 0.08), vec3(0.72, 0.22, 0.14), glow * 0.6);
        col *= (0.78 + 0.32 * uPulse);
        gl_FragColor = vec4(col, glow * uOpacity * 0.34);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const hazeFront = new THREE.Mesh(hazeGeo, hazeMat);
  hazeFront.position.set(0, 0.72, -3.8);
  const hazeRear = new THREE.Mesh(hazeGeo, hazeMat);
  hazeRear.position.set(0, 0.55, 3.0);
  clubRigGroup.add(hazeFront, hazeRear);
  disposables.push(hazeGeo, hazeMat);

  // High-resolution seamless dancefloor crowd layer (1920x1080 club-crowd-hd.webp, zero upscaling!)
  let crowdMat: THREE.ShaderMaterial | null = null;
  if (crowdTex) {
    const crowdGeo = new THREE.PlaneGeometry(7.6, 3.55, 32, 1);
    const posAttr = crowdGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      posAttr.setZ(i, x * x * 0.055);
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
          col *= (0.86 + 0.24 * uPulse);
          float vigX = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
          float vigBottom = smoothstep(0.0, 0.12, vUv.y);
          float vigTop = 1.0 - smoothstep(0.76, 1.0, vUv.y);
          float alpha = vigX * vigBottom * vigTop * uOpacity;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const crowdMesh = new THREE.Mesh(crowdGeo, crowdMat);
    crowdMesh.position.set(0, 0.92, -3.1);
    group.add(crowdMesh);
    disposables.push(crowdGeo, crowdMat);
  }

  return {
    group,
    update({ venue, crowd, signal, cableIgnite, kick, release, time }) {
      const inSignalBridge = signal > 0.05;
      const powerSeated = inSignalBridge ? smooth01((cableIgnite - 0.04) / 0.24) : 1;
      const linkSeated = inSignalBridge ? smooth01((cableIgnite - 0.32) / 0.24) : 1;
      const xlrSeated = inSignalBridge ? smooth01((cableIgnite - 0.6) / 0.22) : 1;

      for (const c of powerCables) {
        c.group.position.z = c.unpluggedZ + (c.pluggedZ - c.unpluggedZ) * powerSeated;
      }
      for (const c of linkCables) {
        c.group.position.z = c.unpluggedZ + (c.pluggedZ - c.unpluggedZ) * linkSeated;
      }
      for (const c of xlrCables) {
        c.group.position.z = c.unpluggedZ + (c.pluggedZ - c.unpluggedZ) * xlrSeated;
      }

      // Authentic tiny RJ45 Ethernet jack LED blink once PRO DJ LINK is seated
      for (let i = 0; i < linkLedMats.length; i++) {
        const blink = Math.sin(time * (7.5 + i * 2.3) + i * 1.7) > -0.2 ? 1.0 : 0.25;
        linkLedMats[i]!.emissiveIntensity = linkSeated > 0.88 ? 2.2 * blink : 0;
      }

      // From NO club (0) -> full normal club lighting after XLR Master cables plug in!
      const clubWake = inSignalBridge ? smooth01((cableIgnite - 0.72) / 0.24) : 0;
      const clubLevel = Math.min(1.18, venue + release * 0.65 + clubWake * 1.12);

      clubRigGroup.visible = clubLevel > 0.008;
      if (clubRigGroup.visible) {
        const sweepSpeed = 0.28 + release * 0.24 + clubWake * 0.16;
        for (let i = 0; i < movingHeads.length; i++) {
          const mh = movingHeads[i]!;
          mh.beamMat.uniforms.uOpacity!.value =
            clubLevel * mh.baseOpacity * (0.82 + 0.36 * kick);
          mh.lensMat.opacity = Math.min(0.95, clubLevel * (0.85 + 0.15 * kick));
          mh.pivot.rotation.z =
            mh.baseRotZ + Math.sin(time * sweepSpeed + mh.phase) * (0.14 + release * 0.08);
          mh.pivot.rotation.x =
            mh.baseRotX + Math.cos(time * sweepSpeed * 0.7 + mh.phase) * 0.05;
        }
        hazeMat.uniforms.uOpacity!.value = clubLevel;
        hazeMat.uniforms.uPulse!.value = kick;
      }

      if (crowdMat) {
        crowdMat.uniforms.uOpacity!.value = crowd > 0.01 ? Math.min(0.95, crowd * 0.92) : 0;
        crowdMat.uniforms.uPulse!.value = kick;
      }
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
