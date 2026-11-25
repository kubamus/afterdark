import * as THREE from "three";
import { buildCdj, sharedHardwareMaterials, type CdjRig, type CdjTextures } from "./hardware/cdj";
import { buildDjm, type DjmRig, type DjmTextures } from "./hardware/djm";
import { BOOTH } from "./hardware/layout";
import { buildVenue, type VenueRig } from "./venue";
import type { Shot } from "./shots";
import { ui, type Frame } from "@/lib/store";

export interface BoothTextures {
  cdj: CdjTextures;
  djm: DjmTextures;
  crowd: THREE.Texture | null;
}

export interface BoothRig {
  group: THREE.Group;
  cdjLeft: CdjRig;
  cdjRight: CdjRig;
  djm: DjmRig;
  venue: VenueRig;
  lights: {
    key: THREE.DirectionalLight;
    rimBack: THREE.DirectionalLight;
    rimLeft: THREE.DirectionalLight;
    rimRight: THREE.DirectionalLight;
    spot: THREE.SpotLight;
    clubRed: THREE.PointLight;
    ambient: THREE.HemisphereLight;
  };
  apply(shot: Shot, frame: Frame, time: number, dt: number): void;
  dispose(): void;
}

const JOG_COLOR_IDLE = new THREE.Color(0x90c2ff);
const JOG_COLOR_BEND = new THREE.Color(0x38bdf8);
const JOG_COLOR_SCRATCH = new THREE.Color(0xff2e3a);
const JOG_COLOR_LIVE = new THREE.Color(0xff4c58);

export function buildBooth(textures: BoothTextures): BoothRig {
  const group = new THREE.Group();
  group.name = "Booth";

  const shared = sharedHardwareMaterials();

  const cdjLeft = buildCdj(textures.cdj, shared);
  cdjLeft.group.name = "CDJ-3000X-Left";
  cdjLeft.group.position.set(-BOOTH.cdjX, BOOTH.tableY, 0);
  group.add(cdjLeft.group);

  const cdjRight = buildCdj(textures.cdj, shared);
  cdjRight.group.name = "CDJ-3000X-Right";
  cdjRight.group.position.set(BOOTH.cdjX, BOOTH.tableY, 0);
  group.add(cdjRight.group);

  const djm = buildDjm(textures.djm, shared);
  djm.group.position.set(0, BOOTH.tableY, 0);
  group.add(djm.group);

  const venue = buildVenue(textures.crowd, shared.maps.rubberNormal);
  group.add(venue.group);

  const ambient = new THREE.HemisphereLight(0xdbe2ef, 0x0a0a0d, 0.18);
  group.add(ambient);

  const key = new THREE.DirectionalLight(0xf8f0e4, 2.5);
  key.position.set(0.58, 1.88, 0.92);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.4;
  key.shadow.camera.far = 4.6;
  key.shadow.camera.left = -0.82;
  key.shadow.camera.right = 0.82;
  key.shadow.camera.top = 0.56;
  key.shadow.camera.bottom = -0.56;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.0025;
  key.shadow.radius = 2.6;
  group.add(key);

  const rimBack = new THREE.DirectionalLight(0xdbe5f5, 2.1);
  rimBack.position.set(0.0, 1.15, -1.9);
  group.add(rimBack);

  const rimLeft = new THREE.DirectionalLight(0xffe6d0, 1.05);
  rimLeft.position.set(-2.1, 0.72, 0.55);
  group.add(rimLeft);

  const rimRight = new THREE.DirectionalLight(0xc9d7ee, 1.05);
  rimRight.position.set(2.1, 0.72, 0.55);
  group.add(rimRight);

  const spot = new THREE.SpotLight(0xfff5e8, 5.8, 4.8, Math.PI * 0.22, 0.68, 1.35);
  spot.position.set(-0.92, 0.52, 0.78);
  spot.target.position.set(-BOOTH.cdjX + 0.02, 0.09, 0.06);
  group.add(spot, spot.target);

  const clubRed = new THREE.PointLight(0xd92634, 0, 6.2, 1.35);
  clubRed.position.set(-0.7, 1.45, -1.6);
  group.add(clubRed);

  // Secondary warm tungsten club wash that wakes naturally when XLR plugs into the PA
  const clubWarm = new THREE.PointLight(0xf5c896, 0, 6.0, 1.4);
  clubWarm.position.set(0.85, 1.5, 1.5);
  group.add(clubWarm);

  let smoothFilter = -0.78;
  let smoothFader = 0;
  let smoothCrossfader = 0;
  let smoothPlayPress = 0;
  let smoothCuePress = 0;
  let smoothScreenMix = 0;
  let autoIgnitedOnSignal = false;
  let igniteStartPerfMs = -1;
  const smoothHotCuePress = new Float32Array(8);
  const tmpJogCol = new THREE.Color();

  return {
    group,
    cdjLeft,
    cdjRight,
    djm,
    venue,
    lights: { key, rimBack, rimLeft, rimRight, spot, clubRed, ambient },
    apply(shot, frame, time, dt) {
      const k = 1 - Math.exp(-16 * dt);
      const fastSpring = 1 - Math.exp(-28 * dt);
      const activeShot = frame.activeShot;

      // =====================================================================
      // 3-STAGE REAR CABLE PLUG-IN & NORMAL CLUB LIGHT-UP CHOREOGRAPHY
      // Uses real wall-clock time so the 3.2s connection sequence stays smooth
      // across both 60/120Hz displays and low-FPS headless renderers.
      // =====================================================================
      const nowMs = typeof performance !== "undefined" ? performance.now() : time * 1000;
      if (activeShot === "signal" && !autoIgnitedOnSignal && frame.controls.cableIgniteTimer < 0) {
        autoIgnitedOnSignal = true;
        frame.controls.cableIgniteTimer = 0;
        igniteStartPerfMs = nowMs;
      } else if (activeShot !== "signal" && activeShot !== "djm-intro") {
        autoIgnitedOnSignal = false;
      }

      if (frame.controls.cableIgniteTimer >= 0) {
        if (frame.controls.cableIgniteTimer === 0 || igniteStartPerfMs < 0) {
          igniteStartPerfMs = nowMs;
        }
        const tIgn = Math.max(0.001, (nowMs - igniteStartPerfMs) / 1000);
        frame.controls.cableIgniteTimer = tIgn;
        const prog = Math.min(1, tIgn / 3.0);
        frame.controls.cableIgnite = prog;

        const nextStage =
          prog < 0.3 ? "power" : prog < 0.6 ? "link" : prog < 0.84 ? "xlr" : "club";
        if (ui.get().ignitionStage !== nextStage) {
          ui.set({ ignitionStage: nextStage });
        }

        // During PRO DJ LINK sync stage (0.34..0.64), cascade all 8 Hot Cue pads A -> H!
        if (prog >= 0.34 && prog <= 0.66) {
          const padIdx = Math.min(7, Math.floor(((prog - 0.34) / 0.32) * 8));
          frame.controls.hotCuePulses[padIdx] = Math.max(frame.controls.hotCuePulses[padIdx]!, 0.85);
        }

        // Hold full club illumination while on Signal Bridge; settle cleanly after leaving
        if (tIgn > 8.5 && activeShot !== "signal") {
          frame.controls.cableIgniteTimer = -1;
          igniteStartPerfMs = -1;
        }
      } else {
        igniteStartPerfMs = -1;
        frame.controls.cableIgnite *= Math.exp(-2.5 * dt);
        if (frame.controls.cableIgnite < 0.02 && ui.get().ignitionStage !== "idle") {
          ui.set({ ignitionStage: "idle" });
        }
      }

      const inSignalBridge = shot.signal > 0.05;
      const powerWake = inSignalBridge ? Math.max(0, Math.min(1, (frame.controls.cableIgnite - 0.16) / 0.16)) : 1;
      const clubEruption = inSignalBridge ? Math.max(0, Math.min(1, (frame.controls.cableIgnite - 0.72) / 0.26)) : 0;

      // Choreographed studio spotlight sweep per chapter
      if (activeShot === "hero") {
        spot.position.set(
          -0.88 + Math.sin(time * 0.48) * 0.34,
          0.46 + Math.cos(time * 0.36) * 0.06,
          0.76,
        );
        spot.target.position.set(-BOOTH.cdjX + 0.01, 0.098, 0.075);
      } else if (activeShot === "cdj-jog") {
        spot.position.set(
          -0.66 + Math.sin(time * 0.85) * 0.44,
          0.38 + Math.cos(time * 0.62) * 0.08,
          0.62,
        );
        spot.target.position.set(-BOOTH.cdjX, 0.102, 0.082);
      } else if (activeShot === "cdj-playcue") {
        spot.position.set(-0.78 + Math.sin(time * 0.7) * 0.22, 0.34, 0.68);
        spot.target.position.set(-BOOTH.cdjX - 0.11, 0.095, 0.17);
      } else if (activeShot === "cdj-front") {
        spot.position.set(-0.2 + Math.sin(time * 0.65) * 0.28, 0.24, 0.86);
        spot.target.position.set(-BOOTH.cdjX, 0.062, 0.21);
      } else if (activeShot === "djm-color") {
        spot.position.set(-0.24 + Math.sin(time * 0.7) * 0.24, 0.42, 0.48);
        spot.target.position.set(-0.035, 0.105, -0.015);
      } else if (activeShot === "djm-fader") {
        spot.position.set(0.28 + Math.sin(time * 0.7) * 0.24, 0.5, 0.56);
        spot.target.position.set(0, 0.095, 0.14);
      } else {
        spot.position.set(-0.92, 0.52, 0.78);
        spot.target.position.set(-BOOTH.cdjX + 0.02, 0.09, 0.06);
      }

      // Dynamic beat-reactive + authentic club lighting (dark empty room -> real club washes!)
      const beatLift = frame.kick * (0.2 * frame.release + 0.32 * clubEruption + (activeShot === "control" ? 0.12 : 0));
      key.intensity = shot.key * 2.4 + clubEruption * 0.35;
      rimBack.intensity = shot.rim * (2.4 + beatLift * 1.4);
      rimLeft.intensity = shot.rim * (1.2 + beatLift);
      rimRight.intensity = shot.rim * (1.1 + beatLift);
      spot.intensity = shot.spot * 6.8;
      ambient.intensity = 0.06 + shot.env * 0.44 + clubEruption * 0.14;
      clubRed.intensity =
        (shot.venue * 2.1 + frame.release * 3.2 + clubEruption * 3.6) * (0.7 + 0.55 * frame.kick);
      clubWarm.intensity =
        (shot.venue * 1.15 + frame.release * 1.6 + clubEruption * 2.4) * (0.78 + 0.35 * frame.kick);

      // Panel power boots cleanly from dark -> lit as IEC Power cables seat in Signal Bridge
      const effectivePower = inSignalBridge ? shot.power + (1 - shot.power) * powerWake : shot.power;
      const effectiveLed = inSignalBridge ? shot.led + (1 - shot.led) * powerWake : shot.led;
      cdjLeft.panel.uPower.value = effectivePower;
      cdjLeft.panel.uLed.value = effectiveLed;
      cdjLeft.screen.power.value = Math.max(0, (effectivePower - 0.06) / 0.94);
      cdjLeft.screen.time.value = time;

      if (frame.controls.screenMode !== null) {
        const desiredScreenMix = frame.controls.screenMode === "browse" ? 1 : 0;
        smoothScreenMix += (desiredScreenMix - smoothScreenMix) * (1 - Math.exp(-16 * dt));
      } else {
        smoothScreenMix = shot.screen;
      }
      cdjLeft.screen.mix.value = smoothScreenMix;

      cdjRight.panel.uPower.value = effectivePower;
      cdjRight.panel.uLed.value = effectiveLed;
      cdjRight.screen.power.value = Math.max(0, (effectivePower - 0.06) / 0.94);
      cdjRight.screen.time.value = time * 1.04;
      cdjRight.screen.mix.value = 0;

      djm.panel.uPower.value = effectivePower;
      djm.panel.uLed.value = effectiveLed;

      // =====================================================================
      // NON-MOTORIZED CDJ-3000X JOG WHEEL:
      //  - Physical platter NEVER spins on its own! Only moves under human touch!
      //  - Virtual On-Jog LCD phase marker rotates electronically while playing!
      //  - Distinct behavior for TOP PLATTER (Vinyl Scratch) vs OUTER RIM (Pitch Bend)!
      // =====================================================================
      const isLeftRunning = (frame.controls.playing || frame.controls.cueHeld) && !frame.controls.jogTouchHeld;
      if (effectivePower > 0.22) {
        // Right CDJ holds the live room track — ONLY its virtual On-Jog LCD phase indicator rotates!
        cdjRight.jogPhaseRing.rotation.y -= dt * 1.85;
      }
      if (isLeftRunning) {
        const bendFactor = 1 + frame.controls.jogPitchBend * 0.25;
        cdjLeft.jogPhaseRing.rotation.y -= dt * 2.15 * bendFactor;
      }

      // Responsive weighted mechanical decay for manual circular jog spin (free-spin inertia on flick!)
      const jogDamping = frame.controls.jogTouchHeld ? 22.0 : 2.85;
      frame.controls.jogVelocity *= Math.exp(-jogDamping * dt);
      frame.controls.jogScratchVel *= Math.exp(-14.0 * dt);
      frame.controls.jogPitchBend *= Math.exp(-6.0 * dt);

      if (!frame.controls.jogTouchHeld && Math.abs(frame.controls.jogVelocity) > 0.002) {
        const deltaAngle = frame.controls.jogVelocity * dt;
        cdjLeft.jogPlatter.rotation.y += deltaAngle;
        cdjLeft.jogPhaseRing.rotation.y += deltaAngle;
      } else if (!frame.controls.jogTouchHeld && Math.abs(frame.controls.jogVelocity) <= 0.002 && frame.controls.jogMode !== "idle") {
        frame.controls.jogMode = "idle";
        if (ui.get().jogMode !== "idle") ui.set({ jogMode: "idle" });
      }

      // Distinct inner jog LED ring color:
      //  - RED when touching TOP capacitive platter (Vinyl Scratch!)
      //  - CYAN-BLUE when gripping OUTER dimpled rim (Pitch Bend Nudge!)
      //  - Warm crimson pulse when club releases
      const mode = frame.controls.jogMode;
      if (mode === "scratch" || frame.controls.jogTouchHeld) {
        tmpJogCol.copy(JOG_COLOR_SCRATCH);
      } else if (mode === "bend") {
        tmpJogCol.copy(JOG_COLOR_BEND);
      } else {
        tmpJogCol.copy(JOG_COLOR_IDLE);
        if (frame.release > 0.05) tmpJogCol.lerp(JOG_COLOR_LIVE, frame.release * 0.85);
      }
      const jogActivity = Math.min(1, Math.abs(frame.controls.jogVelocity) * 0.45 + (frame.controls.jogTouchHeld ? 0.85 : 0));
      cdjLeft.jogRingMat.emissive.copy(tmpJogCol);
      cdjLeft.jogRingMat.emissiveIntensity =
        effectiveLed * Math.max(0.25, effectivePower) * (0.7 + jogActivity * 2.4 + frame.kick * 0.35 * (isLeftRunning ? 1 : 0.2));
      cdjRight.jogRingMat.emissiveIntensity = effectiveLed * Math.max(0.2, effectivePower) * (0.68 + frame.kick * 0.3);

      // Subtle loop & browse LED rings + NFC front glow pulse
      const panelAwake = Math.max(0, Math.min(1, effectivePower * 1.4));
      cdjLeft.loopRingMat.emissiveIntensity = effectiveLed * panelAwake * (1.45 + 0.35 * Math.sin(time * 2.4));
      cdjRight.loopRingMat.emissiveIntensity = effectiveLed * panelAwake * 1.4;
      cdjLeft.browseRingMat.emissiveIntensity = effectiveLed * panelAwake * (activeShot === "cdj-screen" ? 2.2 : 1.15);
      cdjRight.browseRingMat.emissiveIntensity = effectiveLed * panelAwake * 1.1;
      cdjLeft.nfcGlowMat.emissiveIntensity =
        activeShot === "cdj-front" ? 1.4 + 1.4 * (0.5 + 0.5 * Math.sin(time * 3.4)) : effectiveLed * 0.35;

      // =====================================================================
      // 8 INTERACTIVE 3D HOT CUE PADS
      // =====================================================================
      for (let i = 0; i < 8; i++) {
        const padL = cdjLeft.hotCues[i]!;
        const padR = cdjRight.hotCues[i]!;
        const pulse = Math.max(0, frame.controls.hotCuePulses[i]! - dt * 3.5);
        frame.controls.hotCuePulses[i] = pulse;

        smoothHotCuePress[i] = smoothHotCuePress[i]! + (pulse - smoothHotCuePress[i]!) * fastSpring;
        padL.group.position.y = padL.restY - smoothHotCuePress[i]! * 0.0024;

        const waveGate = Math.max(0, Math.min(1, (effectivePower * 1.35 - i * 0.09) * 3.5));
        const idleBreath =
          activeShot === "cdj-screen" || activeShot === "cdj-intro"
            ? 0.25 * Math.sin(time * 2.6 - i * 0.65)
            : 0;
        const beatStep = isLeftRunning && Math.floor(frame.beat * 2) % 8 === i ? 0.85 : 0;

        padL.ledMat.emissiveIntensity = effectiveLed * waveGate * (1.35 + idleBreath + beatStep + pulse * 3.8);
        padR.ledMat.emissiveIntensity = effectiveLed * waveGate * (1.2 + (Math.floor(frame.beat * 2) % 8 === 7 - i ? 0.55 : 0));
      }

      // =====================================================================
      // SPAMMABLE MOMENTARY PLAY & CUE BUTTONS (NEVER LATCHED SWITCHES!)
      // =====================================================================
      const beatBlink = Math.sin(time * Math.PI * 2.06) > -0.15 ? 1 : 0.22;
      frame.controls.playTapImpulse = Math.max(0, frame.controls.playTapImpulse - dt * 9.5);
      frame.controls.cueTapImpulse = Math.max(0, frame.controls.cueTapImpulse - dt * 9.5);

      const playPhysicalDown = frame.controls.playHeld || frame.controls.playTapImpulse > 0.15 ? 1 : 0;
      const cuePhysicalDown = frame.controls.cueHeld || frame.controls.cueTapImpulse > 0.15 ? 1 : 0;

      const playGlow = frame.controls.playing
        ? 2.85 + frame.controls.playTapImpulse * 1.6
        : frame.controls.playTapImpulse > 0.05
          ? 3.9
          : activeShot === "cdj-playcue"
            ? 1.3 + 1.8 * (0.5 + 0.5 * Math.sin(time * 4.1))
            : 0.75 + 1.65 * beatBlink;

      cdjLeft.play.uniforms.uPower.value = 1;
      cdjLeft.play.uniforms.uLed.value = effectiveLed * (frame.controls.playing ? 1.25 : beatBlink);
      cdjLeft.play.ringMat.emissiveIntensity = effectiveLed * playGlow;

      cdjLeft.cue.uniforms.uPower.value = 1;
      cdjLeft.cue.uniforms.uLed.value = effectiveLed * (cuePhysicalDown ? 1.45 : 0.65 + 0.35 * beatBlink);
      cdjLeft.cue.ringMat.emissiveIntensity =
        effectiveLed * (cuePhysicalDown ? 3.8 : frame.controls.playing ? 1.35 : 1.05 + 1.25 * beatBlink);

      cdjRight.play.uniforms.uPower.value = Math.min(1, effectivePower * 1.5);
      cdjRight.play.uniforms.uLed.value = effectiveLed;
      cdjRight.play.ringMat.emissiveIntensity = effectiveLed * Math.min(1, effectivePower * 1.5) * 2.4;
      cdjRight.cue.uniforms.uPower.value = Math.min(1, effectivePower * 1.5);
      cdjRight.cue.uniforms.uLed.value = effectiveLed * 0.85;
      cdjRight.cue.ringMat.emissiveIntensity = effectiveLed * Math.min(1, effectivePower * 1.5) * 1.4;

      // Snappy momentary spring travel (depresses ONLY while finger presses or taps!)
      smoothPlayPress += (playPhysicalDown - smoothPlayPress) * fastSpring;
      smoothCuePress += (cuePhysicalDown - smoothCuePress) * fastSpring;
      cdjLeft.play.group.position.y = cdjLeft.play.restY - smoothPlayPress * 0.0028;
      cdjLeft.cue.group.position.y = cdjLeft.cue.restY - smoothCuePress * 0.0028;

      // =====================================================================
      // DJM-A9 LIVE CONTROLS + REAL CENTER LOCK DEMONSTRATION + BEAT FX OLED
      // =====================================================================
      djm.centerLockSwitch.set(frame.controls.centerLock);

      let desiredFilter = frame.controls.filter;
      if (activeShot === "djm-color" && Math.abs(frame.controls.filter + 0.78) < 0.001) {
        // Automatic demo when user hasn't dragged the manual sweep slider:
        //  - Center Lock ON:  sweeps LOW (-0.9) and HARD-STOPS dead-on at 12:00 (0.0) with zero overshoot!
        //  - Center Lock OFF: sweeps freely right past 12:00 all the way across LOW (-0.9) <-> HI (+0.9)!
        const cycle = (time * 0.68) % 2.4;
        if (frame.controls.centerLock) {
          desiredFilter = cycle < 1.25 ? -Math.sin((cycle / 1.25) * Math.PI) * 0.92 : 0;
        } else {
          desiredFilter = Math.sin(time * 2.15) * 0.92;
        }
      }
      smoothFilter += (desiredFilter - smoothFilter) * k;
      const ch2Knob = djm.colorKnobs[1];
      if (ch2Knob) {
        ch2Knob.rotation.y = -smoothFilter * Math.PI * 0.72;
      }

      let desiredFader = frame.controls.fader;
      let desiredCrossfader = frame.controls.crossfader;
      if (activeShot === "djm-fader") {
        desiredCrossfader = Math.sin(time * 1.45) * 0.88;
        desiredFader = 0.5 + 0.42 * Math.sin(time * 0.92);
      }
      smoothFader += (desiredFader - smoothFader) * k;
      smoothCrossfader += (desiredCrossfader - smoothCrossfader) * k;
      djm.faders[1]?.set(smoothFader);
      djm.crossfader.set(smoothCrossfader);

      const bfxActive = frame.controls.beatFxHold || activeShot === "djm-beatfx";
      const fxName = frame.controls.activeBeatFx;
      let fxFreq = 4.13;
      if (fxName.includes("Triplet")) fxFreq = 6.2;
      else if (fxName === "Trans" || fxName === "Roll") fxFreq = 8.26;
      else if (fxName === "Mobius" || fxName === "Spiral") fxFreq = 2.4;
      djm.beatFxDomeMat.emissiveIntensity =
        effectiveLed * (bfxActive ? 1.8 + 2.4 * Math.abs(Math.sin(time * Math.PI * fxFreq)) : 0.75);

      djm.updateBeatFxScreen({
        fxName,
        division: frame.controls.beatFxDiv,
        xpadPos: frame.controls.xpadPos,
        freqMask: frame.controls.fxFreq,
        active: bfxActive,
        power: effectivePower,
        time,
      });

      // 6 live 15-segment LED meters on the DJM-A9 panel
      const meterLevels = djm.panel.uMeterLevel.value;
      const activeDemo = Math.max(
        shot.demo,
        clubEruption,
        frame.controls.playing || frame.controls.cueHeld || frame.energy > 0.02 ? 1 : 0,
      );
      for (let i = 0; i < 6; i++) {
        meterLevels[i] = Math.min(1, (frame.levels[i] ?? 0) * Math.max(0.28, activeDemo));
      }

      venue.update({
        venue: shot.venue,
        crowd: shot.crowd,
        signal: shot.signal,
        cableIgnite: frame.controls.cableIgnite,
        kick: frame.kick,
        release: frame.release,
        time,
      });
    },
    dispose() {
      cdjLeft.dispose();
      cdjRight.dispose();
      djm.dispose();
      venue.dispose();
      shared.chassis.dispose();
      shared.rubber.dispose();
      shared.knobSide.dispose();
      shared.silver.dispose();
      shared.bezel.dispose();
      shared.maps.dispose();
    },
  };
}
