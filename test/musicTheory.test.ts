import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOODS,
  ROOT_MAX_MIDI,
  ROOT_MIN_MIDI,
  computeAnchoredBend,
  computeMorphHarmonics,
  getKeyAuraColor,
  getZitherStringFrequencies,
  modulateKey,
  yToScalePitch,
} from '../src/musicTheory.ts';

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

test('all 4 mystical scales are neither standard major nor natural minor', () => {
  for (const mood of Object.values(MOODS)) {
    assert.notDeepEqual(mood.intervals, MAJOR_INTERVALS, `${mood.scaleName} must not be major`);
    assert.notDeepEqual(mood.intervals, MINOR_INTERVALS, `${mood.scaleName} must not be minor`);
    assert.equal(mood.intervals[0], 0, `${mood.scaleName} must start on root 0`);
  }
});

test('modulateKey applies mystical intervals and wraps within resonant octave', () => {
  const start = 38;
  const afterBlue = modulateKey(start, 'blue');

  assert.equal(afterBlue, 43);

  const afterGreen = modulateKey(afterBlue, 'green');

  assert.equal(afterGreen, 38);

  const afterRed = modulateKey(start, 'red');

  assert.equal(afterRed, 44);
  assert.equal(modulateKey(afterRed, 'red'), start);

  let cur = start;

  for (let i = 0; i < 40; i++) {
    for (const key of ['blue', 'green', 'purple', 'red'] as const) {
      cur = modulateKey(cur, key);
      assert.ok(cur >= ROOT_MIN_MIDI && cur <= ROOT_MAX_MIDI);
    }
  }
});

test('zither string frequencies produce 8 ascending/drone strings', () => {
  const tunings = getZitherStringFrequencies(38, MOODS.purple.intervals, 8);

  assert.equal(tunings.length, 8);
  assert.equal(tunings[0].isDrone, true);
  assert.equal(tunings[1].isDrone, true);
  assert.equal(tunings[2].isDrone, false);

  for (let i = 1; i < tunings.length; i++) {
    assert.ok(tunings[i].freq > tunings[i - 1].freq);
  }
});

test('square pad starts on exact scale tone and bends monotonically toward next scale tone', () => {
  const root = 50;
  const intervals = MOODS.green.intervals;
  const startInfo = yToScalePitch(0.32, root, intervals, 2);

  const atZeroBend = computeAnchoredBend(startInfo.snappedIndex, 0, startInfo.notes);

  assert.equal(atZeroBend.midi, startInfo.snappedMidi);

  const stepA = computeAnchoredBend(startInfo.snappedIndex, 0.03, startInfo.notes);
  const stepB = computeAnchoredBend(startInfo.snappedIndex, 0.06, startInfo.notes);
  const stepC = computeAnchoredBend(startInfo.snappedIndex, 0.12, startInfo.notes);

  assert.ok(stepA.freq > atZeroBend.freq);
  assert.ok(stepB.freq > stepA.freq);
  assert.ok(stepC.freq > stepB.freq);
});

test('morph knob weakens fundamental while amplifying high overtones from 0 to 1', () => {
  const lowWhine = computeMorphHarmonics(0.0);
  const midMorph = computeMorphHarmonics(0.5);
  const highWhistle = computeMorphHarmonics(1.0);

  assert.ok(lowWhine.h1 > midMorph.h1);
  assert.ok(midMorph.h1 > highWhistle.h1);
  assert.ok(highWhistle.h1 < 0.05);

  assert.ok(lowWhine.h4 < midMorph.h4);
  assert.ok(midMorph.h4 < highWhistle.h4);
  assert.ok(highWhistle.h4 > highWhistle.h1 * 10);

  assert.ok(highWhistle.vibratoDepthCents > lowWhine.vibratoDepthCents);
});

test('key aura color returns valid RGB triplets and shifts per key signature', () => {
  const c1 = getKeyAuraColor(36, 'blue');
  const c2 = getKeyAuraColor(42, 'blue');

  for (const ch of [...c1.primary, ...c1.secondary, ...c2.primary, ...c2.secondary]) {
    assert.ok(ch >= 0 && ch <= 1);
  }

  assert.notDeepEqual(c1.primary, c2.primary);
});
