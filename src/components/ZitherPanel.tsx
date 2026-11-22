import { useEffect, useRef } from 'react';
import type { RgbTuple, ZitherStringTuning } from '../musicTheory';
import {
  EtchedHint,
  EtchedTitle,
  InteractiveCanvas,
  PanelHeader,
  RecessedWell,
  WoodPanel,
} from './PanelPrimitives';

interface ZitherStringVisual extends ZitherStringTuning {
  amp: number;
  glow: number;
  phase: number;
  pluckX: number;
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

function getStringY(index: number, count: number, height: number): number {
  const padY = height * 0.12;
  const usable = height - padY * 2;
  const norm = 1 - index / Math.max(1, count - 1);

  return padY + norm * usable;
}

export function ZitherPanel({ tunings, auraRgb, auraHex, onPluck }: ZitherPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stringsRef = useRef<ZitherStringVisual[]>([]);
  const pointersRef = useRef<Map<number, PointerState>>(new Map());
  const auraRef = useRef<{ rgb: [number, number, number]; hex: string }>({
    rgb: [76, 240, 255],
    hex: '#28a8ff',
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
      }));
    } else {
      tunings.forEach((t, i) => {
        const s = stringsRef.current[i];

        s.midi = t.midi;
        s.freq = t.freq;
        s.noteName = t.noteName;
        s.isDrone = t.isDrone;
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
        normX: Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / Math.max(1, rect.width))),
      };
    };

    const triggerString = (index: number, velocity: number, normX: number) => {
      const s = stringsRef.current[index];

      if (!s) return;

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
      const maxDist = (canvas.height / Math.max(1, strings.length)) * 0.62;

      for (let i = 0; i < strings.length; i++) {
        const d = Math.abs(getStringY(i, strings.length, canvas.height) - pos.y);

        if (d < bestDist && d <= maxDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        triggerString(bestIdx, 0.78, pos.normX);
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
          triggerString(i, velocity, curr.normX);
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

      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.52;
      const cy = h * 0.5;
      const r = Math.min(w, h) * 0.28;

      ctx.save();
      const holeGrad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);

      holeGrad.addColorStop(0, 'rgba(6, 4, 2, 0.85)');
      holeGrad.addColorStop(0.75, 'rgba(14, 9, 5, 0.65)');
      holeGrad.addColorStop(1, 'rgba(42, 26, 14, 0)');
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(196, 152, 78, 0.28)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.18)`;
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([4 * dpr, 6 * dpr]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const bridgeLeft = w * 0.07;
      const bridgeRight = w * 0.93;

      ctx.fillStyle = 'rgba(168, 126, 62, 0.35)';
      ctx.fillRect(bridgeLeft - 2 * dpr, h * 0.07, 4 * dpr, h * 0.86);
      ctx.fillRect(bridgeRight - 2 * dpr, h * 0.07, 4 * dpr, h * 0.86);

      const fontSize = Math.max(9, Math.round(10 * dpr));

      ctx.font = `600 ${fontSize}px "Cinzel", Georgia, serif`;
      ctx.textBaseline = 'middle';

      const strings = stringsRef.current;

      for (let i = 0; i < strings.length; i++) {
        const s = strings[i];
        const y = getStringY(i, strings.length, h);

        s.phase += dtSec * (32 + i * 7);
        s.amp *= Math.pow(0.18, dtSec);
        s.glow *= Math.pow(0.28, dtSec);
        if (s.amp < 0.002) s.amp = 0;

        const disp = Math.sin(s.phase) * s.amp * (8 * dpr);
        const ctrlX = bridgeLeft + (bridgeRight - bridgeLeft) * s.pluckX;

        if (s.glow > 0.02) {
          ctx.save();
          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${s.glow * 0.62})`;
          ctx.lineWidth = (s.isDrone ? 6.5 : 5.0) * dpr;
          ctx.beginPath();
          ctx.moveTo(bridgeLeft, y);
          ctx.quadraticCurveTo(ctrlX, y + disp * 1.4, bridgeRight, y);
          ctx.stroke();
          ctx.restore();
        }

        const brassLight = Math.round(165 + s.glow * 90);

        ctx.strokeStyle = s.isDrone
          ? `rgb(${brassLight + 40}, ${brassLight - 12}, 92)`
          : `rgb(${brassLight + 30}, ${brassLight + 10}, ${125 + Math.round(s.glow * 110)})`;

        ctx.lineWidth = (s.isDrone ? 2.4 : 1.45) * dpr;
        ctx.beginPath();
        ctx.moveTo(bridgeLeft, y);
        ctx.quadraticCurveTo(ctrlX, y + disp, bridgeRight, y);
        ctx.stroke();

        ctx.fillStyle = s.glow > 0.1 ? auraRef.current.hex : 'rgba(204, 162, 88, 0.72)';
        ctx.beginPath();
        ctx.arc(bridgeRight, y, (s.isDrone ? 3.2 : 2.3) * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle =
          s.glow > 0.1 ? `rgba(${ar}, ${ag}, ${ab}, 0.95)` : 'rgba(212, 180, 126, 0.58)';

        ctx.textAlign = 'right';
        ctx.fillText(s.noteName, bridgeLeft - 5 * dpr, y);
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
    <WoodPanel aria-label="Aeolian Zither">
      <PanelHeader>
        <EtchedTitle>ZITHER</EtchedTitle>
        <EtchedHint>STRUM</EtchedHint>
      </PanelHeader>
      <RecessedWell>
        <InteractiveCanvas ref={canvasRef} data-testid="zither-canvas" />
      </RecessedWell>
    </WoodPanel>
  );
}
