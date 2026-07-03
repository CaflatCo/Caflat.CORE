import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CinematicBackground } from "../components/CinematicBackground";
import { fontFamily, theme } from "../theme";

/**
 * Near-wordless cold open: breathing gold light, wordmark reveal,
 * two words. That's it.
 */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  const breathe = 0.5 + Math.sin(frame / 18) * 0.25;

  const markIn = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const markSpacing = interpolate(frame, [10, 46], [14, 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const lineIn = interpolate(frame, [52, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const flash = interpolate(frame, [0, 5], [1, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <CinematicBackground tint={`rgba(200,163,117,${0.06 + breathe * 0.08})`} />

      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
          }}
        >
          <div
            style={{
              opacity: markIn,
              fontFamily,
              fontWeight: 900,
              fontSize: 84,
              letterSpacing: markSpacing,
              color: "#ffffff",
            }}
          >
            Caflat.CORE
          </div>
          <div
            style={{
              opacity: lineIn,
              translate: `0px ${(1 - lineIn) * 14}px`,
              fontFamily,
              fontWeight: 500,
              fontSize: 36,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: theme.coffee,
            }}
          >
            Your entire café. Connected.
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};
