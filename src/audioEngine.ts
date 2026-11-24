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
  cleanup: () => void;
  cleanedUp: boolean;
}

// Tiny 1-sample silent WAV data URI used to unlock iOS WebKit playback audio session
// even when the hardware Ring/Silent switch is muted.
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function holdAudioParam(param: AudioParam, now: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
}

function createWarmthCurve(amount = 10): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const drive = 1 + amount * 0.04;
  const norm = Math.tanh(drive);

  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;

    curve[i] = Math.tanh(x * drive) / norm;
  }

  return curve;
}

/**
 * Synthesizes a warm 2.4s stereo ancient-chamber impulse response with calibrated
 * gain (used with convolver.normalize = false to prevent unexpected +12dB clipping).
 */
function createAncientChamberIR(ctx: AudioContext, duration = 2.4, decay = 2.4): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  // Scale energy inversely with sqrt(length) so wet reverb level is consistent across sample rates
  const levelScale = 2.4 / Math.sqrt(length);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay) * (1 - Math.exp(-i / (sampleRate * 0.018)));
      const white = Math.random() * 2 - 1;

      lp = lp * 0.68 + white * 0.32;
      data[i] = lp * env * levelScale;
    }
  }

  return impulse;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private morph = 0.35;
  private lastAppliedMorph = -1;
  private activeZitherVoices: ActiveZitherVoice[] = [];
  private padActive = false;
  private padNormalizedX = 0.35;
  private padNormalizedY = 0.5;
  private padSustainSec = 0;
  private padVibratoEnergy = 0;
  private padAttackEndTime = 0;
  private lastPadGainTarget = 0;
  private lastTelemetryTime = performance.now();

  private smoothZitherDensity = 0;
  private smoothPadTurbulence = 0;

  private masterInput!: GainNode;
  private pluckNoiseBuffer!: AudioBuffer;
  private zitherLfoA!: OscillatorNode;
  private zitherLfoB!: OscillatorNode;
  private stringBuses: GainNode[] = [];

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
   * Synchronous iOS-safe unlock to be called inside touchstart/touchend/click.
   * Early-returns with zero allocations once audio is already running.
   */
  unlock(): void {
    if (this.ctx && this.ctx.state === 'running' && this.iosAudioUnlocked) {
      return;
    }

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
        } else {
          this.iosAudioUnlocked = true;
        }
      } catch {
        this.iosAudioUnlocked = true;
      }
    } else {
      this.iosAudioUnlocked = true;
    }

    // 3. Create AudioContext synchronously within the user gesture (default balanced buffer avoids underruns)
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.ctx = new AudioCtx();
      this.buildGraph();
    }

    // 4. Resume synchronously (handles both 'suspended' and iOS 'interrupted' states)
    if (this.ctx.state !== 'running') {
      try {
        void this.ctx.resume();
      } catch {
        // Ignore resume errors
      }

      // 5. Play a 1-sample silent buffer ONLY while waking from non-running state
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

    const now = ctx.currentTime;

    this.masterInput = ctx.createGain();
    this.masterInput.gain.value = 0.72;

    const shaper = ctx.createWaveShaper();

    shaper.curve = createWarmthCurve(10);
    shaper.oversample = 'none';

    const dryGain = ctx.createGain();

    dryGain.gain.value = 0.8;

    const reverbSend = ctx.createGain();

    reverbSend.gain.value = 0.52;

    const convolver = ctx.createConvolver();

    // Disable implicit RMS normalization so reverb gain is exact and never clips
    convolver.normalize = false;
    convolver.buffer = createAncientChamberIR(ctx, 2.4, 2.3);

    const reverbFilter = ctx.createBiquadFilter();

    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 3400;

    const compressor = ctx.createDynamicsCompressor();

    compressor.threshold.value = -6;
    compressor.knee.value = 14;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.14;

    const masterOut = ctx.createGain();

    masterOut.gain.value = 0.86;

    this.masterInput.connect(shaper);
    shaper.connect(dryGain);
    shaper.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(reverbFilter);

    dryGain.connect(compressor);
    reverbFilter.connect(compressor);
    compressor.connect(masterOut);
    masterOut.connect(ctx.destination);

    // Pre-generate 8 persistent panned string buses so individual plucks never allocate StereoPanners
    this.stringBuses = [];

    for (let i = 0; i < 8; i++) {
      const bus = ctx.createGain();
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

      if (panner) {
        panner.pan.value = ((i / 7) * 2 - 1) * 0.52;
        bus.connect(panner);
        panner.connect(this.masterInput);
      } else {
        bus.connect(this.masterInput);
      }

      this.stringBuses.push(bus);
    }

    // Two persistent shared jawari shimmer LFOs (avoids allocating/leaking an LFO per pluck)
    this.zitherLfoA = ctx.createOscillator();
    this.zitherLfoA.type = 'sine';
    this.zitherLfoA.frequency.value = 0.42;
    this.zitherLfoA.start(now);

    this.zitherLfoB = ctx.createOscillator();
    this.zitherLfoB.type = 'sine';
    this.zitherLfoB.frequency.value = 0.69;
    this.zitherLfoB.start(now);

    // Pre-generate smooth-attack pluck noise buffer (2ms fade-in prevents 1-sample click!)
    const noiseLen = Math.floor(ctx.sampleRate * 0.075);
    const fadeInSamples = Math.max(1, Math.floor(ctx.sampleRate * 0.0025));

    this.pluckNoiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = this.pluckNoiseBuffer.getChannelData(0);

    for (let i = 0; i < noiseLen; i++) {
      const fadeIn = i < fadeInSamples ? i / fadeInSamples : 1;
      const decay = Math.exp(-i / (ctx.sampleRate * 0.012));

      nd[i] = (Math.random() * 2 - 1) * fadeIn * decay;
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

    padSum.gain.value = 0.46;

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
    this.padFormant.gain.value = 6.5;

    this.padLowpass = ctx.createBiquadFilter();
    this.padLowpass.type = 'lowpass';
    this.padLowpass.frequency.value = 2800;
    this.padLowpass.Q.value = 0.85;

    this.padBendGain = ctx.createGain();
    this.padBendGain.gain.value = 1.0;

    this.padEnvGain = ctx.createGain();
    this.padEnvGain.gain.value = 0.0001;

    padSum.connect(this.padFormant);
    this.padFormant.connect(this.padLowpass);
    this.padLowpass.connect(this.padBendGain);
    this.padBendGain.connect(this.padEnvGain);
    this.padEnvGain.connect(this.masterInput);

    this.setMorph(this.morph, true);
  }

  /**
   * Maps left-right axis of the melody pad (0 = low whine, 1 = high theremin whistle).
   */
  setMorph(value: number, force = false): void {
    this.morph = Math.max(0, Math.min(1, value));

    if (!this.ctx) return;
    if (!force && Math.abs(this.morph - this.lastAppliedMorph) < 0.003) return;

    this.lastAppliedMorph = this.morph;

    const now = this.ctx.currentTime;
    const params = computeMorphHarmonics(this.morph);
    const gains = [params.h1, params.h2, params.h3, params.h4, params.h5];

    for (let i = 0; i < 5; i++) {
      this.padHarmonicGains[i].gain.setTargetAtTime(gains[i], now, 0.04);
    }

    this.padFormant.frequency.setTargetAtTime(params.formantFreq, now, 0.045);
    this.padFormant.Q.setTargetAtTime(params.formantQ, now, 0.045);

    const vibratoBoost = 1 + this.padVibratoEnergy * 0.45;

    this.vibratoOsc.frequency.setTargetAtTime(params.vibratoRateHz, now, 0.055);
    this.vibratoGain.gain.setTargetAtTime(params.vibratoDepthCents * vibratoBoost, now, 0.055);

    const baseLp = 1400 + this.morph * 3600 + this.padVibratoEnergy * 900;

    this.padLowpass.frequency.setTargetAtTime(baseLp, now, 0.065);
  }

  pluckString(stringIndex: number, freq: number, velocity = 0.8, isLowRed = false): void {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.22, Math.min(1.35, velocity));
    const dynVel = Math.pow(vel, 1.25);

    // Gently re-excite the same physical string rather than stacking conflicting duplicates
    for (let i = this.activeZitherVoices.length - 1; i >= 0; i--) {
      const existing = this.activeZitherVoices[i];

      if (existing.stringIndex === stringIndex) {
        this.activeZitherVoices.splice(i, 1);
        this.fadeOutZitherVoice(existing, 0.055);
      }
    }

    // Cap polyphony cleanly for smooth mobile audio performance
    while (this.activeZitherVoices.length >= 10) {
      const oldest = this.activeZitherVoices.shift();

      if (oldest) {
        this.fadeOutZitherVoice(oldest, 0.08);
      }
    }

    const stringBus = this.stringBuses[stringIndex] ?? this.masterInput;
    const voiceGain = ctx.createGain();

    voiceGain.connect(stringBus);

    const oscA = ctx.createOscillator();

    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(freq, now);

    const oscB = ctx.createOscillator();

    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(freq * 1.0032, now);

    // Jawari resonant shimmer driven by shared persistent LFO (zero per-pluck LFO allocation)
    const jawari = ctx.createBiquadFilter();

    jawari.type = 'bandpass';
    const centerFormant = Math.min(4000, freq * (isLowRed ? 3.8 : 2.7));

    jawari.frequency.setValueAtTime(centerFormant * 1.32, now);
    jawari.frequency.exponentialRampToValueAtTime(centerFormant * 0.72, now + 4.8);
    jawari.Q.value = isLowRed ? 2.6 : 1.9;

    const sharedLfo = stringIndex % 2 === 0 ? this.zitherLfoA : this.zitherLfoB;
    const jawariLfoGain = ctx.createGain();

    jawariLfoGain.gain.value = centerFormant * 0.24;
    sharedLfo.connect(jawariLfoGain);
    jawariLfoGain.connect(jawari.frequency);

    const bodyFilter = ctx.createBiquadFilter();

    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(Math.min(4400, freq * (4.0 + vel * 1.2)), now);
    bodyFilter.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.5), now + 5.5);

    const bodyGain = ctx.createGain();

    bodyGain.gain.value = 0.48;
    const jawariGain = ctx.createGain();

    jawariGain.gain.value = 0.36;

    oscA.connect(jawari);
    oscB.connect(jawari);
    oscA.connect(bodyFilter);
    oscB.connect(bodyFilter);

    jawari.connect(jawariGain);
    bodyFilter.connect(bodyGain);
    jawariGain.connect(voiceGain);
    bodyGain.connect(voiceGain);

    // Delayed Aeolian harp harmonic wind-bloom
    const aeolianOsc = ctx.createOscillator();

    aeolianOsc.type = 'sine';
    const harmonicMult = isLowRed ? 3.0 : 2.0;

    aeolianOsc.frequency.setValueAtTime(freq * harmonicMult, now);

    const aeolianGain = ctx.createGain();

    aeolianGain.gain.setValueAtTime(0.0001, now);
    aeolianGain.gain.linearRampToValueAtTime(0.14 * Math.min(1.15, vel), now + 0.55);
    aeolianGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.4);

    aeolianOsc.connect(aeolianGain);
    aeolianGain.connect(voiceGain);

    // Smooth-fade-in silk pluck transient routed through bodyFilter (saves a dedicated filter!)
    const pluckSrc = ctx.createBufferSource();

    pluckSrc.buffer = this.pluckNoiseBuffer;
    const pluckGain = ctx.createGain();

    pluckGain.gain.value = 0.16 * Math.min(1.2, vel);
    pluckSrc.connect(pluckGain);
    pluckGain.connect(bodyFilter);

    const decayTime = isLowRed ? 6.8 : 5.4;
    const peakGain = (isLowRed ? 0.21 : 0.17) * dynVel;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + 0.022);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);

    oscA.start(now);
    oscB.start(now);
    aeolianOsc.start(now);
    pluckSrc.start(now);

    const stopTime = now + decayTime + 0.12;

    oscA.stop(stopTime);
    oscB.stop(stopTime);
    aeolianOsc.stop(stopTime);

    const voice: ActiveZitherVoice = {
      stringIndex,
      isLowRed,
      oscA,
      oscB,
      aeolianOsc,
      harmonicMult,
      voiceGain,
      cleanedUp: false,
      cleanup: () => {
        if (voice.cleanedUp) return;

        voice.cleanedUp = true;

        try {
          sharedLfo.disconnect(jawariLfoGain);
        } catch {
          // Already disconnected
        }

        const nodes: AudioNode[] = [
          oscA,
          oscB,
          aeolianOsc,
          pluckSrc,
          jawariLfoGain,
          jawari,
          bodyFilter,
          bodyGain,
          jawariGain,
          aeolianGain,
          pluckGain,
          voiceGain,
        ];

        for (const node of nodes) {
          try {
            node.disconnect();
          } catch {
            // Already disconnected
          }
        }
      },
    };

    this.activeZitherVoices.push(voice);

    oscA.onended = () => {
      const idx = this.activeZitherVoices.indexOf(voice);

      if (idx !== -1) this.activeZitherVoices.splice(idx, 1);

      voice.cleanup();
    };
  }

  private fadeOutZitherVoice(voice: ActiveZitherVoice, fadeSec = 0.08): void {
    if (!this.ctx || voice.cleanedUp) return;

    const now = this.ctx.currentTime;

    try {
      holdAudioParam(voice.voiceGain.gain, now);
      voice.voiceGain.gain.setTargetAtTime(0.0001, now, fadeSec * 0.35);
      const stopAt = now + fadeSec + 0.04;

      voice.oscA.stop(stopAt);
      voice.oscB.stop(stopAt);
      voice.aeolianOsc.stop(stopAt);
    } catch {
      voice.cleanup();
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

    this.setMorph(this.padNormalizedX, true);

    for (let i = 0; i < 5; i++) {
      const osc = this.padHarmonics[i];

      holdAudioParam(osc.frequency, now);
      osc.frequency.setValueAtTime(freq * (i + 1), now);
    }

    holdAudioParam(this.padEnvGain.gain, now);
    this.padEnvGain.gain.linearRampToValueAtTime(0.22, now + 0.032);
    this.padAttackEndTime = now + 0.036;
    this.lastPadGainTarget = 0.22;

    holdAudioParam(this.padBendGain.gain, now);
    this.padBendGain.gain.setTargetAtTime(1.0, now, 0.03);
  }

  /**
   * Drag/Bend/Vibrato on Melody Pad:
   * - X controls harmonic morph (low whine <-> high theremin whistle)
   * - Y bends up to 1 scale tone above/below with smooth lyrical feel
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

    this.padVibratoEnergy = Math.min(1, this.padVibratoEnergy + motionEnergy * 2.6);

    this.setMorph(this.padNormalizedX);

    for (let i = 0; i < 5; i++) {
      this.padHarmonics[i].frequency.setTargetAtTime(freq * (i + 1), now, 0.048);
    }

    // Smooth single-target bend expression (never schedules overlapping future events!)
    this.padBendGain.gain.setTargetAtTime(isBending ? 0.94 : 1.02, now, 0.12);
  }

  padUp(): void {
    if (!this.ctx || !this.padActive) return;

    const now = this.ctx.currentTime;

    this.padActive = false;
    this.padSustainSec = 0;

    holdAudioParam(this.padEnvGain.gain, now);
    this.padEnvGain.gain.setTargetAtTime(0.0001, now, 0.24);
    this.lastPadGainTarget = 0.0001;
  }

  getTelemetry(): AudioTelemetry {
    const nowMs = performance.now();
    const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - this.lastTelemetryTime) * 0.001));

    this.lastTelemetryTime = nowMs;

    // Sustain + vibrato swell volume smoothly ONLY after the initial 32ms attack finishes
    if (this.padActive && this.ctx) {
      this.padSustainSec += dtSec;
      this.padVibratoEnergy = Math.max(0, this.padVibratoEnergy * Math.pow(0.28, dtSec));

      const audioNow = this.ctx.currentTime;

      if (audioNow >= this.padAttackEndTime) {
        const sustainBoost = (1 - Math.exp(-this.padSustainSec / 1.45)) * 0.22;
        const vibratoBoost = this.padVibratoEnergy * 0.26;
        const targetGain = Math.min(0.66, 0.22 + sustainBoost + vibratoBoost);

        if (Math.abs(targetGain - this.lastPadGainTarget) > 0.005) {
          this.padEnvGain.gain.setTargetAtTime(targetGain, audioNow, 0.16);
          this.lastPadGainTarget = targetGain;
        }
      }
    } else {
      this.padVibratoEnergy = Math.max(0, this.padVibratoEnergy * Math.pow(0.15, dtSec));
    }

    const targetDensity = Math.min(1, this.activeZitherVoices.length / 7);

    this.smoothZitherDensity +=
      (targetDensity - this.smoothZitherDensity) * Math.min(1, dtSec * 1.8);

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
