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
precision mediump float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uIntensity;
uniform float uZitherEnergy;
uniform vec2 uPadPos;
uniform float uPadActive;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
    p = rot * p * 2.04 + vec2(1.7, 9.2);
    amp *= 0.50;
  }
  return value;
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
  vec2 p = vUv * aspect * 2.1;

  float t = uTime * (0.14 + uIntensity * 0.10);

  vec2 q = vec2(
    fbm(p + vec2(t * 0.45, -t * 0.55)),
    fbm(p + vec2(-t * 0.35 + 4.1, -t * 0.65 + 1.8))
  );

  vec2 r = vec2(
    fbm(p + 2.6 * q + vec2(1.7, -t * 0.42)),
    fbm(p + 2.6 * q + vec2(8.3, -t * 0.52))
  );

  float smoke = fbm(p + 2.2 * r - vec2(0.0, t * 0.35));

  float filament = smoothstep(0.42, 0.78, smoke) - smoothstep(0.68, 0.92, smoke) * 0.45;
  float wisps = smoothstep(0.32, 0.86, smoke * 0.85 + length(q) * 0.22);

  vec2 padUv = vec2(0.54 + uPadPos.x * 0.42, 0.38 + uPadPos.y * 0.56);
  float distPad = length((vUv - padUv) * aspect);
  float padGlow = exp(-distPad * 3.8) * uPadActive * (0.35 + uIntensity * 0.65);

  float vignette = 1.0 - 0.18 * length((vUv - 0.5) * 1.3);

  vec3 col = mix(uColorA, uColorB, clamp(r.y * 1.15 + filament * 0.45, 0.0, 1.0));
  col += uColorB * filament * (0.28 + uIntensity * 0.85 + uZitherEnergy * 0.35);
  col += uColorB * padGlow * 0.65;

  float baseAlpha = (0.09 + uIntensity * 0.22 + uZitherEnergy * 0.09) * wisps * vignette;
  float alpha = clamp(baseAlpha + padGlow * 0.16, 0.0, 0.48);

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

interface UniformLocations {
  uTime: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uColorA: WebGLUniformLocation | null;
  uColorB: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
  uZitherEnergy: WebGLUniformLocation | null;
  uPadPos: WebGLUniformLocation | null;
  uPadActive: WebGLUniformLocation | null;
}

export class SmokeShader {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: UniformLocations | null = null;
  private currentColorA: RgbTuple = [0.1, 0.56, 0.96];
  private currentColorB: RgbTuple = [0.3, 0.94, 1.0];
  private targetColorA: RgbTuple = [0.1, 0.56, 0.96];
  private targetColorB: RgbTuple = [0.3, 0.94, 1.0];
  private startTime = performance.now();

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
      powerPreference: 'low-power',
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
      uTime: gl.getUniformLocation(program, 'uTime'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uColorA: gl.getUniformLocation(program, 'uColorA'),
      uColorB: gl.getUniformLocation(program, 'uColorB'),
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
      uZitherEnergy: gl.getUniformLocation(program, 'uZitherEnergy'),
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

    for (let i = 0; i < 3; i++) {
      this.currentColorA[i] += (this.targetColorA[i] - this.currentColorA[i]) * 0.045;
      this.currentColorB[i] += (this.targetColorB[i] - this.currentColorB[i]) * 0.045;
    }

    const elapsed = (performance.now() - this.startTime) * 0.001;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(this.uniforms.uTime, elapsed);
    gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform3fv(this.uniforms.uColorA, this.currentColorA);
    gl.uniform3fv(this.uniforms.uColorB, this.currentColorB);
    gl.uniform1f(this.uniforms.uIntensity, telemetry.melodyIntensity);
    gl.uniform1f(this.uniforms.uZitherEnergy, telemetry.zitherEnergy);
    gl.uniform2f(this.uniforms.uPadPos, telemetry.padX, telemetry.padY);
    gl.uniform1f(this.uniforms.uPadActive, telemetry.padActive ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
