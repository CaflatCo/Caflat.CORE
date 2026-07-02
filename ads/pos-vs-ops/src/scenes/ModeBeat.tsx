import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CinematicBackground } from "../components/CinematicBackground";
import { DataPanel, DataRow } from "../components/DataPanel";
import { AnimatedIcon } from "../components/AnimatedIcon";
import { KineticHeadline } from "../components/KineticHeadline";
import { MiniBarChart, BarDatum } from "../components/MiniBarChart";
import { fontFamily } from "../theme";

export type ModeBeatProps = {
  index: string; // "01"
  badge: string;
  headline: string[]; // lines
  eyebrow: string;
  rows: DataRow[];
  icon: string[];
  chart?: BarDatum[];
};

export const ModeBeat: React.FC<ModeBeatProps> = ({
  index,
  badge,
  headline,
  eyebrow,
  rows,
  icon,
  chart,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bigNumOpacity = interpolate(frame, [0, 20], [0, 0.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // slow drift on background for cinematic motion
  const bgScale = interpolate(frame, [0, fps * 3], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });

  const panelStart = 26 + headline.length * 10;

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
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
            padding: "0 80px",
            boxSizing: "border-box",
            maxWidth: "100%",
          }}
        >
          <AnimatedIcon paths={icon} size={56} delayFrames={0} />

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

          <KineticHeadline
            lines={headline}
            startFrame={16}
            fontSize={64}
            wordStep={2}
            lineGap={4}
          />

          <div style={{ marginTop: 10 }}>
            <DataPanel eyebrow={eyebrow} rows={rows} startFrame={panelStart} />
          </div>

          {chart ? (
            <div style={{ marginTop: 6 }}>
              <MiniBarChart data={chart} startFrame={panelStart + 30} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
