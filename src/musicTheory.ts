export type MoodKey = 'blue' | 'green' | 'purple' | 'red' | 'amber' | 'teal' | 'rose';

export type RgbTuple = [number, number, number];

export interface MoodDefinition {
  key: MoodKey;
  label: string;
  origin: string;
  scaleName: string;
  tuningSystem: string;
  description: string;
  /** Scale degrees in exact cents (100 cents = 1 equal-tempered semitone). */
  intervalsCents: readonly number[];
  modulationSemitones: number;
  modulationLabel: string;
  rune: string;
  colorHex: string;
  auraPrimary: RgbTuple;
  auraSecondary: RgbTuple;
}

export interface ZitherStringTuning {
  index: number;
  midi: number;
  freq: number;
  glyph: string;
  isLowRed: boolean;
}

export interface ScalePitchInfo {
  notes: number[];
  exactPos: number;
  snappedIndex: number;
  snappedMidi: number;
  snappedFreq: number;
}

export interface BoundedBendInfo {
  targetIndex: number;
  clampedSteps: number;
  snappedToNeighbor: boolean;
  midi: number;
  freq: number;
}

export interface MorphHarmonics {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  formantFreq: number;
  formantQ: number;
  vibratoDepthCents: number;
  vibratoRateHz: number;
}

export interface AuraColors {
  primary: RgbTuple;
  secondary: RgbTuple;
}

/**
 * Ancient Greek Alypian-inspired pitch glyphs (BMP Unicode) replacing
 * modern Western letter names (C, C#, D, etc.).
 */
export const PITCH_GLYPHS = ['Γ', 'Γ̇', 'Δ', 'Δ̇', 'Ζ', 'Θ', 'Θ̇', 'Λ', 'Ξ', 'Π', 'Φ', 'Ψ'] as const;

/**
 * Seven mystical non-major/non-minor scales tuned in their authentic
 * cultural intonation systems (cents), paired with ancient Greek emotion words.
 */
export const MOODS: Record<MoodKey, MoodDefinition> = {
  blue: {
    key: 'blue',
    label: 'Ataraxia',
    origin: 'stillness',
    scaleName: 'Scriabin Prometheus',
    tuningSystem: 'Harmonic Overtone',
    description:
      'Hexatonic scale from Scriabin’s Mystic Chord tuned to natural overtone ratios (1:1, 9/8, 5/4, 11/8, 5/3, 7/4). Modulates up a fourth (+P4).',
    intervalsCents: [0, 203.9, 386.3, 551.3, 884.4, 968.8],
    modulationSemitones: 5,
    modulationLabel: '+P4',
    rune: '☽',
    colorHex: '#2caeff',
    auraPrimary: [0.1, 0.56, 0.96],
    auraSecondary: [0.34, 0.92, 1.0],
  },
  green: {
    key: 'green',
    label: 'Zelos',
    origin: 'lively ardor',
    scaleName: 'Satie Gnossienne (Dorian ♯4)',
    tuningSystem: '12-EDO',
    description:
      'Used in Erik Satie’s Gnossiennes; a raised fourth creates an augmented second with a buoyant, ancient lilt. Modulates up a fifth (+P5).',
    intervalsCents: [0, 200, 300, 600, 700, 900, 1000],
    modulationSemitones: 7,
    modulationLabel: '+P5',
    rune: '✦',
    colorHex: '#ff3b4e',
    auraPrimary: [0.95, 0.18, 0.28],
    auraSecondary: [1.0, 0.56, 0.22],
  },
  purple: {
    key: 'purple',
    label: 'Penthos',
    origin: 'sacred sorrow',
    scaleName: 'Raga Todi',
    tuningSystem: '22-Shruti Just Intonation',
    description:
      'Hindustani morning raga in 22-shruti tuning with extra-low komal Re (90¢), komal Ga (294¢), bright tivra Ma (612¢), and pure Pa (702¢). Modulates down a major third (−M3).',
    intervalsCents: [0, 90.2, 294.1, 611.7, 702.0, 792.2, 1109.8],
    modulationSemitones: -4,
    modulationLabel: '−M3',
    rune: '◈',
    colorHex: '#a552ff',
    auraPrimary: [0.54, 0.22, 0.95],
    auraSecondary: [0.9, 0.42, 1.0],
  },
  red: {
    key: 'red',
    label: 'Agonia',
    origin: 'taut struggle',
    scaleName: 'Raga Marwa',
    tuningSystem: '22-Shruti Just Intonation',
    description:
      'Hindustani dusk raga in 22-shruti tuning that omits the fifth, suspending melodies between luminous komal Re (112¢) and pure Dha (884¢). Modulates by a tritone (+TT).',
    intervalsCents: [0, 111.7, 386.3, 590.2, 884.4, 1088.3],
    modulationSemitones: 6,
    modulationLabel: '+TT',
    rune: '❖',
    colorHex: '#28dc8c',
    auraPrimary: [0.08, 0.8, 0.52],
    auraSecondary: [0.56, 1.0, 0.44],
  },
  amber: {
    key: 'amber',
    label: 'Thauma',
    origin: 'wonder',
    scaleName: 'Maqam Hijaz Kar',
    tuningSystem: 'Arabic / Byzantine Maqam',
    description:
      'Classical Middle Eastern and Byzantine mode with raised Hijaz seconds (128¢, 830¢) and pure fifth (702¢) for singing augmented seconds. Modulates up a major third (+M3).',
    intervalsCents: [0, 128, 386.3, 498.0, 702.0, 830, 1088.3],
    modulationSemitones: 4,
    modulationLabel: '+M3',
    rune: '☉',
    colorHex: '#ffb638',
    auraPrimary: [0.96, 0.62, 0.12],
    auraSecondary: [1.0, 0.88, 0.36],
  },
  teal: {
    key: 'teal',
    label: 'Pothos',
    origin: 'mythic longing',
    scaleName: 'Miyako-bushi (In Scale)',
    tuningSystem: 'Japanese Koto Pythagorean',
    description:
      'Traditional Japanese koto and shakuhachi mode tuned in pure fifths/fourths (498¢, 702¢) with deep Pythagorean semitone pulls (90¢, 792¢). Modulates down a minor third (−m3).',
    intervalsCents: [0, 90.2, 498.0, 702.0, 792.2, 996.1],
    modulationSemitones: -3,
    modulationLabel: '−m3',
    rune: '☤',
    colorHex: '#1ed6d0',
    auraPrimary: [0.06, 0.72, 0.78],
    auraSecondary: [0.36, 1.0, 0.92],
  },
  rose: {
    key: 'rose',
    label: 'Ekstasis',
    origin: 'trance',
    scaleName: 'Scriabin Octatonic',
    tuningSystem: '12-EDO Symmetric',
    description:
      'Eight-note alternating half-whole diminished scale favored in late Scriabin for hypnotic, swirling symmetry. Modulates up a semitone (+m2).',
    intervalsCents: [0, 100, 300, 400, 600, 700, 900, 1000],
    modulationSemitones: 1,
    modulationLabel: '+m2',
    rune: '✧',
    colorHex: '#ff5eb8',
    auraPrimary: [0.94, 0.24, 0.66],
    auraSecondary: [1.0, 0.62, 0.88],
  },
};

/**
 * 7 oval stones arranged in a 2 - 3 - 2 diamond configuration,
 * with Zelos (Satie Gnossienne) centered as the default stone.
 */
export const MOOD_DIAMOND_ROWS: readonly (readonly MoodKey[])[] = [
  ['blue', 'rose'],
  ['amber', 'green', 'red'],
  ['teal', 'purple'],
];

export const ROOT_MIN_MIDI = 36;

export const ROOT_MAX_MIDI = 47;

/** Supports fractional microtonal MIDI values (1.0 = 100 cents). */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getPitchGlyph(midi: number): string {
  const pc = ((Math.round(midi) % 12) + 12) % 12;

  return PITCH_GLYPHS[pc];
}

export function modulateKey(currentRootMidi: number, moodKey: MoodKey): number {
  const mood = MOODS[moodKey];
  const shifted = currentRootMidi + mood.modulationSemitones;
  const pitchClass = ((shifted % 12) + 12) % 12;

  return ROOT_MIN_MIDI + pitchClass;
}

/**
 * Builds an ascending array of fractional MIDI notes across `octaves` octaves
 * using exact cultural cents intervals (inclusive of the top octave tonic).
 */
export function buildScaleMidiList(
  rootMidi: number,
  intervalsCents: readonly number[],
  octaves = 2,
): number[] {
  const notes: number[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    for (const cents of intervalsCents) {
      notes.push(rootMidi + oct * 12 + cents / 100);
    }
  }

  notes.push(rootMidi + octaves * 12);

  return notes;
}

export function getZitherStringFrequencies(
  rootMidi: number,
  intervalsCents: readonly number[],
  numStrings = 8,
): ZitherStringTuning[] {
  // Choose a consonant tampura drone for string 1: pure 5th, else 4th, else pure major 6th (Dha)
  const fifth = intervalsCents.find((c) => c >= 680 && c <= 720);
  const fourth = intervalsCents.find((c) => c >= 480 && c <= 520);
  const majorSixth = intervalsCents.find((c) => c >= 870 && c <= 915);
  const droneSecondCents =
    fifth ?? fourth ?? majorSixth ?? intervalsCents[Math.min(2, intervalsCents.length - 1)];

  const midis = [rootMidi, rootMidi + droneSecondCents / 100];
  const upperScale = buildScaleMidiList(rootMidi + 12, intervalsCents, 2);

  for (let i = 0; midis.length < numStrings; i++) {
    midis.push(upperScale[i % upperScale.length]);
  }

  return midis.map((midi, index) => ({
    index,
    midi,
    freq: midiToFreq(midi),
    glyph: getPitchGlyph(midi),
    isLowRed: index < 3,
  }));
}

export function yToScalePitch(
  normalizedY: number,
  rootMidi: number,
  intervalsCents: readonly number[],
  octaves = 2,
): ScalePitchInfo {
  const clamped = Math.max(0, Math.min(1, normalizedY));
  const notes = buildScaleMidiList(rootMidi, intervalsCents, octaves);
  const maxIdx = notes.length - 1;
  const exactPos = clamped * maxIdx;
  const snappedIndex = Math.round(exactPos);

  return {
    notes,
    exactPos,
    snappedIndex,
    snappedMidi: notes[snappedIndex],
    snappedFreq: midiToFreq(notes[snappedIndex]),
  };
}

/**
 * Bounded 1-step pitch bend with a smooth quarter-step gravity well
 * for returning cleanly to the original scale tone.
 */
export function computeBoundedBend(
  anchorIndex: number,
  deltaNormalizedY: number,
  notes: readonly number[],
): BoundedBendInfo {
  const maxIdx = notes.length - 1;
  const rawSteps = deltaNormalizedY * maxIdx;

  let clampedSteps = Math.max(-1, Math.min(1, rawSteps));

  if (anchorIndex === 0 && clampedSteps < 0) clampedSteps = 0;
  if (anchorIndex === maxIdx && clampedSteps > 0) clampedSteps = 0;

  let snappedToNeighbor = false;

  if (clampedSteps >= 0.92 && anchorIndex < maxIdx) {
    clampedSteps = 1;
    snappedToNeighbor = true;
  } else if (clampedSteps <= -0.92 && anchorIndex > 0) {
    clampedSteps = -1;
    snappedToNeighbor = true;
  }

  const direction = clampedSteps >= 0 ? 1 : -1;
  const neighborIndex = Math.max(0, Math.min(maxIdx, anchorIndex + direction));
  const frac = Math.abs(clampedSteps);

  let curvedFrac: number;

  if (snappedToNeighbor) {
    curvedFrac = 1;
  } else if (frac <= 0.07) {
    curvedFrac = 0;
  } else if (frac < 0.28) {
    const t = (frac - 0.07) / 0.21;

    curvedFrac = 0.24 * Math.pow(t, 2.2);
  } else {
    const t = (frac - 0.28) / (0.92 - 0.28);
    const eased = 0.85 * t + 0.15 * (0.5 - 0.5 * Math.cos(Math.PI * t));

    curvedFrac = 0.24 + 0.76 * Math.min(1, eased);
  }

  const baseMidi = notes[anchorIndex];
  const neighborMidi = notes[neighborIndex];
  const midi = baseMidi + (neighborMidi - baseMidi) * curvedFrac;

  return {
    targetIndex: snappedToNeighbor ? neighborIndex : anchorIndex,
    clampedSteps,
    snappedToNeighbor,
    midi,
    freq: midiToFreq(midi),
  };
}

export function computeMorphHarmonics(morph: number): MorphHarmonics {
  const m = Math.max(0, Math.min(1, morph));

  const h1 = 0.86 * Math.pow(1 - m, 1.55) + 0.015;
  const h2 = 0.22 + 0.44 * Math.sin(m * Math.PI * 0.78);
  const h3 = 0.14 * (1 - m * 0.65) + 0.28 * Math.sin(m * Math.PI);
  const h4 = 0.04 + 0.76 * Math.pow(m, 1.45);
  const h5 = 0.03 + 0.16 * Math.pow(m, 1.2) * (1 - 0.45 * m);

  const formantFreq = 460 * Math.pow(1950 / 460, m);
  const formantQ = 2.6 + 2.8 * Math.sin(m * Math.PI * 0.85);

  const vibratoDepthCents = 4 + 34 * Math.pow(m, 1.6);
  const vibratoRateHz = 4.4 + 1.5 * m;

  return {
    h1,
    h2,
    h3,
    h4,
    h5,
    formantFreq,
    formantQ,
    vibratoDepthCents,
    vibratoRateHz,
  };
}

function rotateHue(rgb: RgbTuple, degrees: number): RgbTuple {
  const rad = (degrees * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const k = 1 / 3;
  const sq = Math.sqrt(k);

  const m00 = cosA + (1 - cosA) * k;
  const m01 = k * (1 - cosA) - sq * sinA;
  const m02 = k * (1 - cosA) + sq * sinA;
  const m10 = k * (1 - cosA) + sq * sinA;
  const m11 = cosA + k * (1 - cosA);
  const m12 = k * (1 - cosA) - sq * sinA;
  const m20 = k * (1 - cosA) - sq * sinA;
  const m21 = k * (1 - cosA) + sq * sinA;
  const m22 = cosA + k * (1 - cosA);

  const [r, g, b] = rgb;

  return [
    Math.max(0, Math.min(1, r * m00 + g * m01 + b * m02)),
    Math.max(0, Math.min(1, r * m10 + g * m11 + b * m12)),
    Math.max(0, Math.min(1, r * m20 + g * m21 + b * m22)),
  ];
}

export function getKeyAuraColor(rootMidi: number, moodKey: MoodKey): AuraColors {
  const mood = MOODS[moodKey];
  const pc = ((rootMidi % 12) + 12) % 12;
  const hueShift = ((pc - 5.5) / 6) * 26;

  return {
    primary: rotateHue(mood.auraPrimary, hueShift),
    secondary: rotateHue(mood.auraSecondary, hueShift * 0.8),
  };
}
