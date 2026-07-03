import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { theme, fontFamily } from "../theme";

type Flash = { text: string; bg: string; fg: string };

const FLASHES: Flash[] = [
  { text: "Inventory. Automatic.", bg: theme.dark, fg: "#ffffff" },
  { text: "Batches. Tracked.", bg: "#ffffff", fg: theme.dark },
  { text: "Beans. Traceable.", bg: "#2e2113", fg: theme.latte },
  { text: "Money. Accounted.", bg: "#ffffff", fg: theme.dark },
  { text: "Alerts. Early.", bg: theme.dark, fg: "#ffffff" },
];

const FLASH_LEN = 30;
// dark hold before the first card so the light leak clears first
const LEAD_IN = 14;

const FlashCard: React.FC<Flash> = ({ text, bg, fg }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 4, FLASH_LEN - 4, FLASH_LEN],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(frame, [0, FLASH_LEN], [1.06, 1.0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 90px",
      }}
    >
      <div
        style={{
          opacity,
          scale,
          fontFamily,
          fontWeight: 800,
          fontSize: 62,
          textAlign: "center",
          lineHeight: 1.2,
          color: fg,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const RapidFlashScene: React.FC = () => {
  return (
    <AbsoluteFill>
      {FLASHES.map((flash, i) => (
        <Sequence
          key={flash.text}
          from={LEAD_IN + i * FLASH_LEN}
          durationInFrames={FLASH_LEN}
          layout="none"
        >
          <FlashCard {...flash} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const RAPID_FLASH_DURATION = LEAD_IN + FLASHES.length * FLASH_LEN;
