import { styled } from '@linaria/react';
import { useRef, useState } from 'react';
import { EtchedHint, EtchedTitle, PanelHeader, WoodPanel } from './PanelPrimitives';

const ARC_MAX = 207.35;

const KnobStage = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const KnobControl = styled.div`
  position: relative;
  width: min(100%, 210px);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  touch-action: none;
`;

const KnobRingSvg = styled.svg`
  width: clamp(86px, 19vh, 136px);
  height: clamp(86px, 19vh, 136px);
  transform: rotate(135deg);
  overflow: visible;

  @media (max-height: 450px) {
    width: 82px;
    height: 82px;
  }
`;

const KnobArcTrack = styled.circle`
  fill: none;
  stroke: rgba(186, 144, 74, 0.2);
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 207.35 280;
`;

const KnobArcValue = styled.circle`
  fill: none;
  stroke: rgb(var(--aura-rgb));
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 207.35 280;
  filter: drop-shadow(0 0 5px rgba(var(--aura-rgb), 0.75));
  transition: stroke 0.35s ease;
`;

const KnobDial = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(62px, 13.5vh, 96px);
  height: clamp(62px, 13.5vh, 96px);
  margin-top: calc(clamp(62px, 13.5vh, 96px) * -0.5 - 10px);
  margin-left: calc(clamp(62px, 13.5vh, 96px) * -0.5);
  border-radius: 50%;
  background:
    repeating-conic-gradient(
      from 0deg,
      rgba(226, 190, 120, 0.22) 0deg 6deg,
      rgba(38, 24, 12, 0.55) 6deg 12deg
    ),
    radial-gradient(circle at 35% 30%, #7d5b2b, #362210 62%, #190e06 100%);
  border: 2px solid rgba(212, 168, 92, 0.65);
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.78),
    inset 0 2px 4px rgba(255, 230, 180, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;

  &[data-dragging='true'] {
    border-color: rgb(var(--aura-rgb));
    box-shadow:
      0 0 18px rgba(var(--aura-rgb), 0.45),
      0 6px 16px rgba(0, 0, 0, 0.8);
  }

  @media (orientation: portrait) and (max-width: 720px) {
    margin-top: calc(clamp(62px, 13.5vh, 96px) * -0.5 - 12px);
  }

  @media (max-height: 450px) {
    width: 58px;
    height: 58px;
    margin-top: -39px;
    margin-left: -29px;
  }
`;

const KnobCap = styled.div`
  position: relative;
  width: 76%;
  height: 76%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 32%, #48301a, #1d120a 72%, #100904 100%);
  border: 1px solid rgba(212, 168, 92, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const KnobPointer = styled.div`
  position: absolute;
  top: 5px;
  left: 50%;
  width: 3px;
  height: 36%;
  transform: translateX(-50%);
  border-radius: 99px;
  background: linear-gradient(180deg, #fff5dc, rgb(var(--aura-rgb)));
  box-shadow: 0 0 8px rgba(var(--aura-rgb), 0.9);
`;

const KnobCenterGem = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--aura-rgb), 0.95), rgba(30, 18, 10, 0.9));
  border: 1px solid rgba(226, 190, 120, 0.6);
`;

const KnobLabels = styled.div`
  margin-top: -6px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 0 4px;
`;

const KnobEndLabel = styled.span`
  font-size: clamp(0.52rem, 1.05vw, 0.64rem);
  letter-spacing: 0.1em;
  color: var(--muted-brass);
`;

const KnobReadout = styled.span`
  font-size: clamp(0.58rem, 1.15vw, 0.7rem);
  letter-spacing: 0.1em;
  color: rgb(var(--aura-rgb));
  text-shadow: 0 0 8px rgba(var(--aura-rgb), 0.55);
  text-align: center;
`;

export interface MorphKnobPanelProps {
  value: number;
  onChange: (value: number) => void;
}

function getReadoutText(value: number): string {
  if (value < 0.28) return 'LOW WHINE';
  if (value < 0.72) return 'OVERTONE MORPH';

  return 'THEREMIN WHISTLE';
}

export function MorphKnobPanel({ value, onChange }: MorphKnobPanelProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startVal: number;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startVal: value,
  });

  const angleDeg = -135 + value * 270;
  const dashOffset = (ARC_MAX * (1 - value)).toFixed(1);

  return (
    <WoodPanel aria-label="Harmonic Morph Dial">
      <PanelHeader>
        <EtchedTitle>HARMONIC DIAL</EtchedTitle>
        <EtchedHint>WHINE ↔ WHISTLE</EtchedHint>
      </PanelHeader>
      <KnobStage>
        <KnobControl
          role="slider"
          aria-label="Low Whine to Theremin Singing Whistle"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          data-testid="morph-knob"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);

            dragRef.current = {
              pointerId: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              startVal: value,
            };

            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (e.pointerId !== dragRef.current.pointerId) return;

            e.preventDefault();
            const dy = dragRef.current.startY - e.clientY;
            const dx = e.clientX - dragRef.current.startX;
            const next = Math.max(
              0,
              Math.min(1, dragRef.current.startVal + (dy + dx * 0.65) / 145),
            );

            onChange(next);
          }}
          onPointerUp={(e) => {
            if (e.pointerId !== dragRef.current.pointerId) return;

            dragRef.current.pointerId = null;
            setDragging(false);
          }}
          onPointerCancel={(e) => {
            if (e.pointerId !== dragRef.current.pointerId) return;

            dragRef.current.pointerId = null;
            setDragging(false);
          }}
          onWheel={(e) => {
            e.preventDefault();
            const next = Math.max(0, Math.min(1, value - Math.sign(e.deltaY) * 0.05));

            onChange(next);
          }}
        >
          <KnobRingSvg viewBox="0 0 110 110" aria-hidden="true">
            <KnobArcTrack cx="55" cy="55" r="44" />
            <KnobArcValue cx="55" cy="55" r="44" style={{ strokeDashoffset: dashOffset }} />
          </KnobRingSvg>
          <KnobDial
            data-dragging={dragging ? 'true' : 'false'}
            style={{ transform: `rotate(${angleDeg}deg)` }}
          >
            <KnobCap>
              <KnobPointer />
              <KnobCenterGem />
            </KnobCap>
          </KnobDial>
          <KnobLabels>
            <KnobEndLabel>WHINE</KnobEndLabel>
            <KnobReadout data-testid="knob-readout">{getReadoutText(value)}</KnobReadout>
            <KnobEndLabel>WHISTLE</KnobEndLabel>
          </KnobLabels>
        </KnobControl>
      </KnobStage>
    </WoodPanel>
  );
}
