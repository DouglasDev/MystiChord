import { styled } from '@linaria/react';
import { useEffect } from 'react';
import { MOODS, MOOD_DIAMOND_ROWS, type MoodKey } from '../musicTheory';

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(10, 3, 4, 0.78);
  backdrop-filter: blur(5px);
`;

const ModalCard = styled.div`
  width: min(560px, 100%);
  max-height: min(84dvh, 620px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(165deg, rgba(46, 13, 14, 0.97), rgba(18, 5, 6, 0.99));
  border: 1.5px solid rgba(214, 170, 92, 0.56);
  box-shadow:
    0 20px 56px rgba(0, 0, 0, 0.85),
    inset 0 1px 0 rgba(255, 226, 170, 0.16);
`;

const ModalHeader = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(214, 170, 92, 0.24);
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.16em;
  color: var(--brass-light);
  font-weight: 600;
`;

const CloseButton = styled.button`
  appearance: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(214, 170, 92, 0.45);
  background: rgba(24, 7, 8, 0.85);
  color: var(--ivory-text);
  font-family: inherit;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: var(--brass-light);
  }
`;

const ScaleHint = styled.p`
  margin: 0 0 2px;
  font-size: 0.8rem;
  color: var(--muted-brass);
  font-family: 'GFS Neohellenic', Georgia, serif;
`;

const ScaleList = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  touch-action: pan-y;
  padding: 12px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ScaleRow = styled.div`
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(12, 3, 4, 0.58);
  border: 1px solid rgba(214, 170, 92, 0.2);

  &[data-active='true'] {
    border-color: rgba(var(--aura-rgb), 0.7);
    background: rgba(24, 9, 12, 0.82);
  }
`;

const ScaleRowTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
`;

const EmotionHeading = styled.div`
  display: flex;
  align-items: baseline;
  gap: 7px;
`;

const EmotionRune = styled.span`
  font-size: 0.95rem;
`;

const EmotionName = styled.span`
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ivory-text);
`;

const EmotionOrigin = styled.span`
  font-size: 0.72rem;
  color: var(--muted-brass);
`;

const ScaleTitleTag = styled.span`
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--brass-light);
`;

const ScaleDescription = styled.p`
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
  color: rgba(234, 216, 184, 0.86);
  font-family: 'GFS Neohellenic', Georgia, serif;
`;

export interface ScaleGuideModalProps {
  open: boolean;
  activeMood: MoodKey;
  onClose: () => void;
}

const ORDERED_MOODS: MoodKey[] = MOOD_DIAMOND_ROWS.flat();

export function ScaleGuideModal({ open, activeMood, onClose }: ScaleGuideModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Backdrop
      role="dialog"
      aria-modal="true"
      aria-label="Scale Guide"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ModalCard>
        <ModalHeader>
          <ModalTitle>SCALES &amp; MODULATIONS</ModalTitle>
          <CloseButton
            type="button"
            aria-label="Close scale guide"
            onPointerDown={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ×
          </CloseButton>
        </ModalHeader>
        <ScaleList>
          <ScaleHint>Tap any stone repeatedly to modulate keys along its interval.</ScaleHint>
          {ORDERED_MOODS.map((key) => {
            const mood = MOODS[key];

            return (
              <ScaleRow key={key} data-active={activeMood === key ? 'true' : 'false'}>
                <ScaleRowTop>
                  <EmotionHeading>
                    <EmotionRune style={{ color: mood.colorHex }}>{mood.rune}</EmotionRune>
                    <EmotionName>{mood.label}</EmotionName>
                    <EmotionOrigin>({mood.origin})</EmotionOrigin>
                  </EmotionHeading>
                  <ScaleTitleTag>
                    {mood.scaleName} · {mood.tuningSystem}
                  </ScaleTitleTag>
                </ScaleRowTop>
                <ScaleDescription>{mood.description}</ScaleDescription>
              </ScaleRow>
            );
          })}
        </ScaleList>
      </ModalCard>
    </Backdrop>
  );
}
