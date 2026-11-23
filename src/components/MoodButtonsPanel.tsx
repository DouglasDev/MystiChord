import { styled } from '@linaria/react';
import { useState } from 'react';
import { MOOD_DIAMOND_ROWS, MOODS, type MoodKey } from '../musicTheory';

const DiamondSection = styled.section`
  grid-column: 1 / -1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(6px, 1.4vh, 12px);
  padding: 4px 6px 6px;
`;

const DiamondRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 2.4vw, 24px);
  width: 100%;
  flex: 1 1 0;
  min-height: 0;
`;

/**
 * Recessed antique brass bezel housing a deep 3D cabochon gemstone.
 */
const OvalStoneButton = styled.button`
  position: relative;
  overflow: hidden;
  appearance: none;
  border: 2px solid rgba(196, 152, 78, 0.72);
  border-radius: 999px;
  width: clamp(94px, 26vw, 180px);
  height: 100%;
  max-height: 60px;
  min-height: 36px;
  padding: 4px 12px;
  cursor: pointer;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #f4e7cd;
  font-family: inherit;
  background-color: #16090a;
  box-shadow:
    /* Carved dark wood socket & outer depth */
    0 5px 12px rgba(0, 0, 0, 0.82),
    0 1px 0 rgba(255, 224, 168, 0.2),
    /* Beveled antique gold inner bezel */ inset 0 2px 3px rgba(255, 236, 198, 0.28),
    inset 0 -7px 14px rgba(0, 0, 0, 0.78),
    inset 0 0 0 1px rgba(40, 20, 8, 0.85);
  transition:
    transform 0.08s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease;

  &:active {
    transform: translateY(1px) scale(0.96);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.85),
      inset 0 2px 5px rgba(0, 0, 0, 0.72),
      inset 0 -4px 10px rgba(0, 0, 0, 0.78);
  }

  &[data-mood='blue'][data-active='true'] {
    border-color: rgba(118, 206, 255, 0.88);
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.82),
      0 0 22px rgba(44, 174, 255, 0.42),
      inset 0 2px 4px rgba(200, 240, 255, 0.36),
      inset 0 -7px 14px rgba(4, 18, 42, 0.76);
  }

  &[data-mood='green'][data-active='true'] {
    border-color: rgba(114, 238, 176, 0.88);
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.82),
      0 0 22px rgba(40, 220, 140, 0.42),
      inset 0 2px 4px rgba(200, 255, 228, 0.36),
      inset 0 -7px 14px rgba(4, 34, 20, 0.76);
  }

  &[data-mood='purple'][data-active='true'] {
    border-color: rgba(202, 142, 255, 0.88);
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.82),
      0 0 22px rgba(165, 82, 255, 0.42),
      inset 0 2px 4px rgba(235, 210, 255, 0.36),
      inset 0 -7px 14px rgba(24, 6, 46, 0.76);
  }

  &[data-mood='red'][data-active='true'] {
    border-color: rgba(255, 134, 142, 0.88);
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.82),
      0 0 22px rgba(255, 59, 78, 0.42),
      inset 0 2px 4px rgba(255, 214, 216, 0.36),
      inset 0 -7px 14px rgba(48, 4, 10, 0.76);
  }

  &[data-mood='amber'][data-active='true'] {
    border-color: rgba(255, 216, 118, 0.9);
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.82),
      0 0 22px rgba(255, 182, 56, 0.42),
      inset 0 2px 4px rgba(255, 244, 204, 0.38),
      inset 0 -7px 14px rgba(46, 24, 2, 0.76);
  }

  &[data-mood='teal'][data-active='true'] {
    border-color: rgba(114, 242, 236, 0.88);
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.82),
      0 0 22px rgba(30, 214, 208, 0.42),
      inset 0 2px 4px rgba(206, 255, 252, 0.36),
      inset 0 -7px 14px rgba(2, 34, 38, 0.76);
  }

  &[data-mood='rose'][data-active='true'] {
    border-color: rgba(255, 158, 216, 0.88);
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.82),
      0 0 22px rgba(255, 94, 184, 0.42),
      inset 0 2px 4px rgba(255, 224, 242, 0.36),
      inset 0 -7px 14px rgba(48, 6, 30, 0.76);
  }

  @media (max-height: 460px) {
    max-height: 40px;
    min-height: 30px;
    padding: 2px 10px;
  }
`;

/**
 * Deep mineral cabochon body with subsurface internal glow (rich stone, not plastic).
 */
const MineralBody = styled.span`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.78;
  transition: opacity 0.25s ease;

  &[data-active='true'] {
    opacity: 1;
  }

  &[data-mood='blue'] {
    background: radial-gradient(
      ellipse at 50% 68%,
      rgba(46, 168, 255, 0.68) 0%,
      rgba(14, 62, 134, 0.82) 52%,
      rgba(7, 20, 46, 0.96) 100%
    );
  }

  &[data-mood='green'] {
    background: radial-gradient(
      ellipse at 50% 68%,
      rgba(44, 208, 132, 0.65) 0%,
      rgba(12, 92, 58, 0.82) 52%,
      rgba(6, 28, 18, 0.96) 100%
    );
  }

  &[data-mood='purple'] {
    background: radial-gradient(
      ellipse at 50% 68%,
      rgba(168, 92, 255, 0.68) 0%,
      rgba(74, 26, 138, 0.84) 52%,
      rgba(22, 7, 42, 0.96) 100%
    );
  }

  &[data-mood='red'] {
    background: radial-gradient(
      ellipse at 50% 68%,
      rgba(235, 58, 72, 0.68) 0%,
      rgba(122, 16, 28, 0.84) 52%,
      rgba(38, 5, 10, 0.96) 100%
    );
  }

  &[data-mood='amber'] {
    background: radial-gradient(
      ellipse at 50% 68%,
      rgba(245, 174, 48, 0.68) 0%,
      rgba(132, 72, 12, 0.84) 52%,
      rgba(40, 18, 4, 0.96) 100%
    );
  }

  &[data-mood='teal'] {
    background: radial-gradient(
      ellipse at 50% 68%,
      rgba(36, 208, 204, 0.65) 0%,
      rgba(10, 94, 102, 0.84) 52%,
      rgba(5, 28, 34, 0.96) 100%
    );
  }

  &[data-mood='rose'] {
    background: radial-gradient(
      ellipse at 50% 68%,
      rgba(240, 96, 182, 0.68) 0%,
      rgba(126, 24, 86, 0.84) 52%,
      rgba(38, 6, 26, 0.96) 100%
    );
  }
`;

/**
 * Subtle cut-gemstone internal facet planes & soft stone rim sheen (avoids candy/plastic glare).
 */
const CrystalFacets = styled.span`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(
      148deg,
      rgba(255, 246, 224, 0.14) 0%,
      rgba(255, 246, 224, 0.04) 28%,
      transparent 44%,
      rgba(0, 0, 0, 0.24) 72%,
      rgba(255, 232, 186, 0.09) 100%
    ),
    conic-gradient(
      from 25deg at 50% 50%,
      rgba(255, 255, 255, 0.07) 0deg 40deg,
      transparent 40deg 115deg,
      rgba(0, 0, 0, 0.16) 115deg 190deg,
      rgba(255, 255, 255, 0.06) 190deg 250deg,
      transparent 250deg 360deg
    );
`;

const PulseFlash = styled.span`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle at center, rgba(255, 250, 235, 0.5), transparent 70%);

  &[data-pulsing='true'] {
    animation: oval-stone-pulse 0.38s ease-out;
  }

  @keyframes oval-stone-pulse {
    from {
      opacity: 0.85;
      transform: scale(0.84);
    }

    to {
      opacity: 0;
      transform: scale(1.2);
    }
  }
`;

const StoneRune = styled.span`
  position: relative;
  z-index: 1;
  font-size: clamp(0.85rem, 2vw, 1.12rem);
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);

  &[data-mood='blue'] {
    color: #8ad8ff;
  }

  &[data-mood='green'] {
    color: #84f5c2;
  }

  &[data-mood='purple'] {
    color: #dbb0ff;
  }

  &[data-mood='red'] {
    color: #ff949e;
  }

  &[data-mood='amber'] {
    color: #ffe08a;
  }

  &[data-mood='teal'] {
    color: #8cf7f2;
  }

  &[data-mood='rose'] {
    color: #ffb0e0;
  }
`;

const StoneLabel = styled.span`
  position: relative;
  z-index: 1;
  font-size: clamp(0.64rem, 1.55vw, 0.84rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.92);
`;

export interface MoodButtonsPanelProps {
  activeMood: MoodKey;
  onSelectMood: (moodKey: MoodKey) => void;
}

export function MoodButtonsPanel({ activeMood, onSelectMood }: MoodButtonsPanelProps) {
  const [pulseState, setPulseState] = useState<{ mood: MoodKey | null; seq: number }>({
    mood: null,
    seq: 0,
  });

  const handlePress = (moodKey: MoodKey) => {
    setPulseState((prev) => ({ mood: moodKey, seq: prev.seq + 1 }));
    onSelectMood(moodKey);
  };

  return (
    <DiamondSection aria-label="Modulation Stones">
      {MOOD_DIAMOND_ROWS.map((row, rowIndex) => (
        <DiamondRow key={rowIndex}>
          {row.map((moodKey) => {
            const mood = MOODS[moodKey];
            const isActive = activeMood === moodKey;
            const isPulsing = pulseState.mood === moodKey;

            return (
              <OvalStoneButton
                key={moodKey}
                type="button"
                data-mood={moodKey}
                data-active={isActive ? 'true' : 'false'}
                data-testid={`mood-btn-${moodKey}`}
                aria-label={`${mood.label} — ${mood.scaleName} (${mood.modulationLabel})`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handlePress(moodKey);
                }}
              >
                <MineralBody data-mood={moodKey} data-active={isActive ? 'true' : 'false'} />
                <CrystalFacets />
                <PulseFlash
                  key={isPulsing ? pulseState.seq : 0}
                  data-pulsing={isPulsing ? 'true' : 'false'}
                />
                <StoneRune data-mood={moodKey}>{mood.rune}</StoneRune>
                <StoneLabel>{mood.label}</StoneLabel>
              </OvalStoneButton>
            );
          })}
        </DiamondRow>
      ))}
    </DiamondSection>
  );
}
