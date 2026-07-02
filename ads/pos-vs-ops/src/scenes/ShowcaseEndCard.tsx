import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CinematicBackground } from "../components/CinematicBackground";
import { theme, fontFamily } from "../theme";

export const ShowcaseEndCard: React.FC = () => {
  const frame = useCurrentFrame();

  const wordmarkOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkY = interpolate(frame, [0, 24], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const taglineOpacity = interpolate(frame, [22, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // the one warm accent moment in an otherwise monochrome film
  const shimmer = interpolate(frame, [50, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const ctaOpacity = interpolate(frame, [60, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaY = interpolate(frame, [60, 82], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      <CinematicBackground tint="rgba(255,255,255,0.05)" />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              opacity: wordmarkOpacity,
              translate: `0px ${wordmarkY}px`,
              fontFamily,
              fontWeight: 900,
              fontSize: 64,
              letterSpacing: 0.5,
              color: "#ffffff",
            }}
          >
            Caflat.CORE
          </div>

          <div
            style={{
              opacity: taglineOpacity,
              fontFamily,
              fontWeight: 500,
              fontSize: 32,
              lineHeight: 1.5,
              textAlign: "center",
              color: "rgba(255,255,255,0.55)",
              maxWidth: 620,
            }}
          >
            The operating system behind{" "}
            <span
              style={{
                color: `rgb(${interpolate(
                  shimmer,
                  [0, 1],
                  [244, 200],
                )}, ${interpolate(shimmer, [0, 1], [242, 163])}, ${interpolate(
                  shimmer,
                  [0, 1],
                  [238, 117],
                )})`,
                fontWeight: 700,
              }}
            >
              every great cafe.
            </span>
          </div>

          <div
            style={{
              opacity: ctaOpacity,
              translate: `0px ${ctaY}px`,
              marginTop: 30,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 26,
                color: theme.dark,
                background: "#ffffff",
                padding: "18px 42px",
                borderRadius: 999,
                letterSpacing: 0.3,
              }}
            >
              Request Early Access
            </div>
            <div
              style={{
                fontFamily,
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: 1,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              caflatcore.com
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
