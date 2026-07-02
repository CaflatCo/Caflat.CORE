import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../theme";

const KineticWord: React.FC<{
  text: string;
  delay: number;
  color: string;
  weight: number;
}> = ({ text, delay, color, weight }) => {
  const frame = useCurrentFrame();
  const local = frame - delay;

  const opacity = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(local, [0, 12], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const blur = interpolate(local, [0, 12], [6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        translate: `0px ${translateY}px`,
        filter: `blur(${blur}px)`,
        fontFamily,
        fontWeight: weight,
        color,
      }}
    >
      {text}&nbsp;
    </span>
  );
};

/**
 * Renders each line of `lines` as its own row, staggering the words within
 * each line. `startFrame` offsets the whole block; each subsequent line
 * begins `lineGap` frames after the previous line's last word starts.
 */
export const KineticHeadline: React.FC<{
  lines: string[];
  startFrame?: number;
  fontSize?: number;
  color?: string;
  weight?: number;
  wordStep?: number;
  lineGap?: number;
  align?: "center" | "left";
}> = ({
  lines,
  startFrame = 0,
  fontSize = 60,
  color = "#ffffff",
  weight = 800,
  wordStep = 3,
  lineGap = 6,
  align = "center",
}) => {
  let cursor = startFrame;

  return (
    <div
      style={{
        fontSize,
        lineHeight: 1.16,
        textAlign: align,
      }}
    >
      {lines.map((line, li) => {
        const words = line.split(" ");
        const row = (
          <div key={li}>
            {words.map((w, wi) => {
              const delay = cursor + wi * wordStep;
              return (
                <KineticWord
                  key={wi}
                  text={w}
                  delay={delay}
                  color={color}
                  weight={weight}
                />
              );
            })}
          </div>
        );
        cursor = cursor + words.length * wordStep + lineGap;
        return row;
      })}
    </div>
  );
};
