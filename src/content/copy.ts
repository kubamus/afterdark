/**
 * Campaign copy and verified product facts.
 * Product facts are sourced from the official product pages (checked 2026-11):
 *  - https://alphatheta.com/en/product/player/cdj-3000x/black/
 *  - https://www.pioneerdj.com/en/product/dj-mixers/djm-a9/
 * Nothing here is an endorsement, testimonial or award.
 */

export const LINKS = {
  cdj: "https://alphatheta.com/en/product/player/cdj-3000x/black/",
  djm: "https://www.pioneerdj.com/en/product/dj-mixers/djm-a9/",
  dealer: "https://alphatheta.com/en/store-locator/",
} as const;

export interface Feature {
  id: string;
  shot: string;
  title: string;
  body: string;
  evidence: string[];
  media?: { kind: "film" | "image"; src: string; poster?: string; alt: string; rate?: number };
}

export const HERO = {
  headline: "The night is yours.",
  products: "CDJ-3000X / DJM-A9",
  sub: "Professional instruments for the moments that matter.",
  cta: "Enter the booth",
};

export const INSTRUMENT = {
  lead: "Two players. One mixer. Just over a metre of hardware, and a whole night decided on it.",
  title: "This is an instrument.",
  body: "You practise it for years. You learn its weight, its travel, its resistance. Then one night it disappears, and there is only the music.",
};

export const CDJ_ACT = {
  name: "CDJ-3000X",
  maker: "AlphaTheta",
  title: "Find your next move.",
  intro: "The player is where every decision starts: what comes next, when it lands, how long you let it ride.",
  features: [
    {
      id: "screen",
      shot: "cdj-screen",
      title: "Your next track. Your next decision.",
      body: "The room tells you what it needs. The 10.1-inch touchscreen puts up to 16 tracks in view at once, so the answer is already in front of you.",
      evidence: ["10.1-inch capacitive touchscreen", "Up to 16 tracks in view", "Dark and Light display modes"],
      media: { kind: "film", src: "/assets/film/screen.mp4", poster: "/assets/film/screen.webp", alt: "The CDJ-3000X touchscreen showing a track waveform in a dark studio." },
    },
    {
      id: "jog",
      shot: "cdj-jog",
      title: "Every movement has meaning.",
      body: "Nudge a beat back into line. Hold a phrase. Pull a track out of the mix. The redesigned jog wheel keeps the familiar feel and widens its range: lighter for flow, heavier for precision.",
      evidence: ["Redesigned jog wheel", "Expanded JOG FEEL adjustment, light to heavy"],
      media: { kind: "film", src: "/assets/film/jog.mp4", poster: "/assets/film/jog.webp", alt: "Macro view of the CDJ-3000X jog wheel edge." },
    },
    {
      id: "playcue",
      shot: "cdj-playcue",
      title: "Press it like you mean it.",
      body: "PLAY and CUE were rebuilt from the inside out, so every press answers with the same certainty at the end of the night as at the start.",
      evidence: ["Redesigned PLAY/CUE buttons", "Rated for more than 500,000 presses each"],
      media: { kind: "film", src: "/assets/film/playcue.mp4", poster: "/assets/film/playcue.webp", alt: "The illuminated CUE and PLAY buttons of the CDJ-3000X.", rate: 0.6 },
    },
    {
      id: "library",
      shot: "cdj-library",
      title: "Your music, wherever it lives.",
      body: "Pull tracks straight from the cloud with CloudDirectPlay, or stream from Apple Music, Beatport and TIDAL. Tag a track and it pre-downloads, ready before you reach for it.",
      evidence: ["CloudDirectPlay: Dropbox, Google Drive", "Streaming: Apple Music, Beatport Streaming, TIDAL", "OneLibrary support"],
      media: { kind: "image", src: "/assets/img/cdj-qr.webp", alt: "The CDJ-3000X screen showing a QR code for cloud login." },
    },
    {
      id: "connect",
      shot: "cdj-front",
      title: "Walk in. Hover. Play.",
      body: "Built-in Wi-Fi means no cable to hunt for. Hover your phone, running rekordbox for iOS or Android, over the front NFC touchpoint and your library is there. Or plug in over USB Type-C.",
      evidence: ["Wi-Fi IEEE 802.11a/b/g/n/ac", "NFC and QR code login", "USB Type-C ×2 · USB Type-A ×1 · PRO DJ LINK"],
      media: { kind: "film", src: "/assets/film/nfc.mp4", poster: "/assets/film/nfc.webp", alt: "The NFC touchpoint on the front panel of the CDJ-3000X." },
    },
  ] as Feature[],
  sound: {
    title: "Tuned by ear.",
    body: "More than a year of listening went into how it sounds: a custom AlphaTheta power supply feeding an ESS Technology DAC, for detail that holds when the system is pushed.",
    evidence: [
      ["DAC", "96 kHz / 32-bit"],
      ["Frequency response", "4 Hz – 40 kHz"],
      ["S/N ratio", "115 dB"],
      ["THD", "0.0018 %"],
    ] as [string, string][],
  },
};

export const DJM_ACT = {
  name: "DJM-A9",
  maker: "Pioneer DJ",
  title: "Make it yours.",
  signal: "Out of the player. Into your hands.",
  features: [
    {
      id: "channels",
      shot: "djm-channels",
      title: "Four channels. Endless decisions.",
      body: "What to bring in, what to take away, when to let it breathe. More space around the EQs leaves room for your fingers; brighter channel meters show exactly where you are.",
      evidence: ["4 channels plus mic section", "3-band EQ/Isolator per channel", "Bright LED channel level indicators"],
      media: { kind: "image", src: "/assets/img/djm-eq.webp", alt: "DJM-A9 channel EQ knobs beside illuminated level meters." },
    },
    {
      id: "ess",
      shot: "djm-ess",
      title: "The booth hears what the floor hears.",
      body: "ESS Technology 32-bit A/D conversion on the channel inputs, 32-bit D/A on master and booth outputs. What reaches your monitors is what reaches the crowd.",
      evidence: ["32-bit ESS A/D converters (channel inputs)", "32-bit ESS D/A converters (master, booth)", "2-band booth EQ"],
      media: { kind: "image", src: "/assets/img/djm-ess.webp", alt: "ESS Technology converter chips on the DJM-A9 circuit board." },
    },
    {
      id: "color",
      shot: "djm-color",
      title: "Shape the sound. Change the room.",
      body: "Throw a filter as hard as you like. With Center Lock on, each Sound Color FX knob stops at the centre, so a fast twist never spills into the opposite effect.",
      evidence: ["Sound Color FX: Space, Dub Echo, Crush, Sweep, Noise, Filter", "CENTER LOCK on/off switch"],
      media: { kind: "image", src: "/assets/img/djm-color.webp", alt: "DJM-A9 COLOR knobs with LOCK markings above orange CUE buttons." },
    },
    {
      id: "beatfx",
      shot: "djm-beatfx",
      title: "Fourteen ways to bend time.",
      body: "A colour display and a horizontal X-PAD put tempo-synced effects under one finger. New on the DJM-A9: Mobius, Triplet Filter and Triplet Roll.",
      evidence: ["14 Beat FX", "Colour display and X-PAD", "Dedicated CH SELECT buttons"],
      media: { kind: "image", src: "/assets/img/djm-xpad.webp", alt: "A finger sliding along the DJM-A9 X-PAD below the Beat FX display." },
    },
    {
      id: "magvel",
      shot: "djm-fader",
      title: "Silk, then speed.",
      body: "The third-generation MAGVEL FADER crossfader, with slicker channel faders beside it: smooth enough for a ten-minute blend, steady enough for the fastest cut.",
      evidence: ["3rd-generation MAGVEL FADER crossfader", "Upgraded channel faders"],
      media: { kind: "image", src: "/assets/img/djm-magvel.webp", alt: "The MAGVEL FADER crossfader between A and B markings." },
    },
    {
      id: "b2b",
      shot: "djm-phones",
      title: "Two DJs. One booth. Nobody waits.",
      body: "Two independent headphone outputs, each with its own cue buttons, level and mix balance. The changeover becomes part of the set.",
      evidence: ["Headphones A and B with independent CUE, MIX and LEVEL", "Dual USB Type-B and Type-C for two computers"],
      media: { kind: "image", src: "/assets/img/djm-phones.webp", alt: "Headphones A and Headphones B sections either side of the DJM-A9 channel faders." },
    },
  ] as Feature[],
  beatFx: ["Delay", "Echo", "Ping Pong", "Spiral", "Helix", "Reverb", "Flanger", "Phaser", "Filter", "Triplet Filter", "Trans", "Roll", "Triplet Roll", "Mobius"],
  beatFxNew: ["Mobius", "Triplet Filter", "Triplet Roll"],
};

export const CONTROL = {
  title: "Take control.",
  body: "One track is holding the room. Yours is waiting on the left deck. Cue it, start it on the beat, open the filter, bring up the fader, and let it go.",
  disclaimer:
    "A creative browser demonstration built with the Web Audio API and original synthesised music at 124 BPM. It does not reproduce the sound, DSP or behaviour of the CDJ-3000X or DJM-A9.",
};

export const MOMENT = {
  line: "For the moment the whole room moves together.",
  still: "05:12",
};

export const FINAL = {
  title: "The next night is yours.",
  body: "CDJ-3000X by AlphaTheta. DJM-A9 by Pioneer DJ. Built for the booth, and for everyone in front of it.",
};

export const SPECS = {
  cdj: [
    ["Display", "10.1-inch capacitive full-colour touchscreen"],
    ["Playable media", "USB flash drive, USB SSD/HDD, PC/Mac (USB/LAN), mobile devices (iOS/Android)"],
    ["Connectivity", "USB Type-A ×1 (storage), USB Type-C ×2 (storage/PC), LAN ×1 (PRO DJ LINK), Wi-Fi IEEE 802.11a/b/g/n/ac, NFC login"],
    ["Cloud", "rekordbox CloudDirectPlay: Dropbox, Google Drive"],
    ["Streaming", "Apple Music, Beatport Streaming, TIDAL"],
    ["Audio formats", "MP3, AAC, WAV, AIFF, FLAC, ALAC"],
    ["Outputs", "Analog (RCA) ×1, Digital (Coaxial) ×1"],
    ["Audio", "4 Hz – 40 kHz · S/N 115 dB · THD 0.0018 %"],
    ["Dimensions", "344.6 × 490.4 × 130.1 mm (W × D × H)"],
    ["Weight", "6.0 kg"],
  ] as [string, string][],
  djm: [
    ["Channels", "4 channels plus microphone section"],
    ["Converters", "ESS Technology 32-bit A/D (channel inputs), 32-bit D/A (master and booth)"],
    ["Sound Color FX", "Space, Dub Echo, Crush, Sweep, Noise, Filter, with Center Lock"],
    ["Beat FX", "14 effects, colour display, X-PAD"],
    ["Crossfader", "MAGVEL FADER, 3rd generation"],
    ["Headphones", "Two independent outputs (A and B)"],
    ["USB", "USB Type-A ×1, USB Type-B ×2, USB Type-C ×2"],
    ["Other", "Bluetooth input, condenser mic phantom power, 2-band booth EQ, Stagehand support"],
    ["Software", "rekordbox, Serato DJ Pro, djay Pro"],
    ["Dimensions", "407.4 × 458.3 × 107.9 mm (W × D × H)"],
    ["Weight", "10.2 kg"],
  ] as [string, string][],
};

/** The night clock: scroll position mapped to a time of night. */
export const NIGHT = { start: 23 * 60 + 52, end: 29 * 60 + 47 };
