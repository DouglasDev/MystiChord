export type MoodKey = 'blue' | 'green' | 'purple' | 'red';

export type RgbTuple = [number, number, number];

export interface MoodDefinition {
  key: MoodKey;
  label: string;
  scaleName: string;
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
  noteName: string;
  isDrone: boolean;
}

export interface ScalePitchInfo {
  notes: number[];
  exactPos: number;
  snappedIndex: number;
  snappedMidi: number;
  snappedFreq: number;
  bentMidi: number;
  bentFreq: number;
}

export interface AnchoredBendInfo {
  pos: number;
  nearestIndex: number;
  midi: number;
  freq: number;
  bendAmount: number;
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

export const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const;

export const MOODS: Record<MoodKey, MoodDefinition> = {
  blue: {
    key: 'blue',
    label: 'Calm',
    scaleName: 'Scriabin Prometheus',
    intervals: [0, 2, 4, 6, 9, 10],
    modulationSemitones: 5,
    modulationLabel: '+P4',
    rune: '☽',
    colorHex: '#28a8ff',
    auraPrimary: [0.1, 0.56, 0.96],
    auraSecondary: [0.3, 0.94, 1.0],
  },
  green: {
    key: 'green',
    label: 'Lively',
    scaleName: 'Satie Gnossienne',
    intervals: [0, 2, 3, 6, 7, 9, 10],
    modulationSemitones: 7,
    modulationLabel: '+P5',
    rune: '✦',
    colorHex: '#26d98a',
    auraPrimary: [0.08, 0.8, 0.52],
    auraSecondary: [0.56, 1.0, 0.44],
  },
  purple: {
    key: 'purple',
    label: 'Sad',
    scaleName: 'Raga Todi',
    intervals: [0, 1, 3, 6, 7, 8, 11],
    modulationSemitones: -4,
    modulationLabel: '−M3',
    rune: '◈',
    colorHex: '#a552ff',
    auraPrimary: [0.54, 0.22, 0.95],
    auraSecondary: [0.9, 0.4, 1.0],
  },
  red: {
    key: 'red',
    label: 'Tense',
    scaleName: 'Raga Marwa',
    intervals: [0, 1, 4, 6, 9, 11],
    modulationSemitones: 6,
    modulationLabel: '+TT',
    rune: '❖',
    colorHex: '#ff3b4e',
    auraPrimary: [0.95, 0.18, 0.28],
    auraSecondary: [1.0, 0.58, 0.2],
  },
};

export const MOOD_ORDER: readonly MoodKey[] = ['blue', 'green', 'purple', 'red'];

export const ROOT_MIN_MIDI = 36;

export const ROOT_MAX_MIDI = 47;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getNoteName(midi: number): string {
  const pc = ((Math.round(midi) % 12) + 12) % 12;

  return NOTE_NAMES[pc];
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
    noteName: getNoteName(midi),
    isDrone: index < 2,
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
  const lowIndex = Math.floor(exactPos);
  const highIndex = Math.min(maxIdx, lowIndex + 1);
  const frac = exactPos - lowIndex;

  const curvedFrac = 0.78 * frac + 0.22 * (0.5 - 0.5 * Math.cos(Math.PI * frac));
  const bentMidi = notes[lowIndex] + (notes[highIndex] - notes[lowIndex]) * curvedFrac;

  return {
    notes,
    exactPos,
    snappedIndex,
    snappedMidi: notes[snappedIndex],
    snappedFreq: midiToFreq(notes[snappedIndex]),
    bentMidi,
    bentFreq: midiToFreq(bentMidi),
  };
}

export function computeAnchoredBend(
  anchorIndex: number,
  deltaNormalizedY: number,
  notes: readonly number[],
): AnchoredBendInfo {
  const maxIdx = notes.length - 1;
  const rawPos = Math.max(0, Math.min(maxIdx, anchorIndex + deltaNormalizedY * maxIdx));
  const lowIndex = Math.floor(rawPos);
  const highIndex = Math.min(maxIdx, lowIndex + 1);
  const frac = rawPos - lowIndex;
  const curvedFrac = 0.8 * frac + 0.2 * (0.5 - 0.5 * Math.cos(Math.PI * frac));
  const midi = notes[lowIndex] + (notes[highIndex] - notes[lowIndex]) * curvedFrac;

  return {
    pos: rawPos,
    nearestIndex: Math.round(rawPos),
    midi,
    freq: midiToFreq(midi),
    bendAmount: Math.abs(rawPos - anchorIndex),
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
