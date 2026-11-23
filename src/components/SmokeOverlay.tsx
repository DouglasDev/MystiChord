import { styled } from '@linaria/react';
import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audioEngine';
import type { AuraColors } from '../musicTheory';
import { SmokeShader } from '../smokeShader';

const SmokeCanvas = styled.canvas`
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 30;
`;

export interface SmokeOverlayProps {
  audio: AudioEngine;
  aura: AuraColors;
}

export function SmokeOverlay({ audio, aura }: SmokeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shaderRef = useRef<SmokeShader | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const shader = new SmokeShader(canvas);

    shaderRef.current = shader;

    const onResize = () => shader.resize();

    window.addEventListener('resize', onResize);

    let rafId = 0;

    const tick = () => {
      shader.render(audio.getTelemetry());
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      shaderRef.current = null;
    };
  }, [audio]);

  useEffect(() => {
    shaderRef.current?.setTargetColors(aura.primary, aura.secondary);
  }, [aura]);

  return <SmokeCanvas ref={canvasRef} aria-hidden="true" data-testid="smoke-canvas" />;
}
