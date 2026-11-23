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

function drawFlameTongue(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  width: number,
  height: number,
  sway: number,
) {
  ctx.beginPath();
  ctx.moveTo(cx, baseY);

  ctx.bezierCurveTo(
    cx - width,
    baseY - height * 0.25,
    cx - width * 0.65 + sway * 0.5,
    baseY - height * 0.72,
    cx + sway,
    baseY - height,
  );

  ctx.bezierCurveTo(
    cx + width * 0.65 + sway * 0.5,
    baseY - height * 0.72,
    cx + width,
    baseY - height * 0.25,
    cx,
    baseY,
  );

  ctx.closePath();
  ctx.fill();
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

  voidGrad.addColorStop(0, 'rgba(6, 1, 3, 0.98)');
  voidGrad.addColorStop(1, 'rgba(2, 0, 1, 0.96)');
  ctx.fillStyle = voidGrad;
  ctx.fillRect(cx - rInner, cy - rInner, rInner * 2, rInner * 2);

  // Dark flame that gradually appears and brightens when zither is strummed
  if (flameIntensity > 0.02) {
    const f = Math.min(1, flameIntensity);
    const baseY = cy + rInner * 0.95;

    // Ambient dark ember glow inside the void
    const emberGrad = ctx.createRadialGradient(cx, cy + rInner * 0.2, 1, cx, cy, rInner);

    emberGrad.addColorStop(
      0,
      `rgba(${Math.round(ar * 0.6 + 60)}, ${Math.round(ag * 0.35 + 14)}, ${Math.round(ab * 0.55 + 24)}, ${f * 0.42})`,
    );

    emberGrad.addColorStop(0.65, `rgba(48, 8, 16, ${f * 0.32})`);
    emberGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = emberGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    ctx.fill();

    // Outer dark shadow-flame veil
    const sway1 = Math.sin(time * 2.6) * rInner * 0.16;
    const outerH = rInner * (0.65 + f * 1.15);
    const outerGrad = ctx.createLinearGradient(cx, baseY, cx, baseY - outerH);

    outerGrad.addColorStop(0, `rgba(28, 4, 12, ${0.45 + f * 0.45})`);

    outerGrad.addColorStop(
      0.55,
      `rgba(${Math.round(ar * 0.45 + 36)}, ${Math.round(ag * 0.25 + 8)}, ${Math.round(ab * 0.45 + 22)}, ${0.32 + f * 0.52})`,
    );

    outerGrad.addColorStop(1, 'rgba(18, 2, 8, 0)');
    ctx.fillStyle = outerGrad;
    drawFlameTongue(ctx, cx, baseY, rInner * (0.48 + f * 0.22), outerH, sway1);

    // Side dark wisps
    const swayL = Math.sin(time * 3.4 + 1.4) * rInner * 0.14;
    const swayR = Math.cos(time * 3.1 + 0.7) * rInner * 0.14;

    ctx.fillStyle = `rgba(${Math.round(ar * 0.5 + 30)}, ${Math.round(ag * 0.28 + 10)}, ${Math.round(ab * 0.5 + 26)}, ${f * 0.42})`;

    drawFlameTongue(
      ctx,
      cx - rInner * 0.22,
      baseY,
      rInner * 0.28,
      outerH * 0.76,
      swayL - rInner * 0.08,
    );

    drawFlameTongue(
      ctx,
      cx + rInner * 0.22,
      baseY,
      rInner * 0.28,
      outerH * 0.74,
      swayR + rInner * 0.08,
    );

    // Luminous inner dark-fire core
    const sway2 = Math.sin(time * 4.1 + 0.6) * rInner * 0.11;
    const innerH = rInner * (0.42 + f * 0.85);
    const innerGrad = ctx.createLinearGradient(cx, baseY, cx, baseY - innerH);

    innerGrad.addColorStop(0, `rgba(12, 2, 6, ${0.55 + f * 0.35})`);
    innerGrad.addColorStop(0.5, `rgba(${ar}, ${ag}, ${ab}, ${f * 0.62})`);
    innerGrad.addColorStop(0.85, `rgba(255, 224, 152, ${f * f * 0.55})`);
    innerGrad.addColorStop(1, 'rgba(255, 224, 152, 0)');
    ctx.fillStyle = innerGrad;
    drawFlameTongue(ctx, cx, baseY, rInner * (0.26 + f * 0.14), innerH, sway2);
  }

  // Mystical eye that appears within the flame and gradually opens on intense strumming
  if (eyeOpenness > 0.02) {
    const o = Math.min(1, eyeOpenness);
    const eyeW = rInner * 0.72;
    const lidOpen = rInner * 0.44 * o;

    ctx.save();
    // Almond aperture clip
    ctx.beginPath();
    ctx.moveTo(cx - eyeW, cy);
    ctx.quadraticCurveTo(cx, cy - lidOpen * 1.45, cx + eyeW, cy);
    ctx.quadraticCurveTo(cx, cy + lidOpen * 1.45, cx - eyeW, cy);
    ctx.closePath();

    // Soft sclera / smoky obsidian-gold eye interior
    const scleraGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, eyeW);

    scleraGrad.addColorStop(0, `rgba(255, 240, 200, ${o * 0.34})`);

    scleraGrad.addColorStop(
      0.55,
      `rgba(${Math.round(ar * 0.45)}, ${Math.round(ag * 0.45)}, ${Math.round(ab * 0.45)}, ${o * 0.48})`,
    );

    scleraGrad.addColorStop(1, `rgba(8, 2, 4, ${o * 0.9})`);
    ctx.fillStyle = scleraGrad;
    ctx.fill();

    // Clip to open eyelids for iris & pupil
    ctx.save();
    ctx.clip();

    const irisR = rInner * 0.34;
    const irisGrad = ctx.createRadialGradient(cx, cy, irisR * 0.15, cx, cy, irisR);

    irisGrad.addColorStop(0, `rgba(255, 224, 138, ${o * 0.92})`);
    irisGrad.addColorStop(0.52, `rgba(${ar}, ${ag}, ${ab}, ${o * 0.88})`);
    irisGrad.addColorStop(1, `rgba(18, 4, 10, ${o * 0.95})`);
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle iris radial striations
    ctx.strokeStyle = `rgba(255, 244, 210, ${o * 0.35})`;
    ctx.lineWidth = 0.75 * dpr;

    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + time * 0.15;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * irisR * 0.35, cy + Math.sin(a) * irisR * 0.35);
      ctx.lineTo(cx + Math.cos(a) * irisR * 0.95, cy + Math.sin(a) * irisR * 0.95);
      ctx.stroke();
    }

    // Vertical mystical slit pupil
    const pupilW = irisR * (0.22 + 0.08 * Math.sin(time * 2.2));
    const pupilH = irisR * 0.84;

    ctx.fillStyle = `rgba(4, 1, 3, ${0.85 + o * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, pupilW, pupilH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pinpoint starlight reflection
    ctx.fillStyle = `rgba(255, 253, 244, ${o * 0.92})`;
    ctx.beginPath();
    ctx.arc(cx - irisR * 0.22, cy - irisR * 0.22, 1.8 * dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Luminous eyelid contour
    ctx.strokeStyle = `rgba(255, 232, 178, ${o * 0.68})`;
    ctx.lineWidth = 1.15 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx - eyeW, cy);
    ctx.quadraticCurveTo(cx, cy - lidOpen * 1.45, cx + eyeW, cy);
    ctx.quadraticCurveTo(cx, cy + lidOpen * 1.45, cx - eyeW, cy);
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
    strumEnergy: 0,
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

      flameStateRef.current.strumEnergy = Math.min(
        1.25,
        flameStateRef.current.strumEnergy + 0.18 * velocity,
      );

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

      // Update flame & mystical eye state
      const fs = flameStateRef.current;

      fs.time += dtSec;
      fs.strumEnergy = Math.max(0, fs.strumEnergy * Math.pow(0.48, dtSec));
      const targetFlame = Math.min(1, fs.strumEnergy);

      fs.smoothFlame += (targetFlame - fs.smoothFlame) * Math.min(1, dtSec * 3.8);

      const eyeTarget = fs.strumEnergy > 0.55 ? Math.min(1, (fs.strumEnergy - 0.55) / 0.5) : 0;
      const eyeSpeed = eyeTarget > fs.eyeOpenness ? 2.1 : 1.0;

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

      ctx.font = `600 ${fontSize}px "Cinzel", Georgia, serif`;
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
