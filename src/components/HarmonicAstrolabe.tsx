import { styled } from '@linaria/react';

/**
 * Pitch classes ordered by the Circle of Fifths so modulations draw
 * geometric constellations (+P5/+P4 = adjacent stars, +TT = diameter, ±M3 = triangle).
 */
const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] as const;

const AstrolabeWrap = styled.div`
  position: fixed;
  right: max(8px, env(safe-area-inset-right));
  bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 20;
  width: clamp(44px, 11vw, 66px);
  height: clamp(44px, 11vw, 66px);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, rgba(16, 4, 6, 0.86), rgba(6, 1, 3, 0.94));
  border: 1px solid rgba(0, 0, 0, 0.72);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.78),
    inset 0 0 12px rgba(var(--aura-rgb), 0.14);

  @media (max-height: 460px) {
    width: 44px;
    height: 44px;
  }
`;

const AstrolabeSvg = styled.svg`
  display: block;
  width: 100%;
  height: 100%;
`;

const GhostPulseDot = styled.circle`
  animation: ghost-star-pulse 1.8s ease-in-out infinite;

  @keyframes ghost-star-pulse {
    0%,
    100% {
      opacity: 0.35;
    }

    50% {
      opacity: 0.85;
    }
  }
`;

export interface HarmonicAstrolabeProps {
  currentRootMidi: number;
  nextRootMidi: number;
  history: readonly number[];
}

function pitchClassToPoint(midi: number, cx: number, cy: number, radius: number) {
  const pc = ((midi % 12) + 12) % 12;
  const idx = FIFTHS_ORDER.indexOf(pc as (typeof FIFTHS_ORDER)[number]);
  const angle = -Math.PI / 2 + (idx / 12) * Math.PI * 2;

  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

export function HarmonicAstrolabe({
  currentRootMidi,
  nextRootMidi,
  history,
}: HarmonicAstrolabeProps) {
  const cx = 50;
  const cy = 50;
  const ringR = 37;
  const innerR = 23;

  const currentPt = pitchClassToPoint(currentRootMidi, cx, cy, ringR);
  const nextPt = pitchClassToPoint(nextRootMidi, cx, cy, ringR);

  return (
    <AstrolabeWrap aria-hidden="true" data-testid="harmonic-astrolabe">
      <AstrolabeSvg viewBox="0 0 100 100">
        {/* Subtle engraved celestial rings */}
        <circle
          cx={cx}
          cy={cy}
          r={ringR}
          fill="none"
          stroke="rgba(182, 138, 76, 0.26)"
          strokeWidth="1"
        />
        <circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill="none"
          stroke="rgba(182, 138, 76, 0.14)"
          strokeWidth="0.8"
        />

        {/* Fading constellation lines of recent key modulations */}
        {history.length > 1 &&
          history.slice(1).map((midi, i) => {
            const prevMidi = history[i];
            const p0 = pitchClassToPoint(prevMidi, cx, cy, ringR);
            const p1 = pitchClassToPoint(midi, cx, cy, ringR);
            const recency = (i + 1) / (history.length - 1);

            return (
              <line
                key={`${i}-${prevMidi}-${midi}`}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={`rgba(var(--aura-rgb), ${(0.18 + recency * 0.56).toFixed(2)})`}
                strokeWidth={0.9 + recency * 0.8}
                strokeLinecap="round"
              />
            );
          })}

        {/* Dashed preview chord from current key to the next modulation key */}
        <line
          x1={currentPt.x}
          y1={currentPt.y}
          x2={nextPt.x}
          y2={nextPt.y}
          stroke="rgba(232, 198, 138, 0.44)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* 12 harmonic star nodes */}
        {FIFTHS_ORDER.map((pc) => {
          const pt = pitchClassToPoint(pc, cx, cy, ringR);

          return <circle key={pc} cx={pt.x} cy={pt.y} r="1.9" fill="rgba(206, 168, 102, 0.42)" />;
        })}

        {/* Pulsing ghost preview of next key if active stone is tapped again */}
        <GhostPulseDot cx={nextPt.x} cy={nextPt.y} r="3.4" fill="rgba(var(--aura-rgb), 0.72)" />

        {/* Active tonic star */}
        <circle cx={currentPt.x} cy={currentPt.y} r="6.5" fill="rgba(var(--aura-rgb), 0.34)" />
        <circle cx={currentPt.x} cy={currentPt.y} r="3.6" fill="rgb(var(--aura-rgb))" />
        <circle cx={currentPt.x} cy={currentPt.y} r="1.6" fill="#fffaf0" />
      </AstrolabeSvg>
    </AstrolabeWrap>
  );
}
