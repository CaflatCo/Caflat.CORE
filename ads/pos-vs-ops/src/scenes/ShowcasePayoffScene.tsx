import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CinematicBackground } from "../components/CinematicBackground";
import { fontFamily, theme } from "../theme";

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

  // gentle breathing gold glow behind the line
  const glowPulse =
    interpolate(frame, [10, 40], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    (0.6 + Math.sin(frame / 14) * 0.25);

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
      <CinematicBackground tint="rgba(200,163,117,0.07)" />

      {/* breathing glow */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: glowPulse * 0.35,
        }}
      >
        <div
          style={{
            width: 760,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${theme.coffee} 0%, rgba(200,163,117,0) 65%)`,
          }}
        />
      </AbsoluteFill>

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
              fontSize: 80,
              lineHeight: 1.18,
              textAlign: "center",
              color: "#ffffff",
              maxWidth: 860,
            }}
          >
            One system.
            <br />
            Zero guesswork.
          </div>
          <div
            style={{
              opacity: lineOpacity,
              width: lineWidth,
              height: 2,
              background: theme.coffee,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
