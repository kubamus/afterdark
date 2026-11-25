/**
 * Campaign copy and verified product facts.
 * Product facts come from the official product pages (checked 2026-11):
 *  - https://alphatheta.com/en/product/player/cdj-3000x/black/
 *  - https://www.pioneerdj.com/en/product/dj-mixers/djm-a9/
 * Nothing here is an endorsement, testimonial, or award.
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
  headline: "Built for the club booth.",
  products: "CDJ-3000X and DJM-A9",
  sub: "Two AlphaTheta CDJ-3000X media players and one Pioneer DJ DJM-A9 4-channel mixer at true physical scale.",
  cta: "Enter the booth",
};

export const INSTRUMENT = {
  lead: "Two CDJ-3000X players and one DJM-A9 mixer span 1,096.6 millimeters across the booth.",
  title: "Built to be played by touch.",
  body: "Every control sits in a consistent physical layout across club booths. You can cue, bend pitch, and cut channels in a dark room without looking down.",
};

export const CDJ_ACT = {
  name: "CDJ-3000X",
  maker: "AlphaTheta",
  title: "Find and cue the next track.",
  intro:
    "The CDJ-3000X loads audio from USB drives, cloud storage, and streaming services while keeping browsing, cueing, and pitch control on dedicated hardware.",
  features: [
    {
      id: "screen",
      shot: "cdj-screen",
      title: "Sixteen tracks on one screen.",
      body: "The 10.1-inch capacitive touchscreen displays up to 16 tracks at once in browse view. You can switch between the track list and the full waveform without leaving the deck.",
      evidence: ["10.1-inch capacitive touchscreen", "16 tracks visible at once", "Dark and light display modes"],
      media: {
        kind: "film",
        src: "/assets/film/screen.mp4",
        poster: "/assets/film/screen.webp",
        alt: "The CDJ-3000X touchscreen displays a track waveform in a dark studio.",
      },
    },
    {
      id: "jog",
      shot: "cdj-jog",
      title: "Dual-zone capacitive jog wheel.",
      body: "Touch the top platter to brake or scratch the track. Spin the dimpled outer rim to nudge the beatgrid. The JOG FEEL dial adjusts mechanical resistance from light to heavy.",
      evidence: ["Capacitive top platter and dimpled outer rim", "Expanded JOG FEEL resistance range, light to heavy"],
      media: {
        kind: "film",
        src: "/assets/film/jog.mp4",
        poster: "/assets/film/jog.webp",
        alt: "Close view of the CDJ-3000X jog wheel edge.",
      },
    },
    {
      id: "playcue",
      shot: "cdj-playcue",
      title: "Rebuilt PLAY and CUE switches.",
      body: "AlphaTheta redesigned the internal PLAY and CUE switches for heavy club use. Each switch is rated for more than 500,000 presses. Hold CUE to play from the cue point, or press PLAY to latch continuous playback.",
      evidence: ["Redesigned PLAY and CUE switch mechanism", "Rated for more than 500,000 presses each"],
      media: {
        kind: "film",
        src: "/assets/film/playcue.mp4",
        poster: "/assets/film/playcue.webp",
        alt: "Illuminated CUE and PLAY buttons on the CDJ-3000X.",
        rate: 0.6,
      },
    },
    {
      id: "library",
      shot: "cdj-library",
      title: "USB, cloud, and streaming libraries.",
      body: "Load tracks from Dropbox or Google Drive over CloudDirectPlay, or stream from Apple Music, Beatport Streaming, and TIDAL. Tagged tracks download in the background before you load them onto the deck.",
      evidence: [
        "CloudDirectPlay for Dropbox and Google Drive",
        "Apple Music, Beatport Streaming, and TIDAL",
        "OneLibrary support",
      ],
      media: {
        kind: "image",
        src: "/assets/img/cdj-qr.webp",
        alt: "The CDJ-3000X screen displays a QR code for cloud login.",
      },
    },
    {
      id: "connect",
      shot: "cdj-front",
      title: "Built-in Wi-Fi, NFC, and USB Type-C.",
      body: "Connect the player to a network over built-in Wi-Fi without an Ethernet cable. Hold a phone running rekordbox for iOS or Android over the front NFC touchpoint to load your library, or connect a drive over USB Type-C.",
      evidence: [
        "Wi-Fi IEEE 802.11a/b/g/n/ac",
        "Front NFC touchpoint and QR login",
        "2 USB Type-C ports, 1 USB Type-A port, PRO DJ LINK",
      ],
      media: {
        kind: "film",
        src: "/assets/film/nfc.mp4",
        poster: "/assets/film/nfc.webp",
        alt: "The front NFC touchpoint on the CDJ-3000X.",
      },
    },
  ] as Feature[],
  sound: {
    title: "ESS 32-bit audio stage.",
    body: "A custom AlphaTheta power supply feeds an ESS Technology 96 kHz, 32-bit digital-to-analog converter. The isolated power path lowers digital noise at the analog outputs.",
    evidence: [
      ["DAC", "96 kHz, 32-bit"],
      ["Frequency response", "4 Hz to 40 kHz"],
      ["Signal-to-noise ratio", "115 dB"],
      ["Total harmonic distortion", "0.0018%"],
    ] as [string, string][],
  },
};

export const DJM_ACT = {
  name: "DJM-A9",
  maker: "Pioneer DJ",
  title: "Four-channel club mixer.",
  signal: "Signal moves from the players to the booth.",
  features: [
    {
      id: "channels",
      shot: "djm-channels",
      title: "Four channels with wider EQ spacing.",
      body: "Extra space around each 3-band EQ and isolator knob leaves room for your fingers during fast cuts. High-brightness LED channel meters stay legible under club lighting.",
      evidence: [
        "4 channels plus microphone section",
        "3-band EQ and isolator per channel",
        "High-brightness LED channel meters",
      ],
      media: {
        kind: "image",
        src: "/assets/img/djm-eq.webp",
        alt: "DJM-A9 channel EQ knobs next to illuminated level meters.",
      },
    },
    {
      id: "ess",
      shot: "djm-ess",
      title: "32-bit ESS conversion on inputs and outputs.",
      body: "Each channel input uses an ESS Technology 32-bit analog-to-digital converter. The master and booth outputs use matching 32-bit digital-to-analog converters, so booth monitors match the main system.",
      evidence: [
        "32-bit ESS analog-to-digital channel inputs",
        "32-bit ESS digital-to-analog master and booth outputs",
        "2-band booth EQ",
      ],
      media: {
        kind: "image",
        src: "/assets/img/djm-ess.webp",
        alt: "ESS Technology converter chips on the DJM-A9 circuit board.",
      },
    },
    {
      id: "color",
      shot: "djm-color",
      title: "Sound Color FX with Center Lock.",
      body: "Switch Center Lock on and each Color knob stops mechanically at center. You can snap a filter back to zero at full speed without crossing into the opposite band.",
      evidence: [
        "6 Sound Color FX: Space, Dub Echo, Crush, Sweep, Noise, Filter",
        "Mechanical Center Lock switch",
      ],
      media: {
        kind: "image",
        src: "/assets/img/djm-color.webp",
        alt: "DJM-A9 Color knobs with lock markings above amber CUE buttons.",
      },
    },
    {
      id: "beatfx",
      shot: "djm-beatfx",
      title: "Fourteen tempo-synced Beat FX.",
      body: "A color display and a horizontal X-PAD control 14 beat-synced effects with one finger. The DJM-A9 adds three effects: Mobius, Triplet Filter, and Triplet Roll.",
      evidence: ["14 Beat FX", "Color display and horizontal X-PAD", "Dedicated channel select buttons"],
      media: {
        kind: "image",
        src: "/assets/img/djm-xpad.webp",
        alt: "A finger slides along the DJM-A9 X-PAD below the Beat FX display.",
      },
    },
    {
      id: "magvel",
      shot: "djm-fader",
      title: "Third-generation MAGVEL FADER.",
      body: "The third-generation MAGVEL FADER crossfader and updated channel faders reduce mechanical resistance. They hold steady for long blends and open cleanly for fast cuts.",
      evidence: ["Third-generation MAGVEL FADER crossfader", "Updated channel faders"],
      media: {
        kind: "image",
        src: "/assets/img/djm-magvel.webp",
        alt: "The MAGVEL FADER crossfader between A and B markings.",
      },
    },
    {
      id: "b2b",
      shot: "djm-phones",
      title: "Two independent headphone outputs.",
      body: "Headphones A and B each have separate cue buttons, volume knobs, and cue-to-master mix controls. Two DJs can cue different channels at the same time during a changeover.",
      evidence: [
        "Headphones A and B with separate CUE, MIX, and LEVEL controls",
        "Dual USB Type-B and USB Type-C ports for two computers",
      ],
      media: {
        kind: "image",
        src: "/assets/img/djm-phones.webp",
        alt: "Headphones A and Headphones B sections on either side of the DJM-A9 channel faders.",
      },
    },
  ] as Feature[],
  beatFx: [
    "Delay",
    "Echo",
    "Ping Pong",
    "Spiral",
    "Helix",
    "Reverb",
    "Flanger",
    "Phaser",
    "Filter",
    "Triplet Filter",
    "Trans",
    "Roll",
    "Triplet Roll",
    "Mobius",
  ],
  beatFxNew: ["Mobius", "Triplet Filter", "Triplet Roll"],
};

export const MOMENT = {
  line: "Built for a packed room at full volume.",
  still: "05:12",
};

export const FINAL = {
  title: "Explore the full booth.",
  body: "The AlphaTheta CDJ-3000X and the Pioneer DJ DJM-A9 share PRO DJ LINK timing, 32-bit ESS conversion, and standard club dimensions.",
};

export const SPECS = {
  cdj: [
    ["Display", "10.1-inch capacitive full-color touchscreen"],
    ["Playable media", "USB flash drive, USB SSD or HDD, PC or Mac over USB or LAN, iOS and Android devices"],
    [
      "Connectivity",
      "1 USB Type-A storage port, 2 USB Type-C ports, 1 PRO DJ LINK LAN port, Wi-Fi IEEE 802.11a/b/g/n/ac, NFC login",
    ],
    ["Cloud", "rekordbox CloudDirectPlay for Dropbox and Google Drive"],
    ["Streaming", "Apple Music, Beatport Streaming, TIDAL"],
    ["Audio formats", "MP3, AAC, WAV, AIFF, FLAC, ALAC"],
    ["Outputs", "1 analog RCA output, 1 digital coaxial output"],
    ["Audio", "4 Hz to 40 kHz frequency response, 115 dB signal-to-noise ratio, 0.0018% total harmonic distortion"],
    ["Dimensions", "344.6 by 490.4 by 130.1 mm width, depth, height"],
    ["Weight", "6.0 kg"],
  ] as [string, string][],
  djm: [
    ["Channels", "4 channels plus microphone section"],
    [
      "Converters",
      "ESS Technology 32-bit analog-to-digital channel inputs, 32-bit digital-to-analog master and booth outputs",
    ],
    ["Sound Color FX", "Space, Dub Echo, Crush, Sweep, Noise, and Filter with Center Lock"],
    ["Beat FX", "14 effects, color display, horizontal X-PAD"],
    ["Crossfader", "Third-generation MAGVEL FADER"],
    ["Headphones", "Two independent outputs, A and B"],
    ["USB", "1 USB Type-A port, 2 USB Type-B ports, 2 USB Type-C ports"],
    ["Other", "Bluetooth input, condenser mic phantom power, 2-band booth EQ, Stagehand support"],
    ["Software", "rekordbox, Serato DJ Pro, djay Pro"],
    ["Dimensions", "407.4 by 458.3 by 107.9 mm width, depth, height"],
    ["Weight", "10.2 kg"],
  ] as [string, string][],
};

/** Scroll progress reference bounds kept for unit test compatibility. */
export const NIGHT = { start: 23 * 60 + 52, end: 29 * 60 + 47 };
