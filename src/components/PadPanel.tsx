import { styled } from '@linaria/react';
import { useEffect, useRef } from 'react';
import { computeBoundedBend, getPitchGlyph, yToScalePitch, type RgbTuple } from '../musicTheory';

const PadArea = styled.section`
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  padding: 4px 6px 4px 4px;
  display: flex;
  flex-direction: column;
`;

const PadWell = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(26, 12, 12, 0.88), rgba(10, 4, 5, 0.94));
  border: 1.5px solid rgba(214, 170, 92, 0.46);
  box-shadow:
    inset 0 6px 20px rgba(0, 0, 0, 0.88),
    inset 0 0 28px rgba(var(--aura-rgb), 0.08),
    0 1px 0 rgba(255, 220, 160, 0.14);
`;

const PadCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
`;

const AxisOverlayBottom = styled.div`
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 5px;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  font-size: clamp(0.5rem, 1.1vw, 0.64rem);
  letter-spacing: 0.14em;
  color: rgba(232, 198, 138, 0.56);
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
  onPadMove: (freq: number, x: number, y: number, motionEnergy: number, isBending: boolean) => void;
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
    activeTargetIndex: 0,
    anchorY: 0.5,
    lastX: 0.5,
    lastY: 0.5,
    currentX: 0.5,
    currentY: 0.5,
    glowAlpha: 0,
    sustainGlow: 0,
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
      st.activeTargetIndex = st.anchorIndex;
      st.anchorY = st.currentY;
      callbacksRef.current.onPadMove(info.snappedFreq, st.currentX, st.currentY, 0, false);
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
      st.activeTargetIndex = pitchInfo.snappedIndex;
      st.anchorY = y;
      st.lastX = x;
      st.lastY = y;
      st.currentX = x;
      st.currentY = y;
      st.glowAlpha = 1;
      st.sustainGlow = 0;
      st.trail = [{ x, y, life: 1.0 }];

      callbacksRef.current.onPadDown(pitchInfo.snappedFreq, x, y);
    };

    const onPointerMove = (e: PointerEvent) => {
      const st = stateRef.current;

      if (e.pointerId !== st.activePointerId) return;

      e.preventDefault();
      const { x, y } = normCoords(e);
      const dx = x - st.lastX;
      const dy = y - st.lastY;
      const motionEnergy = Math.hypot(dx, dy);

      st.lastX = x;
      st.lastY = y;
      st.currentX = x;
      st.currentY = y;

      const deltaY = y - st.anchorY;
      const bent = computeBoundedBend(st.anchorIndex, deltaY, scaleRef.current.notes);

      st.activeTargetIndex = bent.targetIndex;

      st.trail.push({ x, y, life: 1.0 });
      if (st.trail.length > 26) st.trail.shift();

      const isBending = !bent.snappedToNeighbor && Math.abs(dy) > 0.003;

      callbacksRef.current.onPadMove(bent.freq, x, y, motionEnergy, isBending);
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

      // Subtle left-right spectral morph tint (warm copper whine -> luminous whistle)
      const morphGrad = ctx.createLinearGradient(0, 0, w, 0);

      morphGrad.addColorStop(0, 'rgba(130, 32, 24, 0.14)');
      morphGrad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0.12)`);
      ctx.fillStyle = morphGrad;
      ctx.fillRect(0, 0, w, h);

      const count = notes.length;
      const fontSize = Math.max(9, Math.round(10 * dpr));

      ctx.font = `600 ${fontSize}px "Cinzel", Georgia, serif`;
      ctx.textBaseline = 'middle';

      for (let i = 0; i < count; i++) {
        const normY = i / Math.max(1, count - 1);
        const py = h - (h * 0.09 + normY * h * 0.82);
        const isTonic = (notes[i] - rootMidi) % 12 === 0;
        const isActiveTone =
          st.activePointerId !== null && (i === st.anchorIndex || i === st.activeTargetIndex);

        ctx.strokeStyle = isActiveTone
          ? `rgba(${ar}, ${ag}, ${ab}, 0.78)`
          : isTonic
            ? 'rgba(224, 180, 102, 0.36)'
            : 'rgba(196, 156, 94, 0.14)';

        ctx.lineWidth = (isActiveTone ? 1.8 : isTonic ? 1.2 : 0.8) * dpr;
        ctx.beginPath();
        ctx.moveTo(w * 0.11, py);
        ctx.lineTo(w * 0.94, py);
        ctx.stroke();

        if (isTonic || isActiveTone) {
          ctx.fillStyle = isActiveTone
            ? `rgba(${ar}, ${ag}, ${ab}, 0.98)`
            : 'rgba(224, 180, 102, 0.62)';

          ctx.textAlign = 'left';
          ctx.fillText(getPitchGlyph(notes[i]), w * 0.03, py);
        }
      }

      if (st.activePointerId === null) {
        st.glowAlpha *= Math.pow(0.08, dtSec);
        st.sustainGlow *= Math.pow(0.12, dtSec);
      } else {
        st.glowAlpha = Math.min(1, st.glowAlpha + dtSec * 8);
        st.sustainGlow = Math.min(1, st.sustainGlow + dtSec * 0.65);
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
        const anchorPy = h - (h * 0.09 + anchorNorm * h * 0.82);

        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${st.glowAlpha * 0.45})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([3 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(px, anchorPy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);

        // Orb expands smoothly with sustain volume bloom
        const orbRadius = (18 + st.sustainGlow * 18) * dpr;
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
    <PadArea aria-label="Melody Pad">
      <PadWell>
        <PadCanvas ref={canvasRef} data-testid="pad-canvas" />
        <AxisOverlayBottom aria-hidden="true">
          <span>WHINE</span>
          <span>WHISTLE</span>
        </AxisOverlayBottom>
      </PadWell>
    </PadArea>
  );
}
