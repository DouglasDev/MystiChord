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
 * Dark, subtly shiny cabochon gemstone recessed directly into the dark wood (no tan border).
 */
const OvalStoneButton = styled.button`
  position: relative;
  overflow: hidden;
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.78);
  border-radius: 999px;
  width: clamp(94px, 26vw, 180px);
  height: 100%;
  max-height: 58px;
  min-height: 36px;
  padding: 4px 12px;
  cursor: pointer;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: rgba(242, 232, 214, 0.9);
  font-family: inherit;
  background-color: #070305;
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.85),
    inset 0 1px 2px rgba(255, 255, 255, 0.14),
    inset 0 -8px 16px rgba(0, 0, 0, 0.88);
  transition:
    transform 0.08s ease,
    box-shadow 0.28s ease;

  &:active {
    transform: translateY(1px) scale(0.96);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.88),
      inset 0 2px 6px rgba(0, 0, 0, 0.82),
      inset 0 -4px 10px rgba(0, 0, 0, 0.86);
  }

  &[data-mood='blue'][data-active='true'] {
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.88),
      0 0 18px rgba(34, 134, 230, 0.36),
      inset 0 1px 3px rgba(170, 224, 255, 0.34),
      inset 0 -8px 16px rgba(2, 10, 26, 0.86);
  }

  &[data-mood='green'][data-active='true'] {
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.88),
      0 0 18px rgba(28, 178, 108, 0.36),
      inset 0 1px 3px rgba(176, 245, 210, 0.34),
      inset 0 -8px 16px rgba(2, 22, 12, 0.86);
  }

  &[data-mood='purple'][data-active='true'] {
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.88),
      0 0 18px rgba(138, 66, 230, 0.36),
      inset 0 1px 3px rgba(220, 188, 255, 0.34),
      inset 0 -8px 16px rgba(16, 4, 34, 0.86);
  }

  &[data-mood='red'][data-active='true'] {
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.88),
      0 0 18px rgba(210, 42, 58, 0.38),
      inset 0 1px 3px rgba(255, 186, 192, 0.34),
      inset 0 -8px 16px rgba(34, 2, 6, 0.86);
  }

  &[data-mood='amber'][data-active='true'] {
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.88),
      0 0 18px rgba(224, 148, 36, 0.36),
      inset 0 1px 3px rgba(255, 232, 174, 0.34),
      inset 0 -8px 16px rgba(34, 16, 2, 0.86);
  }

  &[data-mood='teal'][data-active='true'] {
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.88),
      0 0 18px rgba(22, 174, 172, 0.36),
      inset 0 1px 3px rgba(174, 248, 244, 0.34),
      inset 0 -8px 16px rgba(2, 22, 26, 0.86);
  }

  &[data-mood='rose'][data-active='true'] {
    box-shadow:
      0 5px 14px rgba(0, 0, 0, 0.88),
      0 0 18px rgba(212, 68, 154, 0.36),
      inset 0 1px 3px rgba(255, 198, 232, 0.34),
      inset 0 -8px 16px rgba(32, 4, 20, 0.86);
  }

  @media (max-height: 460px) {
    max-height: 40px;
    min-height: 30px;
    padding: 2px 10px;
  }
`;

/**
 * Deep obsidian-tinted precious mineral core; dark and understated at rest,
 * softly illuminated from within when active.
 */
const MineralBody = styled.span`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.72;
  transition: opacity 0.28s ease;

  &[data-active='true'] {
    opacity: 1;
  }

  &[data-mood='blue'] {
    background: radial-gradient(
      ellipse at 50% 66%,
      rgba(26, 102, 186, 0.54) 0%,
      rgba(9, 32, 74, 0.88) 54%,
      rgba(4, 9, 22, 0.98) 100%
    );
  }

  &[data-mood='green'] {
    background: radial-gradient(
      ellipse at 50% 66%,
      rgba(22, 132, 82, 0.54) 0%,
      rgba(7, 46, 30, 0.88) 54%,
      rgba(3, 14, 10, 0.98) 100%
    );
  }

  &[data-mood='purple'] {
    background: radial-gradient(
      ellipse at 50% 66%,
      rgba(108, 52, 186, 0.56) 0%,
      rgba(42, 14, 82, 0.88) 54%,
      rgba(12, 4, 24, 0.98) 100%
    );
  }

  &[data-mood='red'] {
    background: radial-gradient(
      ellipse at 50% 66%,
      rgba(166, 28, 42, 0.58) 0%,
      rgba(68, 9, 16, 0.88) 54%,
      rgba(20, 3, 6, 0.98) 100%
    );
  }

  &[data-mood='amber'] {
    background: radial-gradient(
      ellipse at 50% 66%,
      rgba(176, 108, 22, 0.56) 0%,
      rgba(74, 38, 6, 0.88) 54%,
      rgba(22, 10, 2, 0.98) 100%
    );
  }

  &[data-mood='teal'] {
    background: radial-gradient(
      ellipse at 50% 66%,
      rgba(18, 132, 134, 0.54) 0%,
      rgba(6, 48, 54, 0.88) 54%,
      rgba(3, 14, 18, 0.98) 100%
    );
  }

  &[data-mood='rose'] {
    background: radial-gradient(
      ellipse at 50% 66%,
      rgba(168, 46, 118, 0.56) 0%,
      rgba(68, 12, 48, 0.88) 54%,
      rgba(20, 3, 14, 0.98) 100%
    );
  }
`;

/**
 * Subtle cut-gem specular glint & quiet dark facet planes.
 */
const CrystalSheen = styled.span`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(
      152deg,
      rgba(255, 255, 255, 0.14) 0%,
      rgba(255, 255, 255, 0.03) 24%,
      transparent 42%,
      rgba(0, 0, 0, 0.34) 76%,
      rgba(255, 255, 255, 0.06) 100%
    ),
    radial-gradient(
      ellipse at 32% 18%,
      rgba(255, 252, 245, 0.16) 0%,
      rgba(255, 252, 245, 0.03) 38%,
      transparent 64%
    );
`;

const PulseFlash = styled.span`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle at center, rgba(255, 250, 235, 0.36), transparent 70%);

  &[data-pulsing='true'] {
    animation: oval-stone-pulse 0.38s ease-out;
  }

  @keyframes oval-stone-pulse {
    from {
      opacity: 0.78;
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
  font-size: clamp(0.82rem, 1.9vw, 1.08rem);
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);

  &[data-mood='blue'] {
    color: #7ccbff;
  }

  &[data-mood='green'] {
    color: #76e8b5;
  }

  &[data-mood='purple'] {
    color: #cfa0ff;
  }

  &[data-mood='red'] {
    color: #ff828e;
  }

  &[data-mood='amber'] {
    color: #f8ce72;
  }

  &[data-mood='teal'] {
    color: #78ece6;
  }

  &[data-mood='rose'] {
    color: #f89cd4;
  }
`;

const StoneLabel = styled.span`
  position: relative;
  z-index: 1;
  font-size: clamp(0.64rem, 1.5vw, 0.82rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
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
                <CrystalSheen />
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
