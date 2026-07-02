import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme, fontFamily } from "../theme";

/**
 * Reusable iPad-style frame. Enters with a rise + tilt that settles flat.
 * Screen content is strictly the app's monochrome design language.
 */
export const TabletMockup: React.FC<{
  children?: React.ReactNode;
  startFrame?: number;
  width?: number;
  height?: number;
  screenTitle?: string;
}> = ({ children, startFrame = 0, width = 860, height = 920, screenTitle }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const opacity = interpolate(local, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(local, [0, 24], [70, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const rotateX = interpolate(local, [0, 26], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const scale = interpolate(local, [0, 24], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  // reflection streak sweeps once as the tablet settles
  const streakX = interpolate(local, [8, 40], [-60, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  return (
    <div style={{ perspective: 1400 }}>
      <div
        style={{
          opacity,
          width,
          height,
          translate: `0px ${translateY}px`,
          transform: `rotateX(${rotateX}deg) scale(${scale})`,
          background: "#060607",
          border: "2px solid #2a2a30",
          borderRadius: 42,
          padding: 22,
          boxShadow:
            "0 60px 140px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          position: "relative",
        }}
      >
        {/* camera dot */}
        <div
          style={{
            position: "absolute",
            top: 9,
            left: "50%",
            width: 7,
            height: 7,
            marginLeft: -3.5,
            borderRadius: "50%",
            background: "#1c1c22",
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            background: theme.dark,
            borderRadius: 24,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* app chrome bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 28px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 24,
                color: "#ffffff",
                letterSpacing: 0.3,
              }}
            >
              Caflat.CORE
            </span>
            {screenTitle ? (
              <span
                style={{
                  fontFamily,
                  fontWeight: 600,
                  fontSize: 17,
                  letterSpacing: 2.5,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {screenTitle}
              </span>
            ) : null}
          </div>

          <div style={{ flex: 1, padding: 28, position: "relative" }}>
            {children}
          </div>

          {/* one-time reflection streak */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(115deg, transparent ${streakX - 18}%, rgba(255,255,255,0.06) ${streakX}%, transparent ${streakX + 18}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
