import * as THREE from "three";
import { deckAudio } from "@/audio/deckAudio";
import { buildBooth, type BoothRig, type BoothTextures } from "./booth";
import { buildClubEnvironment } from "./venue";
import { cloneShot, DEFAULT_SHOT, fitToAspect, sampleShots, type Anchor, type Shot } from "./shots";
import { damp } from "@/lib/math";
import { frame, ui } from "@/lib/store";

export interface StageController {
  setAnchors(anchors: Anchor[]): void;
  setShotOverride(shot: Shot | null, shotId?: string | null): void;
  render(dt: number, elapsed: number): void;
  resize(): void;
  dispose(): void;
}

function configureColorTex(tex: THREE.Texture, maxAniso: number) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

interface SpatialCalloutBinding {
  id: string;
  shots: string[];
  owner: "cdjLeft" | "djm";
  anchorKey: string;
  offsetY?: number;
}

const CALLOUT_BINDINGS: SpatialCalloutBinding[] = [
  { id: "jog-collar", shots: ["cdj-jog"], owner: "cdjLeft", anchorKey: "jogCollar", offsetY: 0.008 },
  { id: "jog-lcd", shots: ["cdj-jog"], owner: "cdjLeft", anchorKey: "jog", offsetY: 0.01 },
  { id: "play-halo", shots: ["cdj-playcue"], owner: "cdjLeft", anchorKey: "play", offsetY: 0.002 },
  { id: "hot-cues", shots: ["cdj-screen"], owner: "cdjLeft", anchorKey: "hotCues", offsetY: 0.004 },
  { id: "nfc-front", shots: ["cdj-front"], owner: "cdjLeft", anchorKey: "front", offsetY: 0.006 },
  { id: "djm-color", shots: ["djm-color"], owner: "djm", anchorKey: "color", offsetY: 0.014 },
  { id: "djm-beatfx", shots: ["djm-beatfx"], owner: "djm", anchorKey: "beatfxDome", offsetY: 0.01 },
  { id: "djm-magvel", shots: ["djm-fader"], owner: "djm", anchorKey: "crossfader", offsetY: 0.01 },
];

export function createStage(canvas: HTMLCanvasElement): StageController | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    ui.set({ webgl: "unavailable" });
    return null;
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x080809, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080809);
  scene.fog = new THREE.FogExp2(0x080809, 0.13);

  const envTex = buildClubEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 0.38;

  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.08, 16);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const loader = new THREE.TextureLoader();
  const loadedTextures: THREE.Texture[] = [];
  const loadTex = (url: string, onLoad?: () => void) => {
    const t = loader.load(url, () => {
      configureColorTex(t, maxAniso);
      onLoad?.();
    });
    t.colorSpace = THREE.SRGBColorSpace;
    loadedTextures.push(t);
    return t;
  };

  let readyCount = 0;
  const criticalCount = 6;
  const markLoaded = () => {
    readyCount++;
    if (readyCount >= criticalCount) {
      ui.set({ webgl: "ready" });
    }
  };

  const textures: BoothTextures = {
    cdj: {
      top: loadTex("/assets/tex/cdj-top.webp", markLoaded),
      topEmissive: loadTex("/assets/tex/cdj-top-emissive.webp", markLoaded),
      screenPlay: loadTex("/assets/tex/cdj-screen-play.webp", markLoaded),
      screenBrowse: loadTex("/assets/tex/cdj-screen-browse.webp"),
      front: loadTex("/assets/tex/cdj-front.webp"),
    },
    djm: {
      top: loadTex("/assets/tex/djm-top.webp", markLoaded),
      topEmissive: loadTex("/assets/tex/djm-top-emissive.webp", markLoaded),
      front: loadTex("/assets/tex/djm-front.webp"),
      faderCap: loadTex("/assets/tex/djm-fadercap.webp", markLoaded),
    },
    crowd: loadTex("/assets/img/club-crowd-hd.webp"),
  };

  const booth: BoothRig = buildBooth(textures);
  scene.add(booth.group);

  let anchors: Anchor[] = [];
  let overrideShot: Shot | null = null;
  let overrideShotId: string | null = null;
  const desiredShot = cloneShot(DEFAULT_SHOT);
  const currentShot = cloneShot(DEFAULT_SHOT);
  let initialized = false;
  let lastW = 0;
  let lastH = 0;

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const projVec = new THREE.Vector3();

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    const isSmall = w < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    // On portrait phones, lift the 3D hardware cleanly into the upper half of the viewport so bottom editorial content never collides with it
    if (aspect < 0.85) {
      camera.setViewOffset(w, h, 0, Math.round(h * 0.145), w, h);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  };
  resize();

  const readyTimer = window.setTimeout(() => {
    if (ui.get().webgl === "pending") ui.set({ webgl: "ready" });
  }, 1100);

  // =========================================================================
  // SECTION-SCOPED 3D HARDWARE INTERACTION + HOVER RETICLE FEEDBACK
  // Interaction is strictly limited to dedicated hardware showcase sections
  // (never accidental scratching or presses on Hero, Overview, Signal, or POV!)
  // =========================================================================
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hotCueMeshes = booth.cdjLeft.hotCues.map((hc) => hc.hitMesh);

  const getAllowedHitObjects = (): THREE.Object3D[] => {
    switch (frame.activeShot) {
      case "cdj-jog":
        return [booth.cdjLeft.jogHit, booth.cdjLeft.jogRimHit];
      case "cdj-playcue":
        return [booth.cdjLeft.play.hitMesh, booth.cdjLeft.cue.hitMesh];
      case "cdj-screen":
        return hotCueMeshes;
      case "djm-beatfx":
        return [booth.djm.hitTargets.beatFxDome];
      default:
        return [];
    }
  };
  let dragZone: "none" | "top" | "rim" = "none";
  let dragLastAngle = 0;
  let dragLastTimeMs = 0;
  let dragReleaseVel = 0;
  let scratchCoastActive = false;
  let holdingBeatFxDome = false;
  const jogCenterWorld = new THREE.Vector3();

  /** Project the 3D CDJ-3000X jog center into viewport pixel coords for true 360° circular spinning! */
  const getJogScreenCenter = (): [number, number] => {
    const anchor = booth.cdjLeft.anchors.jog;
    if (!anchor) return [lastW * 0.5, lastH * 0.5];
    jogCenterWorld.copy(anchor);
    booth.cdjLeft.group.localToWorld(jogCenterWorld);
    jogCenterWorld.project(camera);
    return [(jogCenterWorld.x * 0.5 + 0.5) * lastW, (-jogCenterWorld.y * 0.5 + 0.5) * lastH];
  };

  const isInteractiveDom = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        "button, a, input, [role='slider'], .site-header, .inspect-controls, .specs-section, .micro-widget, .cable-ignite-panel, .moment-gallery",
      ),
    );
  };

  const getHitLabel = (obj: THREE.Object3D): string | null => {
    if (obj === booth.cdjLeft.play.hitMesh) return frame.controls.playing ? "Pause" : "Press PLAY";
    if (obj === booth.cdjLeft.cue.hitMesh) return frame.controls.playing ? "Return to CUE" : "Hold CUE to play";
    if (obj === booth.cdjLeft.jogHit) return "Top platter, spin to scratch";
    if (obj === booth.cdjLeft.jogRimHit) return "Outer rim, spin to bend pitch";
    if (obj === booth.djm.hitTargets.beatFxDome) return "Hold Beat FX";
    if (typeof obj.userData.hotCueIndex === "number") {
      const idx = obj.userData.hotCueIndex as number;
      const lbl = booth.cdjLeft.hotCues[idx]?.label ?? "";
      return `Hot Cue ${lbl}`;
    }
    return null;
  };

  const updateHoverReticle = (x: number, y: number, label: string | null) => {
    const el = document.getElementById("hw-cursor-reticle");
    if (!el) return;
    if (label && window.innerWidth >= 1024) {
      el.dataset.active = "true";
      el.style.transform = `translate3d(${x + 16}px, ${y - 16}px, 0)`;
      const textEl = el.querySelector<HTMLElement>(".hw-reticle-label");
      if (textEl && textEl.textContent !== label) textEl.textContent = label;
      document.body.classList.add("hw-hovering");
    } else {
      if (el.dataset.active === "true") {
        el.dataset.active = "false";
        document.body.classList.remove("hw-hovering");
      }
    }
  };

  const onWindowPointerDown = (e: PointerEvent) => {
    if (isInteractiveDom(e.target)) return;
    const allowed = getAllowedHitObjects();
    if (allowed.length === 0) return;

    ndc.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    ndc.y = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(allowed, false);
    const first = hits[0];
    if (!first) return;

    if (first.object === booth.cdjLeft.play.hitMesh) {
      const next = frame.controls.cueHeld ? true : !frame.controls.playing;
      frame.controls.playing = next;
      frame.controls.playHeld = true;
      frame.controls.playTapImpulse = 1;
      ui.set({ playing: next, cueHeld: frame.controls.cueHeld });
      deckAudio.setPlaying(next);
    } else if (first.object === booth.cdjLeft.cue.hitMesh) {
      const wasPlaying = frame.controls.playing;
      frame.controls.playing = false;
      frame.controls.cueHeld = true;
      frame.controls.cueTapImpulse = 1;
      ui.set({ playing: false, cueHeld: true });
      if (wasPlaying) {
        deckAudio.stopToCue();
      } else {
        deckAudio.startCueHold();
      }
    } else if (first.object === booth.cdjLeft.jogHit || first.object === booth.cdjLeft.jogRimHit) {
      const isTop = first.object === booth.cdjLeft.jogHit;
      dragZone = isTop ? "top" : "rim";
      const [cx, cy] = getJogScreenCenter();
      dragLastAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      dragLastTimeMs = performance.now();
      dragReleaseVel = 0;
      frame.controls.jogMode = isTop ? "scratch" : "bend";
      frame.controls.jogTouchHeld = isTop;
      frame.controls.jogVelocity = 0;
      ui.set({ jogMode: isTop ? "scratch" : "bend" });
      deckAudio.warmUpScratch();
    } else if (first.object === booth.djm.hitTargets.beatFxDome) {
      holdingBeatFxDome = true;
      frame.controls.beatFxHold = true;
      ui.set({ beatFxHold: true });
    } else if (typeof first.object.userData.hotCueIndex === "number") {
      const idx = first.object.userData.hotCueIndex as number;
      frame.controls.hotCuePulses[idx] = 1;
      ui.set({ lastHotCue: idx });
    }
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    if (dragZone !== "none") {
      const [cx, cy] = getJogScreenCenter();
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      // Shortest signed circular angular delta (+ = clockwise on screen, - = counter-clockwise)
      const dTheta = Math.atan2(Math.sin(angle - dragLastAngle), Math.cos(angle - dragLastAngle));
      dragLastAngle = angle;

      const now = performance.now();
      const dtSec = Math.max(0.004, Math.min(0.08, (now - dragLastTimeMs) / 1000));
      dragLastTimeMs = now;

      // 1:1 direct circular tracking (spin 360° endlessly either direction — zero reversal!)
      const gain = dragZone === "top" ? 1.55 : 1.15;
      const rotDeltaY = -dTheta * gain; // Three.js rotation.y negative = clockwise from above
      booth.cdjLeft.jogPlatter.rotation.y += rotDeltaY;
      booth.cdjLeft.jogPhaseRing.rotation.y += rotDeltaY;

      const instVel = Math.max(-28, Math.min(28, rotDeltaY / dtSec));
      dragReleaseVel = dragReleaseVel * 0.45 + instVel * 0.55;
      frame.controls.jogVelocity = dragReleaseVel;

      if (dragZone === "top") {
        // Forward clockwise screen drag (+dTheta) = forward audio scratch through ahh-fresh.mp3!
        const audioVel = Math.max(-24, Math.min(24, (dTheta * gain) / dtSec));
        frame.controls.jogScratchVel = audioVel;
        deckAudio.updateScratch(audioVel, dTheta * gain);
        updateHoverReticle(e.clientX, e.clientY, "Scratching top platter");
      } else {
        frame.controls.jogPitchBend = Math.max(-1, Math.min(1, frame.controls.jogPitchBend + dTheta * 0.55));
        updateHoverReticle(e.clientX, e.clientY, "Pitch bending outer rim");
      }
      return;
    }

    if (e.pointerType !== "mouse" || frame.canvasHidden || isInteractiveDom(e.target)) {
      updateHoverReticle(e.clientX, e.clientY, null);
      return;
    }

    const allowed = getAllowedHitObjects();
    if (allowed.length === 0) {
      updateHoverReticle(e.clientX, e.clientY, null);
      return;
    }

    ndc.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    ndc.y = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(allowed, false);
    const label = hits[0] ? getHitLabel(hits[0].object) : null;
    updateHoverReticle(e.clientX, e.clientY, label);
  };

  const onWindowPointerUp = () => {
    if (dragZone !== "none") {
      const wasTop = dragZone === "top";
      dragZone = "none";
      frame.controls.jogTouchHeld = false;
      // Hand off real circular release momentum so flicks & backspins keep playing & pitching down!
      const vel = Math.abs(dragReleaseVel) > 0.45 ? dragReleaseVel : 0;
      frame.controls.jogVelocity = vel;
      if (wasTop) {
        if (Math.abs(vel) > 0.45) {
          scratchCoastActive = true;
        } else {
          scratchCoastActive = false;
          deckAudio.silenceScratch();
        }
      }
    }
    if (frame.controls.playHeld) {
      frame.controls.playHeld = false;
    }
    if (frame.controls.cueHeld) {
      frame.controls.cueHeld = false;
      ui.set({ cueHeld: false });
      deckAudio.releaseCueHold();
    }
    if (holdingBeatFxDome) {
      holdingBeatFxDome = false;
      frame.controls.beatFxHold = false;
      ui.set({ beatFxHold: false });
    }
  };

  window.addEventListener("pointerdown", onWindowPointerDown);
  window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerUp);
  window.addEventListener("blur", onWindowPointerUp);

  const onContextLost = (e: Event) => {
    e.preventDefault();
    ui.set({ webgl: "unavailable" });
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  // Cache spatial callout DOM elements lazily for 60fps 3D-to-screen projection
  let calloutEls: Map<string, HTMLElement> | null = null;
  const syncSpatialCallouts = (activeShotId: string) => {
    if (!calloutEls) {
      const els = document.querySelectorAll<HTMLElement>("[data-callout]");
      if (els.length > 0) {
        calloutEls = new Map();
        els.forEach((el) => {
          if (el.dataset.callout) calloutEls!.set(el.dataset.callout, el);
        });
      }
    }
    if (!calloutEls) return;
    const isDesktop = lastW >= 1024;
    for (const binding of CALLOUT_BINDINGS) {
      const el = calloutEls.get(binding.id);
      if (!el) continue;
      const shouldShow = isDesktop && !frame.canvasHidden && binding.shots.includes(activeShotId);
      if (!shouldShow) {
        if (el.dataset.visible !== "false") el.dataset.visible = "false";
        continue;
      }
      const device = binding.owner === "cdjLeft" ? booth.cdjLeft : booth.djm;
      const localAnchor = device.anchors[binding.anchorKey];
      if (!localAnchor) continue;
      projVec.copy(localAnchor);
      if (binding.offsetY) projVec.y += binding.offsetY;
      device.group.localToWorld(projVec);
      projVec.project(camera);

      const inFront = projVec.z > -1 && projVec.z < 1;
      const sx = (projVec.x * 0.5 + 0.5) * lastW;
      const sy = (-projVec.y * 0.5 + 0.5) * lastH;
      const inBounds = inFront && sx > 72 && sx < lastW - 72 && sy > 76 && sy < lastH - 76;
      if (inBounds) {
        el.dataset.visible = "true";
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      } else {
        el.dataset.visible = "false";
      }
    }
  };

  const render = (dt: number, elapsed: number) => {
    if (document.hidden || frame.canvasHidden) return;

    let activeShotId = frame.activeShot;
    if (overrideShot) {
      Object.assign(desiredShot, cloneShot(overrideShot));
      if (overrideShotId) {
        activeShotId = overrideShotId;
        frame.activeShot = overrideShotId;
      }
    } else {
      const sampled = sampleShots(anchors, frame.scrollY, desiredShot, 0.54);
      activeShotId = sampled.activeId;
      frame.activeShot = sampled.activeId;
      frame.shotLocalT = sampled.t;
      if (ui.get().activeShot !== sampled.activeId) {
        ui.set({ activeShot: sampled.activeId });
      }
    }

    deckAudio.syncSection(activeShotId);
    // Keep scratching ahh-fresh.mp3 seamlessly while a flicked/released top platter coasts to rest!
    if (scratchCoastActive && dragZone === "none") {
      if (activeShotId === "cdj-jog" && Math.abs(frame.controls.jogVelocity) > 0.35) {
        const audioVel = -frame.controls.jogVelocity;
        deckAudio.updateScratch(audioVel, audioVel * dt);
      } else {
        scratchCoastActive = false;
        deckAudio.silenceScratch();
      }
    } else {
      deckAudio.tick(frame.controls.jogVelocity);
    }

    const reduced = ui.get().reducedMotion;
    const lambda = reduced ? 24 : 8.0;

    if (!initialized) {
      Object.assign(currentShot, cloneShot(desiredShot));
      initialized = true;
    } else {
      for (let i = 0; i < 3; i++) {
        currentShot.pos[i] = damp(currentShot.pos[i]!, desiredShot.pos[i]!, lambda, dt);
        currentShot.target[i] = damp(currentShot.target[i]!, desiredShot.target[i]!, lambda, dt);
      }
      currentShot.fov = damp(currentShot.fov, desiredShot.fov, lambda, dt);
      currentShot.exposure = damp(currentShot.exposure, desiredShot.exposure, lambda, dt);
      currentShot.key = damp(currentShot.key, desiredShot.key, lambda, dt);
      currentShot.rim = damp(currentShot.rim, desiredShot.rim, lambda, dt);
      currentShot.spot = damp(currentShot.spot, desiredShot.spot, lambda, dt);
      currentShot.env = damp(currentShot.env, desiredShot.env, lambda, dt);
      currentShot.power = damp(currentShot.power, desiredShot.power, lambda, dt);
      currentShot.led = damp(currentShot.led, desiredShot.led, lambda, dt);
      currentShot.screen = damp(currentShot.screen, desiredShot.screen, lambda, dt);
      currentShot.venue = damp(currentShot.venue, desiredShot.venue, lambda, dt);
      currentShot.crowd = damp(currentShot.crowd, desiredShot.crowd, lambda, dt);
      currentShot.signal = damp(currentShot.signal, desiredShot.signal, lambda, dt);
      currentShot.demo = damp(currentShot.demo, desiredShot.demo, lambda, dt);
      currentShot.fit = damp(currentShot.fit, desiredShot.fit, lambda, dt);
    }

    const fittedPos = fitToAspect(currentShot, camera.aspect);

    const parallaxScale = reduced ? 0 : 0.028;
    const breathX = reduced ? 0 : Math.sin(elapsed * 0.45) * 0.012;
    const breathY = reduced ? 0 : Math.cos(elapsed * 0.34) * 0.007;
    const kickPush = reduced ? 0 : frame.kick * frame.release * 0.018;
    const px = frame.pointerX * parallaxScale + breathX;
    const py = frame.pointerY * parallaxScale * 0.65 + breathY;

    camPos.set(fittedPos[0] + px, fittedPos[1] - py, fittedPos[2] - kickPush);
    camTarget.set(currentShot.target[0], currentShot.target[1], currentShot.target[2]);

    camera.position.copy(camPos);
    if (Math.abs(camera.fov - currentShot.fov) > 0.01) {
      camera.fov = currentShot.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(camTarget);

    renderer.toneMappingExposure = Math.max(0.001, currentShot.exposure);
    scene.environmentIntensity = currentShot.env;

    booth.apply(currentShot, frame, elapsed, dt);
    renderer.render(scene, camera);

    camera.updateMatrixWorld();
    syncSpatialCallouts(activeShotId);
  };

  return {
    setAnchors(next) {
      anchors = next;
    },
    setShotOverride(shot, shotId = null) {
      overrideShot = shot;
      overrideShotId = shot ? shotId : null;
    },
    render,
    resize,
    dispose() {
      window.clearTimeout(readyTimer);
      window.removeEventListener("pointerdown", onWindowPointerDown);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
      window.removeEventListener("blur", onWindowPointerUp);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.body.classList.remove("hw-hovering");
      booth.dispose();
      envTex.dispose();
      loadedTextures.forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
