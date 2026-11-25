import * as THREE from "three";
import { buildCdj, sharedHardwareMaterials, type CdjRig, type CdjTextures } from "./hardware/cdj";
import { buildDjm, type DjmRig, type DjmTextures } from "./hardware/djm";
import { BOOTH } from "./hardware/layout";
import { buildVenue, type VenueRig } from "./venue";
import type { Shot } from "./shots";
import type { Frame } from "@/lib/store";

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
const JOG_COLOR_TOUCH = new THREE.Color(0xf4f7ff);
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

  const venue = buildVenue(textures.crowd);
  group.add(venue.group);

  // Architectural studio & club lighting rig
  const ambient = new THREE.HemisphereLight(0xdbe2ef, 0x0a0a0d, 0.18);
  group.add(ambient);

  // Sculptural studio key light (tighter high-res 2048px soft shadows across every 3D button, knob & fader!)
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

  // Crisp rim lights carving out anodized chamfers, concave jog dimples, and chrome collars
  const rimBack = new THREE.DirectionalLight(0xdbe5f5, 2.1);
  rimBack.position.set(0.0, 1.15, -1.9);
  group.add(rimBack);

  const rimLeft = new THREE.DirectionalLight(0xffe6d0, 1.05);
  rimLeft.position.set(-2.1, 0.72, 0.55);
  group.add(rimLeft);

  const rimRight = new THREE.DirectionalLight(0xc9d7ee, 1.05);
  rimRight.position.set(2.1, 0.72, 0.55);
  group.add(rimRight);

  // Dynamic raking spotlight (sculpts hero chiaroscuro + gleams across concave jog dimples & faders)
  const spot = new THREE.SpotLight(0xfff5e8, 5.8, 4.8, Math.PI * 0.22, 0.68, 1.35);
  spot.position.set(-0.92, 0.52, 0.78);
  spot.target.position.set(-BOOTH.cdjX + 0.02, 0.09, 0.06);
  group.add(spot, spot.target);

  // Reactive crimson club bounce light awakened during Take Control release & Act VI
  const clubRed = new THREE.PointLight(0xe52d38, 0, 4.8, 1.5);
  clubRed.position.set(0, 1.15, -1.35);
  group.add(clubRed);

  let smoothFilter = -0.78;
  let smoothFader = 0;
  let smoothCrossfader = 0;
  let smoothPlayPress = 0;
  let smoothCuePress = 0;
  let smoothScreenMix = 0;
  let smoothJogFeel = 0.45;
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
      const k = 1 - Math.exp(-14 * dt);
      const activeShot = frame.activeShot;

      // Choreographed studio spotlight sweep per chapter so brushed metal & sculpted bevels glint organically
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
        spot.position.set(0.32 + Math.sin(time * 0.7) * 0.28, 0.36, 0.68);
        spot.target.position.set(0, 0.095, 0.16);
      } else {
        spot.position.set(-0.92, 0.52, 0.78);
        spot.target.position.set(-BOOTH.cdjX + 0.02, 0.09, 0.06);
      }

      // Lights (subtle beat-reactive rim pulse when club energy builds)
      const beatLift = frame.kick * (0.22 * frame.release + (activeShot === "control" ? 0.12 : 0));
      key.intensity = shot.key * 2.55;
      rimBack.intensity = shot.rim * (2.5 + beatLift * 1.5);
      rimLeft.intensity = shot.rim * (1.25 + beatLift);
      rimRight.intensity = shot.rim * (1.15 + beatLift);
      spot.intensity = shot.spot * 6.8;
      ambient.intensity = 0.07 + shot.env * 0.46;
      clubRed.intensity = (shot.venue * 1.7 + frame.release * 3.6) * (0.62 + 0.85 * frame.kick);

      // Panel power wake sweep & LED intensity
      cdjLeft.panel.uPower.value = shot.power;
      cdjLeft.panel.uLed.value = shot.led;
      cdjLeft.screen.power.value = Math.max(0, (shot.power - 0.06) / 0.94);
      cdjLeft.screen.time.value = time;

      // Screen crossfade: interactive override in Act III OR direct scroll-damped shot.screen (no double-damping!)
      if (frame.controls.screenMode !== null) {
        const desiredScreenMix = frame.controls.screenMode === "browse" ? 1 : 0;
        smoothScreenMix += (desiredScreenMix - smoothScreenMix) * (1 - Math.exp(-16 * dt));
      } else {
        smoothScreenMix = shot.screen;
      }
      cdjLeft.screen.mix.value = smoothScreenMix;

      cdjRight.panel.uPower.value = shot.power;
      cdjRight.panel.uLed.value = shot.led;
      cdjRight.screen.power.value = Math.max(0, (shot.power - 0.06) / 0.94);
      cdjRight.screen.time.value = time * 1.04;
      cdjRight.screen.mix.value = 0;

      djm.panel.uPower.value = shot.power;
      djm.panel.uLed.value = shot.led;

      // =====================================================================
      // LIVING 3D JOG WHEEL ROTATION + JOG FEEL KNOB + JOG LED LIGHT RING
      // =====================================================================
      if (shot.power > 0.22) {
        cdjRight.jogPlatter.rotation.y -= dt * 1.85;
      }
      const jogDamping = 2.0 + frame.controls.jogFeel * 7.5;
      frame.controls.jogVelocity *= Math.exp(-jogDamping * dt);

      const isLeftRunning = frame.controls.playing || frame.controls.cueHeld;
      if (isLeftRunning) {
        cdjLeft.jogPlatter.rotation.y -= dt * 2.15;
      } else if (activeShot === "cdj-jog" || activeShot === "hero") {
        // Subtle tactile DJ beat-nudge motion when inspecting the Jog Wheel / Hero
        const nudgeSpeed = activeShot === "cdj-jog" ? 0.55 + Math.sin(time * 1.65) * 0.48 : 0.14;
        cdjLeft.jogPlatter.rotation.y -= dt * nudgeSpeed;
      }
      if (Math.abs(frame.controls.jogVelocity) > 0.001) {
        cdjLeft.jogPlatter.rotation.y += frame.controls.jogVelocity * dt;
      }

      // Rotate physical 3D JOG FEEL potentiometer knob smoothly with tension slider!
      smoothJogFeel += (frame.controls.jogFeel - smoothJogFeel) * k;
      cdjLeft.jogFeelKnob.rotation.y = -(smoothJogFeel - 0.5) * Math.PI * 1.45;

      // Dynamic inner jog ring light color & glow (reacts to spin velocity, playback, and club release!)
      const jogActivity = Math.min(1, Math.abs(frame.controls.jogVelocity) * 0.22);
      tmpJogCol.copy(JOG_COLOR_IDLE);
      if (jogActivity > 0.05) {
        tmpJogCol.lerp(JOG_COLOR_TOUCH, jogActivity);
      }
      if (frame.release > 0.05) {
        tmpJogCol.lerp(JOG_COLOR_LIVE, frame.release * 0.85);
      }
      cdjLeft.jogRingMat.emissive.copy(tmpJogCol);
      cdjLeft.jogRingMat.emissiveIntensity =
        shot.led * Math.max(0.25, shot.power) * (0.75 + jogActivity * 1.8 + frame.kick * 0.45 * (isLeftRunning ? 1 : 0.3));
      cdjRight.jogRingMat.emissiveIntensity = shot.led * Math.max(0.2, shot.power) * (0.68 + frame.kick * 0.32);

      // Subtle loop & browse LED rings + NFC front glow pulse
      const panelAwake = Math.max(0, Math.min(1, shot.power * 1.4));
      cdjLeft.loopRingMat.emissiveIntensity = shot.led * panelAwake * (1.45 + 0.35 * Math.sin(time * 2.4));
      cdjRight.loopRingMat.emissiveIntensity = shot.led * panelAwake * 1.4;
      cdjLeft.browseRingMat.emissiveIntensity = shot.led * panelAwake * (activeShot === "cdj-screen" ? 2.2 : 1.15);
      cdjRight.browseRingMat.emissiveIntensity = shot.led * panelAwake * 1.1;
      cdjLeft.nfcGlowMat.emissiveIntensity =
        activeShot === "cdj-front" ? 1.4 + 1.4 * (0.5 + 0.5 * Math.sin(time * 3.4)) : shot.led * 0.35;

      // =====================================================================
      // 8 INTERACTIVE 3D HOT CUE PADS (staggered power-up wave + live taps!)
      // =====================================================================
      for (let i = 0; i < 8; i++) {
        const padL = cdjLeft.hotCues[i]!;
        const padR = cdjRight.hotCues[i]!;
        const pulse = Math.max(0, frame.controls.hotCuePulses[i]! - dt * 3.2);
        frame.controls.hotCuePulses[i] = pulse;

        smoothHotCuePress[i] = smoothHotCuePress[i]! + (pulse - smoothHotCuePress[i]!) * k;
        padL.group.position.y = padL.restY - smoothHotCuePress[i]! * 0.0022;

        // Staggered boot-up wave across A..H during rise + subtle rhythmic shimmer during performance
        const waveGate = Math.max(0, Math.min(1, (shot.power * 1.35 - i * 0.09) * 3.5));
        const idleBreath = activeShot === "cdj-screen" || activeShot === "cdj-intro"
          ? 0.25 * Math.sin(time * 2.6 - i * 0.65)
          : 0;
        const beatStep = isLeftRunning && Math.floor(frame.beat * 2) % 8 === i ? 0.85 : 0;

        padL.ledMat.emissiveIntensity = shot.led * waveGate * (1.35 + idleBreath + beatStep + pulse * 3.8);
        padR.ledMat.emissiveIntensity = shot.led * waveGate * (1.2 + (Math.floor(frame.beat * 2) % 8 === (7 - i) ? 0.55 : 0));
      }

      // =====================================================================
      // SCULPTED 3D PLAY & CUE BUTTON HALOS + PHYSICAL DEPRESSION
      // =====================================================================
      const beatBlink = Math.sin(time * Math.PI * 2.06) > -0.15 ? 1 : 0.22;
      frame.controls.demoPlayPulse = Math.max(0, frame.controls.demoPlayPulse - dt * 3.8);
      const playGlow = isLeftRunning
        ? 2.85
        : frame.controls.demoPlayPulse > 0.05
          ? 3.8
          : activeShot === "cdj-playcue"
            ? 1.3 + 1.8 * (0.5 + 0.5 * Math.sin(time * 4.1))
            : 0.75 + 1.65 * beatBlink;

      cdjLeft.play.uniforms.uPower.value = 1;
      cdjLeft.play.uniforms.uLed.value = shot.led * (isLeftRunning ? 1.25 : beatBlink);
      cdjLeft.play.ringMat.emissiveIntensity = shot.led * playGlow;

      cdjLeft.cue.uniforms.uPower.value = 1;
      cdjLeft.cue.uniforms.uLed.value = shot.led * (frame.controls.cueHeld ? 1.35 : 0.65 + 0.35 * beatBlink);
      cdjLeft.cue.ringMat.emissiveIntensity =
        shot.led * (frame.controls.cueHeld ? 3.4 : frame.controls.playing ? 1.35 : 1.05 + 1.25 * beatBlink);

      cdjRight.play.uniforms.uPower.value = Math.min(1, shot.power * 1.5);
      cdjRight.play.uniforms.uLed.value = shot.led;
      cdjRight.play.ringMat.emissiveIntensity = shot.led * Math.min(1, shot.power * 1.5) * 2.4;
      cdjRight.cue.uniforms.uPower.value = Math.min(1, shot.power * 1.5);
      cdjRight.cue.uniforms.uLed.value = shot.led * 0.85;
      cdjRight.cue.ringMat.emissiveIntensity = shot.led * Math.min(1, shot.power * 1.5) * 1.4;

      // Physical button travel
      const playPressed = frame.controls.playing || frame.controls.demoPlayPulse > 0.15 ? 1 : 0;
      smoothPlayPress += (playPressed - smoothPlayPress) * k;
      smoothCuePress += ((frame.controls.cueHeld ? 1 : 0) - smoothCuePress) * k;
      cdjLeft.play.group.position.y = cdjLeft.play.restY - smoothPlayPress * 0.0025;
      cdjLeft.cue.group.position.y = cdjLeft.cue.restY - smoothCuePress * 0.0027;

      // =====================================================================
      // DJM-A9 LIVE CONTROLS (Color FX knob, Ch 2 fader, MAGVEL, Beat FX dome)
      // =====================================================================
      let desiredFilter = frame.controls.filter;
      if (activeShot === "djm-color") {
        const cycle = (time * 0.55) % 2;
        if (cycle < 1.1) {
          desiredFilter = Math.sin((cycle / 1.1) * Math.PI) * (frame.controls.centerLock ? -0.82 : 0.85);
        } else {
          desiredFilter = 0; // Crisp dwell at Center Lock!
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

      // Beat FX glowing blue ON/OFF dome reacts to selected Beat FX rhythmic signature!
      const bfxActive = frame.controls.beatFxHold || activeShot === "djm-beatfx";
      const fxName = frame.controls.activeBeatFx;
      let fxFreq = 4.13;
      if (fxName.includes("Triplet")) fxFreq = 6.2;
      else if (fxName === "Trans" || fxName === "Roll") fxFreq = 8.26;
      else if (fxName === "Mobius" || fxName === "Spiral") fxFreq = 2.4;
      djm.beatFxDomeMat.emissiveIntensity =
        shot.led * (bfxActive ? 1.8 + 2.4 * Math.abs(Math.sin(time * Math.PI * fxFreq)) : 0.75);

      // 6 live 15-segment LED meters on the DJM-A9 panel
      const meterLevels = djm.panel.uMeterLevel.value;
      const activeDemo = Math.max(
        shot.demo,
        frame.controls.playing || frame.controls.cueHeld || frame.energy > 0.02 ? 1 : 0,
      );
      for (let i = 0; i < 6; i++) {
        meterLevels[i] = Math.min(1, (frame.levels[i] ?? 0) * Math.max(0.28, activeDemo));
      }

      // Venue beams, signal cable pulse & crowd plate
      venue.update({
        venue: shot.venue,
        crowd: shot.crowd,
        signal: shot.signal,
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
