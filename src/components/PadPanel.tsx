import { styled } from '@linaria/react';
import { useEffect, useRef } from 'react';
import { computeAnchoredBend, getNoteName, yToScalePitch, type RgbTuple } from '../musicTheory';
import {
  EtchedHint,
  EtchedTitle,
  InteractiveCanvas,
  PanelHeader,
  RecessedWell,
  WoodPanel,
} from './PanelPrimitives';

const PadStage = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SquarePadWell = styled(RecessedWell)`
  flex: 0 0 auto;
  aspect-ratio: 1 / 1;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  background: radial-gradient(circle at 50% 50%, rgba(28, 22, 20, 0.94), rgba(10, 8, 8, 0.98));

  @media (orientation: portrait) and (max-width: 720px) {
    width: 100%;
    height: auto;
  }
`;

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

export interface PadPanelProps {
  padRootMidi: number;
  intervals: readonly number[];
  auraRgb: RgbTuple;
  onPadDown: (freq: number, x: number, y: number) => void;
  onPadMove: (freq: number, x: number, y: number, bendDelta: number) => void;
  onPadUp: () => void;
}

export function PadPanel({
  padRootMidi,
  intervals,
  auraRgb,
  onPadDown,
  onPadMove,
  onPadUp,
}: PadPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scaleRef = useRef<{ rootMidi: number; intervals: readonly number[]; notes: number[] }>({
    rootMidi: padRootMidi,
    intervals,
    notes: [],
  });
  const auraRef = useRef<[number, number, number]>([76, 240, 255]);
  const stateRef = useRef({
    activePointerId: null as number | null,
    anchorIndex: 0,
    anchorY: 0.5,
    lastY: 0.5,
    currentX: 0.5,
    currentY: 0.5,
    glowAlpha: 0,
    trail: [] as TrailPoint[],
  });

  const callbacksRef = useRef({ onPadDown, onPadMove, onPadUp });

  callbacksRef.current = { onPadDown, onPadMove, onPadUp };

  useEffect(() => {
    auraRef.current = [
      Math.round(auraRgb[0] * 255),
      Math.round(auraRgb[1] * 255),
      Math.round(auraRgb[2] * 255),
    ];

    const st = stateRef.current;
    const info = yToScalePitch(st.currentY, padRootMidi, intervals, 2);

    scaleRef.current = { rootMidi: padRootMidi, intervals, notes: info.notes };

    if (st.activePointerId !== null) {
      st.anchorIndex = Math.min(info.notes.length - 1, info.snappedIndex);
      st.anchorY = st.currentY;
      callbacksRef.current.onPadMove(info.snappedFreq, st.currentX, st.currentY, 0.01);
    }
  }, [padRootMidi, intervals, auraRgb]);

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

    const normCoords = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();

      return {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))),
        y: Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / Math.max(1, rect.height))),
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const st = stateRef.current;

      if (st.activePointerId !== null) return;

      st.activePointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);

      const { x, y } = normCoords(e);
      const { rootMidi, intervals: ivs } = scaleRef.current;
      const pitchInfo = yToScalePitch(y, rootMidi, ivs, 2);

      scaleRef.current.notes = pitchInfo.notes;

      st.anchorIndex = pitchInfo.snappedIndex;
      st.anchorY = y;
      st.lastY = y;
      st.currentX = x;
      st.currentY = y;
      st.glowAlpha = 1;
      st.trail = [{ x, y, life: 1.0 }];

      callbacksRef.current.onPadDown(pitchInfo.snappedFreq, x, y);
    };

    const onPointerMove = (e: PointerEvent) => {
      const st = stateRef.current;

      if (e.pointerId !== st.activePointerId) return;

      e.preventDefault();
      const { x, y } = normCoords(e);
      const deltaY = y - st.anchorY;
      const stepDelta = y - st.lastY;

      st.lastY = y;
      st.currentX = x;
      st.currentY = y;

      const bent = computeAnchoredBend(st.anchorIndex, deltaY, scaleRef.current.notes);

      st.trail.push({ x, y, life: 1.0 });
      if (st.trail.length > 26) st.trail.shift();

      callbacksRef.current.onPadMove(bent.freq, x, y, stepDelta);
    };

    const onPointerRelease = (e: PointerEvent) => {
      const st = stateRef.current;

      if (e.pointerId !== st.activePointerId) return;

      st.activePointerId = null;
      callbacksRef.current.onPadUp();
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
      const [ar, ag, ab] = auraRef.current;
      const st = stateRef.current;
      const { rootMidi, notes } = scaleRef.current;

      ctx.clearRect(0, 0, w, h);

      const volGrad = ctx.createLinearGradient(0, 0, w, 0);

      volGrad.addColorStop(0, 'rgba(0, 0, 0, 0.26)');
      volGrad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0.08)`);
      ctx.fillStyle = volGrad;
      ctx.fillRect(0, 0, w, h);

      const count = notes.length;
      const fontSize = Math.max(8, Math.round(9 * dpr));

      ctx.font = `600 ${fontSize}px "Cinzel", Georgia, serif`;
      ctx.textBaseline = 'middle';

      for (let i = 0; i < count; i++) {
        const normY = i / Math.max(1, count - 1);
        const py = h - (h * 0.08 + normY * h * 0.84);
        const isTonic = (notes[i] - rootMidi) % 12 === 0;
        const isAnchor = st.activePointerId !== null && i === st.anchorIndex;

        ctx.strokeStyle = isAnchor
          ? `rgba(${ar}, ${ag}, ${ab}, 0.72)`
          : isTonic
            ? 'rgba(218, 174, 96, 0.34)'
            : 'rgba(196, 156, 94, 0.14)';

        ctx.lineWidth = (isAnchor ? 1.8 : isTonic ? 1.2 : 0.8) * dpr;
        ctx.beginPath();
        ctx.moveTo(w * 0.08, py);
        ctx.lineTo(w * 0.94, py);
        ctx.stroke();

        if (isTonic || isAnchor) {
          ctx.fillStyle = isAnchor ? `rgba(${ar}, ${ag}, ${ab}, 0.95)` : 'rgba(218, 174, 96, 0.55)';
          ctx.textAlign = 'left';
          ctx.fillText(getNoteName(notes[i]), w * 0.025, py);
        }
      }

      if (st.activePointerId === null) {
        st.glowAlpha *= Math.pow(0.08, dtSec);
      } else {
        st.glowAlpha = Math.min(1, st.glowAlpha + dtSec * 8);
      }

      for (let i = st.trail.length - 1; i >= 0; i--) {
        st.trail[i].life -= dtSec * 2.1;
        if (st.trail[i].life <= 0) st.trail.splice(i, 1);
      }

      if (st.trail.length > 1) {
        for (let i = 1; i < st.trail.length; i++) {
          const p0 = st.trail[i - 1];
          const p1 = st.trail[i];

          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${p1.life * 0.55})`;
          ctx.lineWidth = (2 + p1.life * 4) * dpr;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x * w, (1 - p0.y) * h);
          ctx.lineTo(p1.x * w, (1 - p1.y) * h);
          ctx.stroke();
        }
      }

      if (st.glowAlpha > 0.02 && count > 0) {
        const px = st.currentX * w;
        const py = (1 - st.currentY) * h;

        const anchorNorm = st.anchorIndex / Math.max(1, count - 1);
        const anchorPy = h - (h * 0.08 + anchorNorm * h * 0.84);

        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${st.glowAlpha * 0.45})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([3 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(px, anchorPy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);

        const orbRadius = (16 + st.currentX * 18) * dpr;
        const grad = ctx.createRadialGradient(px, py, 2 * dpr, px, py, orbRadius);

        grad.addColorStop(0, `rgba(255, 252, 240, ${st.glowAlpha * 0.95})`);
        grad.addColorStop(0.35, `rgba(${ar}, ${ag}, ${ab}, ${st.glowAlpha * 0.72})`);
        grad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, orbRadius, 0, Math.PI * 2);
        ctx.fill();
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
    <WoodPanel aria-label="Pitch-Bend Pad">
      <PanelHeader>
        <EtchedTitle>MELODY PAD</EtchedTitle>
        <EtchedHint>↕ PITCH · ↔ VOL</EtchedHint>
      </PanelHeader>
      <PadStage>
        <SquarePadWell>
          <InteractiveCanvas ref={canvasRef} data-testid="pad-canvas" />
        </SquarePadWell>
      </PadStage>
    </WoodPanel>
  );
}
