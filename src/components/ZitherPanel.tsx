import { styled } from '@linaria/react';
import { useEffect, useRef } from 'react';
import type { RgbTuple, ZitherStringTuning } from '../musicTheory';

const ZitherArea = styled.section`
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
`;

const ZitherCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
`;

interface StringSparkle {
  t: number;
  speed: number;
  phase: number;
  size: number;
}

interface ZitherStringVisual extends ZitherStringTuning {
  amp: number;
  glow: number;
  phase: number;
  pluckX: number;
  sparkles: StringSparkle[];
}

interface PointerState {
  x: number;
  y: number;
  time: number;
}

export interface ZitherPanelProps {
  tunings: readonly ZitherStringTuning[];
  auraRgb: RgbTuple;
  auraHex: string;
  onPluck: (stringInfo: ZitherStringTuning, velocity: number) => void;
}

function createSparkles(count: number): StringSparkle[] {
  return Array.from({ length: count }, (_, idx) => ({
    t: (idx + Math.random() * 0.6) / count,
    speed: 0.04 + Math.random() * 0.07,
    phase: Math.random() * Math.PI * 2,
    size: 1.1 + Math.random() * 1.4,
  }));
}

function getStringY(index: number, count: number, height: number): number {
  const padTop = height * 0.1;
  const padBottom = height * 0.1;
  const usable = height - padTop - padBottom;
  const norm = 1 - index / Math.max(1, count - 1);

  return padTop + norm * usable;
}

function getBoardBounds(w: number, h: number) {
  const topY = h * 0.04;
  const bottomY = h * 0.96;
  const rightX = w * 0.95;
  const topLeftX = w * 0.36;
  const bottomLeftX = w * 0.11;

  const leftAtY = (y: number) => {
    const frac = Math.max(0, Math.min(1, (y - topY) / Math.max(1, bottomY - topY)));

    return topLeftX + (bottomLeftX - topLeftX) * frac;
  };

  return { topY, bottomY, rightX, topLeftX, bottomLeftX, leftAtY };
}

function drawSoftPlume(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / Math.max(1, rx));

  const grad = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);

  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);

  grad.addColorStop(
    0.55,
    `rgba(${Math.round(r * 0.55)}, ${Math.round(g * 0.45)}, ${Math.round(b * 0.55)}, ${alpha * 0.42})`,
  );

  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSoundHoleFlameAndEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rInner: number,
  flameIntensity: number,
  eyeOpenness: number,
  time: number,
  auraRgb: [number, number, number],
  dpr: number,
) {
  const [ar, ag, ab] = auraRgb;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rInner - 0.5 * dpr, 0, Math.PI * 2);
  ctx.clip();

  // Deep obsidian void inside the hole
  const voidGrad = ctx.createRadialGradient(cx, cy, rInner * 0.08, cx, cy, rInner);

  voidGrad.addColorStop(0, 'rgba(5, 1, 2, 0.98)');
  voidGrad.addColorStop(1, 'rgba(2, 0, 1, 0.97)');
  ctx.fillStyle = voidGrad;
  ctx.fillRect(cx - rInner, cy - rInner, rInner * 2, rInner * 2);

  // Subtle smoky dark flame triggered by sustained strumming of the bottom 3 strings
  if (flameIntensity > 0.015) {
    const f = Math.min(1, flameIntensity);
    const emberR = Math.round(ar * 0.48 + 78);
    const emberG = Math.round(ag * 0.28 + 18);
    const emberB = Math.round(ab * 0.42 + 24);

    for (let p = 0; p < 5; p++) {
      const cycle = (time * (0.28 + p * 0.05) + p * 0.21) % 1;
      const sway = Math.sin(time * (1.2 + p * 0.35) + p * 2.1) * rInner * (0.14 + cycle * 0.16);
      const py = cy + rInner * (0.72 - cycle * (0.95 + f * 0.55));
      const rx = rInner * (0.34 + (1 - cycle) * 0.22);
      const ry = rInner * (0.48 + cycle * 0.38);
      const fade = Math.sin(cycle * Math.PI);
      const alpha = f * fade * 0.26;

      drawSoftPlume(ctx, cx + sway, py, rx, ry, emberR, emberG, emberB, alpha);
    }

    const flicker = 0.85 + 0.15 * Math.sin(time * 3.1) * Math.cos(time * 1.9);

    drawSoftPlume(
      ctx,
      cx + Math.sin(time * 1.8) * rInner * 0.06,
      cy + rInner * 0.34,
      rInner * 0.42,
      rInner * 0.56,
      Math.round(ar * 0.55 + 95),
      Math.round(ag * 0.4 + 42),
      Math.round(ab * 0.45 + 32),
      f * 0.3 * flicker,
    );
  }

  // Ghostly, dimly luminous mystical eye triggered by sustained strumming of the upper 5 strings
  if (eyeOpenness > 0.015) {
    const o = Math.min(1, eyeOpenness);
    const eyeW = rInner * 0.68;
    const lidOpen = rInner * 0.4 * o;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - eyeW, cy);
    ctx.quadraticCurveTo(cx, cy - lidOpen * 1.4, cx + eyeW, cy);
    ctx.quadraticCurveTo(cx, cy + lidOpen * 1.4, cx - eyeW, cy);
    ctx.closePath();

    const scleraGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, eyeW);

    scleraGrad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${o * 0.16})`);
    scleraGrad.addColorStop(0.65, `rgba(18, 6, 10, ${o * 0.42})`);
    scleraGrad.addColorStop(1, `rgba(4, 1, 2, ${o * 0.85})`);
    ctx.fillStyle = scleraGrad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    const irisR = rInner * 0.32;
    const irisGrad = ctx.createRadialGradient(cx, cy, irisR * 0.1, cx, cy, irisR);

    irisGrad.addColorStop(0, `rgba(220, 186, 124, ${o * 0.46})`);
    irisGrad.addColorStop(0.5, `rgba(${ar}, ${ag}, ${ab}, ${o * 0.42})`);
    irisGrad.addColorStop(1, 'rgba(8, 2, 5, 0)');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${o * 0.22})`;
    ctx.lineWidth = 0.65 * dpr;

    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + time * 0.08;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * irisR * 0.32, cy + Math.sin(a) * irisR * 0.32);
      ctx.lineTo(cx + Math.cos(a) * irisR * 0.92, cy + Math.sin(a) * irisR * 0.92);
      ctx.stroke();
    }

    const pupilW = irisR * (0.19 + 0.06 * Math.sin(time * 1.6));
    const pupilH = irisR * 0.82;

    ctx.fillStyle = `rgba(3, 1, 2, ${0.78 + o * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, pupilW, pupilH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = `rgba(218, 184, 128, ${o * 0.32})`;
    ctx.lineWidth = 0.9 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx - eyeW, cy);
    ctx.quadraticCurveTo(cx, cy - lidOpen * 1.4, cx + eyeW, cy);
    ctx.quadraticCurveTo(cx, cy + lidOpen * 1.4, cx - eyeW, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

export function ZitherPanel({ tunings, auraRgb, auraHex, onPluck }: ZitherPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stringsRef = useRef<ZitherStringVisual[]>([]);
  const pointersRef = useRef<Map<number, PointerState>>(new Map());
  const auraRef = useRef<{ rgb: [number, number, number]; hex: string }>({
    rgb: [76, 240, 255],
    hex: '#2caeff',
  });
  const flameStateRef = useRef({
    flameEnergy: 0,
    eyeEnergy: 0,
    smoothFlame: 0,
    eyeOpenness: 0,
    time: 0,
  });
  const onPluckRef = useRef(onPluck);

  onPluckRef.current = onPluck;

  useEffect(() => {
    auraRef.current = {
      rgb: [
        Math.round(auraRgb[0] * 255),
        Math.round(auraRgb[1] * 255),
        Math.round(auraRgb[2] * 255),
      ],
      hex: auraHex,
    };

    if (stringsRef.current.length !== tunings.length) {
      stringsRef.current = tunings.map((t) => ({
        ...t,
        amp: 0,
        glow: 0,
        phase: Math.random() * Math.PI * 2,
        pluckX: 0.5,
        sparkles: createSparkles(t.isLowRed ? 9 : 11),
      }));
    } else {
      tunings.forEach((t, i) => {
        const s = stringsRef.current[i];

        s.midi = t.midi;
        s.freq = t.freq;
        s.glyph = t.glyph;
        s.isLowRed = t.isLowRed;
        s.glow = Math.max(s.glow, 0.45);
      });
    }
  }, [tunings, auraRgb, auraHex]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const localCoords = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, rect.width);

      return {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      };
    };

    const triggerString = (index: number, velocity: number, xPx: number, yPx: number) => {
      const s = stringsRef.current[index];

      if (!s) return;

      const bounds = getBoardBounds(canvas.width, canvas.height);
      const lx = bounds.leftAtY(yPx);
      const normX = Math.max(0.08, Math.min(0.92, (xPx - lx) / Math.max(1, bounds.rightX - lx)));

      s.amp = Math.min(1.0, Math.max(s.amp * 0.6, velocity));
      s.glow = 1.0;
      s.pluckX = normX;

      if (s.isLowRed) {
        flameStateRef.current.flameEnergy = Math.min(
          1.35,
          flameStateRef.current.flameEnergy + 0.085 * velocity,
        );
      } else {
        flameStateRef.current.eyeEnergy = Math.min(
          1.35,
          flameStateRef.current.eyeEnergy + 0.075 * velocity,
        );
      }

      onPluckRef.current(s, velocity);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const pos = localCoords(e);

      pointersRef.current.set(e.pointerId, { x: pos.x, y: pos.y, time: performance.now() });

      const strings = stringsRef.current;
      let bestIdx = -1;
      let bestDist = Infinity;
      const maxDist = (canvas.height / Math.max(1, strings.length)) * 0.65;

      for (let i = 0; i < strings.length; i++) {
        const sy = getStringY(i, strings.length, canvas.height);
        const d = Math.abs(sy - pos.y);

        if (d < bestDist && d <= maxDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        triggerString(bestIdx, 0.78, pos.x, pos.y);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointersRef.current.get(e.pointerId);

      if (!prev) return;

      e.preventDefault();
      const curr = localCoords(e);
      const now = performance.now();
      const dt = Math.max(4, now - prev.time);
      const speed = Math.abs(curr.y - prev.y) / dt;
      const velocity = Math.max(0.42, Math.min(1.0, 0.45 + speed * 0.65));

      const minY = Math.min(prev.y, curr.y);
      const maxY = Math.max(prev.y, curr.y);
      const strings = stringsRef.current;

      for (let i = 0; i < strings.length; i++) {
        const sy = getStringY(i, strings.length, canvas.height);

        if (
          (prev.y < sy && curr.y >= sy) ||
          (prev.y > sy && curr.y <= sy) ||
          (sy >= minY && sy <= maxY && Math.abs(curr.y - prev.y) > 1.5)
        ) {
          triggerString(i, velocity, curr.x, sy);
        }
      }

      pointersRef.current.set(e.pointerId, { x: curr.x, y: curr.y, time: now });
    };

    const onPointerRelease = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
    };

    resize();
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerRelease);
    canvas.addEventListener('pointercancel', onPointerRelease);
    window.addEventListener('resize', resize);

    let rafId = 0;
    let lastTime = performance.now();

    const draw = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));

      lastTime = now;

      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const [ar, ag, ab] = auraRef.current.rgb;
      const bounds = getBoardBounds(w, h);

      // Update flame (bottom 3 strings) & mystical eye (upper 5 strings) with slow, gradual buildup
      const fs = flameStateRef.current;

      fs.time += dtSec;
      fs.flameEnergy = Math.max(0, fs.flameEnergy * Math.pow(0.66, dtSec));
      fs.eyeEnergy = Math.max(0, fs.eyeEnergy * Math.pow(0.68, dtSec));

      const targetFlame = fs.flameEnergy > 0.34 ? Math.min(1, (fs.flameEnergy - 0.34) / 0.82) : 0;
      const flameSpeed = targetFlame > fs.smoothFlame ? 0.75 : 0.45;

      fs.smoothFlame += (targetFlame - fs.smoothFlame) * Math.min(1, dtSec * flameSpeed);

      const eyeTarget = fs.eyeEnergy > 0.52 ? Math.min(1, (fs.eyeEnergy - 0.52) / 0.72) : 0;
      const eyeSpeed = eyeTarget > fs.eyeOpenness ? 0.55 : 0.38;

      fs.eyeOpenness += (eyeTarget - fs.eyeOpenness) * Math.min(1, dtSec * eyeSpeed);

      ctx.clearRect(0, 0, w, h);

      // Carved trapezoidal recessed soundbox (no light tan border)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bounds.topLeftX, bounds.topY);
      ctx.lineTo(bounds.rightX, bounds.topY);
      ctx.lineTo(bounds.rightX, bounds.bottomY);
      ctx.lineTo(bounds.bottomLeftX, bounds.bottomY);
      ctx.closePath();

      const cavityGrad = ctx.createLinearGradient(
        bounds.topLeftX,
        bounds.topY,
        bounds.rightX,
        bounds.bottomY,
      );

      cavityGrad.addColorStop(0, 'rgba(14, 3, 4, 0.86)');
      cavityGrad.addColorStop(0.55, 'rgba(22, 6, 7, 0.78)');
      cavityGrad.addColorStop(1, 'rgba(9, 2, 3, 0.90)');
      ctx.fillStyle = cavityGrad;
      ctx.fill();

      // Subtle dark carved recess edge
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      ctx.clip();

      // Sound-hole center and radii
      const holeCx = (bounds.topLeftX + bounds.bottomLeftX) * 0.25 + bounds.rightX * 0.56;
      const holeCy = h * 0.54;
      const holeR = Math.min(w, h) * 0.26;
      const rOuter = holeR * 0.9;
      const rInner = holeR * 0.6;
      const rMid = (rOuter + rInner) * 0.5;

      // Dark flame + opening mystical eye inside the inner hole
      drawSoundHoleFlameAndEye(
        ctx,
        holeCx,
        holeCy,
        rInner,
        fs.smoothFlame,
        fs.eyeOpenness,
        fs.time,
        auraRef.current.rgb,
        dpr,
      );

      // Subtle geometric lattice between inner ring and outer ring
      const latticeSegments = 16;
      const latticeAlpha = 0.22 + fs.smoothFlame * 0.2;

      ctx.strokeStyle = `rgba(182, 138, 76, ${latticeAlpha})`;
      ctx.lineWidth = 0.9 * dpr;
      ctx.beginPath();

      for (let k = 0; k < latticeSegments; k++) {
        const a0 = (k / latticeSegments) * Math.PI * 2;
        const aMid = ((k + 0.5) / latticeSegments) * Math.PI * 2;
        const a1 = ((k + 1) / latticeSegments) * Math.PI * 2;

        // Diamond chevron zig-zag between inner and outer rings
        ctx.moveTo(holeCx + Math.cos(a0) * rInner, holeCy + Math.sin(a0) * rInner);
        ctx.lineTo(holeCx + Math.cos(aMid) * rOuter, holeCy + Math.sin(aMid) * rOuter);
        ctx.lineTo(holeCx + Math.cos(a1) * rInner, holeCy + Math.sin(a1) * rInner);

        // Counter-chevron for delicate criss-cross lattice
        ctx.moveTo(holeCx + Math.cos(a0) * rOuter, holeCy + Math.sin(a0) * rOuter);
        ctx.lineTo(holeCx + Math.cos(aMid) * rInner, holeCy + Math.sin(aMid) * rInner);
        ctx.lineTo(holeCx + Math.cos(a1) * rOuter, holeCy + Math.sin(a1) * rOuter);
      }

      ctx.stroke();

      // Delicate mid-ring thread through lattice intersections
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.12 + fs.smoothFlame * 0.16})`;
      ctx.lineWidth = 0.75 * dpr;
      ctx.beginPath();
      ctx.arc(holeCx, holeCy, rMid, 0, Math.PI * 2);
      ctx.stroke();

      // Solid outer ring
      ctx.strokeStyle = `rgba(196, 152, 86, ${0.32 + fs.smoothFlame * 0.16})`;
      ctx.lineWidth = 1.3 * dpr;
      ctx.beginPath();
      ctx.arc(holeCx, holeCy, rOuter, 0, Math.PI * 2);
      ctx.stroke();

      // Solid inner ring
      ctx.strokeStyle = `rgba(${Math.round(168 + (ar - 168) * fs.smoothFlame * 0.5)}, ${Math.round(126 + (ag - 126) * fs.smoothFlame * 0.5)}, ${Math.round(72 + (ab - 72) * fs.smoothFlame * 0.5)}, ${0.4 + fs.smoothFlame * 0.25})`;
      ctx.lineWidth = 1.25 * dpr;
      ctx.beginPath();
      ctx.arc(holeCx, holeCy, rInner, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // Angled left bronze bridge + vertical right bronze bridge
      ctx.strokeStyle = 'rgba(176, 132, 68, 0.45)';
      ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(bounds.topLeftX + 6 * dpr, bounds.topY + 6 * dpr);
      ctx.lineTo(bounds.bottomLeftX + 6 * dpr, bounds.bottomY - 6 * dpr);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bounds.rightX - 6 * dpr, bounds.topY + 6 * dpr);
      ctx.lineTo(bounds.rightX - 6 * dpr, bounds.bottomY - 6 * dpr);
      ctx.stroke();

      const fontSize = Math.max(10, Math.round(11 * dpr));

      ctx.font = `600 ${fontSize}px "GFS Neohellenic", "Uncial Antiqua", Georgia, serif`;
      ctx.textBaseline = 'middle';

      const strings = stringsRef.current;

      for (let i = 0; i < strings.length; i++) {
        const s = strings[i];
        const y = getStringY(i, strings.length, h);
        const startX = bounds.leftAtY(y) + 6 * dpr;
        const endX = bounds.rightX - 6 * dpr;

        s.phase += dtSec * (32 + i * 7);
        s.amp *= Math.pow(0.18, dtSec);
        s.glow *= Math.pow(0.3, dtSec);
        if (s.amp < 0.002) s.amp = 0;

        const disp = Math.sin(s.phase) * s.amp * (7.5 * dpr);
        const ctrlX = startX + (endX - startX) * s.pluckX;

        if (s.isLowRed) {
          if (s.glow > 0.02) {
            ctx.strokeStyle = `rgba(220, 42, 54, ${s.glow * 0.58})`;
            ctx.lineWidth = 6.5 * dpr;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.quadraticCurveTo(ctrlX, y + disp * 1.35, endX, y);
            ctx.stroke();
          }

          const redGrad = ctx.createLinearGradient(startX, y, endX, y);

          redGrad.addColorStop(0, '#6a0c15');
          redGrad.addColorStop(0.5, s.glow > 0.15 ? '#c41e2c' : '#8f131f');
          redGrad.addColorStop(1, '#5c0a12');
          ctx.strokeStyle = redGrad;
          ctx.lineWidth = (2.7 - i * 0.18) * dpr;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.quadraticCurveTo(ctrlX, y + disp, endX, y);
          ctx.stroke();
        } else {
          if (s.glow > 0.02) {
            ctx.strokeStyle = `rgba(255, 244, 200, ${s.glow * 0.7})`;
            ctx.lineWidth = 5.4 * dpr;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.quadraticCurveTo(ctrlX, y + disp * 1.35, endX, y);
            ctx.stroke();
          }

          const goldGrad = ctx.createLinearGradient(startX, y, endX, y);

          goldGrad.addColorStop(0, '#f7df9c');
          goldGrad.addColorStop(0.5, '#fffdf0');
          goldGrad.addColorStop(1, '#f3d483');
          ctx.strokeStyle = goldGrad;
          ctx.lineWidth = 1.65 * dpr;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.quadraticCurveTo(ctrlX, y + disp, endX, y);
          ctx.stroke();
        }

        for (const sp of s.sparkles) {
          sp.t = (sp.t + dtSec * sp.speed * (1 + s.glow * 2.2)) % 1;
          sp.phase += dtSec * (4.5 + s.glow * 9);
          const twinkle = 0.5 + 0.5 * Math.sin(sp.phase);
          const alpha = (0.28 + twinkle * 0.65) * (s.isLowRed ? 0.85 : 0.95) + s.glow * 0.25;

          const mt = 1 - sp.t;
          const sx = mt * mt * startX + 2 * mt * sp.t * ctrlX + sp.t * sp.t * endX;
          const sy = mt * mt * y + 2 * mt * sp.t * (y + disp) + sp.t * sp.t * y;
          const rad = sp.size * dpr * (0.7 + twinkle * 0.65 + s.glow * 0.45);

          ctx.fillStyle = s.isLowRed
            ? `rgba(255, 214, 92, ${Math.min(1, alpha)})`
            : `rgba(255, 253, 236, ${Math.min(1, alpha)})`;

          ctx.beginPath();
          ctx.arc(sx, sy, rad, 0, Math.PI * 2);
          ctx.fill();

          if (twinkle > 0.78 || s.glow > 0.35) {
            ctx.strokeStyle = s.isLowRed
              ? `rgba(255, 230, 130, ${Math.min(1, alpha * 0.8)})`
              : `rgba(255, 255, 255, ${Math.min(1, alpha * 0.85)})`;

            ctx.lineWidth = 0.85 * dpr;
            const arm = rad * 2.1;

            ctx.beginPath();
            ctx.moveTo(sx - arm, sy);
            ctx.lineTo(sx + arm, sy);
            ctx.moveTo(sx, sy - arm);
            ctx.lineTo(sx, sy + arm);
            ctx.stroke();
          }
        }

        ctx.fillStyle = s.glow > 0.1 ? auraRef.current.hex : 'rgba(204, 162, 88, 0.72)';
        ctx.beginPath();
        ctx.arc(endX, y, (s.isLowRed ? 3.2 : 2.4) * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle =
          s.glow > 0.1 ? `rgba(${ar}, ${ag}, ${ab}, 0.98)` : 'rgba(232, 198, 138, 0.78)';

        ctx.textAlign = 'right';
        ctx.fillText(s.glyph, startX - 9 * dpr, y);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerRelease);
      canvas.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <ZitherArea aria-label="Zither">
      <ZitherCanvas ref={canvasRef} data-testid="zither-canvas" />
    </ZitherArea>
  );
}
