import type { AudioTelemetry } from './audioEngine';
import type { RgbTuple } from './musicTheory';

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;

uniform float uDrift;
uniform float uSwirl;
uniform vec2 uResolution;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uDensity;
uniform float uTurbulence;
uniform vec2 uPadPos;
uniform float uPadActive;

// Mobile GPU-safe hash (avoids sin() precision overflow on Adreno/Mali/Apple GPUs)
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.52;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    value += amp * noise(p);
    p = rot * p * 2.02 + vec2(1.7, 9.2);
    amp *= 0.50;
  }
  return value;
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
  vec2 p = vUv * aspect * 2.0;

  // Smoothly integrated phases (uDrift, uSwirl) never jump or shake
  float warpAmp = mix(1.25, 2.55, uTurbulence);

  vec2 q = vec2(
    fbm(p + vec2(uDrift * 0.42, -uDrift * 0.55)),
    fbm(p + vec2(-uDrift * 0.32 + 4.1, -uDrift * 0.62 + 1.8))
  );

  vec2 r = vec2(
    fbm(p + warpAmp * q + vec2(1.7 + uSwirl * 0.35, -uSwirl * 0.48)),
    fbm(p + warpAmp * q + vec2(8.3 - uSwirl * 0.28, -uSwirl * 0.54))
  );

  float smoke = fbm(p + (1.35 + uTurbulence * 0.9) * r - vec2(0.0, uDrift * 0.32));

  float cloudFloor = mix(0.42, 0.20, uDensity);
  float wisps = smoothstep(cloudFloor, 0.86, smoke * 0.86 + length(q) * 0.18);
  float filament = smoothstep(0.46, 0.78, smoke) - smoothstep(0.72, 0.94, smoke) * 0.4;

  // Subtle localized glow near active melody pad touch
  vec2 padUv = vec2(0.52 + uPadPos.x * 0.44, 0.42 + uPadPos.y * 0.52);
  float distPad = length((vUv - padUv) * aspect);
  float padGlow = exp(-distPad * 3.6) * uPadActive * (0.22 + uTurbulence * 0.38);

  vec3 col = mix(uColorA, uColorB, clamp(r.y * 1.1 + filament * 0.45, 0.0, 1.0));
  col += uColorB * filament * (0.26 + uDensity * 0.55 + uTurbulence * 0.5);
  col += uColorB * padGlow * 0.55;

  float baseAlpha = (0.12 + uDensity * 0.28 + uTurbulence * 0.12) * wisps;
  float alpha = clamp(baseAlpha + padGlow * 0.16, 0.0, 0.56);

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

interface UniformLocations {
  uDrift: WebGLUniformLocation | null;
  uSwirl: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uColorA: WebGLUniformLocation | null;
  uColorB: WebGLUniformLocation | null;
  uDensity: WebGLUniformLocation | null;
  uTurbulence: WebGLUniformLocation | null;
  uPadPos: WebGLUniformLocation | null;
  uPadActive: WebGLUniformLocation | null;
}

export class SmokeShader {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: UniformLocations | null = null;
  private currentColorA: RgbTuple = [0.1, 0.56, 0.96];
  private currentColorB: RgbTuple = [0.34, 0.92, 1.0];
  private targetColorA: RgbTuple = [0.1, 0.56, 0.96];
  private targetColorB: RgbTuple = [0.34, 0.92, 1.0];

  private lastTime = performance.now();
  private driftPhase = 0;
  private swirlPhase = 0;
  private smoothDensity = 0;
  private smoothTurbulence = 0;
  private smoothPadActive = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.init();
  }

  private init(): void {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'default',
    });

    if (!gl) return;

    this.gl = gl;

    const vs = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vs || !fs) return;

    const program = gl.createProgram();

    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('SmokeShader link error:', gl.getProgramInfoLog(program));

      return;
    }

    this.program = program;
    gl.useProgram(program);

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const posLoc = gl.getAttribLocation(program, 'aPosition');

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      uDrift: gl.getUniformLocation(program, 'uDrift'),
      uSwirl: gl.getUniformLocation(program, 'uSwirl'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uColorA: gl.getUniformLocation(program, 'uColorA'),
      uColorB: gl.getUniformLocation(program, 'uColorB'),
      uDensity: gl.getUniformLocation(program, 'uDensity'),
      uTurbulence: gl.getUniformLocation(program, 'uTurbulence'),
      uPadPos: gl.getUniformLocation(program, 'uPadPos'),
      uPadActive: gl.getUniformLocation(program, 'uPadActive'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
  }

  private compile(type: number, source: string): WebGLShader | null {
    const gl = this.gl;

    if (!gl) return null;

    const shader = gl.createShader(type);

    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('SmokeShader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);

      return null;
    }

    return shader;
  }

  setTargetColors(primary: RgbTuple, secondary: RgbTuple): void {
    this.targetColorA = [...primary];
    this.targetColorB = [...secondary];
  }

  resize(): void {
    if (!this.gl) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  render(telemetry: AudioTelemetry): void {
    if (!this.gl || !this.program || !this.uniforms) return;

    const gl = this.gl;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) * 0.001));

    this.lastTime = now;

    // Smoothly interpolate parameters so motion is always fluid and never shakey
    const colorLerp = Math.min(1, dt * 3.0);

    for (let i = 0; i < 3; i++) {
      this.currentColorA[i] += (this.targetColorA[i] - this.currentColorA[i]) * colorLerp;
      this.currentColorB[i] += (this.targetColorB[i] - this.currentColorB[i]) * colorLerp;
    }

    this.smoothDensity += (telemetry.zitherDensity - this.smoothDensity) * Math.min(1, dt * 2.0);

    this.smoothTurbulence +=
      (telemetry.padTurbulence - this.smoothTurbulence) * Math.min(1, dt * 2.4);

    this.smoothPadActive +=
      ((telemetry.padActive ? 1 : 0) - this.smoothPadActive) * Math.min(1, dt * 4.0);

    // Monotonic phase integration prevents any jump or shake when turbulence changes
    this.driftPhase += dt * (0.14 + this.smoothTurbulence * 0.16);
    this.swirlPhase += dt * (0.1 + this.smoothTurbulence * 0.28);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(this.uniforms.uDrift, this.driftPhase);
    gl.uniform1f(this.uniforms.uSwirl, this.swirlPhase);
    gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform3fv(this.uniforms.uColorA, this.currentColorA);
    gl.uniform3fv(this.uniforms.uColorB, this.currentColorB);
    gl.uniform1f(this.uniforms.uDensity, this.smoothDensity);
    gl.uniform1f(this.uniforms.uTurbulence, this.smoothTurbulence);
    gl.uniform2f(this.uniforms.uPadPos, telemetry.padX, telemetry.padY);
    gl.uniform1f(this.uniforms.uPadActive, this.smoothPadActive);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
