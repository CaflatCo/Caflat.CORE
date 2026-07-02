import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CinematicBackground } from "../components/CinematicBackground";
import { fontFamily } from "../theme";

export const ShowcasePayoffScene: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 24], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const lineOpacity = interpolate(frame, [40, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineWidth = interpolate(frame, [40, 62], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      <CinematicBackground tint="rgba(255,255,255,0.06)" />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 90px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
          }}
        >
          <div
            style={{
              opacity,
              scale,
              fontFamily,
              fontWeight: 900,
              fontSize: 76,
              lineHeight: 1.16,
              textAlign: "center",
              color: "#ffffff",
              maxWidth: 860,
            }}
          >
            One system.
            <br />
            Every mode.
            <br />
            Zero guesswork.
          </div>
          <div
            style={{
              opacity: lineOpacity,
              width: lineWidth,
              height: 2,
              background: "rgba(255,255,255,0.4)",
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
