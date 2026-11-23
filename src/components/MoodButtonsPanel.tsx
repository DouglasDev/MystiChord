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

const OvalStoneButton = styled.button`
  position: relative;
  overflow: hidden;
  appearance: none;
  border: 1.5px solid rgba(214, 170, 92, 0.5);
  border-radius: 999px;
  width: clamp(92px, 26vw, 178px);
  height: 100%;
  max-height: 62px;
  min-height: 36px;
  padding: 4px 12px;
  cursor: pointer;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--ivory-text);
  font-family: inherit;
  background: radial-gradient(ellipse at 50% 30%, rgba(52, 22, 18, 0.9), rgba(18, 6, 7, 0.96) 76%);
  box-shadow:
    inset 0 2px 3px rgba(255, 228, 176, 0.16),
    inset 0 -4px 10px rgba(0, 0, 0, 0.78),
    0 4px 12px rgba(0, 0, 0, 0.6);
  transition:
    transform 0.08s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;

  &:active {
    transform: scale(0.95);
  }

  &[data-mood='blue'][data-active='true'] {
    border-color: rgba(74, 198, 255, 0.92);
    box-shadow:
      0 0 18px rgba(44, 174, 255, 0.45),
      inset 0 0 14px rgba(44, 174, 255, 0.3);
  }

  &[data-mood='green'][data-active='true'] {
    border-color: rgba(66, 232, 152, 0.92);
    box-shadow:
      0 0 18px rgba(40, 220, 140, 0.45),
      inset 0 0 14px rgba(40, 220, 140, 0.3);
  }

  &[data-mood='purple'][data-active='true'] {
    border-color: rgba(188, 108, 255, 0.92);
    box-shadow:
      0 0 18px rgba(165, 82, 255, 0.45),
      inset 0 0 14px rgba(165, 82, 255, 0.3);
  }

  &[data-mood='red'][data-active='true'] {
    border-color: rgba(255, 92, 106, 0.92);
    box-shadow:
      0 0 18px rgba(255, 59, 78, 0.45),
      inset 0 0 14px rgba(255, 59, 78, 0.3);
  }

  &[data-mood='amber'][data-active='true'] {
    border-color: rgba(255, 196, 78, 0.92);
    box-shadow:
      0 0 18px rgba(255, 182, 56, 0.45),
      inset 0 0 14px rgba(255, 182, 56, 0.3);
  }

  &[data-mood='teal'][data-active='true'] {
    border-color: rgba(62, 232, 224, 0.92);
    box-shadow:
      0 0 18px rgba(30, 214, 208, 0.45),
      inset 0 0 14px rgba(30, 214, 208, 0.3);
  }

  &[data-mood='rose'][data-active='true'] {
    border-color: rgba(255, 120, 196, 0.92);
    box-shadow:
      0 0 18px rgba(255, 94, 184, 0.45),
      inset 0 0 14px rgba(255, 94, 184, 0.3);
  }

  @media (max-height: 460px) {
    max-height: 40px;
    min-height: 30px;
    padding: 2px 10px;
  }
`;

const OvalGemGlow = styled.span`
  position: absolute;
  inset: 0;
  opacity: 0.24;
  pointer-events: none;
  transition: opacity 0.25s ease;

  &[data-active='true'] {
    opacity: 0.62;
  }

  &[data-mood='blue'] {
    background: radial-gradient(
      ellipse at 50% 45%,
      #32b4ff 0%,
      rgba(24, 112, 210, 0.35) 58%,
      transparent 88%
    );
  }

  &[data-mood='green'] {
    background: radial-gradient(
      ellipse at 50% 45%,
      #34eb99 0%,
      rgba(16, 165, 98, 0.35) 58%,
      transparent 88%
    );
  }

  &[data-mood='purple'] {
    background: radial-gradient(
      ellipse at 50% 45%,
      #be6aff 0%,
      rgba(128, 42, 220, 0.35) 58%,
      transparent 88%
    );
  }

  &[data-mood='red'] {
    background: radial-gradient(
      ellipse at 50% 45%,
      #ff4b5c 0%,
      rgba(210, 32, 48, 0.35) 58%,
      transparent 88%
    );
  }

  &[data-mood='amber'] {
    background: radial-gradient(
      ellipse at 50% 45%,
      #ffc148 0%,
      rgba(214, 128, 18, 0.35) 58%,
      transparent 88%
    );
  }

  &[data-mood='teal'] {
    background: radial-gradient(
      ellipse at 50% 45%,
      #2ceae2 0%,
      rgba(14, 152, 158, 0.35) 58%,
      transparent 88%
    );
  }

  &[data-mood='rose'] {
    background: radial-gradient(
      ellipse at 50% 45%,
      #ff70c0 0%,
      rgba(196, 36, 128, 0.35) 58%,
      transparent 88%
    );
  }
`;

const PulseFlash = styled.span`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle at center, rgba(255, 250, 235, 0.55), transparent 70%);

  &[data-pulsing='true'] {
    animation: oval-stone-pulse 0.38s ease-out;
  }

  @keyframes oval-stone-pulse {
    from {
      opacity: 0.9;
      transform: scale(0.84);
    }

    to {
      opacity: 0;
      transform: scale(1.22);
    }
  }
`;

const StoneRune = styled.span`
  position: relative;
  z-index: 1;
  font-size: clamp(0.85rem, 2vw, 1.15rem);
  line-height: 1;

  &[data-mood='blue'] {
    color: #56c8ff;
    text-shadow: 0 0 8px rgba(44, 174, 255, 0.85);
  }

  &[data-mood='green'] {
    color: #52f0a8;
    text-shadow: 0 0 8px rgba(40, 220, 140, 0.85);
  }

  &[data-mood='purple'] {
    color: #cc84ff;
    text-shadow: 0 0 8px rgba(165, 82, 255, 0.85);
  }

  &[data-mood='red'] {
    color: #ff6b78;
    text-shadow: 0 0 8px rgba(255, 59, 78, 0.85);
  }

  &[data-mood='amber'] {
    color: #ffd066;
    text-shadow: 0 0 8px rgba(255, 182, 56, 0.85);
  }

  &[data-mood='teal'] {
    color: #5ef5ee;
    text-shadow: 0 0 8px rgba(30, 214, 208, 0.85);
  }

  &[data-mood='rose'] {
    color: #ff8cd0;
    text-shadow: 0 0 8px rgba(255, 94, 184, 0.85);
  }
`;

const StoneLabel = styled.span`
  position: relative;
  z-index: 1;
  font-size: clamp(0.64rem, 1.55vw, 0.86rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
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
                <OvalGemGlow data-mood={moodKey} data-active={isActive ? 'true' : 'false'} />
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
