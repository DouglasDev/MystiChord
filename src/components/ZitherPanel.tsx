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

/**
 * Trapezoidal geometry: thinner at the top, wider at the bottom,
 * with the left edge angled inwards from bottom-left up to top-right-ish.
 */
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

export function ZitherPanel({ tunings, auraRgb, auraHex, onPluck }: ZitherPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stringsRef = useRef<ZitherStringVisual[]>([]);
  const pointersRef = useRef<Map<number, PointerState>>(new Map());
  const auraRef = useRef<{ rgb: [number, number, number]; hex: string }>({
    rgb: [76, 240, 255],
    hex: '#2caeff',
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

      ctx.clearRect(0, 0, w, h);

      // Carved trapezoidal soundbox cavity recessed into the single red-wood slab
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

      cavityGrad.addColorStop(0, 'rgba(18, 5, 5, 0.86)');
      cavityGrad.addColorStop(0.55, 'rgba(28, 8, 8, 0.78)');
      cavityGrad.addColorStop(1, 'rgba(12, 3, 4, 0.90)');
      ctx.fillStyle = cavityGrad;
      ctx.fill();

      // Engraved brass rim around trapezoidal board
      ctx.strokeStyle = 'rgba(218, 174, 96, 0.52)';
      ctx.lineWidth = 1.6 * dpr;
      ctx.stroke();

      // Clip interior for rosette and inner shadow
      ctx.clip();

      const holeCx = (bounds.topLeftX + bounds.bottomLeftX) * 0.25 + bounds.rightX * 0.56;
      const holeCy = h * 0.54;
      const holeR = Math.min(w, h) * 0.24;

      const holeGrad = ctx.createRadialGradient(holeCx, holeCy, holeR * 0.1, holeCx, holeCy, holeR);

      holeGrad.addColorStop(0, 'rgba(5, 1, 2, 0.92)');
      holeGrad.addColorStop(0.75, 'rgba(14, 4, 4, 0.65)');
      holeGrad.addColorStop(1, 'rgba(28, 8, 8, 0)');
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(holeCx, holeCy, holeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(212, 166, 86, 0.32)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.arc(holeCx, holeCy, holeR * 0.84, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.2)`;
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([4 * dpr, 5 * dpr]);
      ctx.beginPath();
      ctx.arc(holeCx, holeCy, holeR * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Angled left brass bridge + vertical right brass bridge
      ctx.strokeStyle = 'rgba(218, 174, 94, 0.62)';
      ctx.lineWidth = 2.6 * dpr;
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
          // Lowest 3 strings: dark crimson red with golden sparkles
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
          // Upper strings: brilliant glittering white-gold
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

        // Animated golden sparkles (low 3 red strings) / glittering white-gold sparkles (upper strings)
        for (const sp of s.sparkles) {
          sp.t = (sp.t + dtSec * sp.speed * (1 + s.glow * 2.2)) % 1;
          sp.phase += dtSec * (4.5 + s.glow * 9);
          const twinkle = 0.5 + 0.5 * Math.sin(sp.phase);
          const alpha = (0.28 + twinkle * 0.65) * (s.isLowRed ? 0.85 : 0.95) + s.glow * 0.25;

          // Evaluate quadratic Bezier point along vibrating string
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

        // Tuning peg dot on right bridge
        ctx.fillStyle = s.glow > 0.1 ? auraRef.current.hex : 'rgba(226, 184, 102, 0.82)';
        ctx.beginPath();
        ctx.arc(endX, y, (s.isLowRed ? 3.2 : 2.4) * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Obscure Ancient Greek pitch glyph etched outside the angled left edge
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
