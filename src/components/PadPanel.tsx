import { styled } from '@linaria/react';
import { useEffect, useRef } from 'react';
import { computeBoundedBend, getPitchGlyph, yToScalePitch, type RgbTuple } from '../musicTheory';

const PAD_Y_INSET = 0.04;
const PAD_Y_SPAN = 1 - PAD_Y_INSET * 2;

function rawYToScaleY(rawY: number): number {
  return Math.max(0, Math.min(1, (rawY - PAD_Y_INSET) / PAD_Y_SPAN));
}

function scaleNormToCanvasY(scaleNorm: number, height: number): number {
  return height * (1 - (PAD_Y_INSET + scaleNorm * PAD_Y_SPAN));
}

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
  border-radius: 14px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(22, 8, 10, 0.9), rgba(7, 2, 4, 0.96));
  border: 1px solid rgba(0, 0, 0, 0.65);
  box-shadow:
    inset 0 6px 22px rgba(0, 0, 0, 0.92),
    inset 0 0 32px rgba(var(--aura-rgb), 0.08);
`;

const PadCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
`;

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
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

function drawRipplingRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  timbre: number,
  volume: number,
  ripplePhase: number,
  phaseSign: number,
  strokeStyle: string,
  lineWidth: number,
  dpr: number,
) {
  const steps = 84;
  const harmonicA = 4 + Math.round(timbre * 5);
  const harmonicB = harmonicA + 3;
  const amp = (1.2 + volume * 9.5) * dpr;

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const wave1 = Math.sin(harmonicA * theta + ripplePhase * phaseSign) * amp;
    const wave2 = Math.cos(harmonicB * theta - ripplePhase * 1.45 * phaseSign) * amp * 0.42;
    const r = baseRadius + wave1 + wave2;
    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.stroke();
}

function drawSacredMandala(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  morphX: number,
  pitchNormY: number,
  phase: number,
  alpha: number,
  auraRgb: [number, number, number],
  dpr: number,
) {
  const [ar, ag, ab] = auraRgb;
  const petals = 3 + Math.round(morphX * 7);
  const innerHarmonic = 2 + morphX * 4;
  const spin = phase * (0.7 + pitchNormY * 1.1);

  ctx.save();
  ctx.translate(cx, cy);

  const auraGrad = ctx.createRadialGradient(0, 0, 2 * dpr, 0, 0, baseRadius * 1.65);

  auraGrad.addColorStop(0, `rgba(255, 252, 240, ${alpha * 0.92})`);
  auraGrad.addColorStop(0.32, `rgba(${ar}, ${ag}, ${ab}, ${alpha * 0.56})`);
  auraGrad.addColorStop(0.7, `rgba(224, 174, 92, ${alpha * 0.18})`);
  auraGrad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius * 1.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 246, 214, ${alpha * 0.85})`;
  ctx.lineWidth = 1.35 * dpr;
  ctx.beginPath();
  const steps = 72;

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const wave = 0.68 + 0.32 * Math.cos(petals * theta + spin);
    const overtone = 0.12 * morphX * Math.sin(petals * 2 * theta - spin * 1.5);
    const r = baseRadius * (wave + overtone);
    const px = Math.cos(theta) * r;
    const py = Math.sin(theta) * r;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${alpha * 0.72})`;
  ctx.lineWidth = 1.0 * dpr;
  ctx.beginPath();

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = baseRadius * (0.48 + 0.22 * Math.sin(innerHarmonic * theta - spin * 1.4));
    const px = Math.cos(theta + spin * 0.35) * r;
    const py = Math.sin(theta + spin * 0.35) * r;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = `rgba(232, 194, 118, ${alpha * 0.5})`;
  ctx.lineWidth = 0.9 * dpr;
  ctx.setLineDash([2.5 * dpr, 3.5 * dpr]);
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius * 1.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
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
    snappedToNeighbor: false,
    anchorY: 0.5,
    lastX: 0.5,
    lastY: 0.5,
    currentX: 0.5,
    currentY: 0.5,
    glowAlpha: 0,
    sustainGlow: 0,
    vibratoGlow: 0,
    smoothTimbre: 0.5,
    smoothVolume: 0,
    ringOrbitAngle: 0,
    ringRipplePhase: 0,
    phase: 0,
    trail: [] as TrailPoint[],
    ripples: [] as Ripple[],
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
    const scaleY = rawYToScaleY(st.currentY);
    const info = yToScalePitch(scaleY, padRootMidi, intervals, 2);

    scaleRef.current = { rootMidi: padRootMidi, intervals, notes: info.notes };

    if (st.activePointerId !== null) {
      st.anchorIndex = Math.min(info.notes.length - 1, info.snappedIndex);
      st.activeTargetIndex = st.anchorIndex;
      st.snappedToNeighbor = false;
      st.anchorY = scaleY;
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

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Window-level move/up listeners handle tracking if iOS Safari rejects setPointerCapture
      }

      const { x, y } = normCoords(e);
      const scaleY = rawYToScaleY(y);
      const { rootMidi, intervals: ivs } = scaleRef.current;
      const pitchInfo = yToScalePitch(scaleY, rootMidi, ivs, 2);

      scaleRef.current.notes = pitchInfo.notes;

      st.anchorIndex = pitchInfo.snappedIndex;
      st.activeTargetIndex = pitchInfo.snappedIndex;
      st.snappedToNeighbor = false;
      st.anchorY = scaleY;
      st.lastX = x;
      st.lastY = y;
      st.currentX = x;
      st.currentY = y;
      st.glowAlpha = 1;
      st.sustainGlow = 0;
      st.vibratoGlow = 0;
      st.trail = [{ x, y, life: 1.0 }];
      st.ripples.push({ x, y, radius: 0.02, life: 1.0 });

      callbacksRef.current.onPadDown(pitchInfo.snappedFreq, x, y);
    };

    const onPointerMove = (e: PointerEvent) => {
      const st = stateRef.current;

      if (e.pointerId !== st.activePointerId) return;

      e.preventDefault();
      const { x, y } = normCoords(e);
      const scaleY = rawYToScaleY(y);
      const dx = x - st.lastX;
      const dy = y - st.lastY;
      const motionEnergy = Math.hypot(dx, dy);

      st.lastX = x;
      st.lastY = y;
      st.currentX = x;
      st.currentY = y;
      st.vibratoGlow = Math.min(1, st.vibratoGlow + motionEnergy * 3.5);

      const deltaY = scaleY - st.anchorY;
      const bent = computeBoundedBend(st.anchorIndex, deltaY, scaleRef.current.notes);
      const justLocked = bent.snappedToNeighbor && !st.snappedToNeighbor;

      st.activeTargetIndex = bent.targetIndex;
      st.snappedToNeighbor = bent.snappedToNeighbor;

      if (justLocked) {
        st.ripples.push({ x, y, radius: 0.02, life: 0.9 });
      }

      st.trail.push({ x, y, life: 1.0 });
      if (st.trail.length > 28) st.trail.shift();

      const isBending = !bent.snappedToNeighbor && Math.abs(dy) > 0.003;

      callbacksRef.current.onPadMove(bent.freq, x, y, motionEnergy, isBending);
    };

    const onPointerRelease = (e: PointerEvent) => {
      const st = stateRef.current;

      if (e.pointerId !== st.activePointerId) return;

      st.activePointerId = null;
      callbacksRef.current.onPadUp();
    };

    const onTouchMovePrevent = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };

    resize();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;

    resizeObserver?.observe(canvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('touchmove', onTouchMovePrevent, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('pointercancel', onPointerRelease);
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

      st.phase += dtSec * (0.9 + st.sustainGlow * 1.1 + st.vibratoGlow * 1.6);

      if (st.activePointerId === null) {
        st.glowAlpha *= Math.pow(0.08, dtSec);
        st.sustainGlow *= Math.pow(0.12, dtSec);
        st.vibratoGlow *= Math.pow(0.15, dtSec);
      } else {
        st.glowAlpha = Math.min(1, st.glowAlpha + dtSec * 8);
        st.sustainGlow = Math.min(1, st.sustainGlow + dtSec * 0.65);
        st.vibratoGlow *= Math.pow(0.25, dtSec);
      }

      // Smoothly track timbre (X) and expressive volume (sustain + vibrato) for the two rings
      const targetTimbre = st.activePointerId !== null ? st.currentX : 0.5;
      const targetVol =
        st.activePointerId !== null
          ? Math.min(1, 0.25 + st.sustainGlow * 0.42 + st.vibratoGlow * 0.38)
          : 0;

      st.smoothTimbre += (targetTimbre - st.smoothTimbre) * Math.min(1, dtSec * 4.5);
      st.smoothVolume += (targetVol - st.smoothVolume) * Math.min(1, dtSec * 3.5);

      // Orbit speed around center driven by volume; ripple phase driven by sound energy
      st.ringOrbitAngle += dtSec * (0.08 + st.smoothVolume * 2.1);
      st.ringRipplePhase += dtSec * (1.1 + st.smoothVolume * 4.8);

      ctx.clearRect(0, 0, w, h);

      // 1. Deep 2D Timbre-Pitch Atmosphere Gradient
      const bgGrad = ctx.createLinearGradient(0, h, w, 0);

      bgGrad.addColorStop(0, 'rgba(92, 16, 18, 0.28)');
      bgGrad.addColorStop(0.48, 'rgba(26, 12, 18, 0.10)');
      bgGrad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0.18)`);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Engraved Celestial Meridian Arcs
      const arcCenters = [0.22, 0.5, 0.78];

      for (let m = 0; m < arcCenters.length; m++) {
        const mx = w * arcCenters[m];
        const curveBend = (m - 1) * w * 0.12;

        ctx.strokeStyle = m === 1 ? 'rgba(224, 180, 102, 0.12)' : `rgba(${ar}, ${ag}, ${ab}, 0.09)`;
        ctx.lineWidth = 0.9 * dpr;
        ctx.beginPath();
        ctx.moveTo(mx, h * 0.04);
        ctx.quadraticCurveTo(mx + curveBend, h * 0.5, mx, h * 0.96);
        ctx.stroke();
      }

      // 3. Two Dynamic Mystical Rings:
      //    - Move closer/farther based on timbre (X)
      //    - Rotate around center based on volume
      //    - Ripple organically to the sound
      const minDim = Math.min(w, h);
      const centerX = w * 0.5;
      const centerY = h * 0.5;
      const ringRadius = minDim * (0.23 + st.smoothVolume * 0.028);
      const ringSep = minDim * (0.15 - st.smoothTimbre * 0.11);
      const ox = Math.cos(st.ringOrbitAngle) * ringSep;
      const oy = Math.sin(st.ringOrbitAngle) * ringSep;
      const ringAlpha = 0.17 + st.smoothVolume * 0.14;

      drawRipplingRing(
        ctx,
        centerX - ox,
        centerY - oy,
        ringRadius,
        st.smoothTimbre,
        st.smoothVolume,
        st.ringRipplePhase,
        1,
        `rgba(224, 178, 98, ${ringAlpha})`,
        (0.85 + st.smoothVolume * 0.35) * dpr,
        dpr,
      );

      drawRipplingRing(
        ctx,
        centerX + ox,
        centerY + oy,
        ringRadius,
        st.smoothTimbre,
        st.smoothVolume,
        st.ringRipplePhase,
        -1,
        `rgba(${ar}, ${ag}, ${ab}, ${ringAlpha})`,
        (0.85 + st.smoothVolume * 0.35) * dpr,
        dpr,
      );

      // 4. 2D Standing-Wave Harmonic Contours
      const count = notes.length;
      const fontSize = Math.max(9, Math.round(10 * dpr));

      ctx.font = `600 ${fontSize}px "GFS Neohellenic", "Uncial Antiqua", Georgia, serif`;
      ctx.textBaseline = 'middle';

      const touchPx = st.currentX * w;
      const touchPy = (1 - st.currentY) * h;

      for (let i = 0; i < count; i++) {
        const normY = i / Math.max(1, count - 1);
        const baseY = scaleNormToCanvasY(normY, h);
        const isTonic = Math.abs((notes[i] - rootMidi) % 12) < 0.001;
        const isActiveTone =
          st.activePointerId !== null && (i === st.anchorIndex || i === st.activeTargetIndex);

        const segs = 34;
        const startX = w * 0.1;
        const endX = w * 0.95;
        const spanX = endX - startX;

        ctx.strokeStyle = isActiveTone
          ? `rgba(${ar}, ${ag}, ${ab}, 0.82)`
          : isTonic
            ? 'rgba(232, 188, 108, 0.34)'
            : 'rgba(196, 152, 92, 0.15)';

        ctx.lineWidth = (isActiveTone ? 1.85 : isTonic ? 1.15 : 0.75) * dpr;
        ctx.beginPath();

        for (let s = 0; s <= segs; s++) {
          const u = s / segs;
          const x = startX + u * spanX;
          const spatialFreq = 1.4 + u * u * 5.2;
          const baseAmp = (isTonic ? 4.4 : 2.6) * dpr * (1 - normY * 0.32);
          const harmonicWave =
            Math.sin(u * Math.PI * 2 * spatialFreq + st.phase * (0.45 + u * 0.85) + i * 0.9) *
            baseAmp *
            (0.45 + 0.55 * Math.sin(u * Math.PI));

          let warp = 0;

          if (st.glowAlpha > 0.02) {
            const dist = Math.hypot(x - touchPx, baseY - touchPy);
            const pull = Math.exp(-dist / (minDim * 0.22)) * st.glowAlpha;

            warp =
              Math.sin(dist * 0.08 - st.phase * 4.0) * pull * (5.5 + st.vibratoGlow * 6.0) * dpr;
          }

          const y = baseY + harmonicWave + warp;

          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.stroke();

        if (isTonic || isActiveTone) {
          ctx.strokeStyle = isActiveTone
            ? `rgba(255, 246, 212, 0.48)`
            : `rgba(${ar}, ${ag}, ${ab}, 0.16)`;

          ctx.lineWidth = (isActiveTone ? 1.1 : 0.75) * dpr;
          ctx.beginPath();

          for (let s = 0; s <= segs; s++) {
            const u = s / segs;
            const x = startX + u * spanX;
            const amp = 3.8 * u * dpr * (isActiveTone ? 1.35 : 0.9);
            const y =
              baseY -
              Math.sin(u * Math.PI * 2 * (2.6 + u * 5.8) - st.phase * 1.1 + i) *
                amp *
                Math.sin(u * Math.PI);

            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }

          ctx.stroke();

          for (const nxFrac of arcCenters) {
            const nx = startX + nxFrac * spanX;
            const nodeR = (isActiveTone ? 3.2 : 2.1) * dpr;

            ctx.fillStyle = isActiveTone
              ? `rgba(255, 250, 232, 0.9)`
              : `rgba(228, 186, 108, ${0.28 + nxFrac * 0.25})`;

            ctx.beginPath();
            ctx.moveTo(nx, baseY - nodeR);
            ctx.lineTo(nx + nodeR, baseY);
            ctx.lineTo(nx, baseY + nodeR);
            ctx.lineTo(nx - nodeR, baseY);
            ctx.closePath();
            ctx.fill();
          }

          ctx.fillStyle = isActiveTone
            ? `rgba(${ar}, ${ag}, ${ab}, 0.98)`
            : 'rgba(232, 194, 126, 0.68)';

          ctx.textAlign = 'left';
          ctx.fillText(getPitchGlyph(notes[i]), w * 0.025, baseY);
        }
      }

      // 5. Expanding Cymatic Ripples
      for (let i = st.ripples.length - 1; i >= 0; i--) {
        const rp = st.ripples[i];

        rp.radius += dtSec * 0.62;
        rp.life -= dtSec * 1.45;

        if (rp.life <= 0) {
          st.ripples.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${rp.life * 0.55})`;
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.arc(rp.x * w, (1 - rp.y) * h, rp.radius * minDim, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 6. Luminous Ribbon Trail
      for (let i = st.trail.length - 1; i >= 0; i--) {
        st.trail[i].life -= dtSec * 2.0;
        if (st.trail[i].life <= 0) st.trail.splice(i, 1);
      }

      if (st.trail.length > 1) {
        for (let i = 1; i < st.trail.length; i++) {
          const p0 = st.trail[i - 1];
          const p1 = st.trail[i];

          ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${p1.life * 0.52})`;
          ctx.lineWidth = (1.6 + p1.life * 3.8) * dpr;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x * w, (1 - p0.y) * h);
          ctx.lineTo(p1.x * w, (1 - p1.y) * h);
          ctx.stroke();
        }
      }

      // 7. Active Sacred Cymatic Mandala & Pitch-Bend Tether
      if (st.glowAlpha > 0.02 && count > 0) {
        const anchorNorm = st.anchorIndex / Math.max(1, count - 1);
        const anchorPy = scaleNormToCanvasY(anchorNorm, h);

        ctx.strokeStyle = `rgba(255, 236, 178, ${st.glowAlpha * 0.5})`;
        ctx.lineWidth = 1.4 * dpr;
        ctx.setLineDash([3 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(touchPx, anchorPy);
        ctx.lineTo(touchPx, touchPy);
        ctx.stroke();
        ctx.setLineDash([]);

        const mandalaRadius = (18 + st.sustainGlow * 14 + st.vibratoGlow * 8) * dpr;

        drawSacredMandala(
          ctx,
          touchPx,
          touchPy,
          mandalaRadius,
          st.currentX,
          st.currentY,
          st.phase,
          st.glowAlpha,
          auraRef.current,
          dpr,
        );
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('touchmove', onTouchMovePrevent);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <PadArea aria-label="Melody Pad">
      <PadWell>
        <PadCanvas ref={canvasRef} data-testid="pad-canvas" />
      </PadWell>
    </PadArea>
  );
}
