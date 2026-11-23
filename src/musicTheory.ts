export type MoodKey = 'blue' | 'green' | 'purple' | 'red' | 'amber' | 'teal' | 'rose';

export type RgbTuple = [number, number, number];

export interface MoodDefinition {
  key: MoodKey;
  label: string;
  origin: string;
  scaleName: string;
  description: string;
  intervals: readonly number[];
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
 * Seven mystical non-major/non-minor scales paired with obscure Greek,
 * Latin, and Early English emotion words.
 */
export const MOODS: Record<MoodKey, MoodDefinition> = {
  blue: {
    key: 'blue',
    label: 'Ataraxia',
    origin: 'Greek — stillness',
    scaleName: 'Scriabin Prometheus',
    description:
      'Hexatonic scale derived from Scriabin’s Mystic Chord; weightless quartal and tritone harmony. Modulates up a fourth (+P4).',
    intervals: [0, 2, 4, 6, 9, 10],
    modulationSemitones: 5,
    modulationLabel: '+P4',
    rune: '☽',
    colorHex: '#2caeff',
    auraPrimary: [0.1, 0.56, 0.96],
    auraSecondary: [0.34, 0.92, 1.0],
  },
  green: {
    key: 'green',
    label: 'Alacritas',
    origin: 'Latin — lively eagerness',
    scaleName: 'Satie Gnossienne (Dorian ♯4)',
    description:
      'Used in Erik Satie’s Gnossiennes; a raised fourth creates an augmented second with a buoyant, ancient lilt. Modulates up a fifth (+P5).',
    intervals: [0, 2, 3, 6, 7, 9, 10],
    modulationSemitones: 7,
    modulationLabel: '+P5',
    rune: '✦',
    colorHex: '#28dc8c',
    auraPrimary: [0.08, 0.8, 0.52],
    auraSecondary: [0.56, 1.0, 0.44],
  },
  purple: {
    key: 'purple',
    label: 'Wanhope',
    origin: 'Early English — sorrow',
    scaleName: 'Raga Todi',
    description:
      'Hindustani morning raga pairing flat second, flat third, and sharp fourth for poignant, devotional melancholy. Modulates down a major third (−M3).',
    intervals: [0, 1, 3, 6, 7, 8, 11],
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
    origin: 'Greek — taut struggle',
    scaleName: 'Raga Marwa',
    description:
      'Hindustani dusk raga that omits the fifth entirely, suspending melodies between a flat second and sharp fourth. Modulates by a tritone (+TT).',
    intervals: [0, 1, 4, 6, 9, 11],
    modulationSemitones: 6,
    modulationLabel: '+TT',
    rune: '❖',
    colorHex: '#ff3b4e',
    auraPrimary: [0.95, 0.18, 0.28],
    auraSecondary: [1.0, 0.56, 0.22],
  },
  amber: {
    key: 'amber',
    label: 'Thauma',
    origin: 'Greek — wonder',
    scaleName: 'Raga Bhairav (Double Harmonic)',
    description:
      'Symmetric scale with two augmented seconds, evoking dawn ritual and sacred awe. Modulates up a major third (+M3).',
    intervals: [0, 1, 4, 5, 7, 8, 11],
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
    origin: 'Greek — mythic longing',
    scaleName: 'Raga Purvi',
    description:
      'Twilight raga combining a major third with a sharp fourth and flat sixth for bittersweet yearning. Modulates down a minor third (−m3).',
    intervals: [0, 1, 4, 6, 7, 8, 11],
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
    origin: 'Greek — trance',
    scaleName: 'Scriabin Octatonic',
    description:
      'Eight-note alternating half-whole diminished scale favored in late Scriabin for hypnotic, swirling tension. Modulates up a semitone (+m2).',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    modulationSemitones: 1,
    modulationLabel: '+m2',
    rune: '✧',
    colorHex: '#ff5eb8',
    auraPrimary: [0.94, 0.24, 0.66],
    auraSecondary: [1.0, 0.62, 0.88],
  },
};

/**
 * 7 oval stones arranged in a 2 - 3 - 2 diamond configuration.
 */
export const MOOD_DIAMOND_ROWS: readonly (readonly MoodKey[])[] = [
  ['blue', 'amber'],
  ['green', 'rose', 'red'],
  ['teal', 'purple'],
];

export const ROOT_MIN_MIDI = 36;

export const ROOT_MAX_MIDI = 47;

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

export function buildScaleMidiList(
  rootMidi: number,
  intervals: readonly number[],
  octaves = 2,
): number[] {
  const notes: number[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    for (const iv of intervals) {
      notes.push(rootMidi + oct * 12 + iv);
    }
  }

  notes.push(rootMidi + octaves * 12);

  return notes;
}

export function getZitherStringFrequencies(
  rootMidi: number,
  intervals: readonly number[],
  numStrings = 8,
): ZitherStringTuning[] {
  const droneSecondInterval = intervals.includes(7)
    ? 7
    : intervals.includes(6)
      ? 6
      : intervals[Math.min(3, intervals.length - 1)];

  const midis = [rootMidi, rootMidi + droneSecondInterval];
  const upperScale = buildScaleMidiList(rootMidi + 12, intervals, 2);

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
  intervals: readonly number[],
  octaves = 2,
): ScalePitchInfo {
  const clamped = Math.max(0, Math.min(1, normalizedY));
  const notes = buildScaleMidiList(rootMidi, intervals, octaves);
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
 * Bounded 1-step pitch bend: starts on `anchorIndex` and bends at most to
 * the note directly above (`anchorIndex + 1`) or directly below (`anchorIndex - 1`).
 * Once the thumb reaches that neighbor (>= 92% of the step), it locks cleanly
 * onto that neighbor note rather than bending further.
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
    // Inner return pocket: locks cleanly onto the original pitch
    curvedFrac = 0;
  } else if (frac < 0.28) {
    // Quarter-step gravity well: smoothly nudges pitch toward original note
    const t = (frac - 0.07) / 0.21;

    curvedFrac = 0.24 * Math.pow(t, 2.2);
  } else {
    // Smooth continuous bend from 0.28 -> 0.92 up to the adjacent scale tone
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
