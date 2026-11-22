import { computeMorphHarmonics, type ZitherStringTuning } from './musicTheory';

export interface AudioTelemetry {
  melodyIntensity: number;
  zitherEnergy: number;
  padActive: boolean;
  padX: number;
  padY: number;
}

interface ActiveZitherVoice {
  stringIndex: number;
  isDrone: boolean;
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  aeolianOsc: OscillatorNode;
  harmonicMult: number;
  voiceGain: GainNode;
}

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
  private morph = 0.25;
  private activeZitherVoices: ActiveZitherVoice[] = [];
  private padActive = false;
  private padNormalizedX = 0.5;
  private padNormalizedY = 0.5;
  private zitherEnergy = 0;
  private melodyEnergy = 0;

  private masterInput!: GainNode;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private pluckNoiseBuffer!: AudioBuffer;

  private padHarmonics: OscillatorNode[] = [];
  private padHarmonicGains: GainNode[] = [];
  private vibratoOsc!: OscillatorNode;
  private vibratoGain!: GainNode;
  private padFormant!: BiquadFilterNode;
  private padLowpass!: BiquadFilterNode;
  private padBendGain!: GainNode;
  private padEnvGain!: GainNode;

  async ensureStarted(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.buildGraph();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
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

    reverbSend.gain.value = 0.52;

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

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;
    this.analyserData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));

    this.masterInput.connect(shaper);
    shaper.connect(dryGain);
    shaper.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(reverbFilter);

    dryGain.connect(compressor);
    reverbFilter.connect(compressor);
    compressor.connect(this.analyser);
    this.analyser.connect(ctx.destination);

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

    const baseLp = 1400 + this.morph * 3800 + this.padNormalizedX * 1400;

    this.padLowpass.frequency.setTargetAtTime(baseLp, now, 0.05);

    this.vibratoOsc.frequency.setTargetAtTime(params.vibratoRateHz, now, 0.05);
    this.vibratoGain.gain.setTargetAtTime(params.vibratoDepthCents, now, 0.05);
  }

  pluckString(stringIndex: number, freq: number, velocity = 0.8, isDrone = false): void {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vel = Math.max(0.25, Math.min(1.0, velocity));

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
    const centerFormant = Math.min(4200, freq * (isDrone ? 4.2 : 2.8));

    jawari.frequency.setValueAtTime(centerFormant * 1.35, now);
    jawari.frequency.exponentialRampToValueAtTime(centerFormant * 0.72, now + 4.8);
    jawari.Q.value = isDrone ? 3.2 : 2.2;

    const jawariLfo = ctx.createOscillator();

    jawariLfo.type = 'sine';
    jawariLfo.frequency.value = 0.35 + (stringIndex % 4) * 0.17;
    const jawariLfoGain = ctx.createGain();

    jawariLfoGain.gain.value = centerFormant * 0.28;
    jawariLfo.connect(jawariLfoGain);
    jawariLfoGain.connect(jawari.frequency);

    const bodyFilter = ctx.createBiquadFilter();

    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(Math.min(3600, freq * 5.0), now);
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
    const harmonicMult = isDrone ? 3.0 : 2.0;

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

    const decayTime = isDrone ? 7.2 : 5.6;
    const peakGain = (isDrone ? 0.22 : 0.17) * vel;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + 0.022);
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
      isDrone,
      oscA,
      oscB,
      aeolianOsc,
      harmonicMult,
      voiceGain,
    };

    this.activeZitherVoices.push(voice);
    this.zitherEnergy = Math.min(1, this.zitherEnergy + 0.35 * vel);

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

  padDown(freq: number, normalizedX: number, normalizedY: number): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    this.padActive = true;
    this.padNormalizedX = Math.max(0, Math.min(1, normalizedX));
    this.padNormalizedY = Math.max(0, Math.min(1, normalizedY));

    for (let i = 0; i < 5; i++) {
      const osc = this.padHarmonics[i];

      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(freq * (i + 1), now);
    }

    const vol = this.xToVolume(this.padNormalizedX);

    this.padEnvGain.gain.cancelScheduledValues(now);
    const currentGain = Math.max(0.0001, this.padEnvGain.gain.value);

    this.padEnvGain.gain.setValueAtTime(currentGain, now);
    this.padEnvGain.gain.linearRampToValueAtTime(vol, now + 0.032);

    this.padBendGain.gain.cancelScheduledValues(now);
    this.padBendGain.gain.setTargetAtTime(1.0, now, 0.025);

    const lp = 1500 + this.morph * 3600 + this.padNormalizedX * 1600;

    this.padLowpass.frequency.setTargetAtTime(lp, now, 0.03);
  }

  padMove(freq: number, normalizedX: number, normalizedY: number, bendDelta = 0): void {
    if (!this.ctx || !this.padActive) return;

    const now = this.ctx.currentTime;

    this.padNormalizedX = Math.max(0, Math.min(1, normalizedX));
    this.padNormalizedY = Math.max(0, Math.min(1, normalizedY));

    for (let i = 0; i < 5; i++) {
      this.padHarmonics[i].frequency.setTargetAtTime(freq * (i + 1), now, 0.048);
    }

    const vol = this.xToVolume(this.padNormalizedX);
    const isBending = Math.abs(bendDelta) > 0.003;
    const volTimeConst = isBending ? 0.16 : 0.06;

    this.padEnvGain.gain.setTargetAtTime(vol, now, volTimeConst);

    if (isBending) {
      this.padBendGain.gain.setTargetAtTime(0.86, now, 0.06);
      this.padBendGain.gain.setTargetAtTime(1.04, now + 0.07, 0.18);
    }

    const lp = 1400 + this.morph * 3700 + this.padNormalizedX * 1500;

    this.padLowpass.frequency.setTargetAtTime(lp, now, isBending ? 0.18 : 0.07);
  }

  padUp(): void {
    if (!this.ctx || !this.padActive) return;

    const now = this.ctx.currentTime;

    this.padActive = false;

    this.padEnvGain.gain.cancelScheduledValues(now);
    this.padEnvGain.gain.setValueAtTime(Math.max(0.0001, this.padEnvGain.gain.value), now);
    this.padEnvGain.gain.setTargetAtTime(0.0001, now, 0.24);
  }

  private xToVolume(x: number): number {
    return 0.045 + Math.pow(x, 1.45) * 0.44;
  }

  getTelemetry(): AudioTelemetry {
    let rms = 0;

    if (this.analyser && this.analyserData) {
      this.analyser.getByteTimeDomainData(this.analyserData);
      let sumSq = 0;

      for (let i = 0; i < this.analyserData.length; i++) {
        const v = (this.analyserData[i] - 128) / 128;

        sumSq += v * v;
      }

      rms = Math.sqrt(sumSq / this.analyserData.length);
    }

    const padLevel = this.padActive ? 0.25 + this.padNormalizedX * 0.75 : 0;

    this.melodyEnergy = this.melodyEnergy * 0.9 + Math.min(1, rms * 3.8 + padLevel * 0.55) * 0.1;
    this.zitherEnergy = Math.max(0, this.zitherEnergy * 0.965);

    return {
      melodyIntensity: Math.min(1, this.melodyEnergy),
      zitherEnergy: this.zitherEnergy,
      padActive: this.padActive,
      padX: this.padNormalizedX,
      padY: this.padNormalizedY,
    };
  }
}
