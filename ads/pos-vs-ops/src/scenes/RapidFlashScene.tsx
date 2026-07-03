import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { theme, fontFamily } from "../theme";

type Flash = { text: string; bg: string; fg: string; len: number };

// "Alerts. Early." holds twice as long so it lands before the payoff.
const FLASHES: Flash[] = [
  { text: "Inventory. Automatic.", bg: theme.dark, fg: "#ffffff", len: 30 },
  { text: "Batches. Tracked.", bg: "#ffffff", fg: theme.dark, len: 30 },
  { text: "Beans. Traceable.", bg: "#2e2113", fg: theme.latte, len: 30 },
  { text: "Money. Accounted.", bg: "#ffffff", fg: theme.dark, len: 30 },
  { text: "Alerts. Early.", bg: theme.dark, fg: "#ffffff", len: 60 },
];

// dark hold before the first card so the light leak clears first
const LEAD_IN = 14;

const FlashCard: React.FC<Flash> = ({ text, bg, fg, len }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 4, len - 6, len], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, len], [1.06, 1.0], {
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
  let cursor = LEAD_IN;

  return (
    <AbsoluteFill>
      {FLASHES.map((flash) => {
        const from = cursor;
        cursor += flash.len;
        return (
          <Sequence
            key={flash.text}
            from={from}
            durationInFrames={flash.len}
            layout="none"
          >
            <FlashCard {...flash} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const RAPID_FLASH_DURATION =
  LEAD_IN + FLASHES.reduce((a, f) => a + f.len, 0);
