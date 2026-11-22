import { styled } from '@linaria/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audioEngine';
import { MoodButtonsPanel } from './components/MoodButtonsPanel';
import { MorphKnobPanel } from './components/MorphKnobPanel';
import { PadPanel } from './components/PadPanel';
import { SmokeOverlay } from './components/SmokeOverlay';
import { ZitherPanel } from './components/ZitherPanel';
import {
  MOODS,
  getKeyAuraColor,
  getNoteName,
  getZitherStringFrequencies,
  modulateKey,
  type MoodKey,
  type ZitherStringTuning,
} from './musicTheory';

const InstrumentShell = styled.div`
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100dvh;
  padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
  display: flex;
  flex-direction: column;
  gap: 8px;
  background:
    repeating-linear-gradient(
      92deg,
      rgba(255, 214, 165, 0.018) 0px,
      rgba(255, 214, 165, 0.018) 2px,
      rgba(0, 0, 0, 0.08) 2px,
      rgba(0, 0, 0, 0.08) 7px
    ),
    repeating-linear-gradient(
      178deg,
      rgba(90, 52, 26, 0.14) 0px,
      rgba(34, 19, 10, 0.16) 14px,
      rgba(16, 9, 5, 0.22) 28px
    ),
    radial-gradient(ellipse at 50% 45%, #3d2414 0%, #24150c 58%, #120a05 100%);
  box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.85);

  @media (max-height: 450px) {
    gap: 5px;
    padding: 5px 8px;
  }
`;

const TopPlaque = styled.header`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 5px 16px;
  margin: 0 auto;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(46, 30, 17, 0.92), rgba(22, 13, 7, 0.96));
  border: 1px solid rgba(206, 162, 86, 0.42);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 224, 160, 0.18),
    0 0 18px rgba(var(--aura-rgb), 0.16);

  @media (max-height: 450px) {
    padding: 3px 12px;
  }
`;

const PlaqueOrnament = styled.span`
  font-size: 0.72rem;
  color: var(--brass-mid);
`;

const PlaqueReadout = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(0.72rem, 1.8vw, 0.9rem);
  letter-spacing: 0.09em;
  white-space: nowrap;
`;

const PlaqueKey = styled.span`
  font-weight: 700;
  color: rgb(var(--aura-rgb));
  text-shadow: 0 0 10px rgba(var(--aura-rgb), 0.7);
`;

const PlaqueScale = styled.span`
  color: var(--ivory-text);
`;

const PlaqueMood = styled.span`
  font-size: 0.85em;
  color: var(--brass-light);
`;

const PlaqueSep = styled.span`
  color: rgba(206, 162, 86, 0.45);
`;

const InstrumentGrid = styled.main`
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1.48fr 1fr;
  gap: 10px;

  @media (orientation: portrait) and (max-width: 720px) {
    grid-template-rows: 1.25fr 1fr;
    gap: 8px;
  }
`;

const AudioUnlockOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(28, 17, 10, 0.78), rgba(10, 6, 3, 0.92));
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
  background: linear-gradient(160deg, rgba(56, 34, 19, 0.95), rgba(22, 13, 8, 0.98));
  border: 1.5px solid rgba(214, 168, 92, 0.58);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.8),
    0 0 36px rgba(var(--aura-rgb), 0.22);
`;

const UnlockTitle = styled.h1`
  margin: 0 0 16px;
  font-size: clamp(1.25rem, 3.2vw, 1.8rem);
  letter-spacing: 0.2em;
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
  const [morph, setMorph] = useState(0.25);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

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
      audio.pluckString(stringInfo.index, stringInfo.freq, velocity, stringInfo.isDrone);
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
    (freq: number, x: number, y: number, bendDelta: number) => {
      audio.padMove(freq, x, y, bendDelta);
    },
    [audio],
  );

  const handlePadUp = useCallback(() => {
    audio.padUp();
  }, [audio]);

  const handleMorphChange = useCallback(
    (nextMorph: number) => {
      ensureAudio();
      setMorph(nextMorph);
      audio.setMorph(nextMorph);
    },
    [audio, ensureAudio],
  );

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

      <InstrumentShell>
        <TopPlaque aria-label="Active Key and Scale">
          <PlaqueOrnament aria-hidden="true">◈</PlaqueOrnament>
          <PlaqueReadout>
            <PlaqueKey data-testid="key-badge">{getNoteName(rootMidi)}</PlaqueKey>
            <PlaqueSep>·</PlaqueSep>
            <PlaqueScale data-testid="scale-badge">{mood.scaleName}</PlaqueScale>
            <PlaqueSep>·</PlaqueSep>
            <PlaqueMood data-testid="mood-badge">
              {mood.rune} {mood.label.toUpperCase()}
            </PlaqueMood>
          </PlaqueReadout>
          <PlaqueOrnament aria-hidden="true">◈</PlaqueOrnament>
        </TopPlaque>

        <InstrumentGrid>
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
          <MorphKnobPanel value={morph} onChange={handleMorphChange} />
        </InstrumentGrid>
      </InstrumentShell>

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
          <UnlockTitle>AETHER ZITHER</UnlockTitle>
          <UnlockAction>TOUCH TO ENABLE AUDIO</UnlockAction>
        </AudioUnlockCard>
      </AudioUnlockOverlay>
    </>
  );
}
