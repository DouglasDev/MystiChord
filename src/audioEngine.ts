import { computeMorphHarmonics, type ZitherStringTuning } from './musicTheory';

export interface AudioTelemetry {
  zitherDensity: number;
  padTurbulence: number;
  padActive: boolean;
  padX: number;
  padY: number;
}

interface ActiveZitherVoice {
  stringIndex: number;
  isLowRed: boolean;
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  aeolianOsc: OscillatorNode;
  harmonicMult: number;
  voiceGain: GainNode;
}

// Tiny 1-sample silent WAV data URI used to unlock iOS WebKit playback audio session
// even when the hardware Ring/Silent switch is muted.
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function createWarmthCurve(amount = 18): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));

  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;

    curve[i] = Math.tanh(x * (1 + amount * 0.04));
  }

  return curve;
}

function createAncientChamberIR(ctx: AudioContext, duration = 3.2, decay = 2.6): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay) * (1 - Math.exp(-i / (sampleRate * 0.018)));
      const white = Math.random() * 2 - 1;

      lp = lp * 0.68 + white * 0.32;
      data[i] = lp * env * 0.55;
    }
  }

  return impulse;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private morph = 0.35;
  private activeZitherVoices: ActiveZitherVoice[] = [];
  private padActive = false;
  private padNormalizedX = 0.35;
  private padNormalizedY = 0.5;
  private padSustainSec = 0;
  private padVibratoEnergy = 0;
  private lastTelemetryTime = performance.now();

  private smoothZitherDensity = 0;
  private smoothPadTurbulence = 0;

  private masterInput!: GainNode;
  private pluckNoiseBuffer!: AudioBuffer;

  private padHarmonics: OscillatorNode[] = [];
  private padHarmonicGains: GainNode[] = [];
  private vibratoOsc!: OscillatorNode;
  private vibratoGain!: GainNode;
  private padFormant!: BiquadFilterNode;
  private padLowpass!: BiquadFilterNode;
  private padBendGain!: GainNode;
  private padEnvGain!: GainNode;
  private iosAudioUnlocked = false;
  private silentAudioEl: HTMLAudioElement | null = null;

  /**
   * Synchronous iOS-safe unlock to be called directly inside touchstart/touchend/click.
   */
  unlock(): void {
    // 1. iOS 17+ AudioSession API: lets Web Audio play even when iPhone ringer switch is muted
    const nav = navigator as Navigator & { audioSession?: { type: string } };

    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback';
      } catch {
        // Ignore unsupported audioSession type
      }
    }

    // 2. Silent <audio> element fallback for iOS WebKit silent-switch unlock
    if (!this.iosAudioUnlocked && typeof Audio !== 'undefined') {
      try {
        if (!this.silentAudioEl) {
          const el = new Audio(SILENT_WAV_DATA_URI);

          el.setAttribute('playsinline', 'true');
          el.volume = 0.01;
          this.silentAudioEl = el;
        }

        const playPromise = this.silentAudioEl.play();

        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              this.iosAudioUnlocked = true;
            })
            .catch(() => {
              // Retry on next user gesture
            });
        }
      } catch {
        // Ignore if Audio element is unavailable
      }
    }

    // 3. Create AudioContext synchronously within the user gesture
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      try {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      } catch {
        this.ctx = new AudioCtx();
      }

      this.buildGraph();
    }

    // 4. Resume synchronously (handles both 'suspended' and iOS 'interrupted' states)
    if (this.ctx.state !== 'running') {
      try {
        void this.ctx.resume();
      } catch {
        // Ignore resume errors
      }
    }

    // 5. Play a 1-sample silent buffer to wake iOS WebKit audio hardware immediately
    try {
      const silentBuf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();

      src.buffer = silentBuf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      // Ignore if context is not yet ready
    }
  }

  async ensureStarted(): Promise<void> {
    this.unlock();

    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        // Ignore if outside gesture
      }
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx;

    if (!ctx) return;

    this.masterInput = ctx.createGain();
    this.masterInput.gain.value = 0.85;

    const shaper = ctx.createWaveShaper();

    shaper.curve = createWarmthCurve(12);
    shaper.oversample = '2x';

    const dryGain = ctx.createGain();

    dryGain.gain.value = 0.78;

    const reverbSend = ctx.createGain();

    reverbSend.gain.value = 0.54;

    const convolver = ctx.createConvolver();

    convolver.buffer = createAncientChamberIR(ctx, 3.4, 2.5);

    const reverbFilter = ctx.createBiquadFilter();

    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 3400;

    const compressor = ctx.createDynamicsCompressor();

    compressor.threshold.value = -10;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;

    this.masterInput.connect(shaper);
    shaper.connect(dryGain);
    shaper.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(reverbFilter);

    dryGain.connect(compressor);
    reverbFilter.connect(compressor);
    compressor.connect(ctx.destination);

    const noiseLen = Math.floor(ctx.sampleRate * 0.08);

    this.pluckNoiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = this.pluckNoiseBuffer.getChannelData(0);

    for (let i = 0; i < noiseLen; i++) {
      nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
    }

    this.buildPadVoice();
  }

  private buildPadVoice(): void {
    const ctx = this.ctx;

    if (!ctx) return;

    const now = ctx.currentTime;
    const real = new Float32Array([0, 1.0, 0.32, 0.24, 0.1, 0.08, 0.04]);
    const imag = new Float32Array(real.length);
    const whineWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });

    const padSum = ctx.createGain();

    padSum.gain.value = 0.55;

    this.vibratoOsc = ctx.createOscillator();
    this.vibratoOsc.type = 'sine';
    this.vibratoOsc.frequency.value = 5.2;
    this.vibratoGain = ctx.createGain();
    this.vibratoGain.gain.value = 8;
    this.vibratoOsc.connect(this.vibratoGain);
    this.vibratoOsc.start(now);

    for (let h = 1; h <= 5; h++) {
      const osc = ctx.createOscillator();

      if (h === 1) {
        osc.setPeriodicWave(whineWave);
      } else {
        osc.type = 'sine';
      }

      osc.frequency.value = 220 * h;

      const gain = ctx.createGain();

      gain.gain.value = 0;

      this.vibratoGain.connect(osc.detune);
      osc.connect(gain);
      gain.connect(padSum);
      osc.start(now);

      this.padHarmonics.push(osc);
      this.padHarmonicGains.push(gain);
    }

    this.padFormant = ctx.createBiquadFilter();
    this.padFormant.type = 'peaking';
    this.padFormant.frequency.value = 600;
    this.padFormant.Q.value = 3.0;
    this.padFormant.gain.value = 7.5;

    this.padLowpass = ctx.createBiquadFilter();
    this.padLowpass.type = 'lowpass';
    this.padLowpass.frequency.value = 2800;
    this.padLowpass.Q.value = 0.9;

    this.padBendGain = ctx.createGain();
    this.padBendGain.gain.value = 1.0;

    this.padEnvGain = ctx.createGain();
    this.padEnvGain.gain.value = 0.0001;

    padSum.connect(this.padFormant);
    this.padFormant.connect(this.padLowpass);
    this.padLowpass.connect(this.padBendGain);
    this.padBendGain.connect(this.padEnvGain);
    this.padEnvGain.connect(this.masterInput);

    this.setMorph(this.morph);
  }

  /**
   * Maps left-right axis of the melody pad (0 = low whine, 1 = high theremin whistle).
   */
  setMorph(value: number): void {
    this.morph = Math.max(0, Math.min(1, value));

    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const params = computeMorphHarmonics(this.morph);
    const gains = [params.h1, params.h2, params.h3, params.h4, params.h5];

    for (let i = 0; i < 5; i++) {
      this.padHarmonicGains[i].gain.setTargetAtTime(gains[i], now, 0.035);
    }

    this.padFormant.frequency.setTargetAtTime(params.formantFreq, now, 0.04);
    this.padFormant.Q.setTargetAtTime(params.formantQ, now, 0.04);

    const vibratoBoost = 1 + this.padVibratoEnergy * 0.45;

    this.vibratoOsc.frequency.setTargetAtTime(params.vibratoRateHz, now, 0.05);
    this.vibratoGain.gain.setTargetAtTime(params.vibratoDepthCents * vibratoBoost, now, 0.05);

    const baseLp = 1400 + this.morph * 3800 + this.padVibratoEnergy * 1100;

    this.padLowpass.frequency.setTargetAtTime(baseLp, now, 0.06);
  }

  pluckString(stringIndex: number, freq: number, velocity = 0.8, isLowRed = false): void {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.2, Math.min(1.45, velocity));
    const dynVel = Math.pow(vel, 1.3);

    while (this.activeZitherVoices.length >= 16) {
      const oldest = this.activeZitherVoices.shift();

      if (oldest) {
        this.fadeOutZitherVoice(oldest, 0.12);
      }
    }

    const voiceGain = ctx.createGain();
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

    if (panner) {
      panner.pan.value = ((stringIndex / 7) * 2 - 1) * 0.55;
      voiceGain.connect(panner);
      panner.connect(this.masterInput);
    } else {
      voiceGain.connect(this.masterInput);
    }

    const oscA = ctx.createOscillator();

    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(freq, now);

    const oscB = ctx.createOscillator();

    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(freq * 1.0032, now);

    const jawari = ctx.createBiquadFilter();

    jawari.type = 'bandpass';
    const centerFormant = Math.min(4200, freq * (isLowRed ? 4.0 : 2.8));

    jawari.frequency.setValueAtTime(centerFormant * 1.35, now);
    jawari.frequency.exponentialRampToValueAtTime(centerFormant * 0.72, now + 4.8);
    jawari.Q.value = isLowRed ? 3.2 : 2.2;

    const jawariLfo = ctx.createOscillator();

    jawariLfo.type = 'sine';
    jawariLfo.frequency.value = 0.35 + (stringIndex % 4) * 0.17;
    const jawariLfoGain = ctx.createGain();

    jawariLfoGain.gain.value = centerFormant * 0.28;
    jawariLfo.connect(jawariLfoGain);
    jawariLfoGain.connect(jawari.frequency);

    const bodyFilter = ctx.createBiquadFilter();

    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(Math.min(4800, freq * (4.2 + vel * 1.4)), now);
    bodyFilter.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.5), now + 5.5);

    const bodyGain = ctx.createGain();

    bodyGain.gain.value = 0.52;
    const jawariGain = ctx.createGain();

    jawariGain.gain.value = 0.42;

    oscA.connect(jawari);
    oscB.connect(jawari);
    oscA.connect(bodyFilter);
    oscB.connect(bodyFilter);

    jawari.connect(jawariGain);
    bodyFilter.connect(bodyGain);
    jawariGain.connect(voiceGain);
    bodyGain.connect(voiceGain);

    const aeolianOsc = ctx.createOscillator();

    aeolianOsc.type = 'sine';
    const harmonicMult = isLowRed ? 3.0 : 2.0;

    aeolianOsc.frequency.setValueAtTime(freq * harmonicMult, now);

    const aeolianGain = ctx.createGain();

    aeolianGain.gain.setValueAtTime(0.0001, now);
    aeolianGain.gain.linearRampToValueAtTime(0.16 * vel, now + 0.55);
    aeolianGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.8);

    aeolianOsc.connect(aeolianGain);
    aeolianGain.connect(voiceGain);

    const pluckSrc = ctx.createBufferSource();

    pluckSrc.buffer = this.pluckNoiseBuffer;
    const pluckFilter = ctx.createBiquadFilter();

    pluckFilter.type = 'bandpass';
    pluckFilter.frequency.value = Math.min(3800, freq * 3.5);
    pluckFilter.Q.value = 1.8;
    const pluckGain = ctx.createGain();

    pluckGain.gain.value = 0.2 * vel;
    pluckSrc.connect(pluckFilter);
    pluckFilter.connect(pluckGain);
    pluckGain.connect(voiceGain);

    const decayTime = isLowRed ? 7.2 : 5.6;
    const peakGain = (isLowRed ? 0.25 : 0.2) * dynVel;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + 0.02);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);

    oscA.start(now);
    oscB.start(now);
    jawariLfo.start(now);
    aeolianOsc.start(now);
    pluckSrc.start(now);

    const stopTime = now + decayTime + 0.15;

    oscA.stop(stopTime);
    oscB.stop(stopTime);
    jawariLfo.stop(stopTime);
    aeolianOsc.stop(stopTime);

    const voice: ActiveZitherVoice = {
      stringIndex,
      isLowRed,
      oscA,
      oscB,
      aeolianOsc,
      harmonicMult,
      voiceGain,
    };

    this.activeZitherVoices.push(voice);

    oscA.onended = () => {
      const idx = this.activeZitherVoices.indexOf(voice);

      if (idx !== -1) this.activeZitherVoices.splice(idx, 1);

      try {
        voiceGain.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Already disconnected
      }
    };
  }

  private fadeOutZitherVoice(voice: ActiveZitherVoice, fadeSec = 0.15): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    try {
      voice.voiceGain.gain.cancelScheduledValues(now);
      voice.voiceGain.gain.setValueAtTime(Math.max(0.0001, voice.voiceGain.gain.value), now);
      voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
      voice.oscA.stop(now + fadeSec + 0.03);
      voice.oscB.stop(now + fadeSec + 0.03);
      voice.aeolianOsc.stop(now + fadeSec + 0.03);
    } catch {
      // Already stopped
    }
  }

  retuneActiveZither(stringTunings: readonly ZitherStringTuning[]): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    for (const voice of this.activeZitherVoices) {
      const target = stringTunings[voice.stringIndex];

      if (!target) continue;

      voice.oscA.frequency.setTargetAtTime(target.freq, now, 0.14);
      voice.oscB.frequency.setTargetAtTime(target.freq * 1.0032, now, 0.14);
      voice.aeolianOsc.frequency.setTargetAtTime(target.freq * voice.harmonicMult, now, 0.14);
    }
  }

  /**
   * Press on Melody Pad: snaps to scale tone with faster attack; X sets harmonic morph.
   * Volume starts moderate and swells via sustain + vibrato.
   */
  padDown(freq: number, normalizedX: number, normalizedY: number): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    this.padActive = true;
    this.padSustainSec = 0;
    this.padVibratoEnergy = 0;
    this.padNormalizedX = Math.max(0, Math.min(1, normalizedX));
    this.padNormalizedY = Math.max(0, Math.min(1, normalizedY));

    this.setMorph(this.padNormalizedX);

    for (let i = 0; i < 5; i++) {
      const osc = this.padHarmonics[i];

      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(freq * (i + 1), now);
    }

    this.padEnvGain.gain.cancelScheduledValues(now);
    const currentGain = Math.max(0.0001, this.padEnvGain.gain.value);

    this.padEnvGain.gain.setValueAtTime(currentGain, now);
    this.padEnvGain.gain.linearRampToValueAtTime(0.22, now + 0.032);

    this.padBendGain.gain.cancelScheduledValues(now);
    this.padBendGain.gain.setTargetAtTime(1.0, now, 0.025);
  }

  /**
   * Drag/Bend/Vibrato on Melody Pad:
   * - X controls harmonic morph (low whine <-> high theremin whistle)
   * - Y bends up to 1 scale tone above/below with slower lyrical attack
   * - Finger movement / vibrato pumps expressive volume & warmth
   */
  padMove(
    freq: number,
    normalizedX: number,
    normalizedY: number,
    motionEnergy = 0,
    isBending = false,
  ): void {
    if (!this.ctx || !this.padActive) return;

    const now = this.ctx.currentTime;

    this.padNormalizedX = Math.max(0, Math.min(1, normalizedX));
    this.padNormalizedY = Math.max(0, Math.min(1, normalizedY));

    // Accumulate vibrato expression from finger oscillation / motion
    this.padVibratoEnergy = Math.min(1, this.padVibratoEnergy + motionEnergy * 2.8);

    this.setMorph(this.padNormalizedX);

    for (let i = 0; i < 5; i++) {
      this.padHarmonics[i].frequency.setTargetAtTime(freq * (i + 1), now, 0.045);
    }

    if (isBending) {
      this.padBendGain.gain.setTargetAtTime(0.88, now, 0.06);
      this.padBendGain.gain.setTargetAtTime(1.05, now + 0.07, 0.2);
    }
  }

  padUp(): void {
    if (!this.ctx || !this.padActive) return;

    const now = this.ctx.currentTime;

    this.padActive = false;
    this.padSustainSec = 0;

    this.padEnvGain.gain.cancelScheduledValues(now);
    this.padEnvGain.gain.setValueAtTime(Math.max(0.0001, this.padEnvGain.gain.value), now);
    this.padEnvGain.gain.setTargetAtTime(0.0001, now, 0.24);
  }

  getTelemetry(): AudioTelemetry {
    const nowMs = performance.now();
    const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - this.lastTelemetryTime) * 0.001));

    this.lastTelemetryTime = nowMs;

    // Sustain + vibrato dynamically swell volume while the pad is held
    if (this.padActive && this.ctx) {
      this.padSustainSec += dtSec;
      this.padVibratoEnergy = Math.max(0, this.padVibratoEnergy * Math.pow(0.28, dtSec));

      const sustainBoost = (1 - Math.exp(-this.padSustainSec / 1.45)) * 0.24;
      const vibratoBoost = this.padVibratoEnergy * 0.3;
      const targetGain = Math.min(0.76, 0.22 + sustainBoost + vibratoBoost);

      this.padEnvGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.14);
    } else {
      this.padVibratoEnergy = Math.max(0, this.padVibratoEnergy * Math.pow(0.15, dtSec));
    }

    // Zither cloud density scales smoothly with active ringing zither strings
    const targetDensity = Math.min(1, this.activeZitherVoices.length / 7);

    this.smoothZitherDensity +=
      (targetDensity - this.smoothZitherDensity) * Math.min(1, dtSec * 1.8);

    // Pad cloud turbulence scales smoothly when playing & vibratoing melody pad
    const targetTurbulence = this.padActive ? 0.35 + this.padVibratoEnergy * 0.65 : 0;

    this.smoothPadTurbulence +=
      (targetTurbulence - this.smoothPadTurbulence) * Math.min(1, dtSec * 2.2);

    return {
      zitherDensity: this.smoothZitherDensity,
      padTurbulence: this.smoothPadTurbulence,
      padActive: this.padActive,
      padX: this.padNormalizedX,
      padY: this.padNormalizedY,
    };
  }
}
