import { styled } from '@linaria/react';

export const WoodPanel = styled.section`
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 10px 10px;
  border-radius: 14px;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255, 220, 170, 0.015) 0px,
      rgba(0, 0, 0, 0.07) 5px,
      rgba(255, 220, 170, 0.01) 11px
    ),
    linear-gradient(155deg, rgba(64, 39, 22, 0.82), rgba(29, 17, 10, 0.92));
  border: 1.5px solid rgba(196, 152, 78, 0.36);
  box-shadow:
    inset 0 1px 0 rgba(255, 225, 170, 0.14),
    inset 0 -2px 8px rgba(0, 0, 0, 0.65),
    0 6px 18px rgba(0, 0, 0, 0.55);

  @media (max-height: 450px) {
    padding: 5px 8px 6px;
  }
`;

export const PanelHeader = styled.div`
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
  padding: 0 2px;

  @media (max-height: 450px) {
    margin-bottom: 4px;
  }
`;

export const EtchedTitle = styled.span`
  font-size: clamp(0.62rem, 1.35vw, 0.78rem);
  letter-spacing: 0.16em;
  color: var(--brass-light);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
`;

export const EtchedHint = styled.span`
  font-size: clamp(0.55rem, 1.1vw, 0.68rem);
  letter-spacing: 0.12em;
  color: var(--muted-brass);
`;

export const RecessedWell = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 50%, #1c120b 0%, #0e0905 78%, #080503 100%);
  border: 1px solid rgba(178, 134, 66, 0.34);
  box-shadow:
    inset 0 6px 18px rgba(0, 0, 0, 0.88),
    inset 0 0 26px rgba(var(--aura-rgb), 0.07),
    0 1px 0 rgba(255, 220, 160, 0.12);
`;

export const InteractiveCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
`;
