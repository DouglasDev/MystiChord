import { styled } from '@linaria/react';
import { useState } from 'react';
import { MOOD_ORDER, MOODS, type MoodKey } from '../musicTheory';
import { EtchedHint, EtchedTitle, PanelHeader, WoodPanel } from './PanelPrimitives';

const MoodGrid = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 8px;

  @media (max-height: 450px) {
    gap: 5px;
  }
`;

const MoodStoneButton = styled.button`
  position: relative;
  overflow: hidden;
  appearance: none;
  border: 1.5px solid rgba(196, 154, 82, 0.42);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  touch-action: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: var(--ivory-text);
  font-family: inherit;
  background: linear-gradient(160deg, rgba(44, 28, 17, 0.92), rgba(18, 11, 7, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255, 226, 176, 0.16),
    inset 0 -3px 8px rgba(0, 0, 0, 0.72),
    0 3px 8px rgba(0, 0, 0, 0.48);
  transition:
    transform 0.08s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;

  &:active {
    transform: scale(0.96);
  }

  &[data-mood='blue'][data-active='true'] {
    border-color: rgba(74, 198, 255, 0.88);
    box-shadow:
      0 0 16px rgba(40, 168, 255, 0.38),
      inset 0 0 14px rgba(40, 168, 255, 0.25);
  }

  &[data-mood='green'][data-active='true'] {
    border-color: rgba(66, 232, 152, 0.88);
    box-shadow:
      0 0 16px rgba(38, 217, 138, 0.38),
      inset 0 0 14px rgba(38, 217, 138, 0.25);
  }

  &[data-mood='purple'][data-active='true'] {
    border-color: rgba(188, 108, 255, 0.88);
    box-shadow:
      0 0 16px rgba(165, 82, 255, 0.38),
      inset 0 0 14px rgba(165, 82, 255, 0.25);
  }

  &[data-mood='red'][data-active='true'] {
    border-color: rgba(255, 92, 106, 0.88);
    box-shadow:
      0 0 16px rgba(255, 59, 78, 0.38),
      inset 0 0 14px rgba(255, 59, 78, 0.25);
  }

  @media (orientation: portrait) and (max-width: 720px) {
    flex-direction: column;
    justify-content: center;
    text-align: center;
    padding: 6px 4px;
    gap: 2px;
  }

  @media (max-height: 450px) {
    padding: 4px 8px;
  }
`;

const GemGlow = styled.span`
  position: absolute;
  inset: 0;
  opacity: 0.2;
  pointer-events: none;
  transition: opacity 0.25s ease;

  &[data-active='true'] {
    opacity: 0.56;
  }

  &[data-mood='blue'] {
    background: radial-gradient(
      circle at 26% 50%,
      #32b4ff 0%,
      rgba(24, 112, 210, 0.35) 55%,
      transparent 85%
    );
  }

  &[data-mood='green'] {
    background: radial-gradient(
      circle at 26% 50%,
      #34eb99 0%,
      rgba(16, 165, 98, 0.35) 55%,
      transparent 85%
    );
  }

  &[data-mood='purple'] {
    background: radial-gradient(
      circle at 26% 50%,
      #be6aff 0%,
      rgba(128, 42, 220, 0.35) 55%,
      transparent 85%
    );
  }

  &[data-mood='red'] {
    background: radial-gradient(
      circle at 26% 50%,
      #ff4b5c 0%,
      rgba(210, 32, 48, 0.35) 55%,
      transparent 85%
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
    animation: stone-pulse 0.38s ease-out;
  }

  @keyframes stone-pulse {
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

const MoodRune = styled.span`
  position: relative;
  z-index: 1;
  font-size: clamp(1rem, 2.5vw, 1.35rem);
  line-height: 1;

  &[data-mood='blue'] {
    color: #56c8ff;
    text-shadow: 0 0 8px rgba(40, 168, 255, 0.8);
  }

  &[data-mood='green'] {
    color: #52f0a8;
    text-shadow: 0 0 8px rgba(38, 217, 138, 0.8);
  }

  &[data-mood='purple'] {
    color: #cc84ff;
    text-shadow: 0 0 8px rgba(165, 82, 255, 0.8);
  }

  &[data-mood='red'] {
    color: #ff6b78;
    text-shadow: 0 0 8px rgba(255, 59, 78, 0.8);
  }
`;

const MoodLabel = styled.span`
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  text-align: left;
  font-size: clamp(0.72rem, 1.6vw, 0.92rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;

  @media (orientation: portrait) and (max-width: 720px) {
    text-align: center;
    flex: 0 0 auto;
  }
`;

const MoodStep = styled.span`
  position: relative;
  z-index: 1;
  font-size: clamp(0.58rem, 1.15vw, 0.72rem);
  color: var(--muted-brass);
  letter-spacing: 0.06em;
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
    <WoodPanel aria-label="Key Modulation">
      <PanelHeader>
        <EtchedTitle>MODULATION</EtchedTitle>
        <EtchedHint>KEY · SCALE</EtchedHint>
      </PanelHeader>
      <MoodGrid>
        {MOOD_ORDER.map((moodKey) => {
          const mood = MOODS[moodKey];
          const isActive = activeMood === moodKey;
          const isPulsing = pulseState.mood === moodKey;

          return (
            <MoodStoneButton
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
              <GemGlow data-mood={moodKey} data-active={isActive ? 'true' : 'false'} />
              <PulseFlash
                key={isPulsing ? pulseState.seq : 0}
                data-pulsing={isPulsing ? 'true' : 'false'}
              />
              <MoodRune data-mood={moodKey}>{mood.rune}</MoodRune>
              <MoodLabel>{mood.label}</MoodLabel>
              <MoodStep>{mood.modulationLabel}</MoodStep>
            </MoodStoneButton>
          );
        })}
      </MoodGrid>
    </WoodPanel>
  );
}
