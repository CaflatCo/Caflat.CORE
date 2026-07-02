import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CinematicBackground } from "../components/CinematicBackground";
import { DataPanel, DataRow } from "../components/DataPanel";
import { fontFamily } from "../theme";

export type ModeBeatProps = {
  index: string; // "01"
  badge: string;
  headline: string[]; // lines
  eyebrow: string;
  rows: DataRow[];
};

export const ModeBeat: React.FC<ModeBeatProps> = ({
  index,
  badge,
  headline,
  eyebrow,
  rows,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headlineOpacity = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const headlineY = interpolate(frame, [4, 24], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const bigNumOpacity = interpolate(frame, [0, 20], [0, 0.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // slow drift on background for cinematic motion
  const bgScale = interpolate(frame, [0, fps * 3], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: bgScale }}>
        <CinematicBackground tint="rgba(255,255,255,0.06)" />
      </AbsoluteFill>

      {/* giant ghost index number */}
      <div
        style={{
          position: "absolute",
          right: 30,
          bottom: -40,
          fontFamily,
          fontWeight: 900,
          fontSize: 420,
          color: "#ffffff",
          opacity: bigNumOpacity,
          lineHeight: 1,
        }}
      >
        {index}
      </div>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              opacity: badgeOpacity,
              fontFamily,
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 999,
              padding: "10px 26px",
            }}
          >
            {badge}
          </div>

          <div
            style={{
              opacity: headlineOpacity,
              translate: `0px ${headlineY}px`,
              fontFamily,
              fontWeight: 800,
              fontSize: 64,
              lineHeight: 1.14,
              color: "#ffffff",
              textAlign: "center",
              maxWidth: 820,
            }}
          >
            {headline.map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < headline.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <DataPanel eyebrow={eyebrow} rows={rows} startFrame={26} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
