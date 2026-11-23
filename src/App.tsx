import { styled } from '@linaria/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import woodGrainUrl from './assets/wood-grain.jpg';
import { AudioEngine } from './audioEngine';
import { MoodButtonsPanel } from './components/MoodButtonsPanel';
import { PadPanel } from './components/PadPanel';
import { ScaleGuideModal } from './components/ScaleGuideModal';
import { SmokeOverlay } from './components/SmokeOverlay';
import { ZitherPanel } from './components/ZitherPanel';
import {
  MOODS,
  getKeyAuraColor,
  getPitchGlyph,
  getZitherStringFrequencies,
  modulateKey,
  type MoodKey,
  type ZitherStringTuning,
} from './musicTheory';

const WoodBoard = styled.div`
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100dvh;
  padding: max(6px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right))
    max(6px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  display: flex;
  flex-direction: column;
  gap: 6px;
  background-color: #2b0b0c;
  background-size: cover;
  background-position: center;
  box-shadow: inset 0 0 64px rgba(8, 2, 2, 0.85);
`;

const TopPlaque = styled.header`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 4px 16px;
  margin: 0 auto;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(46, 14, 14, 0.88), rgba(20, 6, 7, 0.94));
  border: 1px solid rgba(214, 170, 92, 0.48);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 224, 160, 0.18),
    0 0 16px rgba(var(--aura-rgb), 0.16);

  @media (max-height: 450px) {
    padding: 2px 12px;
  }
`;

const PlaqueTitle = styled.span`
  font-size: clamp(0.62rem, 1.45vw, 0.8rem);
  letter-spacing: 0.16em;
  color: var(--brass-light);
  white-space: nowrap;

  @media (max-width: 520px) {
    display: none;
  }
`;

const PlaqueReadout = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: clamp(0.7rem, 1.75vw, 0.88rem);
  letter-spacing: 0.08em;
  white-space: nowrap;
`;

const PlaqueGlyph = styled.span`
  font-weight: 700;
  color: rgb(var(--aura-rgb));
  text-shadow: 0 0 10px rgba(var(--aura-rgb), 0.72);
`;

const PlaqueMood = styled.span`
  font-size: 0.88em;
  color: var(--brass-light);
`;

const PlaqueSep = styled.span`
  color: rgba(214, 170, 92, 0.48);
`;

const BoardLayout = styled.main`
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1.45fr 1fr;
  gap: 6px;

  @media (orientation: portrait) and (max-width: 720px) {
    grid-template-rows: 1.35fr 1fr;
  }
`;

const HelpButton = styled.button`
  position: fixed;
  left: max(10px, env(safe-area-inset-left));
  bottom: max(10px, env(safe-area-inset-bottom));
  z-index: 40;
  appearance: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1.5px solid rgba(214, 170, 92, 0.62);
  background: radial-gradient(circle at 38% 32%, rgba(62, 22, 18, 0.94), rgba(20, 6, 7, 0.96));
  color: var(--brass-light);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 3px 10px rgba(0, 0, 0, 0.72),
    inset 0 1px 2px rgba(255, 228, 178, 0.22);

  &:active {
    transform: scale(0.94);
  }
`;

const AudioUnlockOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(36, 10, 10, 0.8), rgba(10, 3, 4, 0.92));
  backdrop-filter: blur(4px);
  cursor: pointer;
  transition:
    opacity 0.3s ease,
    visibility 0.3s ease;

  &[data-hidden='true'] {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
`;

const AudioUnlockCard = styled.div`
  padding: 24px 36px;
  border-radius: 16px;
  text-align: center;
  background: linear-gradient(160deg, rgba(64, 18, 18, 0.95), rgba(22, 6, 7, 0.98));
  border: 1.5px solid rgba(218, 172, 94, 0.6);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.82),
    0 0 36px rgba(var(--aura-rgb), 0.22);
`;

const UnlockTitle = styled.h1`
  margin: 0 0 16px;
  font-size: clamp(1.15rem, 3vw, 1.7rem);
  letter-spacing: 0.18em;
  color: var(--ivory-text);
  font-weight: 600;
`;

const UnlockAction = styled.div`
  display: inline-block;
  padding: 9px 22px;
  border-radius: 999px;
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  color: #fff8ea;
  background: linear-gradient(
    90deg,
    rgba(var(--aura-rgb), 0.28),
    rgba(var(--aura-rgb), 0.48),
    rgba(var(--aura-rgb), 0.28)
  );
  border: 1px solid rgba(var(--aura-rgb), 0.75);
  box-shadow: 0 0 16px rgba(var(--aura-rgb), 0.35);
`;

export function App() {
  const audioRef = useRef<AudioEngine | null>(null);

  if (!audioRef.current) {
    audioRef.current = new AudioEngine();
  }

  const audio = audioRef.current;

  const [rootMidi, setRootMidi] = useState(38);
  const [moodKey, setMoodKey] = useState<MoodKey>('blue');
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const mood = MOODS[moodKey];
  const aura = useMemo(() => getKeyAuraColor(rootMidi, moodKey), [rootMidi, moodKey]);
  const zitherTunings = useMemo(
    () => getZitherStringFrequencies(rootMidi, mood.intervals, 8),
    [rootMidi, mood.intervals],
  );

  useEffect(() => {
    const [r, g, b] = aura.secondary.map((v) => Math.round(v * 255));

    document.documentElement.style.setProperty('--aura-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--aura-hex', mood.colorHex);
  }, [aura, mood.colorHex]);

  const ensureAudio = useCallback(() => {
    setAudioUnlocked(true);
    void audio.ensureStarted();
  }, [audio]);

  const handlePluck = useCallback(
    (stringInfo: ZitherStringTuning, velocity: number) => {
      ensureAudio();
      audio.pluckString(stringInfo.index, stringInfo.freq, velocity, stringInfo.isLowRed);
    },
    [audio, ensureAudio],
  );

  const handlePadDown = useCallback(
    (freq: number, x: number, y: number) => {
      ensureAudio();
      audio.padDown(freq, x, y);
    },
    [audio, ensureAudio],
  );

  const handlePadMove = useCallback(
    (freq: number, x: number, y: number, motionEnergy: number, isBending: boolean) => {
      audio.padMove(freq, x, y, motionEnergy, isBending);
    },
    [audio],
  );

  const handlePadUp = useCallback(() => {
    audio.padUp();
  }, [audio]);

  const handleSelectMood = useCallback(
    (nextMoodKey: MoodKey) => {
      ensureAudio();
      setMoodKey(nextMoodKey);

      setRootMidi((prevRoot) => {
        const nextRoot = modulateKey(prevRoot, nextMoodKey);
        const nextTunings = getZitherStringFrequencies(nextRoot, MOODS[nextMoodKey].intervals, 8);

        audio.retuneActiveZither(nextTunings);
        audio.pluckString(0, nextTunings[0].freq, 0.48, true);

        return nextRoot;
      });
    },
    [audio, ensureAudio],
  );

  return (
    <>
      <SmokeOverlay audio={audio} aura={aura} />

      <WoodBoard
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 42%, rgba(72, 16, 16, 0.24) 0%, rgba(16, 4, 5, 0.68) 100%), url(${woodGrainUrl})`,
        }}
      >
        <TopPlaque aria-label="Eleusinian MystiChord Status">
          <PlaqueTitle>ELEUSINIAN MYSTICHORD</PlaqueTitle>
          <PlaqueReadout>
            <PlaqueGlyph data-testid="key-badge">{getPitchGlyph(rootMidi)}</PlaqueGlyph>
            <PlaqueSep>·</PlaqueSep>
            <PlaqueMood data-testid="mood-badge">
              {mood.rune} {mood.label.toUpperCase()}
            </PlaqueMood>
          </PlaqueReadout>
        </TopPlaque>

        <BoardLayout>
          <ZitherPanel
            tunings={zitherTunings}
            auraRgb={aura.secondary}
            auraHex={mood.colorHex}
            onPluck={handlePluck}
          />
          <PadPanel
            padRootMidi={rootMidi + 12}
            intervals={mood.intervals}
            auraRgb={aura.secondary}
            onPadDown={handlePadDown}
            onPadMove={handlePadMove}
            onPadUp={handlePadUp}
          />
          <MoodButtonsPanel activeMood={moodKey} onSelectMood={handleSelectMood} />
        </BoardLayout>
      </WoodBoard>

      <HelpButton
        type="button"
        aria-label="Open scale guide"
        data-testid="scale-guide-btn"
        onClick={() => setGuideOpen(true)}
      >
        ?
      </HelpButton>

      <ScaleGuideModal open={guideOpen} activeMood={moodKey} onClose={() => setGuideOpen(false)} />

      <AudioUnlockOverlay
        role="button"
        tabIndex={0}
        aria-label="Touch to enable audio"
        data-hidden={audioUnlocked ? 'true' : 'false'}
        onPointerDown={(e) => {
          e.preventDefault();
          ensureAudio();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ensureAudio();
          }
        }}
      >
        <AudioUnlockCard>
          <UnlockTitle>ELEUSINIAN MYSTICHORD</UnlockTitle>
          <UnlockAction>TOUCH TO ENABLE AUDIO</UnlockAction>
        </AudioUnlockCard>
      </AudioUnlockOverlay>
    </>
  );
}
