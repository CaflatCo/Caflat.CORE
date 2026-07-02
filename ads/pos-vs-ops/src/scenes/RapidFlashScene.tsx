import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { theme, fontFamily } from "../theme";

const PHRASES = [
  "Inventory that deducts itself.",
  "Every batch, tracked.",
  "Every lot, traceable.",
  "Every peso—every payment, logged.",
  "Every low-stock alert, before it's a problem.",
];

const FLASH_LEN = 16;

const Flash: React.FC<{ text: string; invert: boolean }> = ({
  text,
  invert,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 3, FLASH_LEN - 5, FLASH_LEN],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(frame, [0, FLASH_LEN], [1.06, 1.0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: invert ? "#ffffff" : theme.dark,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 100px",
      }}
    >
      <div
        style={{
          opacity,
          scale,
          fontFamily,
          fontWeight: 800,
          fontSize: 58,
          textAlign: "center",
          lineHeight: 1.2,
          color: invert ? theme.dark : "#ffffff",
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
      {PHRASES.map((text, i) => (
        <Sequence
          key={text}
          from={i * FLASH_LEN}
          durationInFrames={FLASH_LEN}
          layout="none"
        >
          <Flash text={text} invert={i % 2 === 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const RAPID_FLASH_DURATION = PHRASES.length * FLASH_LEN;
