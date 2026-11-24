import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOODS,
  MOOD_DIAMOND_ROWS,
  PITCH_GLYPHS,
  ROOT_MAX_MIDI,
  ROOT_MIN_MIDI,
  computeBoundedBend,
  computeMorphHarmonics,
  getKeyAuraColor,
  getPitchGlyph,
  getZitherStringFrequencies,
  modulateKey,
  yToScalePitch,
} from '../src/musicTheory.ts';

const MAJOR_CENTS = [0, 200, 400, 500, 700, 900, 1100];
const MINOR_CENTS = [0, 200, 300, 500, 700, 800, 1000];

test('all 7 mystical scales are non-major/non-minor and non-Western scales use cultural microtonal tunings', () => {
  const allMoods = Object.values(MOODS);

  assert.equal(allMoods.length, 7);

  for (const mood of allMoods) {
    assert.notDeepEqual(mood.intervalsCents, MAJOR_CENTS, `${mood.scaleName} must not be major`);
    assert.notDeepEqual(mood.intervalsCents, MINOR_CENTS, `${mood.scaleName} must not be minor`);
    assert.equal(mood.intervalsCents[0], 0, `${mood.scaleName} must start on root 0`);
  }

  // Non-Western scales use non-12-EDO microtonal intervals
  for (const key of ['blue', 'purple', 'red', 'amber', 'teal'] as const) {
    const hasMicrotonal = MOODS[key].intervalsCents.some((c) => Math.abs(c % 100) > 0.5);

    assert.ok(hasMicrotonal, `${MOODS[key].scaleName} should use cultural microtonal intonation`);
  }

  const diamondCount = MOOD_DIAMOND_ROWS.reduce((sum, row) => sum + row.length, 0);

  assert.equal(diamondCount, 7);
});

test('pitch glyphs use obscure ancient notation rather than modern A-G note names', () => {
  assert.equal(PITCH_GLYPHS.length, 12);

  for (let midi = 36; midi < 48; midi++) {
    const glyph = getPitchGlyph(midi);

    assert.ok(!/^[A-G][#b♯♭]?$/.test(glyph), `glyph ${glyph} must not be Western A-G`);
  }
});

test('modulateKey applies mystical intervals across all 7 moods and wraps within resonant octave', () => {
  const start = 38;

  assert.equal(modulateKey(start, 'blue'), 43);
  assert.equal(modulateKey(43, 'green'), 38);

  const afterRed = modulateKey(start, 'red');

  assert.equal(modulateKey(afterRed, 'red'), start);

  let cur = start;
  const keys = Object.keys(MOODS) as (keyof typeof MOODS)[];

  for (let i = 0; i < 20; i++) {
    for (const key of keys) {
      cur = modulateKey(cur, key);
      assert.ok(cur >= ROOT_MIN_MIDI && cur <= ROOT_MAX_MIDI);
    }
  }
});

test('zither strings have 3 low red strings and 5 upper white-gold ascending strings', () => {
  const tunings = getZitherStringFrequencies(38, MOODS.purple.intervalsCents, 8);

  assert.equal(tunings.length, 8);
  assert.equal(tunings.filter((s) => s.isLowRed).length, 3);
  assert.equal(tunings.filter((s) => !s.isLowRed).length, 5);

  // Pure Just fifth (~702 cents) on string 1 for Raga Todi
  const ratio = tunings[1].freq / tunings[0].freq;

  assert.ok(Math.abs(ratio - 1.5) < 0.001, 'Raga Todi drone fifth should be pure 3:2 Just fifth');

  // Ataraxia (no 5th) uses consonant 5:3 Just major sixth for its 2nd drone string (not dissonant tritone)
  const ataraxiaTunings = getZitherStringFrequencies(38, MOODS.blue.intervalsCents, 8);
  const ataraxiaDroneRatio = ataraxiaTunings[1].freq / ataraxiaTunings[0].freq;

  assert.ok(
    Math.abs(ataraxiaDroneRatio - 5 / 3) < 0.002,
    'Ataraxia 2nd drone string should be consonant 5:3 major sixth',
  );

  for (let i = 1; i < tunings.length; i++) {
    assert.ok(tunings[i].freq > tunings[i - 1].freq);
  }
});

test('bounded pitch bend only bends up to 1 scale tone above or below and nudges near origin', () => {
  const root = 50;
  const intervals = MOODS.green.intervalsCents;
  const startInfo = yToScalePitch(0.4, root, intervals, 2);
  const anchor = startInfo.snappedIndex;
  const notes = startInfo.notes;

  const atRest = computeBoundedBend(anchor, 0, notes);

  assert.equal(atRest.midi, notes[anchor]);

  const tinyDrift = computeBoundedBend(anchor, 0.05 / (notes.length - 1), notes);

  assert.equal(tinyDrift.midi, notes[anchor]);

  const quarterStepUp = computeBoundedBend(anchor, 0.2 / (notes.length - 1), notes);
  const linearQuarterMidi = notes[anchor] + (notes[anchor + 1] - notes[anchor]) * 0.2;

  assert.ok(quarterStepUp.midi > notes[anchor]);

  assert.ok(
    quarterStepUp.midi < linearQuarterMidi,
    'quarter-step should nudge toward original pitch',
  );

  const halfUp = computeBoundedBend(anchor, 0.5 / (notes.length - 1), notes);

  assert.ok(halfUp.midi > notes[anchor] && halfUp.midi < notes[anchor + 1]);

  const farUp = computeBoundedBend(anchor, 0.6, notes);

  assert.equal(farUp.snappedToNeighbor, true);
  assert.equal(farUp.midi, notes[anchor + 1]);

  const farDown = computeBoundedBend(anchor, -0.6, notes);

  assert.equal(farDown.snappedToNeighbor, true);
  assert.equal(farDown.midi, notes[anchor - 1]);
});

test('harmonic morph weakens fundamental while amplifying high overtones from 0 to 1', () => {
  const lowWhine = computeMorphHarmonics(0.0);
  const midMorph = computeMorphHarmonics(0.5);
  const highWhistle = computeMorphHarmonics(1.0);

  assert.ok(lowWhine.h1 > midMorph.h1);
  assert.ok(midMorph.h1 > highWhistle.h1);
  assert.ok(highWhistle.h1 < 0.05);

  assert.ok(lowWhine.h4 < midMorph.h4);
  assert.ok(midMorph.h4 < highWhistle.h4);
  assert.ok(highWhistle.h4 > highWhistle.h1 * 10);
});

test('key aura color returns valid RGB triplets and shifts per key signature', () => {
  const c1 = getKeyAuraColor(36, 'amber');
  const c2 = getKeyAuraColor(42, 'amber');

  for (const ch of [...c1.primary, ...c1.secondary, ...c2.primary, ...c2.secondary]) {
    assert.ok(ch >= 0 && ch <= 1);
  }

  assert.notDeepEqual(c1.primary, c2.primary);
});
